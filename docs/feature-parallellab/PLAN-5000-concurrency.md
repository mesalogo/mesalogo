# 并行实验 5000 并发架构方案

> 目标：支持单实验 5000 个任务并发执行
> 
> 状态：规划中
> 
> 日期：2026-03-20

## 一、当前架构瓶颈分析

### 1.1 当前执行链路

```
用户启动实验
  └── Flask API (Gunicorn 1 worker + 8 threads)
        └── experiment_executor.py (ThreadPoolExecutor)
              └── 每个并发任务 = 1个线程
                    └── _start_autonomous_task() → scheduler → LLM 调用
                          ├── 每轮 DB 读写 5+ 次（消息/变量/状态）
                          ├── LLM API 调用（耗时 3-30 秒）
                          └── 全程占用 1 个 DB 连接
```

### 1.2 瓶颈矩阵

| 资源 | 当前容量 | 5000并发需求 | 瓶颈级别 |
|------|---------|-------------|---------|
| **线程数** | 1进程 ~50线程 | 5000线程=40GB 内存 | 🔴 致命 |
| **DB 连接** | 100 (pool 30 + overflow 70) | ~500+ | 🔴 致命 |
| **内存** | ~4GB | ~40GB+(线程栈) | 🔴 致命 |
| **LLM API QPS** | 取决于模型提供商 | 5000 QPS | 🟡 外部约束 |
| **MySQL 写 TPS** | ~500-1000 | ~25000 | 🟡 需优化 |
| **单机 CPU** | 8-14 核 | 调度开销大 | 🟡 需分布式 |

### 1.3 核心问题

**一句话总结：当前是"1 线程 = 1 任务"的同步阻塞模型，5000 并发需要转向异步 + 分布式。**

---

## 二、目标架构

```
                    ┌─────────────┐
                    │   Frontend  │
                    │  (React)    │
                    └──────┬──────┘
                           │ HTTP/WebSocket
                    ┌──────▼──────┐
                    │  API Gateway │  (Nginx / Traefik)
                    │  + Redis     │  ← 状态缓存 + 任务队列
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼───┐ ┌──────▼──────┐
       │ API Server  │ │ API  │ │ API Server  │  ← 多实例（只处理 HTTP 请求）
       │ (Gunicorn)  │ │ ...  │ │ (Gunicorn)  │
       └──────┬──────┘ └──┬───┘ └──────┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │ 发布任务到队列
                    ┌──────▼──────┐
                    │    Redis    │  ← 任务队列 (Streams/List)
                    │  (Broker)   │    + 状态缓存 + Pub/Sub
                    └──────┬──────┘
                           │ 消费任务
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  ┌──────▼──────┐   ┌─────▼──────┐   ┌──────▼──────┐
  │   Worker    │   │   Worker   │   │   Worker    │  ← N 个 Worker 进程
  │ (asyncio)   │   │ (asyncio)  │   │ (asyncio)   │    每个跑 ~200 并发
  │ 200 tasks   │   │ 200 tasks  │   │ 200 tasks   │    用 asyncio 而非线程
  └──────┬──────┘   └─────┬──────┘   └──────┬──────┘
         │                │                 │
         └────────────────┼─────────────────┘
                          │
                   ┌──────▼──────┐
                   │   MySQL     │  ← 写入优化：批量写 + 连接池
                   │ (主从/分片) │
                   └─────────────┘
```

---

## 三、分阶段实施计划

### Phase 1：异步化改造（支持 500 并发）

**目标**：把 ThreadPoolExecutor 改为 asyncio，单进程从 50 并发提升到 500。

**原理**：LLM 调用是 I/O 密集型（等待网络响应），线程在等待期间白白占着内存和 DB 连接。asyncio 协程在等待时释放控制权，1 个线程就能跑数百个并发任务。

**改造点**：

#### 1a. 模型调用改为 async（核心）

```python
# 当前：同步调用，阻塞线程
def call_llm(prompt):
    response = requests.post(api_url, json=payload)  # 阻塞 3-30秒
    return response.json()

# 改造后：异步调用，不阻塞
async def call_llm(prompt):
    async with httpx.AsyncClient() as client:
        response = await client.post(api_url, json=payload)  # 释放控制权
        return response.json()
```

**涉及文件**：
- `app/services/conversation/model_client.py` → 改为 `async`
- `app/services/conversation/stream_handler.py` → 改为 `async`
- `app/services/conversation_service.py` → `_process_single_agent_response` 改为 `async`
- `app/services/scheduler/executor.py` → 已经是 async，但内部调用是 `asyncio.to_thread()`，需要改为原生 async

#### 1b. DB 操作改为异步连接池

```python
# 当前：SQLAlchemy 同步
db.session.query(Message).filter_by(...)

# 改造后：SQLAlchemy async（需要 SQLAlchemy 2.0+）
from sqlalchemy.ext.asyncio import AsyncSession
async with async_session() as session:
    result = await session.execute(select(Message).filter_by(...))
```

**或者更简单的方案**：保持同步 DB，但用 `asyncio.to_thread()` 包装短操作：

```python
# 短操作用 to_thread 包装，避免阻塞事件循环
message = await asyncio.to_thread(lambda: Message.query.get(msg_id))
```

#### 1c. experiment_executor 改为 asyncio

```python
# 当前：ThreadPoolExecutor
_executor = ThreadPoolExecutor(max_workers=50)
future = _executor.submit(_run_task, ...)

# 改造后：asyncio.Semaphore 控制并发
_semaphore = asyncio.Semaphore(500)  # 500 并发

async def _run_task(experiment_id, task_id, task_config):
    async with _semaphore:
        await _start_autonomous_task_async(task_id, task_config)
```

**预期效果**：
- 内存：50 线程 × 8MB = 400MB → 500 协程 × ~10KB = 5MB
- DB 连接：同时只有 ~50 个活跃（DB 操作是瞬时的，LLM 等待时不占连接）
- 单进程支持 500 并发

---

### Phase 2：引入 Redis + Worker 分离（支持 2000 并发）

**目标**：API 服务器和任务执行分离，通过 Redis 解耦。

#### 2a. Redis 作为任务队列

```python
# API Server：发布任务
import redis.asyncio as redis

async def submit_task(task_config):
    r = redis.from_url("redis://localhost:6379")
    await r.xadd("experiment:tasks", {
        "experiment_id": task_config["experiment_id"],
        "task_id": task_config["task_id"],
        "params": json.dumps(task_config["params"]),
    })

# Worker：消费任务
async def worker_loop():
    r = redis.from_url("redis://localhost:6379")
    while True:
        messages = await r.xreadgroup(
            "workers", f"worker-{worker_id}",
            {"experiment:tasks": ">"},
            count=10, block=5000
        )
        for stream, entries in messages:
            for entry_id, data in entries:
                await process_task(data)
                await r.xack("experiment:tasks", "workers", entry_id)
```

#### 2b. Redis 缓存实验状态（减少 DB 读压力）

```python
# 前端轮询时，优先读 Redis 缓存
async def get_experiment_status(experiment_id):
    cached = await redis.get(f"exp:status:{experiment_id}")
    if cached:
        return json.loads(cached)
    
    # 缓存未命中，查 DB
    status = await _query_db_status(experiment_id)
    await redis.setex(f"exp:status:{experiment_id}", 3, json.dumps(status))
    return status

# Worker 完成任务时，更新 Redis 缓存
async def on_task_done(experiment_id, task_id, result):
    # 原子更新 Redis 中的实验状态
    await redis.hincrby(f"exp:stats:{experiment_id}", "completed", 1)
    # 异步写 DB（可以批量）
    await db_write_queue.put(("update_task", task_id, result))
```

#### 2c. Write-Behind 批量写入

```python
# 非关键写操作（ExperimentStep、status 更新）走批量写
class BatchWriter:
    def __init__(self, flush_interval=2, batch_size=100):
        self._buffer = []
        self._lock = asyncio.Lock()
    
    async def write(self, operation):
        async with self._lock:
            self._buffer.append(operation)
            if len(self._buffer) >= self.batch_size:
                await self._flush()
    
    async def _flush(self):
        if not self._buffer:
            return
        batch = self._buffer[:]
        self._buffer.clear()
        # 单次 DB 连接，批量执行
        async with db_session() as session:
            for op in batch:
                session.add(op)
            await session.commit()
```

**部署拓扑**：

```
docker-compose:
  api-server:      ×2 实例（处理 HTTP 请求）
  worker:          ×4 实例（每个 500 并发 = 2000 总并发）
  redis:           ×1（任务队列 + 状态缓存）
  mysql:           ×1（持久化存储）
```

**预期效果**：
- 2000 并发，4 个 Worker 各 500
- API 服务不受任务执行影响（完全解耦）
- 前端轮询响应 <100ms（Redis 缓存）
- DB 写入降低 60%（批量写 + 缓存）

---

### Phase 3：分布式扩展（支持 5000+ 并发）

**目标**：多机部署，水平扩展。

#### 3a. Worker 水平扩展

```yaml
# docker-compose.scale.yml
services:
  worker:
    image: mesalogo/worker:latest
    deploy:
      replicas: 10  # 10 个 Worker × 500 并发 = 5000
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=mysql+asyncmy://...
      - MAX_CONCURRENT=500
```

#### 3b. MySQL 优化

- **读写分离**：主库写，从库读（前端轮询走从库）
- **消息表分区**：按 `conversation_id` 分区，避免大表查询
- **连接池代理**：ProxySQL / MaxScale，管理 5000+ 连接

```
Worker ×10 → ProxySQL → MySQL 主库（写）
API ×4   → ProxySQL → MySQL 从库（读）
```

#### 3c. LLM API 限流管理

5000 并发的真正瓶颈可能是 LLM API 限流。需要：

```python
class LLMRateLimiter:
    """全局 LLM API 限流器（Redis 实现，多 Worker 共享）"""
    
    async def acquire(self, model_id: str):
        # 使用 Redis 令牌桶算法
        key = f"llm:rate:{model_id}"
        # 每个模型 provider 有不同的 QPS 限制
        allowed = await self.redis.eval(TOKEN_BUCKET_SCRIPT, 1, key, 
                                         max_tokens, refill_rate, now)
        if not allowed:
            await asyncio.sleep(0.1)  # 等待重试
            return await self.acquire(model_id)
```

#### 3d. 延迟创建优化（已实现，需要适配）

Phase 1 已实现的延迟创建在分布式架构中需要适配：
- 待创建参数组合存 Redis（而非 DB 的 JSON 字段）
- Worker 完成任务后通过 Redis 通知 "需要创建新任务"
- 专门的 "Task Creator" 角色消费创建请求

---

## 四、技术选型

| 组件 | 选型 | 原因 |
|------|------|------|
| **任务队列** | Redis Streams | 已有 redis 依赖，Streams 支持消费者组、ACK、持久化 |
| **异步 HTTP** | httpx | 支持 async，兼容 OpenAI SDK |
| **异步 DB** | SQLAlchemy 2.0 + asyncmy | 最小改动，复用 ORM 模型 |
| **Worker 框架** | 自研 asyncio Worker | 比 Celery 轻量，完全控制并发策略 |
| **监控** | Prometheus + Grafana | 监控并发数、队列深度、LLM 延迟 |
| **连接池代理** | ProxySQL | MySQL 专用，成熟稳定 |

**为什么不用 Celery？**
- Celery 默认 1 task = 1 进程/线程，5000 并发同样需要 5000 worker
- Celery 的 `gevent` pool 与项目中的 `asyncio` 不兼容
- 自研 asyncio worker 更贴合现有代码结构

---

## 五、实施优先级和时间估算

| Phase | 并发目标 | 核心改动 | 工作量 | 依赖 |
|-------|---------|---------|--------|------|
| **Phase 1** | 500 | 异步化 model_client + executor | 2-3 周 | 无 |
| **Phase 2** | 2000 | Redis 队列 + Worker 分离 + 缓存 | 3-4 周 | Phase 1 |
| **Phase 3** | 5000+ | 多机部署 + 读写分离 + 限流 | 2-3 周 | Phase 2 |

**总计：7-10 周**

---

## 六、Phase 1 详细改造清单

作为第一步，以下是需要改造的文件和方法：

### 6.1 核心改造（必须）

```
app/services/conversation/model_client.py
  └── call_model() → async call_model()
  └── call_model_stream() → async call_model_stream()
  └── 底层 HTTP 改为 httpx.AsyncClient

app/services/conversation_service.py
  └── _process_single_agent_response() → async
  └── 内部 DB 操作用 asyncio.to_thread() 包装

app/services/scheduler/executor.py
  └── _call_service() 移除 asyncio.to_thread() 包装
  └── 直接 await 异步版 ConversationService

app/services/experiment_executor.py
  └── ThreadPoolExecutor → asyncio event loop
  └── _dispatch() → async _dispatch()
  └── Semaphore 控制并发
```

### 6.2 辅助改造（提升效果）

```
app/services/message_service.py
  └── create_message() 用 asyncio.to_thread() 包装

app/services/scheduler/scheduler.py
  └── _persist_state() 中 DB 操作已是 sync，保持不变
  └── 确保所有 app_context 块有 session.remove()（已修复）

config.py
  └── 连接池参数根据部署模式动态调整
```

### 6.3 不改造（保持原样）

```
app/api/routes/*           → 保持同步（Gunicorn gthread 处理）
app/models.py              → ORM 模型定义不变
app/services/scheduler/scheduler.py → 核心调度逻辑已是 async，不变
```

---

## 七、风险和应对

| 风险 | 影响 | 应对 |
|------|------|------|
| LLM API 限流 | 5000 QPS 超过大多数提供商限制 | 多模型/多 Key 分流 + 队列缓冲 |
| 异步改造回归 | 可能引入新 bug | 渐进式改造，先改 experiment 路径 |
| Redis 单点故障 | 任务丢失 | Redis Sentinel / Cluster |
| MySQL 写入瓶颈 | 消息表增长快 | 分区 + 归档策略 |
| 内存泄漏 | 协程/连接未释放 | 监控 + 定期 GC |
