"""Health aggregation and allowlisted lifecycle control for logical services."""

from __future__ import annotations

import asyncio
import logging
import os
import re
from collections.abc import Awaitable, Callable, Iterable
from datetime import UTC, datetime
from time import perf_counter
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx
from sqlalchemy import text

from core.config import settings

from .catalog import SERVICE_CATALOG
from .docker_control import (
    CONTROL_POLICIES,
    INVENTORY_POLICIES,
    DockerControlInventory,
    DockerServiceController,
    ServiceControlError,
    ServiceControlUnavailable,
    ServiceDeploymentConflict,
    ServiceNotControllable,
    ServiceNotFound,
)
from .models import (
    ControlAction,
    ResolvedService,
    ServiceActionResult,
    ServiceCapabilities,
    ServiceDefinition,
    ServiceImageStatus,
    ServiceSnapshot,
    ServiceStatus,
    ServiceSummary,
)

logger = logging.getLogger(__name__)

Resolver = Callable[[ServiceDefinition], ResolvedService]
Probe = Callable[[ResolvedService, httpx.AsyncClient], Awaitable[ServiceStatus]]
_TRUE_VALUES = {"1", "true", "yes", "on"}
_FALSE_VALUES = {"0", "false", "no", "off"}
_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*$")
_DISPLAY_SCHEMES = {
    "http",
    "https",
    "mariadb",
    "mariadb+pymysql",
    "mysql",
    "mysql+pymysql",
    "postgres",
    "postgresql",
    "redis",
    "rediss",
    "tcp",
}
_DEFAULT_DOCKER_PROBE_TARGETS = {
    "frontend": "http://frontend/",
    "milvus": "tcp://milvus-standalone:19530",
    "graphiti": "http://graphiti:8000",
    "lightrag": "http://lightrag:9621",
    "onlyoffice": "http://onlyoffice-documentserver/",
    "galapagos": "http://galapagos:9000/",
    "paddleocr-vl": "http://paddle-ocr-vl:8080/v1/models",
    "code-server": "http://code-server:8443/healthz",
}
_LOCAL_ENDPOINT_HOSTS = {"localhost", "127.0.0.1", "::1"}
_COMPOSE_ENDPOINT_HOSTS = {
    "abm-mariadb",
    "abm-redis",
    "code-server",
    "frontend",
    "galapagos",
    "graphiti",
    "lightrag",
    "mariadb",
    "milvus-standalone",
    "onlyoffice-documentserver",
    "paddle-ocr-vl",
    "redis",
}


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def sanitize_endpoint(value: str | None) -> str | None:
    """Return a credential-free display URL, or ``None`` if malformed."""
    if not value or not isinstance(value, str):
        return None
    value = value.strip()
    if not value:
        return None
    if value.startswith("sqlite:"):
        return "sqlite://"
    try:
        parsed = urlsplit(value)
        if (
            not parsed.scheme
            or not _SCHEME_RE.match(parsed.scheme)
            or parsed.scheme.lower() not in _DISPLAY_SCHEMES
            or not parsed.hostname
        ):
            return None
        host = parsed.hostname
        if ":" in host and not host.startswith("["):
            host = f"[{host}]"
        port = f":{parsed.port}" if parsed.port is not None else ""
        return urlunsplit((parsed.scheme, f"{host}{port}", "", "", ""))
    except (TypeError, ValueError):
        return None


def _valid_http_target(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return None
        _ = parsed.port
    except (TypeError, ValueError):
        return None
    return value


def _valid_redis_target(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"redis", "rediss"} or not parsed.hostname:
            return None
        _ = parsed.port
    except (TypeError, ValueError):
        return None
    return value


def _valid_tcp_target(value: str | None) -> str | None:
    if not value:
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme != "tcp" or not parsed.hostname or parsed.port is None:
            return None
    except (TypeError, ValueError):
        return None
    return value


def _may_use_catalog_probe(display_endpoint: str | None) -> bool:
    if not display_endpoint:
        return True
    if display_endpoint.startswith("/") and not display_endpoint.startswith("//"):
        return True
    try:
        hostname = urlsplit(display_endpoint).hostname
    except (TypeError, ValueError):
        return False
    return hostname in _LOCAL_ENDPOINT_HOSTS | _COMPOSE_ENDPOINT_HOSTS


def _parse_optional_bool(value: str | None) -> bool | None:
    if value is None or not value.strip():
        return None
    lowered = value.strip().lower()
    if lowered in _TRUE_VALUES:
        return True
    if lowered in _FALSE_VALUES:
        return False
    return None


def _env_prefix(service_id: str) -> str:
    return "SERVICE_CENTER_" + re.sub(r"[^A-Za-z0-9]", "_", service_id).upper()


def _join_health_path(endpoint: str, path: str) -> str:
    parsed = urlsplit(endpoint)
    if parsed.path and parsed.path != "/":
        return endpoint
    return urlunsplit((parsed.scheme, parsed.netloc, path, parsed.query, ""))


class ServiceCenter:
    """Resolve, probe, and conditionally control a fixed logical-service catalog."""

    def __init__(
        self,
        *,
        definitions: Iterable[ServiceDefinition] = SERVICE_CATALOG,
        resolver: Resolver | None = None,
        probe_overrides: dict[str, Probe] | None = None,
        probe_timeout: float = 3.0,
        docker_controller: DockerServiceController | None = None,
    ) -> None:
        self.definitions = tuple(definitions)
        self._uses_default_resolver = resolver is None
        self.resolver = resolver or self._resolve_service
        self.probe_overrides = probe_overrides or {}
        self.probe_timeout = probe_timeout
        self.docker_controller = docker_controller or DockerServiceController(timeout=max(probe_timeout, 1.0))
        self._resolution_task: asyncio.Task[list[ResolvedService]] | None = None
        self._resolution_lock: asyncio.Lock | None = None
        self._database_ping_task: asyncio.Task[None] | None = None
        self._database_ping_lock: asyncio.Lock | None = None

    @property
    def deployment_mode(self) -> str:
        explicit = os.environ.get("ABM_DEPLOYMENT_MODE", "").strip().lower()
        if explicit in {"docker", "native"}:
            return explicit
        return "docker" if os.path.exists("/.dockerenv") else "native"

    async def get_snapshot(self) -> ServiceSnapshot:
        checked_at = utc_now()
        if self._uses_default_resolver:
            try:
                resolved = await asyncio.wait_for(
                    self._resolve_definitions_singleflight(),
                    timeout=self.probe_timeout,
                )
            except TimeoutError:
                resolved = [
                    ResolvedService(
                        definition=definition,
                        resolution_detail="config_unavailable",
                    )
                    for definition in self.definitions
                ]
        else:
            resolved = [self._resolve_safely(definition) for definition in self.definitions]
        timeout = httpx.Timeout(self.probe_timeout)
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            statuses, control_inventory = await asyncio.gather(
                asyncio.gather(*(self._probe_safely(item, client, checked_at) for item in resolved)),
                self.docker_controller.inspect_inventory(),
            )
        statuses = self._merge_control_inventory(statuses, resolved, control_inventory)
        statuses.sort(key=lambda item: [definition.id for definition in self.definitions].index(item.id))
        return ServiceSnapshot(
            checked_at=checked_at,
            deployment_mode=self.deployment_mode,
            control_available=control_inventory.available,
            control_status_detail=control_inventory.status_detail,
            summary=self._summarize(statuses),
            services=statuses,
        )

    async def control_service(
        self,
        service_id: str,
        action: ControlAction,
        *,
        actor_id: str,
        request_id: str,
    ) -> ServiceActionResult:
        """Run one allowlisted mutation and emit a structured audit event."""
        result_code = "success"
        changed: bool | None = None
        try:
            definition = next(
                (item for item in self.definitions if item.id == service_id),
                None,
            )
            if definition is None:
                raise ServiceNotFound
            if service_id not in CONTROL_POLICIES:
                raise ServiceNotControllable

            if self._uses_default_resolver:
                try:
                    resolved_services = await asyncio.wait_for(
                        self._resolve_definitions_singleflight(),
                        timeout=self.probe_timeout,
                    )
                except TimeoutError:
                    raise ServiceControlUnavailable from None
                resolved = next(item for item in resolved_services if item.definition.id == service_id)
            else:
                resolved = self._resolve_safely(definition)
            if resolved.resolution_detail == "config_unavailable":
                raise ServiceControlUnavailable
            if resolved.deployment != "docker-compose":
                raise ServiceDeploymentConflict

            result = await self.docker_controller.perform_action(service_id, action)
            changed = result.changed
            return result
        except ServiceControlError as exc:
            result_code = exc.code
            raise
        except Exception:
            result_code = "unexpected_error"
            raise
        finally:
            logger.info(
                "Service lifecycle audit: request_id=%s actor_id=%r service_id=%r action=%s result=%s changed=%s",
                request_id,
                actor_id,
                service_id,
                action,
                result_code,
                changed,
            )

    def _merge_control_inventory(
        self,
        statuses: list[ServiceStatus],
        resolved_services: list[ResolvedService],
        inventory: DockerControlInventory,
    ) -> list[ServiceStatus]:
        resolved_by_id = {resolved.definition.id: resolved for resolved in resolved_services}
        merged: list[ServiceStatus] = []
        for status in statuses:
            if status.id not in INVENTORY_POLICIES:
                merged.append(status)
                continue

            resolved = resolved_by_id[status.id]
            is_local_docker = resolved.deployment == "docker-compose" or (
                status.id == "backend" and resolved.deployment == "embedded" and self.deployment_mode == "docker"
            )
            if not is_local_docker:
                if status.id not in CONTROL_POLICIES:
                    merged.append(status)
                    continue
                if resolved.resolution_detail == "config_unavailable":
                    control_detail = "configuration_unavailable"
                elif resolved.deployment == "external":
                    control_detail = "external_service"
                else:
                    control_detail = "not_local_docker"
                merged.append(status.model_copy(update={"control_status_detail": control_detail}))
                continue
            if not inventory.available:
                merged.append(status)
                continue

            runtime = inventory.services.get(status.id)
            if runtime is None:
                merged.append(status)
                continue
            image_update = {
                "image_status": runtime.image_status,
                "images": [
                    ServiceImageStatus(
                        reference=image.reference,
                        present=image.present,
                    )
                    for image in runtime.images
                ],
            }
            if status.id not in CONTROL_POLICIES:
                merged.append(status.model_copy(update=image_update))
                continue
            current = status.capabilities
            capabilities = ServiceCapabilities(
                configure=current.configure,
                view_logs=current.view_logs,
                start=runtime.installed and runtime.runtime_status != "running",
                stop=runtime.installed and runtime.runtime_status != "stopped",
                restart=runtime.installed,
            )
            merged.append(
                status.model_copy(
                    update={
                        "installed": runtime.installed,
                        **image_update,
                        "runtime_status": runtime.runtime_status,
                        "control_status_detail": runtime.control_status_detail,
                        "capabilities": capabilities,
                    }
                )
            )
        return merged

    def _resolve_definitions(self) -> list[ResolvedService]:
        """Resolve the catalog sequentially in one worker to bound DB usage."""
        return [self._resolve_safely(definition) for definition in self.definitions]

    async def _resolve_definitions_singleflight(self) -> list[ResolvedService]:
        if self._resolution_lock is None:
            self._resolution_lock = asyncio.Lock()

        async with self._resolution_lock:
            task = self._resolution_task
            if task is None or task.done():
                task = asyncio.create_task(asyncio.to_thread(self._resolve_definitions))
                task.add_done_callback(self._finish_resolution)
                self._resolution_task = task

        return await asyncio.shield(task)

    def _finish_resolution(self, task: asyncio.Task[list[ResolvedService]]) -> None:
        if self._resolution_task is task:
            self._resolution_task = None
        try:
            task.result()
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.warning(
                "Background service configuration resolution failed: error_type=%s",
                type(exc).__name__,
            )

    async def get_status(self, service_id: str) -> ServiceStatus:
        definition = next(item for item in self.definitions if item.id == service_id)
        if self._uses_default_resolver:
            resolved = await asyncio.to_thread(self._resolve_safely, definition)
        else:
            resolved = self._resolve_safely(definition)
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(self.probe_timeout),
            follow_redirects=False,
            trust_env=False,
        ) as client:
            return await self._probe_safely(resolved, client, utc_now())

    def _resolve_safely(self, definition: ServiceDefinition) -> ResolvedService:
        try:
            return self.resolver(definition)
        except Exception as exc:
            logger.warning(
                "Service configuration resolution failed: service_id=%s error_type=%s",
                definition.id,
                type(exc).__name__,
            )
            return ResolvedService(definition=definition, resolution_detail="config_unavailable")
        finally:
            if self._uses_default_resolver:
                self._remove_scoped_session()

    @staticmethod
    def _remove_scoped_session() -> None:
        """Release any ORM session created by a resolver worker thread."""
        try:
            from core.database import ScopedSession

            ScopedSession.remove()
        except Exception as exc:
            logger.warning(
                "Service resolver session cleanup failed: error_type=%s",
                type(exc).__name__,
            )

    def _resolve_service(self, definition: ServiceDefinition) -> ResolvedService:
        service_id = definition.id
        prefix = _env_prefix(service_id)
        explicit_enabled = _parse_optional_bool(os.environ.get(f"{prefix}_ENABLED"))
        probe_target = os.environ.get(f"{prefix}_PROBE_URL")
        display_endpoint = os.environ.get(f"{prefix}_URL")
        enabled = explicit_enabled

        if service_id == "backend":
            enabled = True
        elif service_id == "database":
            enabled = True
            display_endpoint = display_endpoint or settings.DATABASE_URI
        elif service_id == "redis":
            if explicit_enabled is None:
                enabled = bool(settings.REDIS_URL)
            probe_target = probe_target or settings.REDIS_URL
            display_endpoint = display_endpoint or settings.REDIS_URL
        elif service_id == "frontend":
            enabled = True
            display_endpoint = display_endpoint or settings.FRONTEND_URL
        elif service_id in {"graphiti", "lightrag"}:
            configured_enabled, configured_endpoint = self._resolve_graph_framework(service_id)
            if explicit_enabled is None:
                enabled = configured_enabled
            display_endpoint = display_endpoint or configured_endpoint
        elif service_id == "milvus":
            configured_enabled, configured_endpoint = self._resolve_milvus()
            if explicit_enabled is None:
                enabled = configured_enabled
            display_endpoint = display_endpoint or configured_endpoint
        elif service_id == "paddleocr-vl":
            configured_enabled, configured_endpoint = self._resolve_paddleocr()
            if explicit_enabled is None:
                enabled = configured_enabled
            display_endpoint = display_endpoint or configured_endpoint
        else:
            display_endpoint = display_endpoint or self._resolve_market_endpoint(service_id)

        if not probe_target and self.deployment_mode == "docker" and _may_use_catalog_probe(display_endpoint):
            probe_target = _DEFAULT_DOCKER_PROBE_TARGETS.get(service_id)

        if service_id == "graphiti" and probe_target:
            probe_target = _join_health_path(probe_target, "/healthcheck")
        elif service_id == "lightrag" and probe_target:
            probe_target = _join_health_path(probe_target, "/health")

        if service_id == "redis":
            valid_target = _valid_redis_target(probe_target)
        elif service_id == "milvus":
            valid_target = _valid_tcp_target(probe_target)
        else:
            valid_target = _valid_http_target(probe_target)
        resolution_detail = "invalid_probe_target" if probe_target and not valid_target else None
        return ResolvedService(
            definition=definition,
            deployment=self._classify_deployment(
                service_id,
                display_endpoint,
                valid_target,
            ),
            enabled=enabled,
            probe_target=valid_target,
            display_endpoint=sanitize_endpoint(display_endpoint or probe_target),
            resolution_detail=resolution_detail,
        )

    def _classify_deployment(
        self,
        service_id: str,
        *endpoints: str | None,
    ) -> str:
        if service_id == "backend":
            return "embedded"
        if any(endpoint and endpoint.startswith("sqlite:") for endpoint in endpoints):
            return "embedded"

        hostnames: list[str] = []
        for endpoint in endpoints:
            if not endpoint:
                continue
            try:
                hostname = urlsplit(endpoint).hostname
            except (TypeError, ValueError):
                continue
            if hostname:
                hostnames.append(hostname)
        if any(hostname not in _LOCAL_ENDPOINT_HOSTS | _COMPOSE_ENDPOINT_HOSTS for hostname in hostnames):
            return "external"
        return "docker-compose" if self.deployment_mode == "docker" else "native"

    @staticmethod
    def _resolve_graph_framework(framework: str) -> tuple[bool | None, str | None]:
        from app.models import GraphEnhancement

        config = GraphEnhancement.query.filter_by(framework=framework, enabled=True).first()
        if config is None:
            config = GraphEnhancement.query.filter_by(framework=framework).first()
        if config is None:
            return False, None
        framework_config = config.framework_config or {}
        endpoint = framework_config.get("service_url") or framework_config.get("server_url")
        return bool(config.enabled), endpoint

    @staticmethod
    def _resolve_milvus() -> tuple[bool | None, str | None]:
        from app.models import SystemSetting

        explicit = SystemSetting.query.filter_by(key="use_builtin_vector_db").first()
        if explicit is None:
            return None, None
        enabled = bool(SystemSetting.get("use_builtin_vector_db", False))
        host = SystemSetting.get("builtin_vector_db_host", "localhost")
        port = SystemSetting.get("builtin_vector_db_port", 19530)
        return enabled, f"tcp://{host}:{port}" if enabled else None

    @staticmethod
    def _resolve_paddleocr() -> tuple[bool | None, str | None]:
        from app.utils.document_parser_config import (
            get_active_document_parser,
            get_paddleocr_vl_config,
        )

        if get_active_document_parser() != "paddleocr_vl":
            return False, None
        return True, get_paddleocr_vl_config().get("server_url")

    @staticmethod
    def _resolve_market_endpoint(service_id: str) -> str | None:
        app_id = {
            "onlyoffice": "online-office",
            "galapagos": "netlogo-modeling",
            "code-server": "vscode-server",
        }.get(service_id)
        if app_id is None:
            return None
        from app.models import MarketApp

        app = MarketApp.query.filter_by(app_id=app_id).first()
        if app is None or not app.config:
            return None
        if service_id == "onlyoffice":
            return (app.config.get("server") or {}).get("documentServerUrl")
        return (app.config.get("launch") or {}).get("url")

    async def _probe_safely(
        self,
        resolved: ResolvedService,
        client: httpx.AsyncClient,
        checked_at: str,
    ) -> ServiceStatus:
        if resolved.enabled is False:
            return ServiceStatus.from_resolved(
                resolved,
                runtime_status="unknown",
                health_status="disabled",
                checked_at=checked_at,
            )

        try:
            return await asyncio.wait_for(self._probe(resolved, client, checked_at), timeout=self.probe_timeout)
        except TimeoutError:
            return ServiceStatus.from_resolved(
                resolved,
                runtime_status="unknown",
                health_status="unhealthy" if resolved.enabled is True else "unknown",
                status_detail="timeout",
                checked_at=checked_at,
            )
        except Exception as exc:
            logger.warning(
                "Service probe failed: service_id=%s error_type=%s",
                resolved.definition.id,
                type(exc).__name__,
            )
            return ServiceStatus.from_resolved(
                resolved,
                runtime_status="unknown",
                health_status="unhealthy" if resolved.enabled is True else "unknown",
                status_detail="probe_error",
                checked_at=checked_at,
            )

    async def _probe(
        self,
        resolved: ResolvedService,
        client: httpx.AsyncClient,
        checked_at: str,
    ) -> ServiceStatus:
        service_id = resolved.definition.id
        override = self.probe_overrides.get(service_id)
        if override is not None:
            return await override(resolved, client)
        if service_id == "backend":
            return ServiceStatus.from_resolved(
                resolved,
                runtime_status="running",
                health_status="healthy",
                checked_at=checked_at,
                latency_ms=0.0,
            )
        if service_id == "database":
            return await self._probe_database(resolved, checked_at)
        if service_id == "redis":
            return await self._probe_redis(resolved, checked_at)
        if not resolved.probe_target:
            return ServiceStatus.from_resolved(
                resolved,
                runtime_status="unknown",
                health_status="unknown",
                status_detail=resolved.resolution_detail or "not_configured",
                checked_at=checked_at,
            )
        if urlsplit(resolved.probe_target).scheme == "tcp":
            return await self._probe_tcp(resolved, checked_at)
        return await self._probe_http(resolved, client, checked_at)

    async def _probe_database(self, resolved: ResolvedService, checked_at: str) -> ServiceStatus:
        started = perf_counter()
        await self._database_ping_singleflight()
        return ServiceStatus.from_resolved(
            resolved,
            runtime_status="running",
            health_status="healthy",
            latency_ms=round((perf_counter() - started) * 1000, 1),
            checked_at=checked_at,
        )

    async def _database_ping_singleflight(self) -> None:
        """Reuse one in-flight ping after caller timeout instead of piling up threads."""
        if self._database_ping_lock is None:
            self._database_ping_lock = asyncio.Lock()

        async with self._database_ping_lock:
            task = self._database_ping_task
            if task is None or task.done():
                task = asyncio.create_task(asyncio.to_thread(self._database_ping))
                task.add_done_callback(self._finish_database_ping)
                self._database_ping_task = task

        await asyncio.shield(task)

    def _finish_database_ping(self, task: asyncio.Task[None]) -> None:
        if self._database_ping_task is task:
            self._database_ping_task = None
        try:
            task.result()
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.warning(
                "Background database health probe failed: error_type=%s",
                type(exc).__name__,
            )

    @staticmethod
    def _database_ping() -> None:
        from core.database import engine

        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

    async def _probe_redis(self, resolved: ResolvedService, checked_at: str) -> ServiceStatus:
        if not resolved.probe_target:
            return ServiceStatus.from_resolved(
                resolved,
                runtime_status="unknown",
                health_status="disabled" if resolved.enabled is False else "unknown",
                status_detail="not_configured",
                checked_at=checked_at,
            )
        started = perf_counter()
        await asyncio.to_thread(self._redis_ping, resolved.probe_target, self.probe_timeout)
        return ServiceStatus.from_resolved(
            resolved,
            runtime_status="running",
            health_status="healthy",
            latency_ms=round((perf_counter() - started) * 1000, 1),
            checked_at=checked_at,
        )

    @staticmethod
    def _redis_ping(url: str, timeout: float) -> None:
        import redis

        client = redis.from_url(
            url,
            socket_connect_timeout=timeout,
            socket_timeout=timeout,
        )
        try:
            client.ping()
        finally:
            client.close()

    @staticmethod
    async def _probe_http(
        resolved: ResolvedService,
        client: httpx.AsyncClient,
        checked_at: str,
    ) -> ServiceStatus:
        started = perf_counter()
        async with client.stream("GET", resolved.probe_target) as response:
            status_code = response.status_code
        latency_ms = round((perf_counter() - started) * 1000, 1)
        if status_code < 400:
            health_status = "healthy"
            detail = None
        elif status_code < 500:
            health_status = "unhealthy"
            detail = "http_client_error"
        else:
            health_status = "unhealthy"
            detail = "http_server_error"
        return ServiceStatus.from_resolved(
            resolved,
            runtime_status="running",
            health_status=health_status,
            latency_ms=latency_ms,
            status_detail=detail,
            checked_at=checked_at,
        )

    @staticmethod
    async def _probe_tcp(resolved: ResolvedService, checked_at: str) -> ServiceStatus:
        target = urlsplit(resolved.probe_target)
        started = perf_counter()
        _reader, writer = await asyncio.open_connection(target.hostname, target.port)
        writer.close()
        await writer.wait_closed()
        return ServiceStatus.from_resolved(
            resolved,
            runtime_status="running",
            health_status="healthy",
            latency_ms=round((perf_counter() - started) * 1000, 1),
            checked_at=checked_at,
        )

    @staticmethod
    def _summarize(statuses: Iterable[ServiceStatus]) -> ServiceSummary:
        items = list(statuses)
        counts: dict[str, Any] = {
            "total": len(items),
            "healthy": 0,
            "degraded": 0,
            "unhealthy": 0,
            "disabled": 0,
            "unknown": 0,
        }
        for item in items:
            counts[item.health_status] += 1
        return ServiceSummary(**counts)


_service_center = ServiceCenter()


def get_service_center() -> ServiceCenter:
    """FastAPI dependency for the process-wide Service Center coordinator."""
    return _service_center
