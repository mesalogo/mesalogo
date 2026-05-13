# LightRAG 知识库集成方案

## 重要说明：系统定位

### LightRAG vs Graphiti 的区别

**LightRAG（本文档）- 知识库系统（Knowledge Base）**
- **用途**：结构化知识存储和检索
- **数据来源**：用户主动上传的文档、资料
- **数据类型**：PDF、Word、Markdown等文档，专业知识库
- **生命周期**：持久化存储，长期有效
- **调用方式**：智能体通过知识库工具主动查询
- **使用场景**：RAG增强、专业知识问答、文档检索
- **存储方式**：向量数据库 + 知识图谱混合存储

**Graphiti - 记忆系统（Memory）**
- **用途**：智能体的短期/长期记忆
- **数据来源**：对话过程自动同步
- **数据类型**：对话历史、用户偏好、事实关系
- **生命周期**：会话级/任务级，动态更新
- **调用方式**：Memory能力自动注入，智能体透明使用
- **使用场景**：上下文记忆、用户偏好学习、历史交互追溯
- **存储方式**：Neo4j图数据库

### 核心区别总结

| 维度 | LightRAG (知识库) | Graphiti (记忆) |
|------|------------------|----------------|
| **定位** | 外部知识源 | 内部记忆系统 |
| **数据来源** | 文档上传 | 对话自动同步 |
| **更新方式** | 主动导入 | 被动记录 |
| **查询方式** | 显式工具调用 | 隐式能力注入 |
| **数据持久性** | 永久存储 | 可配置清理 |
| **分区策略** | 按知识库workspace | 按任务/角色/空间 |

**重要**：这两个系统是**独立且互补**的，不应混淆：
- LightRAG 提供**外部知识**（"我知道什么"）
- Graphiti 提供**内部记忆**（"我记得什么"）

---

## 1. 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                      ABM-LLM 平台                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   前端 UI   │    │  后端 API   │    │  ModelConfig │          │
│  └─────────────┘    └──────┬──────┘    │    数据库    │          │
│                            │           └─────────────┘          │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTP + Header: LIGHTRAG-WORKSPACE
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   LightRAG Docker 容器                           │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  环境变量配置（启动时从平台同步）                      │        │
│  │  - LLM_BINDING_HOST / LLM_BINDING_API_KEY           │        │
│  │  - EMBEDDING_BINDING_HOST / EMBEDDING_BINDING_API_KEY│       │
│  └─────────────────────────────────────────────────────┘        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  数据存储（按 workspace 隔离）                        │        │
│  │  - workspace: kb_001, kb_002, ...                   │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Docker Compose 配置

```yaml
# abm-docker/docker-compose.lightrag.yml
services:
  lightrag:
    container_name: lightrag
    image: ghcr.io/hkuds/lightrag:latest
    ports:
      - "9621:9621"
    volumes:
      - ./lightrag_data/rag_storage:/app/data/rag_storage
      - ./lightrag_data/inputs:/app/data/inputs
    environment:
      # 服务配置
      - HOST=0.0.0.0
      - PORT=9621
      - WEBUI_TITLE=ABM-LLM Knowledge Graph

      # LLM 配置 - 从平台 ModelConfig 同步
      - LLM_BINDING=openai
      - LLM_MODEL=${LIGHTRAG_LLM_MODEL:-gpt-4o-mini}
      - LLM_BINDING_HOST=${LIGHTRAG_LLM_HOST:-https://api.openai.com/v1}
      - LLM_BINDING_API_KEY=${LIGHTRAG_LLM_API_KEY}

      # Embedding 配置 - 从平台 ModelConfig 同步
      - EMBEDDING_BINDING=openai
      - EMBEDDING_MODEL=${LIGHTRAG_EMBEDDING_MODEL:-text-embedding-3-small}
      - EMBEDDING_DIM=${LIGHTRAG_EMBEDDING_DIM:-1536}
      - EMBEDDING_BINDING_HOST=${LIGHTRAG_EMBEDDING_HOST:-https://api.openai.com/v1}
      - EMBEDDING_BINDING_API_KEY=${LIGHTRAG_EMBEDDING_API_KEY}

      # 可选：Rerank 配置
      - RERANK_BINDING=${LIGHTRAG_RERANK_BINDING:-null}
      - RERANK_MODEL=${LIGHTRAG_RERANK_MODEL:-}
      - RERANK_BINDING_HOST=${LIGHTRAG_RERANK_HOST:-}
      - RERANK_BINDING_API_KEY=${LIGHTRAG_RERANK_API_KEY:-}

      # 文档处理配置
      - CHUNK_SIZE=1200
      - CHUNK_OVERLAP_SIZE=100
      - SUMMARY_LANGUAGE=Chinese

      # 查询配置
      - TOP_K=40
      - MAX_TOTAL_TOKENS=30000
      - ENABLE_LLM_CACHE=true
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      - abm-network

networks:
  abm-network:
    external: true
```

## 3. 平台配置同步机制

```python
# backend/app/services/lightrag_config_service.py

class LightRAGConfigService:
    """LightRAG 配置同步服务"""

    @staticmethod
    def get_lightrag_env_config() -> dict:
        """
        从平台 ModelConfig 生成 LightRAG 环境变量配置
        用于 Docker 启动或配置同步
        """
        # 获取默认文本生成模型
        llm_model = ModelConfig.query.filter_by(is_default_text=True).first()

        # 获取默认嵌入模型
        embedding_model = ModelConfig.query.filter_by(is_default_embedding=True).first()

        # 获取默认重排序模型（可选）
        rerank_model = ModelConfig.query.filter_by(is_default_rerank=True).first()

        config = {
            # LLM 配置
            'LIGHTRAG_LLM_MODEL': llm_model.model_id if llm_model else 'gpt-4o-mini',
            'LIGHTRAG_LLM_HOST': llm_model.base_url if llm_model else 'https://api.openai.com/v1',
            'LIGHTRAG_LLM_API_KEY': llm_model.api_key if llm_model else '',

            # Embedding 配置
            'LIGHTRAG_EMBEDDING_MODEL': embedding_model.model_id if embedding_model else 'text-embedding-3-small',
            'LIGHTRAG_EMBEDDING_HOST': embedding_model.base_url if embedding_model else 'https://api.openai.com/v1',
            'LIGHTRAG_EMBEDDING_API_KEY': embedding_model.api_key if embedding_model else '',
            'LIGHTRAG_EMBEDDING_DIM': str(embedding_model.additional_params.get('embedding_dim', 1536)) if embedding_model else '1536',
        }

        # Rerank 配置（可选）
        if rerank_model:
            config.update({
                'LIGHTRAG_RERANK_BINDING': 'cohere',  # 或根据 provider 判断
                'LIGHTRAG_RERANK_MODEL': rerank_model.model_id,
                'LIGHTRAG_RERANK_HOST': rerank_model.base_url,
                'LIGHTRAG_RERANK_API_KEY': rerank_model.api_key,
            })

        return config

    @staticmethod
    def generate_env_file(output_path: str = './lightrag_data/.env'):
        """生成 LightRAG 的 .env 文件"""
        config = LightRAGConfigService.get_lightrag_env_config()

        with open(output_path, 'w') as f:
            for key, value in config.items():
                f.write(f"{key}={value}\n")

        return output_path
```

## 4. 系统设置 API

```python
# backend/app/api/routes/settings.py

@settings_bp.route('/lightrag/config', methods=['GET'])
def get_lightrag_config():
    """获取 LightRAG 配置（从平台模型同步）"""
    config = LightRAGConfigService.get_lightrag_env_config()

    # 隐藏 API Key
    safe_config = {k: ('***' if 'API_KEY' in k else v) for k, v in config.items()}

    return jsonify({
        'config': safe_config,
        'lightrag_url': current_app.config.get('LIGHTRAG_API_URL', 'http://localhost:9621'),
        'status': 'configured' if config.get('LIGHTRAG_LLM_API_KEY') else 'not_configured'
    })

@settings_bp.route('/lightrag/sync', methods=['POST'])
def sync_lightrag_config():
    """同步配置到 LightRAG（生成 .env 文件）"""
    try:
        env_path = LightRAGConfigService.generate_env_file()
        return jsonify({
            'success': True,
            'message': f'配置已同步到 {env_path}，请重启 LightRAG 容器生效'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@settings_bp.route('/lightrag/health', methods=['GET'])
def check_lightrag_health():
    """检查 LightRAG 服务健康状态"""
    lightrag_url = current_app.config.get('LIGHTRAG_API_URL', 'http://localhost:9621')
    try:
        response = requests.get(f"{lightrag_url}/health", timeout=5)
        return jsonify({
            'status': 'healthy' if response.ok else 'unhealthy',
            'details': response.json() if response.ok else None
        })
    except Exception as e:
        return jsonify({'status': 'unreachable', 'error': str(e)}), 503
```

## 5. 知识库 API（简化版）

```python
# backend/app/api/routes/knowledge/lightrag.py

@knowledge_bp.route('/<kb_id>/lightrag/query', methods=['POST'])
def lightrag_query(kb_id):
    """LightRAG 查询 - 代理到 LightRAG 服务"""
    knowledge = Knowledge.query.get_or_404(kb_id)

    if knowledge.kb_type != 'lightrag':
        return jsonify({'error': '该知识库不是 LightRAG 类型'}), 400

    data = request.json
    lightrag_url = current_app.config.get('LIGHTRAG_API_URL', 'http://localhost:9621')

    # 构建请求头，指定 workspace
    headers = {
        'LIGHTRAG-WORKSPACE': knowledge.lightrag_workspace or knowledge.id,
        'Content-Type': 'application/json'
    }

    # 代理请求到 LightRAG
    response = requests.post(
        f"{lightrag_url}/query",
        headers=headers,
        json={
            'query': data.get('query'),
            'mode': data.get('mode', 'mix'),
            'top_k': data.get('top_k', 10),
            'include_references': data.get('include_references', True)
        }
    )

    return jsonify(response.json()), response.status_code
```

## 6. 数据库扩展

```sql
-- 扩展 knowledges 表
ALTER TABLE knowledges ADD COLUMN kb_type VARCHAR(20) DEFAULT 'vector';
ALTER TABLE knowledges ADD COLUMN lightrag_workspace VARCHAR(100);
ALTER TABLE knowledges ADD COLUMN lightrag_config JSON;
```

## 7. 部署流程

```bash
# 1. 在平台配置好默认模型（ModelConfig）

# 2. 同步配置到 LightRAG
curl -X POST http://localhost:5000/api/settings/lightrag/sync

# 3. 启动 LightRAG 容器
cd abm-docker
docker-compose -f docker-compose.lightrag.yml up -d

# 4. 验证服务
curl http://localhost:9621/health
```

## 实施状态

### ✅ 已完成

#### 1. Docker Profile 集成（2026-01-19）
- ✅ 创建 `docker-compose.lightrag.yml` 配置文件
- ✅ 添加 `lightrag` profile 到 Docker Compose
- ✅ 更新 Makefile 添加 `make up-lightrag` 命令
- ✅ 更新 `.env` 文件配置
- ✅ 更新 README.md 文档说明

#### 2. 前端设置页面（2026-01-19）
- ✅ 创建 `LightragTab.tsx` 组件
- ✅ 实现启用/禁用开关
- ✅ 实现服务状态监控
- ✅ 实现分区策略配置（按知识库分区）
- ✅ 实现模型配置（LLM、Embedding、Rerank）
- ✅ 实现文档处理配置（chunk_size、overlap、language、top_k）
- ✅ 实现服务地址配置
- ✅ 实现服务控制按钮（启动/停止）
- ✅ 实现配置同步按钮
- ✅ 实现测试查询功能
- ✅ 实现清空数据功能

#### 3. 后端 API 实现（2026-01-19）
- ✅ 创建 `lightrag_config_service.py` 配置同步服务
- ✅ 实现 `get_lightrag_env_config()` - 从 ModelConfig 生成环境变量
- ✅ 实现 `generate_env_file()` - 生成 lightrag.env 文件
- ✅ 实现 `restart_lightrag_container()` - 重启容器
- ✅ 实现 `start_lightrag_container()` - 启动容器
- ✅ 实现 `stop_lightrag_container()` - 停止容器
- ✅ 实现 `check_lightrag_health()` - 健康检查

#### 4. 配置同步机制（2026-01-19）
- ✅ 从平台 ModelConfig 读取默认模型
- ✅ 生成 LightRAG 环境变量配置
- ✅ 智能更新 lightrag.env 文件（保留注释和未修改项）
- ✅ 自动重启容器使配置生效

#### 5. API 架构重构（2026-01-19）
- ✅ 创建独立的 LightRAG 服务模块 `app/services/lightrag/`
  - `lightrag_config.py` - 配置同步服务
  - `lightrag_service.py` - 容器 API 客户端
- ✅ 创建独立的 LightRAG API 路由 `app/api/routes/lightrag.py`
  - `GET /api/lightrag/config` - 获取配置
  - `POST /api/lightrag/config` - 保存配置
  - `GET /api/lightrag/status` - 获取服务状态
  - `GET /api/lightrag/health` - 健康检查
  - `POST /api/lightrag/sync` - 同步配置到容器
  - `POST /api/lightrag/service-control` - 服务控制
  - `POST /api/lightrag/query` - 查询测试
  - `GET /api/lightrag/workspaces` - 获取工作空间列表
  - `GET/POST/DELETE /api/lightrag/documents` - 文档管理
  - `POST /api/lightrag/clear` - 清空工作空间
  - `GET /api/lightrag/graph` - 获取图谱数据
- ✅ 清理旧代码，移除嵌入式 LightRAG 占位代码
- ✅ 从 graph_enhancement 模块分离 LightRAG

#### 6. 前端重构（2026-01-19）
- ✅ 创建独立的 LightRAG API 服务 `services/api/lightrag.ts`
- ✅ 创建独立的 `useLightRAG` hook
- ✅ 修改 `LightragTab.tsx` 使用新 hook
- ✅ 移除对 `useGraphEnhancement` 的依赖

#### 7. LightRAG API 研究（2026-01-22）
- ✅ 获取 LightRAG OpenAPI 文档分析
- ✅ 确认核心 API 端点：
  - 文档管理：upload, text, texts, scan, delete, status
  - 查询功能：query, query/stream（支持 local/global/hybrid 模式）
  - 知识图谱：entities, relations 的 CRUD 操作
- ✅ 确认 Workspace 隔离机制（通过 HTTP Header: LIGHTRAG-WORKSPACE）
- ✅ 确认认证方式（OAuth2 + API Key）
- ✅ 确认异步处理机制（track_id 追踪）

### ⏳ 待完成

#### 8. 知识库集成 - 融合 Job 系统（2026-01-26 进行中）

**核心设计：将 LightRAG 任务管理融合到现有的 Job 系统**

- [x] **数据模型扩展**
  - [x] 扩展 Knowledge 模型，添加 `kb_type` 字段（'vector' | 'lightrag'）
  - [x] 添加 `lightrag_workspace` 字段（存储 workspace 名称）
  - [x] 添加 `lightrag_config` JSON 字段（存储 LightRAG 特定配置）
  - [x] 扩展 KnowledgeDocument 模型：
    - [x] `lightrag_synced` Boolean - 是否已同步到 LightRAG
    - [x] `lightrag_workspace` String - LightRAG workspace
    - [x] `lightrag_sync_job_id` String - 关联的 Job ID
  - [x] 数据库迁移脚本（已执行）

- [x] **Job Handler 实现**（融合到现有 Job 系统）
  - [x] 在 `knowledge_job_handlers.py` 中添加新 handler：
    - [x] `handle_lightrag_upload` - 处理 LightRAG 文档上传任务
    - [x] `handle_lightrag_batch_upload` - 批量上传任务
    - [x] `handle_lightrag_sync_all` - 同步所有文档（Vector 图谱增强）
  - [x] 注册 handler 到 JobManager

- [x] **后端 API 实现**（基于 Job 系统）
  - [x] `POST /api/knowledge/<kb_id>/lightrag/upload` - 提交文档上传任务
  - [x] `POST /api/knowledge/<kb_id>/lightrag/sync-all` - 同步所有文档
  - [x] `POST /api/knowledge/<kb_id>/lightrag/query` - 知识库查询（同步）
  - [x] `GET /api/knowledge/<kb_id>/lightrag/documents` - 获取文档列表
  - [x] `DELETE /api/knowledge/<kb_id>/lightrag/documents/<doc_id>` - 删除文档
  - [x] `GET /api/knowledge/<kb_id>/lightrag/graph` - 获取知识图谱数据

- [ ] **Workspace 管理**
  - [ ] 创建知识库时自动分配 workspace（使用 knowledge_id）
  - [ ] 所有 LightRAG API 调用自动添加 workspace header
  - [ ] 删除知识库时清理对应 workspace 数据

- [x] **前端集成**（2026-01-26 新增）
  - [x] 扩展 `knowledge.ts` API 服务，添加 LightRAG 相关方法
  - [x] 创建 `KnowledgeFormModal` 组件（支持选择 kb_type）
  - [x] 扩展 `KnowledgeList` 显示知识库类型列
  - [ ] 扩展知识库详情页（添加 LightRAG 文档管理和查询功能）
  - [ ] 创建 LightRAG 查询测试组件

#### 9. MCP 工具集成
- [ ] **工具定义**
  - [ ] 创建 `query_lightrag_knowledge` 工具
    ```python
    {
      "name": "query_lightrag_knowledge",
      "description": "从 LightRAG 知识库查询相关信息，支持向量检索和知识图谱混合查询",
      "parameters": {
        "knowledge_id": "知识库ID",
        "query": "查询内容",
        "mode": "查询模式：local(向量)/global(图谱)/hybrid(混合，推荐)",
        "top_k": "返回结果数量，默认10"
      }
    }
    ```
  - [ ] 工具实现：调用 `/api/knowledge/{kb_id}/lightrag/query`
  - [ ] 集成到智能体工具列表
  - [ ] 根据知识库类型自动选择工具（Vector KB → 向量检索，LightRAG KB → LightRAG 查询）

- [ ] **注意事项**
  - 文档添加由用户通过前端界面完成
  - 智能体动态记忆由 Graphiti 处理
  - LightRAG 仅用于静态知识库查询

#### 10. 前端知识库管理
- [ ] **知识库创建界面**
  - [ ] 添加知识库类型选择（Vector / LightRAG）
  - [ ] LightRAG 类型显示特定配置选项：
    - [ ] 文档分块大小（chunk_size，创建后不可修改）
    - [ ] 摘要语言（summary_language，创建后不可修改）
    - [ ] 默认查询模式（default_query_mode，可修改）
    - [ ] 是否允许用户选择模式（enable_mode_selection，可修改）
  - [ ] 提示：知识库类型创建后不可修改

- [ ] **知识库列表**
  - [ ] 显示知识库类型标签（Vector / LightRAG）
  - [ ] LightRAG 类型显示文档数量、实体数量、关系数量

- [ ] **知识库设置页面**
  - [ ] 基本信息（名称、描述）
  - [ ] 查询配置（可修改）：
    - [ ] 默认查询模式选择器（naive/local/global/hybrid/mix）
    - [ ] 模式说明：
      - naive: 纯向量检索（最快，适合简单查询）
      - local: 基于实体的图谱检索
      - global: 基于关系的图谱检索
      - hybrid: 实体+关系混合检索
      - mix: 图谱+向量混合检索（推荐）
    - [ ] 是否允许用户在查询时切换模式
    - [ ] Top-K 设置
  - [ ] 文档处理配置（只读，显示创建时的配置）：
    - [ ] 分块大小
    - [ ] 摘要语言

- [ ] **知识库详情页**
  - [ ] 文档上传界面（支持批量上传、拖拽上传）
  - [ ] 文档列表（显示处理状态：pending/processing/processed/failed）
  - [ ] 处理进度追踪（基于 track_id）
  - [ ] 查询测试界面：
    - [ ] 查询输入框
    - [ ] 查询模式选择器（如果 enable_mode_selection=true）
    - [ ] 显示当前使用的模式
    - [ ] 查询结果展示
  - [ ] 知识图谱可视化（实体和关系）
  - [ ] 文档删除功能

#### 11. 测试和优化
- [ ] **功能测试**
  - [ ] 知识库创建/删除测试
  - [ ] 文档上传/删除测试
  - [ ] 查询功能测试（三种模式）
  - [ ] Workspace 隔离测试
  - [ ] MCP 工具调用测试

- [ ] **性能测试**
  - [ ] 大文件上传测试
  - [ ] 批量文档处理测试
  - [ ] 查询响应时间测试
  - [ ] 并发查询测试

- [ ] **错误处理**
  - [ ] LightRAG 服务不可用时的降级处理
  - [ ] 文档处理失败的重试机制
  - [ ] 用户友好的错误提示

- [ ] **文档完善**
  - [ ] 用户使用文档
  - [ ] API 接口文档
  - [ ] 部署运维文档

---

---

## Vector 知识库的图谱增强方案（2026-01-23 新增）

### 核心思路

```
Vector 知识库的处理流程：
文档上传 → 解析(PDF/Word→MD) → 分块 → 向量化 → 存储到向量数据库
                ↓
         【可选】图谱增强
                ↓
         将解析后的 MD 文本发送到 LightRAG
                ↓
         LightRAG 构建图谱（独立的 workspace）
                ↓
         查询时可以选择：纯向量 / 向量+图谱混合
```

### 设计优势

#### ✅ Vector + 图谱增强的优势
1. **灵活性**：可以随时启用/禁用图谱
2. **兼容性**：不影响现有的向量检索
3. **渐进式**：可以先用向量，需要时再启用图谱
4. **控制权**：保持对文档处理流程的控制

#### ✅ LightRAG 类型的优势
1. **准确率最高**：一体化优化，所有组件协同工作
2. **实现简单**：直接使用 LightRAG 的完整功能
3. **性能最优**：LightRAG 内部优化的分块和图谱构建

### 完整的知识库类型对比

```
┌─────────────────────────────────────────────────────────────┐
│                    知识库类型选择                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ○ Vector 类型（推荐用于已有知识库）                         │
│    ├─ 使用平台的文档处理流程                                 │
│    ├─ 可以精确控制分块、向量化策略                           │
│    ├─ 可选启用图谱增强（使用解析后的 MD）                    │
│    └─ 适合：已有知识库、需要自定义处理流程                   │
│                                                              │
│  ○ LightRAG 类型（推荐用于新建知识库）                       │
│    ├─ 使用 LightRAG 的一体化处理流程                        │
│    ├─ 自动构建知识图谱（不可关闭）                           │
│    ├─ 支持 5 种查询模式（naive/local/global/hybrid/mix）    │
│    └─ 适合：新建知识库、追求最高准确率                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 实施建议

```python
# 推荐的实施顺序

阶段 1：基础 LightRAG 集成（已完成）
- ✅ LightRAG Docker 部署
- ✅ LightRAG 设置页面
- ✅ LightRAG 服务客户端

阶段 2：LightRAG 类型知识库（优先）
- [ ] 数据模型扩展（kb_type, lightrag_config）
- [ ] 创建知识库时选择类型
- [ ] LightRAG 类型的文档上传和查询
- [ ] MCP 工具集成

阶段 3：Vector 知识库的图谱增强（可选）
- [ ] 数据模型扩展（graph_enhancement）
- [ ] 图谱增强开关和同步服务
- [ ] 混合查询实现
- [ ] 前端界面更新
```

---

## 当前进度：65% 完成

### 已完成模块
- ✅ Docker 部署配置
- ✅ 前端设置页面
- ✅ 后端配置同步
- ✅ 服务控制功能
- ✅ API 架构重构（独立的 LightRAG 模块）
- ✅ 前端重构（独立的 useLightRAG hook）
- ✅ LightRAG API 研究和集成方案设计
- ✅ Vector 知识库图谱增强方案设计

### 待开始模块
- ⏸️ 知识库集成（数据模型、后端 API、Workspace 管理）
- ⏸️ MCP 工具集成
- ⏸️ 前端知识库管理
- ⏸️ Vector 知识库图谱增强实现
- ⏸️ 测试和优化

### 已完成模块
- ✅ Docker 部署配置
- ✅ 前端设置页面
- ✅ 后端配置同步
- ✅ 服务控制功能
- ✅ API 架构重构（独立的 LightRAG 模块）
- ✅ 前端重构（独立的 useLightRAG hook）

### 待开始模块
- ⏸️ 知识库集成
- ⏸️ MCP 工具集成
- ⏸️ 前端知识库管理
- ⏸️ 测试和优化

---

## 代码结构参考

### 后端代码位置

```
backend/app/
├── services/
│   └── lightrag/                    # LightRAG 服务模块
│       ├── __init__.py              # 导出 LightRAGConfigService, LightRAGService
│       ├── lightrag_config.py       # 配置同步服务（生成 env 文件、控制 Docker）
│       └── lightrag_service.py      # 容器 API 客户端（query, upload, health 等）
│
├── api/routes/
│   └── lightrag.py                  # LightRAG API 路由 (/api/lightrag/*)
│
└── models.py                        # GraphEnhancement 表存储配置 (framework='lightrag')
```

### 前端代码位置

```
frontend/src/
├── services/api/
│   └── lightrag.ts                  # LightRAG API 服务
│
└── pages/settings/GraphEnhancementSettingsPage/
    ├── LightragTab.tsx              # LightRAG 设置页面
    └── useLightRAG.tsx              # LightRAG 专用 hook
```

### API 路由清单

| 路径 | 方法 | 功能 | 实现状态 |
|------|------|------|---------|
| `/api/lightrag/config` | GET | 获取 LightRAG 配置 | ✅ |
| `/api/lightrag/config` | POST | 保存 LightRAG 配置 | ✅ |
| `/api/lightrag/status` | GET | 获取服务状态 | ✅ |
| `/api/lightrag/health` | GET | 健康检查 | ✅ |
| `/api/lightrag/sync` | POST | 同步配置到容器 | ✅ |
| `/api/lightrag/service-control` | POST | 启动/停止容器 | ✅ |
| `/api/lightrag/query` | POST | 执行查询 | ✅ |
| `/api/lightrag/workspaces` | GET | 获取工作空间列表 | ✅ |
| `/api/lightrag/documents` | GET | 获取文档列表 | ✅ |
| `/api/lightrag/documents` | POST | 上传文档 | ✅ |
| `/api/lightrag/documents/<id>` | DELETE | 删除文档 | ✅ |
| `/api/lightrag/clear` | POST | 清空工作空间 | ✅ |
| `/api/lightrag/graph` | GET | 获取图谱数据 | ✅ |

---

## LightRAG API 集成详解（2026-01-22 更新）

### API 端点清单

#### 文档管理 API
| 端点 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/documents/upload` | POST | 上传文件 | file (multipart), workspace (header) |
| `/documents/text` | POST | 插入单个文本 | text, metadata |
| `/documents/texts` | POST | 批量插入文本 | texts[] |
| `/documents/scan` | POST | 扫描输入目录 | - |
| `/documents` | DELETE | 清空所有文档 | workspace (header) |
| `/documents/status` | GET | 查询文档状态 | - |
| `/documents/track/{track_id}` | GET | 追踪处理进度 | track_id |

#### 查询 API
| 端点 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/query` | POST | 执行查询 | query, mode (local/global/hybrid), top_k |
| `/query/stream` | POST | 流式查询 | 同上 + stream=true |

#### 知识图谱 API
| 端点 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/graph/entities` | GET | 获取实体列表 | workspace (header) |
| `/graph/relations` | GET | 获取关系列表 | workspace (header) |
| `/graph/entities` | POST | 创建实体 | entity_name, entity_data |
| `/graph/relations` | POST | 创建关系 | source_entity, target_entity, relation_data |
| `/graph/entities/{id}` | PUT | 更新实体 | entity_id, updated_data |
| `/graph/entities/{id}` | DELETE | 删除实体 | entity_id |

### 查询模式说明

1. **local 模式**：基于向量相似度的局部检索
   - 适用场景：精确匹配、相似文档查找
   - 优点：速度快、精确度高
   - 缺点：缺乏全局视角

2. **global 模式**：基于知识图谱的全局检索
   - 适用场景：关系推理、概念关联
   - 优点：理解实体关系、发现隐含联系
   - 缺点：需要良好的图谱质量

3. **hybrid 模式**（推荐）：混合检索
   - 适用场景：通用查询
   - 优点：结合向量和图谱优势
   - 缺点：计算开销较大

### Workspace 隔离机制

```http
POST /documents/upload
Header: LIGHTRAG-WORKSPACE: kb_12345
Content-Type: multipart/form-data

file: document.pdf
```

- 每个知识库使用独立的 workspace
- workspace 名称 = 知识库 ID
- 所有 API 调用通过 Header 指定 workspace
- 数据完全隔离，互不影响

### 异步处理流程

```
1. 上传文档
   POST /documents/upload
   ↓
   返回 { track_id: "upload_20250122_abc123" }

2. 轮询状态
   GET /documents/track/{track_id}
   ↓
   返回 { status: "processing", progress: 50% }

3. 处理完成
   GET /documents/track/{track_id}
   ↓
   返回 { status: "processed", documents: [...] }
```

---

## 最终设计方案（2026-01-23 确认）

### 核心设计原则

1. **知识库类型在创建时确定，不可修改**
   - `vector` 类型：传统向量检索，可选启用图谱增强
   - `lightrag` 类型：自动构建图谱，支持多种查询模式

2. **查询模式可以随时修改**
   - 影响知识库设置页面的测试查询
   - 影响 MCP 工具的查询行为
   - 用户可以根据需求灵活切换

3. **Vector 知识库的图谱增强（新增）**
   - Vector 类型可以选择性启用图谱增强
   - 使用解析后的 Markdown 内容构建图谱
   - 图谱增强可以随时启用/禁用

### 知识库类型对比

| 维度 | Vector 类型 | LightRAG 类型 |
|------|------------|--------------|
| **文档处理** | 平台处理（解析→分块→向量化） | LightRAG 处理（一体化） |
| **分块策略** | 平台的分块算法 | LightRAG 的分块算法 |
| **向量化** | 平台的 embedding 模型 | LightRAG 的 embedding 模型 |
| **图谱构建** | 可选（使用解析后的 MD） | 必选（自动构建） |
| **图谱开关** | ✅ 可以随时启用/禁用 | ❌ 始终启用 |
| **查询方式** | 向量检索 / 向量+图谱混合 | 5种模式（naive/local/global/hybrid/mix） |
| **适用场景** | 已有知识库、需要控制处理流程 | 新建知识库、追求最高准确率 |

### 优先级 1：知识库数据模型扩展

```python
# backend/app/models.py - 修改 Knowledge 模型
class Knowledge(BaseMixin, db.Model):
    __tablename__ = 'knowledges'
    
    # 现有字段...
    
    # 知识库类型（创建后不可修改）
    kb_type = Column(String(20), default='vector')  # 'vector' | 'lightrag'
    
    # 图谱增强配置（Vector 类型也可以启用）
    graph_enhancement = Column(JSON, default=dict)
    # {
    #   "enabled": False,              # 是否启用图谱增强
    #   "lightrag_workspace": None,    # LightRAG workspace ID
    #   "sync_status": "not_synced",   # not_synced | syncing | synced | failed
    #   "last_sync_at": None,          # 最后同步时间
    #   "query_mode": "mix",           # 查询模式（仅在 enabled=True 时有效）
    #   "enable_mode_selection": True  # 是否允许用户选择模式
    # }
    
    # LightRAG 专用配置（仅 lightrag 类型使用）
    lightrag_config = Column(JSON, default=dict)
    # {
    #   "chunk_size": 1200,            # 文档分块大小（创建时设置，不可修改）
    #   "summary_language": "Chinese", # 摘要语言（创建时设置，不可修改）
    #   "default_query_mode": "mix",   # 默认查询模式（可修改）
    #   "enable_mode_selection": True, # 是否允许用户选择模式（可修改）
    #   "top_k": 40                    # 默认返回数量（可修改）
    # }
```

**数据库迁移**：
```sql
ALTER TABLE knowledges ADD COLUMN kb_type VARCHAR(20) DEFAULT 'vector';
ALTER TABLE knowledges ADD COLUMN graph_enhancement JSON;
ALTER TABLE knowledges ADD COLUMN lightrag_config JSON;

-- 添加约束：kb_type 只能是 'vector' 或 'lightrag'
ALTER TABLE knowledges ADD CONSTRAINT check_kb_type CHECK (kb_type IN ('vector', 'lightrag'));
```

### 优先级 2：后端 API 实现

#### 2.1 LightRAG 类型知识库 API

```python
# backend/app/api/routes/knowledge_lightrag.py

@knowledge_bp.route('/<kb_id>/lightrag/upload', methods=['POST'])
def upload_document(kb_id):
    """上传文档到 LightRAG 知识库"""
    knowledge = Knowledge.query.get_or_404(kb_id)
    if knowledge.kb_type != 'lightrag':
        return jsonify({'error': '该知识库不是 LightRAG 类型'}), 400
    
    file = request.files.get('file')
    workspace = knowledge.id
    
    # 调用 LightRAG API（自动构建图谱）
    response = LightRAGService.upload_document(workspace, file)
    return jsonify(response)

@knowledge_bp.route('/<kb_id>/lightrag/query', methods=['POST'])
def query_lightrag_knowledge(kb_id):
    """查询 LightRAG 知识库"""
    knowledge = Knowledge.query.get_or_404(kb_id)
    data = request.json
    
    workspace = knowledge.id
    query = data.get('query')
    
    # 查询模式：优先使用请求参数，其次使用知识库配置
    mode = data.get('mode') or knowledge.lightrag_config.get('default_query_mode', 'mix')
    top_k = data.get('top_k', knowledge.lightrag_config.get('top_k', 40))
    
    response = LightRAGService.query(workspace, query, mode, top_k)
    return jsonify(response)
```

#### 2.2 Vector 知识库的图谱增强 API

```python
# backend/app/api/routes/knowledge_graph_enhancement.py

@knowledge_bp.route('/<kb_id>/graph-enhancement/enable', methods=['POST'])
def enable_graph_enhancement(kb_id):
    """为 Vector 知识库启用图谱增强"""
    knowledge = Knowledge.query.get_or_404(kb_id)
    
    if knowledge.kb_type != 'vector':
        return jsonify({'error': '只有 Vector 类型知识库可以启用图谱增强'}), 400
    
    # 创建 LightRAG workspace
    workspace = f"graph_enhance_{knowledge.id}"
    
    # 更新配置
    knowledge.graph_enhancement = {
        "enabled": True,
        "lightrag_workspace": workspace,
        "sync_status": "not_synced",
        "query_mode": "mix",
        "enable_mode_selection": True
    }
    db.session.commit()
    
    # 异步同步现有文档到 LightRAG
    from app.tasks import sync_documents_to_lightrag
    sync_documents_to_lightrag.delay(knowledge.id)
    
    return jsonify({'success': True, 'workspace': workspace})

@knowledge_bp.route('/<kb_id>/graph-enhancement/disable', methods=['POST'])
def disable_graph_enhancement(kb_id):
    """禁用 Vector 知识库的图谱增强"""
    knowledge = Knowledge.query.get_or_404(kb_id)
    
    if knowledge.kb_type != 'vector':
        return jsonify({'error': '只有 Vector 类型知识库可以禁用图谱增强'}), 400
    
    # 更新配置
    knowledge.graph_enhancement['enabled'] = False
    db.session.commit()
    
    return jsonify({'success': True})

@knowledge_bp.route('/<kb_id>/query', methods=['POST'])
def query_knowledge(kb_id):
    """统一的知识库查询接口"""
    knowledge = Knowledge.query.get_or_404(kb_id)
    data = request.json
    
    if knowledge.kb_type == 'lightrag':
        # LightRAG 类型：使用 LightRAG 的完整功能
        return query_lightrag_knowledge(kb_id)
    
    elif knowledge.kb_type == 'vector':
        # Vector 类型：检查是否启用了图谱增强
        if knowledge.graph_enhancement.get('enabled'):
            return query_vector_with_graph(kb_id)
        else:
            return query_vector_only(kb_id)

def query_vector_with_graph(kb_id):
    """Vector 类型 + 图谱增强的查询"""
    knowledge = Knowledge.query.get_or_404(kb_id)
    data = request.json
    
    # 1. 向量检索（使用平台的向量数据库）
    vector_results = VectorDBService.search(
        knowledge_id=kb_id,
        query=data['query'],
        top_k=data.get('top_k', 10)
    )
    
    # 2. 图谱检索（使用 LightRAG）
    workspace = knowledge.graph_enhancement['lightrag_workspace']
    mode = data.get('mode') or knowledge.graph_enhancement.get('query_mode', 'mix')
    
    graph_results = LightRAGService.query(
        workspace=workspace,
        query=data['query'],
        mode=mode,
        top_k=data.get('top_k', 10)
    )
    
    # 3. 合并结果
    merged_results = merge_search_results(vector_results, graph_results)
    
    return jsonify(merged_results)

def query_vector_only(kb_id):
    """纯向量检索"""
    data = request.json
    results = VectorDBService.search(
        knowledge_id=kb_id,
        query=data['query'],
        top_k=data.get('top_k', 10)
    )
    return jsonify(results)
```

#### 2.3 图谱增强服务

```python
# backend/app/services/knowledge_base/graph_enhancement_service.py

class GraphEnhancementService:
    """Vector 知识库的图谱增强服务"""
    
    @staticmethod
    def sync_documents_to_lightrag(knowledge_id):
        """同步 Vector 知识库的文档到 LightRAG"""
        knowledge = Knowledge.query.get(knowledge_id)
        workspace = knowledge.graph_enhancement['lightrag_workspace']
        
        # 更新状态
        knowledge.graph_enhancement['sync_status'] = 'syncing'
        db.session.commit()
        
        try:
            # 获取所有已处理的文档
            documents = Document.query.filter_by(
                knowledge_id=knowledge_id,
                status='processed'
            ).all()
            
            # 批量发送到 LightRAG
            for doc in documents:
                # 获取解析后的 Markdown 内容
                md_content = doc.parsed_content
                
                # 发送到 LightRAG
                LightRAGService.upload_text(
                    workspace=workspace,
                    content=md_content,
                    filename=doc.filename
                )
            
            # 更新状态
            knowledge.graph_enhancement['sync_status'] = 'synced'
            knowledge.graph_enhancement['last_sync_at'] = datetime.utcnow()
            db.session.commit()
            
        except Exception as e:
            knowledge.graph_enhancement['sync_status'] = 'failed'
            db.session.commit()
            raise
    
    @staticmethod
    def sync_single_document(knowledge_id, document_id):
        """同步单个文档到 LightRAG（新上传或更新时调用）"""
        knowledge = Knowledge.query.get(knowledge_id)
        
        # 检查是否启用了图谱增强
        if not knowledge.graph_enhancement.get('enabled'):
            return
        
        document = Document.query.get(document_id)
        workspace = knowledge.graph_enhancement['lightrag_workspace']
        
        # 获取解析后的 Markdown 内容
        md_content = document.parsed_content
        
        # 发送到 LightRAG
        LightRAGService.upload_text(
            workspace=workspace,
            content=md_content,
            filename=document.filename
        )
```

#### 2.4 文档处理流程修改

```python
# backend/app/services/knowledge_base/document_processor.py

class DocumentProcessor:
    """文档处理器"""
    
    def process_document(self, document_id):
        """处理文档"""
        document = Document.query.get(document_id)
        knowledge = document.knowledge
        
        if knowledge.kb_type == 'lightrag':
            # LightRAG 类型：直接上传到 LightRAG
            self._process_lightrag_document(document)
        else:
            # Vector 类型：平台处理
            self._process_vector_document(document)
    
    def _process_lightrag_document(self, document):
        """处理 LightRAG 类型的文档"""
        # 直接上传文件到 LightRAG
        workspace = document.knowledge.id
        
        with open(document.file_path, 'rb') as f:
            LightRAGService.upload_file(workspace, f, document.filename)
        
        document.status = 'processed'
        db.session.commit()
    
    def _process_vector_document(self, document):
        """处理 Vector 类型的文档"""
        # 1. 解析文档（PDF/Word → Markdown）
        md_content = self.parse_document(document)
        document.parsed_content = md_content  # 保存解析后的内容
        
        # 2. 分块
        chunks = self.chunk_document(md_content)
        
        # 3. 向量化
        embeddings = self.embed_chunks(chunks)
        
        # 4. 存储到向量数据库
        self.store_to_vector_db(document.knowledge_id, chunks, embeddings)
        
        # 5. 如果启用了图谱增强，同步到 LightRAG
        if document.knowledge.graph_enhancement.get('enabled'):
            GraphEnhancementService.sync_single_document(
                document.knowledge_id, document.id
            )
        
        document.status = 'processed'
        db.session.commit()
```

### 优先级 3：MCP 工具集成

```python
# backend/app/services/mcp/tools/lightrag_tool.py

class LightRAGQueryTool:
    """LightRAG 知识库查询工具"""
    
    name = "query_lightrag_knowledge"
    description = """从 LightRAG 知识库查询相关信息，支持多种查询模式：
    - naive: 纯向量检索（最快）
    - local: 基于实体的图谱检索
    - global: 基于关系的图谱检索
    - hybrid: 实体+关系混合检索
    - mix: 图谱+向量混合检索（推荐，默认）
    """
    
    parameters = {
        "type": "object",
        "properties": {
            "knowledge_id": {
                "type": "string",
                "description": "知识库ID"
            },
            "query": {
                "type": "string",
                "description": "查询内容"
            },
            "mode": {
                "type": "string",
                "enum": ["naive", "local", "global", "hybrid", "mix"],
                "description": "查询模式（可选，不指定则使用知识库默认配置）"
            },
            "top_k": {
                "type": "integer",
                "description": "返回结果数量（可选）"
            }
        },
        "required": ["knowledge_id", "query"]
    }
    
    def execute(self, knowledge_id, query, mode=None, top_k=None):
        """执行查询"""
        # 获取知识库配置
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge or knowledge.kb_type != 'lightrag':
            return {"error": "知识库不存在或不是 LightRAG 类型"}
        
        # 使用知识库的默认配置
        if mode is None:
            mode = knowledge.lightrag_config.get('default_query_mode', 'mix')
        
        # 调用知识库查询 API
        response = requests.post(
            f"/api/knowledge/{knowledge_id}/lightrag/query",
            json={"query": query, "mode": mode, "top_k": top_k}
        )
        return response.json()
```

---

## 设计原则

1. **Docker 原生部署**：通过环境变量配置，符合容器化最佳实践
2. **配置同步机制**：平台模型配置自动同步到 LightRAG
3. **单实例多知识库**：通过 `LIGHTRAG-WORKSPACE` Header 隔离数据
4. **统一模型管理**：所有模型配置在平台 ModelConfig 中管理
5. **与 Graphiti 独立**：LightRAG（知识库）和 Graphiti（记忆）是两个独立系统
6. **融合 Job 系统**：LightRAG 任务管理融合到现有的 Job 系统，统一任务状态追踪
7. **多模式查询**：支持 naive/local/global/hybrid/mix 五种查询模式，默认 mix

## 任务管理架构（2026-01-26 更新）

### 融合 Job 系统的优势

```
┌─────────────────────────────────────────────────────────────────┐
│                      统一的 Job 系统                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  文档转换任务     │  │  向量化任务       │  │ LightRAG任务  │  │
│  │  kb:convert_file │  │ kb:vectorize_file│  │kb:lightrag_*  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                  │
│  统一的状态管理：pending → running → completed/failed            │
│  统一的进度追踪：0% → 50% → 100%                                 │
│  统一的日志记录：实时日志、错误信息                               │
│  统一的重试机制：max_retries、retry_count                        │
└─────────────────────────────────────────────────────────────────┘
```

### 任务类型定义

| 任务类型 | 说明 | 参数 |
|---------|------|------|
| `kb:lightrag_upload` | 单个文档上传到 LightRAG | knowledge_id, file_path, workspace |
| `kb:lightrag_batch_upload` | 批量文档上传 | knowledge_id, file_paths[], workspace |
| `kb:lightrag_sync_all` | 同步所有文档（Vector 图谱增强） | knowledge_id |

### 任务流程示例

```python
# 1. 用户上传文档到 LightRAG 知识库
POST /api/knowledge/{kb_id}/lightrag/upload
{
  "file_path": "docs/manual.pdf"
}

# 2. 后端提交 Job
job_id = job_manager.submit_job(
    job_type='kb:lightrag_upload',
    params={
        'knowledge_id': kb_id,
        'file_path': 'docs/manual.pdf',
        'workspace': kb_id
    },
    user_id=current_user.id
)

# 3. 返回 job_id（不再使用 LightRAG 的 track_id）
return {'success': True, 'job_id': job_id}

# 4. 前端轮询任务状态（与其他任务一样）
GET /api/jobs/{job_id}
{
  "status": "running",
  "progress": 50,
  "message": "上传到 LightRAG...",
  "logs": [...]
}

# 5. 任务完成
{
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "workspace": "kb_123",
    "file_name": "manual.pdf"
  }
}
```

### 与现有任务的对比

| 维度 | 向量化任务 | LightRAG 任务 |
|------|-----------|--------------|
| **任务类型** | `kb:vectorize_file` | `kb:lightrag_upload` |
| **处理流程** | 读取分块 → 向量化 → 存储到向量DB | 读取文档 → 上传到 LightRAG |
| **状态追踪** | Job 系统 | Job 系统（统一） |
| **进度更新** | 0% → 100% | 0% → 100% |
| **失败重试** | 支持 | 支持 |
| **日志记录** | 支持 | 支持 |
| **前端查询** | `/api/jobs/{job_id}` | `/api/jobs/{job_id}`（统一） |

---

## LightRAG Workspace 隔离机制研究（2026-02-04 更新）

### 问题背景

在测试中发现，通过 HTTP Header `LIGHTRAG-WORKSPACE` 切换 workspace 时，查询不同 workspace 返回了相同的文档列表，说明动态 workspace 切换可能未完全生效。

### RAGFlow 的集成方式（参考）

经过研究 RAGFlow 源码，发现 **RAGFlow 并没有调用 LightRAG Server API，而是直接集成了 LightRAG 的核心算法**。

#### RAGFlow 的代码结构

```
ragflow/rag/graphrag/
├── __init__.py
├── entity_resolution.py          # 实体消解
├── entity_resolution_prompt.py   # 实体消解 Prompt
├── query_analyze_prompt.py       # 查询分析 Prompt
├── search.py                     # 图谱搜索
├── utils.py                      # 工具函数
├── general/                      # GraphRAG 方法（Microsoft）
│   └── ...
└── light/                        # LightRAG 方法
    ├── __init__.py
    ├── graph_extractor.py        # 实体抽取器（核心）
    ├── graph_prompt.py           # LightRAG Prompt（从 LightRAG 移植）
    └── smoke.py
```

#### RAGFlow 的 LightRAG Prompt（直接移植）

`rag/graphrag/light/graph_prompt.py` 文件头部注释：
```python
# Licensed under the MIT License
"""
Reference:
 - [LightRAG](https://github.com/HKUDS/LightRAG/blob/main/lightrag/prompt.py)
"""
```

包含的核心 Prompt：
- `entity_extraction` - 实体和关系抽取
- `entity_continue_extraction` - 继续抽取遗漏的实体
- `entity_if_loop_extraction` - 判断是否需要继续抽取
- `summarize_entity_descriptions` - 实体描述合并
- `keywords_extraction` - 关键词抽取
- `rag_response` - RAG 响应生成
- `naive_rag_response` - 纯向量 RAG 响应

#### RAGFlow 的实体抽取器

`rag/graphrag/light/graph_extractor.py`:
```python
class GraphExtractor(Extractor):
    def __init__(self, llm_invoker, language, entity_types, ...):
        # 使用 LightRAG 的 Prompt 模板
        self._entity_extract_prompt = PROMPTS["entity_extraction"]
        
    async def _process_single_content(self, chunk_key_dp, ...):
        # 1. 构建 Prompt
        hint_prompt = self._entity_extract_prompt.format(
            entity_types=",".join(self._entity_types),
            input_text=content,
            ...
        )
        # 2. 调用 LLM
        final_result = await self._chat(hint_prompt)
        # 3. 解析结果，提取 nodes 和 edges
        maybe_nodes, maybe_edges = self._entities_and_relations(...)
```

### RAGFlow vs 独立 LightRAG Server 对比

| 特性 | RAGFlow | 独立 LightRAG Server |
|------|---------|---------------------|
| **架构** | 集成 LightRAG 算法到自身系统 | 独立服务 |
| **存储** | Elasticsearch 或 Infinity | 多种存储后端（Milvus、PostgreSQL 等） |
| **Workspace 隔离** | 通过 Dataset（数据集）天然隔离 | 需要启动多个实例或等待动态 workspace 支持 |
| **图谱更新** | 上传新文件时自动更新 | 需要手动触发 |
| **控制粒度** | 完全控制处理流程 | 依赖 LightRAG Server 的实现 |

### ABM-LLM 的两种集成方案

#### 方案 A：集成 LightRAG 算法（像 RAGFlow 一样）

**优点**：
- 完全控制处理流程
- 天然的 workspace 隔离（通过 kb_id）
- 可以复用现有的 Milvus 向量存储
- 不依赖外部服务

**缺点**：
- 工作量较大（约 2-3 周）
- 需要维护 LightRAG 算法代码

**实现步骤**：

1. **创建 GraphRAG 模块**
```
backend/app/services/graphrag/
├── __init__.py
├── prompts.py           # 从 LightRAG 移植 Prompt
├── entity_extractor.py  # 实体抽取逻辑
├── graph_storage.py     # 图存储（NetworkX 或 Neo4j）
└── vector_storage.py    # 向量存储（复用现有 Milvus）
```

2. **移植核心 Prompt**（从 LightRAG 复制）
```python
# backend/app/services/graphrag/prompts.py

ENTITY_EXTRACTION_PROMPT = """---Goal---
Given a text document that is potentially relevant to this activity and a list of entity types, 
identify all entities of those types from the text and all relationships among the identified entities.
Use {language} as output language.

---Steps---
1. Identify all entities. For each identified entity, extract the following information:
- entity_name: Name of the entity
- entity_type: One of the following types: [{entity_types}]
- entity_description: Comprehensive description of the entity's attributes and activities
Format each entity as ("entity"<|><entity_name><|><entity_type><|><entity_description>)

2. From the entities identified in step 1, identify all pairs of (source_entity, target_entity) 
that are *clearly related* to each other.
...
"""

ENTITY_CONTINUE_EXTRACTION_PROMPT = """
MANY entities and relationships were missed in the last extraction. 
Please find only the missing entities and relationships from previous text.
...
"""

SUMMARIZE_ENTITY_DESCRIPTIONS_PROMPT = """
You are a helpful assistant responsible for generating a comprehensive summary of the data provided below.
Given one or two entities, and a list of descriptions, all related to the same entity or group of entities.
Please concatenate all of these into a single, comprehensive description.
...
"""
```

3. **实现实体抽取器**
```python
# backend/app/services/graphrag/entity_extractor.py

import re
from typing import List, Tuple, Dict, Any

class EntityExtractor:
    """实体和关系抽取器（移植自 LightRAG）"""
    
    TUPLE_DELIMITER = "<|>"
    RECORD_DELIMITER = "##"
    COMPLETION_DELIMITER = "<|COMPLETE|>"
    
    def __init__(self, llm_service, language: str = "Chinese", entity_types: List[str] = None):
        self.llm_service = llm_service
        self.language = language
        self.entity_types = entity_types or ["organization", "person", "event", "category"]
        self.max_gleanings = 2  # 最大迭代抽取次数
    
    async def extract(self, text: str) -> Tuple[List[Dict], List[Dict]]:
        """
        从文本中抽取实体和关系
        
        Returns:
            (entities, relations) - 实体列表和关系列表
        """
        # 1. 构建 Prompt
        prompt = ENTITY_EXTRACTION_PROMPT.format(
            language=self.language,
            entity_types=",".join(self.entity_types),
            tuple_delimiter=self.TUPLE_DELIMITER,
            record_delimiter=self.RECORD_DELIMITER,
            completion_delimiter=self.COMPLETION_DELIMITER,
            input_text=text
        )
        
        # 2. 调用 LLM
        result = await self.llm_service.chat(prompt)
        
        # 3. 迭代抽取（gleaning）
        for i in range(self.max_gleanings):
            continue_prompt = ENTITY_CONTINUE_EXTRACTION_PROMPT.format(...)
            glean_result = await self.llm_service.chat(continue_prompt)
            result += glean_result
            
            # 检查是否需要继续
            if_loop_result = await self.llm_service.chat(ENTITY_IF_LOOP_PROMPT)
            if if_loop_result.strip().lower() != "yes":
                break
        
        # 4. 解析结果
        entities, relations = self._parse_extraction_result(result)
        return entities, relations
    
    def _parse_extraction_result(self, result: str) -> Tuple[List[Dict], List[Dict]]:
        """解析 LLM 返回的实体和关系"""
        entities = []
        relations = []
        
        # 按记录分隔符分割
        records = result.split(self.RECORD_DELIMITER)
        
        for record in records:
            # 提取括号内的内容
            match = re.search(r"\((.*)\)", record)
            if not match:
                continue
            
            content = match.group(1)
            parts = content.split(self.TUPLE_DELIMITER)
            
            if parts[0] == "entity" and len(parts) >= 4:
                entities.append({
                    "name": parts[1].strip(),
                    "type": parts[2].strip(),
                    "description": parts[3].strip()
                })
            elif parts[0] == "relationship" and len(parts) >= 6:
                relations.append({
                    "source": parts[1].strip(),
                    "target": parts[2].strip(),
                    "description": parts[3].strip(),
                    "keywords": parts[4].strip(),
                    "strength": float(parts[5].strip()) if parts[5].strip().isdigit() else 5
                })
        
        return entities, relations
```

4. **实现图存储**
```python
# backend/app/services/graphrag/graph_storage.py

import networkx as nx
from typing import Dict, List, Any, Optional

class GraphStorage:
    """知识图谱存储（基于 NetworkX）"""
    
    def __init__(self, kb_id: str):
        self.kb_id = kb_id
        self.graph = nx.DiGraph()
        self._load_graph()
    
    def add_entity(self, entity: Dict[str, Any]) -> None:
        """添加实体节点"""
        self.graph.add_node(
            entity["name"],
            entity_type=entity["type"],
            description=entity["description"],
            kb_id=self.kb_id
        )
    
    def add_relation(self, relation: Dict[str, Any]) -> None:
        """添加关系边"""
        self.graph.add_edge(
            relation["source"],
            relation["target"],
            description=relation["description"],
            keywords=relation["keywords"],
            strength=relation["strength"],
            kb_id=self.kb_id
        )
    
    def get_entity(self, name: str) -> Optional[Dict]:
        """获取实体"""
        if name in self.graph.nodes:
            return dict(self.graph.nodes[name])
        return None
    
    def get_neighbors(self, entity_name: str, depth: int = 1) -> List[Dict]:
        """获取实体的邻居节点（用于图谱检索）"""
        neighbors = []
        for neighbor in nx.single_source_shortest_path_length(self.graph, entity_name, cutoff=depth):
            if neighbor != entity_name:
                neighbors.append({
                    "name": neighbor,
                    **dict(self.graph.nodes[neighbor])
                })
        return neighbors
    
    def search_entities(self, query: str, top_k: int = 10) -> List[Dict]:
        """搜索实体（基于名称和描述的模糊匹配）"""
        results = []
        query_lower = query.lower()
        
        for node, data in self.graph.nodes(data=True):
            score = 0
            if query_lower in node.lower():
                score += 10
            if query_lower in data.get("description", "").lower():
                score += 5
            if score > 0:
                results.append({"name": node, "score": score, **data})
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]
    
    def _load_graph(self) -> None:
        """从持久化存储加载图谱"""
        # 可以从文件或数据库加载
        pass
    
    def _save_graph(self) -> None:
        """持久化图谱"""
        # 可以保存到文件或数据库
        pass
```

5. **实现查询服务**
```python
# backend/app/services/graphrag/query_service.py

from typing import Dict, List, Any

class GraphRAGQueryService:
    """GraphRAG 查询服务"""
    
    def __init__(self, kb_id: str, llm_service, embedding_service):
        self.kb_id = kb_id
        self.llm_service = llm_service
        self.embedding_service = embedding_service
        self.graph_storage = GraphStorage(kb_id)
        self.vector_storage = VectorStorage(kb_id)  # 复用现有 Milvus
    
    async def query(self, query: str, mode: str = "hybrid", top_k: int = 10) -> Dict[str, Any]:
        """
        执行查询
        
        Args:
            query: 查询文本
            mode: 查询模式
                - naive: 纯向量检索
                - local: 基于实体的图谱检索
                - global: 基于关系的图谱检索
                - hybrid: 实体+关系混合检索
                - mix: 图谱+向量混合检索（推荐）
            top_k: 返回结果数量
        """
        if mode == "naive":
            return await self._naive_query(query, top_k)
        elif mode == "local":
            return await self._local_query(query, top_k)
        elif mode == "global":
            return await self._global_query(query, top_k)
        elif mode == "hybrid":
            return await self._hybrid_query(query, top_k)
        else:  # mix
            return await self._mix_query(query, top_k)
    
    async def _naive_query(self, query: str, top_k: int) -> Dict[str, Any]:
        """纯向量检索"""
        chunks = await self.vector_storage.search(query, top_k)
        return {"mode": "naive", "chunks": chunks}
    
    async def _local_query(self, query: str, top_k: int) -> Dict[str, Any]:
        """基于实体的图谱检索"""
        # 1. 从查询中提取关键实体
        entities = await self._extract_query_entities(query)
        
        # 2. 在图谱中搜索相关实体
        related_entities = []
        for entity in entities:
            neighbors = self.graph_storage.get_neighbors(entity, depth=2)
            related_entities.extend(neighbors)
        
        # 3. 获取相关实体的描述作为上下文
        context = self._build_entity_context(related_entities)
        
        return {"mode": "local", "entities": related_entities, "context": context}
    
    async def _global_query(self, query: str, top_k: int) -> Dict[str, Any]:
        """基于关系的图谱检索"""
        # 搜索与查询相关的关系
        relations = self.graph_storage.search_relations(query, top_k)
        context = self._build_relation_context(relations)
        return {"mode": "global", "relations": relations, "context": context}
    
    async def _hybrid_query(self, query: str, top_k: int) -> Dict[str, Any]:
        """实体+关系混合检索"""
        local_result = await self._local_query(query, top_k // 2)
        global_result = await self._global_query(query, top_k // 2)
        
        return {
            "mode": "hybrid",
            "entities": local_result["entities"],
            "relations": global_result["relations"],
            "context": local_result["context"] + "\n" + global_result["context"]
        }
    
    async def _mix_query(self, query: str, top_k: int) -> Dict[str, Any]:
        """图谱+向量混合检索（推荐）"""
        # 1. 向量检索
        chunks = await self.vector_storage.search(query, top_k // 2)
        
        # 2. 图谱检索
        hybrid_result = await self._hybrid_query(query, top_k // 2)
        
        # 3. 合并结果
        return {
            "mode": "mix",
            "chunks": chunks,
            "entities": hybrid_result["entities"],
            "relations": hybrid_result["relations"],
            "context": self._merge_context(chunks, hybrid_result)
        }
    
    async def _extract_query_entities(self, query: str) -> List[str]:
        """从查询中提取关键实体"""
        prompt = KEYWORDS_EXTRACTION_PROMPT.format(query=query)
        result = await self.llm_service.chat(prompt)
        # 解析返回的关键词
        return self._parse_keywords(result)
```

6. **集成到知识库服务**
```python
# backend/app/services/knowledge_base/lightrag_integrated_service.py

class LightRAGIntegratedService:
    """集成式 LightRAG 服务（不依赖外部 LightRAG Server）"""
    
    def __init__(self, kb_id: str):
        self.kb_id = kb_id
        self.entity_extractor = EntityExtractor(llm_service)
        self.graph_storage = GraphStorage(kb_id)
        self.query_service = GraphRAGQueryService(kb_id, llm_service, embedding_service)
    
    async def process_document(self, content: str, doc_id: str) -> Dict[str, Any]:
        """处理文档，构建知识图谱"""
        # 1. 分块
        chunks = self._chunk_text(content)
        
        # 2. 对每个分块进行实体抽取
        all_entities = []
        all_relations = []
        
        for chunk in chunks:
            entities, relations = await self.entity_extractor.extract(chunk)
            all_entities.extend(entities)
            all_relations.extend(relations)
        
        # 3. 实体消解（合并相同实体）
        merged_entities = self._merge_entities(all_entities)
        
        # 4. 存储到图谱
        for entity in merged_entities:
            self.graph_storage.add_entity(entity)
        for relation in all_relations:
            self.graph_storage.add_relation(relation)
        
        return {
            "entities_count": len(merged_entities),
            "relations_count": len(all_relations)
        }
    
    async def query(self, query: str, mode: str = "mix", top_k: int = 10) -> Dict[str, Any]:
        """查询知识库"""
        return await self.query_service.query(query, mode, top_k)
```

**工作量评估**：

| 组件 | 工作量 | 说明 |
|------|--------|------|
| Prompt 移植 | 1 天 | 直接从 LightRAG 复制 |
| 实体抽取器 | 2-3 天 | 需要实现 LLM 调用和结果解析 |
| 图存储 | 2 天 | NetworkX 简单，Neo4j 需要更多配置 |
| 向量存储 | 1 天 | 复用现有 Milvus |
| 查询逻辑 | 3-4 天 | 需要实现多模式检索和上下文构建 |
| 隔离机制 | 0.5 天 | 通过 kb_id 字段天然隔离 |
| 测试和调优 | 2-3 天 | 确保各模式正常工作 |

**总体工作量：约 2-3 周**

---

#### 方案 B：为每个知识库启动独立的 LightRAG 实例

**优点**：
- 实现简单
- 完全隔离，无数据泄露风险
- 可以使用 LightRAG 的完整功能

**缺点**：
- 资源消耗大（每个知识库一个容器）
- 需要动态管理多个容器
- 端口管理复杂

**实现方式**：

```yaml
# docker-compose.lightrag-multi.yml
services:
  lightrag-kb1:
    image: ghcr.io/hkuds/lightrag:latest
    environment:
      - WORKSPACE=kb_001
      - PORT=9621
    ports:
      - "9621:9621"
      
  lightrag-kb2:
    image: ghcr.io/hkuds/lightrag:latest
    environment:
      - WORKSPACE=kb_002
      - PORT=9622
    ports:
      - "9622:9622"
```

后端需要维护知识库 ID 到 LightRAG 端口的映射：
```python
LIGHTRAG_PORT_MAP = {
    "kb_001": 9621,
    "kb_002": 9622,
    # ...
}
```

---

### 推荐方案

**推荐采用方案 A（集成 LightRAG 算法）**，原因：

1. **RAGFlow 已验证可行**：RAGFlow 作为成熟的开源项目，已经成功实现了这种集成方式
2. **天然的隔离机制**：通过 kb_id 字段实现数据隔离，无需额外配置
3. **资源效率高**：不需要为每个知识库启动独立容器
4. **完全可控**：可以根据需求定制处理流程
5. **复用现有基础设施**：可以复用现有的 Milvus 向量存储和 LLM 服务

### 下一步行动

1. 创建 `backend/app/services/graphrag/` 模块
2. 移植 LightRAG 的核心 Prompt
3. 实现实体抽取器
4. 实现图存储（先用 NetworkX，后续可迁移到 Neo4j）
5. 实现查询服务
6. 集成到知识库处理流程
