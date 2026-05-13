# 任务类型定义与数据结构设计

## 📌 实现状态概览

### ✅ 已实现的任务类型
| 任务类型 | 说明 | 处理器 | API 端点 | 前端集成 |
|---------|------|-------|---------|---------|
| **kb:convert_file** | 文件转换（PDF→Markdown） | ✅ | ✅ | ✅ |
| **kb:vectorize_file** | 单文件向量化 | ✅ | ✅ | ✅ |
| **kb:vectorize_batch** | 批量向量化 | ✅ | ⏳ | ⏳ |

**实现文件：**
- 后端处理器: `backend/app/services/task_queue/handlers/knowledge_handlers.py`
- API 注册: `backend/app/__init__.py`
- 前端组件: `frontend/src/components/Tasks/`

---

## 一、所有任务类型梳理

基于系统现有功能，完整梳理所有需要异步处理的任务类型：

### 1.1 知识库相关任务 (Knowledge Base)
| 任务类型 | 说明 | 典型耗时 | 优先级 | 状态 |
|---------|------|---------|--------|------|
| `kb:convert_file` | 文档转换（PDF/OCR→Markdown） | 5-120秒 | high | ✅ **已实现** |
| `kb:chunk` | 文档分段 | 1-10秒 | high | ⏳ 待实现 |
| `kb:vectorize_file` | 单文件向量化 | 5-60秒 | high | ✅ **已实现** |
| `kb:vectorize_batch` | 批量文件向量化 | 1-30分钟 | medium | ✅ **已实现** |
| `kb:re_embed` | 重新嵌入（更换模型） | 5-60分钟 | low | ⏳ 待实现 |
| `kb:delete_file` | 删除文件及其向量 | 1-5秒 | high | ⏳ 待实现 |
| `kb:import` | 导入知识库 | 1-10分钟 | medium | ⏳ 待实现 |
| `kb:export` | 导出知识库 | 1-10分钟 | medium | ⏳ 待实现 |
| `kb:sync_capability` | 同步知识库能力 | 1-5秒 | medium | ⏳ 待实现 |

### 1.2 图增强相关任务 (Graph Enhancement)
| 任务类型 | 说明 | 典型耗时 | 优先级 | 状态 |
|---------|------|---------|--------|------|
| `graph:add_episode` | 添加图记忆片段 | 2-10秒 | high | ⏳ 待实现 |
| `graph:search` | 图检索 | 0.5-5秒 | high | ⏳ 待实现 |
| `graph:build_communities` | 构建社区 | 10-300秒 | low | ⏳ 待实现 |
| `graph:sync_partition` | 同步分区配置 | 1-5秒 | medium | ⏳ 待实现 |

### 1.3 变量同步任务 (Variable Sync)
| 任务类型 | 说明 | 典型耗时 | 优先级 | 状态 |
|---------|------|---------|--------|------|
| `var:sync_external` | 同步外部变量 | 1-30秒 | medium | ⏳ 待实现 |
| `var:sync_all` | 批量同步所有变量 | 1-5分钟 | low | ⏳ 待实现 |
| `var:scheduled_sync` | 定时同步任务 | 1-30秒 | low | ⏳ 待实现 |

### 1.4 会话与记忆任务 (Conversation & Memory)
| 任务类型 | 说明 | 典型耗时 | 优先级 | 状态 |
|---------|------|---------|--------|------|
| `conv:sync_memory` | 同步会话到图记忆 | 2-10秒 | medium | ⏳ 待实现 |
| `conv:export` | 导出会话记录 | 1-5分钟 | low | ⏳ 待实现 |
| `conv:summarize` | 生成会话摘要 | 5-30秒 | medium | ⏳ 待实现 |

### 1.5 数据导入导出任务 (Import/Export)
| 任务类型 | 说明 | 典型耗时 | 优先级 | 状态 |
|---------|------|---------|--------|------|
| `data:export_actionspace` | 导出行动空间 | 5-60秒 | medium | ⏳ 待实现 |
| `data:import_actionspace` | 导入行动空间 | 10-120秒 | medium | ⏳ 待实现 |
| `data:export_roles` | 导出角色配置 | 1-10秒 | low | ⏳ 待实现 |
| `data:backup_db` | 数据库备份 | 1-30分钟 | low | ⏳ 待实现 |

### 1.6 统计与分析任务 (Statistics & Analytics)
| 任务类型 | 说明 | 典型耗时 | 优先级 | 状态 |
|---------|------|---------|--------|------|
| `stats:generate_report` | 生成统计报告 | 5-60秒 | low | ⏳ 待实现 |
| `stats:analyze_conversations` | 分析会话数据 | 10-300秒 | low | ⏳ 待实现 |

### 1.7 维护与清理任务 (Maintenance)
| 任务类型 | 说明 | 典型耗时 | 优先级 | 状态 |
|---------|------|---------|--------|------|
| `maint:cleanup_old_tasks` | 清理旧任务记录 | 5-60秒 | low | ⏳ 待实现 |
| `maint:cleanup_embeddings` | 清理无效向量 | 10-120秒 | low | ⏳ 待实现 |
| `maint:rebuild_index` | 重建索引 | 30-600秒 | low | ⏳ 待实现 |

### 1.8 实验与测试任务 (Experiment)
| 任务类型 | 说明 | 典型耗时 | 优先级 | 状态 |
|---------|------|---------|--------|------|
| `exp:parallel_run` | 并行实验执行 | 1-30分钟 | medium | ⏳ 待实现 |
| `exp:generate_analysis` | 生成实验分析 | 10-120秒 | low | ⏳ 待实现 |

---

## 二、基础任务数据结构

### 2.1 核心字段（所有任务通用）

```python
class BaseTask:
    """基础任务结构（存储在 Redis Hash）"""
    
    # === 任务标识 ===
    task_id: str              # 唯一ID，格式: task_{uuid}
    task_type: str            # 任务类型，如: kb:vectorize_file
    
    # === 状态管理 ===
    status: str               # pending|running|completed|failed|cancelled|retrying
    progress: int             # 0-100
    message: str              # 当前状态描述
    
    # === 优先级与调度 ===
    priority: str             # high|medium|low
    queue_name: str           # 队列名称，自动生成: task:queue:{priority}
    
    # === 时间戳 ===
    created_at: float         # 创建时间戳（秒，带小数）
    started_at: float         # 开始执行时间
    completed_at: float       # 完成时间
    estimated_duration: int   # 预计耗时（秒），可选
    
    # === 重试与错误处理 ===
    retry_count: int          # 当前重试次数
    max_retries: int          # 最大重试次数，默认3
    error: str                # 错误信息（JSON序列化）
    
    # === 执行者 ===
    worker_id: str            # 执行该任务的Worker ID
    
    # === 租户与权限 ===
    user_id: str              # 创建任务的用户ID
    tenant_id: str            # 租户ID（多租户隔离）
    
    # === 结果 ===
    result: str               # 任务结果（JSON序列化）
    result_type: str          # 结果类型: json|url|file_path
    
    # === 元数据 ===
    metadata: str             # 额外元数据（JSON序列化）
    tags: str                 # 标签列表（JSON数组）
```

### 2.2 基础结构的 Redis 存储方式

```python
# 存储在 Redis Hash: task:meta:{task_id}
{
    "task_id": "task_abc123",
    "task_type": "kb:vectorize_file",
    "status": "running",
    "progress": 45,
    "message": "向量化进度 25/50",
    "priority": "high",
    "queue_name": "task:queue:high",
    "created_at": "1699344000.123",
    "started_at": "1699344002.456",
    "completed_at": null,
    "retry_count": 0,
    "max_retries": 3,
    "error": null,
    "worker_id": "worker-01",
    "user_id": "user_xyz",
    "tenant_id": "tenant_001",
    "result": null,
    "result_type": "json",
    "metadata": "{\"source\": \"api\"}",
    "tags": "[\"knowledge_base\", \"urgent\"]"
}
```

---

## 三、扩展任务数据结构（按业务分类）

### 3.1 知识库任务扩展字段

```python
class KnowledgeBaseTaskParams:
    """知识库任务扩展参数（存储在 task:meta:{task_id}.params）"""
    
    # === 资源定位 ===
    knowledge_id: str         # 知识库ID
    file_path: str            # 文件路径（相对于知识库）
    file_id: str              # 文件ID（可选）
    
    # === 处理参数 ===
    chunk_method: str         # 分段方法: chonkie|semantic|fixed
    chunk_config: dict        # 分段配置
    embedding_model_id: int   # 嵌入模型ID
    vector_db_type: str       # 向量数据库类型: tidb|milvus
    
    # === 批量任务专用 ===
    file_paths: List[str]     # 批量文件路径列表
    total_files: int          # 总文件数
    processed_files: int      # 已处理文件数
    
    # === 重新嵌入专用 ===
    old_embedding_model_id: int  # 旧模型ID
    new_embedding_model_id: int  # 新模型ID
    clear_old_vectors: bool      # 是否清除旧向量
```

**示例：单文件向量化任务**
```json
{
  "task_type": "kb:vectorize_file",
  "priority": "high",
  "user_id": "user_xyz",
  "params": {
    "knowledge_id": "kb_123",
    "file_path": "docs/manual.pdf",
    "chunk_method": "chonkie",
    "chunk_config": {
      "chunk_size": 1000,
      "chunk_overlap": 200
    },
    "embedding_model_id": 5,
    "vector_db_type": "tidb"
  }
}
```

**示例：批量向量化任务**
```json
{
  "task_type": "kb:vectorize_batch",
  "priority": "medium",
  "user_id": "user_xyz",
  "params": {
    "knowledge_id": "kb_123",
    "file_paths": ["doc1.pdf", "doc2.txt", "doc3.md"],
    "total_files": 3,
    "processed_files": 0,
    "embedding_model_id": 5
  }
}
```

### 3.2 图增强任务扩展字段

```python
class GraphEnhancementTaskParams:
    """图增强任务扩展参数"""
    
    # === 资源定位 ===
    partition_id: str         # 分区ID
    framework: str            # 图框架: graphiti|lightrag|graphrag
    
    # === Episode/Memory ===
    episode_type: str         # memory|conversation|document
    content: str              # 内容文本
    source_entity_id: str     # 来源实体ID（user/agent/role）
    
    # === 检索任务专用 ===
    query: str                # 检索查询
    top_k: int                # 返回结果数
    search_strategy: str      # 检索策略
    
    # === 社区构建专用 ===
    algorithm: str            # 社区算法: louvain|leiden
    min_community_size: int   # 最小社区大小
```

**示例：添加图记忆任务**
```json
{
  "task_type": "graph:add_episode",
  "priority": "high",
  "user_id": "user_xyz",
  "params": {
    "partition_id": "actionspace-space_001",
    "framework": "graphiti",
    "episode_type": "conversation",
    "content": "用户询问了产品功能...",
    "source_entity_id": "agent_456"
  }
}
```

### 3.3 变量同步任务扩展字段

```python
class VariableSyncTaskParams:
    """变量同步任务扩展参数"""
    
    # === 单个变量同步 ===
    variable_id: str          # 外部变量ID
    variable_name: str        # 变量名称
    variable_type: str        # 变量类型: http|database|file
    
    # === HTTP类型专用 ===
    http_url: str             # HTTP URL
    http_method: str          # GET|POST
    http_headers: dict        # 请求头
    
    # === 批量同步专用 ===
    variable_ids: List[str]   # 变量ID列表
    sync_strategy: str        # 同步策略: parallel|sequential
    
    # === 定时任务专用 ===
    schedule_cron: str        # Cron表达式
    last_sync_time: float     # 上次同步时间
```

**示例：同步外部变量**
```json
{
  "task_type": "var:sync_external",
  "priority": "medium",
  "user_id": "system",
  "params": {
    "variable_id": "var_789",
    "variable_name": "weather_data",
    "variable_type": "http",
    "http_url": "https://api.weather.com/current",
    "http_method": "GET"
  }
}
```

### 3.4 文档转换任务扩展字段

```python
class DocumentConversionTaskParams:
    """文档转换任务扩展参数"""
    
    # === 资源定位 ===
    source_path: str          # 源文件路径
    target_path: str          # 目标文件路径
    conversion_type: str      # pdf_to_text|ocr|docx_to_html
    
    # === OCR专用 ===
    ocr_engine: str           # paddleocr|tesseract
    ocr_language: str         # chi_sim|eng
    
    # === 图片提取专用 ===
    extract_images: bool      # 是否提取图片
    image_output_dir: str     # 图片输出目录
```

**示例：PDF OCR转换**
```json
{
  "task_type": "doc:convert",
  "priority": "high",
  "user_id": "user_xyz",
  "params": {
    "source_path": "uploads/scan.pdf",
    "target_path": "converted/scan.txt",
    "conversion_type": "ocr",
    "ocr_engine": "paddleocr",
    "ocr_language": "chi_sim"
  }
}
```

### 3.5 会话记忆同步任务扩展字段

```python
class ConversationMemoryTaskParams:
    """会话记忆同步任务扩展参数"""
    
    # === 资源定位 ===
    conversation_id: str      # 会话ID
    message_id: str           # 消息ID
    
    # === 同步配置 ===
    sync_to_graph: bool       # 同步到图记忆
    sync_strategy: str        # immediate|batch|delayed
    partition_strategy: str   # by_space|by_task|by_agent
    
    # === 批量同步专用 ===
    message_ids: List[str]    # 消息ID列表
```

### 3.6 导入导出任务扩展字段

```python
class ImportExportTaskParams:
    """导入导出任务扩展参数"""
    
    # === 导出任务 ===
    export_type: str          # actionspace|knowledge|roles
    export_format: str        # json|yaml|excel
    export_path: str          # 导出文件路径
    include_related: bool     # 是否包含关联数据
    
    # === 导入任务 ===
    import_file: str          # 导入文件路径
    import_strategy: str      # merge|replace|skip
    conflict_resolution: str  # overwrite|skip|rename
    
    # === 行动空间导出专用 ===
    action_space_id: str      # 行动空间ID
    include_conversations: bool  # 包含会话记录
    include_rules: bool       # 包含规则
```

**示例：导出行动空间**
```json
{
  "task_type": "data:export_actionspace",
  "priority": "medium",
  "user_id": "user_xyz",
  "params": {
    "action_space_id": "space_001",
    "export_type": "actionspace",
    "export_format": "json",
    "export_path": "exports/space_001_20241107.json",
    "include_conversations": true,
    "include_rules": true
  }
}
```

---

## 四、任务状态流转规则

### 4.1 状态定义

```python
class TaskStatus:
    PENDING = "pending"       # 等待执行
    RUNNING = "running"       # 执行中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消
    RETRYING = "retrying"     # 重试中
    TIMEOUT = "timeout"       # 超时
    ABANDONED = "abandoned"   # 放弃（达到最大重试次数）
```

### 4.2 状态流转图

```
                    ┌─────────┐
                    │ PENDING │ (初始状态)
                    └────┬────┘
                         │
                         ▼
                    ┌─────────┐
              ┌────→│ RUNNING │
              │     └────┬────┘
              │          │
              │          ├──────────→ [COMPLETED] (成功)
              │          │
              │          ├──────────→ [CANCELLED] (用户取消)
              │          │
              │          └──────────→ [FAILED]
              │                           │
              │                           ├─→ retry_count < max_retries
              │                           │   └─→ [RETRYING] ──┘
              │                           │
              │                           └─→ retry_count >= max_retries
              │                               └─→ [ABANDONED]
              │
              └────────────────────────────── Worker超时检测
                                              └─→ [TIMEOUT] → [RETRYING]
```

### 4.3 状态流转触发条件

| 当前状态 | 触发事件 | 下一状态 | 操作 |
|---------|---------|---------|------|
| PENDING | Worker拉取任务 | RUNNING | 更新started_at, worker_id |
| RUNNING | 任务完成 | COMPLETED | 更新completed_at, result |
| RUNNING | 用户取消 | CANCELLED | 设置error信息 |
| RUNNING | 执行失败 | FAILED | retry_count++ |
| FAILED | retry_count < max_retries | RETRYING | 重新入队 |
| RETRYING | Worker拉取 | RUNNING | 继续执行 |
| FAILED | retry_count >= max_retries | ABANDONED | 标记为最终失败 |
| RUNNING | 超时检测 | TIMEOUT | 设置超时错误 |
| TIMEOUT | 自动重试 | RETRYING | 重新入队 |

---

## 五、任务权限与租户隔离

### 5.1 权限控制字段

```python
class TaskPermission:
    """任务权限控制"""
    
    # === 基础权限 ===
    user_id: str              # 创建者ID
    tenant_id: str            # 租户ID
    
    # === 可见性控制 ===
    visibility: str           # private|team|public
    shared_with_users: List[str]  # 共享给的用户ID列表
    shared_with_roles: List[str]  # 共享给的角色ID列表
    
    # === 操作权限 ===
    can_cancel: List[str]     # 可取消任务的用户ID列表
    can_retry: List[str]      # 可重试任务的用户ID列表
    can_view_logs: List[str]  # 可查看日志的用户ID列表
```

### 5.2 Redis Key 命名规范（支持多租户）

```python
# 带租户隔离的Key命名
task:queue:{tenant_id}:{priority}        # 队列
task:meta:{tenant_id}:{task_id}          # 任务元数据
task:log:{tenant_id}:{task_id}           # 任务日志
task:index:user:{tenant_id}:{user_id}    # 用户任务索引
task:index:type:{tenant_id}:{task_type}  # 任务类型索引
task:index:kb:{tenant_id}:{kb_id}        # 知识库任务索引

# Worker心跳（全局）
worker:heartbeat:{worker_id}             # Worker心跳
```

---

## 六、任务索引与查询设计

### 6.1 索引结构

```python
# 按用户索引 (ZSET, score=created_at)
task:index:user:{tenant_id}:{user_id}
→ [task_id1, task_id2, ...]

# 按任务类型索引 (ZSET, score=created_at)
task:index:type:{tenant_id}:{task_type}
→ [task_id1, task_id2, ...]

# 按资源ID索引（如知识库、行动空间）
task:index:kb:{tenant_id}:{knowledge_id}         # 知识库相关任务
task:index:space:{tenant_id}:{action_space_id}   # 行动空间相关任务
task:index:conv:{tenant_id}:{conversation_id}    # 会话相关任务

# 按状态索引 (SET)
task:index:status:{tenant_id}:{status}
→ {task_id1, task_id2, ...}

# 按时间范围索引 (ZSET, score=created_at)
task:index:time:{tenant_id}:{YYYYMMDD}
→ [task_id1, task_id2, ...]
```

### 6.2 查询接口

```python
# 查询用户的所有任务（分页）
GET /api/tasks?user_id=user_xyz&offset=0&limit=20

# 查询特定类型的任务
GET /api/tasks?task_type=kb:vectorize_file&status=running

# 查询知识库相关的所有任务
GET /api/tasks?knowledge_id=kb_123

# 查询今天的所有任务
GET /api/tasks?date=20241107

# 复杂过滤查询
GET /api/tasks?user_id=user_xyz&task_type=kb:*&status=completed&date=20241107
```

---

## 七、任务数据结构总结

### 7.1 完整数据模型（Python TypedDict）

```python
from typing import TypedDict, Literal, Optional, Dict, Any, List

class BaseTaskData(TypedDict):
    """基础任务数据"""
    task_id: str
    task_type: str
    status: Literal["pending", "running", "completed", "failed", "cancelled", "retrying", "timeout", "abandoned"]
    progress: int
    message: str
    priority: Literal["high", "medium", "low"]
    queue_name: str
    created_at: float
    started_at: Optional[float]
    completed_at: Optional[float]
    estimated_duration: Optional[int]
    retry_count: int
    max_retries: int
    error: Optional[str]
    worker_id: Optional[str]
    user_id: str
    tenant_id: str
    result: Optional[str]
    result_type: Literal["json", "url", "file_path"]
    metadata: str  # JSON string
    tags: str      # JSON array string

class TaskSubmitRequest(TypedDict):
    """提交任务请求"""
    task_type: str
    priority: str
    params: Dict[str, Any]
    max_retries: Optional[int]
    estimated_duration: Optional[int]
    metadata: Optional[Dict[str, Any]]
    tags: Optional[List[str]]

class TaskStatusResponse(TypedDict):
    """任务状态响应"""
    task_id: str
    task_type: str
    status: str
    progress: int
    message: str
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]
    error: Optional[Dict[str, Any]]
    result: Optional[Any]
    worker_id: Optional[str]
```

### 7.2 数据存储位置总览

| 数据类型 | Redis 数据结构 | Key 格式 | 说明 |
|---------|---------------|---------|------|
| 任务队列 | ZSET | `task:queue:{tenant}:{priority}` | score=timestamp |
| 任务元数据 | Hash | `task:meta:{tenant}:{task_id}` | 完整任务信息 |
| 任务日志 | List | `task:log:{tenant}:{task_id}` | 最多保留100条 |
| 用户索引 | ZSET | `task:index:user:{tenant}:{user_id}` | score=created_at |
| 类型索引 | ZSET | `task:index:type:{tenant}:{task_type}` | score=created_at |
| 状态索引 | Set | `task:index:status:{tenant}:{status}` | 成员=task_id |
| 资源索引 | ZSET | `task:index:{resource}:{tenant}:{id}` | score=created_at |
| Worker心跳 | Hash + TTL | `worker:heartbeat:{worker_id}` | TTL=30s |

---

## 八、下一步实施建议

1. **优先实现基础结构** (Phase 0-1)
   - 基础任务数据模型 `BaseTask`
   - Redis 存储/读取封装
   - 任务提交接口

2. **实现知识库任务** (Phase 2)
   - `kb:vectorize_file`
   - `kb:chunk`
   - 验证完整流程

3. **逐步扩展其他任务类型** (Phase 3-N)
   - 图增强任务
   - 变量同步任务
   - 导入导出任务
   - 维护任务

4. **完善监控与查询** (最后)
   - 索引构建
   - 查询接口
   - 监控面板

---

**版本**: v1.0  
**日期**: 2024-11-07  
**状态**: 待评审
