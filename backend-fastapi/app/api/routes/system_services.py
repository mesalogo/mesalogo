"""Administrator-only Service Center API."""

import re
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

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
    ControlAction,
    ServiceActionResponse,
    ServiceInventoryResponse,
)
from app.services.service_center.service import ServiceCenter, get_service_center
from core.dependencies import get_admin_user

router = APIRouter()
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def _request_id(request: Request) -> str:
    candidate = request.headers.get("X-Request-ID", "")
    return candidate if _SAFE_REQUEST_ID.fullmatch(candidate) else uuid4().hex


@router.get("/system/services", response_model=ServiceInventoryResponse)
async def list_system_services(
    _admin=Depends(get_admin_user),
    center: ServiceCenter = Depends(get_service_center),
) -> ServiceInventoryResponse:
    snapshot = await center.get_snapshot()
    return ServiceInventoryResponse(data=snapshot)


@router.post(
    "/system/services/{service_id}/actions/{action}",
    response_model=ServiceActionResponse,
)
async def control_system_service(
    service_id: str,
    action: ControlAction,
    request: Request,
    admin=Depends(get_admin_user),
    center: ServiceCenter = Depends(get_service_center),
) -> ServiceActionResponse:
    try:
        result = await center.control_service(
            service_id,
            action,
            actor_id=str(getattr(admin, "id", "unknown")),
            request_id=_request_id(request),
        )
    except ServiceNotFound:
        raise HTTPException(status_code=404, detail={"code": "service_not_found"}) from None
    except ServiceNotControllable:
        raise HTTPException(
            status_code=403,
            detail={"code": "service_not_controllable"},
        ) from None
    except (
        ServiceNotInstalled,
        ServiceDeploymentConflict,
        ServiceActionInProgress,
    ) as exc:
        raise HTTPException(status_code=409, detail={"code": exc.code}) from None
    except ServiceControlUnavailable:
        raise HTTPException(
            status_code=503,
            detail={"code": "service_control_unavailable"},
        ) from None
    except ServiceActionFailed:
        raise HTTPException(
            status_code=502,
            detail={"code": "service_action_failed"},
        ) from None
    return ServiceActionResponse(data=result)
