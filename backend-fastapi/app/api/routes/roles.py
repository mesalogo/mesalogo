"""
角色 API 路由

Flask → FastAPI:
- @login_required 装饰器 → Depends(get_current_user)
- get_current_user_from_token() → 直接用 Depends 注入的 current_user
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from app.models import db
from app.services.role_service import RoleService
from app.services.user_permission_service import UserPermissionService
from core.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

role_service = RoleService()


@router.get('/roles')
def get_roles(
    current_user=Depends(get_current_user),
    action_space_id: Optional[str] = Query(None),
):
    """获取所有角色列表"""
    if action_space_id:
        roles = role_service.get_roles_by_action_space(action_space_id)
    else:
        roles = role_service.get_all_roles(current_user)

    formatted_roles = [role_service.format_role_for_api(role) for role in roles]
    return {'roles': formatted_roles}


@router.get('/roles/with-details')
def get_roles_with_details(current_user=Depends(get_current_user)):
    """获取所有角色及其关联的能力和知识库信息"""
    try:
        roles_with_details = role_service.get_all_roles_with_details(current_user)
        return roles_with_details
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取角色详细信息失败: {str(e)}')


@router.get('/roles/knowledge-bindings')
def get_all_roles_knowledge_bindings():
    """获取所有角色的知识库绑定关系"""
    try:
        bindings = role_service.get_all_roles_knowledge_bindings()
        return {'success': True, 'data': bindings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'获取角色知识库绑定关系失败: {str(e)}')


@router.get('/roles/model-configs')
def get_role_model_configs():
    """获取角色可用的模型配置"""
    configs = role_service.get_role_model_configs()
    return {'model_configs': configs}


@router.get('/roles/predefined')
def get_predefined_roles():
    """获取预定义角色列表"""
    roles = role_service.get_predefined_roles()
    return {'roles': roles}


@router.get('/roles/recent')
def get_recent_roles(limit: int = Query(5)):
    """获取最近使用的角色列表"""
    roles = role_service.get_recent_roles(limit)
    return {'roles': roles}


@router.get('/roles/most-used')
def get_most_used_roles(limit: int = Query(5)):
    """获取最常用的角色列表"""
    roles = role_service.get_most_used_roles(limit)
    return {'roles': roles}


@router.get('/roles/{role_id}')
def get_role(role_id: str, current_user=Depends(get_current_user)):
    """获取特定角色详情"""
    role = role_service.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=404, detail='Role not found')

    if not UserPermissionService.can_view_resource(current_user, role):
        raise HTTPException(status_code=403, detail='无权限查看此角色')

    formatted_role = role_service.format_role_for_api(role)
    return formatted_role


@router.post('/roles', status_code=201)
async def create_role(request: Request, current_user=Depends(get_current_user)):
    """创建新角色"""
    data = await request.json()
    try:
        role = role_service.create_role(data, current_user)
        formatted_role = role_service.format_role_for_api(role)
        return formatted_role
    except ValueError as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=403,
            detail={
                'error': '已达到计划限额',
                'message': error_msg,
                'quota': {'allowed': False}
            }
        )


@router.put('/roles/{role_id}')
async def update_role(role_id: str, request: Request, current_user=Depends(get_current_user)):
    """更新角色信息"""
    data = await request.json()
    role = role_service.update_role(role_id, data, current_user)
    if role:
        try:
            from core.model_cache import invalidate_role
            invalidate_role(role_id)
        except Exception:
            pass
        formatted_role = role_service.format_role_for_api(role)
        return formatted_role
    raise HTTPException(status_code=404, detail='角色不存在或无权限编辑')


@router.delete('/roles/{role_id}')
def delete_role(role_id: str, current_user=Depends(get_current_user)):
    """删除角色"""
    success = role_service.delete_role(role_id, current_user)
    if success:
        try:
            from core.model_cache import invalidate_role
            invalidate_role(role_id)
        except Exception:
            pass
        return {'success': True}
    raise HTTPException(status_code=404, detail='角色不存在或无权限删除')


@router.post('/agents/from-role/{role_id}', status_code=201)
async def create_agent_from_role(role_id: str, request: Request):
    """从角色创建智能体"""
    data = await request.json() if await request.body() else {}
    agent = role_service.create_agent_from_role(role_id, data)
    if agent:
        return agent
    raise HTTPException(status_code=404, detail='Role not found')


@router.post('/roles/{role_id}/test')
async def test_role(role_id: str, request: Request):
    """测试角色响应"""
    data = await request.json()
    prompt = data.get('prompt', '你好，请介绍一下你自己。')
    system_prompt = data.get('system_prompt')

    advanced_params = {}
    for param in ['temperature', 'top_p', 'frequency_penalty',
                  'presence_penalty', 'max_tokens', 'stop_sequences']:
        if param in data:
            advanced_params[param] = data[param]

    logger.info(f"角色测试请求: role_id={role_id}, prompt={prompt[:30]}..., 高级参数={advanced_params}")

    result = role_service.test_role(role_id, prompt, system_prompt, **advanced_params)
    return result
