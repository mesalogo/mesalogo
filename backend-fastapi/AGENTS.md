# backend-fastapi / AGENTS.md

> 进入 `backend-fastapi/` 目录做任何改动前先读这个文件。
> 假设你已读过仓库根目录的 `/AGENTS.md`;本文件只写**只在后端生效**的规则。

---

## 1. 技术栈心智模型

- **Web**:FastAPI 0.115+(**不是 Flask**,不要沿用 `backend-deprecated/` 的写法)
- **ASGI**:uvicorn(开发)/ gunicorn + uvicorn workers(生产,见 `gunicorn.conf.py`)
- **ORM**:SQLAlchemy 2.0 风格(async session)+ Alembic 迁移
- **DB**:MariaDB(主)+ Redis(缓存/队列)+ Milvus(向量)+ 可选 TiDB vector
- **Agent/LLM**:httpx.AsyncClient + MCP(`mcp` 官方 SDK)
- **并发模型**:全链路 async/await;**任何 blocking IO 都是 Bug**。
- **asyncio 兼容**:项目装了 `nest-asyncio`,说明历史上有嵌套 loop 问题。不要假设 `asyncio.run()` 在任何地方都能用。

---

## 2. `app/services/` 区域划分

| 目录/文件 | 含义 | 触碰风险 |
|---|---|---|
| `conversation/`, `conversation_service.py` | 对话核心,SSE 流生成 | 🟥 高 — 动一行可能让前端整个对话卡死 |
| `subagent/` | SubAgent 执行引擎(Phase 1 MVP 已上线) | 🟧 中 — 先读 `docs/feature-subagent/PLAN.md` |
| `scheduler/` | 自主任务调度 + 触发器 | 🟧 中 — 有"任务停不下来"的历史 Bug |
| `parallel_experiment_service.py` | 并行实验编排(7.5 万行) | 🟥 高 — 不要重构,只做最小修复 |
| `mcp_server_manager.py` | MCP 工具注册中心(7.3 万行) | 🟥 高 — 工具契约改动会影响所有 Agent |
| `supervisor_*.py`, `rule_sandbox.py` | Harness 约束层(监督者 + 规则 + 沙箱) | 🟥 高 — 放行错一个动作 = 系统性风险 |
| `memory_*`, `vector_db*`, `lightrag/` | 记忆 / 向量 / RAG | 🟧 中 |
| `statistics_service.py`(4.4 万行) | 统计 | 🟨 低 |
| `license_service.py`, `oauth_service.py` | 计费 / 认证 | 🟥 高 — 不要未经用户确认改 |

**通用原则**:代码行数 > 1 万行的文件 = 核心且脆弱。改之前先 `grep` 依赖它的调用点,评估爆炸半径。

---

## 3. 你最容易翻的车(按发生频率)

### 3.1 在 async 函数里用了 sync IO

```python
# ❌ 翻车
import requests
async def foo():
    r = requests.get(url)   # 阻塞整个 event loop,5000 并发直接崩

# ✅ 正解
import httpx
async def foo():
    async with httpx.AsyncClient() as c:
        r = await c.get(url)

# ✅ 如果必须调 sync 库(如某些 LLM SDK)
result = await asyncio.to_thread(sync_fn, arg)
```

### 3.2 SSE 流里 `raise` 但没发 done 事件

前端等的是 `event: done` 这一帧。`raise HTTPException` 之后 SSE 已经被 FastAPI 吞掉,前端 spinner 永远转。

```python
# ✅ 正解模式
async def stream():
    try:
        async for chunk in agent_loop():
            yield sse_event("message", chunk)
    except Exception as e:
        logger.exception("agent loop failed")
        yield sse_event("error", {"message": str(e)})
    finally:
        yield sse_event("done", {})   # ← 必须!
```

### 3.3 加了新字段但忘了 Alembic 迁移

`app/models.py` 9 万行,直接改 class 属性 = 生产环境启动时报 schema mismatch。

```bash
cd backend-fastapi
alembic revision --autogenerate -m "add foo column to bar"
# 人工 review 生成的 py,确认 upgrade/downgrade 对称
alembic upgrade head    # 本地先跑通
```

### 3.4 新 MCP 工具没注册就调用

MCP 工具必须:
1. 在 `app/mcp_servers/<your_server>.py` 实现
2. 在 `mcp_config.json` 声明
3. 在 `MCPServerManager` 注册
4. 在 prompt 注入说明里描述用法

少任何一步,Agent 看不到这个工具,或者能看到但调用时 500。参考 `docs/agents/mcp-tool-writing.md`(不存在就创建)。

### 3.5 Redis 缓存不失效

项目已集成 Redis(见最近的 commit `83fffd8e feat: Redis 缓存集成`)。改了底层数据,必须删掉对应缓存 key,否则前端显示陈旧数据,还不会报错。

### 3.6 SubAgent 嵌套死循环 / 上下文爆炸

Phase 1 MVP 没做 ODM(Open Domain Model)约束。在 SubAgent 里再调 `invoke_agent` **可能无限递归**。现阶段的缓解:
- `invoke_agent` 调用需在 `subagent/security.py` 检查深度 ≤ 2
- 新增任何会被 SubAgent 调用的工具,问自己:这个工具会不会反过来触发 SubAgent?

### 3.7 导入路径混乱(backend vs backend-deprecated vs backend-fastapi)

**只 import `app.*`、`core.*`**。看到 `from backend.xxx import ...` 的例子,**一定是 deprecated 代码**,不要抄。

---

## 4. 加新路由的清单

1. 路由函数放在 `app/api/routes/<module>.py`
2. 在 `app/api/__init__.py` 或 `main.py` 挂载 router
3. 经过权限中间件(`LicenseMiddleware` / auth)必须考虑白名单
4. 给出 pydantic 响应 model(前端会读 OpenAPI)
5. 大响应 / 实时流用 SSE(`StreamingResponse`),**不要用 WebSocket**(项目目前全链路 SSE)
6. 写完用 `curl -i` 验真,再写前端
7. 在 `tests/` 加一个最小测试,能 hit 到新路由

---

## 5. 性能 / 5000 并发注意事项

`docs/feature-parallellab/PLAN-5000-concurrency.md` 是目标状态。近期任何 PR 都要问自己:

- 有没有引入新的同步 IO?(见 3.1)
- 有没有在循环里逐个 await(N+1)?应该 `asyncio.gather`
- 有没有在 request 周期里做重计算?该扔进 `job_queue/`
- 数据库查询有没有 N+1?该用 `selectinload` / `joinedload`
- 缓存命中率?(能否加 Redis 缓存)

---

## 6. 测试怎么写(底线)

- 位置:`backend-fastapi/tests/`
- 框架:pytest + pytest-asyncio
- **修 Bug 必须先写能复现的测试并确认它红**,再修到绿。否则"你不知道自己修没修对"。
- 不要 mock 掉 supervisor / rule_sandbox——它们本身是测试对象。
- LLM 调用可以 mock,但 MCP 工具契约 **不要 mock**(mock 了就测不出契约漂移)。

---

## 7. 配置 / Secrets

- 开发用 `config.conf`(ini 格式)+ `.env`
- **永远不要把 config.conf 或任何 key 提交**(`.gitignore` 已涵盖,但注意不要被 Agent 主动 `git add -f` 绕过)
- 新增配置项:`core/config.py` 的 `settings` 里声明默认值 + 文档

---

_last human review: 2026-04-19_
