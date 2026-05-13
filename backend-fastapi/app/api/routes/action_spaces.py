"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: utils.py, base.py, environment.py, monitoring.py, roles.py, rule_sets.py, tags.py, templates.py
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
# Source: base.py
# ============================================================

"""
Action Spaces 基础管理 - CRUD
"""

from sqlalchemy.exc import IntegrityError

from app.models import (
    ActionSpace, ActionSpaceRole, ActionSpaceTag, ActionSpaceRuleSet, 
    ActionSpaceEnvironmentVariable, ActionSpaceObserver,
    Role, Tag, RuleSet, RoleVariable, db
)
from app.services.user_permission_service import UserPermissionService
from app.utils.uuid_utils import UUIDValidator
def validate_space_access(space_id, current_user, permission_type='view'):
    """验证用户对Action Space的访问权限"""
    space = ActionSpace.query.get(space_id)
    if not space:
        return False, None, ({'success': False, 'message': '行动空间不存在'}, 404)
    if permission_type == 'view':
        if not UserPermissionService.can_view_resource(current_user, space):
            return False, None, ({'success': False, 'message': '无权限查看此行动空间'}, 403)
    elif permission_type == 'edit':
        if not UserPermissionService.can_edit_resource(current_user, space):
            return False, None, ({'success': False, 'message': '无权限编辑此行动空间'}, 403)
    elif permission_type == 'delete':
        if not UserPermissionService.can_delete_resource(current_user, space):
            return False, None, ({'success': False, 'message': '无权限删除此行动空间'}, 403)
    return True, space, None

def format_space_response(space, include_stats=False):
    """格式化Action Space响应数据"""
    data = {
        'id': space.id, 'name': space.name, 'description': space.description,
        'created_at': space.created_at.isoformat() if space.created_at else None,
        'updated_at': space.updated_at.isoformat() if space.updated_at else None,
        'created_by': space.created_by, 'is_shared': space.is_shared
    }
    if include_stats:
        from app.models import ActionSpaceRuleSet, ActionSpaceEnvironmentVariable
        data['stats'] = {
            'roles_count': ActionSpaceRole.query.filter_by(action_space_id=space.id).count(),
            'rule_sets_count': ActionSpaceRuleSet.query.filter_by(action_space_id=space.id).count(),
            'env_vars_count': ActionSpaceEnvironmentVariable.query.filter_by(action_space_id=space.id).count()
        }
    return data

# 创建Blueprint

@router.get('/action-spaces')
def get_action_spaces(request: Request, current_user=Depends(get_current_user)):
    """获取所有行动空间列表（已应用多租户权限过滤）"""
    # 获取当前用户
    # 可选的过滤参数
    name_filter = request.query_params.get('name')

    # 构建查询
    query = ActionSpace.query

    # 应用权限过滤
    query = UserPermissionService.filter_viewable_resources(query, ActionSpace, current_user)

    # 应用名称过滤条件
    if name_filter:
        query = query.filter(ActionSpace.name.ilike(f'%{name_filter}%'))

    action_spaces = query.all()
    result = []

    for space in action_spaces:
        # 获取行动空间关联的规则集
        # 使用ActionSpaceRuleSet关联表查询
        rule_set_associations = ActionSpaceRuleSet.query.filter_by(action_space_id=space.id).all()
        rule_sets_data = []

        for association in rule_set_associations:
            rule_set = RuleSet.query.get(association.rule_set_id)
            if rule_set:
                rule_sets_data.append({
                    'id': rule_set.id,
                    'name': rule_set.name,
                    'description': rule_set.description
                })

        # 获取行动空间的标签
        space_tags = []
        for ast in ActionSpaceTag.query.filter_by(action_space_id=space.id).all():
            tag = Tag.query.get(ast.tag_id)
            if tag:
                space_tags.append({
                    'id': tag.id,
                    'name': tag.name,
                    'type': tag.type,
                    'color': tag.color
                })

        # 获取行动空间关联的角色
        space_roles = ActionSpaceRole.query.filter_by(action_space_id=space.id).all()
        roles_data = []

        for space_role in space_roles:
            role = Role.query.get(space_role.role_id)
            if role:
                roles_data.append({
                    'id': role.id,
                    'name': role.name
                })

        space_data = {
            'id': space.id,
            'name': space.name,
            'description': space.description,
            'settings': space.settings,
            'rule_sets': rule_sets_data,
            'tags': space_tags,
            'roles': roles_data,
            'created_at': space.created_at.isoformat() if space.created_at else None,
            'updated_at': space.updated_at.isoformat() if space.updated_at else None,
            # 多租户字段
            'created_by': space.created_by,
            'is_shared': space.is_shared
        }

        result.append(space_data)

    return {'action_spaces': result}

@router.get('/action-spaces/{space_id}')
def get_action_space(space_id, current_user=Depends(get_current_user)):
    """获取特定行动空间详情"""
    # 获取当前用户
    # 验证UUID格式
    validation_error = UUIDValidator.validate_request_uuid(space_id, "space_id")
    if validation_error:
        return JSONResponse(content=validation_error, status_code=validation_error["code"])

    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 检查查看权限
    if not UserPermissionService.can_view_resource(current_user, space):
        raise HTTPException(status_code=403, detail={'error': '无权限查看此行动空间'})

    # 获取关联的规则集
    # 使用ActionSpaceRuleSet关联表查询
    rule_set_associations = ActionSpaceRuleSet.query.filter_by(action_space_id=space_id).all()
    rule_sets_data = []

    for association in rule_set_associations:
        rule_set = RuleSet.query.get(association.rule_set_id)
        if rule_set:
            rule_sets_data.append({
                'id': rule_set.id,
                'name': rule_set.name,
                'description': rule_set.description
            })

    # 获取行动空间的标签
    space_tags = []
    for ast in ActionSpaceTag.query.filter_by(action_space_id=space_id).all():
        tag = Tag.query.get(ast.tag_id)
        if tag:
            space_tags.append({
                'id': tag.id,
                'name': tag.name,
                'type': tag.type,
                'color': tag.color
            })

    # 获取行动空间关联的角色
    space_roles = ActionSpaceRole.query.filter_by(action_space_id=space_id).all()
    roles_data = []

    for space_role in space_roles:
        role = Role.query.get(space_role.role_id)
        if role:
            roles_data.append({
                'id': role.id,
                'name': role.name
            })

    result = {
        'id': space.id,
        'name': space.name,
        'description': space.description,
        'settings': space.settings,
        'rule_sets': rule_sets_data,
        'tags': space_tags,
        'roles': roles_data,
        'created_at': space.created_at.isoformat() if space.created_at else None,
        'updated_at': space.updated_at.isoformat() if space.updated_at else None,
        # 多租户字段
        'created_by': space.created_by,
        'is_shared': space.is_shared
    }

    return result

@router.post('/action-spaces')
async def create_action_space(request: Request, current_user=Depends(get_current_user)):
    """创建新行动空间"""
    # 获取当前用户
    data = await request.json()

    # 验证必填字段
    if not data.get('name'):
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: name'})

    # 配额检查
    from app.services.subscription_service import SubscriptionService
    quota_result = SubscriptionService.check_quota(current_user.id, 'spaces')
    if not quota_result['allowed']:
        return JSONResponse(content={
            'error': '已达到计划限额',
            'message': f'您的计划最多可创建 {quota_result["limit"]} 个行动空间',
            'quota': quota_result
        }, status_code=403)

    try:
        # 设置多租户字段
        created_by = None
        is_shared = False

        if current_user:
            if current_user.is_admin:
                # 超级管理员可以选择创建系统资源或私有资源
                created_by = data.get('created_by', None)  # None = 系统资源
                is_shared = data.get('is_shared', True if created_by is None else False)
            else:
                # 普通用户创建的资源
                created_by = current_user.id
                is_shared = data.get('is_shared', False)  # 默认私有，可勾选共享

        # 处理settings，将rules字段合并到settings中
        settings = data.get('settings', {})
        if 'rules' in data:
            settings['rules'] = data.get('rules', '')

        # 创建行动空间
        space = ActionSpace(
            name=data.get('name'),
            description=data.get('description', ''),
            settings=settings,
            # 多租户字段
            created_by=created_by,
            is_shared=is_shared
        )

        db.session.add(space)
        db.session.flush()  # 获取ID但不提交事务

        # 处理标签关联
        tag_ids = data.get('tag_ids', [])
        if tag_ids and isinstance(tag_ids, list):
            for tag_id in tag_ids:
                # 验证标签是否存在
                tag = Tag.query.get(tag_id)
                if tag:
                    # 创建关联
                    space_tag = ActionSpaceTag(
                        action_space_id=space.id,
                        tag_id=tag_id
                    )
                    db.session.add(space_tag)

        db.session.commit()

        return JSONResponse(content={
            'id': space.id,
            'name': space.name,
            'message': '行动空间创建成功'
        }, status_code=201)

    except IntegrityError:
        db.session.rollback()
        raise HTTPException(status_code=400, detail={'error': '行动空间创建失败，可能存在名称冲突'})
    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'行动空间创建失败: {str(e)}'})

@router.put('/action-spaces/{space_id}')
async def update_action_space(space_id, request: Request, current_user=Depends(get_current_user)):
    """更新行动空间信息"""
    # 获取当前用户
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 检查编辑权限
    if not UserPermissionService.can_edit_resource(current_user, space):
        raise HTTPException(status_code=403, detail={'error': '无权限编辑此行动空间'})

    data = await request.json()

    try:
        # 更新行动空间属性
        if 'name' in data:
            space.name = data['name']
        if 'description' in data:
            space.description = data['description']

        # 处理settings更新，包括rules字段
        if 'settings' in data or 'rules' in data:
            current_settings = space.settings or {}
            if 'settings' in data:
                current_settings.update(data['settings'])
            if 'rules' in data:
                current_settings['rules'] = data.get('rules', '')
            space.settings = current_settings

        # 只有创建者可以修改 is_shared 状态
        if 'is_shared' in data and UserPermissionService.can_share_resource(current_user, space):
            space.is_shared = data['is_shared']

        # 处理标签更新
        if 'tag_ids' in data and isinstance(data['tag_ids'], list):
            # 删除现有关联
            ActionSpaceTag.query.filter_by(action_space_id=space_id).delete()

            # 创建新关联
            for tag_id in data['tag_ids']:
                tag = Tag.query.get(tag_id)
                if tag:
                    space_tag = ActionSpaceTag(
                        action_space_id=space_id,
                        tag_id=tag_id
                    )
                    db.session.add(space_tag)

        db.session.commit()

        # 获取更新后的标签
        space_tags = []
        for ast in ActionSpaceTag.query.filter_by(action_space_id=space_id).all():
            tag = Tag.query.get(ast.tag_id)
            if tag:
                space_tags.append({
                    'id': tag.id,
                    'name': tag.name,
                    'type': tag.type,
                    'color': tag.color
                })

        return {
            'id': space.id,
            'name': space.name,
            'tags': space_tags,
            'message': '行动空间更新成功'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'行动空间更新失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}')
def delete_action_space(space_id, current_user=Depends(get_current_user)):
    """删除行动空间"""
    # 获取当前用户
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 检查删除权限
    if not UserPermissionService.can_delete_resource(current_user, space):
        raise HTTPException(status_code=403, detail={'error': '无权限删除此行动空间'})

    try:
        # 检查是否有关联的行动任务
        from app.models import ActionTask
        action_tasks = ActionTask.query.filter_by(action_space_id=space_id).all()
        if action_tasks:
            # 构建详细的关联任务信息
            related_tasks = []
            for task in action_tasks:
                related_tasks.append({
                    'id': task.id,
                    'title': task.title,
                    'status': task.status,
                    'description': task.description,
                    'created_at': task.created_at.isoformat() if task.created_at else None
                })

            return JSONResponse(content={
                'error': '无法删除行动空间，存在关联的行动任务。',
                'related_tasks': related_tasks,
                'message': f'该行动空间关联了 {len(action_tasks)} 个行动任务，请先处理这些任务。'
            }, status_code=400)

        # 删除行动空间的关联关系（不删除实体本身）

        # 删除行动空间与标签的关联
        ActionSpaceTag.query.filter_by(action_space_id=space_id).delete()

        # 删除行动空间与规则集的关联（不删除规则集本身）
        ActionSpaceRuleSet.query.filter_by(action_space_id=space_id).delete()

        # 删除行动空间与角色的关联（不删除角色本身）
        ActionSpaceRole.query.filter_by(action_space_id=space_id).delete()

        # 删除行动空间与监督者的关联
        ActionSpaceObserver.query.filter_by(action_space_id=space_id).delete()

        # 删除行动空间专属的数据

        # 删除行动空间的环境变量（这些是行动空间专属的）
        ActionSpaceEnvironmentVariable.query.filter_by(action_space_id=space_id).delete()

        # 删除角色在该行动空间中的变量配置（这些是行动空间专属的）
        RoleVariable.query.filter_by(action_space_id=space_id).delete()

        # 删除行动空间本身
        db.session.delete(space)
        db.session.commit()

        return {
            'success': True,
            'message': '行动空间已删除'
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"删除行动空间失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'行动空间删除失败: {str(e)}'})



# ============================================================
# Source: environment.py
# ============================================================

"""
Action Spaces 环境变量管理
"""


from app.models import ActionSpace, Role, ActionSpaceRole, ActionSpaceEnvironmentVariable, RoleVariable, db
# validate_space_access already defined above

@router.get('/environment-variables/internal')
def get_all_internal_environment_variables():
    """获取所有内部环境变量（用于规则模板变量）"""
    try:
        # 使用JOIN查询一次性获取所有数据，提高性能
        query = db.session.query(
            ActionSpaceEnvironmentVariable,
            ActionSpace.name.label('action_space_name')
        ).join(
            ActionSpace,
            ActionSpaceEnvironmentVariable.action_space_id == ActionSpace.id
        ).order_by(
            ActionSpace.name,
            ActionSpaceEnvironmentVariable.name
        )

        results = query.all()
        variables = []

        for var, space_name in results:
            variables.append({
                'id': var.id,
                'name': var.name,
                'label': var.label,
                'value': var.value,
                'description': var.description,
                'action_space_id': var.action_space_id,
                'action_space_name': space_name,
                'created_at': var.created_at.isoformat() if var.created_at else None,
                'updated_at': var.updated_at.isoformat() if var.updated_at else None
            })

        return variables

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取所有内部环境变量失败: {str(e)}'})

@router.get('/action-spaces/environment-variables/all')
def get_all_action_spaces_environment_variables():
    """获取所有行动空间的环境变量列表"""
    try:
        # 使用JOIN查询一次性获取所有数据，提高性能
        query = db.session.query(
            ActionSpaceEnvironmentVariable,
            ActionSpace.name.label('action_space_name')
        ).join(
            ActionSpace,
            ActionSpaceEnvironmentVariable.action_space_id == ActionSpace.id
        ).order_by(
            ActionSpace.name,
            ActionSpaceEnvironmentVariable.name
        )

        results = query.all()
        variables = []

        for var, space_name in results:
            variables.append({
                'id': var.id,
                'name': var.name,
                'label': var.label,
                'value': var.value,
                'description': var.description,
                'action_space_id': var.action_space_id,
                'action_space_name': space_name,
                'created_at': var.created_at.isoformat() if var.created_at else None,
                'updated_at': var.updated_at.isoformat() if var.updated_at else None
            })

        return {
            'variables': variables,
            'total': len(variables)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取所有环境变量失败: {str(e)}'})

@router.get('/action-spaces/{space_id}/environment-variables')
def get_action_space_environment_variables(space_id):
    """获取行动空间的环境变量列表（包括传统环境变量和共享环境变量）"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    try:
        result = {
            'traditional_variables': [],
            'shared_variables': []
        }

        # 获取传统的行动空间环境变量
        traditional_vars = ActionSpaceEnvironmentVariable.query.filter_by(action_space_id=space_id).all()
        for var in traditional_vars:
            result['traditional_variables'].append({
                'id': var.id,
                'name': var.name,
                'label': var.label,
                'value': var.value,
                'description': var.description,
                'source': 'traditional',
                'created_at': var.created_at.isoformat() if var.created_at else None,
                'updated_at': var.updated_at.isoformat() if var.updated_at else None
            })

        # 获取绑定的共享环境变量
        from app.models import ActionSpaceSharedVariable, SharedEnvironmentVariable
        shared_bindings = db.session.query(ActionSpaceSharedVariable, SharedEnvironmentVariable).join(
            SharedEnvironmentVariable, ActionSpaceSharedVariable.shared_variable_id == SharedEnvironmentVariable.id
        ).filter(ActionSpaceSharedVariable.action_space_id == space_id).all()

        for binding, shared_var in shared_bindings:
            result['shared_variables'].append({
                'binding_id': binding.id,
                'variable_id': shared_var.id,
                'name': shared_var.name,
                'label': shared_var.label,
                'value': shared_var.value,
                'description': shared_var.description,
                'is_readonly': shared_var.is_readonly,
                'source': 'shared',
                'bound_at': binding.created_at.isoformat() if binding.created_at else None
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取环境变量失败: {str(e)}'})

@router.post('/action-spaces/{space_id}/environment-variables')
async def create_action_space_environment_variable(space_id, request: Request):
    """创建行动空间的环境变量"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    data = await request.json()

    # 验证必填字段
    required_fields = ['name', 'label', 'value']
    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail={'error': f'缺少必填字段: {field}'})

    try:
        # 创建环境变量，类型固定为text
        variable = ActionSpaceEnvironmentVariable(
            action_space_id=space_id,
            name=data['name'],
            label=data['label'],
            value=data['value'],
            description=data.get('description')
        )

        db.session.add(variable)
        db.session.commit()

        return JSONResponse(content={
            'id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'value': variable.value,
            'description': variable.description,
            'message': '环境变量创建成功'
        }, status_code=201)

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'创建环境变量失败: {str(e)}'})

@router.put('/action-spaces/{space_id}/environment-variables/{variable_id}')
async def update_action_space_environment_variable(space_id, variable_id, request: Request):
    """更新行动空间的环境变量"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    variable = ActionSpaceEnvironmentVariable.query.get(variable_id)
    if not variable or variable.action_space_id != space_id:
        raise HTTPException(status_code=404, detail={'error': '环境变量未找到'})

    data = await request.json()

    try:
        # 更新环境变量，类型固定为text
        if 'name' in data:
            variable.name = data['name']
        if 'label' in data:
            variable.label = data['label']
        if 'value' in data:
            variable.value = data['value']
        if 'description' in data:
            variable.description = data['description']

        db.session.commit()

        return {
            'id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'value': variable.value,
            'description': variable.description,
            'message': '环境变量更新成功'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'更新环境变量失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}/environment-variables/{variable_id}')
def delete_action_space_environment_variable(space_id, variable_id):
    """删除行动空间的环境变量"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    variable = ActionSpaceEnvironmentVariable.query.get(variable_id)
    if not variable or variable.action_space_id != space_id:
        raise HTTPException(status_code=404, detail={'error': '环境变量未找到'})

    try:
        db.session.delete(variable)
        db.session.commit()

        return {
            'message': '环境变量删除成功'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'删除环境变量失败: {str(e)}'})

@router.get('/action-spaces/{space_id}/roles/{role_id}/environment-variables')
def get_role_environment_variables(space_id, role_id):
    """获取角色在指定行动空间的环境变量"""
    # 检查行动空间和角色是否存在
    space = ActionSpace.query.get(space_id)
    role = Role.query.get(role_id)

    if not space or not role:
        raise HTTPException(status_code=404, detail={'error': '行动空间或角色不存在'})

    # 检查角色是否在行动空间中
    space_role = ActionSpaceRole.query.filter_by(
        action_space_id=space_id,
        role_id=role_id
    ).first()

    if not space_role:
        raise HTTPException(status_code=404, detail={'error': '该角色不在指定行动空间中'})

    try:
        # 获取角色变量
        from app.models import RoleVariable
        variables = RoleVariable.query.filter_by(
            role_id=role_id,
            action_space_id=space_id
        ).all()

        result = []
        for var in variables:
            result.append({
                'id': var.id,
                'name': var.name,
                'label': var.label,
                'value': var.value,
                'description': var.description,
                'created_at': var.created_at.isoformat() if var.created_at else None,
                'updated_at': var.updated_at.isoformat() if var.updated_at else None
            })

        return {'environment_variables': result}

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取角色变量失败: {str(e)}'})

@router.post('/action-spaces/{space_id}/roles/{role_id}/environment-variables')
async def create_role_environment_variable(space_id, role_id, request: Request):
    """为角色在指定行动空间创建环境变量"""
    # 检查行动空间和角色是否存在
    space = ActionSpace.query.get(space_id)
    role = Role.query.get(role_id)

    if not space or not role:
        raise HTTPException(status_code=404, detail={'error': '行动空间或角色不存在'})

    # 检查角色是否在行动空间中
    space_role = ActionSpaceRole.query.filter_by(
        action_space_id=space_id,
        role_id=role_id
    ).first()

    if not space_role:
        raise HTTPException(status_code=404, detail={'error': '该角色不在指定行动空间中'})

    # 获取请求数据
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={'error': '请求数据不能为空'})

    # 验证必要字段
    required_fields = ['name', 'label', 'value']
    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail={'error': f'缺少必要字段 {field}'})

    try:
        # 检查变量名是否已存在
        existing = RoleVariable.query.filter_by(
            role_id=role_id,
            action_space_id=space_id,
            name=data['name']
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail={'error': f'变量名 {data["name"]} 已存在'})

        # 创建新的角色变量，类型固定为text
        variable = RoleVariable(
            role_id=role_id,
            action_space_id=space_id,
            name=data['name'],
            label=data['label'],
            value=data['value'],
            description=data.get('description', '')
        )

        db.session.add(variable)
        db.session.commit()

        # 返回创建的变量
        result = {
            'id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'value': variable.value,
            'description': variable.description,
            'created_at': variable.created_at.isoformat() if variable.created_at else None,
            'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
        }

        return JSONResponse(content=result, status_code=201)

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'创建角色变量失败: {str(e)}'})

@router.put('/action-spaces/{space_id}/roles/{role_id}/environment-variables/{variable_id}')
async def update_role_environment_variable(space_id, role_id, variable_id, request: Request):
    """更新角色在指定行动空间的环境变量"""
    # 检查行动空间和角色是否存在
    space = ActionSpace.query.get(space_id)
    role = Role.query.get(role_id)

    if not space or not role:
        raise HTTPException(status_code=404, detail={'error': '行动空间或角色不存在'})

    # 检查变量是否存在
    variable = RoleVariable.query.filter_by(
        id=variable_id,
        role_id=role_id,
        action_space_id=space_id
    ).first()

    if not variable:
        raise HTTPException(status_code=404, detail={'error': '环境变量不存在'})

    # 获取请求数据
    data = await request.json()
    if not data:
        raise HTTPException(status_code=400, detail={'error': '请求数据不能为空'})

    try:
        # 更新变量
        if 'name' in data:
            # 检查新名称是否与其他变量冲突
            if data['name'] != variable.name:
                existing = RoleVariable.query.filter_by(
                    role_id=role_id,
                    action_space_id=space_id,
                    name=data['name']
                ).first()

                if existing:
                    raise HTTPException(status_code=400, detail={'error': f'变量名 {data["name"]} 已存在'})

            variable.name = data['name']

        if 'label' in data:
            variable.label = data['label']
        if 'value' in data:
            variable.value = data['value']

        if 'description' in data:
            variable.description = data['description']

        db.session.commit()

        # 返回更新后的变量
        result = {
            'id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'value': variable.value,
            'description': variable.description,
            'created_at': variable.created_at.isoformat() if variable.created_at else None,
            'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
        }

        return result

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'更新角色变量失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}/roles/{role_id}/environment-variables/{variable_id}')
def delete_role_environment_variable(space_id, role_id, variable_id):
    """删除角色在指定行动空间的环境变量"""
    # 检查变量是否存在
    variable = RoleVariable.query.filter_by(
        id=variable_id,
        role_id=role_id,
        action_space_id=space_id
    ).first()

    if not variable:
        raise HTTPException(status_code=404, detail={'error': '环境变量不存在'})

    try:
        # 删除变量
        db.session.delete(variable)
        db.session.commit()

        return {'success': True, 'message': '环境变量已删除'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'删除角色变量失败: {str(e)}'})



# ============================================================
# Source: monitoring.py
# ============================================================

"""
Action Spaces 监控和观察者管理
"""


from app.models import ActionSpace, Role, ActionSpaceObserver, db

# 创建Blueprint

@router.get('/action-spaces/{space_id}/observers')
def get_action_space_observers(space_id):
    """获取行动空间的所有监督者"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 查询关联表
    space_observers = ActionSpaceObserver.query.filter_by(action_space_id=space_id).all()
    result = []

    for space_observer in space_observers:
        role = Role.query.get(space_observer.role_id)
        if role:
            # 格式化监督者信息
            observer_data = {
                'id': role.id,
                'name': role.name,
                'description': role.description,
                'model_id': role.model,
                'prompt_template': role.system_prompt,
                'settings': space_observer.settings,
                'additional_prompt': space_observer.additional_prompt,
                'source': role.source or 'internal'  # 添加角色来源信息
            }

            # 获取角色的模型信息
            from app.models import ModelConfig
            if role.model:
                model = ModelConfig.query.get(role.model)
                if model:
                    observer_data['model_name'] = model.name

            result.append(observer_data)

    return {'observers': result}

@router.post('/action-spaces/{space_id}/observers')
async def add_observer_to_action_space(space_id, request: Request):
    """将监督者添加到行动空间"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    data = await request.json()

    # 验证必填字段
    if 'role_id' not in data:
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: role_id'})

    role_id = data['role_id']
    role = Role.query.get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail={'error': '角色未找到'})

    # 检查角色是否已经与行动空间关联为监督者
    existing = ActionSpaceObserver.query.filter_by(
        action_space_id=space_id,
        role_id=role_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail={'error': '该角色已经添加为监督者'})

    try:
        # 创建关联
        settings = data.get('settings', {})
        additional_prompt = data.get('additional_prompt', '')

        # 创建监督者关联
        space_observer = ActionSpaceObserver(
            action_space_id=space_id,
            role_id=role_id,
            settings=settings,
            additional_prompt=additional_prompt
        )

        db.session.add(space_observer)

        # 将角色标记为监督者角色
        role.is_observer_role = True

        db.session.commit()

        # 不再需要获取规则集信息

        return JSONResponse(content={
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'model_id': role.model,
            'prompt_template': role.system_prompt,
            'settings': settings,
            'additional_prompt': additional_prompt,
            'message': '监督者已添加到行动空间'
        }, status_code=201)

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'添加监督者失败: {str(e)}'})

@router.put('/action-spaces/{space_id}/observers/{role_id}')
async def update_action_space_observer(space_id, role_id, request: Request):
    """更新行动空间中的监督者设置"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 查找关联
    space_observer = ActionSpaceObserver.query.filter_by(
        action_space_id=space_id,
        role_id=role_id
    ).first()

    if not space_observer:
        raise HTTPException(status_code=404, detail={'error': '该角色未添加为监督者'})

    data = await request.json()

    try:
        # 更新关联表中的信息
        if 'settings' in data:
            space_observer.settings = data['settings']

        if 'additional_prompt' in data:
            space_observer.additional_prompt = data['additional_prompt']

        # 移除规则集相关代码

        db.session.commit()

        # 移除规则集信息获取

        # 获取角色信息
        role = Role.query.get(role_id)

        return {
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'model_id': role.model,
            'prompt_template': role.system_prompt,
            'settings': space_observer.settings,
            'additional_prompt': space_observer.additional_prompt,
            'message': '监督者已更新'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'更新监督者失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}/observers/{role_id}')
def delete_action_space_observer(space_id, role_id):
    """从行动空间中移除监督者"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 查找关联
    space_observer = ActionSpaceObserver.query.filter_by(
        action_space_id=space_id,
        role_id=role_id
    ).first()

    if not space_observer:
        raise HTTPException(status_code=404, detail={'error': '该角色未添加为监督者'})

    try:
        db.session.delete(space_observer)

        # 检查该角色是否还在其他行动空间中作为监督者
        other_observer_roles = ActionSpaceObserver.query.filter_by(role_id=role_id).count()
        if other_observer_roles == 0:
            # 如果不再是任何行动空间的监督者，取消标记
            role = Role.query.get(role_id)
            if role:
                role.is_observer_role = False

        db.session.commit()

        return {
            'success': True,
            'message': '监督者已从行动空间中移除'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'移除监督者失败: {str(e)}'})



# ============================================================
# Source: roles.py
# ============================================================

"""
Action Spaces 角色管理
"""

from sqlalchemy import func

from app.models import (
    ActionSpace, Role, ActionSpaceRole, RoleVariable,
    ActionSpaceEnvironmentVariable, ActionSpaceObserver, ActionSpaceRuleSet, ActionSpaceTag,
    Rule, RuleSet, Tag, db
)

# 创建Blueprint

@router.get('/action-spaces/{space_id}/roles')
def get_action_space_roles(space_id):
    """获取行动空间的所有角色"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 查询关联表
    space_roles = ActionSpaceRole.query.filter_by(action_space_id=space_id).all()
    result = []

    for space_role in space_roles:
        role = Role.query.get(space_role.role_id)
        if role:
            # 格式化角色信息
            role_data = {
                'id': role.id,
                'name': role.name,
                'description': role.description,
                'model_id': role.model,
                'prompt_template': role.system_prompt,
                'quantity': space_role.quantity,
                'settings': space_role.settings,
                'additional_prompt': space_role.additional_prompt,
                'source': role.source or 'internal'  # 添加角色来源信息
            }

            # 获取角色的模型信息
            if role.model:
                model = ModelConfig.query.get(role.model)
                if model:
                    role_data['model_name'] = model.name

            result.append(role_data)

    return {'roles': result}

@router.post('/action-spaces/{space_id}/roles')
async def add_role_to_action_space(space_id, request: Request):
    """将角色添加到行动空间"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    data = await request.json()

    # 验证必填字段
    if 'role_id' not in data:
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: role_id'})

    role_id = data['role_id']
    role = Role.query.get(role_id)
    if not role:
        raise HTTPException(status_code=404, detail={'error': '角色未找到'})

    # 检查角色是否已经与行动空间关联
    existing = ActionSpaceRole.query.filter_by(
        action_space_id=space_id,
        role_id=role_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail={'error': '角色已经添加到该行动空间'})

    try:
        # 创建关联
        quantity = data.get('quantity', 1)
        settings = data.get('settings', {})
        additional_prompt = data.get('additional_prompt', '')

        space_role = ActionSpaceRole(
            action_space_id=space_id,
            role_id=role_id,
            quantity=quantity,
            settings=settings,
            additional_prompt=additional_prompt
        )

        db.session.add(space_role)
        db.session.commit()

        return JSONResponse(content={
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'model_id': role.model,
            'prompt_template': role.system_prompt,
            'quantity': quantity,
            'settings': settings,
            'additional_prompt': additional_prompt,
            'message': '角色已添加到行动空间'
        }, status_code=201)

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'添加角色失败: {str(e)}'})

@router.put('/action-spaces/{space_id}/roles/{role_id}')
async def update_action_space_role(space_id, role_id, request: Request):
    """更新行动空间中的角色设置"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 查找关联
    space_role = ActionSpaceRole.query.filter_by(
        action_space_id=space_id,
        role_id=role_id
    ).first()

    if not space_role:
        raise HTTPException(status_code=404, detail={'error': '该角色未添加到行动空间'})

    data = await request.json()

    try:
        # 更新关联表中的信息
        if 'quantity' in data:
            space_role.quantity = data['quantity']

        if 'settings' in data:
            space_role.settings = data['settings']

        if 'additional_prompt' in data:
            space_role.additional_prompt = data['additional_prompt']

        # 如果需要更新角色本身的信息
        role = Role.query.get(role_id)
        if role:
            if 'name' in data:
                role.name = data['name']

            if 'description' in data:
                role.description = data['description']

            if 'model_id' in data:
                role.model = data['model_id']

            if 'prompt_template' in data:
                role.system_prompt = data['prompt_template']

        # 处理角色变量
        if 'environment_variables' in data:
            # 先删除该角色在当前行动空间的所有环境变量
            RoleVariable.query.filter_by(
                role_id=role_id,
                action_space_id=space_id
            ).delete()

            # 添加新的环境变量，类型固定为text
            for var_data in data['environment_variables']:
                role_var = RoleVariable(
                    role_id=role_id,
                    action_space_id=space_id,
                    name=var_data.get('name'),
                    label=var_data.get('label', var_data.get('name')),
                    value=var_data.get('value', ''),
                    description=var_data.get('description', '')
                )
                db.session.add(role_var)

        db.session.commit()

        # 获取更新后的角色变量
        role_environment_variables = []
        role_vars = RoleVariable.query.filter_by(
            role_id=role_id,
            action_space_id=space_id
        ).all()

        for var in role_vars:
            role_environment_variables.append({
                'id': var.id,
                'name': var.name,
                'label': var.label,
                'value': var.value,
                'description': var.description
            })

        return {
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'model_id': role.model,
            'prompt_template': role.system_prompt,
            'quantity': space_role.quantity,
            'settings': space_role.settings,
            'additional_prompt': space_role.additional_prompt,
            'environment_variables': role_environment_variables,
            'message': '角色已更新'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'更新角色失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}/roles/{role_id}')
def delete_action_space_role(space_id, role_id):
    """从行动空间中移除角色"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 查找关联
    space_role = ActionSpaceRole.query.filter_by(
        action_space_id=space_id,
        role_id=role_id
    ).first()

    if not space_role:
        raise HTTPException(status_code=404, detail={'error': '该角色未添加到行动空间'})

    try:
        db.session.delete(space_role)
        db.session.commit()

        return {
            'success': True,
            'message': '角色已从行动空间中移除'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'移除角色失败: {str(e)}'})

@router.get('/action-spaces/{space_id}/detail')
def get_action_space_detail(space_id):
    """获取行动空间的详细信息，包括规则集、标签、角色等"""
    # 验证UUID格式
    validation_error = UUIDValidator.validate_request_uuid(space_id, "space_id")
    if validation_error:
        return JSONResponse(content=validation_error, status_code=validation_error["code"])

    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    try:
        # 获取规则集
        # rule_sets = RuleSet.query.filter_by(action_space_id=space_id).all()
        # 使用多对多关联表查询
        rule_sets_data = []
        rule_set_associations = ActionSpaceRuleSet.query.filter_by(action_space_id=space_id).all()

        for association in rule_set_associations:
            rule_set = RuleSet.query.get(association.rule_set_id)
            if rule_set:
                # 获取规则集关联的规则
                rules_data = []
                for rsr in rule_set.rules_relation:
                    rule = Rule.query.get(rsr.rule_id)
                    if rule:
                        rules_data.append({
                            'id': rule.id,
                            'name': rule.name,
                            'description': rule.description,
                            'content': rule.content,
                            'category': rule.category
                        })

                rule_sets_data.append({
                    'id': rule_set.id,
                    'name': rule_set.name,
                    'description': rule_set.description,
                    'rules': rules_data,
                    'conditions': rule_set.conditions,
                    'actions': rule_set.actions,
                    'settings': rule_set.settings
                })

        # 获取标签
        space_tags = []
        for ast in ActionSpaceTag.query.filter_by(action_space_id=space_id).all():
            tag = Tag.query.get(ast.tag_id)
            if tag:
                space_tags.append({
                    'id': tag.id,
                    'name': tag.name,
                    'color': tag.color
                })

        # 获取角色
        space_roles = ActionSpaceRole.query.filter_by(action_space_id=space_id).all()
        roles_data = []

        for space_role in space_roles:
            role = Role.query.get(space_role.role_id)
            if role:
                # 获取该角色在此行动空间的环境变量
                role_vars = RoleVariable.query.filter_by(
                    role_id=role.id,
                    action_space_id=space_id
                ).all()

                role_env_vars = []
                for var in role_vars:
                    role_env_vars.append({
                        'id': var.id,
                        'name': var.name,
                        'label': var.label,
                        'value': var.value,
                        'description': var.description
                    })

                roles_data.append({
                    'id': role.id,
                    'name': role.name,
                    'description': role.description,
                    'model_id': role.model,
                    'prompt_template': role.system_prompt,
                    'quantity': space_role.quantity,
                    'settings': space_role.settings,
                    'additional_prompt': space_role.additional_prompt,
                    'environment_variables': role_env_vars,
                    'source': role.source or 'internal'  # 添加角色来源信息
                })

        # 获取监督者
        space_observers = ActionSpaceObserver.query.filter_by(action_space_id=space_id).all()
        observers_data = []

        for space_observer in space_observers:
            role = Role.query.get(space_observer.role_id)
            if role:
                # 移除规则集信息获取

                observers_data.append({
                    'id': role.id,
                    'name': role.name,
                    'description': role.description,
                    'model_id': role.model,
                    'prompt_template': role.system_prompt,
                    'settings': space_observer.settings,
                    'additional_prompt': space_observer.additional_prompt,
                    'source': role.source or 'internal'  # 添加角色来源信息
                })

        # 获取环境变量
        environment_variables = []
        variables = ActionSpaceEnvironmentVariable.query.filter_by(action_space_id=space_id).all()
        for var in variables:
            environment_variables.append({
                'id': var.id,
                'name': var.name,
                'label': var.label,
                'value': var.value,
                'description': var.description
            })

        result = {
            'id': space.id,
            'name': space.name,
            'description': space.description,
            'settings': space.settings,
            'rule_sets': rule_sets_data,
            'tags': space_tags,
            'roles': roles_data,
            'observers': observers_data,
            'environment_variables': environment_variables,
            'created_at': space.created_at.isoformat() if space.created_at else None,
            'updated_at': space.updated_at.isoformat() if space.updated_at else None
        }

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取行动空间详情失败: {str(e)}'})



# ============================================================
# Source: rule_sets.py
# ============================================================

"""
Action Spaces 规则集管理
"""


from app.models import ActionSpace, RuleSet, Rule, RuleSetRule, ActionSpaceRuleSet, db

# 创建Blueprint

@router.get('/action-spaces/{space_id}/rule-sets')
def get_action_space_rule_sets(space_id):
    """获取行动空间的规则集列表"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 使用多对多关联表查询
    associations = ActionSpaceRuleSet.query.filter_by(action_space_id=space_id).all()
    result = []

    for association in associations:
        rule_set = RuleSet.query.get(association.rule_set_id)
        if rule_set:
            result.append({
                'id': rule_set.id,
                'name': rule_set.name,
                'description': rule_set.description,
                'rules': rule_set.rules,
                'created_at': rule_set.created_at.isoformat() if rule_set.created_at else None,
                'updated_at': rule_set.updated_at.isoformat() if rule_set.updated_at else None
            })

    return {'rule_sets': result}

@router.post('/action-spaces/{space_id}/rule-sets')
async def create_action_space_rule_set(space_id, request: Request):
    """
    创建行动空间规则集

    直接关联到特定行动空间的规则集，可以通过规则名称列表或规则ID列表关联规则
    """
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    data = await request.json()

    # 验证必填字段
    if not data.get('name'):
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: name'})

    try:
        # 创建规则集
        rule_set = RuleSet(
            name=data.get('name'),
            description=data.get('description', ''),
            conditions=data.get('conditions', []),
            actions=data.get('actions', []),
            settings=data.get('settings', {})
        )

        db.session.add(rule_set)
        db.session.flush()  # 获取新ID但不提交

        # 如果提供了规则ID列表，创建规则关联
        rule_ids = data.get('rule_ids', [])
        for rule_id in rule_ids:
            rule = Rule.query.get(rule_id)
            if rule:
                rule_set_rule = RuleSetRule(
                    rule_set_id=rule_set.id,
                    rule_id=rule_id,
                    priority=0  # 默认优先级
                )
                db.session.add(rule_set_rule)

        # 如果提供了规则名称列表，也创建规则关联
        rule_names = data.get('rule_names', [])
        if not rule_names and 'rules' in data:
            # 兼容旧的API，'rules'字段为规则名称列表
            rule_names = data.get('rules', [])

        for rule_name in rule_names:
            rule = Rule.query.filter_by(name=rule_name).first()
            if rule:
                # 检查是否已经添加过该规则
                existing = db.session.query(RuleSetRule).filter_by(
                    rule_set_id=rule_set.id, rule_id=rule.id
                ).first()

                if not existing:
                    rule_set_rule = RuleSetRule(
                        rule_set_id=rule_set.id,
                        rule_id=rule.id,
                        priority=0  # 默认优先级
                    )
                    db.session.add(rule_set_rule)

        # 创建规则集与行动空间的关联
        association = ActionSpaceRuleSet(
            action_space_id=space_id,
            rule_set_id=rule_set.id,
            settings={}
        )

        db.session.add(association)
        db.session.commit()

        return JSONResponse(content={
            'id': rule_set.id,
            'name': rule_set.name,
            'message': '规则集创建成功'
        }, status_code=201)

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'规则集创建失败: {str(e)}'})

@router.get('/action-spaces/{space_id}/rule-sets/stats')
def get_action_space_rule_sets_stats(space_id):
    """获取行动空间的规则集列表及其统计信息"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 使用SQL聚合查询获取每个规则集的规则数量，通过ActionSpaceRuleSet关联表关联
    stats = db.session.query(
        RuleSet.id,
        RuleSet.name,
        RuleSet.description,
        RuleSet.created_at,
        RuleSet.updated_at,
        func.count(RuleSetRule.rule_id).label('rule_count')
    ).join(
        ActionSpaceRuleSet, ActionSpaceRuleSet.rule_set_id == RuleSet.id
    ).outerjoin(
        RuleSetRule, RuleSetRule.rule_set_id == RuleSet.id
    ).filter(
        ActionSpaceRuleSet.action_space_id == space_id
    ).group_by(
        RuleSet.id
    ).all()

    result = []
    for rule_set in stats:
        # 添加行动空间信息
        related_spaces = []
        if space:
            related_spaces.append({
                'id': space.id,
                'name': space.name
            })

        result.append({
            'id': rule_set.id,
            'name': rule_set.name,
            'description': rule_set.description,
            'rule_count': rule_set.rule_count,
            'related_spaces': related_spaces,  # 添加关联行动空间
            'created_at': rule_set.created_at.isoformat() if rule_set.created_at else None,
            'updated_at': rule_set.updated_at.isoformat() if rule_set.updated_at else None
        })

    return {'rule_sets': result}

@router.get('/action-spaces/{space_id}/rule-sets/{rule_set_id}/rules')
def get_action_space_rule_set_rules(space_id, rule_set_id):
    """获取行动空间中特定规则集的规则列表

    Args:
        space_id: 行动空间ID
        rule_set_id: 规则集ID

    Returns:
        规则列表
    """
    # 验证行动空间和规则集是否存在且关联
    action_space = ActionSpace.query.get(space_id)
    if not action_space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail={'error': '规则集未找到'})

    # 检查规则集是否关联到该行动空间
    association = ActionSpaceRuleSet.query.filter_by(
        action_space_id=space_id,
        rule_set_id=rule_set_id
    ).first()

    if not association:
        raise HTTPException(status_code=400, detail={'error': '该规则集不属于指定行动空间'})

    # 获取规则集关联的规则
    rules = []
    for rsr in rule_set.rules_relation:
        rule = Rule.query.get(rsr.rule_id)
        if rule:
            rules.append({
                'id': rule.id,
                'name': rule.name,
                'description': rule.description,
                'content': rule.content,
                'category': rule.category,
                'type': rule.type,
                'is_active': rule.is_active,
                'priority': rsr.priority,
                'created_at': rule.created_at.isoformat() if rule.created_at else None,
                'updated_at': rule.updated_at.isoformat() if rule.updated_at else None
            })

    return {'rules': rules}

@router.post('/action-spaces/{space_id}/rule-sets/{rule_set_id}/rules')
async def add_rule_to_action_space_rule_set(space_id, rule_set_id, request: Request):
    """向行动空间的规则集添加规则

    Args:
        space_id: 行动空间ID
        rule_set_id: 规则集ID

    Request Body:
        {
            "rule_id": 1,
            "priority": 0
        }

    Returns:
        添加结果
    """
    # 验证行动空间和规则集是否存在且关联
    action_space = ActionSpace.query.get(space_id)
    if not action_space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail={'error': '规则集未找到'})

    # 检查规则集是否关联到该行动空间
    association = ActionSpaceRuleSet.query.filter_by(
        action_space_id=space_id,
        rule_set_id=rule_set_id
    ).first()

    if not association:
        raise HTTPException(status_code=400, detail={'error': '该规则集不属于指定行动空间'})

    data = await request.json()

    # 验证必填字段
    if 'rule_id' not in data:
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: rule_id'})

    rule_id = data['rule_id']
    rule = Rule.query.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail={'error': '规则未找到'})

    # 检查是否已经存在关联
    existing = RuleSetRule.query.filter_by(rule_set_id=rule_set_id, rule_id=rule_id).first()
    if existing:
        raise HTTPException(status_code=400, detail={'error': '规则已经添加到该规则集'})

    try:
        # 创建新关联
        rule_set_rule = RuleSetRule(
            rule_id=rule_id,
            rule_set_id=rule_set_id,
            priority=data.get('priority', 0)
        )

        db.session.add(rule_set_rule)
        db.session.commit()

        return {
            'message': '规则成功添加到规则集',
            'rule': {
                'id': rule.id,
                'name': rule.name,
                'priority': rule_set_rule.priority
            }
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'添加规则失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}/rule-sets/{rule_set_id}/rules/{rule_id}')
def remove_rule_from_action_space_rule_set(space_id, rule_set_id, rule_id):
    """从行动空间的规则集移除规则

    Args:
        space_id: 行动空间ID
        rule_set_id: 规则集ID
        rule_id: 规则ID

    Returns:
        移除结果
    """
    # 验证行动空间和规则集是否存在且关联
    action_space = ActionSpace.query.get(space_id)
    if not action_space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail={'error': '规则集未找到'})

    # 检查规则集是否关联到该行动空间
    association = ActionSpaceRuleSet.query.filter_by(
        action_space_id=space_id,
        rule_set_id=rule_set_id
    ).first()

    if not association:
        raise HTTPException(status_code=400, detail={'error': '该规则集不属于指定行动空间'})

    # 检查规则集是否包含该规则
    rule_set_rule = RuleSetRule.query.filter_by(rule_set_id=rule_set_id, rule_id=rule_id).first()
    if not rule_set_rule:
        raise HTTPException(status_code=404, detail={'error': '规则未添加到该规则集'})

    try:
        db.session.delete(rule_set_rule)
        db.session.commit()

        return {'message': '规则已从规则集移除'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'移除规则失败: {str(e)}'})

@router.put('/action-spaces/{space_id}/rule-sets/{rule_set_id}/rules/{rule_id}/priority')
async def update_action_space_rule_priority(space_id, rule_set_id, rule_id, request: Request):
    """更新行动空间规则集中规则的优先级

    Args:
        space_id: 行动空间ID
        rule_set_id: 规则集ID
        rule_id: 规则ID

    Request Body:
        {
            "priority": 10
        }

    Returns:
        更新结果
    """
    # 验证行动空间和规则集是否存在且关联
    action_space = ActionSpace.query.get(space_id)
    if not action_space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail={'error': '规则集未找到'})

    # 检查规则集是否关联到该行动空间
    association = ActionSpaceRuleSet.query.filter_by(
        action_space_id=space_id,
        rule_set_id=rule_set_id
    ).first()

    if not association:
        raise HTTPException(status_code=400, detail={'error': '该规则集不属于指定行动空间'})

    # 检查规则集是否包含该规则
    rule_set_rule = RuleSetRule.query.filter_by(rule_set_id=rule_set_id, rule_id=rule_id).first()
    if not rule_set_rule:
        raise HTTPException(status_code=404, detail={'error': '规则未添加到该规则集'})

    data = await request.json()

    # 验证必填字段
    if 'priority' not in data:
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: priority'})

    try:
        rule_set_rule.priority = data['priority']
        db.session.commit()

        return {'message': '规则优先级更新成功'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'更新规则优先级失败: {str(e)}'})

@router.get('/action-spaces/{space_id}/available-rules')
def get_action_space_available_rules(space_id, request: Request):
    """获取行动空间可添加的规则列表

    获取所有可以添加到行动空间中任意规则集的规则列表

    Args:
        space_id: 行动空间ID
        rule_set_id (可选查询参数): 规则集ID，如果提供则返回可添加到指定规则集的规则

    Returns:
        可添加的规则列表
    """
    # 验证行动空间是否存在
    action_space = ActionSpace.query.get(space_id)
    if not action_space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 获取可选的规则集ID
    rule_set_id_str = request.query_params.get('rule_set_id')
    rule_set_id = int(rule_set_id_str) if rule_set_id_str else None

    if rule_set_id:
        # 验证规则集是否存在且属于该行动空间
        rule_set = RuleSet.query.get(rule_set_id)
        if not rule_set:
            raise HTTPException(status_code=404, detail={'error': '规则集未找到'})

        if rule_set.action_space_id != space_id:
            raise HTTPException(status_code=400, detail={'error': '该规则集不属于指定行动空间'})

        # 获取已添加到该规则集的规则ID列表
        existing_rule_ids = [rsr.rule_id for rsr in RuleSetRule.query.filter_by(rule_set_id=rule_set_id).all()]

        # 获取所有未被添加到该规则集的规则
        available_rules = Rule.query.filter(~Rule.id.in_(existing_rule_ids)).all()
    else:
        # 获取所有规则
        available_rules = Rule.query.all()

    result = []
    for rule in available_rules:
        result.append({
            'id': rule.id,
            'name': rule.name,
            'description': rule.description,
            'category': rule.category,
            'type': rule.type,
            'is_active': rule.is_active,
            'created_at': rule.created_at.isoformat() if rule.created_at else None,
            'updated_at': rule.updated_at.isoformat() if rule.updated_at else None
        })

    return {'rules': result}

@router.post('/action-spaces/{space_id}/rule-sets/{rule_set_id}/associate')
def associate_rule_set(space_id, rule_set_id):
    """关联规则集到行动空间

    将已有的规则集关联到行动空间

    Args:
        space_id: 行动空间ID
        rule_set_id: 规则集ID

    Returns:
        关联结果
    """
    # 验证行动空间是否存在
    action_space = ActionSpace.query.get(space_id)
    if not action_space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 验证规则集是否存在
    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail={'error': '规则集未找到'})

    # 检查是否已关联
    existing = ActionSpaceRuleSet.query.filter_by(
        action_space_id=space_id,
        rule_set_id=rule_set_id
    ).first()

    if existing:
        return JSONResponse(content={'message': '规则集已关联到该行动空间'}, status_code=200)

    try:
        # 创建新关联
        association = ActionSpaceRuleSet(
            action_space_id=space_id,
            rule_set_id=rule_set_id,
            settings={}
        )
        db.session.add(association)
        db.session.commit()

        return {
            'message': '规则集关联成功',
            'rule_set_id': rule_set_id,
            'action_space_id': space_id
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'规则集关联失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}/rule-sets/{rule_set_id}')
def disassociate_rule_set(space_id, rule_set_id):
    """解除行动空间与规则集的关联

    只解除关联关系，不删除规则集

    Args:
        space_id: 行动空间ID
        rule_set_id: 规则集ID

    Returns:
        解除关联结果
    """
    # 验证行动空间是否存在
    action_space = ActionSpace.query.get(space_id)
    if not action_space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 验证规则集是否存在
    rule_set = RuleSet.query.get(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail={'error': '规则集未找到'})

    # 查找关联关系
    association = ActionSpaceRuleSet.query.filter_by(
        action_space_id=space_id,
        rule_set_id=rule_set_id
    ).first()

    if not association:
        raise HTTPException(status_code=400, detail={'error': '规则集未关联到该行动空间'})

    try:
        # 删除关联
        db.session.delete(association)
        db.session.commit()

        return {
            'message': '规则集关联已解除',
            'rule_set_id': rule_set_id
        }

    except Exception as e:
        db.session.rollback()


# ============================================================
# Source: tags.py
# ============================================================

"""
Action Spaces 标签管理
"""


from app.models import ActionSpace, Tag, ActionSpaceTag, db

# 创建Blueprint

@router.get('/tags')
def get_tags():
    """获取所有标签"""
    try:
        tags = Tag.query.all()
        result = []

        for tag in tags:
            result.append({
                'id': tag.id,
                'name': tag.name,
                'type': tag.type,
                'description': tag.description,
                'color': tag.color
            })

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': str(e)})

@router.post('/tags')
async def create_tag(request: Request):
    """创建新标签"""
    data = await request.json()

    # 验证必填字段
    if not data.get('name'):
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: name'})

    if not data.get('type'):
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: type'})

    try:
        # 检查标签名称是否已存在
        existing_tag = Tag.query.filter_by(name=data['name'], type=data['type']).first()
        if existing_tag:
            raise HTTPException(status_code=400, detail={'error': '同类型下标签名称已存在'})

        # 创建新标签
        tag = Tag(
            name=data['name'],
            type=data['type'],
            description=data.get('description', ''),
            color=data.get('color', '#1890ff')
        )

        db.session.add(tag)
        db.session.commit()

        return JSONResponse(content={
            'id': tag.id,
            'name': tag.name,
            'type': tag.type,
            'description': tag.description,
            'color': tag.color,
            'message': '标签创建成功'
        }, status_code=201)

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'标签创建失败: {str(e)}'})

@router.put('/tags/{tag_id}')
async def update_tag(tag_id, request: Request):
    """更新标签信息"""
    tag = Tag.query.get(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail={'error': '标签未找到'})

    data = await request.json()

    try:
        # 检查标签名称是否与其他标签冲突
        if 'name' in data and data['name'] != tag.name:
            existing_tag = Tag.query.filter_by(
                name=data['name'],
                type=data.get('type', tag.type)
            ).filter(Tag.id != tag_id).first()
            if existing_tag:
                raise HTTPException(status_code=400, detail={'error': '同类型下标签名称已存在'})

        # 更新标签属性
        if 'name' in data:
            tag.name = data['name']
        if 'type' in data:
            tag.type = data['type']
        if 'description' in data:
            tag.description = data['description']
        if 'color' in data:
            tag.color = data['color']

        db.session.commit()

        return {
            'id': tag.id,
            'name': tag.name,
            'type': tag.type,
            'description': tag.description,
            'color': tag.color,
            'message': '标签更新成功'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'标签更新失败: {str(e)}'})

@router.delete('/tags/{tag_id}')
def delete_tag(tag_id):
    """删除标签"""
    tag = Tag.query.get(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail={'error': '标签未找到'})

    try:
        # 检查是否有行动空间使用此标签
        associated_spaces = ActionSpaceTag.query.filter_by(tag_id=tag_id).all()
        if associated_spaces:
            space_names = []
            for ast in associated_spaces:
                space = ActionSpace.query.get(ast.action_space_id)
                if space:
                    space_names.append(space.name)

            raise HTTPException(status_code=400, detail={
                'error': '无法删除标签，以下行动空间正在使用此标签',
                'associated_spaces': space_names
            })

        # 删除标签
        db.session.delete(tag)
        db.session.commit()

        return {'message': '标签删除成功'}

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'标签删除失败: {str(e)}'})

@router.post('/action-spaces/{space_id}/tags')
async def add_tag_to_action_space(space_id, request: Request):
    """为行动空间添加标签"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    data = await request.json()

    # 验证必填字段
    if 'tag_id' not in data:
        raise HTTPException(status_code=400, detail={'error': '缺少必填字段: tag_id'})

    tag_id = data['tag_id']
    tag = Tag.query.get(tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail={'error': '标签未找到'})

    # 检查标签是否已经与行动空间关联
    existing = ActionSpaceTag.query.filter_by(
        action_space_id=space_id,
        tag_id=tag_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail={'error': '标签已经添加到该行动空间'})

    try:
        # 创建关联
        space_tag = ActionSpaceTag(
            action_space_id=space_id,
            tag_id=tag_id
        )
        db.session.add(space_tag)
        db.session.commit()

        return {
            'success': True,
            'message': '标签添加成功',
            'tag': {
                'id': tag.id,
                'name': tag.name,
                'type': tag.type,
                'color': tag.color
            }
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'添加标签失败: {str(e)}'})

@router.delete('/action-spaces/{space_id}/tags/{tag_id}')
def remove_tag_from_action_space(space_id, tag_id):
    """从行动空间移除标签"""
    space = ActionSpace.query.get(space_id)
    if not space:
        raise HTTPException(status_code=404, detail={'error': '行动空间未找到'})

    # 查找关联
    space_tag = ActionSpaceTag.query.filter_by(
        action_space_id=space_id,
        tag_id=tag_id
    ).first()

    if not space_tag:
        raise HTTPException(status_code=404, detail={'error': '该标签未添加到行动空间'})

    try:
        db.session.delete(space_tag)
        db.session.commit()

        return {
            'success': True,
            'message': '标签已从行动空间中移除'
        }

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'移除标签失败: {str(e)}'})



# ============================================================
# Source: templates.py
# ============================================================

"""
Action Spaces 模板管理
"""


from app.models import (
    ActionSpace, ActionSpaceRole, ActionSpaceRuleSet, RuleSetRule,
    Role, RuleSet, db
)

# 创建Blueprint

@router.post('/action-spaces/from-template/{template_id}')
async def create_from_template(template_id, request: Request):
    """从模板创建行动空间"""
    # 获取模板行动空间
    template = ActionSpace.query.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail={'error': '模板行动空间未找到'})

    data = await request.json() or {}

    try:
        # 创建新行动空间
        new_space = ActionSpace(
            name=data.get('name', f"{template.name} 副本"),
            description=data.get('description', template.description),
            settings=data.get('settings', template.settings.copy() if template.settings else {})
        )

        db.session.add(new_space)
        db.session.flush()  # 获取新ID但不提交

        # 复制模板的规则集关联
        template_rule_set_associations = ActionSpaceRuleSet.query.filter_by(action_space_id=template_id).all()

        for association in template_rule_set_associations:
            # 获取原规则集
            original_rule_set = RuleSet.query.get(association.rule_set_id)
            if original_rule_set:
                # 创建新规则集
                new_rule_set = RuleSet(
                    name=original_rule_set.name,
                    description=original_rule_set.description,
                    conditions=original_rule_set.conditions.copy() if original_rule_set.conditions else [],
                    actions=original_rule_set.actions.copy() if original_rule_set.actions else [],
                    settings=original_rule_set.settings.copy() if original_rule_set.settings else {}
                )
                db.session.add(new_rule_set)
                db.session.flush()  # 获取新ID但不提交

                # 复制原规则集的规则关联
                original_rule_relations = RuleSetRule.query.filter_by(rule_set_id=original_rule_set.id).all()
                for relation in original_rule_relations:
                    new_relation = RuleSetRule(
                        rule_set_id=new_rule_set.id,
                        rule_id=relation.rule_id,
                        priority=relation.priority
                    )
                    db.session.add(new_relation)

                # 创建新的关联
                new_association = ActionSpaceRuleSet(
                    action_space_id=new_space.id,
                    rule_set_id=new_rule_set.id,
                    settings=association.settings.copy() if association.settings else {}
                )
                db.session.add(new_association)

        # 复制模板的角色关联
        template_role_associations = ActionSpaceRole.query.filter_by(action_space_id=template_id).all()
        for role_assoc in template_role_associations:
            new_role_assoc = ActionSpaceRole(
                action_space_id=new_space.id,
                role_id=role_assoc.role_id,
                quantity=role_assoc.quantity,
                settings=role_assoc.settings.copy() if role_assoc.settings else {},
                additional_prompt=role_assoc.additional_prompt
            )
            db.session.add(new_role_assoc)

        db.session.commit()

        return JSONResponse(content={
            'id': new_space.id,
            'name': new_space.name,
            'message': '从模板创建行动空间成功'
        }, status_code=201)

    except Exception as e:
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'从模板创建行动空间失败: {str(e)}'})


