"""
健康检查 API 路由

Flask 原版: @health_bp.route('/health', methods=['GET'])
"""
from fastapi import APIRouter

router = APIRouter()


@router.get('/health')
def health_check():
    """API 服务健康检查"""
    return {'status': 'healthy'}
