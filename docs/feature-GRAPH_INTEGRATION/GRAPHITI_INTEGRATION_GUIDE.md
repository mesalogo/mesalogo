# Graphiti 集成指南 - 基于现有系统架构

## 概述

Graphiti 是一个用于构建和查询时间感知知识图谱的框架，专为在动态环境中运行的 AI 代理量身定制。本指南将展示如何在现有的 ABM-LLM-v2 系统中集成 Graphiti，**复用现有的嵌入模型服务和向量数据库基础设施**。

## 核心特性

- **实时增量更新**：无需批量重新计算即可立即集成新数据
- **双时态数据模型**：明确跟踪事件发生和摄取时间，允许准确的时间点查询
- **高效混合检索**：结合语义嵌入、关键词（BM25）和图遍历实现低延迟查询
- **自定义实体定义**：通过简单的 Pydantic 模型支持灵活的本体创建和开发者定义的实体
- **可扩展性**：通过并行处理高效管理大型数据集

## 现有系统集成优势

### 复用现有基础设施
- ✅ **嵌入模型服务**：复用现有的 `EmbeddingService` 和 `sentence-transformers`
- ✅ **向量数据库**：利用现有的 TiDB Vector 和 Milvus 支持
- ✅ **模型配置**：使用现有的 `ModelConfig` 系统
- ✅ **API 架构**：集成到现有的 Flask 应用框架中

### 系统要求（基于现有环境）
- ✅ Python 3.10+ （已满足）
- ✅ sentence-transformers==3.3.1 （已安装）
- ✅ TiDB Vector / Milvus （已配置）
- ⚠️ Neo4j 5.26+ 或 FalkorDB 1.1.2+ （需要新增）

## 安装步骤

### 1. 添加 Graphiti 依赖

在现有的 `requirements.txt` 中添加：

```bash
# 在 backend/requirements.txt 中添加
graphiti-core==0.18.0
neo4j==5.26.0  # 或者使用 FalkorDB
```

### 2. 图数据库选择

#### 选项 A：Neo4j（推荐）
```bash
# 使用 Docker 快速启动
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.26
```

#### 选项 B：FalkorDB（轻量级）
```bash
# 使用 Docker 启动 FalkorDB
docker run -d \
  --name falkordb \
  -p 6379:6379 -p 3000:3000 \
  falkordb/falkordb:latest
```

### 3. 环境变量配置

在现有的 `.env` 文件中添加：

```bash
# Graphiti 图数据库配置
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# 或者使用 FalkorDB
# FALKORDB_HOST=localhost
# FALKORDB_PORT=6379

# Graphiti 性能配置
GRAPHITI_SEMAPHORE_LIMIT=10  # 并发限制，防止 429 错误
GRAPHITI_USE_PARALLEL_RUNTIME=false  # Neo4j 并行运行时
GRAPHITI_TELEMETRY_ENABLED=false  # 禁用遥测数据收集
```

## 集成到现有系统

### 1. 创建 Graphiti 适配器服务

创建 `backend/app/services/graphiti_service.py`：

```python
"""
Graphiti 知识图谱服务
集成现有的嵌入模型和向量数据库基础设施
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union, Tuple

from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType
from graphiti_core.embedder.base import BaseEmbedder
from graphiti_core.embedder.config import EmbedderConfig

from app.services.vector_db.embedding_service import embedding_service
from app.models import ModelConfig

logger = logging.getLogger(__name__)


class CustomEmbedder(BaseEmbedder):
    """自定义嵌入器，复用现有的嵌入服务"""

    def __init__(self, config: EmbedderConfig):
        super().__init__(config)
        self.embedding_service = embedding_service
        self.model_config = None

    async def embed_text(self, text: str) -> List[float]:
        """嵌入单个文本"""
        if not self.model_config:
            self.model_config = self.embedding_service.get_default_embedding_model()

        if not self.model_config:
            raise ValueError("未找到可用的嵌入模型")

        success, embedding, _ = self.embedding_service.generate_single_embedding(
            text, self.model_config
        )

        if not success:
            raise ValueError(f"生成嵌入向量失败: {embedding}")

        return embedding

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """批量嵌入文本"""
        if not self.model_config:
            self.model_config = self.embedding_service.get_default_embedding_model()

        if not self.model_config:
            raise ValueError("未找到可用的嵌入模型")

        success, embeddings, _ = self.embedding_service.generate_embeddings(
            texts, self.model_config
        )

        if not success:
            raise ValueError(f"批量生成嵌入向量失败: {embeddings}")

        return embeddings


class GraphitiService:
    """Graphiti 知识图谱服务"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._graphiti = None
        self._initialized = False

    async def initialize(self) -> Tuple[bool, str]:
        """初始化 Graphiti 服务"""
        try:
            # 获取图数据库配置
            neo4j_uri = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
            neo4j_user = os.getenv('NEO4J_USER', 'neo4j')
            neo4j_password = os.getenv('NEO4J_PASSWORD', 'password')

            # 创建自定义嵌入器
            custom_embedder = CustomEmbedder(EmbedderConfig())

            # 初始化 Graphiti（复用现有嵌入服务）
            self._graphiti = Graphiti(
                uri=neo4j_uri,
                user=neo4j_user,
                password=neo4j_password,
                embedder=custom_embedder
            )

            # 构建索引和约束
            await self._graphiti.build_indices_and_constraints()

            self._initialized = True
            self.logger.info("Graphiti 服务初始化成功")
            return True, "Graphiti 服务初始化成功"

        except Exception as e:
            error_msg = f"Graphiti 服务初始化失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg

    def is_initialized(self) -> bool:
        """检查服务是否已初始化"""
        return self._initialized and self._graphiti is not None
```

    async def add_episode(
        self,
        name: str,
        content: Union[str, Dict[str, Any]],
        episode_type: EpisodeType = EpisodeType.text,
        source_description: str = "system_data",
        reference_time: Optional[datetime] = None
    ) -> Tuple[bool, str]:
        """添加数据集到知识图谱"""
        try:
            if not self.is_initialized():
                return False, "Graphiti 服务未初始化"

            # 处理内容格式
            episode_body = content if isinstance(content, str) else json.dumps(content)

            # 设置默认时间
            if reference_time is None:
                reference_time = datetime.now(timezone.utc)

            # 添加到 Graphiti
            await self._graphiti.add_episode(
                name=name,
                episode_body=episode_body,
                source=episode_type,
                source_description=source_description,
                reference_time=reference_time
            )

            self.logger.info(f"成功添加数据集: {name}")
            return True, f"成功添加数据集: {name}"

        except Exception as e:
            error_msg = f"添加数据集失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg

    async def search(
        self,
        query: str,
        center_node_uuid: Optional[str] = None,
        limit: int = 10
    ) -> Tuple[bool, Union[List[Dict[str, Any]], str]]:
        """搜索知识图谱"""
        try:
            if not self.is_initialized():
                return False, "Graphiti 服务未初始化"

            # 执行搜索
            results = await self._graphiti.search(
                query=query,
                center_node_uuid=center_node_uuid,
                limit=limit
            )

            # 格式化结果
            formatted_results = []
            for result in results:
                formatted_results.append({
                    'uuid': result.uuid,
                    'fact': result.fact,
                    'valid_at': result.valid_at.isoformat() if result.valid_at else None,
                    'invalid_at': result.invalid_at.isoformat() if result.invalid_at else None,
                    'source_node_uuid': getattr(result, 'source_node_uuid', None)
                })

            return True, formatted_results

        except Exception as e:
            error_msg = f"搜索失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg

    async def close(self):
        """关闭 Graphiti 连接"""
        if self._graphiti:
            await self._graphiti.close()
            self._initialized = False


# 全局服务实例
graphiti_service = GraphitiService()
```

### 2. 集成到 Flask 应用

在 `backend/app/__init__.py` 中添加初始化：

```python
from app.services.graphiti_service import graphiti_service

async def init_graphiti():
    """初始化 Graphiti 服务"""
    success, message = await graphiti_service.initialize()
    if success:
        logger.info("Graphiti 服务启动成功")
    else:
        logger.error(f"Graphiti 服务启动失败: {message}")

# 在应用启动时调用
# init_graphiti() 需要在异步上下文中调用
```

### 3. 创建 API 路由

创建 `backend/app/api/routes/graphiti.py`：

```python
"""
Graphiti 知识图谱 API 路由
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import asyncio

from app.services.graphiti_service import graphiti_service
from graphiti_core.nodes import EpisodeType

graphiti_bp = Blueprint('graphiti', __name__, url_prefix='/api/graphiti')


@graphiti_bp.route('/status', methods=['GET'])
def get_status():
    """获取 Graphiti 服务状态"""
    return jsonify({
        'initialized': graphiti_service.is_initialized(),
        'service': 'Graphiti Knowledge Graph'
    })


@graphiti_bp.route('/episodes', methods=['POST'])
def add_episode():
    """添加数据集到知识图谱"""
    try:
        data = request.get_json()

        # 验证必需字段
        if not data.get('name') or not data.get('content'):
            return jsonify({'error': '缺少必需字段: name, content'}), 400

        # 解析参数
        name = data['name']
        content = data['content']
        episode_type = EpisodeType.text if data.get('type') == 'text' else EpisodeType.json
        source_description = data.get('source_description', 'api_input')

        # 异步调用
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        success, message = loop.run_until_complete(
            graphiti_service.add_episode(
                name=name,
                content=content,
                episode_type=episode_type,
                source_description=source_description
            )
        )

        loop.close()

        if success:
            return jsonify({'message': message})
        else:
            return jsonify({'error': message}), 500

    except Exception as e:
        return jsonify({'error': f'添加数据集失败: {str(e)}'}), 500


@graphiti_bp.route('/search', methods=['GET'])
def search_knowledge():
    """搜索知识图谱"""
    try:
        query = request.args.get('q')
        if not query:
            return jsonify({'error': '缺少查询参数 q'}), 400

        center_node_uuid = request.args.get('center_node_uuid')
        limit = int(request.args.get('limit', 10))

        # 异步调用
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        success, results = loop.run_until_complete(
            graphiti_service.search(
                query=query,
                center_node_uuid=center_node_uuid,
                limit=limit
            )
        )

        loop.close()

        if success:
            return jsonify({
                'query': query,
                'results': results,
                'count': len(results)
            })
        else:
            return jsonify({'error': results}), 500

    except Exception as e:
        return jsonify({'error': f'搜索失败: {str(e)}'}), 500
```

### 4. 注册路由

在 `backend/app/__init__.py` 中注册路由：

```python
from app.api.routes.graphiti import graphiti_bp

def create_app():
    # ... 现有代码 ...

    # 注册 Graphiti 路由
    app.register_blueprint(graphiti_bp)

    return app
```

## 使用示例

### 1. 基础使用

```python
# 添加文本数据
curl -X POST http://localhost:8080/api/graphiti/episodes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户对话_001",
    "content": "用户询问关于产品价格的问题",
    "type": "text",
    "source_description": "customer_conversation"
  }'

# 添加结构化数据
curl -X POST http://localhost:8080/api/graphiti/episodes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "产品信息_001",
    "content": {
      "product_name": "智能手机",
      "price": 2999,
      "category": "电子产品",
      "brand": "华为"
    },
    "type": "json",
    "source_description": "product_database"
  }'

# 搜索知识图谱
curl "http://localhost:8080/api/graphiti/search?q=智能手机价格&limit=5"
```

### 2. 与现有数据库集成

```python
# 在现有的数据处理流程中集成 Graphiti
from app.services.graphiti_service import graphiti_service
from app.models import Conversation, Message

async def sync_conversations_to_graphiti():
    """将对话数据同步到知识图谱"""
    conversations = Conversation.query.all()

    for conv in conversations:
        # 构建对话摘要
        messages = Message.query.filter_by(conversation_id=conv.id).all()
        conversation_content = "\n".join([f"{msg.role}: {msg.content}" for msg in messages])

        # 添加到 Graphiti
        success, message = await graphiti_service.add_episode(
            name=f"对话_{conv.id}",
            content=conversation_content,
            episode_type=EpisodeType.text,
            source_description="conversation_history",
            reference_time=conv.created_at
        )

        if success:
            print(f"同步对话 {conv.id} 成功")
        else:
            print(f"同步对话 {conv.id} 失败: {message}")

# 在消息处理中实时添加
async def process_new_message(message: Message):
    """处理新消息时同时更新知识图谱"""
    # 现有的消息处理逻辑
    # ...

    # 添加到知识图谱
    await graphiti_service.add_episode(
        name=f"消息_{message.id}",
        content=f"{message.role}: {message.content}",
        episode_type=EpisodeType.text,
        source_description="real_time_message"
    )
```

## 高级配置

### 1. 复用现有 LLM 配置

如果需要使用现有的 LLM 配置而不是默认的 OpenAI，可以自定义 LLM 客户端：

```python
from graphiti_core.llm_client.base import BaseLLMClient
from app.services.conversation.model_client import ModelClient

class CustomLLMClient(BaseLLMClient):
    """自定义 LLM 客户端，复用现有的模型服务"""

    def __init__(self):
        self.model_client = ModelClient()

    async def generate_response(self, messages, **kwargs):
        # 使用现有的模型客户端
        # 需要根据具体的 ModelClient 接口进行适配
        pass

# 在 GraphitiService 中使用
custom_llm_client = CustomLLMClient()
self._graphiti = Graphiti(
    uri=neo4j_uri,
    user=neo4j_user,
    password=neo4j_password,
    embedder=custom_embedder,
    llm_client=custom_llm_client  # 使用自定义 LLM 客户端
)
```

### 2. 自定义实体类型

```python
from pydantic import BaseModel
from graphiti_core.nodes import EntityNode

class ProductEntity(EntityNode):
    """产品实体"""
    name: str
    price: float
    category: str
    brand: str

class CustomerEntity(EntityNode):
    """客户实体"""
    name: str
    email: str
    phone: str
    segment: str

# 在添加数据时可以指定实体类型
```

### 3. 与现有向量数据库协同

```python
from app.services.vector_db import vector_db_service

async def hybrid_knowledge_search(query: str, top_k: int = 10):
    """混合知识搜索：结合 Graphiti 和现有向量数据库"""

    # 1. 使用 Graphiti 进行图搜索
    graphiti_success, graphiti_results = await graphiti_service.search(
        query=query, limit=top_k//2
    )

    # 2. 使用现有向量数据库进行语义搜索
    vector_results = []
    if vector_db_service.is_available():
        success, results, _ = vector_db_service.search_documents(
            knowledge_base="general_knowledge",
            query=query,
            top_k=top_k//2
        )
        if success:
            vector_results = results

    # 3. 合并和重排序结果
    combined_results = {
        'graphiti_results': graphiti_results if graphiti_success else [],
        'vector_results': vector_results,
        'query': query
    }

    return combined_results
```

## 性能优化

### 1. 环境变量调优

```bash
# 根据系统性能调整并发限制
export GRAPHITI_SEMAPHORE_LIMIT=20  # 增加并发（如果 LLM 提供商支持）

# 启用 Neo4j 并行运行时（企业版）
export GRAPHITI_USE_PARALLEL_RUNTIME=true

# 调整嵌入批处理大小
export EMBEDDING_BATCH_SIZE=32
```

### 2. 批量数据处理

```python
async def batch_sync_data():
    """批量同步现有数据到 Graphiti"""
    from app.models import Document, Conversation

    # 批量处理文档
    documents = Document.query.limit(1000).all()
    tasks = []

    for doc in documents:
        task = graphiti_service.add_episode(
            name=f"文档_{doc.id}",
            content=doc.content,
            episode_type=EpisodeType.text,
            source_description="document_sync",
            reference_time=doc.created_at
        )
        tasks.append(task)

    # 并发执行，但控制并发数量
    import asyncio
    semaphore = asyncio.Semaphore(10)  # 限制并发数

    async def limited_task(task):
        async with semaphore:
            return await task

    results = await asyncio.gather(*[limited_task(task) for task in tasks])

    success_count = sum(1 for success, _ in results if success)
    print(f"批量同步完成: {success_count}/{len(results)} 成功")
```

## 最佳实践

### 1. 数据组织策略
- **有意义的命名**：使用描述性的 episode 名称，如 `对话_用户123_20250126`
- **时间管理**：确保 reference_time 准确反映数据的实际时间戳
- **分类标记**：使用 source_description 进行数据来源分类

### 2. 错误处理和监控
```python
import logging
from app.utils.monitoring import monitor_performance

@monitor_performance
async def safe_add_episode(name: str, content: str, max_retries: int = 3):
    """安全添加数据集，带重试机制"""
    for attempt in range(max_retries):
        try:
            success, message = await graphiti_service.add_episode(
                name=name, content=content
            )
            if success:
                return True, message
            else:
                logging.warning(f"添加失败 (尝试 {attempt + 1}): {message}")
        except Exception as e:
            logging.error(f"添加异常 (尝试 {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                return False, f"达到最大重试次数: {e}"
            await asyncio.sleep(2 ** attempt)  # 指数退避

    return False, "未知错误"
```

### 3. 性能监控
```python
# 在 app/utils/monitoring.py 中添加
import time
from functools import wraps

def monitor_graphiti_performance(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            logging.info(f"Graphiti操作 {func.__name__} 耗时: {duration:.2f}秒")
            return result
        except Exception as e:
            duration = time.time() - start_time
            logging.error(f"Graphiti操作 {func.__name__} 失败 (耗时: {duration:.2f}秒): {e}")
            raise
    return wrapper
```

## 故障排除

### 常见问题及解决方案

1. **Neo4j 连接失败**
   ```bash
   # 检查 Neo4j 服务状态
   docker ps | grep neo4j

   # 查看 Neo4j 日志
   docker logs neo4j
   ```

2. **嵌入模型加载失败**
   ```python
   # 检查现有嵌入服务状态
   from app.services.vector_db.embedding_service import embedding_service
   model = embedding_service.get_default_embedding_model()
   print(f"默认嵌入模型: {model.name if model else 'None'}")
   ```

3. **内存使用过高**
   ```python
   # 调整批处理大小
   os.environ['EMBEDDING_BATCH_SIZE'] = '16'  # 减少批处理大小
   os.environ['GRAPHITI_SEMAPHORE_LIMIT'] = '5'  # 减少并发数
   ```

4. **查询性能慢**
   ```python
   # 启用查询缓存和索引优化
   # 在 Neo4j 中创建适当的索引
   ```

### 调试技巧

```python
# 启用详细日志
logging.getLogger('graphiti_core').setLevel(logging.DEBUG)
logging.getLogger('app.services.graphiti_service').setLevel(logging.DEBUG)

# 检查服务状态
async def debug_graphiti_status():
    print(f"Graphiti 初始化状态: {graphiti_service.is_initialized()}")

    # 检查嵌入服务
    from app.services.vector_db.embedding_service import embedding_service
    model = embedding_service.get_default_embedding_model()
    print(f"嵌入模型: {model.name if model else 'None'}")

    # 测试简单查询
    if graphiti_service.is_initialized():
        success, results = await graphiti_service.search("测试查询", limit=1)
        print(f"测试查询结果: {success}, 结果数: {len(results) if success else 0}")
```

## 部署注意事项

### 1. 生产环境配置
```bash
# 生产环境环境变量
export FLASK_ENV=production
export NEO4J_URI=bolt://your-neo4j-server:7687
export NEO4J_USER=your_user
export NEO4J_PASSWORD=your_secure_password
export GRAPHITI_TELEMETRY_ENABLED=false
export GRAPHITI_SEMAPHORE_LIMIT=15
```

### 2. 数据备份策略
```bash
# Neo4j 数据备份
docker exec neo4j neo4j-admin database dump neo4j --to-path=/backups/

# 定期备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec neo4j neo4j-admin database dump neo4j --to-path=/backups/graphiti_backup_$DATE
```

## 下一步

### 立即行动项
1. ✅ 安装 Neo4j 或 FalkorDB
2. ✅ 添加 Graphiti 依赖到 requirements.txt
3. ✅ 创建 GraphitiService 类
4. ✅ 实现 API 路由
5. ✅ 测试基础功能

### 进阶功能
- 探索 [自定义实体类型](https://help.getzep.com/graphiti/core-concepts/custom-entity-and-edge-types)
- 了解 [社区功能](https://help.getzep.com/graphiti/core-concepts/communities)
- 查看 [高级搜索技术](https://help.getzep.com/graphiti/working-with-data/searching)
- 集成 [LangGraph Agent](https://help.getzep.com/graphiti/integrations/lang-graph-agent)

## 参考资源

- [Graphiti GitHub 仓库](https://github.com/getzep/graphiti)
- [官方文档](https://help.getzep.com/graphiti)
- [快速开始示例](https://github.com/getzep/graphiti/tree/main/examples/quickstart)
- [Discord 社区](https://discord.com/invite/W8Kw6bsgXQ)
- [现有系统向量数据库文档](./TIDB_VECTOR_INTEGRATION_SUMMARY.md)
