# Heartbeat 策略详解 & 编写指南

> 配套主文档: [`PLAN.md`](./PLAN.md)
>
> 这份文档面向**两类读者**:
> 1. 想知道每种内置策略做什么 / 怎么配的用户。
> 2. 想新增一种策略的开发者。

---

## 1. 策略契约 (HeartbeatPolicy)

```python
# app/services/heartbeat/policies/base.py
from typing import Protocol
from dataclasses import dataclass
from datetime import datetime

@dataclass
class HeartbeatContext:
    agent_id: int
    action_space_id: int
    last_tick_at: datetime | None
    meta: dict        # = Agent.heartbeat_meta
    # 注:不直接传 SQLAlchemy session,策略内部用 async with get_session()
    #     避免长事务跨 LLM 调用

@dataclass
class HeartbeatOutcome:
    outcome: str           # 见 PLAN.md §3.2 outcome 枚举
    output_summary: str | None
    meta: dict             # 详细 trace (tool calls / tokens / 错误)

class HeartbeatPolicy(Protocol):
    name: str

    async def execute(self, ctx: HeartbeatContext) -> HeartbeatOutcome: ...
```

**契约硬约束**(违反就是 Bug):

1. **必须 async**:策略里禁止阻塞 IO。
2. **必须有限**:单次 `execute` 最大耗时 `meta.timeout_seconds`(默认 30s);超时由
   `PolicyExecutor` 用 `asyncio.wait_for` 强制中断,outcome 记 `error: timeout`。
3. **不准 spawn 新 tick**:策略内**不允许**改自己的 `next_tick_at` 立即再跳。
4. **不准把 SSE emit 句柄存到对象上**:每次 `execute` 通过 ctx 拿,跑完即丢。
5. **必须幂等容错**:策略要假定可能被同一 tick 调两次(网络重试场景),outcome
   不能造成副作用倍增——内部要么用 advisory lock 要么用 idempotency key。

---

## 2. 内置策略

### 2.1 `noop`

**做什么**: 只更新 `last_tick_at`,不调 LLM,不产生消息。

**用途**:
- "我还活着"健康检查信号。
- 调试 / 压力测试 TickClock。
- 给一个 agent 启用心跳但暂时不想让它做事(等等,这就是 `paused`)。

**meta 参数**: 无。

**典型 outcome**: `noop`。

---

### 2.2 `reflect`

**做什么**: 把过去 N 分钟内该 agent 经历过的对话 / 工具结果 / 自己的发言做一次
LLM 总结,落地为一条 reflection 记录(写入 MemoryPalace 的 Drawer 层
或 `ConversationPlan` 的 reflection 字段)。

**meta 参数**:

```jsonc
{
  "window_minutes": 30,       // 总结过去多少分钟的内容
  "max_tokens": 800,          // reflection 最大 token
  "min_events_required": 3,   // 少于这个事件数则跳过(outcome=noop)
  "memory_layer": "drawer"    // drawer | plan | both
}
```

**典型 outcome**: `reflected`(写了)或 `noop`(没东西好总结)。

**风险点**:
- 如果 N 太大,token 爆炸。Phase 2 默认 30 分钟 + max_tokens=800 是经验值。
- reflection 不应该写回主对话流,会污染上下文——只进记忆层。

---

### 2.3 `plan_progress`

**做什么**: 检查该 agent 关联的 `ConversationPlan`,若有未完成 item:

1. 取最高优先级一个未完成 item。
2. 让 agent 用一次 LLM 调用判断:是否要现在推进它?
3. 如要推进 → 调对应工具 / 产生消息 → 标记 item `in_progress / done`。
4. 如不要 → 写一条 reasoning 到 `meta`,outcome=`noop`。

**meta 参数**:

```jsonc
{
  "max_items_per_tick": 1,    // 单 tick 最多推进几项(硬上限,防失控)
  "allow_status_change": true // 是否允许 agent 修改 item 状态
}
```

**典型 outcome**: `planned` / `noop`。

**这条策略**很可能直接根治 TODO.md#BUG 里"自主任务停不下来"的问题——
因为 heartbeat 是天然有边界的(空间关就停),不像现在自主任务靠 Redis 队列。

---

### 2.4 `speak_if_due`

**做什么**: 检查该 agent 距上次说话的间隔,以及一组"触发条件",
满足则生成一条新的对话消息发到行动空间。

**meta 参数**:

```jsonc
{
  "min_silence_minutes": 10,        // 距上次说话至少 N 分钟才考虑说话
  "max_messages_per_hour": 4,       // 硬上限,防刷屏
  "trigger_conditions": [           // 任一满足即触发
    "user_idle_minutes >= 5",
    "new_environment_variable",
    "plan_has_pending_item"
  ],
  "tone": "casual"                  // 注入到 prompt 的风格提示
}
```

**典型 outcome**: `spoke` / `noop`。

**风险点**:
- 多 agent 同时 speak → 输出交错。Phase 1 内置 per-space 串行锁
  (一个空间同时只允许一个 `speak_if_due` 在跑),Phase 4 跨进程时换分布式锁。
- "min_silence_minutes" 是用户体验下限,UI 上要让用户能直接看到 / 改。

---

### 2.5 `poll`

**做什么**: 调用一个指定的 MCP 工具,把结果塞回上下文(写记忆或 `last_poll_result`
环境变量)。典型用法:轮询邮件、Issue tracker、外部 webhook 状态。

**meta 参数**:

```jsonc
{
  "tool_name": "gmail.list_unread",
  "tool_args": {"max_results": 10},
  "on_new_data": "speak"     // speak | reflect | env_var
}
```

**典型 outcome**: `polled`(meta 里带工具结果摘要)。

**风险点**:
- MCP 工具可能慢 / 失败 → 必须 `asyncio.wait_for` + 重试不超过 1 次。
- `on_new_data=speak` 会触发对话消息,需要复用 `speak_if_due` 的限流逻辑。

---

## 3. 编写新策略的指南

### 3.1 步骤

1. **新建文件** `app/services/heartbeat/policies/<name>.py`。
2. **实现协议**:

   ```python
   from .base import HeartbeatPolicy, HeartbeatContext, HeartbeatOutcome

   class MyPolicy:
       name = "my_policy"

       async def execute(self, ctx: HeartbeatContext) -> HeartbeatOutcome:
           # 在这里写你的逻辑
           return HeartbeatOutcome(outcome="noop", output_summary=None, meta={})
   ```

3. **注册** 到 `policies/__init__.py` 的 registry。
4. **写单测** `tests/services/heartbeat/test_policy_<name>.py`,
   至少包含:
   - 正常路径产出预期 outcome
   - 超时被中断
   - supervisor 拒绝时被跳过
   - 幂等性(同一 tick 调两次结果一致)
5. **如果策略要新加 meta 字段**,在 `policies.md` 这里加一节。

### 3.2 红线 (写错就是 Bug,不是设计选择)

- ❌ 不要 `time.sleep()`。用 `await asyncio.sleep()`。
- ❌ 不要 `requests.get()`。用 `httpx.AsyncClient`。
- ❌ 不要在策略里改 `Agent.heartbeat_*` 字段 —— 那是 `PolicyExecutor` 的职责。
- ❌ 不要把 LLM 调用包成同步函数再 await —— 用 `model_client` 的 async 接口。
- ❌ 不要在策略里直接 emit SSE 消息到 conversation 流 —— 用 `heartbeat.tick`
  SSE 事件,前端会自己处理。

### 3.3 命名约定

- `name` 字段全小写下划线: `reflect`、`speak_if_due`、`plan_progress`。
- 文件名同 `name`。
- meta 字段名也用下划线: `window_minutes`、`max_tokens`。

---

## 4. 策略组合 (Phase 4+)

Phase 1-3 一个 agent 只能选一种策略。Phase 4 可能引入**策略组合**:
agent 同时挂多个策略,按优先级 / 互斥规则跑。届时再扩展契约。

---

_last review: 2026-05-13_
