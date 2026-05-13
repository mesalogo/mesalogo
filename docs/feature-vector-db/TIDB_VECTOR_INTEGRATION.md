# TiDB向量数据库集成文档

## 概述

本文档介绍了ABM-LLM-v2项目中TiDB向量数据库的集成实现，提供了完整的向量存储和检索功能，为知识库开发和嵌入模型集成提供技术支持。

## 功能特性

### 核心功能
- **向量存储**：支持高维向量数据的存储和管理
- **语义搜索**：基于向量相似度的语义搜索功能
- **嵌入模型集成**：支持多种嵌入模型，包括本地和API模型
- **批量操作**：支持文档的批量插入和处理
- **元数据过滤**：支持基于元数据的过滤查询
- **多种距离度量**：支持余弦距离、欧几里得距离等

### 技术特点
- **高性能**：基于TiDB Cloud的分布式架构
- **可扩展**：支持大规模向量数据存储
- **易用性**：提供统一的API接口
- **可靠性**：完整的错误处理和连接管理

## 架构设计

### 模块结构
```
app/services/vector_db/
├── __init__.py              # 模块初始化和便捷接口
├── tidb_config.py           # TiDB配置管理
├── tidb_connection.py       # 数据库连接管理
├── tidb_vector_service.py   # 统一服务接口
├── table_manager.py         # 向量表管理
├── embedding_service.py     # 嵌入模型服务
├── vector_operations.py     # 向量操作核心功能
└── models.py               # 数据模型定义
```

### 核心组件

#### 1. 配置管理 (tidb_config.py)
- `TiDBConfig`: 配置数据类
- `TiDBConfigManager`: 配置管理器
- 支持连接字符串解析和验证

#### 2. 连接管理 (tidb_connection.py)
- `TiDBConnectionManager`: 连接管理器
- 支持连接池和会话管理
- 提供向量客户端创建功能

#### 3. 嵌入服务 (embedding_service.py)
- `EmbeddingService`: 嵌入模型服务
- 支持SentenceTransformer和API模型
- 提供批量向量生成功能

#### 4. 向量操作 (vector_operations.py)
- `VectorOperations`: 向量操作类
- 支持插入、搜索、删除、更新操作
- 提供语义搜索和批量处理功能

## 快速开始

### 1. 安装依赖

```bash
pip install tidb-vector[client]==0.0.9 pymysql==1.1.1 sentence-transformers==3.3.1
```

### 2. 基础配置

```python
from app.services.vector_db import initialize_vector_db, vector_db

# 初始化向量数据库服务
connection_string = "mysql://user:password@host:port/database"
success, message = initialize_vector_db(connection_string)

if success:
    print("向量数据库初始化成功")
else:
    print(f"初始化失败: {message}")
```

### 3. 创建知识库

```python
# 创建知识库
success, message, info = vector_db.create_knowledge_base(
    name="my_knowledge_base",
    dimension=1024,
    description="我的知识库"
)

if success:
    print(f"知识库创建成功: {message}")
    print(f"表信息: {info}")
```

### 4. 添加文档

```python
# 准备文档数据
documents = [
    "这是第一个文档，介绍了人工智能的基础概念。",
    "第二个文档讨论了机器学习的应用场景。",
    "第三个文档探讨了深度学习的发展趋势。"
]

# 添加文档到知识库
success, message, info = vector_db.add_documents(
    knowledge_base="my_knowledge_base",
    documents=documents,
    source="user_upload"
)

if success:
    print(f"文档添加成功: {message}")
    print(f"处理信息: {info}")
```

### 5. 搜索知识库

```python
# 搜索相关文档
success, results, info = vector_db.search(
    knowledge_base="my_knowledge_base",
    query="人工智能的应用",
    top_k=5
)

if success:
    print(f"搜索完成，找到 {len(results)} 条结果:")
    for i, result in enumerate(results):
        print(f"{i+1}. 相似度: {result['score']:.3f}")
        print(f"   内容: {result['text'][:100]}...")
        print(f"   元数据: {result['metadata']}")
```

## 高级用法

### 1. 自定义嵌入模型

```python
from app.services.vector_db.embedding_service import embedding_service

# 使用指定的嵌入模型
success, embeddings, meta_info = embedding_service.generate_embeddings(
    texts=["测试文本"],
    model_config_id=1  # 指定模型ID
)
```

### 2. 批量操作

```python
from app.services.vector_db.vector_operations import vector_operations

# 批量插入文档和向量
success, message, info = vector_operations.batch_insert_with_embeddings(
    table_name="my_knowledge_base",
    texts=documents,
    metadatas=[{"category": "AI"} for _ in documents],
    source="batch_import"
)
```

### 3. 高级搜索

```python
# 带过滤条件的搜索
success, results, info = vector_db.search(
    knowledge_base="my_knowledge_base",
    query="机器学习算法",
    top_k=10,
    filters={
        "data_type": "document",
        "metadata.category": "AI"
    }
)
```

### 4. 知识库管理

```python
# 列出所有知识库
success, knowledge_bases = vector_db.list_knowledge_bases()

if success:
    for kb in knowledge_bases:
        print(f"知识库: {kb['name']}")
        print(f"  记录数: {kb.get('record_count', 0)}")
        print(f"  向量维度: {kb.get('vector_dimension', 0)}")

# 获取知识库详细信息
success, info = vector_db.get_knowledge_base_info("my_knowledge_base")

if success:
    print(f"知识库信息: {info}")
```

## API接口

### REST API端点

#### 1. 配置和连接
- `POST /api/vector-db/tidb/config/validate` - 验证配置
- `POST /api/vector-db/tidb/connection/test` - 测试连接
- `POST /api/vector-db/tidb/connection/test-vector` - 测试向量操作

#### 2. 嵌入模型
- `GET /api/vector-db/tidb/embedding/models` - 获取嵌入模型列表
- `POST /api/vector-db/tidb/embedding/generate` - 生成嵌入向量
- `POST /api/vector-db/tidb/embedding/test` - 测试嵌入模型

#### 3. 向量表管理
- `GET /api/vector-db/tidb/tables` - 列出向量表
- `POST /api/vector-db/tidb/tables/<table_name>` - 创建向量表
- `DELETE /api/vector-db/tidb/tables/<table_name>` - 删除向量表
- `GET /api/vector-db/tidb/tables/<table_name>/info` - 获取表信息

#### 4. 搜索功能
- `POST /api/vector-db/tidb/tables/<table_name>/search` - 语义搜索

#### 5. 系统信息
- `GET /api/vector-db/tidb/info` - 获取系统信息
- `GET /api/vector-db/tidb/health` - 健康检查

### API使用示例

```python
import requests

# 测试连接
response = requests.post('/api/tidb-vector/connection/test', json={
    'connection_string': 'mysql://user:password@host:port/database'
})

# 创建向量表
response = requests.post('/api/tidb-vector/tables/my_table', json={
    'dimension': 1024,
    'distance_metric': 'COSINE',
    'description': '我的向量表'
})

# 语义搜索
response = requests.post('/api/tidb-vector/tables/my_table/search', json={
    'query_text': '人工智能应用',
    'limit': 10,
    'distance_metric': 'COSINE'
})
```

## 测试

### 运行测试

```bash
# 运行基础功能测试
python tests/test_tidb_vector_basic.py

# 运行性能测试
python tests/test_tidb_vector_performance.py

# 运行完整测试套件
python tests/run_tidb_vector_tests.py
```

### 测试配置

测试使用以下TiDB Cloud连接：
```
mysql://3WYw82L9THMvuY5.root:bDEm4mk2ygRD2cFH@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/test
```

## 配置说明

### 环境变量

```bash
# TiDB连接字符串
export TIDB_DATABASE_URL="mysql://user:password@host:port/database"
```

### 配置参数

- `connection_string`: TiDB连接字符串
- `vector_dimension`: 向量维度（默认1024）
- `distance_metric`: 距离度量（COSINE/L2/DOT_PRODUCT）
- `batch_size`: 批处理大小（默认32）
- `max_workers`: 最大并发数（默认4）

## 性能优化

### 1. 批量操作
- 使用批量插入提高写入性能
- 合理设置批次大小（推荐32-100）

### 2. 连接管理
- 使用连接池减少连接开销
- 合理设置连接超时参数

### 3. 向量维度
- 根据模型选择合适的向量维度
- 平衡精度和性能需求

### 4. 索引优化
- TiDB自动管理向量索引
- 定期进行表优化操作

## 故障排除

### 常见问题

1. **连接失败**
   - 检查连接字符串格式
   - 确认网络连接和防火墙设置
   - 验证SSL配置

2. **向量操作失败**
   - 检查向量维度是否匹配
   - 确认表结构是否正确
   - 验证数据格式

3. **嵌入模型问题**
   - 检查模型配置
   - 确认依赖包安装
   - 验证模型文件

### 日志调试

```python
import logging

# 启用详细日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('app.services.vector_db')
```

## 最佳实践

1. **数据准备**
   - 清理和预处理文本数据
   - 合理设置元数据结构
   - 使用一致的数据格式

2. **性能优化**
   - 批量操作代替单条操作
   - 合理使用过滤条件
   - 定期清理无用数据

3. **错误处理**
   - 实现完整的异常处理
   - 记录详细的错误日志
   - 提供用户友好的错误信息

4. **监控和维护**
   - 监控系统性能指标
   - 定期备份重要数据
   - 及时更新依赖包

## 后续开发

### 计划功能
- 支持更多向量索引类型
- 增加向量数据可视化
- 实现自动数据同步
- 添加更多距离度量算法

### 扩展方向
- 集成更多嵌入模型
- 支持多模态向量搜索
- 实现分布式向量计算
- 添加向量数据分析工具

## 参考资料

- [TiDB Vector Documentation](https://docs.pingcap.com/tidbcloud/vector-search-overview)
- [TiDB Cloud API Reference](https://docs.pingcap.com/tidbcloud/api/v1beta)
- [Sentence Transformers Documentation](https://www.sbert.net/)
- [项目GitHub仓库](https://github.com/tidbcloud/examples-projects/tree/main/examples/with-vector-search)
