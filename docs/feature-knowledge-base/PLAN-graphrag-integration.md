# 知识库 GraphRAG 集成方案（替代 LightRAG）

> **版本**: v2.0  
> **创建日期**: 2026-02-09  
> **更新日期**: 2026-02-09  
> **设计原则**: KISS + 独立性 + 复用现有基础设施  

---

## 1. 背景

### 1.1 为什么废弃 LightRAG 集成

| 问题 | 说明 |
|------|------|
| 单实例单 workspace | 官方确认当前不支持动态切换，多知识库需多实例 |
| `LIGHTRAG-WORKSPACE` Header 无效 | 官方从未支持此功能，现有代码实际不工作 |
| 外部容器依赖 | 核心能力全在外部 Docker 容器，不可控 |
| 多 workspace 遥遥无期 | 官方计划 v1.6.x 支持，无明确时间表 |

### 1.2 新方案核心思路

**不再依赖外部 LightRAG 容器**，将 GraphRAG 的核心能力（实体/关系抽取 + 社区发现 + 图谱检索）直接集成到现有向量知识库 pipeline 中：

- 复用现有 Neo4j 实例（与 Graphiti 共用）
- 复用现有 LLM 服务（ModelConfig）
- 在现有向量知识库上**可选启用**图谱增强
- 不引入新的知识库类型，统一为 `kb_type='vector'`

---

## 2. 架构

### 2.1 整体构建流程（三步，全部手动触发）

```
步骤1: 文档处理（现有，不变）
  文档上传 → 解析 → 分块 → 向量化 → Milvus

步骤2: 构建图谱（手动触发，按钮："构建图谱"）
  读取 chunks → 逐 chunk 调 LLM 抽取实体/关系 → MERGE 写入 Neo4j
  ※ 文档级操作，可增量（只处理新文档），也可全量重建

步骤3: 构建社区（手动触发，按钮："构建社区"）
  读取该知识库所有 KBEntity + KB_RELATION
  → Leiden 算法聚类（知识库级）
  → 每个社区调 LLM 生成摘要
  → 写入 Neo4j (:KBCommunity)
  ※ 知识库级操作，每次全量重建（因为新实体/关系可能改变社区结构）
```

**关键设计**：步骤2和步骤3完全独立，互不依赖自动触发。用户可以：
- 只构建图谱，不构建社区（此时 local search 可用，global search 不可用）
- 构建图谱后再构建社区（local + global search 都可用）
- 新增文档后只重新构建图谱，社区暂不更新（旧社区仍可用）

### 2.2 查询流程

```
查询 → 向量检索 (Milvus)                                    （现有，不变）
     → Local 图谱检索: 关键词 → 匹配实体 → 展开邻居          （需要图谱）
     → Global 图谱检索: 关键词 → 匹配社区摘要 → map-reduce   （需要社区）
     → 合并结果返回
```

### 2.3 Neo4j 数据模型（与 Graphiti 共存）

```
Graphiti（已有，不动）:
  (:Entity {group_id, name, summary})
  -[:RELATES_TO {group_id, name, fact}]->
  (:Entity)

GraphRAG（新增）:
  (:KBEntity {knowledge_id, name, entity_type, description, chunk_ids, document_ids})
  -[:KB_RELATION {knowledge_id, description, keywords, strength, chunk_ids}]->
  (:KBEntity)

  (:KBCommunity {knowledge_id, level, title, summary, entity_count, created_at})
  -[:HAS_MEMBER]->
  (:KBEntity)
```

- 不同 Label（`KBEntity` / `KBCommunity` vs `Entity`）+ 不同关系类型
- 完全不互相干扰
- `knowledge_id` 属性实现知识库级别隔离

---

## 3. 新增文件

```
backend/app/services/knowledge_base/graphrag/
├── __init__.py
├── prompts.py              # 实体/关系抽取 + 社区摘要 + 关键词提取 Prompt
├── entity_extractor.py     # 调用 LLM 抽取实体和关系，解析并写入 Neo4j
├── community_builder.py    # Leiden 社区发现 + LLM 生成社区摘要
└── graph_query_service.py  # 图谱检索服务（local/global 模式）
```

### 3.1 prompts.py

从 LightRAG / Microsoft GraphRAG 移植核心 Prompt，主要三个：

1. **实体/关系抽取 Prompt**: 输入 chunk 文本，输出结构化的实体和关系列表
2. **社区摘要 Prompt**: 输入社区内实体和关系列表，输出社区标题 + 摘要
3. **关键词提取 Prompt**: 输入查询文本，输出高级关键词和低级关键词（用于图谱检索）

输出格式统一为 JSON，便于解析。

### 3.2 entity_extractor.py

```python
class GraphRAGExtractor:
    """知识库图谱抽取器"""

    async def extract_from_chunks(
        self,
        knowledge_id: str,
        chunks: List[Dict],       # 已有的分块结果
        llm_config: ModelConfig    # 复用平台 LLM 配置
    ) -> Dict[str, Any]:
        """
        对每个 chunk 调用 LLM 抽取实体和关系，写入 Neo4j
        - 同名实体 MERGE，描述追加合并
        - 所有节点/关系带 knowledge_id
        - 返回抽取统计信息
        """

    async def _extract_single_chunk(self, chunk_text: str) -> Tuple[List[Entity], List[Relation]]:
        """单个 chunk 的抽取逻辑"""

    async def _write_to_neo4j(self, knowledge_id: str, entities: List, relations: List):
        """
        写入 Neo4j，使用 MERGE 避免重复
        Cypher 示例:
        MERGE (n:KBEntity {knowledge_id: $kb_id, name: $name})
        ON CREATE SET n.entity_type = $type, n.description = $desc
        ON MATCH SET n.description = n.description + '\n' + $desc
        """

    async def delete_by_knowledge(self, knowledge_id: str):
        """删除指定知识库的所有图谱数据"""

    async def delete_by_document(self, knowledge_id: str, document_id: str):
        """删除指定文档的图谱数据"""
```

### 3.3 community_builder.py

```python
class CommunityBuilder:
    """知识库社区构建器（知识库级别，全量重建）"""

    async def build_communities(
        self,
        knowledge_id: str,
        llm_config: ModelConfig
    ) -> Dict[str, Any]:
        """
        构建社区流程:
        1. 从 Neo4j 读取该知识库所有 KBEntity + KB_RELATION
        2. 构建 networkx 图
        3. 运行 Leiden 算法，得到层级社区
        4. 清理该知识库旧的 KBCommunity 数据
        5. 对每个社区调 LLM 生成摘要（标题 + 描述）
        6. 写入 Neo4j (:KBCommunity) + (:KBCommunity)-[:HAS_MEMBER]->(:KBEntity)
        7. 返回统计信息
        """

    async def _run_leiden(self, entities, relations) -> List[List[str]]:
        """运行 Leiden 社区发现算法，返回社区分组"""

    async def _generate_community_summary(self, community_entities, community_relations) -> Dict:
        """调用 LLM 为单个社区生成标题和摘要"""

    async def clear_communities(self, knowledge_id: str):
        """清空指定知识库的所有社区数据"""
```

### 3.4 graph_query_service.py

```python
class GraphRAGQueryService:
    """知识库图谱检索服务"""

    async def search(
        self,
        knowledge_id: str,
        query_text: str,
        mode: str = "local",      # local | global
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        图谱检索流程:
        1. 从 query 提取关键词（LLM 或简单分词）
        2. 在 KBEntity 中匹配实体（name CONTAINS keyword）
        3. 沿 KB_RELATION 展开 1-2 跳邻居
        4. 收集实体描述 + 关系描述
        5. 返回格式化的图谱上下文
        """

    async def _extract_keywords(self, query_text: str) -> List[str]:
        """从查询中提取关键词"""

    async def _local_search(self, knowledge_id: str, keywords: List[str]) -> str:
        """
        Local 模式: 从关键词匹配的实体出发，展开邻居
        Cypher:
        MATCH (n:KBEntity {knowledge_id: $kb_id})
        WHERE any(kw IN $keywords WHERE n.name CONTAINS kw)
        OPTIONAL MATCH (n)-[r:KB_RELATION {knowledge_id: $kb_id}]-(m:KBEntity)
        RETURN n, r, m LIMIT $top_k
        """

    async def _global_search(self, knowledge_id: str, keywords: List[str]) -> str:
        """
        Global 模式: 基于社区摘要的 map-reduce 检索（需要已构建社区）
        Cypher:
        MATCH (c:KBCommunity {knowledge_id: $kb_id})
        RETURN c.title, c.summary
        → 对每个社区摘要做 map（与 query 相关性判断）
        → reduce 汇总最相关的社区摘要作为上下文
        """
```

---

## 4. 改动现有文件

### 4.1 models.py - Knowledge 表

```python
# 新增字段
enable_graph = Column(Boolean, default=False)  # 是否启用图谱增强

# 废弃字段（后续清理）
# kb_type = Column(String(20), default='vector')     # 不再需要 'lightrag' 类型
# lightrag_workspace = Column(String(100))            # 废弃
# lightrag_config = Column(JSON, default=dict)        # 废弃
```

### 4.2 knowledge_query_service.py

在 `_search_single_knowledge` 中增加图谱检索分支：

```python
# 现有向量/BM25 检索逻辑不变
# ...

# 新增：图谱检索（如果启用）
if knowledge.enable_graph:
    graph_results = await GraphRAGQueryService().search(
        knowledge_id=knowledge.id,
        query_text=query_text,
        mode='local'
    )
    if graph_results:
        results_list.append(graph_results)
```

### 4.3 knowledge_pipeline_handler.py

**不改动**。图谱抽取不跟在文档处理 pipeline 后面自动执行。
文档处理流水线保持不变：转换 → 分段 → 嵌入 → completed。

### 4.4 图谱构建：独立 Job + 手动触发

图谱抽取是耗时操作（每个 chunk 调一次 LLM），设计为**独立的后台任务**，用户手动触发。

#### 4.4.1 新增 Job Handler

```
backend/app/services/job_queue/handlers/graphrag_job_handlers.py
```

```python
def handle_build_graph(job_id, params, context):
    """
    构建知识库图谱（手动触发）
    
    params: {
        "knowledge_id": "kb_xxx",
        "document_ids": ["doc_1", "doc_2"]  # 可选，不传则处理所有已完成文档
    }
    
    流程:
    1. 查询指定文档（或全部已完成文档）的 chunks
    2. 清理该知识库/文档在 Neo4j 中的旧图谱数据
    3. 逐 chunk 调用 LLM 抽取实体/关系
    4. MERGE 写入 Neo4j（KBEntity / KB_RELATION）
    5. 更新进度
    """

def handle_clear_graph(job_id, params, context):
    """
    清空知识库图谱数据
    
    params: {
        "knowledge_id": "kb_xxx"
    }
    """
```

#### 4.4.2 注册 Job Handler（app/__init__.py）

```python
from app.services.job_queue.handlers import graphrag_job_handlers
job_manager.register_handler('kb:build_graph', graphrag_job_handlers.handle_build_graph)
job_manager.register_handler('kb:clear_graph', graphrag_job_handlers.handle_clear_graph)
```

#### 4.4.3 新增 API 路由

```
POST /api/knowledge/{kb_id}/graph/build
  body: { "document_ids": [...] }  # 可选
  → 提交 kb:build_graph Job，返回 job_id

DELETE /api/knowledge/{kb_id}/graph
  → 提交 kb:clear_graph Job，返回 job_id

GET /api/knowledge/{kb_id}/graph/status
  → 返回图谱统计（实体数、关系数、最后构建时间）
```

#### 4.4.4 前端交互（后续）

知识库详情页增加"构建图谱"按钮：
- 按钮状态：未构建 / 构建中（Job 进行中）/ 已构建
- 点击后提交 Job，前端轮询 Job 进度
- 可选择对单个文档或整个知识库构建

### 4.5 Neo4j 连接

复用现有 `GraphEnhancement` 配置表中的 Neo4j 连接信息和 `DirectNeo4jQuery` 客户端，不新建配置。

---

## 5. 废弃清单

以下代码/配置在新方案实现后可安全移除：

| 文件/目录 | 说明 |
|-----------|------|
| `app/services/lightrag/` | 整个目录（lightrag_service.py, lightrag_config.py） |
| `app/api/routes/lightrag.py` | LightRAG 独立路由 |
| `app/api/routes/knowledge/lightrag.py` | 知识库 LightRAG 路由 |
| `app/services/job_queue/handlers/lightrag_job_handlers.py` | LightRAG 任务处理 |
| `knowledge_query_service.py` 中 `_search_lightrag_knowledge` | LightRAG 查询方法 |
| `Knowledge` 模型中 `kb_type`, `lightrag_workspace`, `lightrag_config` | LightRAG 相关字段 |

---

## 6. 不做什么

- **不引入新数据库** -- 复用 Neo4j
- **不改 Graphiti 任何代码** -- Label 隔离
- **不改前端** -- 图谱增强对用户透明（后续可加 enable_graph 开关到 UI）
- **不做 gleaning（迭代抽取）** -- 单次抽取，效果够用
- **不新建配置表** -- 复用 GraphEnhancement 的 Neo4j 连接
- **不做独立知识库类型** -- 统一为向量知识库 + 可选图谱增强

---

## 7. 新增/改动文件汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `services/knowledge_base/graphrag/__init__.py` | 新增 | 模块入口 |
| `services/knowledge_base/graphrag/prompts.py` | 新增 | 抽取/关键词 Prompt |
| `services/knowledge_base/graphrag/entity_extractor.py` | 新增 | LLM 抽取 + Neo4j 写入 |
| `services/knowledge_base/graphrag/graph_query_service.py` | 新增 | 图谱检索 |
| `services/job_queue/handlers/graphrag_job_handlers.py` | 新增 | build_graph / clear_graph Job |
| `api/routes/knowledge/graph.py` | 新增 | 图谱构建/清空/状态 API |
| `app/__init__.py` | 改动 | 注册 Job Handler + 蓝图 |
| `services/knowledge_base/knowledge_query_service.py` | 改动 | 增加图谱检索分支 |
| `models.py` | 改动 | Knowledge 加 `enable_graph` 字段 |
| `knowledge_pipeline_handler.py` | **不改** | pipeline 不变 |
| `direct_neo4j_query.py` | **不改** | 复用 |

## 8. 工作量估算

| 步骤 | 工作量 |
|------|--------|
| prompts.py（移植 LightRAG Prompt） | 0.5 天 |
| entity_extractor.py | 1 天 |
| graph_query_service.py | 1 天 |
| graphrag_job_handlers.py + API 路由 | 1 天 |
| 集成到 query service + 注册 | 0.5 天 |
| 废弃 LightRAG 代码清理 | 0.5 天 |
| 测试调优 | 1 天 |
| **合计** | **~5.5 天** |
