from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import httpx
import pytest
from fastapi import FastAPI, HTTPException, Request

from app.services.service_center.docker_control import (
    ServiceActionFailed,
    ServiceActionInProgress,
    ServiceControlUnavailable,
    ServiceDeploymentConflict,
    ServiceNotControllable,
    ServiceNotFound,
    ServiceNotInstalled,
)
from app.services.service_center.models import (
    ServiceActionResult,
    ServiceImageStatus,
    ServiceSnapshot,
    ServiceStatus,
    ServiceSummary,
)


class FakeServiceCenter:
    def __init__(
        self,
        action_error: Exception | None = None,
        snapshot: ServiceSnapshot | None = None,
    ) -> None:
        self.snapshot_calls = 0
        self.action_calls: list[dict[str, str]] = []
        self.action_error = action_error
        self.snapshot = snapshot

    async def get_snapshot(self) -> ServiceSnapshot:
        self.snapshot_calls += 1
        return self.snapshot or ServiceSnapshot(
            checked_at="2026-07-21T00:00:00Z",
            deployment_mode="native",
            summary=ServiceSummary(total=0),
            services=[],
        )

    async def control_service(
        self,
        service_id: str,
        action: str,
        *,
        actor_id: str,
        request_id: str,
    ) -> ServiceActionResult:
        self.action_calls.append(
            {
                "service_id": service_id,
                "action": action,
                "actor_id": actor_id,
                "request_id": request_id,
            }
        )
        if self.action_error is not None:
            raise self.action_error
        return ServiceActionResult(
            service_id=service_id,
            action=action,
            changed=True,
            installed=True,
            runtime_status="running",
            checked_at="2026-07-22T00:00:00Z",
        )


async def _request(
    app: FastAPI,
    path: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
        trust_env=False,
    ) as client:
        return await client.request(method, path, headers=headers)


@pytest.fixture
def routes(monkeypatch):
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
        Path(__file__).resolve().parents[3] / "backend-fastapi" / "app" / "api" / "routes" / "system_services.py"
    )
    spec = importlib.util.spec_from_file_location("_system_services_routes_under_test", route_file)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _app(routes, center: FakeServiceCenter | None = None) -> FastAPI:
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    fake_center = center or FakeServiceCenter()

    async def get_fake_service_center() -> FakeServiceCenter:
        return fake_center

    app.dependency_overrides[routes.get_service_center] = get_fake_service_center
    return app


async def test_service_inventory_requires_authentication(routes):
    center = FakeServiceCenter()
    response = await _request(_app(routes, center), "/api/system/services")

    assert response.status_code == 401
    assert center.snapshot_calls == 0


async def test_service_inventory_rejects_non_admin_user(routes):
    center = FakeServiceCenter()
    response = await _request(
        _app(routes, center),
        "/api/system/services",
        headers={"X-Test-Role": "user"},
    )

    assert response.status_code == 403
    assert center.snapshot_calls == 0


async def test_service_inventory_returns_documented_shape_for_admin(routes):
    response = await _request(
        _app(routes),
        "/api/system/services",
        headers={"X-Test-Role": "admin"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "data": {
            "checked_at": "2026-07-21T00:00:00Z",
            "deployment_mode": "native",
            "control_available": False,
            "control_status_detail": "disabled",
            "summary": {
                "total": 0,
                "healthy": 0,
                "degraded": 0,
                "unhealthy": 0,
                "disabled": 0,
                "unknown": 0,
            },
            "services": [],
        },
    }


async def test_service_inventory_serializes_image_presence_for_admin(routes):
    snapshot = ServiceSnapshot(
        checked_at="2026-07-22T00:00:00Z",
        deployment_mode="docker",
        control_available=True,
        control_status_detail=None,
        summary=ServiceSummary(total=1, unknown=1),
        services=[
            ServiceStatus(
                id="graphiti",
                category="knowledge",
                deployment="docker-compose",
                required=False,
                installed=False,
                image_status="partial",
                images=[
                    ServiceImageStatus(reference="neo4j:5.26.2", present=True),
                    ServiceImageStatus(reference="graphiti:latest", present=False),
                ],
                checked_at="2026-07-22T00:00:00Z",
            )
        ],
    )
    response = await _request(
        _app(routes, FakeServiceCenter(snapshot=snapshot)),
        "/api/system/services",
        headers={"X-Test-Role": "admin"},
    )

    assert response.status_code == 200
    service = response.json()["data"]["services"][0]
    assert service["image_status"] == "partial"
    assert service["images"] == [
        {"reference": "neo4j:5.26.2", "present": True},
        {"reference": "graphiti:latest", "present": False},
    ]


async def test_service_action_requires_admin_before_calling_controller(routes):
    center = FakeServiceCenter()
    app = _app(routes, center)

    unauthenticated = await _request(
        app,
        "/api/system/services/lightrag/actions/start",
        method="POST",
    )
    non_admin = await _request(
        app,
        "/api/system/services/lightrag/actions/start",
        method="POST",
        headers={"X-Test-Role": "user"},
    )

    assert unauthenticated.status_code == 401
    assert non_admin.status_code == 403
    assert center.action_calls == []


async def test_service_action_returns_typed_result_and_forwards_safe_request_id(routes):
    center = FakeServiceCenter()
    response = await _request(
        _app(routes, center),
        "/api/system/services/lightrag/actions/restart",
        method="POST",
        headers={"X-Test-Role": "admin", "X-Request-ID": "req.safe:123"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "data": {
            "service_id": "lightrag",
            "action": "restart",
            "changed": True,
            "installed": True,
            "runtime_status": "running",
            "checked_at": "2026-07-22T00:00:00Z",
        },
    }
    assert center.action_calls == [
        {
            "service_id": "lightrag",
            "action": "restart",
            "actor_id": "unknown",
            "request_id": "req.safe:123",
        }
    ]


async def test_service_action_replaces_untrusted_request_id(routes):
    center = FakeServiceCenter()
    untrusted = "unsafe request id"
    response = await _request(
        _app(routes, center),
        "/api/system/services/lightrag/actions/start",
        method="POST",
        headers={"X-Test-Role": "admin", "X-Request-ID": untrusted},
    )

    assert response.status_code == 200
    generated = center.action_calls[0]["request_id"]
    assert generated != untrusted
    assert len(generated) == 32


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (ServiceNotFound(), 404, "service_not_found"),
        (ServiceNotControllable(), 403, "service_not_controllable"),
        (ServiceNotInstalled(), 409, "service_not_installed"),
        (ServiceDeploymentConflict(), 409, "service_not_local_docker"),
        (ServiceActionInProgress(), 409, "service_action_in_progress"),
        (ServiceControlUnavailable(), 503, "service_control_unavailable"),
        (ServiceActionFailed(), 502, "service_action_failed"),
    ],
)
async def test_service_action_maps_stable_public_errors(
    routes,
    error,
    status_code,
    code,
):
    response = await _request(
        _app(routes, FakeServiceCenter(error)),
        "/api/system/services/lightrag/actions/stop",
        method="POST",
        headers={"X-Test-Role": "admin"},
    )

    assert response.status_code == status_code
    assert response.json() == {"detail": {"code": code}}


async def test_service_action_rejects_unknown_action_before_controller(routes):
    center = FakeServiceCenter()
    response = await _request(
        _app(routes, center),
        "/api/system/services/lightrag/actions/delete",
        method="POST",
        headers={"X-Test-Role": "admin"},
    )

    assert response.status_code == 422
    assert center.action_calls == []
