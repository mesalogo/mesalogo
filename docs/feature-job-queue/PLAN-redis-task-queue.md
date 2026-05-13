# 基于 Redis 的全局任务队列系统设计

## 1. 背景与问题

### 1.1 当前痛点
- **知识库处理阻塞主线程**：文档分段、向量嵌入等耗时操作（几秒到几分钟）在 HTTP 请求中同步执行
- **变量同步缺乏管理**：`ExternalVariableMonitor` 使用原始 threading，无法监控状态、重试失败、查看进度
- **无法横向扩展**：Python threading 无法跨进程/跨服务器，无法利用多核或分布式
- **缺乏可观测性**：无法查看任务队列长度、处理进度、失败原因、历史记录
- **无优先级控制**：所有任务先进先出，无法插队处理紧急任务

### 1.2 目标
构建一个基于 Redis 的全局异步任务队列系统，实现：
- **异步执行**：长时间任务不阻塞 HTTP 请求
- **优先级队列**：支持高/中/低优先级
- **状态追踪**：实时查看任务状态（pending/running/completed/failed）
- **进度报告**：长任务可报告百分比进度
- **失败重试**：支持指数退避重试
- **横向扩展**：多 Worker 进程并行处理
- **可观测性**：监控面板、历史记录、性能指标

## 2. 技术选型

### 2.1 为什么选 Redis（不用 Celery）
| 特性 | Redis 方案 | Celery |
|------|-----------|--------|
| 依赖 | 已有 Redis | 需要 RabbitMQ/Redis + Celery |
| 复杂度 | 轻量、直观 | 重量级、学习曲线陡峭 |
| 控制力 | 完全可控 | 黑盒，难以定制 |
| 适用场景 | 中小型项目 | 大型分布式系统 |

结论：你们已有 Redis，场景相对简单，直接基于 Redis 实现最合适。

### 2.2 Redis 数据结构选择
- **任务队列**：使用 `ZSET`（有序集合），score 为 `priority*1e12 + timestamp_ms`，实现优先级队列
- **任务详情**：使用 `Hash`，存储任务元数据、状态、进度、结果
- **任务日志**：使用 `List`，记录任务执行日志
- **Worker 心跳**：使用 `Hash + TTL`，监控 Worker 健康状态

## 3. 架构设计

### 3.1 核心组件
```
┌─────────────────────────────────────────────────┐
│                 HTTP API 层                      │
│  (提交任务、查询状态、取消任务)                    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│            TaskManager (任务管理器)               │
│  - 提交任务到队列                                 │
│  - 查询任务状态                                   │
│  - 取消/重试任务                                  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│              Redis 队列层                        │
│  - task:queue:{priority} (ZSET)                 │
│  - task:meta:{task_id} (Hash)                   │
│  - task:log:{task_id} (List)                    │
│  - worker:heartbeat:{worker_id} (Hash)          │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│            TaskWorker (任务处理器)                │
│  - 从队列拉取任务                                 │
│  - 执行任务逻辑                                   │
│  - 更新状态和进度                                 │
│  - 失败重试                                       │
└─────────────────────────────────────────────────┘
```

### 3.2 任务生命周期
```
PENDING → RUNNING → COMPLETED
                  ↘
                   FAILED → RETRYING → RUNNING
                                     ↘
                                      ABANDONED
```

### 3.3 Key 设计
```python
# 优先级队列（3个队列，对应高/中/低优先级）
task:queue:high     # ZSET, score = timestamp_ms
task:queue:medium   # ZSET, score = timestamp_ms
task:queue:low      # ZSET, score = timestamp_ms

# 任务元数据
task:meta:{task_id}  # Hash
{
    "task_type": "vectorize_document",
    "status": "running",           # pending/running/completed/failed/cancelled
    "priority": "high",            # high/medium/low
    "progress": 45,                # 0-100
    "created_at": 1234567890.123,
    "started_at": 1234567890.456,
    "completed_at": null,
    "worker_id": "worker-01",
    "retry_count": 0,
    "max_retries": 3,
    "error": null,
    "result": null,                # JSON 序列化的结果
    "params": {...}                # JSON 序列化的参数
}

# 任务日志（最近 100 条）
task:log:{task_id}  # List
[
    "2024-01-01 10:00:00 | INFO | 开始处理文档",
    "2024-01-01 10:00:05 | INFO | 分段完成，共 50 段",
    "2024-01-01 10:00:10 | INFO | 向量化进度 50%"
]

# Worker 心跳
worker:heartbeat:{worker_id}  # Hash + TTL 30s
{
    "worker_id": "worker-01",
    "started_at": 1234567890,
    "last_heartbeat": 1234567890,
    "current_task_id": "task_abc123",
    "processed_count": 42,
    "failed_count": 3
}

# 任务索引（按知识库、用户、时间等维护索引，便于查询）
task:index:knowledge:{kb_id}    # SET, 该知识库的所有任务
task:index:user:{user_id}       # ZSET, score=created_at
task:index:type:{task_type}     # ZSET, score=created_at
```

## 4. 任务类型定义

### 4.1 知识库相关任务
```python
class TaskType:
    # 文档处理
    CHUNK_DOCUMENT = "chunk_document"           # 文档分段
    VECTORIZE_CHUNKS = "vectorize_chunks"       # 分段向量化
    PROCESS_DOCUMENT = "process_document"       # 完整流程（分段+向量化）
    
    # 批量操作
    BATCH_VECTORIZE_KB = "batch_vectorize_kb"   # 批量向量化知识库
    RE_EMBED_KNOWLEDGE = "re_embed_knowledge"   # 重新嵌入知识库
    
    # 维护任务
    SYNC_EXTERNAL_VAR = "sync_external_var"     # 同步外部变量
    CLEANUP_OLD_TASKS = "cleanup_old_tasks"     # 清理旧任务
    BACKUP_KNOWLEDGE = "backup_knowledge"       # 备份知识库
```

### 4.2 任务优先级
```python
class Priority:
    HIGH = "high"      # 用户主动触发的操作（手动上传文档）
    MEDIUM = "medium"  # 定时同步、自动触发任务
    LOW = "low"        # 维护任务、统计任务
```

## 5. 核心实现

### 5.1 TaskManager 接口
```python
class TaskManager:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    # 提交任务
    def submit_task(
        self,
        task_type: str,
        params: dict,
        priority: str = "medium",
        max_retries: int = 3,
        metadata: dict = None
    ) -> str:
        """提交任务到队列，返回 task_id"""
        pass
    
    # 查询任务状态
    def get_task_status(self, task_id: str) -> dict:
        """返回任务的完整状态"""
        pass
    
    # 查询任务进度
    def get_task_progress(self, task_id: str) -> dict:
        """返回 {progress: 45, status: "running", message: "..."}"""
        pass
    
    # 取消任务
    def cancel_task(self, task_id: str) -> bool:
        """取消等待中或运行中的任务"""
        pass
    
    # 重试任务
    def retry_task(self, task_id: str) -> bool:
        """手动重试失败的任务"""
        pass
    
    # 查询队列统计
    def get_queue_stats(self) -> dict:
        """返回各优先级队列的长度、运行中任务数等"""
        pass
    
    # 查询任务列表（支持过滤、分页）
    def list_tasks(
        self,
        filters: dict = None,  # {status, task_type, user_id, ...}
        offset: int = 0,
        limit: int = 20
    ) -> list:
        """查询任务列表"""
        pass
```

### 5.2 TaskWorker 接口
```python
class TaskWorker:
    def __init__(self, worker_id: str, redis_client):
        self.worker_id = worker_id
        self.redis = redis_client
        self.handlers = {}  # task_type -> handler_func
        self.is_running = False
    
    # 注册任务处理器
    def register_handler(self, task_type: str, handler_func):
        """注册任务类型的处理函数"""
        self.handlers[task_type] = handler_func
    
    # 启动 Worker
    def start(self):
        """启动 Worker 主循环"""
        self.is_running = True
        while self.is_running:
            task = self._fetch_task()  # 从优先级队列拉取
            if task:
                self._execute_task(task)
            else:
                time.sleep(1)  # 空闲时等待
    
    # 停止 Worker
    def stop(self):
        """优雅停止 Worker"""
        self.is_running = False
    
    # 拉取任务（按优先级）
    def _fetch_task(self) -> dict:
        """按 high -> medium -> low 顺序拉取任务"""
        pass
    
    # 执行任务
    def _execute_task(self, task: dict):
        """执行任务，更新状态，处理异常"""
        pass
    
    # 更新任务进度
    def update_progress(self, task_id: str, progress: int, message: str = None):
        """更新任务进度（0-100）"""
        pass
    
    # 记录日志
    def log(self, task_id: str, level: str, message: str):
        """记录任务日志"""
        pass
    
    # 心跳
    def _heartbeat(self):
        """定期更新心跳，TTL 30s"""
        pass
```

### 5.3 任务处理器示例
```python
# 注册文档向量化任务处理器
def handle_vectorize_document(task_id, params, context):
    """
    context 包含：
    - worker: TaskWorker 实例
    - redis: Redis 客户端
    - db: 数据库会话
    """
    worker = context['worker']
    
    # 1. 解析参数
    knowledge_id = params['knowledge_id']
    file_path = params['file_path']
    
    worker.log(task_id, "INFO", f"开始处理文档: {file_path}")
    
    # 2. 读取分段
    chunks = KnowledgeFileChunk.query.filter_by(
        knowledge_id=knowledge_id,
        file_path=file_path
    ).all()
    
    total = len(chunks)
    worker.update_progress(task_id, 10, f"读取到 {total} 个分段")
    
    # 3. 批量生成向量
    batch_size = 10
    for i in range(0, total, batch_size):
        batch = chunks[i:i+batch_size]
        # ... 调用嵌入服务 ...
        
        progress = 10 + int(80 * (i + batch_size) / total)
        worker.update_progress(task_id, progress, f"向量化进度 {i+batch_size}/{total}")
    
    # 4. 存储到向量数据库
    worker.update_progress(task_id, 90, "存储向量到数据库")
    # ... 存储逻辑 ...
    
    worker.update_progress(task_id, 100, "完成")
    
    return {
        'success': True,
        'vectors_count': total,
        'time_spent': 42.5
    }

# 注册处理器
worker.register_handler(TaskType.PROCESS_DOCUMENT, handle_vectorize_document)
```

## 6. API 设计

### 6.1 任务管理 API
```python
# 提交任务
POST /api/tasks
{
    "task_type": "process_document",
    "priority": "high",
    "params": {
        "knowledge_id": "kb_123",
        "file_path": "docs/manual.pdf"
    }
}
→ {"task_id": "task_abc123", "status": "pending"}

# 查询任务状态
GET /api/tasks/{task_id}
→ {
    "task_id": "task_abc123",
    "task_type": "process_document",
    "status": "running",
    "progress": 45,
    "created_at": "2024-01-01T10:00:00Z",
    "started_at": "2024-01-01T10:00:05Z",
    "message": "向量化进度 25/50",
    "worker_id": "worker-01"
}

# 查询任务日志
GET /api/tasks/{task_id}/logs
→ {
    "logs": [
        {"time": "...", "level": "INFO", "message": "..."},
        ...
    ]
}

# 取消任务
POST /api/tasks/{task_id}/cancel
→ {"success": true}

# 重试任务
POST /api/tasks/{task_id}/retry
→ {"success": true, "new_task_id": "task_def456"}

# 查询队列统计
GET /api/tasks/stats
→ {
    "queue_length": {"high": 2, "medium": 5, "low": 10},
    "running_tasks": 3,
    "completed_today": 128,
    "failed_today": 2,
    "active_workers": 2
}

# 查询任务列表
GET /api/tasks?status=completed&task_type=process_document&limit=20
→ {
    "tasks": [...],
    "total": 128,
    "offset": 0,
    "limit": 20
}
```

### 6.2 集成到现有 API
```python
# 原有同步接口改为异步
POST /api/knowledges/{kb_id}/documents/{doc_id}/vectorize
→ {
    "task_id": "task_abc123",
    "status": "pending",
    "message": "任务已提交，请通过 /api/tasks/{task_id} 查询进度"
}

# 前端通过 WebSocket 或轮询获取进度
# 或使用 SSE 推送进度更新
GET /api/tasks/{task_id}/stream
→ Server-Sent Events
data: {"progress": 10, "message": "读取分段"}
data: {"progress": 50, "message": "向量化进度 25/50"}
data: {"progress": 100, "message": "完成", "status": "completed"}
```

## 7. 前端集成

### 7.1 任务提交与进度展示
```javascript
// 提交任务
const response = await api.post('/api/tasks', {
    task_type: 'process_document',
    priority: 'high',
    params: { knowledge_id: 'kb_123', file_path: 'doc.pdf' }
});
const taskId = response.data.task_id;

// 轮询进度（简单方式）
const pollProgress = setInterval(async () => {
    const status = await api.get(`/api/tasks/${taskId}`);
    updateProgressBar(status.data.progress);
    
    if (status.data.status === 'completed') {
        clearInterval(pollProgress);
        showSuccess('处理完成！');
    } else if (status.data.status === 'failed') {
        clearInterval(pollProgress);
        showError(status.data.error);
    }
}, 2000);

// 或使用 SSE 实时推送（推荐）
const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateProgressBar(data.progress);
    if (data.status === 'completed') {
        eventSource.close();
        showSuccess('处理完成！');
    }
};
```

### 7.2 任务监控面板
```
┌───────────────────────────────────────────┐
│          任务管理中心                      │
├───────────────────────────────────────────┤
│ 队列统计                                   │
│  高优先级: 2   中优先级: 5   低优先级: 10  │
│  运行中: 3     今日完成: 128  今日失败: 2  │
│  Worker 数: 2                             │
├───────────────────────────────────────────┤
│ 任务列表                                   │
│ ┌─────────────────────────────────────┐  │
│ │ task_abc123 | 文档向量化 | 运行中 45% │  │
│ │ task_def456 | 变量同步   | 等待中     │  │
│ │ task_ghi789 | 知识库备份 | 已完成     │  │
│ └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

## 8. 部署方案

### 8.1 单机部署（开发/小规模）
```bash
# 启动 Flask API（已有）
python run_app.py

# 启动 Worker（新增）
python -m app.workers.task_worker --worker-id worker-01

# 可启动多个 Worker 并行处理
python -m app.workers.task_worker --worker-id worker-02
```

### 8.2 分布式部署（生产环境）
```bash
# 服务器 A：API 服务器
python run_app.py

# 服务器 B：专用 Worker 集群
python -m app.workers.task_worker --worker-id worker-B1 &
python -m app.workers.task_worker --worker-id worker-B2 &
python -m app.workers.task_worker --worker-id worker-B3 &

# 使用 Supervisor 管理进程
[program:task_worker]
command=python -m app.workers.task_worker --worker-id worker-%(process_num)d
numprocs=4
```

### 8.3 Docker 部署
```yaml
# docker-compose.yml
services:
  api:
    build: .
    command: python run_app.py
    depends_on:
      - redis
  
  worker:
    build: .
    command: python -m app.workers.task_worker --worker-id worker-%(process_num)d
    deploy:
      replicas: 4  # 4 个 Worker 实例
    depends_on:
      - redis
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

## 9. 实施计划

### Phase 0: 基础设施（1 天）
- [ ] `backend/app/services/task_queue/redis_client.py`：Redis 连接管理
- [ ] `backend/app/services/task_queue/constants.py`：任务类型、优先级常量
- [ ] `backend/app/services/task_queue/models.py`：任务数据模型
- [ ] 单元测试：连接、Key 设计验证

### Phase 1: TaskManager 实现（2 天）
- [ ] `backend/app/services/task_queue/task_manager.py`：任务管理器核心逻辑
  - submit_task
  - get_task_status
  - cancel_task
  - list_tasks
- [ ] 单元测试：提交任务、状态查询、取消任务

### Phase 2: TaskWorker 实现（2 天）
- [ ] `backend/app/services/task_queue/task_worker.py`：Worker 核心逻辑
  - 从队列拉取任务（按优先级）
  - 执行任务处理器
  - 更新状态和进度
  - 失败重试机制
  - 心跳维护
- [ ] `backend/app/workers/task_worker.py`：Worker 启动脚本
- [ ] 单元测试：任务拉取、执行、重试

### Phase 3: 任务处理器实现（2 天）
- [ ] `backend/app/services/task_queue/handlers/knowledge_handlers.py`
  - handle_vectorize_document
  - handle_batch_vectorize_kb
  - handle_re_embed_knowledge
- [ ] `backend/app/services/task_queue/handlers/sync_handlers.py`
  - handle_sync_external_var
- [ ] 集成测试：端到端任务执行

### Phase 4: API 集成（1 天）
- [ ] `backend/app/api/routes/tasks.py`：任务管理 API 端点
- [ ] 改造现有知识库 API：改为异步提交任务
- [ ] API 测试

### Phase 5: 前端集成（2 天）
- [ ] 任务进度条组件
- [ ] 任务监控面板
- [ ] SSE 实时进度推送
- [ ] 前端集成测试

### Phase 6: 监控与优化（1 天）
- [ ] 监控指标收集
- [ ] 性能优化
- [ ] 文档完善

**总计：约 11 天**

## 10. 风险与缓解

### 10.1 技术风险
| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Redis 故障导致任务丢失 | 高 | AOF 持久化 + 定期备份 |
| Worker 进程崩溃 | 中 | Supervisor 自动重启 + 任务超时检测 |
| 任务堆积导致内存溢出 | 中 | 队列长度限制 + 降级策略 |
| 长任务阻塞 Worker | 低 | 超时中断 + 子进程隔离 |

### 10.2 业务风险
| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 用户不习惯异步模式 | 中 | 清晰的进度提示 + 完成通知 |
| 任务失败无感知 | 高 | 失败通知 + 重试按钮 |
| 历史任务堆积 | 低 | 定期清理 + 归档 |

## 11. 监控指标

### 11.1 业务指标
- 任务提交速率（tasks/min）
- 任务完成率（%）
- 任务平均耗时（s）
- 失败任务占比（%）
- 重试成功率（%）

### 11.2 技术指标
- 队列长度（high/medium/low）
- Worker 利用率（%）
- Redis 内存使用（MB）
- 任务等待时长（s）
- 心跳超时次数

## 12. 后续扩展

### 12.1 短期优化
- [ ] 任务依赖关系（Task A 完成后自动触发 Task B）
- [ ] 定时任务支持（Cron 表达式）
- [ ] 任务结果缓存（相同参数的任务直接返回缓存结果）
- [ ] 批量任务提交（一次提交多个任务）

### 12.2 长期愿景
- [ ] Web UI 管理面板（Flower 风格）
- [ ] 任务可视化编排（DAG 工作流）
- [ ] 分布式追踪（OpenTelemetry 集成）
- [ ] 智能调度（根据历史数据预测任务耗时，优化调度策略）

---

**文档版本**: v1.0  
**编写日期**: 2024-11-07  
**预计实施**: 2024-11-10 - 2024-11-25
