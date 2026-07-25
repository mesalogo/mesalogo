"""Integration coverage for the public health endpoint."""

from __future__ import annotations


async def test_health_endpoint_uses_real_fastapi_router(client):
    response = await client.get("/api/health")
    live = await client.get("/api/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
    assert live.status_code == 200
    assert live.json() == {"status": "healthy"}


async def test_lifespan_runs_startup_before_shutdown(monkeypatch):
    import main

    events = []

    async def fake_startup():
        events.append("startup")

    async def fake_shutdown():
        events.append("shutdown")

    monkeypatch.setattr(main, "startup_event", fake_startup)
    monkeypatch.setattr(main, "shutdown_event", fake_shutdown)

    async with main.lifespan(main.app):
        assert events == ["startup"]

    assert events == ["startup", "shutdown"]


def test_python_313_compatible_routes_are_registered():
    import main

    def iter_paths(router, prefix=""):
        for route in router.routes:
            included_router = getattr(route, "original_router", None)
            if included_router is not None:
                context = route.include_context
                yield from iter_paths(included_router, prefix + context.prefix)
            elif hasattr(route, "path"):
                yield prefix + route.path

    paths = set(iter_paths(main.app.router))

    assert "/api/images/upload" in paths
    assert "/api/images/process" in paths
    assert "/api/system/services" in paths
    assert "/api/health/live" in paths
    assert "/api/health/ready" in paths
    assert "/api/health/dependencies" in paths
