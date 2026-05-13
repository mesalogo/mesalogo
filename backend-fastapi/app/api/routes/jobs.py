"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: jobs.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

"""
后台任务管理 API
"""

from app.services.job_queue import job_manager


@router.post('/jobs')
async def submit_job(request: Request, current_user=Depends(get_current_user)):
    """
    提交后台任务
    
    POST /api/jobs
    """
    try:
        data = await request.json()
        
        job_type = data.get('job_type')
        params = data.get('params', {})
        priority = data.get('priority', 'medium')
        
        if not job_type:
            raise HTTPException(status_code=400, detail={"error": "缺少 job_type"})
        
        job_id = job_manager.submit_job(
            job_type=job_type,
            params=params,
            user_id=current_user.id,
            priority=priority
        )
        
        return JSONResponse(content={
            "job_id": job_id,
            "status": "pending",
            "message": "后台任务已提交"
        }, status_code=201)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ── 固定路径 MUST 在参数路径之前注册 ──

@router.get('/jobs/stats')
def get_stats(current_user=Depends(get_current_user)):
    """
    获取后台任务统计
    
    GET /api/jobs/stats
    """
    try:
        stats = job_manager.get_stats(user_id=current_user.id)
        return stats
        
    except Exception as e:
        logger.error(f"获取任务统计失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get('/jobs')
def list_jobs(request: Request, current_user=Depends(get_current_user)):
    """
    查询后台任务列表
    
    GET /api/jobs?job_type=kb:vectorize_file&status=running&offset=0&limit=20
    """
    try:
        result = job_manager.list_jobs(
            user_id=current_user.id,
            job_type=request.query_params.get('job_type'),
            status=request.query_params.get('status'),
            offset=int(request.query_params.get('offset', 0)),
            limit=int(request.query_params.get('limit', 20))
        )
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ── 参数路径在固定路径之后 ──

@router.get('/jobs/{job_id}')
def get_job_status(job_id: str, current_user=Depends(get_current_user)):
    """
    查询后台任务状态
    
    GET /api/jobs/{job_id}
    """
    try:
        status = job_manager.get_job_status(job_id)
        
        if not status:
            raise HTTPException(status_code=404, detail={"error": "后台任务不存在"})
        
        if status["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail={"error": "无权访问"})
        
        return status
        
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post('/jobs/{job_id}/cancel')
def cancel_job(job_id: str, current_user=Depends(get_current_user)):
    """
    取消后台任务
    
    POST /api/jobs/{job_id}/cancel
    """
    try:
        status = job_manager.get_job_status(job_id)
        
        if not status:
            raise HTTPException(status_code=404, detail={"error": "后台任务不存在"})
        
        if status["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail={"error": "无权操作"})
        
        success = job_manager.cancel_job(job_id)
        
        return {"success": success}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})
