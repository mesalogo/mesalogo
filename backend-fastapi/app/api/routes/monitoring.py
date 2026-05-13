"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: monitoring.py
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
# Source: monitoring.py
# ============================================================

"""
行动监控 API 路由
"""
from app.services.monitoring_service import MonitoringService
import logging

logger = logging.getLogger(__name__)


def _get_filter_params(request: Request, current_user=None):
    """提取公共过滤参数"""
    return {
        'action_space_id': request.query_params.get('action_space_id'),
        'rule_type': request.query_params.get('rule_type'),
        'status': request.query_params.get('status'),
        'start_time': request.query_params.get('start_time'),
        'end_time': request.query_params.get('end_time'),
        'current_user': current_user
    }


@router.get('/monitoring/dashboard')
def get_monitoring_dashboard(current_user=Depends(get_current_user)):
    try:
        data = MonitoringService.get_dashboard_data(current_user)
        return {'success': True, 'data': data}
    except Exception as e:
        logger.error(f"获取监控仪表盘数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'success': False, 'error': str(e)})


@router.get('/monitoring/rule-logs')
def get_rule_logs(request: Request, current_user=Depends(get_current_user)):
    try:
        params = _get_filter_params(request, current_user)
        params['page'] = int(request.query_params.get('page', '1'))
        params['per_page'] = int(request.query_params.get('per_page', '20'))
        data = MonitoringService.get_rule_logs(**params)
        return {'success': True, 'data': data}
    except Exception as e:
        logger.error(f"查询规则执行日志失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'success': False, 'error': str(e)})


@router.get('/monitoring/rule-logs/export')
def export_rule_logs(request: Request, current_user=Depends(get_current_user)):
    from starlette.responses import Response as RawResponse
    try:
        params = _get_filter_params(request, current_user)
        csv_content = MonitoringService.export_rule_logs_csv(**params)
        return RawResponse(
            content=csv_content,
            media_type='text/csv; charset=utf-8-sig',
            headers={
                'Content-Disposition': 'attachment; filename=rule_logs_export.csv',
            }
        )
    except Exception as e:
        logger.error(f"导出规则执行日志失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'success': False, 'error': str(e)})


@router.get('/monitoring/action-spaces')
def get_monitoring_action_spaces(current_user=Depends(get_current_user)):
    try:
        spaces = MonitoringService.get_action_spaces_list(current_user)
        return {'success': True, 'data': spaces}
    except Exception as e:
        logger.error(f"获取行动空间列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'success': False, 'error': str(e)})

