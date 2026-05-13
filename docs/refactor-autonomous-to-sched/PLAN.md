# 自主任务重构计划：统一调度系统（KISS版）

## 1. 现状问题

现有 5 个独立模块，共 185K 代码，大量重复：
- `auto_conversation.py` / `variable_stop_conversation.py` / `time_trigger_conversation.py` 等
- 每个模块都有独立的全局字典、启动/停止函数、流式处理
- 新增类型需复制大量代码

---

## 2. 设计原则

1. **配置优于继承** - 用配置字典区分任务类型，而非创建多个类
2. **扁平结构** - 最多2层抽象，避免深层继承
3. **一套代码处理所有情况** - 差异通过参数控制

---

## 3. 目标架构

### 3.1 三层架构：调度 → Agent编排 → 流

```
┌─────────────────────────────────────────────────────────────────┐
│                   TaskScheduler（任务调度层）                      │
│  职责：Task间的调度、依赖、触发时机                                 │
│  管理：多个Task的生命周期                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 调度
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Task（Agent编排层）                          │
│  职责：单个任务内多个Agent的执行编排                                │
│  - execution_mode: sequential | parallel                        │
│  - 控制Agent执行顺序、轮次、停止条件                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 调用（每个Agent）
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        流层（Stream Layer）                       │
│  职责：单个Agent响应的流式输出、SSE推送                             │
│  组件：现有的 streaming 机制（保持不变）                            │
└─────────────────────────────────────────────────────────────────┘
```

**层次职责**：
| 层 | 管理对象 | 职责 |
|---|---------|------|
| TaskScheduler | Task[] | 任务间依赖、触发时机、暂停/恢复 |
| Task | Agent[] | Agent执行顺序、轮次、停止条件 |
| Stream | 单个Agent | 流式输出、取消流 |

**分离原则**：
- TaskScheduler 不关心 Agent 细节，只调度 Task
- Task 不关心流的细节，只编排 Agent 执行顺序
- 流层保持不变，被 Task 调用

### 3.2 核心组件

```
┌─────────────────────────────────────────┐
│         TaskScheduler（调度器）           │
│  - 统一管理所有任务生命周期                 │
│  - 单例模式，维护 _tasks 字典              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│              Task（任务）                 │
│  - trigger_type + trigger_config        │
│  - execution_mode + execution_config    │
│  - 一个类覆盖所有任务类型                  │
└─────────────────────────────────────────┘
```

### 目录结构（4个文件）

```
backend/app/services/scheduler/
├── __init__.py
├── scheduler.py    # TaskScheduler + Task 定义
├── executor.py     # 核心执行逻辑（从现有代码提取）
└── triggers.py     # 触发条件判断函数
```

---

## 4. 核心设计

### 4.1 Task（配置驱动，非继承）

```python
class TaskState(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    STOPPED = "stopped"
    FAILED = "failed"

@dataclass
class Task:
    id: str
    action_task_id: str
    conversation_id: str
    state: TaskState = TaskState.PENDING
    
    # 触发配置（替代 Trigger 类继承）
    trigger_type: str = "manual"  # manual | time | variable
    trigger_config: dict = None   # {"interval": 60} 或 {"variable": "x", "condition": ">5"}
    
    # 执行配置（替代 Executor 类继承）
    execution_mode: str = "sequential"  # sequential | parallel | loop
    execution_config: dict = None       # {"max_rounds": 10, "stop_condition": "..."}
    
    # 编排支持
    depends_on: List[str] = None  # 依赖的任务ID列表
    
    # 健壮性配置
    retry_config: dict = None     # {"max_retries": 3, "backoff": 2.0}
    timeout: int = None           # 超时秒数
    
    # 运行时状态
    cancel_event: asyncio.Event = None
    pause_event: asyncio.Event = None   # 暂停控制
    current_round: int = 0
    error: str = None
```

### 4.2 TaskScheduler（单例调度器）

```python
class TaskScheduler:
    _instance = None
    _tasks: Dict[str, Task] = {}
    _lock: threading.RLock
    
    @classmethod
    def get_instance(cls) -> 'TaskScheduler':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def submit_and_start(self, task: Task) -> str:
        """提交并启动任务"""
        self._tasks[task.id] = task
        asyncio.create_task(self._run_task(task))
        return task.id
    
    async def stop(self, task_id: str) -> bool:
        """停止任务"""
        task = self._tasks.get(task_id)
        if task and task.cancel_event:
            task.cancel_event.set()
            # 同时取消正在进行的流（任务和流分离，但停止时联动）
            await cancel_task_stream(task)
            return True
        return False
    
    async def pause(self, task_id: str) -> bool:
        """暂停任务"""
        task = self._tasks.get(task_id)
        if task and task.state == TaskState.RUNNING:
            task.pause_event.clear()  # 阻塞等待
            task.state = TaskState.PAUSED
            return True
        return False
    
    async def resume(self, task_id: str) -> bool:
        """恢复任务"""
        task = self._tasks.get(task_id)
        if task and task.state == TaskState.PAUSED:
            task.pause_event.set()  # 解除阻塞
            task.state = TaskState.RUNNING
            return True
        return False
    
    async def _run_task(self, task: Task):
        """核心执行循环 - 一套代码处理所有类型"""
        # 初始化控制事件
        task.cancel_event = asyncio.Event()
        task.pause_event = asyncio.Event()
        task.pause_event.set()  # 默认不暂停
        
        # 等待依赖任务完成
        await self._wait_dependencies(task)
        
        task.state = TaskState.RUNNING
        
        try:
            while not task.cancel_event.is_set():
                # 0. 检查暂停
                await task.pause_event.wait()
                
                # 1. 等待触发条件
                await self._wait_trigger(task)
                if task.cancel_event.is_set():
                    break
                
                # 2. 执行一轮（带重试）
                await self._execute_with_retry(task)
                task.current_round += 1
                
                # 3. 检查停止条件
                if self._should_stop(task):
                    break
                    
            task.state = TaskState.COMPLETED
        except Exception as e:
            task.state = TaskState.FAILED
            task.error = str(e)
    
    async def _wait_dependencies(self, task: Task):
        """等待依赖任务完成"""
        if not task.depends_on:
            return
        while True:
            all_done = all(
                self._tasks.get(dep_id, {}).state == TaskState.COMPLETED
                for dep_id in task.depends_on
            )
            if all_done:
                break
            await asyncio.sleep(0.5)
    
    async def _execute_with_retry(self, task: Task):
        """带重试的执行"""
        cfg = task.retry_config or {}
        max_retries = cfg.get("max_retries", 0)
        backoff = cfg.get("backoff", 2.0)
        
        for attempt in range(max_retries + 1):
            try:
                await execute_round(task)
                return
            except Exception as e:
                if attempt == max_retries:
                    raise
                await asyncio.sleep(backoff ** attempt)
    
    async def _wait_trigger(self, task: Task):
        """根据 trigger_type 等待触发"""
        if task.trigger_type == "manual":
            pass  # 立即执行
        elif task.trigger_type == "time":
            interval = task.trigger_config.get("interval", 60)
            await asyncio.sleep(interval)
        elif task.trigger_type == "variable":
            await wait_for_variable_change(task.trigger_config)
    
    def _should_stop(self, task: Task) -> bool:
        """根据 execution_config 判断是否停止"""
        cfg = task.execution_config or {}
        max_rounds = cfg.get("max_rounds")
        if max_rounds and task.current_round >= max_rounds:
            return True
        # 可扩展：检查 stop_condition 表达式
        return False
```

### 4.3 triggers.py（函数，非类）

```python
async def wait_for_variable_change(config: dict) -> bool:
    """等待变量变化"""
    variable = config.get("variable")
    condition = config.get("condition")
    # 实现变量监听逻辑...
    pass

def check_time_trigger(config: dict) -> bool:
    """检查时间触发条件"""
    # cron 表达式检查等
    pass
```

### 4.4 executor.py（调用现有流层）

```python
async def execute_round(task: Task):
    """
    执行一轮对话
    
    注意：此函数只负责"触发"执行，不管理流的细节
    流式输出由现有的 streaming 机制处理
    """
    mode = task.execution_mode
    
    if mode == "sequential":
        # 顺序执行每个 agent
        for agent in get_agents(task):
            # 调用现有的流式处理函数（不改变）
            await process_agent_response(task, agent)
            
    elif mode == "parallel":
        # 并行执行所有 agent
        agents = get_agents(task)
        await asyncio.gather(*[
            process_agent_response(task, agent) for agent in agents
        ])

async def cancel_task_stream(task: Task):
    """
    取消任务时，同时取消正在进行的流
    复用现有的 cancel_streaming_task
    """
    await cancel_streaming_task(task.action_task_id)
```

---

## 5. 任务类型映射

| 现有类型 | trigger_type | execution_mode | execution_config |
|---------|--------------|----------------|------------------|
| discussion | manual | sequential | `{"max_rounds": 10}` |
| conditional_stop | manual | loop | `{"stop_condition": "..."}` |
| time_trigger | time | sequential | `{"interval": 60}` |
| variable_trigger | variable | sequential | `{"variable": "x"}` |
| autonomous_scheduling | manual | loop | `{"max_rounds": 50}` |

---

## 6. 现有代码分析（Phase 0 结果）

### 6.1 共同模式（可统一）

| 模式 | 代码 | 说明 |
|------|------|------|
| 全局任务字典 | `_active_*_tasks = {}` | 5个模块各自维护 |
| 任务键 | `task_key = str(task_id)` | 统一使用task_id |
| 启动/停止 | `start_*/stop_*` | 相同的生命周期管理 |
| 流式队列 | `result_queue` | 统一的SSE输出机制 |
| 上下文处理 | `handle_app_context_execution` | 已提取到utils |
| 任务注册 | `_active_*_tasks[task_key] = {...}` | 相同的注册模式 |

### 6.2 差异点分析

| 模块 | 触发方式 | 循环控制 | Agent顺序 | 特殊功能 |
|------|----------|----------|-----------|----------|
| auto_conversation | 手动 | 固定轮数 | 顺序 | summarize, planning |
| variable_stop | 手动 | 变量停止条件 | 顺序 | 条件表达式评估 |
| time_trigger | 定时器 | 定时器+次数限制 | 顺序 | threading.Timer |
| autonomous_scheduling | 手动 | nextAgent变量 | **动态决定** | 变量监控nextAgent |
| variable_trigger | 变量变化 | 变量触发条件 | 顺序 | 触发条件监控 |

### 6.3 配置化映射

```python
# auto_conversation → 
Task(trigger_type="manual", execution_mode="sequential",
     execution_config={"max_rounds": 10, "summarize": True, "enable_planning": False})

# variable_stop →
Task(trigger_type="manual", execution_mode="loop",
     execution_config={"stop_conditions": [...], "condition_logic": "and"})

# time_trigger →
Task(trigger_type="time", trigger_config={"interval_minutes": 5},
     execution_mode="sequential", execution_config={"max_executions": 10})

# autonomous_scheduling →
Task(trigger_type="manual", execution_mode="dynamic",  # 新增：动态Agent选择
     execution_config={"next_agent_variable": "nextAgent", "max_rounds": 50})

# variable_trigger →
Task(trigger_type="variable", trigger_config={"conditions": [...], "logic": "or"},
     execution_mode="sequential", execution_config={"max_triggers": 100})
```

### 6.4 需要新增的execution_mode

| mode | 说明 | 来源 |
|------|------|------|
| sequential | 顺序执行所有Agent | auto/variable_stop/time/variable_trigger |
| dynamic | 根据变量动态选择下一个Agent | autonomous_scheduling |
| parallel | 并行执行所有Agent | 未来扩展 |

### 6.5 不可配置化的特殊逻辑（需保留）

1. **`autonomous_scheduling` 的 nextAgent 变量监控**
   - 需要在 `triggers.py` 中实现 `wait_for_next_agent_variable()`

2. **`variable_stop/variable_trigger` 的条件评估**
   - 需要实现 `evaluate_condition()` 函数

3. **`time_trigger` 的定时器机制**
   - 需要用 `asyncio.sleep()` 替代 `threading.Timer`

### 6.6 结论

✅ **配置化方案可行**，所有5种类型都可以用 `trigger_type + execution_mode + config` 表达
⚠️ **需新增 `dynamic` 模式** 支持 autonomous_scheduling 的动态Agent选择
⚠️ **需实现3个辅助函数**：条件评估、变量监控、nextAgent监控

---

## 7. 实施计划

### Phase 1：核心框架（2天）✅ 已完成
1. ✅ 创建 `scheduler/` 目录和 5 个文件
2. ✅ 实现 `Task` dataclass（含 depends_on, retry_config, pause_event, timeout）
3. ✅ 实现 `TaskScheduler` 核心（submit, stop, pause, resume）
4. ✅ 实现 `_run_task` 循环（依赖等待、暂停检查、重试、超时）
5. ✅ **P0**：循环依赖检测 + asyncio.Lock 并发安全

### Phase 2：执行逻辑迁移（2天）✅ 已完成
1. ✅ 实现 `execute_round` 调用 `ConversationService._process_single_agent_response`
2. ✅ 集成现有的 `cancel_streaming_task` 取消机制
3. ✅ 实现 `triggers.py` 中的等待函数（time/variable）
4. ✅ **P1**：状态持久化（复用 AutonomousTask 表）

### Phase 3：API 适配（2天）✅ 已完成
1. ✅ 创建 `task_adapter.py` 适配器层
2. ✅ 保持 REST API 接口不变
3. ✅ 添加暂停/恢复 API（autonomous.py）
4. ✅ 添加 `recover_from_db` 启动恢复
5. ✅ 添加 `get_task_status` 状态查询API

### Phase 4：清理和测试（1天）🔄 待进行
1. 可选：删除旧模块（建议保留一段时间作为fallback）
2. 单元测试 + 集成测试

**总计：7.5天**

---

## 7.1 已创建文件

```
backend/app/services/scheduler/
├── __init__.py        # 模块导出 (1KB)
├── scheduler.py       # TaskScheduler + Task (18KB)
├── executor.py        # 执行逻辑 (8KB)
├── triggers.py        # 触发函数 (9KB)
└── task_adapter.py    # API适配器 (13KB)

总计: ~49KB
```

## 7.2 新增API端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `.../autonomous-tasks/{id}/pause` | POST | 暂停任务 |
| `.../autonomous-tasks/{id}/resume` | POST | 恢复任务 |
| `.../autonomous-tasks/{id}/status` | GET | 获取实时状态 |

---

## 8. 能力对比

| 能力 | 现状(5模块) | KISS+增强版 |
|------|-------------|-------------|
| 任务扩展 | ❌ 复制代码 | ✅ 添加配置 |
| 暂停/恢复 | ❌ 无 | ✅ pause_event |
| 任务编排 | ❌ 无 | ✅ depends_on |
| 失败重试 | ❌ 无 | ✅ retry_config |
| 并行实验室 | ❌ 独立实现 | ✅ 复用框架 |

### 架构对比

| 维度 | 原方案 | KISS+增强版 |
|------|--------|-------------|
| 类数量 | 9+ 个类 | 2 个类 |
| 文件数 | 15+ 个文件 | 4 个文件 |
| 抽象层数 | 4 层 | 2 层 |
| 工期 | 12 天 | 7 天 |
| 扩展方式 | 新增类 | 新增配置项 |

---

## 9. 应用场景

### 8.1 自主任务（现有5种类型）

```python
# discussion 模式
Task(trigger_type="manual", execution_mode="sequential", 
     execution_config={"max_rounds": 10})

# time_trigger 模式  
Task(trigger_type="time", trigger_config={"interval": 60},
     execution_mode="sequential")
```

### 8.2 并行实验室

```python
# 多个实验并行执行
experiment_tasks = [
    Task(id="exp_1", execution_mode="sequential", ...),
    Task(id="exp_2", execution_mode="sequential", ...),
    Task(id="exp_3", execution_mode="sequential", ...),
]

# 汇总任务等待所有实验完成
summary_task = Task(
    id="summary",
    depends_on=["exp_1", "exp_2", "exp_3"],  # 依赖所有实验
    execution_mode="sequential",
    execution_config={"max_rounds": 1}
)

# 提交所有任务
scheduler = TaskScheduler.get_instance()
for task in experiment_tasks + [summary_task]:
    await scheduler.submit_and_start(task)
```

### 8.3 任务编排示例

```
研究 → 分析 → 撰写 → 审核
  ↘         ↗
   数据收集
```

```python
tasks = [
    Task(id="research", ...),
    Task(id="data", ...),
    Task(id="analyze", depends_on=["research", "data"], ...),
    Task(id="write", depends_on=["analyze"], ...),
    Task(id="review", depends_on=["write"], ...),
]
```

### 8.4 扩展新类型

新增任务类型只需添加配置，无需新类：

```python
# 新增 "event" 触发类型
task = Task(
    trigger_type="event",
    trigger_config={"event": "user_login", "filter": "vip_only"},
    execution_mode="sequential",
    execution_config={"max_rounds": 1}
)

# 在 _wait_trigger 中添加一个 elif 分支即可
```

---

## 10. 风险与解决方案

### 9.1 P0：循环依赖检测

```python
def _check_circular_dependency(self, task: Task) -> bool:
    """提交时检测循环依赖"""
    visited, path = set(), set()
    
    def dfs(task_id):
        if task_id in path:
            return True  # 发现环
        if task_id in visited:
            return False
        visited.add(task_id)
        path.add(task_id)
        t = self._tasks.get(task_id)
        if t and t.depends_on:
            for dep_id in t.depends_on:
                if dfs(dep_id):
                    return True
        path.remove(task_id)
        return False
    
    return dfs(task.id)

async def submit_and_start(self, task: Task) -> str:
    if self._check_circular_dependency(task):
        raise ValueError(f"Circular dependency detected for task {task.id}")
    # ... 继续提交
```

### 9.2 P0：并发安全

```python
class TaskScheduler:
    _lock: asyncio.Lock = None
    
    def __init__(self):
        self._lock = asyncio.Lock()
    
    async def submit_and_start(self, task: Task) -> str:
        async with self._lock:
            self._tasks[task.id] = task
        asyncio.create_task(self._run_task(task))
        return task.id
    
    async def stop(self, task_id: str) -> bool:
        async with self._lock:
            task = self._tasks.get(task_id)
        # ...
```

### 9.3 P1：超时控制

```python
async def _run_task(self, task: Task):
    # ... 初始化 ...
    try:
        while not task.cancel_event.is_set():
            await task.pause_event.wait()
            await self._wait_trigger(task)
            
            # 带超时执行
            if task.timeout:
                await asyncio.wait_for(
                    self._execute_with_retry(task),
                    timeout=task.timeout
                )
            else:
                await self._execute_with_retry(task)
            
            task.current_round += 1
            if self._should_stop(task):
                break
    except asyncio.TimeoutError:
        task.state = TaskState.FAILED
        task.error = "Task timeout"
```

### 9.4 P1：状态持久化（复用现有表）

```python
async def _persist_state(self, task: Task):
    """同步状态到 AutonomousTask 表"""
    await db.execute(
        "UPDATE autonomous_tasks SET status=?, current_round=? WHERE id=?",
        [task.state.value, task.current_round, task.action_task_id]
    )

async def _run_task(self, task: Task):
    # 每轮结束后持久化
    while not task.cancel_event.is_set():
        # ... 执行 ...
        task.current_round += 1
        await self._persist_state(task)  # 持久化

async def recover_from_db(self):
    """启动时恢复未完成任务"""
    rows = await db.fetch("SELECT * FROM autonomous_tasks WHERE status='running'")
    for row in rows:
        task = self._row_to_task(row)
        await self.submit_and_start(task)
```

### 9.5 P2：暂停延迟（文档说明）

> **注意**：暂停操作在当前执行轮次完成后生效，不会中断正在进行的 agent 响应。

---

## 11. 成功指标

1. **代码量减少 70%+**（185K → <50K）
2. **新增任务类型：添加配置 + 几行代码**
3. **所有现有功能正常工作**
4. **可读性：新人30分钟内理解整体架构**
5. **并行实验室可直接复用此框架**
6. **支持任务暂停/恢复和编排依赖**
