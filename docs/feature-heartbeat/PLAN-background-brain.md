# Background Brain — 自适应节拍、持续学习闭环与平台大脑

> **状态**: Spec 阶段(2026-07-25)。**未实现,无代码。**
> **范围**: 本文是 [`PLAN.md`](./PLAN.md) 的扩展提案(Extension Proposal),不替代它。
> **前置**: 必读 [`PLAN.md`](./PLAN.md)、[`policies.md`](./policies.md)、[`stop-the-world.md`](./stop-the-world.md)
> **关联**: `docs/feature-parallellab/PLAN-5000-concurrency.md`、`docs/agents/parallel-execution.md`
> **owner**: TBD

---

## 0. TL;DR

原始 `PLAN.md` 给出的命题是:**每个 Agent 有一个固定周期的心跳**。

本文把这个命题扩展到三个新维度:

1. **自适应节拍 (adaptive cadence / 自适应节拍)** — 心跳频率不是常量,是「系统压力 ×
   用户配置优先级」的函数。高负载时后台降频甚至静默,低负载时补做积压的认知工作。
2. **持续学习闭环 (learning closure / 持续学习闭环)** — 反思(reflection)必须能变成
   **改变未来行为的产物**(skill / rule / 记忆索引),且必须先过**评估门 (evaluation
   gate / 评估门)** 才准生效。只写记忆不改行为的,不叫学习。
3. **平台大脑 (platform brain / 平台大脑)** — 一个 system-scope 的心跳宿主,观测平台
   自身的遥测,产出改进建议。它**只读遥测、只写建议**,不允许直接改配置。

三者的实现顺序是**严格自下而上**的,理由见 §7。

---

## 1. 必须先修正的事实偏差 (Reality Check)

`PLAN.md` 写于 2026-05-13,其中若干假设与当前代码库**不符**。在写任何代码前必须先
纠正,否则会照着不存在的接口实现。以下是 2026-07-25 的实测结论。

| `PLAN.md` 的假设 | 代码库实际情况 | 对本提案的影响 |
|---|---|---|
| `Agent` 有 `action_space_id`,可按空间索引 | ❌ `models.py:651` `class Agent` **没有** `action_space_id`,也没有 `user_id`。必须传递查找:`Agent.action_task_id → ActionTask.action_space_id / ActionTask.user_id`(现成范例见 `app/api/routes/agents.py:180-186`) | Registry 的空间索引需要 JOIN,不能直接读字段。`deregister_space` 的实现比 `stop-the-world.md §3.2` 里写的那段伪代码复杂 |
| 记忆有 "MemoryPalace Drawer 层" 可写 | ❌ 没有 `Memory` 模型,没有分层。只有 `memory_partition_service.py:22` 的 5 种**扁平**分区策略(`by_space` / `global` / `by_task` / `by_role` / `by_agent`),映射到外部 Graphiti 的 `group_id` 字符串。写入靠外部 MCP 工具 `add_memory`,不是 Python 方法 | `reflect` 策略的落点要改写:通过 `memory_partition_service.generate_partition_identifier(strategy, context)` 拿 `group_id`,再走 Graphiti。`policies.md §2.2` 的 `memory_layer: "drawer"` 参数**不存在**,应删 |
| `heartbeat_*` 字段可能已存在 | ❌ 全库 zero hit。唯一的 `heartbeat` 是 `vnc_proxy.py:90` 的 WebSocket keepalive,无关 | 迁移是纯新增,无冲突 |
| Redis 队列可用于跨进程 dispatch(P4) | ⚠️ `app/services/job_queue/` 是**纯 DB + ThreadPoolExecutor**,不是 Redis。`JobManager.submit_job(priority=...)` 的 `priority` **只存进 `job.data['priority']`,从不参与排序**;也没有 dequeue API | P4 的「换 Redis Stream」是从零开始,不是「复用现有队列」 |
| `scheduler/` 提供了周期性抽象 | ⚠️ `triggers.py:44` `wait_for_time_trigger` 是在**单个 Task 协程内 `asyncio.sleep`**,不是 cron 注册表。更严重:`TaskScheduler.set_executor()` 和 `recover_from_db()` **零调用者**,`startup_event()` 完全不碰 `TaskScheduler` | 不能「复用 scheduler」。唯一已接入 lifespan 的周期循环先例是 `conversation/connection_manager.py:267 _cleanup_loop` + `:286 start_periodic_cleanup`,**照它抄** |
| 心跳里可以直接调 LLM 的 async 接口 | ❌ `ModelClient.send_request()` (`conversation/model_client.py:231`) 是**同步**方法。memory / skill / rule 三个 service 也全是同步(`requests` / `subprocess` / `Skill.query`) | 策略里所有这些调用必须 `await asyncio.to_thread(...)` 包一层,否则违反根 AGENTS.md §3.2 |
| 用 `thread_context.g` 传上下文 | ⚠️ `thread_context.py` 是 `threading.local()`,**不是 `contextvars`**。全库 `contextvars` 零使用 | 前台/后台来源标记(§2.3)**不能**用 `g`,`threading.local` 跨 `await` 不保证同一线程。必须引入 `contextvars.ContextVar` |
| 学到的 skill 可以绑给某个 agent | ⚠️ Skill 绑定到 **Role**(`RoleSkill`,`models.py:417`),没有 per-agent 表 | 一个 agent 学到的 skill 会被**该 Role 下所有 agent 共享**。这是重要的语义后果,必须在 UI 上说清(§3.2) |
| — | ⚠️ `RuleTriggerLog.action_task_id` 是 `nullable=False`(`models.py:152`) | 平台大脑在任何 ActionTask 之外评估规则时**无处记日志**。要么给该列放开 nullable(需迁移),要么平台大脑不走 `RuleTriggerLog` |

**行动项(P0,写代码前):** 把上表回填进 `PLAN.md`,并把 `policies.md §2.2` 的
`memory_layer` 参数删掉。带着错误的接口假设实现,是本提案最大的单点风险。

---

## 2. 维度一:自适应节拍 (Adaptive Cadence)

### 2.1 问题

原始设计里 `next_tick_at = now() + interval_seconds`(`PLAN.md §5.3`)。这在
「一个 agent 空转」时没问题,在「500 个 agent 同时有心跳、同时有 30 个用户在对话」时是
灾难:后台认知和前台请求**抢的是同一份 LLM 配额**,而 `PLAN-5000-concurrency.md` 的目标
是把这份配额全留给前台吞吐。

更糟的是当前代码库**没有任何全局并发信号**可读:无 in-flight LLM 计数器、无 token 预算、
无全局 semaphore(唯一的 `asyncio.Semaphore` 在 `embedding_service.py:465`,是批量内部的
局部限流)。所以**自适应节拍的第一步不是调度,是先把压力信号建出来**。

### 2.2 压力信号 (PressureSignal)

先定义一个只读聚合器,把已有的真实指标汇总成一个 0.0-1.0 的标量。**Phase A 只用已有信号,
不新增埋点**:

| 信号 | 来源(已存在) | 说明 |
|---|---|---|
| `experiment_load` | `experiment_executor.get_running_count(exp_id)` (`:341`) 与 `_required_workers_locked()` (`:41`) | 并行实验占用的 worker 比例。这是目前**唯一**的全局并发预算近似 |
| `job_queue_depth` | `job_manager.get_stats()` (`job_queue/job_manager.py:331`) → `pending` / `running` | 便宜的队列深度信号 |
| `db_health` / `redis_health` | `ServiceCenter.get_status("database" / "redis")`(`health.py:54` 已在用) | 二值健康,不是负载;仅用于「不健康 → 压力拉满」 |

Phase B 才新增真正缺失的那一个:**in-flight LLM 调用计数**。落点是
`ModelClient.send_request` 的唯一入口(`conversation/model_client.py:239`)加一个进程内
计数器(`send_request` 是同步的,用 `threading.Lock` 保护的整数即可,不要用
`asyncio` 原语)。这个计数器同时也是 5000 并发工作的必需品,两边共用。

```python
# app/services/heartbeat/pressure.py  (提案)
@dataclass(frozen=True)
class PressureSnapshot:
    level: float            # 0.0 空闲 → 1.0 饱和
    reasons: dict           # {"job_queue_depth": 0.4, "experiment_load": 0.9}
    sampled_at: datetime

class PressureSampler:
    """只读。绝不阻塞。绝不调 LLM。采样周期独立于 TickClock。"""
    async def sample(self) -> PressureSnapshot: ...
```

**硬约束**: `sample()` 必须是纯内存读 + 最多一次廉价 DB count,且必须缓存
(默认 5s TTL)。采样自己变成负载来源是这个设计最蠢的翻车方式。

### 2.3 前台 / 后台来源标记

要做优先级,先要能区分「这次 LLM 调用是用户在等,还是后台大脑在想」。当前代码库**没有这个
概念**。

方案:引入 `contextvars.ContextVar[str]`(**不是** `thread_context.g`,见 §1),值域
`foreground` / `background`,由 HTTP 中间件与 HeartbeatWorker 分别设置。同步的
`ModelClient.send_request` 通过读 contextvar 打标记,用于:

1. 日志与遥测归因;
2. Phase B 的准入控制(背压时拒绝 `background` 调用,让策略以 `outcome='deferred'` 收场)。

> ⚠️ 因为 `ModelClient` 是同步的且可能被 `asyncio.to_thread` 调用,contextvar 会随
> `to_thread` 自动传播(Python 3.9+ `to_thread` 复制 context),但**裸 `ThreadPoolExecutor.submit`
> 不会**。`job_queue` 用的就是裸线程池,所以经由 job 的调用必须显式传递来源。

### 2.4 优先级模型(按 agent 可配,平台给默认值)

依你的选择:优先级**按 agent 可配置,平台提供默认值**。

```python
# Agent.heartbeat_meta 内(不新增列,复用 PLAN.md §3.1 已规划的 JSON 列)
{
  "priority": "normal",          # critical | high | normal | low | idle_only
  "min_interval_seconds": 30,    # 无论多空闲,不得比这更快
  "max_interval_seconds": 3600   # 无论多忙,不得比这更慢(除 idle_only)
}
```

平台默认值集中在一处(建议 `SystemSetting`,与 `job_manager_max_workers` 同款,
见 `job_manager.py:48` 的读取范式),而不是散落在代码里的字面量:

| priority | 压力 < 0.3 | 0.3-0.7 | > 0.7 | 语义 |
|---|---|---|---|---|
| `critical` | 基准节拍 | 基准节拍 | 基准 ×2 | 只在近饱和时轻微降频 |
| `high` | 基准 | ×2 | ×8 | |
| `normal`(默认) | 基准 | ×4 | 退化为 `noop` | 高压下只维持「活着」信号 |
| `low` | ×2 | ×8 | 暂停 | |
| `idle_only` | 基准 | 暂停 | 暂停 | 只在系统真正空闲时思考 |

**降频不等于丢弃。** 被跳过的认知工作记为「认知债 (cognitive debt / 认知债)」:
`heartbeat_meta.debt = {"reflect": 3}`,压力回落后由 cadence controller 允许一次
「补做」(带上限,默认单次最多补 1 项,防止压力一降就雪崩)。

新增 outcome 枚举(补充 `PLAN.md §3.2`):
- `deferred` — 因压力被降级跳过,已记认知债
- `degraded` — 策略降级执行(如 `reflect` 缩小 window 或跳过 LLM)

### 2.5 与 `stop-the-world.md` 的关系

自适应节拍**不引入新的停机语义**。`stop-the-world.md` 的 L1/L2/L3 全部照旧适用。
压力导致的「暂停」是 cadence 层面的 `next_tick_at` 后移,**不是** deregister,因此
不写 `outcome='deregistered'` 事件。这个区分必须在实现时守住:否则「心跳到底是被压力
推迟了,还是真的停了」在审计上不可分辨。

---

## 3. 维度二:持续学习闭环 (Learning Closure)

### 3.1 为什么 `reflect` 策略不算学习

`policies.md §2.2` 的 `reflect` 把过去 N 分钟总结成一条 reflection 写进记忆。问题:
**这不改变未来行为**。下一次对话是否会检索到这条 reflection、检索到了是否会影响决策,
全靠运气。真正的持续学习需要闭环三段:

```
   observe/reflect            consolidate              gate                 apply
  (已有 reflect 策略)  →  (反思 → 候选产物)  →  (回放集评估)  →  (生效 / 丢弃)
                                                        ↓ 不通过
                                                   记录 + 丢弃
                              ↑                                    decay ↓
                              └────────────  遗忘 / 降权  ←──────────────┘
```

### 3.2 巩固 (Consolidation):产物落到已有子系统,不新建

关键设计约束:**学习产物必须落进现有子系统**,否则就是又造一个没人读的表。

| 产物类型 | 落点(全部已存在) | 具体接口 |
|---|---|---|
| **Skill** | `skill_service.py` + 文件系统 `skills/<name>/SKILL.md` | `SkillService.create_skill(data)` (`:49`) → `bind_role_skills(role_id, ids)` (`:309`)。⚠️ `bind_role_skills` **替换**全部绑定,不是追加 |
| **Rule** | `models.py:125` `class Rule` + `RuleSetRule` (`:176`) | `Rule(type='logic', settings={'interpreter':'python'}, content=<body>)`,由 `SupervisorRuleChecker.check_task_rules_with_logging(...)` (`supervisor_rule_checker.py:598`) 评估 |
| **记忆事实** | Graphiti,经分区 | `memory_partition_service.generate_partition_identifier(strategy, context)` (`:189`) 取 `group_id`,再走 MCP `add_memory` |
| **偏好 / 参数** | `AgentVariable` (`models.py:675`,自带 `history` JSON 列) | 现成的带历史的 KV,适合存学到的偏好 |

⚠️ **三个必须在 UI 上讲清的语义后果**:

1. Skill 绑在 **Role** 上,所以「agent A 学到的技能」实际上是「Role R 的所有 agent 都获得
   了该技能」。这可能不是用户预期。
2. 学到的 Rule 进的是 **supervisor 约束层**。根 AGENTS.md §3.2 明令「不得改
   `supervisor_*` / `rule_sandbox` 的权限语义」。因此:**自动学习产出的 rule 只允许
   `category` 为非约束类(如 `evaluation`),严禁自动产出 `constraint` 类 rule。**
   任何收紧或放宽权限的 rule 必须人工批准。这是本提案的红线。
3. `SkillService` 与 `SupervisorRuleChecker` **没有模块级单例**(不同于
   `memory_partition_service` / `sandbox` / `job_manager`),调用方需自行实例化。

### 3.3 评估门 (Evaluation Gate) — 先建评估,再建学习

**这是整个提案里最不能省的一环。** 一个能自己改自己的系统,如果没有「改完是否更好」的
度量,就只能静默劣化,而且劣化会被「它在学习」这个叙事掩盖数周。

契约:任何候选产物在生效前,必须在**回放集 (replay set / 回放集)** 上证明不退化。

```python
# app/services/heartbeat/learning/gate.py  (提案)
@dataclass
class GateVerdict:
    decision: str        # promote | reject | shadow
    baseline_score: float
    candidate_score: float
    replay_case_ids: list[str]
    notes: str
```

- **回放集从哪来**:这是复用现有资产的好机会。仓库已有并行实验设施
  (`parallel_experiment_service.py`),其本质就是「同一配置跑 N 次并比较」。回放集 =
  从历史对话/任务中冻结的一组输入 + 期望性质。**不需要**新建实验框架。
- **判定规则**:`candidate_score >= baseline_score` 才 `promote`;严格劣化则 `reject`;
  统计不显著则 `shadow`(记录但不生效,继续观察)。
- **默认 shadow-first**:新学到的产物默认进 `shadow` 状态,累积 K 次非劣化观测后才
  `promote`。用户可在 UI 上把某个 agent 设为「激进学习」跳过 shadow,但那是显式选择。
- **必须可回滚**:每个 promote 记录 `learning_artifact_id` + 前一版本,一键 revert。
  没有 revert 的自动学习不许上线。

> 顺序性红线:**评估门必须先于 consolidation 落地。** 先做「能学」再补「能评」,
> 中间那段时间系统正在无监督地改自己,而这正是最难事后审计的状态。

### 3.4 遗忘 (Decay)

无界增长的记忆会直接撞上根 AGENTS.md §5.4 记录过的 context explosion 事故。因此闭环必须
含衰减:

- 每条学习产物带 `last_useful_at` / `hit_count`。
- 周期性(低优先级心跳,`idle_only`)扫描:长期未命中的产物降权 → 归档 → 删除。
- **删除永远是软删除 + 审计事件**,因为「大脑忘了什么」必须可解释。

### 3.5 新增表 `LearningArtifact`

现有表都不合适承载「候选 → shadow → promoted → archived」这条状态机,需新表(附 Alembic
迁移,遵守根 AGENTS.md §3.2)。

```python
class LearningArtifact(BaseMixin, db.Model):
    __tablename__ = 'learning_artifacts'

    # 注:BaseMixin 提供 String(36) UUID 主键 + created_at / updated_at
    scope = Column(String(16), nullable=False)          # agent | role | platform
    scope_ref_id = Column(String(36), nullable=True, index=True)
    kind = Column(String(24), nullable=False)           # skill | rule | memory | preference
    status = Column(String(16), nullable=False, default='candidate')
                                                        # candidate|shadow|promoted|rejected|archived
    payload = Column(JSON, nullable=False)              # 产物本体或指向落点的引用
    target_ref = Column(String(128), nullable=True)     # 落点标识,如 skill name / rule id
    source_event_id = Column(String(36), nullable=True) # 来自哪次 heartbeat tick
    gate_verdict = Column(JSON, nullable=True)          # GateVerdict 序列化
    hit_count = Column(Integer, nullable=False, default=0)
    last_useful_at = Column(DateTime, nullable=True)
    superseded_by = Column(String(36), nullable=True)   # 回滚链
```

---

## 4. 维度三:平台大脑 (Platform Brain)

### 4.1 与 agent 心跳的本质区别

`PLAN.md` 的整个模型建立在「**ActionSpace 是边界**」之上:空间关 → 心跳停。平台大脑
**不属于任何空间**,所以这条边界对它不成立。这不是小差异,它意味着 `stop-the-world.md`
的 L2 层对平台大脑完全不适用,必须为它单独定义停机语义。

### 4.2 权限边界(本提案最重要的一节)

一个自驱动、无空间边界、能改平台配置的进程,等于一个无人监督的 root。所以:

**平台大脑只读遥测,只写建议。**

| 允许 | 禁止 |
|---|---|
| 读 `monitoring_service.get_dashboard_data()` (`:74`)、`job_manager.get_stats()`、`experiment_executor.get_running_count()`、`PressureSnapshot` | ❌ 写任何 `SystemSetting` |
| 读 `AgentHeartbeatEvent` / `RuleTriggerLog` 聚合 | ❌ 改任何 agent 的 `heartbeat_*` 配置 |
| 写 `LearningArtifact(scope='platform', status='candidate')` | ❌ 创建 / 修改 / 绑定 Skill 或 Rule |
| 写 `PlatformInsight`(见下)供人审阅 | ❌ 调任何有副作用的 MCP 工具 |
| 发 SSE / 通知 | ❌ 发起对话、调度实验、动 DB schema |

实现上**不能靠自觉**:平台大脑的策略执行必须在一个**只读能力集**下运行(工具白名单 +
只读 DB session)。这个白名单本身要有测试守护(`tests/contract/`,契约非回归),否则
下一个人加个工具就悄悄破了边界。

`monitoring_service.py` 目前是**规则审计看板,不是系统负载看板**(无 CPU / 内存 / 延迟 /
队列深度序列),所以平台大脑第一版能看到的东西相当有限。这反过来说明:**先把 §2.2 的
压力信号建出来,平台大脑才有东西可看。**

### 4.3 停机语义:可降频,不可关闭

- 平台大脑**不可被 disable**,但**必须可降到最低档**(如 1 次/小时的纯 `noop` 健康信号)。
  理由:一个能被关掉的平台大脑,在最需要它的事故期间必然是关着的;一个不能降频的平台
  大脑会在事故期间加剧负载。
- 它的 priority 固定为 `low`(§2.4),即高压时自动暂停认知、只留心跳。
- L3(进程停机)语义与普通 worker 完全一致,照 `stop-the-world.md §4` 实现,包括
  `except CancelledError: raise` 契约。

### 4.4 输出:`PlatformInsight`

平台大脑的产物是**给人看的**,不是自动执行的:

```
GET  /api/platform-brain/insights?status=open
POST /api/platform-brain/insights/{id}/acknowledge
POST /api/platform-brain/insights/{id}/dismiss
```

每条 insight 含:观察到的现象、支撑数据(可点开看原始遥测)、建议动作、置信度。
**建议动作永远是「一键跳转到对应配置页」,而不是「一键应用」。**

---

## 5. 数据模型增量汇总

在 `PLAN.md §3` 之上,本提案新增:

1. `Agent.heartbeat_meta`(已在 `PLAN.md` 规划)内新增约定键:`priority`、
   `min_interval_seconds`、`max_interval_seconds`、`debt`。**不新增列。**
2. `AgentHeartbeatEvent.outcome` 新增枚举值:`deferred`、`degraded`。
   `meta` 内新增 `pressure_level` 与 `cadence_multiplier`,用于事后解释「为什么这次跳得慢」。
3. 新表 `LearningArtifact`(§3.5)。
4. 新表 `PlatformInsight`(§4.4)。
5. ⚠️ 若要让平台大脑的规则评估进 `RuleTriggerLog`,需把
   `RuleTriggerLog.action_task_id` 改为 nullable(`models.py:152`)。**建议不改**,
   平台大脑不走这条日志,避免动一张审计表的约束。

全部改动需 Alembic 迁移,禁止直接改 `models.py` 表字段(根 AGENTS.md §3.2)。

---

## 6. 文件改动(相对 `PLAN.md §6` 的增量)

```
backend-fastapi/app/services/heartbeat/
├── pressure.py                  PressureSampler + PressureSnapshot(只读聚合)
├── cadence.py                   CadenceController:pressure × priority → next_tick_at
├── origin.py                    contextvars ContextVar[foreground|background]
├── learning/
│   ├── __init__.py
│   ├── consolidate.py           反思 → LearningArtifact(candidate)
│   ├── gate.py                  评估门:回放集打分 → GateVerdict
│   ├── apply.py                 promote → 落到 skill/rule/memory/AgentVariable
│   └── decay.py                 降权 / 归档 / 软删
└── platform/
    ├── __init__.py
    ├── brain.py                 平台大脑宿主(system scope,固定 low priority)
    ├── capabilities.py          只读能力白名单(受 contract 测试守护)
    └── insights.py              PlatformInsight 产出

tests/unit/services/heartbeat/
├── test_pressure.py             采样不阻塞、有缓存、不调 LLM
├── test_cadence.py              压力×优先级矩阵、min/max 夹取、认知债累积与补做上限
├── test_learning_gate.py        劣化必 reject、shadow-first、可回滚
├── test_learning_decay.py       未命中产物被降权归档,删除是软删+审计
└── test_platform_capabilities.py 平台大脑越权即失败
tests/contract/
└── test_platform_brain_readonly.py  能力白名单非回归(新加工具不得悄悄扩权)
```

---

## 7. 交付顺序(为什么必须自下而上)

| Stage | 内容 | 为什么在这个位置 |
|---|---|---|
| **S0** | 修正 §1 的事实偏差,回填 `PLAN.md` / `policies.md` | 带着错误接口假设写代码是最贵的返工 |
| **S1** | `PLAN.md` P1 骨架(模型 + 迁移 + TickClock + Registry + Worker + `noop` + lifespan)。照 `connection_manager._cleanup_loop` 的范式接入 lifespan | 现在**一行都没有**。上面所有东西都挂在这个骨架上 |
| **S2** | `PressureSampler`(仅已有信号)+ `origin` contextvar + `CadenceController` + 按 agent 优先级 | 在有任何 LLM 心跳之前先建好节流。反过来做的话,第一个 `reflect` 策略上线当天就会和前台抢配额 |
| **S3** | in-flight LLM 计数器(`ModelClient` 唯一入口)+ 背压准入 → `deferred` | 与 5000 并发工作共用,应与其协调排期 |
| **S4** | **评估门先行**:回放集 + `gate.py`,先用现成的 `reflect` 产物做打分对象,此时**还不允许 apply** | 先证明「能评估」,再允许「能改自己」 |
| **S5** | 学习闭环打通:`consolidate` → `gate` → `apply`(shadow-first)+ `decay` + 回滚 | 有了评估门才允许生效 |
| **S6** | 平台大脑:只读能力集 + `PlatformInsight` + contract 测试 | 它依赖 S2 的压力信号才有东西可看,依赖 S4 的评估门才有产物纪律 |

**反向做的后果**(必须写下来,避免以后有人图快):先做平台大脑,会得到一个既没有停机
语义、又没有评估门、还没有压力感知的自驱动 root 进程。这恰好是根 AGENTS.md §5.1
「自主任务停不下来」事故的放大版。

---

## 8. 失败模式预防(本提案专属)

在 `PLAN.md §9` 之上追加:

1. **后台饿死前台** — 任何 `background` 来源的 LLM 调用必须可被背压拒绝。上线前必须有
   一个负载测试:前台 P99 延迟在后台大脑满负荷时不得劣化超过约定阈值。
2. **压力采样自己成为负载** — `PressureSampler.sample()` 必须带 TTL 缓存且禁止 LLM /
   跨服务调用。测试断言单次采样的 DB 查询数上界。
3. **静默劣化** — 无评估门就 apply。防御:`apply.py` 在 `gate_verdict is None` 时
   **抛异常**,不是记日志跳过(根 backend AGENTS.md §4「零兜底」)。
4. **学习产物无限增长 → context explosion** — 强制 `decay`,且记忆检索有条数上限。
5. **平台大脑越权** — 只读能力白名单 + `tests/contract/` 非回归。
6. **认知债雪崩** — 压力回落瞬间把积压的反思全部补做。防御:单次补做上限 + 补做本身
   也受 cadence 约束。
7. **降频与停机在审计上不可分辨** — `deferred`(压力)与 `deregistered`(真停)必须是
   不同 outcome,UI 上分开展示。
8. **学到的 rule 改了权限语义** — 自动产出的 rule 严禁 `category='constraint'`
   (§3.2)。需要单测守护。

任何一次真实事故 → `docs/agents/failures/YYYY-MM-*.md`,并把一行回填根 AGENTS.md §5。

---

## 9. 开放问题

- **回放集怎么冻结?** 从历史对话采样需要脱敏,且「期望性质」如何表达(断言?LLM 评分?
  人工标注?)未定。倾向:先用少量人工标注的黄金集,不追求规模。
- **`priority` 的默认值给多少?** 表格里的倍数是猜的,需要真实负载数据校准。S2 上线后先
  只观测不生效(dry-run 模式),看一周再定。
- **平台大脑是否需要多实例?** 多 worker(gunicorn)下平台大脑会被启动多次。需要一个
  单实例选举(DB advisory lock,`core/database.py` 已有 `GET_LOCK` 使用先例)。
  这个问题在 S1 的 TickClock 上其实**已经存在**且 `PLAN.md` 未提及 —— 单进程 asyncio 假设
  在 gunicorn 多 worker 生产配置(`start_prod.sh`)下不成立。**这是 S1 必须解决的问题,
  不能推到 P4。**
- **认知债是否该跨重启保留?** 倾向保留(存 `heartbeat_meta`),但要有上限防止无限累积。
- **学习产物的所有权?** Skill 绑 Role 意味着跨 agent 溢出(§3.2)。是否要引入 per-agent
  skill 绑定表?这会动 skill 子系统,需单独评估。

---

## 10. 参考

- 项目内: [`PLAN.md`](./PLAN.md)、[`policies.md`](./policies.md)、
  [`stop-the-world.md`](./stop-the-world.md)、
  `docs/feature-parallellab/PLAN-5000-concurrency.md`、`docs/agents/parallel-execution.md`
- Park, J. S., et al. (2023). *Generative Agents*. UIST. — inner loop 的来源
- Complementary Learning Systems / 记忆巩固:反思 → 巩固 → 遗忘 三段结构的类比来源
- Sculley, D., et al. (2015). *Hidden Technical Debt in Machine Learning Systems*. NeurIPS.
  — §3.3 评估门先行的论据(反馈回路与纠缠是自改系统的主要技术债来源)

---

_last review: 2026-07-25(spec 阶段,未实现;§1 的事实偏差表基于当前 HEAD 实测)_
