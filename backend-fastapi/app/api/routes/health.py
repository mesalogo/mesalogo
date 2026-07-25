"""
健康检查 API 路由

Flask 原版: @health_bp.route('/health', methods=['GET'])
"""

import asyncio

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.services.service_center.service import ServiceCenter, get_service_center
from core.config import settings
from core.dependencies import get_admin_user

router = APIRouter()
liveness_router = APIRouter()


@liveness_router.get("/health")
async def health_check():
    """API 服务健康检查"""
    return {"status": "healthy"}


@liveness_router.get("/health/live")
async def liveness_check():
    """Cheap process-only liveness check."""
    return {"status": "healthy"}


@router.get("/health/ready")
async def readiness_check(center: ServiceCenter = Depends(get_service_center)):
    """Report whether the required database dependency is healthy."""
    if settings.SETUP_MODE:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "dependencies": {"database": "unknown"},
            },
        )
    database = await center.get_status("database")
    payload = {
        "status": "ready" if database.health_status == "healthy" else "not_ready",
        "dependencies": {"database": database.health_status},
    }
    if database.health_status != "healthy":
        return JSONResponse(status_code=503, content=payload)
    return payload


@router.get("/health/dependencies")
async def dependency_health(
    _admin=Depends(get_admin_user),
    center: ServiceCenter = Depends(get_service_center),
):
    """Return detailed infrastructure dependency status to administrators."""
    database, redis = await asyncio.gather(
        center.get_status("database"),
        center.get_status("redis"),
    )
    return {
        "success": True,
        "data": {
            "checked_at": max(database.checked_at, redis.checked_at),
            "services": [
                database.model_dump(mode="json"),
                redis.model_dump(mode="json"),
            ],
        },
    }
