# 06 — 关键决策档案

> 本文记录 MemoryPalace v0.51 设计阶段所有**已锁定**的关键决策。
> 任何 PR 不得违反本文,除非先在此追加新决策段并经用户确认。
> 决策按时间倒序排列(新决策追加在最上面)。

---

## 决策格式

```
### [YYYY-MM-DD] 决策名
- 选项: A / B / C
- 选择: ⭐ A
- 理由: …
- 影响: …
- 反向条件: 什么情况下我们会重新考虑这条
```

---

## 2026-04-26 · 初始决策(Spec Phase)

### [2026-04-26] D0. 核心心智模型:记忆 = 双层(Drawer + 时态 KG)

- 命题:**记忆 = Verbatim Drawer 层(叙事) + Temporal KG 层(事实),两层互相校验**
- 选择:**⭐ 双层结构,缺一不可**
- 理由:
  - 单层时态 KG → 抽取丢语境、错误不可逆、成本爆炸、记忆体验差
  - 单层 Drawer/RAG → 无法回答"现在什么是真的"、fact_check 做不到、跨会话事实查询慢
  - 人脑也分情景记忆(Drawer)+ 语义记忆(KG),非偶然
  - mempalace(LongMemEval R@5=96.6%)同样是双层架构
- 影响:
  - `memory_drawer` 表(verbatim,可衰减/反思)+ `knowledge_triple` 表(时态,事实)互为镜像
  - Reflection 是两层之间的"巩固"桥梁(Drawer → 抽 → KG)
  - kg_verify 是反向校验(KG → 标 → Drawer)
  - 任何"全部用 KG"或"全部用向量"的提议都需要先驳倒本决策
- 反向条件:
  - 实测 KG 抽取准确率 < 50% 持续半年以上 → 重新评估是否退化为单层 Drawer + LLM rerank
- 详见: [`08-memory-as-temporal-kg.md`](./08-memory-as-temporal-kg.md)

---

### [2026-04-26] D1. 存储底座

- 选项:
  - A. 自研 MariaDB + Milvus(完全脱离 Graphiti)
  - B. 混合:自研为主,Graphiti 作为可选关系图 adapter
  - C. 继续基于 Graphiti,只补全 TBD 和异步化
- 选择:**⭐ A**
- 理由:
  - **D0 决策**:既然记忆 = Drawer + KG 双层,Graphiti 只覆盖 KG 层一半,无法承载 Drawer verbatim 语义
  - 项目栈已有 MariaDB + Milvus + Redis,**零新增基础设施**
  - Graphiti 当前路径有大量阻塞 IO + threading.Thread,违反 backend-fastapi/AGENTS.md §3.1
  - 关 Graphiti = 角色失忆,这条耦合必须切
  - mempalace 同类项目证明 ChromaDB(类似 Milvus)+ SQLite(类似 MariaDB)就能跑出 LongMemEval 96.6%
  - 99% 查询是单跳点查("subject 现在 current 的事实"),关系表 + 索引足够;不需要 Neo4j 的 5 跳推理
- 影响:
  - 全部新代码不得 import graphiti SDK
  - Graphiti 服务降级为可选关系图可视化适配器(P4)
  - 旧 Graphiti 数据**不迁**(见 D4)

### [2026-04-26] D2. Wing 默认作用域

- 选项:
  - A. ActionSpace(空间内共享)
  - B. Agent(每个 Agent 独享)
  - C. Role(同角色共享)
  - D. 让用户在创建空间时选
- 选择:**⭐ D**(默认 A)
- 理由:
  - 不同业务场景诉求差异极大(客服角色 vs 专属助手 vs 项目协作)
  - 创建表单加一个选项的成本远小于将来反复迁移
- 影响:
  - ActionSpace.config 增加 `wing_scope` 字段(JSON 字段,不改表结构)
  - **创建后不可改 wing_scope**(避免数据迁移),需要换时新建空间 + 复制工具(留 v0.6)
  - P1 必须支持 4 种 scope 解析逻辑(`wing_resolver.py`)
- 反向条件:
  - 如果 95% 用户都选默认值,P5 评估是否简化为只读默认 + admin 高级开关

### [2026-04-26] D3. 自动反思(Reflection)

- 选项:
  - A. 启用,默认每个任务结束跑一次
  - B. 启用,但只在用户显式触发时跑
  - C. 先不做,后期再上
- 选择:**⭐ 启用,阶段可选**(`reflection_mode: per_task | manual | disabled`)
- 理由:
  - 反思是"宫殿"区别于"平面 RAG"的核心增量
  - 给关闭开关避免 token 失控用户告状
- 影响:
  - Wing.config 加 `reflection_mode` 字段,默认 `per_task`
  - LLM 调用必须复用项目已有 model client(不开新预算)
  - max_tokens 默认 512,失败不重试
  - P3 实现,P4 在前端给配置 UI

### [2026-04-26] D6. UI 设计四要点

下列 UI 设计已锁定,详见 [`09-ui-design.md`](./09-ui-design.md):

#### D6.1 主页面布局
- 选项: 三栏 / 两栏 / 单栏
- 选择: **⭐ 三栏**(Wing 树 + Room 详情 + 右抽屉默认隐藏)
- 理由:
  - 信息密度高,管理者一屏看到全貌
  - 类比 VSCode 文件树,用户熟悉
  - 桌面优先(本就是管理/调试场景)

#### D6.2 KG 视图入口
- 选项: 单独菜单项 / 子 Tab / 高级模式开关
- 选择: **⭐ 单独菜单项 "Knowledge Graph"**
- 理由:
  - 时态 KG 是 v0.51 的核心卖点,值得独立入口
  - 管理者一眼看到,降低心智成本
  - 普通用户看到也不影响(他们不会点)

#### D6.3 对话页"记忆指示器"行为
- 选项: 始终显示数字 / 仅高亮提示 / 完全静默
- 选择: **⭐ 始终显示 `💭 N memories used`,可点击展开抽屉**
- 理由:
  - 让用户对"系统在用我什么记忆"有持续感知
  - 0 时也显示,让用户知道功能存在
  - 不打扰(数字小,不占空间)

#### D6.4 KG Timeline 视图
- 选项: P4 实现 / 留给 v0.6 / 不做
- 选择: **⭐ P4 实现**
- 理由:
  - 时态 KG 的视觉招牌(展示力强,demo 效果显著)
  - 技术不复杂(SVG 或 vis-timeline 库,~80KB)
  - 让客户/管理者直观看到"事实是会变的"
- 影响:
  - P4 工作量估算从 3-5 天调整为 5-6 天
  - 新增前端依赖:`vis-timeline` 或 SVG 自实现 + `cmdk`
  - 验收标准在 09-ui-design §11 有明确清单

---

### [2026-04-26] D5. 概念术语保留英文,不做中文翻译

- 选项:
  - A. 宅院体系中文(府/院/堂/室/目录/卷/廊/札记/事典)
  - B. 直译中文(翼/厅/房间/壁橱/抽屉/日记/隧道)
  - C. 档案馆派中文(馆/库/区/架/索引/卷)
  - D. **保留英文**(Realm / Wing / Hall / Room / Closet / Drawer / Tunnel / Diary / KG)
- 选择:**⭐ D**
- 理由:
  - 这些是**专有术语**,翻译反而引入歧义
  - 程序员日常已经习惯混合中英文(类比:Pod/Namespace/Workspace 也都不译)
  - 后端代码标识符本来就是英文(对齐仓库根 AGENTS.md §7)
  - 后期对外推广,英文术语自带"国际感",不用做版本切换
  - mempalace 社区(我们参考的开源项目)也都用英文,生态一致
- 影响:
  - **代码**:类名/字段名/工具名/路由名 — 英文(本来就是)
  - **后端文档**:术语英文(如 `MemoryWing`、`Closet 重建`)
  - **前端 UI**:术语英文 + 中文一句话 tooltip(首次看到时 hover 解释)
    例:界面显示 `Wing`,tooltip 写"一座院子,对应一个 ActionSpace 或角色的独立记忆单元"
  - **PR / Commit / Issue**:术语英文,描述中文
  - **错误信息 / log**:术语英文(对齐 AGENTS.md "log 消息用英文")
- 反向条件:
  - 用户调研发现 ≥ 50% 用户对英文术语困惑 → P4 前端阶段补一份中文别名(只 UI 层,代码不变)

---

### [2026-04-26] D4. 旧 Graphiti 数据迁移

- 选项:
  - A. 一次性 ETL 迁入新表
  - B. 不迁,新系统从此刻起重新积累
  - C. 提供工具但不默认执行
- 选择:**⭐ B**
- 理由:
  - 旧数据多为 mock/玩具数据,迁移工作量 > 价值
  - 减少 P1-P4 链路上的耦合点
- 影响:
  - 不写 ETL 脚本
  - 旧 `entity_node` / `episode` 在 Graphiti 服务关停后随 Neo4j 一起淘汰
  - 用户须重新沉淀(实际生产数据本来也少)

---

## 设计层硬性不变量

下列规则**不需要单独决策**,是项目级原则在本特性的延伸:

1. **租户隔离**:任何 query 必须有 `tenant_id` 过滤,缺失即拒绝执行
2. **逐字保护**:Drawer.content 只增不改;normalize 失误通过 `normalize_version` bump + 静默重建
3. **Wing.scope 锁定**:创建后不可改 scope_type
4. **Closet 不替代 Drawer**:closet 只是索引,真实内容永远在 drawer
5. **后台优先**:写入路径 100% 在 SSE done 之后 `asyncio.create_task`
6. **全 async**:`memory_palace/` 目录下禁止 `requests` / `threading.Thread` / `time.sleep`
7. **不动 9 万行 models.py**:新 ORM 放新文件
8. **不动 supervisor / rule_sandbox 放行语义**

---

## 已驳回的设想(留个记号防止反复讨论)

### "只在 prompt 里塞历史对话就行,不需要记忆系统"
- 上下文窗口涨到 100 万 token 也解决不了"几万条对话历史 + 多 Agent + 多任务"的问题
- 每轮都全量塞 = token 成本爆炸 + 噪声压过信号
- 项目早期已经踩过(见 TODO.md "上下文爆炸")

### "直接用 Mem0 / Letta / Zep 商业方案"
- 商业方案数据不出本地不安全(我们是 ABM 仿真平台,可能涉敏)
- mempalace 路线证明开源自研可达 SOTA
- 项目栈已经齐了,不缺组件

### "把 Graphiti 修好就行"
- 修好 = 改完 §3.1 阻塞 IO + 填掉 5 个 TBD + 重设计层级 + 重设计 Reflection,工作量 ≥ 重写
- Graphiti 的 group_id 模型本身就不支持层级(参见 PLAN-memory-partition.md §3.2 的"层次化查询" TBD)
- 修完还是耦合 Neo4j,部署复杂度回不去
- **更根本的问题**:Graphiti 是 KG 层的库,不覆盖 Drawer 层(verbatim 叙事),与 D0 双层架构不匹配。详见 [`08-memory-as-temporal-kg.md` §4](./08-memory-as-temporal-kg.md)

### "用 Neo4j 做时态 KG"
- KG 数据规模可控(每 tenant 几千条到几万条),关系表 + 索引足够
- 增加 Neo4j 依赖 = 部署复杂度 +1,不划算
- mempalace 用 SQLite 跑得很好,我们用 MariaDB 等价
- **99% 查询是单跳点查**("某 subject 现在 current 的事实"),不需要 Cypher 多跳能力
- 将来真要做复杂图查询,起 Neo4j 副本做 ETL 即可,**不当主存储**

### "全部用时态 KG 就行,不需要 Drawer 层"(单层 KG 路线)
- **驳**:违反 D0。详见 [`08-memory-as-temporal-kg.md` §1.1](./08-memory-as-temporal-kg.md)
  - 抽取损失语境(语气、因果、上下文)
  - 抽取错误不可逆(原文都没存,无法回核)
  - LLM 抽取成本爆炸(每条 drawer 都过一遍)
  - Agent 记忆体验差(只能复述事实列表,不能复述对话场景)

### "全部用 Drawer + 向量检索就行,不需要 KG 层"(单层 RAG 路线,Mem0/LightRAG 模式)
- **驳**:违反 D0。详见 [`08-memory-as-temporal-kg.md` §1.2](./08-memory-as-temporal-kg.md)
  - 无法回答"现在什么是真的"(老婆变前妻问题)
  - fact_check 工具完全做不到
  - 跨会话事实查询必须全文检索 + LLM 总结,慢且不可靠

---

## 后续可重新决策的点(等数据再说)

| 时机 | 议题 |
|---|---|
| P2 验收时 | BM25 走 MariaDB FULLTEXT vs Python `rank_bm25` |
| P2 验收时 | RRF 融合 vs 线性归一化加权 |
| P3 验收时 | KG 抽取频率(只在 reflect vs 每条 drawer) |
| P3 验收时 | Tunnel 自动发现的相似度阈值 |
| P4 验收时 | 是否启用 LLM rerank(尾部 +5% 召回 vs token 成本) |
| v0.6 评估 | 是否引入 AAAK 压缩;是否做关系图可视化 |

---

_本档案在 PR 合并时一并更新。_
