# 01 — 架构总图

> 本文是 MemoryPalace v0.51 的完整架构说明。
> 阅读对象:开始动手实现的开发者 / Agent。
> 配套阅读:`README.md`(为什么)、`02-PR1-skeleton.md`(P1 怎么做)。

---

## 1. 五层结构(领域语义)

```
┌────────────────────────────────────────────────────────────┐
│                       Realm (租户/全局)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Wing  (作用域 = ActionSpace | Role | Agent | Global)│  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │  Hall (主题分组,自动+显式)                  │    │  │
│  │  │  ┌────────────────────────────────────┐      │    │  │
│  │  │  │  Room (一个具体话题)               │      │    │  │
│  │  │  │  ┌──────────────┐ ┌──────────────┐ │      │    │  │
│  │  │  │  │  Closet      │ │  Drawer       │ │      │    │  │
│  │  │  │  │  (压缩索引)  │ │  (逐字原文)   │ │      │    │  │
│  │  │  │  │  ≤1500 chars │ │  verbatim     │ │      │    │  │
│  │  │  │  └──────────────┘ └──────────────┘ │      │    │  │
│  │  │  └────────────────────────────────────┘      │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │  Diary (Agent 反思日记)                      │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Tunnel: 跨 Wing 显式 / 被动链接                            │
│  KG:     (subject, predicate, object, valid_from, valid_to)│
└────────────────────────────────────────────────────────────┘
```

### 1.1 各层职责

| 层 | 职责 | 类比 mempalace | 类比 ABM 模型 |
|---|---|---|---|
| **Realm** | 租户级隔离;承载稳定偏好和长期人格 | (无,mempalace 是单用户) | tenant |
| **Wing** | 一个相对独立的"项目"或"个体" | Wing | ActionSpace / Role / Agent / Global(可选) |
| **Hall** | 同 Wing 内的主题分类;辅助导航 | Hall | (新增,纯逻辑分组) |
| **Room** | 一个具体话题;是 Closet/Drawer 的容器 | Room | conversation/topic 级 |
| **Closet** | 压缩索引层(主题\|实体\|→drawer 引用);粗检入口 | Closet(原汁原味) | (新增) |
| **Drawer** | 逐字原文;精检载体;不修改 | Drawer | message / tool_result |
| **Diary** | Agent 反思日记;独立于对话流 | Diary | (新增) |
| **Tunnel** | 跨 Wing 链接;支持跨片召回 | Tunnel(原汁原味) | (新增) |
| **KG** | 时态知识图谱;支持矛盾检测 | Knowledge Graph(原汁原味) | (新增) |

### 1.2 Wing 作用域(创建 ActionSpace 时选)

```python
class WingScope(str, Enum):
    SPACE  = "space"   # 默认:同 ActionSpace 内 Agent 共享一座宫殿
    ROLE   = "role"    # 同角色 Agent 共享(适合"客服角色"这种)
    AGENT  = "agent"   # 每个 Agent 独享(强隔离)
    GLOBAL = "global"  # 整个 tenant 共享(适合"通用助手")
```

**重要决策**:Space 创建后 `wing_scope` 不可改(避免数据迁移)。需要换作用域时,新建 Space 并选择"复制记忆"(P4 提供工具)。

---

## 2. 数据模型(MariaDB + Milvus)

### 2.1 MariaDB 新增 7 张表

放在新文件 `backend-fastapi/app/models/memory_palace.py`(**不动 9 万行的 `models.py`**)。

```python
# === 表 1: memory_wing ===
class MemoryWing(Base):
    __tablename__ = "memory_wing"

    id            = Column(BigInteger, primary_key=True)
    tenant_id     = Column(String(64), nullable=False, index=True)
    scope_type    = Column(Enum("space", "role", "agent", "global"), nullable=False)
    scope_id      = Column(String(64), nullable=True)  # 对应 ActionSpace.id / Role.id / Agent.id;global 时为 NULL
    name          = Column(String(255), nullable=False)
    description   = Column(Text, nullable=True)
    config        = Column(JSON, nullable=False, default=dict)
    # config 示例:
    # {
    #   "reflection_mode": "per_task",   # per_task | manual | disabled
    #   "retention_days": 365,
    #   "decay_tau_days": 30,
    #   "closet_rebuild_threshold": 5    # room 累计多少新 drawer 触发重建
    # }
    created_at    = Column(DateTime, default=func.now())
    updated_at    = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("tenant_id", "scope_type", "scope_id", name="uq_wing_scope"),
        Index("ix_wing_tenant_scope", "tenant_id", "scope_type"),
    )


# === 表 2: memory_room ===
class MemoryRoom(Base):
    __tablename__ = "memory_room"

    id              = Column(BigInteger, primary_key=True)
    wing_id         = Column(BigInteger, ForeignKey("memory_wing.id"), nullable=False, index=True)
    hall            = Column(String(64), nullable=True, index=True)  # 自动归类的主题大类
    name            = Column(String(255), nullable=False)
    summary         = Column(Text, nullable=True)
    importance      = Column(Float, default=0.5)         # 0-1
    last_accessed_at= Column(DateTime, default=func.now())
    recall_count    = Column(Integer, default=0)
    created_at      = Column(DateTime, default=func.now())

    __table_args__ = (Index("ix_room_wing_hall", "wing_id", "hall"),)


# === 表 3: memory_drawer ===
class MemoryDrawer(Base):
    __tablename__ = "memory_drawer"

    id                = Column(BigInteger, primary_key=True)
    room_id           = Column(BigInteger, ForeignKey("memory_room.id"), nullable=False, index=True)
    source_kind       = Column(Enum("message", "tool_result", "note", "reflection"), nullable=False)
    source_ref        = Column(JSON, nullable=False)  # {message_id, conversation_id, agent_id, ...}
    content           = Column(MEDIUMTEXT, nullable=False)  # 逐字原文,不修改
    normalize_version = Column(Integer, default=1)         # 升级时静默重建
    embedding_id      = Column(String(64), nullable=True)  # Milvus 向量 ID
    entities          = Column(JSON, default=list)         # 抽取出的实体名
    importance        = Column(Float, default=0.5)
    decay_state       = Column(Enum("active", "fading", "archived"), default="active")
    last_recalled_at  = Column(DateTime, nullable=True)
    recall_count      = Column(Integer, default=0)
    created_at        = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("ix_drawer_room", "room_id"),
        Index("ix_drawer_state", "decay_state"),
    )


# === 表 4: memory_closet ===
class MemoryCloset(Base):
    __tablename__ = "memory_closet"

    id           = Column(BigInteger, primary_key=True)
    room_id      = Column(BigInteger, ForeignKey("memory_room.id"), nullable=False, index=True)
    lines        = Column(JSON, nullable=False)  # [{"topic": "…", "entities": [...], "drawer_ids": [...]}]
    char_count   = Column(Integer, default=0)
    embedding_id = Column(String(64), nullable=True)  # Milvus 向量 ID(closet 自己也有向量)
    rebuilt_at   = Column(DateTime, default=func.now())


# === 表 5: memory_tunnel ===
class MemoryTunnel(Base):
    __tablename__ = "memory_tunnel"

    id                  = Column(BigInteger, primary_key=True)
    src_wing_id         = Column(BigInteger, ForeignKey("memory_wing.id"), nullable=False)
    src_room_id         = Column(BigInteger, ForeignKey("memory_room.id"), nullable=False)
    dst_wing_id         = Column(BigInteger, ForeignKey("memory_wing.id"), nullable=False)
    dst_room_id         = Column(BigInteger, ForeignKey("memory_room.id"), nullable=False)
    label               = Column(String(255), nullable=True)
    kind                = Column(Enum("active", "passive"), nullable=False)
    created_by_agent_id = Column(String(64), nullable=True)
    created_at          = Column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint("src_room_id", "dst_room_id", name="uq_tunnel_pair"),
    )


# === 表 6: knowledge_triple(时态 KG) ===
class KnowledgeTriple(Base):
    __tablename__ = "knowledge_triple"

    id                = Column(BigInteger, primary_key=True)
    tenant_id         = Column(String(64), nullable=False, index=True)
    subject           = Column(String(255), nullable=False)
    predicate         = Column(String(128), nullable=False)
    object            = Column(String(255), nullable=False)
    valid_from        = Column(DateTime, default=func.now())
    valid_to          = Column(DateTime, nullable=True)        # NULL = current
    current           = Column(Boolean, default=True, index=True)
    source_drawer_id  = Column(BigInteger, ForeignKey("memory_drawer.id"), nullable=True)
    created_at        = Column(DateTime, default=func.now())

    __table_args__ = (
        Index("ix_kg_subject", "tenant_id", "subject"),
        Index("ix_kg_object",  "tenant_id", "object"),
    )


# === 表 7: agent_diary ===
class AgentDiary(Base):
    __tablename__ = "agent_diary"

    id             = Column(BigInteger, primary_key=True)
    agent_id       = Column(String(64), nullable=False, index=True)
    wing_id        = Column(BigInteger, ForeignKey("memory_wing.id"), nullable=False, index=True)
    entry_at       = Column(DateTime, default=func.now())
    summary        = Column(String(512), nullable=False)
    reflection_md  = Column(Text, nullable=False)
    source_window  = Column(JSON, nullable=True)  # {"from_drawer_id": ..., "to_drawer_id": ...}
```

> 字段范围与 enum 在 P1 落地时保持只读心态:加字段比改字段便宜得多。

### 2.2 Milvus 新增 1 个 collection

```python
collection_name = "memory_vec"

schema = [
    FieldSchema("id",          DataType.VARCHAR, max_length=64, is_primary=True),
    FieldSchema("tenant_id",   DataType.VARCHAR, max_length=64),  # ← partition_key
    FieldSchema("kind",        DataType.VARCHAR, max_length=16),  # "drawer" | "closet"
    FieldSchema("wing_id",     DataType.INT64),
    FieldSchema("room_id",     DataType.INT64),
    FieldSchema("ref_id",      DataType.INT64),                    # drawer_id 或 closet_id
    FieldSchema("vector",      DataType.FLOAT_VECTOR, dim=1024),   # 取决于 embedding 模型
    FieldSchema("created_at",  DataType.INT64),                    # epoch sec
]

partition_key_field = "tenant_id"   # ⭐ 多租户隔离
index = "HNSW", metric = "COSINE"
```

> Milvus 已经在 `abm-docker/` 起着,只用新加 collection。无新增依赖。

---

## 3. 写入流水线(`MemoryWriter`,全 async)

```
对话轮次结束 / 工具结束
   │
   │  SSE handler 立刻 yield done(关键:不阻塞前端)
   ▼
asyncio.create_task(MemoryWriter.process(...))   ← 非 await
   │
   ├─[1]─ normalize         清噪;逐字保护;version 版本号
   │
   ├─[2]─ detect_room       规则 + 向量匹配最近 room
   │                        (向量相似度 > 0.85 复用,否则 LLM 命名新 room)
   │
   ├─[3]─ drawer_write      MariaDB upsert + Milvus async upsert(批量)
   │
   ├─[4]─ extract_entities  正则 / 内置实体名册 + 出现次数 ≥ 2 的专名
   │
   ├─[5]─ extract_KG (可选,P3 才开)
   │      LLM 抽 (s, p, o) → 与已有 current=True 比对
   │      冲突时:旧 triple valid_to=now, current=False;新 triple current=True
   │
   ├─[6]─ closet_rebuild_check
   │      若 room.drawer_count_since_rebuild >= threshold:
   │         enqueue Redis: "rebuild_closet:{room_id}"
   │
   ├─[7]─ importance_score  多信号加权
   │      (用户显式标记 0.4, 反思指令 0.3, 实体集中度 0.2, 新颖度 0.1)
   │
   └─[8]─ Redis pub         "wing:{wing_id}:new_drawer" → 前端 SSE 推送
```

**强制纪律**(违反即拒 PR):
- 全部 `async def`,任何同步 IO 必须 `asyncio.to_thread`
- **禁** `requests`、`threading.Thread`、`time.sleep`
- 失败要发 done 事件 + logger.exception(对齐 backend-fastapi/AGENTS.md §3.2)

---

## 4. 检索流水线(`MemoryReader.recall`,Closet-first Hybrid + Layered Fallback)

```python
async def recall(
    query: str,
    agent_id: str,
    scope: Literal["auto", "wing", "realm"] = "auto",
    cues: Optional[Cues] = None,         # {entities, time_window, tags}
    k: int = 5,
) -> list[RecallHit]:

    # ───────────────────────────────────────────
    # 1. 定位起点 wing
    # ───────────────────────────────────────────
    wing = await resolve_wing(agent_id, scope)

    # ───────────────────────────────────────────
    # 2. CLOSET-FIRST:粗定位 room
    # ───────────────────────────────────────────
    closet_hits = await hybrid_search(
        kind="closet",
        wing_id=wing.id,
        query=query,
        cues=cues,
        k=20,
    )
    candidate_rooms = {h.room_id for h in closet_hits}

    # ───────────────────────────────────────────
    # 3. HYDRATE:从命中 room 拉 drawer 精检
    # ───────────────────────────────────────────
    drawer_hits = await hybrid_search(
        kind="drawer",
        room_ids=candidate_rooms,
        query=query,
        cues=cues,
        k=k * 3,
    )

    # ───────────────────────────────────────────
    # 4. RERANK
    # ───────────────────────────────────────────
    ranked = rerank(
        drawer_hits, query, cues,
        weights={
            "cosine":     0.4,
            "bm25":       0.25,
            "importance": 0.15,
            "recency":    0.10,
            "cue_match":  0.10,
        }
    )

    # ───────────────────────────────────────────
    # 5. LAYERED FALLBACK(不足 k 条时)
    # ───────────────────────────────────────────
    if len(ranked) < k:
        ranked += await fallback_via_tunnels(wing, query, cues, k - len(ranked))
    if len(ranked) < k:
        ranked += await fallback_realm(wing.tenant_id, query, cues, k - len(ranked))

    # ───────────────────────────────────────────
    # 6. KG 校验(P3 后启用)
    # ───────────────────────────────────────────
    for r in ranked:
        r.kg_status = await kg_verify(r.content, wing.tenant_id)
        # kg_status: ok | stale | contradicted | unknown

    # ───────────────────────────────────────────
    # 7. 巩固
    # ───────────────────────────────────────────
    await asyncio.gather(*[
        bump_recall_stats(h.drawer_id) for h in ranked[:k]
    ])

    return ranked[:k]
```

### 4.1 `hybrid_search` 内部(关键!)

```python
async def hybrid_search(kind, query, k, **filters) -> list[Hit]:
    # 4.1.1 向量分支(Milvus)
    qv = await embed_async(query)
    vec_hits = await milvus.search(
        collection="memory_vec",
        partition_key=filters["tenant_id"],
        expr=build_expr(kind=kind, **filters),
        anns_field="vector", data=[qv], limit=k * 2,
        output_fields=["ref_id", "room_id", "wing_id"],
    )

    # 4.1.2 BM25 分支(MariaDB FULLTEXT 或 Postgres ts_rank;评估见下)
    bm25_hits = await bm25_search(kind=kind, query=query, k=k * 2, **filters)

    # 4.1.3 RRF 融合(Reciprocal Rank Fusion,无需归一化)
    fused = rrf_merge(vec_hits, bm25_hits, weights=(0.6, 0.4))

    # 4.1.4 实体过滤(cues.entities 命中 ≥ 1 才保留)
    if cues and cues.entities:
        fused = [h for h in fused if any(e in h.entities for e in cues.entities)]

    return fused[:k]
```

**BM25 实现技术选项**(P2 落地时再决):
- A. MariaDB `FULLTEXT INDEX`(项目已用 MariaDB,零新增依赖,中文需要 ngram parser)
- B. 自实现 BM25(把 drawer.content 切词后统计;Redis 缓存 IDF)
- C. Elasticsearch(项目无,引入成本高,不推荐)

> 默认走 **A 方案 + ngram parser**;若中文召回质量不达标(P2 验收标准看),P3 再切 B 方案。

---

## 5. 巩固 / 衰减 / 反思 Job(进 `job_queue/`)

| Job 名 | 触发 | 频率 | 工作内容 |
|---|---|---|---|
| `mp_consolidate_room` | room 新增 drawer 数 ≥ threshold | 事件驱动 + 5 分钟冷却 | 重建该 room 的 closet(规则版默认,LLM 版可选) |
| `mp_decay_drawer` | 定时 | 每天 03:00 | `importance ×= exp(-Δt/τ)`,跌破 0.1 → `archived` |
| `mp_reflect_episode` | 任务结束 / 手动 / 关闭 | 事件驱动 / 手动 | 取最近 N drawer,LLM 反思,写 Diary + 高 importance Drawer |
| `mp_kg_gc` | 定时 | 每周日 04:00 | `valid_to < now() - 365d` 的 triple 转入归档表 |
| `mp_tunnel_discover` | 定时 | 每天 04:30 | 跨 wing 同名/高相似 room 自动建 passive tunnel |

> Reflection 默认 `per_task`;空间级配置可关。LLM 用当前 ActionSpace 配置的 model(不另开预算)。

---

## 6. Agent 工具集(替代旧 `add_memory` / `search_memory_*`)

```
recall(query, scope?, cues?, k=5)            # 主用,带 closet-first
remember(content, room_hint?, importance?)   # 显式记
forget(by_id | by_query, dry_run=true)       # 用户/supervisor 才能 dry_run=false
reflect(window="last_round" | "task")        # 触发反思
walk(wing_id?)                               # 浏览结构,debug
fact_check(text)                             # 用 KG 找矛盾(P3 启用)
create_tunnel(src_room, dst_room, label)     # 跨 wing 显式链接(P3 启用)
```

旧工具名(`add_memory` / `search_memory_nodes` / `search_memory_facts` / `get_episodes`)在 P4 阶段通过 **adapter** 保留可用,内部转发到新 API。

---

## 7. 与现有代码的边界(只声明,不动手)

| 文件 | 改动方向 | 何时改 |
|---|---|---|
| `app/models.py`(9 万行) | **不动**,新模型放 `app/models/memory_palace.py` | P1 |
| `app/services/memory_partition_service.py` | `generate_partition_identifier` 改返回 wing_id;TBD 用真实数据填 | P4 |
| `app/services/memory_sync_service.py` | 重写为 async,改调 MemoryWriter | P4 |
| `app/services/memory_capability_service.py` | 解耦 Graphiti 开关 | P4 |
| `app/services/conversation/tool_handler.py` | wing_id 注入 + 旧 graphiti 工具名 adapter | P4 |
| `app/api/routes/agents.py` `/{id}/memories` | 切换到 Drawer 表 | P4 |
| `app/api/routes/memory_management.py` | 全部 async + 新增 wing/room/closet/diary/tunnel/kg 路由 | P1 起逐步加 |

---

## 8. 关键不变量(供后人 grep)

- **租户隔离**:任何 query 都必须有 `tenant_id` 过滤;没有 tenant_id 就**拒绝执行**(Supervisor 友好)。
- **逐字保护**:Drawer.content 只增不改;normalize 失误时通过 `normalize_version` bump + 静默重建。
- **Wing.scope 锁定**:Space 创建后不可改 scope_type(避免迁移)。
- **Closet 不替代 Drawer**:closet 只是索引,真实内容永远在 drawer。
- **后台优先**:写入路径 100% 在 SSE done 之后 `asyncio.create_task`。

---

_next: `02-PR1-skeleton.md`_
