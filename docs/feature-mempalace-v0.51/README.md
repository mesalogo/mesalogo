# MemoryPalace v0.51 — Agent 记忆宫殿系统

> **代号**:MemoryPalace(下文简写 MP)
> **目标版本**:v0.51(对齐 abm-llm-v2 当前 0.32.x 之后规划的下一代记忆系统骨架)
> **创建日期**:2026-04-26
> **状态**:Spec / 设计阶段。**未开工**。
> **目录结构**:
> - `README.md`(本文)— 总览、动机、决策、路线图入口
> - `01-architecture.md` — 5 层结构 + 数据模型 + 检索/写入流水线
> - `02-PR1-skeleton.md` — P1 PR:骨架(表 + 服务 + 最小工具)
> - `03-PR2-closet-hybrid.md` — P2 PR:Closet 索引层 + Hybrid 混合检索
> - `04-PR3-kg-reflection.md` — P3 PR:时态 KG + Tunnel + 反思 Job
> - `05-PR4-adapter-frontend.md` — P4 PR:旧系统适配 + 前端浏览树
> - `06-decisions.md` — 已和用户确认的关键决策(可追溯)
> - `07-failure-modes.md` — 预想失败模式与防护(给 Agent 自己读)
> - `08-memory-as-temporal-kg.md` — ⭐ **核心心智模型**:为什么记忆是"双层时态 KG",为什么不用 Graphiti/Neo4j(质疑者必读)
> - `09-ui-design.md` — UI 设计:三栏主页 + Drawer 详情 + 对话浮层 + KG Timeline(P4 必读)

---

## 0. TL;DR(给赶时间的人)

当前记忆系统 = **外部 Graphiti 的薄壳 + 大量 TBD + 阻塞 IO**(违反项目硬约束)。

新方案 = 自研 **MemoryPalace**,五层结构(Realm / Wing / Hall+Room / Closet+Drawer / Diary),完全跑在已有栈(MariaDB + Milvus + Redis),全 async,参考开源 `MemPalace`(github.com/mempalace/mempalace)在 LongMemEval R@5=96.6% 的工程实践,结合多 Agent 仿真平台的特殊需求(多租户、多 ActionSpace、SSE 不阻塞、5000 并发)做了重新设计。

**4 个独立 PR,每个可单独回滚**:
1. **P1 骨架** — 7 张表 + Milvus collection + `remember/recall` 最小可用
2. **P2 Closet+Hybrid** — 压缩索引层 + 混合检索(vec×BM25)
3. **P3 KG+Tunnel+Reflection** — 时态知识图谱 + 跨 Wing 链接 + 反思 Job
4. **P4 Adapter+Frontend** — 旧 Graphiti 工具适配 + 前端 Wing/Room/Drawer 浏览树

---

## 1. 为什么要重做(Diagnosis)

> 详细诊断与代码引用见 `06-decisions.md` 第 1 节。这里只列结论。

### 1.1 当前实现的硬伤

| # | 问题 | 代码出处 |
|---|---|---|
| 1 | 整套"记忆"=外部 Graphiti 的薄壳;关 Graphiti → 角色立刻失忆 | `memory_capability_service.sync_memory_capability_with_graph_enhancement` |
| 2 | 大量阻塞 IO(违反 backend-fastapi/AGENTS.md §3.1) | `memory_sync_service.py` 用 `requests` + `threading.Thread(daemon=True)` |
| 3 | TBD / mock 占多数 | `_get_graphiti_partition_graph` 返回假节点;`search_partition`/`get_partition_stats`/`clear_partition` 全部"功能待实现" |
| 4 | 记忆只有"事实集合",无层级/重要性/衰减/巩固 | 每轮对话 → 一个 `entity_node`(name=`对话_时间戳`),裸 group_id 切片 |
| 5 | 跨片召回弱 | PLAN-memory-partition.md §3.2 "层次化查询"代码未实现 |
| 6 | 文档自承"已过时" | `docs/feature-memory/PLAN-memory.md` 第一行 |

### 1.2 为什么"记忆宫殿"是合适隐喻

记忆宫殿(method of loci)真正立得住的不是空间,而是这三条:

1. **空间化的层级索引**:粗(房间)→ 细(物件),检索两阶段。
2. **多模线索召回**:一个事实多个入口(人物/地点/时间/情绪)。
3. **生动锚点 + 重复巩固**:重要的事被显式放在显眼位置;不被回访的褪色。

恰好对齐我们已有的 `tenant → ActionSpace → ActionTask → Agent` 层级,迁移代价小。

### 1.3 为什么参考 mempalace

`github.com/mempalace/mempalace`(49.7k star,LongMemEval R@5=96.6% 零 API 最高分)。我们**只学工程实践,不抄实现**:

| Mempalace 工程实践 | 我们怎么用 |
|---|---|
| 4 层 Wings/Rooms/Closets/Drawers | 用 ABM 领域模型映射成 5 层(多了 Realm 多租户层) |
| Closet = 压缩索引层(≤1500 字符,主题\|实体\|→drawer 引用) | 完整保留,作为粗-精两阶段检索的关键 |
| Hybrid: vec(60%) + BM25(40%) + 实体过滤 + 时间临近 boost | 完整保留,Milvus + 自实现 BM25 |
| 时态 KG(SQLite, valid_from/valid_to) | 改用 MariaDB 表,字段照搬 |
| Tunnels(同名 room 自动连 + Agent 显式连) | 完整保留,跨 Wing 召回的关键 |
| Background save(不占对话 token) | 改成 `asyncio.create_task` + Redis 队列(我们是服务端) |
| Verbatim drawer + normalize_version 静默重建 | 完整保留,适配 SQLAlchemy 升级 |

**不抄的部分**:
- ChromaDB / SQLite / 文件锁 / fcntl(我们是多进程服务端,用 Redis 协调)
- CLI / hooks / MCP server 模式(我们已经有 MCP 工具体系)
- AAAK 压缩方言(可选,P3 之后再评估)

---

## 2. 核心架构(5 秒版)

```
Realm(租户/全局)
 └── Wing(ActionSpace / Role / Agent / Global,创建时选)
      ├── Hall  ─ 主题分组
      │    └── Room ─ 具体话题
      │         ├── Closet  ⭐ 压缩索引(粗检入口)
      │         └── Drawer    逐字原文(精检载体)
      └── Diary  ─ Agent 反思日记
Tunnel: 跨 Wing 显式 / 被动链接
KG:     (subject, predicate, object, valid_from, valid_to) 三元组
```

**写**:对话/工具结束 → SSE done 后 `asyncio.create_task` → normalize → detect_room → upsert drawer → extract KG → 重建 closet。

**读**:closet-first hybrid(vec 0.6 + BM25 0.4)→ 命中 room → drawer 精检 → rerank(importance × decay × recency × cue)→ tunnel/realm fallback → KG 校验。

**养**:`job_queue/` 跑 decay / consolidate / reflect / tunnel_discover。

> 详见 `01-architecture.md`。

---

## 3. 已确认决策(快速参考)

| 决策点 | 选择 | 来源 |
|---|---|---|
| 核心心智模型 | **记忆 = Drawer(叙事) + 时态 KG(事实)双层** | 2026-04-26 |
| 存储底座 | **自研 MariaDB + Milvus**(完全脱离 Graphiti) | 2026-04-26 |
| Wing 默认作用域 | **创建 ActionSpace 时让用户选**(space/role/agent/global) | 2026-04-26 |
| 自动反思(Reflection) | **启用,阶段可选**(per_task / manual / disabled) | 2026-04-26 |
| 旧 Graphiti 数据迁移 | **不迁**,新系统从此刻起重新积累 | 2026-04-26 |
| 概念术语 | **保留英文**(Wing/Hall/Room/Closet/Drawer/Tunnel/Diary/KG) | 2026-04-26 |
| UI 主布局 | **三栏**(Wing 树 + Room 详情 + 右抽屉) | 2026-04-26 |
| KG 视图入口 | **单独菜单项 "Knowledge Graph"** | 2026-04-26 |
| 对话页记忆指示器 | **始终显示 `💭 N memories used`,可展开** | 2026-04-26 |
| KG Timeline 视图 | **P4 实现**(时态 KG 的视觉招牌) | 2026-04-26 |

> 详见 `06-decisions.md`。

---

## 4. 路线图(4 个独立 PR)

| PR | 文档 | 估算工作量 | 关键产出 | 验收标准 |
|---|---|---|---|---|
| **P1** 骨架 | `02-PR1-skeleton.md` | 中(3-5 天) | 7 表 Alembic + `MemoryPalaceService` CRUD + Milvus 写入 + `remember/recall`(单层) | pytest 全绿;关 Graphiti 仍能 remember/recall;curl 路由返回真实 JSON |
| **P2** Closet+Hybrid | `03-PR2-closet-hybrid.md` | 中(3-5 天) | Closet 构建 job + closet-first hybrid 检索 + 实体抽取 + Cue 过滤 | closet 命中率 ≥ 70%;cue 过滤可重现样本 |
| **P3** KG+Tunnel+Reflection | `04-PR3-kg-reflection.md` | 大(5-7 天) | 时态 KG + `fact_check` 工具 + 主动/被动 tunnel + Reflection job(开关) | KG 能检出"关系矛盾/过期事实";Reflection 写 Diary 条目 |
| **P4** Adapter+Frontend | `05-PR4-adapter-frontend.md` | 中(3-5 天) | 旧 `add_memory` adapter + `memory_sync_service` 重写为 async + 前端 Wing/Room/Closet/Drawer 浏览树 | E2E:关 Graphiti 全功能可用;前端能浏览/编辑/看 KG 告警 |

每个 PR 严格遵守 backend-fastapi/AGENTS.md:
- 全 async,禁 `requests`/`threading.Thread`
- 修 Bug 先写红测试再修绿
- Alembic upgrade↔downgrade 对称
- 不动 supervisor / rule_sandbox 放行语义
- `print()` → logger;后台任务进 `job_queue/`

---

## 5. 与现有功能的关系

| 现有模块 | 处理 |
|---|---|
| `memory_partition_service.py` | **保留**,`generate_partition_identifier` 改返回 wing_id;TBD 用真实数据填掉 |
| `memory_sync_service.py` | **重写**,P4 阶段:`requests` → `httpx.AsyncClient`,`threading.Thread` → `asyncio.create_task`,调用 `MemoryWriter` |
| `memory_capability_service.py` | **解耦** Graphiti:能力来自 MemoryPalace 配置,Graphiti 开关只影响"图谱可视化" |
| `tool_handler.py` 的 group_id 注入 | **改为** wing_id 注入;旧 graphiti 工具名通过 adapter 转发 |
| `/agents/{id}/memories` 端点 | **切换** 到读 Drawer 表 |
| `memory_management.py` 路由 | **全部 async**;新增 wing/room/closet/diary/tunnel/kg 路由 |
| Graphiti 服务 | 降级为**可选**关系图可视化适配器,核心路径不依赖 |

---

## 6. 风险与防护(自我警示)

| 风险 | 防护 |
|---|---|
| 又写成"项目主语言中文 + 半 sync 半 async 大杂烩" | P1 起所有新代码强制 `async def`;CI 加 ruff 规则禁 `requests`/`threading.Thread`(在新模块) |
| 7 张表全开=Bug 同时炸 | P1 只交付最少 3 张(wing/room/drawer),其余表在后续 PR 引入 |
| Closet 重建工作量爆炸 | 异步 job + 分钟级冷却,而非每条 drawer 触发 |
| KG 抽取/校验 token 成本 | 默认关闭 KG 自动抽取;只在 reflect 时由 LLM 一次性产出 |
| 影响现有对话路径性能 | 写入 100% 在 SSE done 之后 `create_task`,recall 走 Redis 缓存命中优先 |
| AGENTS.md 漂移 | 每个 PR 末尾都要更新 `docs/feature-mempalace-v0.51/` 对应文档 + `docs/agents/failures/` |

> 详见 `07-failure-modes.md`。

---

## 7. 给 AI Agent 的入职提示

如果你(下一个 droid/coder)接手这个特性:

1. **先读** `08-memory-as-temporal-kg.md`(只 5 分钟,但能让你不再质疑架构)
2. **再读** `06-decisions.md`,知道哪些是已锁定的
3. **再读** `01-architecture.md`,弄清 5 层语义
4. **找到当前 PR**(看 git 分支 + 文档里的 `状态` 字段),只读对应 PR 文档
5. **不要 one-shot**;每完成一个验收标准 commit 一次
6. **改完必做** 仓库根 AGENTS.md §6 的"运行与验证"清单
7. **遇到坑** → 写一篇 `docs/agents/failures/2026-MM-mempalace-XXX.md`,把要点回写到 `07-failure-modes.md`

**遇到下列 5 个常见质疑时,直接指向 `08-memory-as-temporal-kg.md`**:
- "记忆不就是时态 KG 吗,要 Drawer 层做啥"
- "为什么不用 Graphiti / Neo4j"
- "MariaDB 关系表能撑得住图查询吗"
- "Mem0 / LightRAG 那种纯向量不就够了吗"
- "记忆 ≈ 数据库,何必这么多概念"

---

_last human review: 2026-04-26_
_authors: human + droid (spec phase)_
