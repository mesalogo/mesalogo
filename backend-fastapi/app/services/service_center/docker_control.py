"""Allowlisted Docker lifecycle control over an explicitly mounted Unix socket.

The caller can select only a logical service and an action. Container names,
Compose labels, dependency order, and Docker API paths all come from this
source-controlled policy; none are accepted from an HTTP request.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from collections.abc import Awaitable, Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from time import monotonic
from types import MappingProxyType
from typing import Any
from urllib.parse import quote

import httpx

from .models import ControlAction, ImageStatus, RuntimeStatus, ServiceActionResult

logger = logging.getLogger(__name__)

_TRUE_VALUES = {"1", "true", "yes", "on"}
_FALSE_VALUES = {"0", "false", "no", "off"}
_DEFAULT_SOCKET_PATH = "/var/run/docker.sock"
_DEFAULT_COMPOSE_PROJECT = "abm-docker"
_STOP_REQUEST_TIMEOUT_MARGIN = 5.0
_COMPOSE_PROJECT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")


@dataclass(frozen=True, slots=True)
class DockerComponentPolicy:
    container_name: str
    compose_service: str
    image_reference: str
    stop_timeout: int = 10
    start_stage: int = 0
    ready_timeout: float = 45.0


@dataclass(frozen=True, slots=True)
class DockerServicePolicy:
    components: tuple[DockerComponentPolicy, ...]


def _component(
    name: str,
    image_reference: str,
    compose_service: str | None = None,
    *,
    stop_timeout: int = 10,
    start_stage: int = 0,
    ready_timeout: float = 45.0,
) -> DockerComponentPolicy:
    return DockerComponentPolicy(
        container_name=name,
        compose_service=compose_service or name,
        image_reference=image_reference,
        stop_timeout=stop_timeout,
        start_stage=start_stage,
        ready_timeout=ready_timeout,
    )


# Dependency order is forward. Stop operations iterate it in reverse.
CONTROL_POLICIES: Mapping[str, DockerServicePolicy] = MappingProxyType(
    {
        "milvus": DockerServicePolicy(
            components=(
                _component(
                    "milvus-etcd",
                    "quay.io/coreos/etcd:v3.5.18",
                    ready_timeout=45.0,
                ),
                _component(
                    "milvus-minio",
                    "minio/minio:RELEASE.2024-12-18T13-15-44Z",
                    ready_timeout=45.0,
                ),
                _component(
                    "milvus-standalone",
                    "milvusdb/milvus:v2.6.6",
                    start_stage=1,
                    ready_timeout=90.0,
                ),
                _component("milvus-attu", "zilliz/attu:v2.6.3", start_stage=2),
            )
        ),
        "graphiti": DockerServicePolicy(
            components=(
                _component("neo4j", "neo4j:5.26.2", ready_timeout=30.0),
                _component("graphiti", "graphiti:latest", start_stage=1),
            )
        ),
        "lightrag": DockerServicePolicy(components=(_component("lightrag", "ghcr.io/hkuds/lightrag:latest"),)),
        "onlyoffice": DockerServicePolicy(
            components=(
                _component(
                    "onlyoffice-postgresql",
                    "postgres:15",
                    ready_timeout=30.0,
                ),
                _component(
                    "onlyoffice-rabbitmq",
                    "rabbitmq:3",
                    ready_timeout=30.0,
                ),
                _component(
                    "onlyoffice-documentserver",
                    "onlyoffice/documentserver",
                    stop_timeout=60,
                    start_stage=1,
                ),
            )
        ),
        "galapagos": DockerServicePolicy(components=(_component("galapagos", "netlogo-web:latest"),)),
        "paddleocr-vl": DockerServicePolicy(
            components=(
                _component(
                    "paddle-ocr-vl",
                    "ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-genai-vllm-server:latest-offline",
                ),
            )
        ),
        "code-server": DockerServicePolicy(
            components=(
                _component(
                    "code-server",
                    "lscr.io/linuxserver/code-server:latest",
                ),
            )
        ),
    }
)

# These core services are deliberately read-only in the application UI. They
# still participate in inventory so operators can verify that their expected
# local images exist without granting lifecycle control over the control plane.
_READ_ONLY_POLICIES: Mapping[str, DockerServicePolicy] = MappingProxyType(
    {
        "backend": DockerServicePolicy(components=(_component("abm-backend", "mesalogo/backend:latest", "backend"),)),
        "frontend": DockerServicePolicy(
            components=(_component("abm-frontend", "mesalogo/frontend:latest", "frontend"),)
        ),
        "database": DockerServicePolicy(components=(_component("abm-mariadb", "mariadb:latest", "mariadb"),)),
        "redis": DockerServicePolicy(components=(_component("abm-redis", "redis:8.6-alpine", "redis"),)),
    }
)

INVENTORY_POLICIES: Mapping[str, DockerServicePolicy] = MappingProxyType({**_READ_ONLY_POLICIES, **CONTROL_POLICIES})
_INVENTORIED_CONTAINER_NAMES = [
    component.container_name for policy in INVENTORY_POLICIES.values() for component in policy.components
]
if len(_INVENTORIED_CONTAINER_NAMES) != len(set(_INVENTORIED_CONTAINER_NAMES)):
    raise RuntimeError("Docker service inventory policies must have disjoint containers")
if any(
    tuple(component.start_stage for component in policy.components)
    != tuple(sorted(component.start_stage for component in policy.components))
    for policy in CONTROL_POLICIES.values()
):
    raise RuntimeError("Docker service control stages must be in dependency order")


@dataclass(frozen=True, slots=True)
class DockerComponentState:
    installed: bool
    running: bool = False
    status: str = "unknown"
    detail: str | None = None
    health_status: str | None = None


@dataclass(frozen=True, slots=True)
class DockerImageState:
    reference: str
    present: bool


@dataclass(frozen=True, slots=True)
class DockerServiceRuntime:
    installed: bool
    runtime_status: RuntimeStatus
    control_status_detail: str | None = None
    image_status: ImageStatus = "unknown"
    images: tuple[DockerImageState, ...] = ()


@dataclass(frozen=True, slots=True)
class DockerControlInventory:
    available: bool
    status_detail: str | None
    services: Mapping[str, DockerServiceRuntime]


class ServiceControlError(RuntimeError):
    """Base error carrying only a stable, non-sensitive public code."""

    code = "service_control_error"


class ServiceControlUnavailable(ServiceControlError):
    code = "service_control_unavailable"


class ServiceNotControllable(ServiceControlError):
    code = "service_not_controllable"


class ServiceNotInstalled(ServiceControlError):
    code = "service_not_installed"


class ServiceActionInProgress(ServiceControlError):
    code = "service_action_in_progress"


class ServiceActionFailed(ServiceControlError):
    code = "service_action_failed"


class ServiceNotFound(ServiceControlError):
    code = "service_not_found"


class ServiceDeploymentConflict(ServiceControlError):
    code = "service_not_local_docker"


class _DockerUnavailable(RuntimeError):
    pass


TransportFactory = Callable[[str], httpx.AsyncBaseTransport]
ReadinessWaiter = Callable[[float], Awaitable[None]]


class DockerServiceController:
    """Inspect and mutate an exact Docker container allowlist asynchronously."""

    def __init__(
        self,
        *,
        enabled: bool | None = None,
        socket_path: str | None = None,
        compose_project: str | None = None,
        timeout: float = 5.0,
        transport_factory: TransportFactory | None = None,
        readiness_waiter: ReadinessWaiter | None = None,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._explicit_enabled = enabled
        self._explicit_socket_path = socket_path
        self._explicit_compose_project = compose_project
        self.timeout = timeout
        self._transport_factory = transport_factory or self._make_uds_transport
        self._readiness_waiter = readiness_waiter or asyncio.sleep
        self._clock = clock or monotonic
        self._locks = {service_id: asyncio.Lock() for service_id in CONTROL_POLICIES}

    @staticmethod
    def _make_uds_transport(socket_path: str) -> httpx.AsyncBaseTransport:
        return httpx.AsyncHTTPTransport(uds=socket_path, retries=0)

    def _configuration(self) -> tuple[bool, str | None, str, str]:
        if self._explicit_enabled is None:
            raw_enabled = os.environ.get("SERVICE_CONTROL_ENABLED", "").strip().lower()
            if not raw_enabled:
                enabled = False
            elif raw_enabled in _TRUE_VALUES:
                enabled = True
            elif raw_enabled in _FALSE_VALUES:
                enabled = False
            else:
                return False, "invalid_configuration", "", ""
        else:
            enabled = self._explicit_enabled

        socket_path = (
            self._explicit_socket_path
            if self._explicit_socket_path is not None
            else os.environ.get("DOCKER_SOCKET_PATH", _DEFAULT_SOCKET_PATH)
        )
        socket_path = socket_path.strip()
        compose_project = (
            self._explicit_compose_project
            if self._explicit_compose_project is not None
            else os.environ.get(
                "SERVICE_CONTROL_COMPOSE_PROJECT",
                _DEFAULT_COMPOSE_PROJECT,
            )
        )
        compose_project = compose_project.strip()
        if enabled and (
            not socket_path
            or not os.path.isabs(socket_path)
            or "\x00" in socket_path
            or not _COMPOSE_PROJECT_RE.fullmatch(compose_project)
        ):
            return False, "invalid_configuration", "", ""
        return enabled, None if enabled else "disabled", socket_path, compose_project

    def _client(self, socket_path: str) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=self._transport_factory(socket_path),
            base_url="http://docker",
            timeout=httpx.Timeout(self.timeout),
            follow_redirects=False,
            trust_env=False,
        )

    async def inspect_inventory(self) -> DockerControlInventory:
        enabled, configuration_detail, socket_path, compose_project = self._configuration()
        if not enabled:
            return DockerControlInventory(
                available=False,
                status_detail=configuration_detail,
                services={},
            )

        try:
            async with self._client(socket_path) as client:
                await self._ping(client)
                runtimes = await self._gather_settled(
                    self._inspect_policy(client, policy, compose_project) for policy in INVENTORY_POLICIES.values()
                )
        except Exception as exc:
            logger.warning(
                "Docker service control inspection unavailable: error_type=%s",
                type(exc.__cause__ or exc).__name__,
            )
            return DockerControlInventory(
                available=False,
                status_detail="docker_socket_unavailable",
                services={},
            )

        return DockerControlInventory(
            available=True,
            status_detail=None,
            services=dict(zip(INVENTORY_POLICIES, runtimes, strict=True)),
        )

    async def perform_action(
        self,
        service_id: str,
        action: ControlAction,
    ) -> ServiceActionResult:
        policy = CONTROL_POLICIES.get(service_id)
        if policy is None:
            raise ServiceNotControllable

        enabled, _configuration_detail, socket_path, compose_project = self._configuration()
        if not enabled:
            raise ServiceControlUnavailable

        lock = self._locks[service_id]
        if lock.locked():
            raise ServiceActionInProgress

        async with lock:
            try:
                async with self._client(socket_path) as client:
                    await self._ping(client)
                    states = await self._inspect_components(
                        client,
                        policy,
                        compose_project,
                    )
                    if any(not state.installed for state in states):
                        raise ServiceNotInstalled

                    changed = await self._mutate(
                        client,
                        policy,
                        states,
                        action,
                        compose_project,
                    )
                    runtime = await self._inspect_policy(
                        client,
                        policy,
                        compose_project,
                    )
            except ServiceControlError:
                raise
            except _DockerUnavailable as exc:
                logger.warning(
                    "Docker service action unavailable: service_id=%s action=%s error_type=%s",
                    service_id,
                    action,
                    type(exc.__cause__ or exc).__name__,
                )
                raise ServiceControlUnavailable from None
            except Exception as exc:
                logger.error(
                    "Docker service action failed: service_id=%s action=%s error_type=%s",
                    service_id,
                    action,
                    type(exc).__name__,
                )
                raise ServiceActionFailed from None

        expected_runtime: RuntimeStatus = "stopped" if action == "stop" else "running"
        if not runtime.installed or runtime.runtime_status != expected_runtime:
            raise ServiceActionFailed
        return ServiceActionResult(
            service_id=service_id,
            action=action,
            changed=changed,
            installed=True,
            runtime_status=runtime.runtime_status,
            checked_at=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        )

    async def _ping(self, client: httpx.AsyncClient) -> None:
        try:
            response = await client.get("/_ping")
            if response.status_code >= 400 or response.text.strip().upper() != "OK":
                raise _DockerUnavailable
        except _DockerUnavailable:
            raise
        except (httpx.HTTPError, OSError) as exc:
            raise _DockerUnavailable from exc

    async def _inspect_policy(
        self,
        client: httpx.AsyncClient,
        policy: DockerServicePolicy,
        compose_project: str,
    ) -> DockerServiceRuntime:
        states, images = await asyncio.gather(
            self._inspect_components(client, policy, compose_project),
            self._inspect_images(client, policy),
        )
        image_status = self._aggregate_image_status(images)
        installed = all(state.installed for state in states)
        if not installed:
            if any(state.detail == "foreign_container" for state in states):
                detail = "foreign_container"
            elif any(state.installed for state in states):
                detail = "partially_installed"
            else:
                detail = "not_installed"
            return DockerServiceRuntime(
                installed=False,
                runtime_status="unknown",
                control_status_detail=detail,
                image_status=image_status,
                images=images,
            )
        if all(state.running for state in states):
            runtime_status: RuntimeStatus = "running"
        elif all(not state.running for state in states):
            runtime_status = "stopped"
        else:
            runtime_status = "unknown"
        return DockerServiceRuntime(
            installed=True,
            runtime_status=runtime_status,
            control_status_detail="mixed_runtime" if runtime_status == "unknown" else None,
            image_status=image_status,
            images=images,
        )

    async def _inspect_images(
        self,
        client: httpx.AsyncClient,
        policy: DockerServicePolicy,
    ) -> tuple[DockerImageState, ...]:
        states = await self._gather_settled(
            self._inspect_image(client, component.image_reference) for component in policy.components
        )
        return tuple(states)

    @staticmethod
    async def _inspect_image(
        client: httpx.AsyncClient,
        reference: str,
    ) -> DockerImageState:
        path = f"/images/{quote(reference, safe='')}/json"
        try:
            response = await client.get(path)
        except (httpx.HTTPError, OSError) as exc:
            raise _DockerUnavailable from exc
        if response.status_code == 404:
            return DockerImageState(reference=reference, present=False)
        if response.status_code >= 400:
            raise _DockerUnavailable
        return DockerImageState(reference=reference, present=True)

    @staticmethod
    def _aggregate_image_status(
        images: tuple[DockerImageState, ...],
    ) -> ImageStatus:
        if all(image.present for image in images):
            return "available"
        if any(image.present for image in images):
            return "partial"
        return "missing"

    async def _inspect_components(
        self,
        client: httpx.AsyncClient,
        policy: DockerServicePolicy,
        compose_project: str,
    ) -> tuple[DockerComponentState, ...]:
        states = await self._gather_settled(
            self._inspect_component(client, component, compose_project) for component in policy.components
        )
        return tuple(states)

    async def _inspect_component(
        self,
        client: httpx.AsyncClient,
        component: DockerComponentPolicy,
        compose_project: str,
    ) -> DockerComponentState:
        path = f"/containers/{quote(component.container_name, safe='')}/json"
        try:
            response = await client.get(path)
        except (httpx.HTTPError, OSError) as exc:
            raise _DockerUnavailable from exc
        if response.status_code == 404:
            return DockerComponentState(installed=False, detail="not_installed")
        if response.status_code >= 400:
            raise _DockerUnavailable

        try:
            payload: Any = response.json()
            actual_name = payload["Name"]
            config = payload["Config"]
            labels = config.get("Labels") or {}
            state = payload["State"]
            running = state["Running"]
            status = state["Status"]
        except (KeyError, TypeError, ValueError) as exc:
            raise _DockerUnavailable from exc

        identity_matches = (
            isinstance(actual_name, str)
            and actual_name == f"/{component.container_name}"
            and isinstance(labels, dict)
            and labels.get("com.docker.compose.service") == component.compose_service
            and labels.get("com.docker.compose.project") == compose_project
        )
        if not identity_matches:
            logger.warning(
                "Docker container failed Service Center identity validation: expected_container=%s",
                component.container_name,
            )
            return DockerComponentState(installed=False, detail="foreign_container")
        if not isinstance(running, bool) or not isinstance(status, str):
            raise _DockerUnavailable
        health = state.get("Health")
        if health is None:
            health_status = None
        elif isinstance(health, dict) and isinstance(health.get("Status"), str):
            health_status = health["Status"]
        else:
            raise _DockerUnavailable
        return DockerComponentState(
            installed=True,
            running=running,
            status=status,
            health_status=health_status,
        )

    async def _mutate(
        self,
        client: httpx.AsyncClient,
        policy: DockerServicePolicy,
        states: tuple[DockerComponentState, ...],
        action: ControlAction,
        compose_project: str,
    ) -> bool:
        changed = False
        stages = self._component_stages(policy, states)
        if action in {"stop", "restart"}:
            for stage in reversed(stages):
                pending = [
                    self._post_action(client, component, "stop")
                    for component, state in reversed(stage)
                    if state.running
                ]
                if pending:
                    results = await self._gather_settled(pending)
                    changed = changed or any(results)

        if action in {"start", "restart"}:
            for stage_index, stage in enumerate(stages):
                pending = [
                    self._post_action(client, component, "start")
                    for component, state in stage
                    if action == "restart" or not state.running
                ]
                if pending:
                    results = await self._gather_settled(pending)
                    changed = changed or any(results)
                if stage_index < len(stages) - 1:
                    await self._gather_settled(
                        self._wait_until_ready(
                            client,
                            component,
                            compose_project,
                        )
                        for component, _state in stage
                    )
        return changed

    @staticmethod
    async def _gather_settled(
        awaitables: Iterable[Awaitable[Any]],
    ) -> list[Any]:
        """Wait for every sibling before propagating the first ordered failure."""
        results = await asyncio.gather(*tuple(awaitables), return_exceptions=True)
        for result in results:
            if isinstance(result, BaseException):
                raise result
        return results

    @staticmethod
    def _component_stages(
        policy: DockerServicePolicy,
        states: tuple[DockerComponentState, ...],
    ) -> tuple[tuple[tuple[DockerComponentPolicy, DockerComponentState], ...], ...]:
        paired = tuple(zip(policy.components, states, strict=True))
        stage_ids = tuple(dict.fromkeys(component.start_stage for component in policy.components))
        return tuple(tuple(pair for pair in paired if pair[0].start_stage == stage_id) for stage_id in stage_ids)

    async def _wait_until_ready(
        self,
        client: httpx.AsyncClient,
        component: DockerComponentPolicy,
        compose_project: str,
    ) -> None:
        deadline = self._clock() + component.ready_timeout
        while True:
            state = await self._inspect_component(client, component, compose_project)
            if not state.installed:
                logger.warning(
                    "Docker dependency readiness failed: container=%s runtime_status=missing health_status=unknown",
                    component.container_name,
                )
                raise ServiceActionFailed
            if state.running and state.health_status in {None, "healthy"}:
                return
            if self._clock() >= deadline:
                logger.warning(
                    "Docker dependency readiness failed: container=%s runtime_status=%s health_status=%s",
                    component.container_name,
                    state.status,
                    state.health_status,
                )
                raise ServiceActionFailed
            await self._readiness_waiter(0.5)

    @staticmethod
    async def _post_action(
        client: httpx.AsyncClient,
        component: DockerComponentPolicy,
        action: str,
    ) -> bool:
        path = f"/containers/{quote(component.container_name, safe='')}/{action}"
        params = {"t": str(component.stop_timeout)} if action == "stop" else None
        try:
            if action == "stop":
                response = await client.post(
                    path,
                    params=params,
                    timeout=component.stop_timeout + _STOP_REQUEST_TIMEOUT_MARGIN,
                )
            else:
                response = await client.post(path)
        except (httpx.HTTPError, OSError) as exc:
            logger.warning(
                "Docker component lifecycle mutation failed: container=%s action=%s result=transport_error error_type=%s",
                component.container_name,
                action,
                type(exc).__name__,
            )
            raise _DockerUnavailable from exc
        if response.status_code not in {204, 304}:
            logger.warning(
                "Docker component lifecycle mutation failed: container=%s action=%s result=rejected http_status=%s",
                component.container_name,
                action,
                response.status_code,
            )
            raise ServiceActionFailed
        logger.info(
            "Docker component lifecycle mutation: container=%s action=%s result=accepted changed=%s",
            component.container_name,
            action,
            response.status_code == 204,
        )
        return response.status_code == 204
