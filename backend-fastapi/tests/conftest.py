"""
backend-fastapi/tests/conftest.py

根 fixture 注册中心。Layer-specific fixture 放各层自己的 conftest。

约定见 tests/AGENTS.md §3。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# ─── 让 tests/ 下的代码能 import app.* / core.* ───
_BACKEND_ROOT = Path(__file__).resolve().parent.parent  # backend-fastapi/
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


# ═══════════════════════════════════════════════════════
# anyio backend (pytest-anyio)
# 所有 async 测试统一跑在 asyncio 上,不用 trio
# ═══════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


# ═══════════════════════════════════════════════════════
# 环境变量隔离
# 测试运行时强制 TESTING=1,业务代码可借此切换行为
# ═══════════════════════════════════════════════════════

@pytest.fixture(autouse=True, scope="session")
def _testing_env() -> None:
    os.environ.setdefault("TESTING", "1")
    # 测试默认禁用 Heartbeat 服务(避免后台任务污染单测)
    os.environ.setdefault("HEARTBEAT_AUTOSTART", "0")
    # 测试默认用 SQLite 内存库
    os.environ.setdefault("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")


# ═══════════════════════════════════════════════════════
# settings_override
# 复制一份当前 settings,测试中可修改,函数结束自动还原
# ═══════════════════════════════════════════════════════

@pytest.fixture
def settings_override():
    """
    使用示例:
        def test_foo(settings_override):
            settings_override.LOG_LEVEL = "DEBUG"
            # ... 后续代码看到的就是 DEBUG
    """
    try:
        from core.config import settings as _settings  # type: ignore
    except Exception:
        pytest.skip("core.config.settings 不可用,跳过 settings_override")

    snapshot = {k: getattr(_settings, k) for k in dir(_settings) if not k.startswith("_")}
    yield _settings
    for k, v in snapshot.items():
        try:
            setattr(_settings, k, v)
        except Exception:
            pass


# ═══════════════════════════════════════════════════════
# caplog: 默认让 pytest 捕获 INFO 及以上
# ═══════════════════════════════════════════════════════

@pytest.fixture
def caplog_info(caplog):
    """日志级别预设为 INFO,省得每个测试函数自己 set_level。"""
    import logging
    caplog.set_level(logging.INFO)
    return caplog


# ═══════════════════════════════════════════════════════
# fake redis (内存 redis,不需要起容器)
# ═══════════════════════════════════════════════════════

@pytest.fixture
def redis_fake():
    """
    用法:
        async def test_foo(redis_fake):
            await redis_fake.set("k", "v")
            assert await redis_fake.get("k") == b"v"
    """
    try:
        from fakeredis.aioredis import FakeRedis  # type: ignore
    except ImportError:
        pytest.skip("需要 pip install fakeredis")
    client = FakeRedis()
    yield client
    # FakeRedis 是内存的,不需要 cleanup,但 close 一下连接对象
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(client.aclose())
        else:
            loop.run_until_complete(client.aclose())
    except Exception:
        pass


# ═══════════════════════════════════════════════════════
# Mock LLM
# 真正的实现放 tests/fixtures/mocks/llm.py,这里只做 fixture 暴露
# ═══════════════════════════════════════════════════════

@pytest.fixture
def mock_llm():
    """
    用法见 tests/AGENTS.md §5。
    """
    from tests.fixtures.mocks.llm import MockLLM
    return MockLLM()
