"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: statistics.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: statistics.py
# ============================================================

"""
系统统计API路由

提供系统概览和各种统计数据的API接口
"""
from app.services.statistics_service import StatisticsService
import logging

logger = logging.getLogger(__name__)

# 创建Blueprint

@router.get('/statistics/overview')
def get_system_overview(current_user=Depends(get_current_user)):
    """
    获取系统概览统计数据

    Returns:
        JSON: 包含系统各项统计数据的响应
    """
    try:
        statistics = StatisticsService.get_system_overview(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取系统概览统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取系统统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/tasks')
def get_task_statistics(current_user=Depends(get_current_user)):
    """
    获取任务相关的详细统计数据

    Returns:
        JSON: 包含任务统计数据的响应
    """
    try:
        statistics = StatisticsService.get_task_statistics(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取任务统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取任务统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/roles')
def get_role_statistics(current_user=Depends(get_current_user)):
    """
    获取角色相关的详细统计数据

    Returns:
        JSON: 包含角色统计数据的响应
    """
    try:
        statistics = StatisticsService.get_role_statistics(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取角色统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取角色统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/action-spaces')
def get_action_space_statistics(current_user=Depends(get_current_user)):
    """
    获取行动空间相关的详细统计数据

    Returns:
        JSON: 包含行动空间统计数据的响应
    """
    try:
        statistics = StatisticsService.get_action_space_statistics(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取行动空间统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取行动空间统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/activity-trends')
def get_activity_trends(current_user=Depends(get_current_user)):
    """
    获取活动趋势统计数据

    Returns:
        JSON: 包含活动趋势统计数据的响应
    """
    try:
        statistics = StatisticsService.get_activity_trends(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取活动趋势统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取活动趋势统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/interactions')
def get_interaction_statistics(current_user=Depends(get_current_user)):
    """
    获取交互活动统计数据

    Returns:
        JSON: 包含交互统计数据的响应
    """
    try:
        statistics = StatisticsService.get_interaction_statistics(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取交互统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取交互统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/ecosystem')
def get_ecosystem_statistics(current_user=Depends(get_current_user)):
    """
    获取智能体生态统计数据

    Returns:
        JSON: 包含生态统计数据的响应
    """
    try:
        statistics = StatisticsService.get_ecosystem_statistics(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取生态统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取生态统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/resources')
def get_system_resources(current_user=Depends(get_current_user)):
    """
    获取系统资源统计数据

    Returns:
        JSON: 包含系统资源统计数据的响应
    """
    try:
        statistics = StatisticsService.get_system_resources(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取系统资源统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取系统资源统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/users')
def get_user_statistics(current_user=Depends(get_current_user)):
    """
    获取用户活动统计数据

    Returns:
        JSON: 包含用户统计数据的响应
    """
    try:
        statistics = StatisticsService.get_user_statistics(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取用户统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取用户统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/autonomous-tasks')
def get_autonomous_task_statistics(current_user=Depends(get_current_user)):
    """
    获取自主行动任务统计数据

    Returns:
        JSON: 包含自主行动任务统计数据的响应
    """
    try:
        statistics = StatisticsService.get_autonomous_task_statistics(current_user)
        return {
            'success': True,
            'data': statistics
        }
    except Exception as e:
        logger.error(f"获取自主行动任务统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取自主行动任务统计数据失败',
            'message': str(e)
        })

@router.get('/statistics/dashboard')
def get_dashboard_data(current_user=Depends(get_current_user)):
    """
    获取仪表盘所需的所有统计数据

    Returns:
        JSON: 包含仪表盘所有统计数据的响应
    """
    try:
        # 获取系统概览数据
        overview = StatisticsService.get_system_overview(current_user)

        # 获取任务统计数据
        task_stats = StatisticsService.get_task_statistics(current_user)

        # 获取角色统计数据
        role_stats = StatisticsService.get_role_statistics(current_user)

        # 获取行动空间统计数据
        space_stats = StatisticsService.get_action_space_statistics(current_user)

        # 获取新增的统计数据
        activity_trends = StatisticsService.get_activity_trends(current_user)
        interactions = StatisticsService.get_interaction_statistics(current_user)
        ecosystem = StatisticsService.get_ecosystem_statistics(current_user)
        resources = StatisticsService.get_system_resources(current_user)
        users = StatisticsService.get_user_statistics(current_user)
        autonomous_tasks = StatisticsService.get_autonomous_task_statistics(current_user)

        # 合并所有数据
        dashboard_data = {
            'overview': overview,
            'tasks': task_stats,
            'roles': role_stats,
            'action_spaces': space_stats,
            'activity_trends': activity_trends,
            'interactions': interactions,
            'ecosystem': ecosystem,
            'resources': resources,
            'users': users,
            'autonomous_tasks': autonomous_tasks
        }

        return {
            'success': True,
            'data': dashboard_data
        }
    except Exception as e:
        logger.error(f"获取仪表盘数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'error': '获取仪表盘数据失败',
            'message': str(e)
        })

