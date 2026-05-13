# 03 — PR2:Closet 索引层 + Hybrid 混合检索

> **状态**:未开工(依赖 P1 合并)
> **预估工作量**:3-5 天
> **建议分支名**:`feat/mempalace-v0.51-p2-closet-hybrid`

---

## 0. 这个 PR 想达到什么

把 P1 的"裸向量检索"升级为 **mempalace 同款** closet-first 双层 + hybrid 混合 + 实体 cue 过滤。
召回质量是 v0.51 的核心卖点,这里是关键一战。

**完成后这个场景必须更准**:

```
用户先聊咖啡(8 条 drawer),再聊数据库(8 条),再聊咖啡(2 条)
P1 recall("我以前喜欢什么咖啡"):可能命中数据库相关的(向量噪声)
P2 recall(...):closet 先粗定位到"咖啡" room,再 drawer 级精检 + BM25 加权 → 准确召回
```

---

## 1. 范围

### 1.1 这个 PR 做

- ✅ 新建 1 张表:`memory_closet`
- ✅ Closet 自动构建 job(进 `job_queue/`):规则版,无 LLM 依赖
- ✅ Closet 在 Milvus 也存向量(`kind="closet"`)
- ✅ `MemoryReader.recall()` 升级为 **closet-first hybrid + layered fallback**
- ✅ BM25 实现(MariaDB FULLTEXT + ngram parser,中文友好)
- ✅ 实体抽取(规则 + 内置实体名册;入 `MemoryDrawer.entities` JSON)
- ✅ Cue 多线索召回(`recall(query, cues={entities, time_window, tags})`)
- ✅ Rerank(cosine + bm25 + importance × decay × recency × cue_match)
- ✅ Importance 衰减 job(`mp_decay_drawer`)
- ✅ pytest 覆盖检索质量基线(对比 P1 召回的 mock 数据集)

### 1.2 这个 PR **不做**

- ❌ KG / fact_check → P3
- ❌ Tunnel / 跨 wing fallback 中只走 realm,不走 tunnel → P3
- ❌ Reflection → P3
- ❌ LLM 版 closet 重建 → 留接口,默认关
- ❌ 前端 → P4

---

## 2. 关键设计

### 2.1 Closet 是什么、不是什么

**是**:room 的"小目录页"。
- ≤ 1500 字符,JSON 列表 `[{topic, entities, drawer_ids}, ...]`
- 单条 line 不可拆;装不下就建第二个 closet
- 自带向量;搜索时**先打 closet 集合**,命中后再 hydrate 到 drawer

**不是**:
- ❌ 总结(总结会丢信息;closet 是指针)
- ❌ 替代 drawer(drawer 永远是 ground truth)

### 2.2 Closet 构建规则(P2 默认走规则版,无 LLM)

输入:一个 room 的所有 active drawer。
输出:覆盖该 room 的 N 个 closet 行。

```python
def build_closet_lines(drawers: list[Drawer]) -> list[ClosetLine]:
    lines = []
    for drawer in drawers:
        topics  = extract_topics(drawer.content)        # 句首动词短语 / heading / 列表项
        ents    = drawer.entities or extract_entities(drawer.content)
        for topic in topics:
            lines.append(ClosetLine(
                topic=topic,
                entities=ents,
                drawer_ids=[drawer.id],
            ))
    # 去重 + 同 topic 合并 drawer_ids
    return merge_lines(lines)
```

**触发时机**:
- room.drawer_count_since_rebuild ≥ `wing.config.closet_rebuild_threshold`(默认 5)
- 或后台每小时全量扫描一次"超过 24h 未重建"的 room

**冷却**:同一 room 5 分钟内不重复重建(Redis 锁)。

### 2.3 BM25 实现(MariaDB FULLTEXT + ngram)

```sql
ALTER TABLE memory_drawer ADD FULLTEXT INDEX ft_drawer_content (content) WITH PARSER ngram;
ALTER TABLE memory_closet ADD FULLTEXT INDEX ft_closet_lines  ((CAST(lines AS CHAR(2000)))) WITH PARSER ngram;
-- ngram_token_size=2,中文 OK
```

```python
async def bm25_search(kind, query, k, **filters):
    sql = """
    SELECT id, room_id,
           MATCH(content) AGAINST (:q IN NATURAL LANGUAGE MODE) AS score
    FROM memory_drawer
    WHERE room_id IN :room_ids AND decay_state = 'active'
    ORDER BY score DESC LIMIT :k
    """
    return await db.execute(sql, ...).fetchall()
```

**fallback**:
- MariaDB 版本不支持 ngram(<10.0.6) → 切换到 Python `rank_bm25` 库 + Redis 缓存倒排表(每个 room 一份)
- 该 fallback 写在 `bm25_search.py`,默认 try MariaDB,catch 后回落

### 2.4 RRF 融合(无需归一化)

```python
def rrf_merge(vec_hits, bm25_hits, k_const=60, weights=(0.6, 0.4)) -> list[Hit]:
    """Reciprocal Rank Fusion。"""
    scores = defaultdict(float)
    for rank, h in enumerate(vec_hits):
        scores[h.id] += weights[0] / (k_const + rank + 1)
    for rank, h in enumerate(bm25_hits):
        scores[h.id] += weights[1] / (k_const + rank + 1)
    return sorted(items_by_id(scores), key=lambda x: -scores[x.id])
```

> 不用线性加权(cosine 是 [-1,1]、BM25 是 [0,∞),归一化容易翻车)。RRF 简单稳健,mempalace 也用这个。

### 2.5 Rerank(最终排序)

```python
def rerank(hits, query, cues, weights):
    now = time.time()
    for h in hits:
        days_old   = (now - h.created_at) / 86400
        recency    = math.exp(-days_old / 30)             # τ=30 天
        decay      = 1.0 if h.decay_state == "active" else 0.5
        cue_match  = 1.0 if cues and any(e in h.entities for e in cues.entities) else 0.0
        h.final_score = (
            weights["cosine"]     * h.cosine
          + weights["bm25"]       * h.bm25
          + weights["importance"] * h.importance
          + weights["recency"]    * recency
          + weights["cue_match"]  * cue_match
        ) * decay
    return sorted(hits, key=lambda x: -x.final_score)
```

### 2.6 Cue 多线索召回

```python
class Cues(BaseModel):
    entities:    list[str] | None = None    # 人/项目/工具名
    time_window: tuple[datetime, datetime] | None = None
    tags:        list[str] | None = None
```

- `entities` 命中 ≥ 1 才保留(在 `hybrid_search` 内做)
- `time_window` 走 Milvus expr `created_at >= ... AND created_at <= ...`
- `tags` 暂存 drawer.source_ref.tags(P2 不深做)

---

## 3. 文件清单

### 3.1 新建

```
backend-fastapi/app/services/memory_palace/
├── closet_builder.py        # Closet 构建规则版
├── closet_job.py            # Job 入口(被 job_queue 调度)
├── bm25.py                  # BM25 实现 + MariaDB / Python 双轨
├── rrf.py                   # RRF 融合
├── rerank.py                # 最终 rerank
├── entity_extractor.py      # 规则版实体抽取
├── decay.py                 # 衰减计算
└── cues.py                  # Cues 数据结构 + 解析

backend-fastapi/migrations/versions/
└── XXXX_mempalace_p2_closet.py    # closet 表 + drawer/closet FULLTEXT 索引

backend-fastapi/tests/memory_palace/
├── test_closet_builder.py
├── test_bm25.py
├── test_hybrid_recall.py
├── test_cue_filter.py
└── data/
    └── recall_quality_fixture.jsonl  # 30 个 query/expected drawer pair
```

### 3.2 修改

| 文件 | 改动 |
|---|---|
| `app/services/memory_palace/reader.py`(P1 已建) | `recall` 方法升级为 closet-first hybrid |
| `app/services/memory_palace/writer.py` | 写入完成后:enqueue closet 重建 |
| `app/api/routes/memory_palace.py` | `recall` 端点接受 cues 参数 |
| `app/mcp_servers/memory_palace.py` | `recall` 工具签名加 cues |
| `app/tasks/` | 新增 closet 重建后台任务 |

---

## 4. 验收标准

### 4.1 召回质量基线(关键!)

准备 `recall_quality_fixture.jsonl`(30 条):

```jsonl
{"query": "用户咖啡偏好", "expected_drawer_id": "...", "tenant_id": "test", "wing_id": 1}
{"query": "数据库索引设计决策", "expected_drawer_id": "...", "tenant_id": "test", "wing_id": 1}
...
```

执行测试:

```python
async def test_recall_top1_hit_rate():
    """P2 recall 在 fixture 上 top-1 命中率 ≥ 60%,top-5 ≥ 80%"""
    hit_top1 = 0
    hit_top5 = 0
    for case in load_fixture():
        hits = await recall(case.query, ...)
        if hits[0].drawer_id == case.expected:
            hit_top1 += 1
        if any(h.drawer_id == case.expected for h in hits[:5]):
            hit_top5 += 1
    assert hit_top1 / len(cases) >= 0.6
    assert hit_top5 / len(cases) >= 0.8
```

> 数字是**起步线**,不是终点。P3 引入 KG 后会再涨一档;P4 才考虑可选 LLM rerank。

### 4.2 closet 命中率

```python
async def test_closet_first_recall_rate():
    """closet-first 路径命中 room 的比例 ≥ 70%(剩下走 fallback)"""
```

### 4.3 性能 sanity

- 单次 recall(closet+drawer 双层)< 800ms(中等数据集)
- closet 重建 < 2s/room(50 drawers)
- 每分钟可处理 ≥ 50 次 closet 重建(Redis 队列消费速率)

### 4.4 不退化 P1

```bash
pytest tests/memory_palace/ -v
# P1 全部测试 + P2 新增测试都绿
```

---

## 5. 风险 & 防护

| 风险 | 防护 |
|---|---|
| 中文 BM25 召回质量差 | ngram_token_size=2 + 测试 fixture 覆盖中英混合;不达标回落 Python BM25 |
| Closet 重建风暴(每条 drawer 触发) | Redis 锁 + threshold + 5 分钟冷却三重保护 |
| RRF 融合反而变差 | 测试 fixture 跑 vec-only / bm25-only / RRF 三组对比;PR 描述贴对比表 |
| Cue 过滤过严 = 召回为 0 | cues 命中 0 条时 fallback 到无 cue 检索;单测覆盖 |
| 衰减误删活跃数据 | decay job dry_run 模式先跑一次,人工 review 候选清单后再启动 |

---

## 6. 给 Reviewer 的检查清单

- [ ] §3 文件清单内,无外溢
- [ ] FULLTEXT 索引迁移在 staging 上跑过,贴日志
- [ ] 召回质量 fixture 在 PR 描述里贴出 top-1 / top-5 数据
- [ ] closet 重建 job 跑过压测(50 room × 50 drawer),无 Redis 锁泄漏
- [ ] `git grep -E "import requests|threading\." app/services/memory_palace/` 为空
- [ ] P1 测试全部仍绿

---

_next: `04-PR3-kg-reflection.md`_
