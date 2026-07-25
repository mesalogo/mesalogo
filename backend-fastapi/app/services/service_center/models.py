"""Typed API models for the Service Center (服务中心)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RuntimeStatus = Literal["running", "stopped", "unknown"]
HealthStatus = Literal["healthy", "degraded", "unhealthy", "disabled", "unknown"]
ImageStatus = Literal["available", "partial", "missing", "unknown"]
ControlAction = Literal["start", "stop", "restart"]


class ServiceCapabilities(BaseModel):
    """Actions a deployment adapter may expose for a logical service."""

    model_config = ConfigDict(frozen=True)

    configure: bool = False
    view_logs: bool = False
    start: bool = False
    stop: bool = False
    restart: bool = False


class ServiceDefinition(BaseModel):
    """Source-controlled definition of one supported logical service."""

    model_config = ConfigDict(frozen=True)

    id: str
    category: str
    deployment: str
    required: bool = False
    dependencies: tuple[str, ...] = ()
    components: tuple[str, ...] = ()
    config_route: str | None = None
    capabilities: ServiceCapabilities = Field(default_factory=ServiceCapabilities)


class ResolvedService(BaseModel):
    """Runtime configuration used internally by a probe coordinator."""

    definition: ServiceDefinition
    deployment: str | None = None
    enabled: bool | None = None
    probe_target: str | None = Field(default=None, exclude=True)
    display_endpoint: str | None = None
    resolution_detail: str | None = Field(default=None, exclude=True)


class ServiceImageStatus(BaseModel):
    """Read-only presence state for one source-controlled image reference."""

    model_config = ConfigDict(frozen=True)

    reference: str
    present: bool


class ServiceStatus(BaseModel):
    """Public observed state for one logical service."""

    id: str
    category: str
    deployment: str
    required: bool
    enabled: bool | None = None
    installed: bool | None = None
    image_status: ImageStatus = "unknown"
    images: list[ServiceImageStatus] = Field(default_factory=list)
    control_status_detail: str | None = None
    runtime_status: RuntimeStatus = "unknown"
    health_status: HealthStatus = "unknown"
    endpoint: str | None = None
    latency_ms: float | None = None
    status_detail: str | None = None
    dependencies: list[str] = Field(default_factory=list)
    components: list[str] = Field(default_factory=list)
    config_route: str | None = None
    capabilities: ServiceCapabilities = Field(default_factory=ServiceCapabilities)
    checked_at: str

    @classmethod
    def from_resolved(
        cls,
        resolved: ResolvedService,
        *,
        runtime_status: RuntimeStatus,
        health_status: HealthStatus,
        checked_at: str | None = None,
        latency_ms: float | None = None,
        status_detail: str | None = None,
    ) -> ServiceStatus:
        from .service import utc_now

        definition = resolved.definition
        return cls(
            id=definition.id,
            category=definition.category,
            deployment=resolved.deployment or definition.deployment,
            required=definition.required,
            enabled=resolved.enabled,
            runtime_status=runtime_status,
            health_status=health_status,
            endpoint=resolved.display_endpoint,
            latency_ms=latency_ms,
            status_detail=status_detail,
            dependencies=list(definition.dependencies),
            components=list(definition.components),
            config_route=definition.config_route,
            capabilities=definition.capabilities,
            checked_at=checked_at or utc_now(),
        )


class ServiceSummary(BaseModel):
    total: int = 0
    healthy: int = 0
    degraded: int = 0
    unhealthy: int = 0
    disabled: int = 0
    unknown: int = 0


class ServiceSnapshot(BaseModel):
    checked_at: str
    deployment_mode: Literal["docker", "native"]
    control_available: bool = False
    control_status_detail: str | None = "disabled"
    summary: ServiceSummary
    services: list[ServiceStatus]


class ServiceInventoryResponse(BaseModel):
    success: Literal[True] = True
    data: ServiceSnapshot


class ServiceActionResult(BaseModel):
    service_id: str
    action: ControlAction
    changed: bool
    installed: bool
    runtime_status: RuntimeStatus
    checked_at: str


class ServiceActionResponse(BaseModel):
    success: Literal[True] = True
    data: ServiceActionResult
