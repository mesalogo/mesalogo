# 04 — PR3:时态 KG + Tunnel + Reflection

> **状态**:未开工(依赖 P2 合并)
> **预估工作量**:5-7 天
> **建议分支名**:`feat/mempalace-v0.51-p3-kg-reflection`

---

## 0. 这个 PR 想达到什么

把"被动事实集合"升级为"**有时态、有矛盾检测、能反思的认知系统**"。

**完成后这三个场景必须能跑**:

1. **矛盾检测**
   ```
   旧 KG: (用户A, 配偶, 张三, valid_to=NULL)
   新对话: "我前夫张三..."
   → 抽出 (用户A, 前夫, 张三),与 current 三元组不同;
   → 写入新三元组 + 旧三元组 valid_to=now,current=False
   → recall 时 KG 校验旧 drawer 标 stale
   ```

2. **跨 Wing 召回**
   ```
   Agent 在 wing_A(项目 X)recall("数据库设计原则")
   → wing_A 没有 → 通过 tunnel 找到 wing_B(项目 Y)的 room "数据库决策"
   → 返回 wing_B 的 drawer,带 source_wing 标识
   ```

3. **反思日记**
   ```
   任务结束 → 触发 mp_reflect_episode
   → LLM 读最近 N 条 drawer,产出 1 条 AgentDiary
   → 该 diary 同时作为高 importance Drawer 写入 wing
   → 后续 recall 优先返回反思条目
   ```

---

## 1. 范围

### 1.1 这个 PR 做

- ✅ 新建 3 张表:`memory_tunnel` / `knowledge_triple` / `agent_diary`
- ✅ KG 抽取(LLM 抽 (s,p,o);只在 reflect 时跑,不是每条 drawer)
- ✅ KG 矛盾检测 + valid_to 维护
- ✅ `fact_check(text)` 工具:用 KG 找矛盾(ported from mempalace 思路)
- ✅ Tunnel:被动发现(同名 room 自动连)+ 主动创建(`create_tunnel` 工具)
- ✅ `MemoryReader.recall` 引入 `fallback_via_tunnels`
- ✅ `MemoryReader.recall` 引入 `kg_verify` 标 hit 状态
- ✅ Reflection job(`mp_reflect_episode`)
- ✅ `AgentDiary` 写入 + 高 importance Drawer 写入
- ✅ Wing.config 配置项:`reflection_mode: per_task | manual | disabled`
- ✅ MCP 工具:`reflect`、`fact_check`、`create_tunnel`

### 1.2 这个 PR **不做**

- ❌ 前端 → P4
- ❌ 旧 graphiti adapter → P4
- ❌ memory_sync_service 重写 → P4
- ❌ AAAK 压缩(评估后再说,可能永远不做)

---

## 2. 关键设计

### 2.1 时态 KG:抽取 vs 校验分开

**抽取**(贵):只在 reflection 时由 LLM 一次性产出:

```python
# 在 mp_reflect_episode 里
prompt = f"""
基于以下对话,抽取关键事实三元组(subject, predicate, object)。
只输出可验证的客观事实,不输出主观判断。
返回 JSON: [{{"s": "...", "p": "...", "o": "..."}}]

对话:
{recent_drawers_text}
"""
triples = await llm.extract_json(prompt)
```

**校验**(便宜):recall 时每条 hit 用 SQL 比对:

```python
async def kg_verify(content: str, tenant_id: str) -> Literal["ok", "stale", "contradicted", "unknown"]:
    # 解析 content 中的简单陈述(规则版,不调 LLM)
    claims = extract_claims_simple(content)  # ["X 是 Y 的 Z" 这种]
    for s, p, o in claims:
        rows = await db.fetch_all("""
            SELECT predicate, object, valid_to, current
            FROM knowledge_triple
            WHERE tenant_id=:t AND subject=:s
        """, ...)
        for r in rows:
            if r.subject == s and r.object == o:
                if r.valid_to and r.valid_to < now():
                    return "stale"
            if r.subject == s and r.predicate != p and r.current and r.object == o:
                return "contradicted"
    return "ok" if claims else "unknown"
```

> 这条直接借鉴 mempalace 的 `fact_checker.py` 路线,但我们改成 SQL 而不是 SQLite。

### 2.2 Tunnel 三种来源

```python
class TunnelKind(str, Enum):
    PASSIVE = "passive"   # 跨 wing 同名 room 自动连
    ACTIVE  = "active"    # Agent 显式 create_tunnel 创建
    SIMILAR = "similar"   # 跨 wing 高相似度 room 自动连(可选)
```

**被动发现 job** `mp_tunnel_discover`:每天 04:30 跑

```python
async def discover_tunnels():
    # 同 tenant 下,不同 wing,同名 room → upsert tunnel kind=passive
    rows = await db.fetch_all("""
        SELECT a.id AS src, b.id AS dst, a.wing_id AS sw, b.wing_id AS dw
        FROM memory_room a, memory_room b
        WHERE a.id < b.id
          AND a.wing_id != b.wing_id
          AND a.name = b.name
          AND a_wing.tenant_id = b_wing.tenant_id  # 同租户
    """)
    for r in rows:
        await upsert_tunnel(src_room_id=r.src, dst_room_id=r.dst, kind="passive")
```

### 2.3 fallback_via_tunnels

```python
async def fallback_via_tunnels(wing, query, cues, k):
    # 找当前 wing 的 outgoing tunnels → 这些 dst_room 所在的 wing
    dst_wings = await db.fetch_all("""
        SELECT DISTINCT dst_wing_id FROM memory_tunnel
        WHERE src_wing_id = :wid
    """, wid=wing.id)

    if not dst_wings:
        return []

    # 在这些 dst_wing 内做 closet-first hybrid 检索
    hits = []
    for dw in dst_wings:
        hits += await hybrid_search(kind="closet", wing_id=dw, query=query, k=10)
    # ... 后续 hydrate + rerank
    return hits[:k]
```

### 2.4 Reflection 流水线

```python
async def mp_reflect_episode(wing_id: int, agent_id: str, window: dict):
    """
    window 例:{"from_drawer_id": 1000, "to_drawer_id": 1099}  # 任务窗口
    """
    drawers = await fetch_drawers_in_window(wing_id, window)
    if len(drawers) < 3:    # 太少不反思
        return

    # 1. LLM 反思
    prompt = build_reflection_prompt(drawers)
    reflection_md = await llm.complete(prompt)

    # 2. 写 Diary
    diary = AgentDiary(
        agent_id=agent_id, wing_id=wing_id,
        summary=reflection_md.split("\n", 1)[0][:512],
        reflection_md=reflection_md,
        source_window=window,
    )
    await db.add(diary)

    # 3. 同时作为高 importance Drawer 写入(让 recall 能命中)
    await MemoryWriter().write_drawer(DrawerWritePayload(
        agent_id=agent_id,
        content=reflection_md,
        room_hint="reflections",     # 自动归入 reflections room
        importance=0.85,
        source_kind="reflection",
        source_ref={"diary_id": diary.id},
    ))

    # 4. 顺便抽 KG 三元组
    triples = await llm.extract_triples(drawers_text)
    for t in triples:
        await upsert_kg_triple(tenant_id=wing.tenant_id, **t)
```

**触发**(在 `wing.config.reflection_mode` 控制下):

| 模式 | 何时触发 |
|---|---|
| `per_task` | 任务结束(ActionTask 状态 done/failed) |
| `manual` | Agent / 用户调 `reflect` 工具 |
| `disabled` | 不触发 |

### 2.5 LLM 调用复用现有 model client

**绝对不**新建 LLM 客户端。从 `core/` 已有的 model client 拿:
- ActionSpace 配置的 model 优先
- 否则用 tenant 默认 model

KG 抽取 / Reflection 都默认低 token budget(max_tokens=512)。

---

## 3. 文件清单

### 3.1 新建

```
backend-fastapi/app/services/memory_palace/
├── kg.py                    # KG CRUD + 矛盾检测
├── kg_extract.py            # LLM 三元组抽取
├── tunnel.py                # Tunnel CRUD + 被动发现
├── reflection.py            # Reflection 流水线
└── claim_parser.py          # 简单陈述抽取(规则版,kg_verify 用)

backend-fastapi/app/tasks/
├── mp_tunnel_discover.py    # 每天 04:30 跑
├── mp_reflect_episode.py    # 任务结束触发
├── mp_kg_gc.py              # 每周日 04:00 跑
└── mp_decay_drawer.py       # 每天 03:00 跑(P2 已建,这里完善)

backend-fastapi/migrations/versions/
└── XXXX_mempalace_p3_kg_tunnel_diary.py

backend-fastapi/tests/memory_palace/
├── test_kg_contradiction.py
├── test_kg_temporal.py
├── test_tunnel_discover.py
├── test_tunnel_active.py
├── test_reflection.py
└── test_recall_with_kg_verify.py
```

### 3.2 修改

| 文件 | 改动 |
|---|---|
| `reader.py` | recall 引入 fallback_via_tunnels + kg_verify |
| `writer.py` | drawer 写入完成后,**不立即**抽 KG(改在 reflection) |
| `mcp_servers/memory_palace.py` | 新增 `reflect` / `fact_check` / `create_tunnel` 工具 |
| `routes/memory_palace.py` | 新增 `/api/memory/v2/{kg,tunnel,diary,reflect}` 路由 |
| `app/services/scheduler/` | 注册 mp_reflect_episode 在 ActionTask 完成事件 |

---

## 4. 验收标准

### 4.1 KG 矛盾检测准确性

```python
async def test_kg_contradiction_detected():
    """同 subject, 不同 predicate,且都 current → 标 contradicted"""

async def test_kg_stale_fact_detected():
    """valid_to < now() 的 triple 被命中 → 标 stale"""

async def test_kg_no_false_positive_when_compatible():
    """不同 subject 的事实不会误标"""
```

### 4.2 Tunnel 召回

```python
async def test_recall_falls_back_to_tunnel():
    """wing_A 无 hit → 通过 passive tunnel 命中 wing_B 的 drawer"""

async def test_active_tunnel_creation():
    """Agent 调 create_tunnel 后,fallback_via_tunnels 立刻可用"""

async def test_tunnel_dedup():
    """同一对 (src_room, dst_room) 不会被建两次"""
```

### 4.3 Reflection

```python
async def test_reflection_writes_diary_and_drawer():
    """reflect 后:AgentDiary 1 条 + memory_drawer 1 条(importance ≥ 0.8)"""

async def test_reflection_skips_when_too_few_drawers():
    """drawer < 3 不触发 LLM 调用"""

async def test_reflection_disabled_mode():
    """wing.config.reflection_mode=disabled 时,任务结束不触发"""
```

### 4.4 召回质量提升

P2 fixture 重跑,top-1 / top-5 命中率应有可观测提升(因为 reflection 的 drawer 更聚焦)。
**目标**:top-1 ≥ 70%(P2 是 60%),top-5 ≥ 88%(P2 是 80%)。

---

## 5. 风险 & 防护

| 风险 | 防护 |
|---|---|
| LLM 抽 KG 抽出垃圾 | prompt 加"不输出主观判断";触发后人工 review 前 100 条 |
| Reflection token 成本失控 | 默认 max_tokens=512;wing.config 可强制关闭;失败不重试 |
| Tunnel 风暴(同名 room 太多→ N×N tunnel 爆炸) | 同一 wing 对最多保留 top-K=20 tunnels;超过的按 importance 截断 |
| KG 数据膨胀 | mp_kg_gc 每周清理 valid_to < now()-365d 的 triple |
| 跨 wing fallback 泄露其他 tenant 数据 | 所有 tunnel 查询都加 tenant_id 过滤(关键不变量,见 01-architecture §8) |
| 反思递归(reflection drawer → 又被反思) | source_kind="reflection" 的 drawer 在反思窗口里被排除 |

---

## 6. 给 Reviewer 的检查清单

- [ ] §3 文件清单内,无外溢
- [ ] KG 三张表迁移在 staging 上 upgrade ↔ downgrade 都跑通
- [ ] tenant 隔离测试覆盖跨 wing 场景
- [ ] Reflection job 在 staging 跑过 1 个完整 ActionTask 周期
- [ ] LLM 调用走项目已有 model client,**没**引入新 SDK
- [ ] 召回质量 fixture top-1 / top-5 数据贴在 PR 描述
- [ ] P1 + P2 测试全部仍绿

---

_next: `05-PR4-adapter-frontend.md`_
