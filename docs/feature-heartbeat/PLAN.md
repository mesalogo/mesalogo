# Agent Heartbeat — ABM-tick 驱动的"活着"系统

> **状态**: Spec 阶段(2026-05-13)
> **范围**: backend-fastapi + frontend + alembic migration + docs/agents
> **owner**: TBD
> **依赖**: 现有 `app/services/scheduler/`、`supervisor_rule_checker`、`models.Agent` / `ActionSpace`
> **关联功能**: MemoryPalace v0.51(产物落地)、Workflow Graph(互补,不替代)、5000 并发(共享 worker 池演进路径)

---

## 0. TL;DR

给每个 **Agent** 一个**可配置周期的心跳**,心跳触发 agent 跑一次
`observe → reflect/plan → (maybe) act` 的内在循环,
让 agent 在**没人和它聊天时也能自发地推进自己的世界**——
产生计划、整理记忆、自发说话、检查环境变量、调用工具。

骨架 = ABM tick(Mesa / NetLogo 的 `step()` 风格);
肉 = Generative-Agent 的"内在生命"(observe / reflect / plan / act);
容器 = **ActionSpace**(空间关 → 心跳停)。

---

## 1. 动机

### 1.1 当前系统的盲点

| 现状 | 问题 |
|---|---|
| Agent 是纯 reactive 的:等用户/上游消息才动 | 没人说话 = 完全沉默,无法做 ABM 仿真 |
| `scheduler/triggers.py` 有 `wait_for_time_trigger`,但是一次性的 | 不是"心跳",是"闹钟",到点跑一次就完了 |
| `AutonomousTask` 有自主推进能力,但耦合在对话流里 | 历史 BUG"自主任务停不下来"就是因为没有清晰的生命周期边界 |
| ABM 实验(Mesa/NetLogo 桥)缺乏统一的 tick 抽象 | 每个 agent 自己定时跑,容易乱序、调试困难 |

### 1.2 我们想要的

- **agent 默认是"活着"的**:即使无人对话,也按自己的节拍呼吸。
- **空间是边界**:`ActionSpace` 打开 = 世界存在;关闭 = 该空间所有 agent 心跳停。
- **节拍可配置**:每个 agent 自己决定多久跳一次(秒 / 分钟 / cron)。
- **行为可插拔**:tick 时具体做什么是策略(reflect / plan_progress / poll / speak_if_due / noop)。

### 1.3 灵感来源

- **Mesa** `model.step()` — 每 tick 所有 agent 各 step 一次。
- **NetLogo** `tick` — 全局时钟前进,`every N ticks` 钩子触发行为。
- **Generative Agents (Park et al. 2023)** — 斯坦福小镇每个 agent 有 inner clock,
  定时 reflect / plan / observe / move。
- **Game AI** Unity/Unreal 的 `Update()` — 每帧调一次。
- **Operator / computer-use agent** — 固定间隔截屏 → 看 → 操作 → 等。

---

## 2. 概念模型

```
                 ┌────────────────────────────────────────────┐
                 │           ActionSpace (= 世界)              │
                 │   生命周期: opened ↔ closed                 │
                 │                                            │
                 │   ┌─────────────┐   ┌─────────────┐        │
                 │   │  Agent A    │   │  Agent B    │   ...  │
                 │   │ heartbeat:  │   │ heartbeat:  │        │
                 │   │  on, 30s    │   │  on, cron   │        │
                 │   │  policy:    │   │  policy:    │        │
                 │   │  reflect    │   │  poll       │        │
                 │   └─────────────┘   └─────────────┘        │
                 └────────────────────────────────────────────┘
```

- **每个 Agent 一个心跳**(混合可配置)。
- **ActionSpace 是边界**:空间关 → 该空间内所有 agent 心跳停。
- **每次心跳 = 一次 `tick(agent)`**。tick 是 ABM 语义(原子推进),
  tick 内 agent 用 LLM 做"内在生命"的事。
- **心跳不会 spawn 新 tick**:tick 内**不允许**改自己的 `next_tick_at` 立即再跳一次,
  避免无限循环(参考 TODO #BUG"自主任务停不下来")。

---

## 3. 数据模型

### 3.1 `Agent` 表新增字段

```python
# backend-fastapi/app/models.py — class Agent
heartbeat_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
heartbeat_interval_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
heartbeat_cron: Mapped[str | None] = mapped_column(String(128), nullable=True)
heartbeat_policy: Mapped[str] = mapped_column(String(32), default='noop', nullable=False)
heartbeat_last_tick_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
heartbeat_next_tick_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
heartbeat_state: Mapped[str] = mapped_column(String(16), default='idle', nullable=False)
heartbeat_meta: Mapped[dict] = mapped_column(JSON, default=dict)
```

`heartbeat_state` 枚举: `idle | running | paused | error`。

`heartbeat_interval_seconds` 与 `heartbeat_cron` **互斥**——优先 cron,
若两者都空且 `heartbeat_enabled=True` 则报配置错并 `state='error'`。

### 3.2 新表 `AgentHeartbeatEvent`(审计 / 可视化)

```python
class AgentHeartbeatEvent(BaseMixin, db.Model):
    __tablename__ = 'agent_heartbeat_events'

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey('agents.id', ondelete='CASCADE'), index=True)
    action_space_id: Mapped[int] = mapped_column(ForeignKey('action_spaces.id', ondelete='CASCADE'), index=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    policy: Mapped[str] = mapped_column(String(32))
    outcome: Mapped[str] = mapped_column(String(32))
    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
```

`outcome` 枚举:

- `noop` — 没产生副作用
- `spoke` — 产生了一条对话消息
- `planned` — 推进了一项 `ConversationPlanItem`
- `reflected` — 写了一条 reflection 到记忆
- `polled` — 调用了 MCP 工具,有 / 无新结果
- `supervisor_blocked` — 被 supervisor 拒绝
- `overlap_skip` — 上一次 tick 还在跑,本次跳过
- `error` — 异常,见 `meta.error`

### 3.3 ActionSpace 表(暂不改)

Phase 1 不在 ActionSpace 上加全局 tick——保持简单。
如果未来要做 Mesa 风格"全局节拍"(所有 agent 必须在同一 tick 边界推进),
再加 `tick_interval_seconds` 与 `current_tick` 字段不迟。

---

## 4. 心跳策略 (HeartbeatPolicy)

每个 agent 在 `heartbeat_policy` 字段选**一种**策略。策略实现是可插拔类:

```python
# app/services/heartbeat/policies/base.py
class HeartbeatPolicy(Protocol):
    name: str

    async def execute(
        self,
        ctx: HeartbeatContext,  # agent + action_space + last_tick_at + meta
    ) -> HeartbeatOutcome:
        ...
```

Phase 1-2 内置 5 种:

| Policy | 描述 | 默认 meta 参数 |
|---|---|---|
| `noop` | 只更新 `last_tick_at`,不调 LLM。用作"我还活着"信号或调试 | — |
| `reflect` | 把过去 N 分钟内的对话 / 工具结果做总结 → 写一条 reflection 进记忆 | `window_minutes=30` |
| `plan_progress` | 若有未完成 `ConversationPlan` → 决定要不要推进一项 | `max_items_per_tick=1` |
| `speak_if_due` | 检查"距上次说话" + 触发条件 → 可能产生一条新消息 | `min_silence_minutes=10` |
| `poll` | 调用指定 MCP 工具,把结果塞回上下文 | `tool_name`, `args` |

详细策略契约见 [`policies.md`](./policies.md)。

---

## 5. 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                  HeartbeatService (singleton)                │
│                                                              │
│   ┌────────────────────┐    ┌──────────────────────────┐    │
│   │ TickClock          │───▶│ AgentRegistry            │    │
│   │ asyncio loop       │    │ (空间→agents→next_tick) │    │
│   │ tick 粒度 = 1s     │    └──────────────────────────┘    │
│   └────────────────────┘              │                     │
│             │                         ▼                     │
│             │              ┌──────────────────────┐         │
│             │              │ DispatchQueue        │         │
│             │              │ (asyncio Queue)      │         │
│             │              └──────────────────────┘         │
│             │                         │                     │
│             ▼                         ▼                     │
│   ┌────────────────────┐    ┌──────────────────────┐        │
│   │ Space lifecycle    │    │ HeartbeatWorker × N  │        │
│   │ hook (open/close)  │    │ asyncio.gather       │        │
│   └────────────────────┘    │ 调用 PolicyExecutor  │        │
│                             └──────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

### 5.1 组件职责

| 组件 | 职责 |
|---|---|
| `HeartbeatService` | 单例。`lifespan` 启动 / 停止。对外 API: `register_agent`、`deregister_agent`、`deregister_space`、`tick_now(agent_id)`。 |
| `TickClock` | 单个 `asyncio.Task`,1s 一拍。每秒扫 Registry,把 `next_tick_at ≤ now()` 的 agent 入队。 |
| `AgentRegistry` | 内存中维护 `{action_space_id: {agent_id: HeartbeatState}}`。启动时从 DB 加载所有 `heartbeat_enabled=True` 的 agent;接 ActionSpace open/close 钩子增删。 |
| `DispatchQueue` | `asyncio.Queue`。Phase 1 单进程足够;Phase 2 可换 Redis Stream 跨进程。 |
| `HeartbeatWorker` | `N = settings.HEARTBEAT_WORKERS`(默认 8)个 worker,从队列取任务 → 调 `PolicyExecutor.execute`。 |
| `PolicyExecutor` | 解析 `heartbeat_policy` → 加载策略类 → `await policy.execute(ctx)` → 写 `AgentHeartbeatEvent` → 更新 `last_tick_at` / `next_tick_at`。 |

### 5.2 关键决策

1. **不阻塞请求循环**: HeartbeatService 在 `main.py` 的 `lifespan` 启动,独立后台任务,**绝不**在 request handler 里跑心跳。
2. **不并发自己心跳**: agent 上次 tick 还在跑时,这次 tick 跳过 + 记 `outcome='overlap_skip'`,避免堆积。
3. **关空间 = 立刻停**: `ActionSpace.close()` 同步调 `HeartbeatService.deregister_space(id)`,瞬时剔除该空间所有 agent 的 next_tick。已 dispatch 但还没跑完的允许跑完(原子)。
4. **每 agent 限流**: 单 agent 1 tick 最多消耗 `meta.max_llm_calls_per_tick`(默认 1)次 LLM,防失控。
5. **Supervisor 集成**: 每次 tick 前先过 `supervisor_rule_checker`,如果 supervisor 拒绝则记 `outcome='supervisor_blocked'` 并跳过策略执行。
6. **永远 async**: PolicyExecutor 里如果策略要调阻塞 IO,必须用 `asyncio.to_thread`,遵守 AGENTS.md §3.2 红线。

### 5.3 next_tick_at 计算

```python
# 简单周期
next_tick_at = now() + timedelta(seconds=heartbeat_interval_seconds)

# cron
next_tick_at = croniter(heartbeat_cron, now()).get_next(datetime)
```

策略执行完毕后**写库再排下次 tick**——不在内存里推算,
避免单点崩溃后 schedule 漂移。

---

## 6. 文件改动

```
backend-fastapi/
├── migrations/versions/
│   └── XXXX_add_agent_heartbeat.py                    新建迁移
├── app/
│   ├── models.py                                      Agent 加字段 + 新 AgentHeartbeatEvent
│   ├── services/
│   │   └── heartbeat/
│   │       ├── __init__.py
│   │       ├── service.py                             HeartbeatService 单例 + lifespan 钩子
│   │       ├── clock.py                               TickClock
│   │       ├── registry.py                            AgentRegistry
│   │       ├── worker.py                              HeartbeatWorker
│   │       ├── policies/
│   │       │   ├── __init__.py
│   │       │   ├── base.py                            HeartbeatPolicy 协议
│   │       │   ├── noop.py                            策略: noop
│   │       │   ├── reflect.py                         策略: reflect
│   │       │   ├── plan_progress.py                   策略: plan_progress
│   │       │   ├── speak_if_due.py                    策略: speak_if_due
│   │       │   └── poll.py                            策略: poll
│   │       └── README.md
│   ├── api/routes/
│   │   └── agent_heartbeat.py                         REST 接口
│   └── main.py                                        lifespan: start/stop HeartbeatService
├── tests/services/heartbeat/
│   ├── test_clock.py
│   ├── test_registry.py
│   ├── test_policy_reflect.py
│   └── test_e2e_space_close_stops_heartbeat.py
└── AGENTS.md                                          backend 加 §heartbeat

frontend/src/
├── pages/actionspace/
│   └── AgentHeartbeatPanel.tsx
└── services/agentHeartbeatApi.ts

docs/
├── feature-heartbeat/
│   ├── PLAN.md                                        本文档
│   ├── policies.md                                    策略详解 + 编写指南
│   └── stop-the-world.md                              安全停机语义
└── agents/
    └── heartbeat-development.md                       AI agent 改这块前必读
```

---

## 7. API 草案

```
GET    /api/agents/{id}/heartbeat                  读当前心跳配置
PUT    /api/agents/{id}/heartbeat                  改配置 (开关 / 周期 / 策略)
POST   /api/agents/{id}/heartbeat/tick             手动触发一次 (调试)
GET    /api/agents/{id}/heartbeat/events?limit=50  审计 / 可视化
GET    /api/action-spaces/{id}/heartbeat           空间概览
POST   /api/action-spaces/{id}/heartbeat/pause     全空间暂停
POST   /api/action-spaces/{id}/heartbeat/resume    恢复
```

新增 SSE 事件类型:

- `heartbeat.tick` — payload: `{agent_id, ts, outcome, output_summary}`
- 前端可用于"agent 头像呼吸感"动画。

---

## 8. 前端最小可见

- Agent 卡片右上角加心跳指示器(脉冲圆点 + tooltip 显示 `next_tick_at` 倒计时)。
- ActionSpace 顶部加全局"心跳概览":多少 agent 在跳 / 上次 tick 距今 / 平均 tick 耗时。
- 点心跳指示器 → 抽屉:开关 / 周期 / 策略 / 最近 20 条 `AgentHeartbeatEvent`。

---

## 9. 失败模式预防

参考 `TODO.md#BUG` 的"自主任务停不下来"翻车,**这次提前画红线**:

1. **关空间必须能立刻停**: `ActionSpace.close()` 触发 `HeartbeatService.deregister_space()` 同步完成,且写 unit test 验证。
2. **心跳不能继承上一次 tick 的 SSE 流**: 每次 tick 用独立 emit context(参考 TODO #7"真正的并行执行")。
3. **永远在 async 上跑**: 策略里如果要调 `requests.get` 这种阻塞 IO,必须 `asyncio.to_thread` 包一层。
4. **限流是硬约束**: 单 agent 单 tick 最多 1 次 LLM 调用(可配),否则 5000 并发演进时会失控。
5. **写 failure note**: 上线后任何一次"心跳停不下来" / "心跳风暴" 都要在 `docs/agents/failures/` 写一篇复盘。

详细停机语义见 [`stop-the-world.md`](./stop-the-world.md)。

---

## 10. 分阶段交付

| Phase | 范围 | 验收 |
|---|---|---|
| **P1 骨架** | 模型 + 迁移 + HeartbeatService + TickClock + Registry + Worker + `noop` 策略 + lifespan 集成 + 单测 | `noop` 策略能按 5s/agent 跳起来,空间关能立即停 |
| **P2 内在生命** | `reflect` + `plan_progress` + `speak_if_due` 三个核心策略 + Supervisor 集成 + 单 agent 限流 + 事件审计 | agent 在空闲对话中能自发 reflect 出一条记忆 / 推进一项 plan |
| **P3 前端 & API** | REST 接口 + SSE `heartbeat.tick` + Agent 卡片心跳指示 + ActionSpace 心跳概览 + 配置抽屉 | UI 上看得到"agent 在呼吸" |
| **P4 poll & 扩展** | `poll` 策略(MCP 工具集成)+ 自定义策略 plugin 机制 + 跨进程 Dispatch(Redis Stream) | 与 5000 并发 Phase 2 同步演进 |

---

## 11. 与现有功能的关系

| 现有 | 关系 |
|---|---|
| `scheduler/triggers.py` 的 `wait_for_time_trigger` | Heartbeat 取代它(更 ABM 范式);老代码保留至迁移完成 |
| `AutonomousTask` | 不直接冲突;P2 可让 `plan_progress` 策略推进自主任务的下一项,从而**根治"自主任务停不下来"BUG** |
| MemoryPalace v0.51 | 互补:`reflect` 策略产物直接写入 Drawer / KG 层,memory + heartbeat 一起就是"agent 内在生命"完整闭环 |
| Workflow Graph | Heartbeat 不替代显式编排;编排是声明式 DAG,heartbeat 是 agent 自驱动 |
| Supervisor / rule sandbox | 每 tick 前过 supervisor,继承现有安全边界 |
| 5000 并发 | Phase 1 单进程 asyncio 足够;Phase 4 跨进程时换 Redis Stream + worker pool,与 5000 并发 Phase 2 同步演进 |

---

## 12. 开放问题

- 是否要在 `ActionSpace` 上也加一个**全局节拍**(类似 NetLogo `tick`),让所有 agent 在同一 tick 边界推进?——暂定不加,P5 再议。
- 心跳粒度 1s 是否够细?ABM 实时仿真可能要 100ms。——Phase 1 锁 1s,如有需要再调。
- 跨进程心跳调度(Phase 4)是用 Redis Stream 还是直接复用现有任务队列?——等 5000 并发 Phase 2 落地后再决。
- 心跳事件 SSE 流是单独通道还是复用现有 conversation 流?——倾向单独通道,避免污染对话语义。

---

## 13. 参考

- Mitchell, M. (2023). *Mesa Tutorial: Agent-Based Modeling in Python*.
- Park, J. S., et al. (2023). *Generative Agents: Interactive Simulacra of Human Behavior*. UIST.
- Wilensky, U. (1999). *NetLogo*. ccl.northwestern.edu/netlogo.
- 项目内: `docs/feature-mempalace-v0.51/`、`docs/feature-workflow-graph/PLAN.md`、`TODO.md#BUG`。

---

_last review: 2026-05-13(spec 阶段,未实现)_
