# 07 — 预想失败模式与防护

> 本文给"将要动这个特性的 AI Agent / 开发者"看。
> 阅读时间 < 5 分钟,但能省下你后面好几个小时。
>
> **格式**:每条都是"症状 → 根因 → 防护"。
> **更新规则**:每发生一次新翻车 → 写到这里,并在对应 PR 文档加一条防护检查项。

---

## A. 写入路径

### A1. SSE 还没 done,前端 spinner 卡死
- **症状**:对话回复出来了,但前端转圈不停;后端 log 看到 drawer 写入异常
- **根因**:在 SSE handler 里直接 `await MemoryWriter().write(...)`,写入失败把 SSE 一起拖崩
- **防护**:
  - 写入**只能**走 `app/tasks/memory_palace_writes.schedule_drawer_write`(内部 `asyncio.create_task`)
  - SSE handler 末尾必须 `yield sse_event("done", ...)`(对齐 backend-fastapi/AGENTS.md §3.2)
  - 写入失败用 `logger.exception` + retry 3 次,**绝不**反向传播到 SSE

### A2. drawer 重复写入
- **症状**:同一对话轮次产生两条几乎一样的 drawer
- **根因**:对话路径 + 旧 `memory_sync_service` 没下线,同时写入
- **防护**:
  - P4 之前 `graphiti_legacy_enabled` 双写期,两边都用幂等 key(message_id + agent_id + role_type)
  - `MemoryWriter.write_drawer` 进入前先 `SELECT ... FROM memory_drawer WHERE source_ref->>'$.message_id' = ...`,命中就 skip

### A3. 写入风暴打爆 Milvus
- **症状**:Milvus 连接超时;CPU 80%+;新对话写入丢失
- **根因**:每条 drawer 都立即 upsert 向量,无批量;closet 重建并发触发
- **防护**:
  - Milvus upsert 走 batch(每 100 条或 1s 触发一次)
  - closet 重建 Redis 锁 + 5 分钟冷却
  - 写入失败的 payload 进 Redis dead-letter queue,人工重放

---

## B. 检索路径

### B1. recall 返回 0 条但用户记得很清楚有那条数据
- **症状**:`recall("用户咖啡偏好")` 返回 [],但 drawer 表里明明有"用户喜欢拿铁"
- **根因**(可能):
  1. tenant_id 过滤错了(跨 tenant 漏数据)
  2. cues.entities 过严,所有命中都被过滤
  3. closet 还没建,closet-first 找不到 room
- **防护**:
  - `recall` 必须带 tenant_id 单测覆盖(`test_recall_respects_tenant_isolation`)
  - cues 命中 0 条时 fallback 到无 cue 检索(P2)
  - 没有 closet 时退化为直接 drawer 检索(P2 必须保证)

### B2. recall 召回的全是反思条目,看不到原话
- **症状**:每次 recall 都被 importance=0.85 的 reflection drawer 占满前 5 条
- **根因**:reflection drawer 重要性过高 + 反思递归(reflection 又被反思)
- **防护**:
  - reflection 时 `source_kind="reflection"` 的 drawer 在反思窗口里**排除**(P3 §5)
  - rerank 时同 source_kind 取最多 N 条(P2 加配置)

### B3. 跨 wing 召回泄露其他 tenant 数据
- **症状**:用户 A 的 Agent 通过 tunnel 看到了用户 B 的对话片段
- **根因**:`fallback_via_tunnels` 没加 tenant_id 过滤
- **防护**:
  - `MemoryTunnel` 创建时强制校验 src_wing.tenant_id == dst_wing.tenant_id
  - `fallback_via_tunnels` SQL 必须 join 到 wing 表加 tenant 过滤
  - 单测:`test_tunnel_does_not_cross_tenant`

---

## C. 数据完整性

### C1. Alembic 迁移失败,生产启动崩
- **症状**:`alembic upgrade head` 报 `IntegrityError` 或 `OperationalError`
- **根因**:
  - 新表 FK 引用了正在被批量插入的表
  - 旧数据触发了新增 NOT NULL 约束
- **防护**:
  - 每个 PR 在 staging 环境跑 `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`(贴日志到 PR)
  - 新增 NOT NULL 字段必须有 `server_default` 或迁移里手工填值
  - FK 全部允许 NULL(P1 阶段宁松不严)

### C2. drawer.content 被错误改写
- **症状**:用户报"我之前说的明明是 X,现在记忆里变成 Y 了"
- **根因**:某处写入路径在 `content` 上做了清洗 / 总结 / 翻译
- **防护**:
  - drawer.content 永远存 verbatim;清洗版放在新字段(如 `normalized_content`)
  - `MemoryWriter` 单测:`test_write_drawer_preserves_verbatim_content`
  - normalize 失误 → 通过 `normalize_version` bump + 静默重建,**不**修改原 content

### C3. KG 三元组爆炸
- **症状**:knowledge_triple 表条数过亿,查询慢
- **根因**:每条 drawer 都抽 KG;LLM 抽取无去重
- **防护**:
  - KG 抽取**只在** reflection 时触发(P3 §2.1)
  - upsert 时按 (tenant_id, subject, predicate, object, current=True) 去重
  - `mp_kg_gc` 每周清理 valid_to < now()-365d

---

## D. 兼容性

### D1. 旧 Agent prompt 引用 `add_memory` 报错
- **症状**:Agent 调 `add_memory(...)` 但工具不存在;或者参数名不匹配
- **根因**:Adapter 没注册;或者旧工具签名变了
- **防护**:
  - P4 必须保留 `add_memory` / `search_memory_nodes` / `search_memory_facts` / `get_episodes` 4 个工具名
  - 参数 schema 严格保持旧版(name/episode_body/group_id/group_ids)
  - 单测:`test_legacy_add_memory_works_after_p4`

### D2. 关掉 Graphiti 后 memory 能力被剥
- **症状**:`graph_enhancement.enabled=false` → 角色失去 memory 能力 → Agent 看不到记忆工具
- **根因**:`memory_capability_service.sync_memory_capability_with_graph_enhancement` 老逻辑还在
- **防护**:
  - P4 改写 `is_memory_enabled` 为读 `settings.MEMPALACE_ENABLED`
  - 老 sync 函数 deprecated,在 v1.0 删除
  - 单测:`test_capability_decoupled_from_graphiti`

---

## E. 性能

### E1. closet 重建工作量爆炸
- **症状**:写入高峰期 Redis 队列堆积 1000+ 个 `rebuild_closet:*` 任务
- **根因**:
  - 没设 threshold(每条 drawer 都触发)
  - 没设冷却(同 room 反复触发)
- **防护**:
  - threshold 默认 5;wing.config 可调
  - 同 room 5 分钟冷却(Redis 锁带 TTL)
  - 队列消费速率监控,超过阈值告警

### E2. recall 延迟超 1s
- **症状**:`recall` 调用平均 > 1.5s,P99 > 3s
- **根因**(常见组合):
  1. Milvus 没建索引(默认 FLAT)
  2. BM25 走 Python 全量扫表(没用 FULLTEXT)
  3. closet-first 没拦截到大部分 query,降级为全 drawer 检索
- **防护**:
  - Milvus collection 必须 HNSW + COSINE,启动时校验
  - BM25 优先 MariaDB FULLTEXT(ngram parser),失败再回 Python
  - closet 命中率监控(P2 验收 ≥ 70%)

---

## F. AI Agent 自身陷阱

### F1. Agent one-shot 改全套
- **症状**:一个 commit 同时动了 wing/room/drawer/closet/kg/tunnel/diary 7 张表 + 前端
- **根因**:Agent 看到完整设计就想一次写完
- **防护**:
  - **每个 PR 范围在对应 02-05 文档里硬约束**(`这个 PR 不做`)
  - PR 评审看到外溢直接拒
  - 上仓库根 AGENTS.md §3.3 红线:不要 one-shot

### F2. Agent 自己写测试自己跑通就宣布完成
- **症状**:pytest 全绿,但 curl 路由返回 200 空响应,前端打不开
- **根因**:测试是 Agent 自己写的,测自己想象中的功能,不测真实场景
- **防护**:
  - 仓库根 AGENTS.md §6:`改完代码必须做到 1-5`
  - 修 Bug 时**先写一个能复现 Bug 的测试并确认它失败**
  - PR 描述必须贴 curl 实际响应

### F3. Agent 复制 backend-deprecated 模式
- **症状**:新代码出现 `from flask import ...`、`db.session.commit()`、`@blueprint.route(...)`
- **根因**:Agent 在搜索"如何加路由"时翻到了 deprecated 代码
- **防护**:
  - 仓库根 AGENTS.md §3.1:不要修改/参考 backend-deprecated/
  - PR 自检:`git grep -E "from flask|@blueprint\.route|db\.session" backend-fastapi/app/services/memory_palace/` 必须为空

### F4. Agent 自作主张把术语翻译成中文
- **症状**:代码里出现 `class 院(Base)`、`def 召回(...)`、UI 上把 Wing 改叫"翼"
- **根因**:Agent 看到中文项目就以为术语都得译
- **防护**:
  - [`06-decisions.md` D5](./06-decisions.md):术语保留英文是已锁定决策
  - 类名/字段名/工具名/路由名一律英文
  - UI 文案显示英文术语 + 中文 tooltip(不替换)
  - PR 自检:`git grep -P "[\u4e00-\u9fa5]" backend-fastapi/app/services/memory_palace/ | grep -E "class |def |\.column"` 应为空(纯中文标识符)

### F5. Agent 改了 supervisor / rule_sandbox 放行语义
- **症状**:某个原本被拒绝的工具调用现在通过了
- **根因**:Agent 误以为"放行 memory 工具就一切顺畅"
- **防护**:
  - 仓库根 AGENTS.md §3.2 红线:**禁止修改 supervisor_*.py 和 rule_sandbox.py 的放行语义**
  - 新 MCP 工具走标准注册流程,不在 supervisor 加白名单

---

## 增加新失败模式的流程

发生新翻车时:

1. 在 `docs/agents/failures/` 写一篇 `2026-MM-mempalace-XXX.md`(详细复盘)
2. 在本文件追加一条"症状 → 根因 → 防护"
3. 在对应 PR 文档(02/03/04/05)的 "Reviewer 检查清单" 加一条
4. 必要时在仓库根 AGENTS.md §3 / §5 加最多两行红线
5. PR 标题以 `failure-note:` 开头

---

_本文不会自己更新。每一次"早知道"都该让下一个人看到。_
