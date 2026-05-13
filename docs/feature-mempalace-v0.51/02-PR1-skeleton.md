# 02 — PR1:骨架(Skeleton)

> **状态**:未开工
> **预估工作量**:3-5 天
> **基线分支**:`develop`(或当前主干)
> **建议分支名**:`feat/mempalace-v0.51-p1-skeleton`

---

## 0. 这个 PR 想达到什么

让 abm-llm-v2 拥有一个**完全独立于 Graphiti** 的最小可用记忆系统。

**完成后这条命令必须能跑通**(关掉 Graphiti 也行):

```bash
curl -X POST http://localhost:8080/api/memory/v2/remember \
  -d '{"agent_id": "<aid>", "content": "用户喜欢喝拿铁,不加糖"}'

curl -X POST http://localhost:8080/api/memory/v2/recall \
  -d '{"agent_id": "<aid>", "query": "饮品偏好"}'
# 返回应包含上面那条
```

---

## 1. 范围(明确"做什么 + 不做什么")

### 1.1 这个 PR 做

- ✅ 新建 3 张表:`memory_wing` / `memory_room` / `memory_drawer`
- ✅ Alembic 迁移(upgrade ↔ downgrade 对称)
- ✅ Milvus collection `memory_vec`(只用 kind="drawer")
- ✅ `MemoryPalaceService`:wing/room/drawer 的 CRUD
- ✅ `MemoryWriter.write_drawer()`:async 写入 + Milvus 入向量
- ✅ `MemoryReader.recall()`:**单层向量检索**(无 closet,无 BM25,无 KG)
- ✅ MCP 工具 `remember` / `recall`(注册到 `mcp_server_manager`)
- ✅ 路由 `/api/memory/v2/{wing,room,drawer,remember,recall}`
- ✅ Wing 自动创建逻辑:Agent 没 wing 就按其 ActionSpace 的 wing_scope 创建
- ✅ pytest 覆盖核心流程

### 1.2 这个 PR **不做**

- ❌ Closet 索引层 → P2
- ❌ BM25 / Hybrid 检索 → P2
- ❌ Cue 多线索召回 → P2
- ❌ KG / fact_check → P3
- ❌ Tunnel → P3
- ❌ Reflection → P3
- ❌ 前端浏览树 → P4
- ❌ 旧 `add_memory/search_memory_*` 适配 → P4
- ❌ 改 `memory_sync_service.py` → P4

> 这是**故意**的。每个 PR 单独可回滚,P1 不引入 P2+ 才有的复杂度。

---

## 2. 文件清单

### 2.1 新建

```
backend-fastapi/
├── app/
│   ├── models/
│   │   └── memory_palace.py            # ⭐ Wing/Room/Drawer ORM
│   ├── schemas/
│   │   └── memory_palace.py            # Pydantic 请求/响应模型
│   ├── services/
│   │   └── memory_palace/
│   │       ├── __init__.py
│   │       ├── service.py              # MemoryPalaceService(CRUD)
│   │       ├── writer.py               # MemoryWriter(写入流水线 minimal 版)
│   │       ├── reader.py               # MemoryReader(单层向量检索)
│   │       ├── milvus_adapter.py       # Milvus 异步封装
│   │       ├── embedding.py            # embed_async()(走项目已有 model client)
│   │       └── wing_resolver.py        # 根据 agent_id 找/创建 wing
│   ├── api/routes/
│   │   └── memory_palace.py            # /api/memory/v2/* 路由
│   ├── mcp_servers/
│   │   └── memory_palace.py            # remember/recall MCP 工具
│   └── tasks/
│       └── memory_palace_writes.py     # asyncio.create_task 包装
├── migrations/
│   └── versions/
│       └── XXXX_mempalace_p1_skeleton.py  # Alembic 迁移
└── tests/
    └── memory_palace/
        ├── __init__.py
        ├── test_writer.py
        ├── test_reader.py
        ├── test_wing_resolver.py
        └── test_routes.py
```

### 2.2 修改(最小化)

| 文件 | 改动 |
|---|---|
| `app/api/__init__.py` 或 `main.py` | 挂载 `memory_palace.router` 到 `/api/memory/v2` |
| `app/mcp_servers/__init__.py` 或对应注册点 | 注册 `memory_palace` MCP server |
| `mcp_config.json` | 声明 `memory_palace` server |
| `app/models.py`(9 万行那个) | **不动**,只在新文件 import 必要的 Base |

---

## 3. 关键实现要点(避免踩坑)

### 3.1 ORM Base 复用,避免 metadata 冲突

```python
# app/models/memory_palace.py
from app.models import Base   # 复用现有 Base,不要新建 Declarative Base

class MemoryWing(Base):
    __tablename__ = "memory_wing"
    ...
```

> **为什么**:多 Base 会让 Alembic autogenerate 看不到这些表,生产时 schema mismatch。

### 3.2 全 async,严禁 `requests` / `threading.Thread`

```python
# ✅ 正解
import httpx
async with httpx.AsyncClient(timeout=10) as client:
    r = await client.post(...)

# ✅ 包同步库
result = await asyncio.to_thread(milvus_client.search, ...)

# ❌ 翻车(memory_sync_service.py 旧式写法,不要再抄)
import requests
threading.Thread(target=worker, daemon=True).start()
```

### 3.3 写入不阻塞 SSE

写入路径**只能**通过 `asyncio.create_task` 拉起:

```python
# app/tasks/memory_palace_writes.py
async def schedule_drawer_write(payload: DrawerWritePayload):
    """放入 background task,不 await。"""
    asyncio.create_task(_write_with_retry(payload))

async def _write_with_retry(payload):
    for attempt in range(3):
        try:
            await MemoryWriter().write_drawer(payload)
            return
        except Exception as e:
            logger.exception("MP P1 drawer write failed (attempt %d): %s", attempt, e)
            await asyncio.sleep(2 ** attempt)
```

调用方(对话路径)只做一件事:

```python
# 在 conversation_service / SSE handler 末尾
await schedule_drawer_write(DrawerWritePayload(...))
# ↑ 注意:schedule_drawer_write 内部 create_task,不会阻塞
```

### 3.4 Wing 自动创建

```python
# app/services/memory_palace/wing_resolver.py
async def resolve_or_create_wing(agent_id: str, db: AsyncSession) -> MemoryWing:
    """
    1. 取 agent → action_task → action_space
    2. 读 action_space.config.wing_scope(默认 "space")
    3. 按 scope 计算 (scope_type, scope_id)
    4. UPSERT memory_wing(tenant_id, scope_type, scope_id) RETURNING id
    """
    ...
```

> ActionSpace 上要加一个 `config.wing_scope` 字段(JSON 内字段,**不**改表结构,避免 9 万行 models.py 改动)。

### 3.5 Milvus collection 初始化

启动时检查并创建,使用项目已有的 milvus client。

```python
# app/services/memory_palace/milvus_adapter.py
COLLECTION = "memory_vec"
DIM = settings.MEMPALACE_EMBED_DIM   # 由 config.conf 配置,默认 1024

async def ensure_collection():
    if not await asyncio.to_thread(milvus.has_collection, COLLECTION):
        # 创建 collection,partition_key=tenant_id,HNSW + COSINE
        ...
```

### 3.6 Embedding 模型选型

**P1 优先用项目已有的 embedding 服务**(避免引入新依赖)。
- 如果 `core/config.py` 已经有 `embedding_service_url`,直接复用
- 否则在 `embedding.py` 留一个抽象接口,P1 先 mock(返回 hash 化向量也行,只要测试能跑)

> **重要**:P1 验收不要求召回质量,只要求**链路通**。质量基线放在 P2。

---

## 4. API 契约(P1 版)

### 4.1 REST 路由

```
POST   /api/memory/v2/remember
  body: {"agent_id": str, "content": str, "room_hint": str?, "importance": float?}
  resp: {"drawer_id": int, "room_id": int, "wing_id": int}

POST   /api/memory/v2/recall
  body: {"agent_id": str, "query": str, "k": int=5}
  resp: {"hits": [{"drawer_id", "content", "room_name", "score", "created_at"}, ...]}

GET    /api/memory/v2/wings?agent_id=xxx
GET    /api/memory/v2/wing/{wing_id}/rooms
GET    /api/memory/v2/room/{room_id}/drawers
DELETE /api/memory/v2/drawer/{drawer_id}    # supervisor 才能 hard delete
```

### 4.2 MCP 工具

```python
@tool
async def remember(content: str, room_hint: str | None = None,
                   importance: float = 0.5) -> dict:
    """显式记住一条信息。"""
    ...

@tool
async def recall(query: str, k: int = 5) -> list[dict]:
    """检索与 query 相关的记忆。"""
    ...
```

agent_id / tenant_id 通过 MCP 上下文(`tool_handler` 里的 conversation_context)注入,**Agent 不应直接传**。

---

## 5. 验收标准(用 pytest 卡)

### 5.1 单元测试

```python
# tests/memory_palace/test_writer.py
async def test_write_drawer_creates_wing_room_drawer(...):
    """首次写入:wing/room/drawer 都被创建"""

async def test_write_drawer_reuses_room_when_similar(...):
    """相似度 > 0.85 时,drawer 落入同一 room"""

async def test_write_drawer_does_not_block(...):
    """写入路径不 await 完成,主流程立即返回"""

# tests/memory_palace/test_reader.py
async def test_recall_returns_recent_drawer(...):
    """写入后立即 recall,能命中"""

async def test_recall_respects_tenant_isolation(...):
    """不同 tenant 的 drawer 不会被召回"""

async def test_recall_returns_empty_when_no_data(...):
    """空 wing 召回返回空列表(而不是抛异常)"""
```

### 5.2 集成测试(关 Graphiti 也能跑)

```bash
# 在 config.conf 把 graph_enhancement.enabled = false
pytest tests/memory_palace/ -v
# 全绿
```

### 5.3 手工 curl 验证

按本文档 §0 给的命令验证。

### 5.4 性能 sanity check

- 单条 drawer 写入 < 100ms(不含 Milvus 索引刷盘)
- 单次 recall < 500ms(small dataset)
- 写入不阻塞 SSE done(SSE 关闭时间 ≤ 50ms 误差)

---

## 6. 风险 & 防护

| 风险 | 防护 |
|---|---|
| Alembic upgrade 失败,生产启动崩 | 本地 + staging 都跑过 upgrade ↔ downgrade;PR 描述里贴 alembic history 输出 |
| Milvus collection schema 跟代码不一致 | `ensure_collection` 启动时校验;不一致直接 raise(快速失败) |
| 引入 `requests` 或 `threading.Thread` | CI 加 ruff custom rule 禁止在 `memory_palace/` 目录引入这两个符号 |
| 写入失败导致后续 recall 失败 | retry 3 次 + 失败 logger.exception;不让一条失败影响主流程 |
| 9 万行 models.py 被误改 | PR diff 不能含 models.py 行变更(reviewer 强制检查) |

---

## 7. 给 Reviewer 的检查清单

PR 提上来后,reviewer 至少 check 以下:

- [ ] 新增/修改文件在 §2 列表里,无外溢
- [ ] `git grep "import requests" app/services/memory_palace/` 为空
- [ ] `git grep "threading\." app/services/memory_palace/` 为空
- [ ] `git grep "print(" app/services/memory_palace/` 为空
- [ ] Alembic upgrade 和 downgrade 都跑过(贴日志)
- [ ] pytest tests/memory_palace/ 全绿,且关 Graphiti 也绿
- [ ] curl §0 例子返回真实数据,不是 200 空响应
- [ ] PR 描述贴出本文档链接 + 完成的勾选项

---

## 8. 完成后写什么

PR 合并时(同一 PR 里)更新:

1. `docs/feature-mempalace-v0.51/02-PR1-skeleton.md` 状态字段:`未开工` → `已合并 @ <commit>`
2. `docs/feature-mempalace-v0.51/06-decisions.md` 第 2 节:实际选用的 embedding 模型 / Milvus 参数
3. `docs/feature-mempalace-v0.51/07-failure-modes.md`:本次 PR 中任何"非预期"的坑(就算 5 分钟解决的)

---

_next: `03-PR2-closet-hybrid.md`_
