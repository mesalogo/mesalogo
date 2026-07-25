from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI, HTTPException, Request


class FakeServiceCenter:
    def __init__(self, *, database_health: str = "healthy") -> None:
        self.database_health = database_health

    async def get_status(self, service_id: str):
        health_status = self.database_health if service_id == "database" else "healthy"
        return SimpleNamespace(
            id=service_id,
            health_status=health_status,
            checked_at="2026-07-21T00:00:00Z",
            model_dump=lambda **_kwargs: {
                "id": service_id,
                "health_status": health_status,
                "checked_at": "2026-07-21T00:00:00Z",
            },
        )


async def _request(
    app: FastAPI,
    path: str,
    *,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.get(path, headers=headers)


@pytest.fixture
def health_routes(monkeypatch):
    dependencies = ModuleType("core.dependencies")

    async def get_admin_user(request: Request):
        role = request.headers.get("X-Test-Role")
        if role is None:
            raise HTTPException(status_code=401, detail="authentication required")
        if role != "admin":
            raise HTTPException(status_code=403, detail="administrator required")
        return object()

    dependencies.get_admin_user = get_admin_user
    monkeypatch.setitem(sys.modules, "core.dependencies", dependencies)

    route_file = (
        Path(__file__).resolve().parents[3]
        / "backend-fastapi"
        / "app"
        / "api"
        / "routes"
        / "health.py"
    )
    spec = importlib.util.spec_from_file_location(
        "_health_routes_under_test", route_file
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    monkeypatch.setattr(module.settings, "SETUP_MODE", False)
    return module


def _app(health_routes, center: FakeServiceCenter | None = None) -> FastAPI:
    app = FastAPI()
    app.include_router(health_routes.liveness_router, prefix="/api")
    app.include_router(health_routes.router, prefix="/api")

    async def get_fake_service_center():
        return center or FakeServiceCenter()

    app.dependency_overrides[health_routes.get_service_center] = get_fake_service_center
    return app


async def test_liveness_endpoints_remain_cheap_and_compatible(health_routes):
    app = _app(health_routes)

    legacy = await _request(app, "/api/health")
    live = await _request(app, "/api/health/live")

    assert legacy.status_code == 200
    assert legacy.json() == {"status": "healthy"}
    assert live.status_code == 200
    assert live.json() == {"status": "healthy"}


async def test_readiness_is_database_only_and_returns_503_when_unavailable(
    health_routes,
):
    healthy = await _request(
        _app(health_routes, FakeServiceCenter(database_health="healthy")),
        "/api/health/ready",
    )
    unavailable = await _request(
        _app(health_routes, FakeServiceCenter(database_health="unknown")),
        "/api/health/ready",
    )

    assert healthy.status_code == 200
    assert healthy.json() == {
        "status": "ready",
        "dependencies": {"database": "healthy"},
    }
    assert unavailable.status_code == 503
    assert unavailable.json() == {
        "status": "not_ready",
        "dependencies": {"database": "unknown"},
    }


async def test_setup_mode_is_live_but_not_ready(health_routes, monkeypatch):
    monkeypatch.setattr(health_routes.settings, "SETUP_MODE", True)
    app = _app(health_routes)

    live = await _request(app, "/api/health/live")
    ready = await _request(app, "/api/health/ready")

    assert live.status_code == 200
    assert ready.status_code == 503
    assert ready.json() == {
        "status": "not_ready",
        "dependencies": {"database": "unknown"},
    }


async def test_dependency_details_are_admin_only(health_routes):
    app = _app(health_routes)

    unauthenticated = await _request(app, "/api/health/dependencies")
    admin = await _request(
        app,
        "/api/health/dependencies",
        headers={"X-Test-Role": "admin"},
    )

    assert unauthenticated.status_code == 401
    assert admin.status_code == 200
    assert admin.json() == {
        "success": True,
        "data": {
            "checked_at": "2026-07-21T00:00:00Z",
            "services": [
                {
                    "id": "database",
                    "health_status": "healthy",
                    "checked_at": "2026-07-21T00:00:00Z",
                },
                {
                    "id": "redis",
                    "health_status": "healthy",
                    "checked_at": "2026-07-21T00:00:00Z",
                },
            ],
        },
    }
