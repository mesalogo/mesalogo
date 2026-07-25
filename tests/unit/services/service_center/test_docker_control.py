from __future__ import annotations

import asyncio
from urllib.parse import unquote

import httpx
import pytest

from app.services.service_center.docker_control import (
    CONTROL_POLICIES,
    INVENTORY_POLICIES,
    DockerServiceController,
    ServiceActionFailed,
    ServiceActionInProgress,
    ServiceControlUnavailable,
    ServiceNotControllable,
    ServiceNotInstalled,
)

EXPECTED_IMAGES = {
    "milvus": (
        "quay.io/coreos/etcd:v3.5.18",
        "minio/minio:RELEASE.2024-12-18T13-15-44Z",
        "milvusdb/milvus:v2.6.6",
        "zilliz/attu:v2.6.3",
    ),
    "graphiti": ("neo4j:5.26.2", "graphiti:latest"),
    "lightrag": ("ghcr.io/hkuds/lightrag:latest",),
    "onlyoffice": (
        "postgres:15",
        "rabbitmq:3",
        "onlyoffice/documentserver",
    ),
    "galapagos": ("netlogo-web:latest",),
    "paddleocr-vl": ("ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-genai-vllm-server:latest-offline",),
    "code-server": ("lscr.io/linuxserver/code-server:latest",),
}
EXPECTED_READ_ONLY_IMAGES = {
    "backend": ("mesalogo/backend:latest",),
    "frontend": ("mesalogo/frontend:latest",),
    "database": ("mariadb:latest",),
    "redis": ("redis:8.6-alpine",),
}
ALL_EXPECTED_IMAGES = {**EXPECTED_READ_ONLY_IMAGES, **EXPECTED_IMAGES}


def _known_components() -> dict[str, tuple[str, bool]]:
    return {
        component.container_name: (component.compose_service, True)
        for policy in CONTROL_POLICIES.values()
        for component in policy.components
    }


def _docker_handler(
    components: dict[str, tuple[str, bool]],
    *,
    posts: list[tuple[str, str]] | None = None,
    compose_projects: dict[str, str] | None = None,
    images: dict[str, bool] | None = None,
    image_requests: list[str] | None = None,
):
    available_images = (
        {reference: True for references in ALL_EXPECTED_IMAGES.values() for reference in references}
        if images is None
        else images
    )

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/_ping":
            return httpx.Response(200, text="OK")

        parts = request.url.path.strip("/").split("/")
        if parts[0] == "images":
            raw_path = request.url.raw_path.decode("ascii")
            reference = unquote(raw_path.removeprefix("/images/").removesuffix("/json"))
            if image_requests is not None:
                image_requests.append(reference)
            return httpx.Response(
                200 if available_images.get(reference, False) else 404,
                json={} if available_images.get(reference, False) else {"message": "not found"},
            )
        assert parts[0] == "containers"
        name = unquote(parts[1])
        if name not in components:
            return httpx.Response(404, json={"message": "not found"})
        compose_service, running = components[name]
        compose_project = (compose_projects or {}).get(name, "abm-docker")

        if request.method == "GET":
            return httpx.Response(
                200,
                json={
                    "Name": f"/{name}",
                    "Config": {
                        "Labels": {
                            "com.docker.compose.service": compose_service,
                            "com.docker.compose.project": compose_project,
                        }
                    },
                    "State": {
                        "Running": running,
                        "Status": "running" if running else "exited",
                    },
                },
            )

        action = parts[2]
        if posts is not None:
            posts.append((name, action))
        if action == "start":
            components[name] = (compose_service, True)
        elif action == "stop":
            components[name] = (compose_service, False)
        else:
            raise AssertionError(f"unexpected action: {action}")
        return httpx.Response(204)

    return handler


def _controller(handler) -> DockerServiceController:
    return DockerServiceController(
        enabled=True,
        socket_path="/test/docker.sock",
        compose_project="abm-docker",
        transport_factory=lambda _path: httpx.MockTransport(handler),
    )


def test_control_policy_container_groups_are_disjoint():
    names = [component.container_name for policy in CONTROL_POLICIES.values() for component in policy.components]

    assert len(names) == len(set(names))


def test_control_policy_images_match_compose_definitions():
    actual = {
        service_id: tuple(component.image_reference for component in policy.components)
        for service_id, policy in CONTROL_POLICIES.items()
    }

    assert actual == EXPECTED_IMAGES


def test_inventory_policy_images_include_protected_core_services():
    actual = {
        service_id: tuple(component.image_reference for component in policy.components)
        for service_id, policy in INVENTORY_POLICIES.items()
    }

    assert actual == ALL_EXPECTED_IMAGES


async def test_control_is_disabled_by_default_without_opening_a_socket(monkeypatch):
    transport_calls = 0

    def unexpected_transport(_path: str):
        nonlocal transport_calls
        transport_calls += 1
        raise AssertionError("disabled control must not open the Docker socket")

    monkeypatch.delenv("SERVICE_CONTROL_ENABLED", raising=False)
    controller = DockerServiceController(transport_factory=unexpected_transport)

    inventory = await controller.inspect_inventory()

    assert inventory.available is False
    assert inventory.status_detail == "disabled"
    assert transport_calls == 0


async def test_invalid_compose_project_disables_control_before_socket_access():
    transport_calls = 0

    def unexpected_transport(_path: str):
        nonlocal transport_calls
        transport_calls += 1
        raise AssertionError("invalid control config must not open the Docker socket")

    controller = DockerServiceController(
        enabled=True,
        compose_project="../another-project",
        transport_factory=unexpected_transport,
    )

    inventory = await controller.inspect_inventory()

    assert inventory.available is False
    assert inventory.status_detail == "invalid_configuration"
    assert transport_calls == 0


async def test_inventory_requires_exact_container_name_and_compose_label():
    components = _known_components()
    components["graphiti"] = ("foreign-graphiti", True)
    controller = _controller(_docker_handler(components))

    inventory = await controller.inspect_inventory()

    assert inventory.available is True
    assert inventory.services["milvus"].installed is True
    assert inventory.services["milvus"].runtime_status == "running"
    assert inventory.services["graphiti"].installed is False
    assert inventory.services["graphiti"].control_status_detail == "foreign_container"


async def test_inventory_rejects_same_service_from_another_compose_project():
    components = _known_components()
    controller = _controller(
        _docker_handler(
            components,
            compose_projects={"graphiti": "another-project"},
        )
    )

    inventory = await controller.inspect_inventory()

    assert inventory.services["graphiti"].installed is False
    assert inventory.services["graphiti"].control_status_detail == "foreign_container"


async def test_mutation_never_posts_to_cross_project_container():
    components = _known_components()
    posts: list[tuple[str, str]] = []
    controller = _controller(
        _docker_handler(
            components,
            posts=posts,
            compose_projects={"graphiti": "another-project"},
        )
    )

    with pytest.raises(ServiceNotInstalled):
        await controller.perform_action("graphiti", "restart")

    assert posts == []


async def test_inventory_distinguishes_missing_partial_and_mixed_groups():
    components = _known_components()
    components.pop("milvus-attu")
    components.pop("onlyoffice-postgresql")
    components.pop("onlyoffice-rabbitmq")
    components.pop("onlyoffice-documentserver")
    label, _running = components["neo4j"]
    components["neo4j"] = (label, False)
    controller = _controller(_docker_handler(components))

    inventory = await controller.inspect_inventory()

    assert inventory.services["milvus"].control_status_detail == "partially_installed"
    assert inventory.services["onlyoffice"].control_status_detail == "not_installed"
    assert inventory.services["graphiti"].installed is True
    assert inventory.services["graphiti"].runtime_status == "unknown"
    assert inventory.services["graphiti"].control_status_detail == "mixed_runtime"


async def test_inventory_checks_images_even_when_containers_have_not_been_created():
    components = _known_components()
    for component_name in tuple(components):
        if component_name in {"lightrag", "neo4j", "graphiti", "galapagos"}:
            components.pop(component_name)
    images = {reference: True for references in ALL_EXPECTED_IMAGES.values() for reference in references}
    images["graphiti:latest"] = False
    images["netlogo-web:latest"] = False
    image_requests: list[str] = []
    controller = _controller(
        _docker_handler(
            components,
            images=images,
            image_requests=image_requests,
        )
    )

    inventory = await controller.inspect_inventory()

    assert set(image_requests) == {reference for references in ALL_EXPECTED_IMAGES.values() for reference in references}
    assert inventory.services["backend"].image_status == "available"
    assert inventory.services["frontend"].image_status == "available"
    assert inventory.services["database"].image_status == "available"
    assert inventory.services["redis"].image_status == "available"
    assert inventory.services["lightrag"].installed is False
    assert inventory.services["lightrag"].image_status == "available"
    assert inventory.services["graphiti"].image_status == "partial"
    assert [image.reference for image in inventory.services["graphiti"].images if not image.present] == [
        "graphiti:latest"
    ]
    assert inventory.services["galapagos"].image_status == "missing"


async def test_restart_stops_reverse_dependency_order_then_starts_forward():
    components = _known_components()
    posts: list[tuple[str, str]] = []
    controller = _controller(_docker_handler(components, posts=posts))

    result = await controller.perform_action("onlyoffice", "restart")

    assert posts == [
        ("onlyoffice-documentserver", "stop"),
        ("onlyoffice-rabbitmq", "stop"),
        ("onlyoffice-postgresql", "stop"),
        ("onlyoffice-postgresql", "start"),
        ("onlyoffice-rabbitmq", "start"),
        ("onlyoffice-documentserver", "start"),
    ]
    assert result.changed is True
    assert result.runtime_status == "running"


async def test_start_and_stop_are_idempotent():
    components = _known_components()
    posts: list[tuple[str, str]] = []
    controller = _controller(_docker_handler(components, posts=posts))

    started = await controller.perform_action("lightrag", "start")
    components["lightrag"] = ("lightrag", False)
    stopped = await controller.perform_action("lightrag", "stop")

    assert started.changed is False
    assert stopped.changed is False
    assert posts == []


async def test_daemon_noop_response_is_not_reported_as_changed():
    components = _known_components()
    components["lightrag"] = ("lightrag", False)
    base_handler = _docker_handler(components)

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            components["lightrag"] = ("lightrag", True)
            return httpx.Response(304)
        return await base_handler(request)

    controller = _controller(handler)

    result = await controller.perform_action("lightrag", "start")

    assert result.changed is False
    assert result.runtime_status == "running"


async def test_stop_timeout_exceeds_the_daemon_grace_period():
    components = _known_components()
    observed_read_timeout = 0.0
    base_handler = _docker_handler(components)

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal observed_read_timeout
        if request.method == "POST" and request.url.path.endswith("/stop"):
            observed_read_timeout = request.extensions["timeout"]["read"]
        return await base_handler(request)

    controller = _controller(handler)

    await controller.perform_action("lightrag", "stop")

    assert observed_read_timeout > 10


async def test_onlyoffice_documentserver_preserves_sixty_second_stop_grace():
    components = _known_components()
    observed: dict[str, tuple[str, float]] = {}
    base_handler = _docker_handler(components)

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path.endswith("/stop"):
            name = unquote(request.url.path.split("/")[2])
            observed[name] = (
                request.url.params["t"],
                request.extensions["timeout"]["read"],
            )
        return await base_handler(request)

    controller = _controller(handler)

    await controller.perform_action("onlyoffice", "stop")

    assert observed["onlyoffice-documentserver"] == ("60", 65.0)
    assert observed["onlyoffice-rabbitmq"] == ("10", 15.0)
    assert observed["onlyoffice-postgresql"] == ("10", 15.0)


async def test_action_fails_when_post_inspection_does_not_reach_terminal_state():
    components = _known_components()
    base_handler = _docker_handler(components)

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(204)
        return await base_handler(request)

    controller = _controller(handler)

    with pytest.raises(ServiceActionFailed):
        await controller.perform_action("lightrag", "stop")


async def test_dependent_container_starts_only_after_dependency_is_healthy():
    running = {"neo4j": False, "graphiti": False}
    neo4j_ready_checks = 0
    events: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal neo4j_ready_checks
        if request.url.path == "/_ping":
            return httpx.Response(200, text="OK")
        if request.url.path.startswith("/images/"):
            return httpx.Response(200, json={})
        parts = request.url.path.strip("/").split("/")
        name = unquote(parts[1])
        if request.method == "POST":
            action = parts[2]
            events.append(f"{action}:{name}")
            running[name] = action == "start"
            return httpx.Response(204)

        health_status = None
        if name == "neo4j":
            if running[name]:
                neo4j_ready_checks += 1
                health_status = "healthy" if neo4j_ready_checks >= 2 else "starting"
            else:
                health_status = "unhealthy"
            events.append(f"inspect:{name}:{health_status}")
        state: dict[str, object] = {
            "Running": running[name],
            "Status": "running" if running[name] else "exited",
        }
        if health_status is not None:
            state["Health"] = {"Status": health_status}
        return httpx.Response(
            200,
            json={
                "Name": f"/{name}",
                "Config": {
                    "Labels": {
                        "com.docker.compose.service": name,
                        "com.docker.compose.project": "abm-docker",
                    }
                },
                "State": state,
            },
        )

    waiter_calls = 0

    async def immediate_waiter(_delay: float) -> None:
        nonlocal waiter_calls
        waiter_calls += 1

    controller = DockerServiceController(
        enabled=True,
        socket_path="/test/docker.sock",
        compose_project="abm-docker",
        transport_factory=lambda _path: httpx.MockTransport(handler),
        readiness_waiter=immediate_waiter,
    )

    result = await controller.perform_action("graphiti", "start")

    assert result.runtime_status == "running"
    assert waiter_calls == 1
    assert events.index("inspect:neo4j:healthy") < events.index("start:graphiti")


async def test_dependency_readiness_timeout_fails_without_starting_dependent():
    running = {"neo4j": False, "graphiti": False}
    started: list[str] = []
    now = 0.0

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/_ping":
            return httpx.Response(200, text="OK")
        if request.url.path.startswith("/images/"):
            return httpx.Response(200, json={})
        parts = request.url.path.strip("/").split("/")
        name = unquote(parts[1])
        if request.method == "POST":
            started.append(name)
            running[name] = True
            return httpx.Response(204)
        state: dict[str, object] = {
            "Running": running[name],
            "Status": "running" if running[name] else "exited",
        }
        if name == "neo4j":
            state["Health"] = {"Status": "starting"}
        return httpx.Response(
            200,
            json={
                "Name": f"/{name}",
                "Config": {
                    "Labels": {
                        "com.docker.compose.service": name,
                        "com.docker.compose.project": "abm-docker",
                    }
                },
                "State": state,
            },
        )

    async def advance_clock(_delay: float) -> None:
        nonlocal now
        now += 31.0

    controller = DockerServiceController(
        enabled=True,
        socket_path="/test/docker.sock",
        compose_project="abm-docker",
        transport_factory=lambda _path: httpx.MockTransport(handler),
        readiness_waiter=advance_clock,
        clock=lambda: now,
    )

    with pytest.raises(ServiceActionFailed):
        await controller.perform_action("graphiti", "start")

    assert started == ["neo4j"]


async def test_parallel_stage_waits_for_sibling_post_before_returning_failure():
    components = _known_components()
    for name in (
        "onlyoffice-postgresql",
        "onlyoffice-rabbitmq",
        "onlyoffice-documentserver",
    ):
        label, _running = components[name]
        components[name] = (label, False)
    allow_postgresql_finish = asyncio.Event()
    postgresql_finished = asyncio.Event()
    base_handler = _docker_handler(components)

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method != "POST":
            return await base_handler(request)
        name = unquote(request.url.path.split("/")[2])
        if name == "onlyoffice-rabbitmq":
            allow_postgresql_finish.set()
            return httpx.Response(500)
        if name == "onlyoffice-postgresql":
            await allow_postgresql_finish.wait()
            components[name] = (name, True)
            postgresql_finished.set()
            return httpx.Response(204)
        raise AssertionError(f"dependent must not start after stage failure: {name}")

    controller = _controller(handler)

    with pytest.raises(ServiceActionFailed):
        await controller.perform_action("onlyoffice", "start")

    assert postgresql_finished.is_set()
    assert components["onlyoffice-postgresql"][1] is True
    assert components["onlyoffice-rabbitmq"][1] is False
    assert components["onlyoffice-documentserver"][1] is False


async def test_mutation_requires_every_component_to_be_installed():
    components = _known_components()
    components.pop("neo4j")
    posts: list[tuple[str, str]] = []
    controller = _controller(_docker_handler(components, posts=posts))

    with pytest.raises(ServiceNotInstalled):
        await controller.perform_action("graphiti", "restart")

    assert posts == []


async def test_controller_denies_every_non_allowlisted_logical_id():
    controller = _controller(_docker_handler(_known_components()))

    for service_id in ("backend", "frontend", "database", "redis", "unknown"):
        with pytest.raises(ServiceNotControllable):
            await controller.perform_action(service_id, "restart")


async def test_unavailable_socket_has_stable_inventory_and_action_error():
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("private socket detail", request=request)

    controller = _controller(handler)

    inventory = await controller.inspect_inventory()
    assert inventory.available is False
    assert inventory.status_detail == "docker_socket_unavailable"
    assert inventory.services == {}

    with pytest.raises(ServiceControlUnavailable):
        await controller.perform_action("lightrag", "start")


async def test_same_service_action_fails_fast_while_process_lock_is_held():
    components = _known_components()
    requests: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        return await _docker_handler(components)(request)

    controller = _controller(handler)
    lock = controller._locks["graphiti"]
    await lock.acquire()
    try:
        with pytest.raises(ServiceActionInProgress):
            await controller.perform_action("graphiti", "restart")
        assert requests == []
    finally:
        lock.release()
