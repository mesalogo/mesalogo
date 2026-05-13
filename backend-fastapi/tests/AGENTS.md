# tests/AGENTS.md

> 进入 `backend-fastapi/tests/` 写测试前先读。
> 已默认你读过根 `/AGENTS.md` 和 `backend-fastapi/AGENTS.md`。

## 0. 30 秒决策树

```
要测的东西涉及什么?

纯函数 / 一个类方法          → tests/unit/<镜像 app/services 路径>/test_X.py
FastAPI 路由 / DB 行为       → tests/integration/api|db|services/
SubAgent 嵌套 / 完整 SSE     → tests/e2e/scenarios/
OpenAPI / MCP 工具签名漂移   → tests/contract/<openapi|mcp_tools>/
复现 prod Bug                → 放最贴近的层,commit 写 "repro Bug #N"
拿不准                       → 放 unit/
```

**铁律**:不要写跨多层的巨无霸测试;一个测试函数测一件事。

## 1. 目录布局(镜像 app/ 结构)

```
tests/
├── AGENTS.md           你在读这个
├── conftest.py         根 fixture: anyio_backend / settings_override / mock_llm / redis_fake
├── pytest.ini          markers / asyncio / collection / strict
├── unit/               毫秒,纯函数,无 IO
│   └── services/<feature>/
├── integration/        秒级,带 DB(SQLite mem) / fakeredis / 真 FastAPI
│   ├── api/ db/ mcp/ services/
├── e2e/                分钟,完整链路,只 mock LLM
│   ├── scenarios/ smoke/
├── contract/           不让 API / 工具签名退化
│   ├── openapi/ mcp_tools/
├── fixtures/           共享 factories + mocks + data
│   ├── factories.py mocks/ data/
└── _archive/           历史 Flask 代码,只读,禁动
```

新建测试文件: **path 必须镜像被测代码 path**。
`app/services/heartbeat/clock.py` ↔ `tests/unit/services/heartbeat/test_clock.py`。

## 2. Markers (strict)

| Marker | 含义 |
|---|---|
| `unit` | 默认,毫秒,无 IO |
| `integration` | 带 DB/Redis/MCP |
| `e2e` | 完整链路,分钟级 |
| `contract` | 签名 / schema 不退化 |
| `slow` | > 5s |
| `external` | 需真实外部网络 |
| `heartbeat` / `subagent` / `supervisor` / `memory` / `knowledge` / `workflow` | feature 标签 |

`pytest.ini` 用 `strict-markers`——**未声明的 marker 直接报错**。
新加 marker 必须先注册到 `pytest.ini`。

跑测试:
```
pytest -m "unit"                       # 边写边跑
pytest -m "not slow and not external"  # 本地完整
pytest -m heartbeat                    # 单 feature
pytest --collect-only -q               # 只 collect 不跑
```

## 3. Fixtures(命名 = 契约)

- 根 `conftest.py`: `anyio_backend`(asyncio), `settings_override`, `redis_fake`, `mock_llm`, `caplog_info`。
- Layer conftest 自动给该层所有 item 打 marker(`unit/conftest.py` 加 `pytest.mark.unit`,以此类推)。
- 命名:
  - fixture 名 = 名词(`agent`, `client`)
  - factory 函数 = `make_<X>`(`make_agent`)
  - mock 对象 = `mock_<X>`(`mock_llm`)
- Factory 不入库,只构造内存对象;入库交给集成测试的 `db_session.add(make_agent())`。

## 4. 红线

1. ❌ **不要用 Flask 写法**(`create_app()`, `app.test_client()`, `with app.app_context()`)。
   `_archive/` 里全是这种,**禁止**复制粘贴。FastAPI 正解见 `tests/integration/conftest.py` 的 `client` fixture(`httpx.AsyncClient` + `ASGITransport`)。
2. ❌ **不要 sync IO**(`requests`, `time.sleep`, `open` 大文件同步读写)。同根 AGENTS §3.2。
3. ❌ **不要 mock supervisor / rule_sandbox / MCP 工具签名**。它们**是**测试对象。能 mock 的是 LLM 调用和外部 API。
4. ❌ **不要 `print()`**。用 `caplog` / `caplog_info`。生产代码已完成 print→logger 迁移,测试不能走回头路。
5. ❌ **不要 `sleep + assert`**(flaky)。用 `asyncio.Event` + `wait_for(timeout)`。
6. ❌ **不要让单测依赖网络/DB/Redis**。依赖了就不是单测,搬去 `integration/`。
7. ❌ **修 Bug 流程不能反**: 先写一个能复现 Bug 的测试,跑确认它**红**,再改代码到绿。否则你不知道修没修对。
8. ❌ **不要 `@pytest.mark.skip` 苟活**。删它,commit 写为什么。
9. ❌ **`_archive/`** 只读;不要往里加东西,不要在 PR 里说"我从 _archive 抄了一份"。

## 5. Mock LLM 的唯一标准做法

```python
# tests/fixtures/mocks/llm.py 已提供
async def test_X(mock_llm, agent):
    mock_llm.reply_with("hi!")
    assert await agent.run("hello") == "hi!"
    assert mock_llm.calls[-1]["messages"][-1]["content"] == "hello"
```

通过**依赖注入**给 agent 传 `mock_llm`,**不**用 `unittest.mock.patch` 去打 OpenAI SDK 内部(脆,SDK 一升级就崩)。

## 6. 异步约定

- 用 `pytest-anyio`(不是 `pytest-asyncio`)。
- 根 conftest 的 `anyio_backend` session fixture 钉死 `"asyncio"` backend。
- 测试函数直接 `async def test_X(...)` 即可,`anyio_mode = auto` 已开。
- 并发场景用 `asyncio.gather`,**不**用 thread。

## 7. DB 模式

- **单测不碰真 DB**。用 `make_<model>()` 工厂构造内存对象。
- **集成测**: `db_session` fixture 提供事务包裹 + 自动回滚;测试只 `flush()`,**不** `commit()`。
- **迁移测**: 每个新 Alembic migration 要在 `tests/integration/db/test_migrations.py` 加一条 upgrade↔downgrade roundtrip 用例。

## 8. 为新 feature 写测试的最小集

举例 Agent Heartbeat (`docs/feature-heartbeat/PLAN.md`):

| 文件 | 测什么 | Layer |
|---|---|---|
| `unit/services/heartbeat/test_clock.py` | TickClock 节拍准时 + stop 真停 | unit |
| `unit/services/heartbeat/test_registry.py` | register/deregister 一致性 | unit |
| `unit/services/heartbeat/test_policy_<name>.py` | 每个策略一份 | unit |
| `unit/services/heartbeat/test_overlap_skip.py` | 上次未结束本次 outcome=overlap_skip | unit |
| `integration/services/test_heartbeat_lifecycle.py` | lifespan 启停 | integration |
| `e2e/scenarios/test_heartbeat_space_close.py` | 关空间立刻停心跳 (`stop-the-world.md` §3 强制) | e2e |

## 9. 何时再回到本文档

- 写新测试前 → §0 决策树
- 想 mock 什么之前 → §4 红线
- 加 fixture / helper → §3 命名
- 想 `@skip` → §4.8 不行

---

_last review: 2026-05-13_
