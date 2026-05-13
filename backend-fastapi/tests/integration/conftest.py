"""
integration-layer conftest

集成测试原则:
- 起内存 SQLite + fakeredis,够快
- 真实 FastAPI app,真实路由
- LLM mock 掉
- 每个测试事务包裹 + 自动回滚
"""
from __future__ import annotations

import pytest


def pytest_collection_modifyitems(items):
    for item in items:
        if "tests/integration/" in str(item.fspath).replace("\\", "/"):
            item.add_marker(pytest.mark.integration)


# 集成测试常用的 client fixture - 占位实现
# TODO: 待 app 工厂稳定后接通真实 FastAPI app + httpx.AsyncClient
@pytest.fixture
async def client():
    """
    httpx.AsyncClient + FastAPI lifespan
    用法:
        async def test_route(client):
            r = await client.get("/api/agents")
            assert r.status_code == 200
    """
    try:
        import httpx
        from main import app  # type: ignore
    except ImportError as e:
        pytest.skip(f"client fixture 依赖不可用: {e}")

    # ASGITransport 让 httpx 直接驱动 FastAPI,无需起 uvicorn
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
