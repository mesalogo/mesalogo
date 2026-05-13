# 08 — 记忆的本质:为什么是"双层时态 KG"

> 本文回答一个根本性问题:**记忆 = 时态 KG 吗?**
> 这是 v0.51 设计阶段的最后一块拼图。所有后续 PR 落地、所有"为什么不用 Neo4j / Graphiti / Mem0" 的质疑,都从这里取标准答复。
> 阅读对象:任何质疑过 v0.51 架构选型的人,以及未来接手特性的 Agent / 开发者。

---

## 0. 一句话回答

> **记忆 = 时态 KG?对一半。**
>
> **完整的说法是:记忆 = 时态 KG(事实层) + Verbatim Drawer(叙事层),两层互相校验、互相补充,共同构成"宫殿"。**
>
> 这正是 MemoryPalace v0.51 的设计——完全脱离 Graphiti / Neo4j,跑在已有栈上(MariaDB + Milvus + Redis),功能上**等价或超越** Graphiti。

---

## 1. 命题:记忆为什么必须是双层

### 1.1 反例:如果只用单层时态 KG 会怎样

假设我们头脑发热,把所有记忆都拆成时态三元组,只存 `knowledge_triple` 一张表。

用户输入这段话:

> "我昨天和李雷一起去了星巴克,他点了拿铁,我点了美式,
>  聊起了产品 X 的库存问题,他说他们公司也遇到同样的问题。"

LLM 抽取后写入 KG:

```
(用户A, 同行, 李雷,         valid_from=昨天, current=True)
(用户A, 去过, 星巴克,       valid_from=昨天, current=True)
(李雷, 点了, 拿铁,          valid_from=昨天, current=True)
(用户A, 点了, 美式,         valid_from=昨天, current=True)
(用户A, 讨论, 产品X 库存,   valid_from=昨天, current=True)
(李雷, 同感, 产品X 库存问题, valid_from=昨天, current=True)
```

**会出 4 个问题**:

#### 问题 1:语境信息丢失

"和李雷一起" 的语境(他们是朋友?同事?第一次见?)无法用三元组表达;
"他说他们公司也遇到"的因果关联无法用三元组表达;
"聊起了"的轻描淡写语气无法用三元组表达。

LLM 抽取的瞬间,**这些信息消失了,且不可恢复**——因为原话没存。

#### 问题 2:抽取错误不可逆

"李雷同感"这条三元组其实是 LLM 的过度抽取——李雷可能只是礼貌附和,不是真同感。

但这个错误三元组进了 KG 之后,**没法回到原文核对**,因为原文你都没存。
将来 Agent 引用这条三元组,就会以为"李雷的公司也有产品 X 库存问题",可能直接误导业务决策。

#### 问题 3:成本爆炸

每条对话都过一遍 LLM 抽 KG → token 成本 × N(N = 平均每段对话能抽出的三元组数,通常 5-15)。
我们的 ABM 平台是高并发场景,这种 cost 直接打爆预算。

#### 问题 4:Agent 的"记忆体验"差

用户问 Agent:"我们昨天聊了啥?"

单层 KG 系统回答:
> "你昨天和李雷同行,去过星巴克。李雷点了拿铁,你点了美式。你们讨论了产品 X 库存问题,李雷同感。"

这是机械的事实列表,**不是记忆**。人类期望的回答是:

> "你昨天和李雷在星巴克喝咖啡,聊起了产品 X 的库存问题,他说他们公司也遇到了同样的情况。"

这种**有语境的复述**,只能从原文重建,不能从三元组重建。

### 1.2 反例:如果只用单层 Drawer 会怎样(就是当前的 LightRAG / Mem0 路线)

假设另一极端:全部存原文 + 向量检索,不抽 KG。

会出 3 个问题:

#### 问题 1:无法回答"现在"

用户在 1 月份说"我老婆叫李四",在 8 月份说"我前妻李四"。

Agent recall 时:向量检索两条都返回,Agent **看运气说话**,可能在 9 月份还问"你老婆李四最近怎样"。

#### 问题 2:fact_check 做不到

Agent 准备说"产品 X 还有货",但客观事实是产品 X 上周停售了。

无 KG → Agent 完全不知道,信口开河,客户投诉。

#### 问题 3:跨会话的"事实查询"必须全文检索

"用户的过敏史"、"用户的电话"、"用户的偏好"——这些是稳定事实,本应一条 SQL 拿到,但纯 RAG 必须全文检索 + LLM 总结,**慢且不可靠**。

### 1.3 结论:必须双层

| 形态 | 名字 | 存什么 | 解决的问题 |
|---|---|---|---|
| **A. 叙事型** | Drawer (verbatim 原文) | 完整对话 / 工具结果 / 反思 | 保留语境、可校核、可重建对话 |
| **B. 事实型** | Knowledge Triple (时态三元组) | 抽象出的可验证事实 | 当前真值查询、矛盾检测、跨会话事实 |

两层**互相校验、互相补充**,缺一不可。

---

## 2. 认知科学的旁证(顺便讲清楚为什么这样分是"对"的)

人脑的记忆系统**本来就是**这么分的:

| 大脑层 | 学术名 | 存储 | 例子 |
|---|---|---|---|
| **情景记忆** | Episodic Memory | 海马体 | "上周三我和李雷在星巴克喝咖啡" |
| **语义记忆** | Semantic Memory | 新皮质 | "李雷的电话是 138……";"产品 X 已停售" |

并且,这两层之间存在一个**"巩固"过程(consolidation)**:
- 短期内,情景记忆保留所有细节
- 长期看,反复出现的事实**沉淀**到语义记忆,情景细节淡化

我们 v0.51 的架构**正好对应**:

| 大脑 | MemoryPalace |
|---|---|
| 情景记忆(海马体) | Drawer 层(verbatim,可衰减) |
| 语义记忆(新皮质) | Knowledge Triple 层(时态 KG,稳定) |
| 巩固过程 | Reflection job(LLM 抽 KG,沉淀稳定事实) |
| 遗忘 | mp_decay_drawer(原文衰减,但 KG 保留) |

> 这不是巧合。这是因为"记忆"这个东西本质就该这么分——无论是生物大脑还是工程系统,设计原则相通。

---

## 3. 双层之间的接口(关键!)

两层不是孤立的,通过下面这些接口耦合:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌──────────────────┐                  ┌──────────────────┐    │
│   │   Drawer 层       │                  │   KG 层           │    │
│   │   (叙事/原文)     │                  │   (事实/时态)     │    │
│   │                  │                  │                  │    │
│   └────┬─────────────┘                  └─────────────┬────┘    │
│        │                                              │         │
│        │ ① Reflection 抽取                            │         │
│        │    (Drawer → 抽 (s,p,o) → 写 KG)              │         │
│        ├─────────────────────────────────────────────►│         │
│        │                                              │         │
│        │ ② KG 校验 Drawer                             │         │
│        │    (recall 时,kg_verify(drawer.content))    │         │
│        │◄─────────────────────────────────────────────┤         │
│        │    返回 stale / contradicted / ok            │         │
│        │                                              │         │
│        │ ③ 矛盾时维护时态                              │         │
│        │    (新 drawer → 抽 KG → 与 current 比对)      │         │
│        │       不一致 → 旧 triple valid_to=now        │         │
│        ├─────────────────────────────────────────────►│         │
│        │                                              │         │
│        │ ④ source_drawer_id 反向引用                   │         │
│        │    (每条 KG 三元组都记得它来自哪条 drawer)    │         │
│        │◄─────────────────────────────────────────────┤         │
│        │                                              │         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 接口①:Drawer → KG(抽取)

**何时触发**:
- Reflection job 触发时(默认每个任务结束)
- 不是每条 drawer 都立刻抽 → 控制 LLM 成本

**怎么抽**:
```python
# 在 mp_reflect_episode
prompt = """基于以下对话,抽取关键事实三元组(subject, predicate, object)。
只输出可验证的客观事实,不输出主观判断。
"""
triples = await llm.extract_json(prompt + drawers_text)
for s, p, o in triples:
    await upsert_kg_triple(tenant_id, s, p, o, source_drawer_id=...)
```

**抽出的三元组保留来源**:
```sql
INSERT INTO knowledge_triple
  (tenant_id, subject, predicate, object,
   valid_from, current, source_drawer_id, source)
VALUES
  (?, ?, ?, ?, NOW(), TRUE, ?, 'reflection')
```

**这就是为什么我们的 `knowledge_triple` 表必须有 `source_drawer_id` 字段**——保留可追溯性。Mempalace 也是这么做的。

### 3.2 接口②:KG → Drawer(校验)

**何时触发**:
- recall 返回结果前(每条 hit 都校验一次,可缓存)
- fact_check 工具调用时

**怎么校验**:
```python
async def kg_verify(content: str, tenant_id: str) -> Literal["ok", "stale", "contradicted", "unknown"]:
    # 1. 简单陈述抽取(规则版,不调 LLM)
    claims = extract_claims_simple(content)   # ["X 是 Y 的 Z" 这种]
    if not claims:
        return "unknown"

    # 2. 对每个陈述查 KG
    for s, p, o in claims:
        rows = await db.fetch_all("""
            SELECT predicate, object, valid_to, current
            FROM knowledge_triple
            WHERE tenant_id=:t AND subject=:s
        """, ...)

        for r in rows:
            # 同主语、同宾语、不同谓语 + 都 current → 矛盾
            if r.subject == s and r.object == o and r.predicate != p and r.current:
                return "contradicted"
            # 同三元组,但已 valid_to → stale
            if (r.subject == s and r.predicate == p and r.object == o
                and r.valid_to and r.valid_to < now()):
                return "stale"
    return "ok"
```

**结果给 LLM 看**:返回结果的每条 hit 带 `kg_status` 字段,Agent 看到 stale/contradicted 红黄标自动避让。

### 3.3 接口③:矛盾时维护时态

**何时触发**:
- 新 drawer 写入并抽 KG 时,如果新三元组和已有 current=True 的冲突

**怎么维护**:
```python
async def upsert_kg_triple(tenant_id, s, p, o, source_drawer_id):
    # 找当前活跃的、同 subject 的事实
    existing = await db.fetch_all("""
        SELECT id, predicate, object FROM knowledge_triple
        WHERE tenant_id=? AND subject=? AND current=True
    """, ...)

    for ex in existing:
        # 同 subject、同 object、不同 predicate → 旧的关系类型变了
        if ex.object == o and ex.predicate != p:
            await db.execute("""
                UPDATE knowledge_triple
                SET valid_to = NOW(), current = False
                WHERE id = ?
            """, ex.id)

    # 写新三元组
    await db.execute("""
        INSERT INTO knowledge_triple (..., current=True, source_drawer_id=?)
        VALUES (...)
    """, ...)
```

**例子**:
```
原 KG: (用户A, 配偶, 李四, current=True)
新 drawer: "我前妻李四…"
抽出: (用户A, 前配偶, 李四)

upsert_kg_triple 检测到:
  - subject=用户A, object=李四,但 predicate 从 "配偶" 变成 "前配偶"
  - 旧三元组 valid_to=now(), current=False
  - 新三元组 (用户A, 前配偶, 李四, current=True) 写入

后续 recall 时:
  - 命中 1 月那条 drawer "用户A 老婆李四怎样怎样"
  - kg_verify 看到 (用户A, 配偶, 李四) 已 current=False
  - 标 stale → Agent 看到红黄标 → 不会再说错
```

### 3.4 接口④:source_drawer_id 反向引用

每条 `knowledge_triple` 都有 `source_drawer_id`。
意义:**KG 抽取出错时能回到原文核对**(对应 §1.1 问题 2 的解决方案)。

更进一步,fact_check 工具可以做 evidence-tracing:
```
用户:"产品 X 已停售"是真的吗?
fact_check:
  → KG 命中 (产品X, 状态, 已停售, current=True)
  → 这条三元组的 source_drawer_id=8743
  → drawer 8743 内容:"产品 X 因供应链问题于 2026-01-15 起停售。来源:KB 文档 product_lifecycle.pdf"
  → 返回:"是,依据 product_lifecycle.pdf"
```

---

## 4. 与 Graphiti / Neo4j 的对比(终结性回答)

### 4.1 Graphiti 是什么

Graphiti(getzep.com)= Zep 团队的开源时态知识图谱库,后端 Neo4j。
我们项目当前的 `memory_sync_service.py` 就是给它发 HTTP 同步对话。

**它的设计目标和我们一样**:让 LLM 有时态感知的记忆。

### 4.2 那为什么我们要自研?

不是因为 Graphiti 设计错了,**是因为它在我们项目的工程约束下不合适**:

| 维度 | Graphiti(外部 HTTP + Neo4j) | v0.51(本地 MariaDB + Milvus) |
|---|---|---|
| **依赖** | Neo4j + Graphiti server | 已有栈,零新增 |
| **网络模型** | 跨进程 HTTP | 进程内 SQL |
| **并发模型** | 同步 IO(`requests` + 后台线程) | 全 async(httpx + asyncio) |
| **5000 并发** | 跨网络 + 阻塞 IO,不达标 | 直连数据库,达标 |
| **多租户隔离** | group_id 硬切片 | tenant_id + Wing 分层 |
| **关系图查询** | Cypher 强大 | SQL 单跳够用 |
| **5 跳关系推理** | 强(但我们用不到) | 弱(但我们用不到) |
| **运维复杂度** | 高(Neo4j 是个独立 DB) | 低(用现有 MariaDB) |
| **当前项目代码状态** | 80% TBD/mock,实际能力 ≈ 0 | (待实施,但路径清晰) |

**关键:Graphiti 强大的能力(5 跳路径查询、复杂 Cypher)我们用不到。我们的 99% 查询是单跳点查("subject 现在的 current 事实是什么"),关系表 + 索引就够了。**

### 4.3 这条路 mempalace 也是这么走的

我们参考的开源项目 mempalace(49.7k star,LongMemEval R@5=96.6%):

> Knowledge graph: **temporal entity-relationship triples (SQLite)**

它就是这么干的——**用 SQLite 存时态三元组**,效果照样 SOTA。
我们只是把它的 SQLite 换成 MariaDB(项目栈一致),思路一模一样。

### 4.4 那将来真要做复杂图查询怎么办

完全可以**在不改主存储**的前提下,起一个 Neo4j 副本做 ETL:

```
MariaDB.knowledge_triple (主存储,主路径用)
        │
        ▼ 每日 ETL job(可选,P5+)
Neo4j (副本,只用于复杂图查询,如社区发现/路径推理)
```

但**绝不当主存储**——主路径必须直连数据库,异步可控。

---

## 5. 那现有的 Graphiti 怎么处理

按 [`06-decisions.md` D1](./06-decisions.md#2026-04-26-d1-存储底座):

- 全部新代码不得 import graphiti SDK
- Graphiti 服务在 P4 阶段降级为**可选关系图可视化适配器**
- 旧 Graphiti 数据**不迁**(D4 决策),让它随 Neo4j 一起淘汰
- `memory_capability_service` 解耦:关 Graphiti ≠ 失忆

也就是说:**我们不是"少了一个图谱",我们是把图谱内化成两层(Drawer + KG),让它跑在已有栈上。**

---

## 6. 给未来质疑者的标准答复

### Q1: "记忆不就是时态 KG 吗?为什么还要 Drawer 层?"

A: 因为单层 KG 抽取损失语境、抽取错误不可逆、成本爆炸、记忆体验差。
人脑也分情景记忆(Drawer)和语义记忆(KG)两层。
详见本文 §1。

### Q2: "为什么不用 Graphiti?它就是干这个的。"

A: 我们事实上**就在做和 Graphiti 一样的事**——只是不依赖它,因为:
1. 它是 HTTP 跨网络,违反我们 5000 并发硬约束
2. 它依赖 Neo4j,部署复杂度 +1,运维成本上升
3. 它的 5 跳图查询能力我们用不到
4. 当前项目代码里它 80% 是 TBD/mock,实际等于没用
详见本文 §4。

### Q3: "为什么用 MariaDB?Neo4j 不更适合图查询吗?"

A: 我们 99% 的查询是**单跳点查**("某 subject 现在 current 的事实"),关系表 + 索引快得很。
真正的"图查询"(社区发现、5 跳推理)我们的业务用不到。
将来真要做,起 Neo4j 副本做 ETL 即可,**不当主存储**。
mempalace 用 SQLite 同样跑出 SOTA,关系表对这种用例是足够的。
详见本文 §4。

### Q4: "如果只用 Drawer + 向量检索(Mem0/LightRAG 那种)呢?"

A: 没法回答"现在什么是真的",fact_check 做不到,跨会话事实查询慢。
所以双层不可缺一。
详见本文 §1.2。

### Q5: "时态 KG 的数据会不会爆炸?"

A: 抽取频率可控:
- 默认只在 Reflection 时抽(每个任务一次,不是每条 drawer)
- mp_kg_gc job 每周清理 valid_to < now()-365d 的归档
- 每个 tenant 几千到几万条三元组的量级,索引一句 SQL 毫秒级返回
详见 [`04-PR3-kg-reflection.md` §2.1](./04-PR3-kg-reflection.md)。

---

## 7. 心智模型(必背)

```
记忆 ≠ 时态 KG (单层错)
记忆 ≠ Verbatim 原文 (单层错)

记忆 = Drawer 层(verbatim 叙事)+ KG 层(时态事实)
            ▲                          ▲
       保留语境 + 可校核              当前真值 + 矛盾检测
            │                          │
            └────── 双层互相校验 ────────┘
                          │
                  reflect 把 Drawer 沉淀为 KG
                  recall 时 KG 校验 Drawer 的 stale/contradicted
                          │
                          ▼
                    "记忆宫殿"
```

---

## 8. 这个心智模型对 PR 实施的指导

| PR | 这个心智模型怎么影响实现 |
|---|---|
| **P1** 骨架 | 只做 Drawer 层(`memory_drawer` 表 + `recall`),KG 表暂不建——先把"叙事"打通 |
| **P2** Closet+Hybrid | 仍然只对 Drawer 建索引,KG 不参与——优化叙事检索质量 |
| **P3** KG+Reflection | ⭐ **本架构的核心**:KG 表上线 + 接口①②③④全部就位 + Reflection 是 Drawer↔KG 的桥梁 |
| **P4** Adapter+Frontend | 前端要**同时展示 Drawer(原文)和 KG(事实徽标)**,让用户看到双层 |

---

## 9. 这份文档存在的意义

接下来 PR 实施时,你/Agent **一定**会遇到下面这些诱惑:

- "全用 KG 抽取吧,recall 就直接给 LLM 喂三元组,简洁"(❌ 见 §1.1)
- "全用向量检索吧,KG 太麻烦"(❌ 见 §1.2)
- "用 Neo4j 吧,图数据库才正宗"(❌ 见 §4)
- "Graphiti 修一修就行了,何必重写"(❌ 见 §4.2)
- "记忆 ≈ 数据库,何必这么多概念"(❌ 见整篇)

**遇到这些问题时,把人(包括你自己)指向这份文档**。

设计原则定下来不是为了限制创造,是为了**让讨论不再回到原点**。

---

_last human review: 2026-04-26_
_authors: human + droid (spec phase)_
