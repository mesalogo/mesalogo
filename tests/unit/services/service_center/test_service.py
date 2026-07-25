from __future__ import annotations

import asyncio
import sys
from types import ModuleType

import pytest

from app.services.service_center.docker_control import (
    DockerControlInventory,
    DockerImageState,
    DockerServiceRuntime,
    ServiceControlUnavailable,
    ServiceDeploymentConflict,
    ServiceNotControllable,
    ServiceNotFound,
)
from app.services.service_center.models import (
    ResolvedService,
    ServiceCapabilities,
    ServiceDefinition,
    ServiceStatus,
)
from app.services.service_center.service import ServiceCenter, sanitize_endpoint


class FakeDockerController:
    def __init__(self, inventory: DockerControlInventory) -> None:
        self.inventory = inventory
        self.action_calls = 0

    async def inspect_inventory(self) -> DockerControlInventory:
        return self.inventory

    async def perform_action(self, service_id, action):
        self.action_calls += 1
        raise AssertionError(f"unexpected action: {service_id}/{action}")


def _definition(service_id: str) -> ServiceDefinition:
    return ServiceDefinition(
        id=service_id,
        category="capability",
        deployment="external",
        required=False,
        dependencies=(),
        components=(service_id,),
        config_route=None,
        capabilities=ServiceCapabilities(),
    )


def test_sanitize_endpoint_removes_credentials_query_fragment_and_local_path():
    assert (
        sanitize_endpoint("redis://admin:secret@redis.internal:6379/0?token=abc#debug") == "redis://redis.internal:6379"
    )
    assert sanitize_endpoint("https://user:pass@example.test:8443/health?api_key=secret") == "https://example.test:8443"
    assert sanitize_endpoint("sqlite:////private/data/app.db") == "sqlite://"
    assert sanitize_endpoint("not a url") is None
    assert sanitize_endpoint("javascript://example.test/alert") is None


def test_database_configured_http_endpoint_is_display_only(monkeypatch):
    center = ServiceCenter()
    definition = _definition("graphiti")
    monkeypatch.setenv("ABM_DEPLOYMENT_MODE", "native")
    monkeypatch.delenv("SERVICE_CENTER_GRAPHITI_PROBE_URL", raising=False)
    monkeypatch.setattr(
        center,
        "_resolve_graph_framework",
        lambda _framework: (True, "http://127.0.0.1/private?token=secret"),
    )

    resolved = center._resolve_service(definition)

    assert resolved.enabled is True
    assert resolved.display_endpoint == "http://127.0.0.1"
    assert resolved.probe_target is None


def test_docker_catalog_probe_is_fixed_and_never_reuses_stored_external_url(
    monkeypatch,
):
    center = ServiceCenter()
    definition = _definition("graphiti")
    monkeypatch.setenv("ABM_DEPLOYMENT_MODE", "docker")
    monkeypatch.delenv("SERVICE_CENTER_GRAPHITI_PROBE_URL", raising=False)

    monkeypatch.setattr(
        center,
        "_resolve_graph_framework",
        lambda _framework: (True, "http://localhost:16040/private"),
    )
    local = center._resolve_service(definition)

    monkeypatch.setattr(
        center,
        "_resolve_graph_framework",
        lambda _framework: (True, "http://169.254.169.254/latest/meta-data"),
    )
    external = center._resolve_service(definition)

    assert local.probe_target == "http://graphiti:8000/healthcheck"
    assert local.deployment == "docker-compose"
    assert external.probe_target is None
    assert external.deployment == "external"


def test_explicit_external_probe_prevents_local_container_control(monkeypatch):
    center = ServiceCenter()
    definition = _definition("graphiti")
    monkeypatch.setenv("ABM_DEPLOYMENT_MODE", "docker")
    monkeypatch.setenv(
        "SERVICE_CENTER_GRAPHITI_PROBE_URL",
        "https://third-party.example/",
    )
    monkeypatch.setattr(
        center,
        "_resolve_graph_framework",
        lambda _framework: (True, "/proxy/graphiti"),
    )

    resolved = center._resolve_service(definition)

    assert resolved.probe_target == "https://third-party.example/healthcheck"
    assert resolved.deployment == "external"


async def test_database_ping_is_single_flight_after_callers_time_out(monkeypatch):
    center = ServiceCenter(definitions=(), resolver=lambda definition: definition)
    release = asyncio.Event()
    started = 0

    async def fake_to_thread(_function, *_args):
        nonlocal started
        started += 1
        await release.wait()

    monkeypatch.setattr(asyncio, "to_thread", fake_to_thread)

    first, second = await asyncio.gather(
        asyncio.wait_for(center._database_ping_singleflight(), timeout=0.01),
        asyncio.wait_for(center._database_ping_singleflight(), timeout=0.01),
        return_exceptions=True,
    )

    assert isinstance(first, TimeoutError)
    assert isinstance(second, TimeoutError)
    assert started == 1

    third_started = asyncio.Event()

    async def third_ping():
        third_started.set()
        await center._database_ping_singleflight()

    third = asyncio.create_task(third_ping())
    await third_started.wait()
    assert started == 1
    release.set()
    await third


async def test_configuration_resolution_is_single_flight_after_timeout(monkeypatch):
    center = ServiceCenter(definitions=())
    release = asyncio.Event()
    started = 0

    async def fake_to_thread(_function, *_args):
        nonlocal started
        started += 1
        await release.wait()
        return []

    monkeypatch.setattr(asyncio, "to_thread", fake_to_thread)

    first, second = await asyncio.gather(
        asyncio.wait_for(center._resolve_definitions_singleflight(), timeout=0.01),
        asyncio.wait_for(center._resolve_definitions_singleflight(), timeout=0.01),
        return_exceptions=True,
    )

    assert isinstance(first, TimeoutError)
    assert isinstance(second, TimeoutError)
    assert started == 1

    third_started = asyncio.Event()

    async def third_resolution():
        third_started.set()
        return await center._resolve_definitions_singleflight()

    third = asyncio.create_task(third_resolution())
    await third_started.wait()
    assert started == 1
    release.set()
    assert await third == []


async def test_snapshot_runs_probes_concurrently_and_isolates_one_failure():
    definitions = tuple(_definition(service_id) for service_id in ("one", "two", "three"))
    started: set[str] = set()
    all_started = asyncio.Event()

    def resolver(definition: ServiceDefinition) -> ResolvedService:
        return ResolvedService(
            definition=definition,
            enabled=True,
            probe_target=f"https://{definition.id}.example/health",
            display_endpoint=f"https://{definition.id}.example",
        )

    async def probe(resolved: ResolvedService, _client) -> ServiceStatus:
        started.add(resolved.definition.id)
        if len(started) == len(definitions):
            all_started.set()
        await asyncio.wait_for(all_started.wait(), timeout=0.2)
        if resolved.definition.id == "two":
            raise RuntimeError("credential-bearing details must not escape")
        return ServiceStatus.from_resolved(
            resolved,
            runtime_status="running",
            health_status="healthy",
            latency_ms=1.0,
        )

    center = ServiceCenter(
        definitions=definitions,
        resolver=resolver,
        probe_overrides={item.id: probe for item in definitions},
        probe_timeout=0.5,
    )

    snapshot = await center.get_snapshot()

    assert started == {"one", "two", "three"}
    assert snapshot.summary.total == 3
    assert snapshot.summary.healthy == 2
    assert snapshot.summary.unhealthy == 1
    failed = next(item for item in snapshot.services if item.id == "two")
    assert failed.runtime_status == "unknown"
    assert failed.health_status == "unhealthy"
    assert failed.status_detail == "probe_error"
    assert "credential" not in failed.model_dump_json()


async def test_disabled_service_is_not_probed_or_claimed_stopped():
    definition = _definition("optional")
    calls = 0

    def resolver(item: ServiceDefinition) -> ResolvedService:
        return ResolvedService(
            definition=item,
            enabled=False,
            probe_target="https://optional.example/health",
            display_endpoint="https://optional.example",
        )

    async def probe(_resolved: ResolvedService, _client) -> ServiceStatus:
        nonlocal calls
        calls += 1
        raise AssertionError("disabled services must not be probed")

    center = ServiceCenter(
        definitions=(definition,),
        resolver=resolver,
        probe_overrides={"optional": probe},
    )

    snapshot = await center.get_snapshot()

    assert calls == 0
    assert snapshot.services[0].runtime_status == "unknown"
    assert snapshot.services[0].health_status == "disabled"


async def test_snapshot_merges_control_state_only_for_local_compose_service():
    definition = _definition("graphiti")

    def resolver(item: ServiceDefinition) -> ResolvedService:
        return ResolvedService(
            definition=item,
            deployment="docker-compose",
            enabled=True,
            probe_target="https://graphiti.example/health",
        )

    async def probe(resolved: ResolvedService, _client) -> ServiceStatus:
        return ServiceStatus.from_resolved(
            resolved,
            runtime_status="running",
            health_status="healthy",
        )

    controller = FakeDockerController(
        DockerControlInventory(
            available=True,
            status_detail=None,
            services={
                "graphiti": DockerServiceRuntime(
                    installed=True,
                    runtime_status="stopped",
                    image_status="partial",
                    images=(
                        DockerImageState(reference="neo4j:5.26.2", present=True),
                        DockerImageState(reference="graphiti:latest", present=False),
                    ),
                )
            },
        )
    )
    center = ServiceCenter(
        definitions=(definition,),
        resolver=resolver,
        probe_overrides={"graphiti": probe},
        docker_controller=controller,
    )

    snapshot = await center.get_snapshot()
    status = snapshot.services[0]

    assert snapshot.control_available is True
    assert status.installed is True
    assert status.image_status == "partial"
    assert [image.model_dump() for image in status.images] == [
        {"reference": "neo4j:5.26.2", "present": True},
        {"reference": "graphiti:latest", "present": False},
    ]
    assert status.runtime_status == "stopped"
    assert status.capabilities.start is True
    assert status.capabilities.stop is False
    assert status.capabilities.restart is True


async def test_snapshot_merges_image_state_for_protected_local_service():
    definition = _definition("database")

    def resolver(item: ServiceDefinition) -> ResolvedService:
        return ResolvedService(
            definition=item,
            deployment="docker-compose",
            enabled=True,
            probe_target="https://database.example/health",
        )

    async def probe(resolved: ResolvedService, _client) -> ServiceStatus:
        return ServiceStatus.from_resolved(
            resolved,
            runtime_status="running",
            health_status="healthy",
        )

    controller = FakeDockerController(
        DockerControlInventory(
            available=True,
            status_detail=None,
            services={
                "database": DockerServiceRuntime(
                    installed=True,
                    runtime_status="stopped",
                    image_status="available",
                    images=(DockerImageState(reference="mariadb:latest", present=True),),
                )
            },
        )
    )
    center = ServiceCenter(
        definitions=(definition,),
        resolver=resolver,
        probe_overrides={"database": probe},
        docker_controller=controller,
    )

    status = (await center.get_snapshot()).services[0]

    assert status.image_status == "available"
    assert [image.model_dump() for image in status.images] == [
        {"reference": "mariadb:latest", "present": True},
    ]
    assert status.runtime_status == "running"
    assert status.capabilities.start is False
    assert status.capabilities.stop is False
    assert status.capabilities.restart is False


async def test_snapshot_never_overrides_external_service_with_local_container():
    definition = _definition("graphiti")

    def resolver(item: ServiceDefinition) -> ResolvedService:
        return ResolvedService(
            definition=item,
            deployment="external",
            enabled=True,
            probe_target="https://third-party.example/health",
        )

    async def probe(resolved: ResolvedService, _client) -> ServiceStatus:
        return ServiceStatus.from_resolved(
            resolved,
            runtime_status="running",
            health_status="healthy",
        )

    controller = FakeDockerController(
        DockerControlInventory(
            available=True,
            status_detail=None,
            services={
                "graphiti": DockerServiceRuntime(
                    installed=True,
                    runtime_status="stopped",
                )
            },
        )
    )
    center = ServiceCenter(
        definitions=(definition,),
        resolver=resolver,
        probe_overrides={"graphiti": probe},
        docker_controller=controller,
    )

    status = (await center.get_snapshot()).services[0]

    assert status.installed is None
    assert status.runtime_status == "running"
    assert status.control_status_detail == "external_service"
    assert status.capabilities.start is False
    assert status.capabilities.stop is False
    assert status.capabilities.restart is False


async def test_action_rejects_external_core_and_unknown_before_docker_mutation():
    graphiti = _definition("graphiti")
    backend = _definition("backend")
    controller = FakeDockerController(DockerControlInventory(available=True, status_detail=None, services={}))
    center = ServiceCenter(
        definitions=(graphiti, backend),
        resolver=lambda item: ResolvedService(
            definition=item,
            deployment="external",
            enabled=True,
        ),
        docker_controller=controller,
    )

    with pytest.raises(ServiceDeploymentConflict):
        await center.control_service(
            "graphiti",
            "restart",
            actor_id="admin-1",
            request_id="request-1",
        )
    with pytest.raises(ServiceNotControllable):
        await center.control_service(
            "backend",
            "restart",
            actor_id="admin-1",
            request_id="request-2",
        )
    with pytest.raises(ServiceNotFound):
        await center.control_service(
            "missing",
            "restart",
            actor_id="admin-1",
            request_id="request-3",
        )

    assert controller.action_calls == 0


async def test_action_bounds_shared_default_configuration_resolution(monkeypatch):
    controller = FakeDockerController(DockerControlInventory(available=True, status_detail=None, services={}))
    center = ServiceCenter(
        definitions=(_definition("graphiti"),),
        probe_timeout=0.01,
        docker_controller=controller,
    )
    resolution_started = asyncio.Event()
    never_finishes = asyncio.Event()

    async def blocked_resolution():
        resolution_started.set()
        await never_finishes.wait()
        return []

    monkeypatch.setattr(center, "_resolve_definitions_singleflight", blocked_resolution)

    with pytest.raises(ServiceControlUnavailable):
        await center.control_service(
            "graphiti",
            "start",
            actor_id="admin-1",
            request_id="request-1",
        )

    assert resolution_started.is_set()
    assert controller.action_calls == 0


async def test_timeout_marks_explicitly_enabled_service_unhealthy():
    definition = _definition("slow")

    def resolver(item: ServiceDefinition) -> ResolvedService:
        return ResolvedService(
            definition=item,
            enabled=True,
            probe_target="https://slow.example/health",
            display_endpoint="https://slow.example",
        )

    async def probe(_resolved: ResolvedService, _client) -> ServiceStatus:
        await asyncio.Event().wait()
        raise AssertionError("unreachable")

    center = ServiceCenter(
        definitions=(definition,),
        resolver=resolver,
        probe_overrides={"slow": probe},
        probe_timeout=0.01,
    )

    status = (await center.get_snapshot()).services[0]

    assert status.runtime_status == "unknown"
    assert status.health_status == "unhealthy"
    assert status.status_detail == "timeout"


def test_redis_client_closes_when_ping_fails(monkeypatch):
    closed = False

    class FakeRedisClient:
        def ping(self):
            raise ConnectionError("unavailable")

        def close(self):
            nonlocal closed
            closed = True

    redis_module = ModuleType("redis")
    redis_module.from_url = lambda *_args, **_kwargs: FakeRedisClient()
    monkeypatch.setitem(sys.modules, "redis", redis_module)

    with pytest.raises(ConnectionError):
        ServiceCenter._redis_ping("redis://redis.example:6379", 0.1)

    assert closed is True
