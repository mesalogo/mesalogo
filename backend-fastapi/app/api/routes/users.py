"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: users.py
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
# Source: users.py
# ============================================================

"""
用户管理API路由

处理与用户管理相关的所有API请求
"""
from app.models import User
from app.extensions import db
# werkzeug.security 已移除 — 密码操作通过 User.set_password() / check_password()
from app.services.subscription_service import SubscriptionService
import re

# 创建Blueprint



def validate_email(email):
    """验证邮箱格式"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """验证密码强度"""
    if len(password) < 6:
        return False, "密码长度至少6位"
    return True, ""

@router.get('/users')
def get_users(request: Request):
    """获取用户列表"""
    try:
        page = int(request.query_params.get('page', 1))
        per_page = int(request.query_params.get('per_page', 20))
        search = str(request.query_params.get('search', ''))
        
        # 构建查询
        query = User.query
        
        # 搜索过滤
        if search:
            query = query.filter(
                db.or_(
                    User.username.contains(search),
                    User.email.contains(search)
                )
            )
        
        # 分页（手动实现，替代 Flask-SQLAlchemy 的 paginate）
        total = query.count()
        pages = (total + per_page - 1) // per_page
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        
        users = []
        for user in items:
            user_data = user.to_dict(include_roles=True)
            # 添加最后登录时间
            user_data['last_login_at'] = user.get_profile_field('last_login_at')
            users.append(user_data)
        
        return {
            'users': users,
            'total': total,
            'pages': pages,
            'current_page': page,
            'per_page': per_page
        }
        
    except Exception as e:
        logger.error(f"获取用户列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取用户列表失败'})

@router.post('/users')
async def create_user(request: Request, current_user=Depends(get_current_user)):
    """创建新用户"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})
        
        # 验证必填字段
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')

        if not username:
            raise HTTPException(status_code=400, detail={'error': '用户名不能为空'})
        if not password:
            raise HTTPException(status_code=400, detail={'error': '密码不能为空'})

        # 验证邮箱格式（如果提供了邮箱）
        if email and not validate_email(email):
            raise HTTPException(status_code=400, detail={'error': '邮箱格式不正确'})
        
        # 验证密码强度
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            raise HTTPException(status_code=400, detail={'error': error_msg})
        
        # 检查用户名是否已存在
        if User.query.filter_by(username=username).first():
            raise HTTPException(status_code=400, detail={'error': '用户名已存在'})

        # 检查邮箱是否已存在（如果提供了邮箱）
        if email and User.query.filter_by(email=email).first():
            raise HTTPException(status_code=400, detail={'error': '邮箱已存在'})
        
        # 获取当前用户
        # 创建新用户
        user = User(
            username=username,
            email=email if email else None,  # 允许邮箱为空
            is_active=data.get('is_active', True),
            is_admin=data.get('is_admin', False)
        )
        user.set_password(password)
        
        # 设置profile信息
        profile = {
            'display_name': data.get('display_name', username),
            'phone': data.get('phone', ''),
            'created_by': current_user.id,
            'metadata': {
                'department': data.get('department', ''),
                'position': data.get('position', ''),
                'notes': data.get('notes', '')
            }
        }
        user.profile = profile
        
        db.session.add(user)
        db.session.commit()
        
        # 为新用户分配默认订阅计划
        SubscriptionService.assign_default_plan(user.id, created_by=current_user.id)
        
        logger.info(f"用户 {username} 创建成功，创建者: {current_user.username}")
        
        return JSONResponse(content={
            'message': '用户创建成功',
            'user': user.to_dict()
        }, status_code=201)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建用户失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '创建用户失败'})

@router.get('/users/current')
def get_current_user_info(current_user=Depends(get_current_user)):
    """获取当前用户信息"""
    try:
        return {
            'user': current_user.to_dict(include_sensitive=True)
        }

    except Exception as e:
        logger.error(f"获取当前用户信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取当前用户信息失败'})

@router.get('/users/permissions')
def get_user_permissions(current_user=Depends(get_current_user)):
    """获取用户权限信息"""
    try:
        permissions = {
            'is_admin': current_user.is_admin,
            'can_manage_users': current_user.is_admin,
            'can_view_all_tasks': current_user.is_admin,
            'can_manage_settings': current_user.is_admin,
            'can_manage_roles': current_user.is_admin,
            'can_manage_action_spaces': current_user.is_admin
        }

        return {'permissions': permissions}

    except Exception as e:
        logger.error(f"获取用户权限失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取用户权限失败'})

@router.get('/users/{user_id}')
def get_user(user_id, current_user=Depends(get_current_user)):
    """获取用户详情"""
    try:
        # 非管理员只能查看自己的信息
        if not current_user.is_admin and current_user.id != user_id:
            raise HTTPException(status_code=403, detail={'error': '无权限访问'})
        
        user = User.query.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})
        
        return {
            'user': user.to_dict(include_sensitive=current_user.is_admin)
        }
        
    except Exception as e:
        logger.error(f"获取用户详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取用户详情失败'})

@router.put('/users/profile')
async def update_profile(request: Request, current_user=Depends(get_current_user)):
    """更新当前用户资料"""
    try:
        data = await request.json()

        if not data:
            raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})

        # 可更新的字段
        if 'display_name' in data:
            current_user.set_profile_field('display_name', data['display_name'])

        if 'email' in data:
            # 验证邮箱格式
            if data['email'] and not validate_email(data['email']):
                raise HTTPException(status_code=400, detail={'error': '邮箱格式不正确'})
            # 检查邮箱是否已被使用
            if data['email'] and data['email'] != current_user.email:
                existing = User.query.filter_by(email=data['email']).first()
                if existing:
                    raise HTTPException(status_code=400, detail={'error': '该邮箱已被使用'})
            current_user.email = data['email']

        if 'avatar' in data:
            current_user.set_profile_field('avatar', data['avatar'])

        db.session.commit()

        logger.info(f"用户 {current_user.username} 更新资料成功")

        return {
            'message': '资料更新成功',
            'user': current_user.to_dict()
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"更新资料失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '更新资料失败'})

@router.put('/users/{user_id}')
async def update_user(user_id, request: Request, current_user=Depends(get_current_user)):
    """更新用户信息"""
    try:
        # 非管理员只能修改自己的信息
        if not current_user.is_admin and current_user.id != user_id:
            raise HTTPException(status_code=403, detail={'error': '无权限访问'})
        
        user = User.query.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})
        
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})
        
        # 更新基本信息
        if 'email' in data:
            email = data['email'].strip()
            # 只在邮箱不为空时验证格式
            if email and not validate_email(email):
                raise HTTPException(status_code=400, detail={'error': '邮箱格式不正确'})

            # 检查邮箱是否已被其他用户使用（只在邮箱不为空时检查）
            if email:
                existing_user = User.query.filter_by(email=email).first()
                if existing_user and existing_user.id != user_id:
                    raise HTTPException(status_code=400, detail={'error': '邮箱已被其他用户使用'})

            user.email = email if email else None
        
        # 只有管理员可以修改这些字段，但有特殊限制
        if current_user.is_admin:
            # 检查是否为根用户
            if user.username == 'admin':
                # 根用户的状态和权限不可修改
                if 'is_active' in data and not data['is_active']:
                    raise HTTPException(status_code=400, detail={'error': '不能禁用根用户'})
                if 'is_admin' in data and not data['is_admin']:
                    raise HTTPException(status_code=400, detail={'error': '不能移除根用户的管理员权限'})
            else:
                # 检查是否可以编辑用户角色（超级管理员不能修改自己的角色）
                from app.services.user_permission_service import UserPermissionService
                if 'is_admin' in data and not UserPermissionService.can_edit_user_role(current_user, user):
                    raise HTTPException(status_code=403, detail={'error': '超级管理员不能修改自己的角色'})

                # 非根用户可以正常修改
                if 'is_active' in data:
                    user.is_active = data['is_active']
                if 'is_admin' in data:
                    user.is_admin = data['is_admin']
        
        # 更新profile信息
        if not user.profile:
            user.profile = {}
        
        profile_fields = ['display_name', 'phone']
        for field in profile_fields:
            if field in data:
                user.set_profile_field(field, data[field])
        
        # 更新metadata
        if 'department' in data or 'position' in data or 'notes' in data:
            metadata = user.get_profile_field('metadata', {})
            if 'department' in data:
                metadata['department'] = data['department']
            if 'position' in data:
                metadata['position'] = data['position']
            if 'notes' in data:
                metadata['notes'] = data['notes']
            user.set_profile_field('metadata', metadata)
        
        # 记录更新者
        user.set_profile_field('updated_by', current_user.id)
        
        db.session.commit()
        
        logger.info(f"用户 {user.username} 信息更新成功，更新者: {current_user.username}")
        
        return {
            'message': '用户信息更新成功',
            'user': user.to_dict()
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"更新用户信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '更新用户信息失败'})

def get_user_resources_stats(user_id):
    """获取用户资源统计"""
    from app.models import Role, Knowledge, Capability, ActionSpace, RuleSet, ActionTask

    stats = {
        'roles': Role.query.filter_by(created_by=user_id).count(),
        'knowledges': Knowledge.query.filter_by(created_by=user_id).count(),
        'capabilities': Capability.query.filter_by(created_by=user_id).count(),
        'action_spaces': ActionSpace.query.filter_by(created_by=user_id).count(),
        'rule_sets': RuleSet.query.filter_by(created_by=user_id).count(),
        'action_tasks': ActionTask.query.filter_by(user_id=user_id).count(),
    }

    stats['total'] = sum(stats.values())

    return stats


@router.get('/users/{user_id}/deletion-preview')
def get_deletion_preview(user_id):
    """
    获取删除用户的预览信息
    显示将要删除的资源统计
    """
    try:
        user = User.query.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})

        # 获取资源统计
        stats = get_user_resources_stats(user_id)

        # 获取详细信息

        details = {
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_admin': user.is_admin,
            },
            'resources': {
                'roles': {
                    'count': stats['roles'],
                    'private': Role.query.filter_by(created_by=user_id, is_shared=False).count(),
                    'shared': Role.query.filter_by(created_by=user_id, is_shared=True).count(),
                },
                'knowledges': {
                    'count': stats['knowledges'],
                    'private': Knowledge.query.filter_by(created_by=user_id, is_shared=False).count(),
                    'shared': Knowledge.query.filter_by(created_by=user_id, is_shared=True).count(),
                },
                'capabilities': {
                    'count': stats['capabilities'],
                    'private': Capability.query.filter_by(created_by=user_id, is_shared=False).count(),
                    'shared': Capability.query.filter_by(created_by=user_id, is_shared=True).count(),
                },
                'action_spaces': {
                    'count': stats['action_spaces'],
                    'private': ActionSpace.query.filter_by(created_by=user_id, is_shared=False).count(),
                    'shared': ActionSpace.query.filter_by(created_by=user_id, is_shared=True).count(),
                },
                'rule_sets': {
                    'count': stats['rule_sets'],
                    'private': RuleSet.query.filter_by(created_by=user_id, is_shared=False).count(),
                    'shared': RuleSet.query.filter_by(created_by=user_id, is_shared=True).count(),
                },
                'action_tasks': {
                    'count': stats['action_tasks'],
                    'private': ActionTask.query.filter_by(user_id=user_id, is_shared=False).count(),
                    'shared': ActionTask.query.filter_by(user_id=user_id, is_shared=True).count(),
                },
            },
            'total_resources': stats['total'],
        }

        return JSONResponse(content=details, status_code=200)

    except Exception as e:
        logger.error(f"获取删除预览失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '获取删除预览失败'})


@router.delete('/users/{user_id}')
def delete_user(user_id, current_user=Depends(get_current_user)):
    """
    删除用户（级联删除所有资源）

    ⚠️ 警告：此操作将删除用户创建的所有资源，无法恢复！
    """
    try:
        # 不能删除自己
        if current_user.id == user_id:
            raise HTTPException(status_code=400, detail={'error': '不能删除自己的账户'})

        user = User.query.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})

        # 不能删除根用户
        if user.username == 'admin':
            raise HTTPException(status_code=400, detail={'error': '不能删除根用户'})

        # 统计将要删除的资源
        stats = get_user_resources_stats(user_id)

        # 导入所有需要的模型
        from app.models import (
            Role, Knowledge, Capability, ActionSpace, RuleSet, ActionTask,
            RoleKnowledge, RoleCapability, ActionSpaceRole, ActionSpaceRuleSet,
            ActionSpaceTag, ActionSpaceObserver, ActionSpaceEnvironmentVariable,
            RoleVariable, ActionTaskAgent, Conversation, ConversationAgent, Message
        )

        # 开始级联删除（按照依赖关系从下到上删除）

        # 0. 删除用户角色分配
        from app.models import UserRoleAssignment
        UserRoleAssignment.query.filter_by(user_id=user_id).delete()

        # 1. 删除行动任务及其关联数据
        action_tasks = ActionTask.query.filter_by(user_id=user_id).all()
        for task in action_tasks:
            # 删除任务的对话消息
            conversations = Conversation.query.filter_by(action_task_id=task.id).all()
            for conv in conversations:
                Message.query.filter_by(conversation_id=conv.id).delete()
                ConversationAgent.query.filter_by(conversation_id=conv.id).delete()
                db.session.delete(conv)

            # 删除任务与智能体的关联
            ActionTaskAgent.query.filter_by(action_task_id=task.id).delete()

            # 删除任务本身
            db.session.delete(task)

        # 2. 删除行动空间及其关联数据
        action_spaces = ActionSpace.query.filter_by(created_by=user_id).all()
        for space in action_spaces:
            # 删除行动空间的关联关系
            ActionSpaceTag.query.filter_by(action_space_id=space.id).delete()
            ActionSpaceRuleSet.query.filter_by(action_space_id=space.id).delete()
            ActionSpaceRole.query.filter_by(action_space_id=space.id).delete()
            ActionSpaceObserver.query.filter_by(action_space_id=space.id).delete()
            ActionSpaceEnvironmentVariable.query.filter_by(action_space_id=space.id).delete()
            RoleVariable.query.filter_by(action_space_id=space.id).delete()

            # 删除行动空间本身
            db.session.delete(space)

        # 3. 删除规则集及其关联数据
        rule_sets = RuleSet.query.filter_by(created_by=user_id).all()
        for rule_set in rule_sets:
            # 删除规则集与规则的关联
            from app.models import RuleSetRule
            RuleSetRule.query.filter_by(rule_set_id=rule_set.id).delete()

            # 删除规则集本身
            db.session.delete(rule_set)

        # 4. 删除知识库及其关联数据
        knowledges = Knowledge.query.filter_by(created_by=user_id).all()
        for knowledge in knowledges:
            # 删除角色与知识库的关联
            RoleKnowledge.query.filter_by(knowledge_id=knowledge.id).delete()

            # 删除知识库文件存储
            try:
                import shutil
                import os
                from app.config import Config
                kb_path = os.path.join(Config.KNOWLEDGE_BASE_DIR, knowledge.id)
                if os.path.exists(kb_path):
                    shutil.rmtree(kb_path)
            except Exception as e:
                logger.warning(f"删除知识库文件失败: {str(e)}")

            # 删除知识库本身
            db.session.delete(knowledge)

        # 5. 删除能力及其关联数据
        capabilities = Capability.query.filter_by(created_by=user_id).all()
        for capability in capabilities:
            # 删除角色与能力的关联
            RoleCapability.query.filter_by(capability_id=capability.id).delete()

            # 删除能力本身
            db.session.delete(capability)

        # 6. 删除角色及其关联数据
        roles = Role.query.filter_by(created_by=user_id).all()
        for role in roles:
            # 删除角色与知识库的关联
            RoleKnowledge.query.filter_by(role_id=role.id).delete()

            # 删除角色与能力的关联
            RoleCapability.query.filter_by(role_id=role.id).delete()

            # 删除角色与行动空间的关联
            ActionSpaceRole.query.filter_by(role_id=role.id).delete()
            ActionSpaceObserver.query.filter_by(role_id=role.id).delete()

            # 删除角色的环境变量
            RoleVariable.query.filter_by(role_id=role.id).delete()

            # 删除角色本身
            db.session.delete(role)

        # 7. 最后删除用户本身
        username = user.username
        db.session.delete(user)

        # 提交所有删除操作
        db.session.commit()

        logger.info(
            f"用户 {username} 删除成功，操作者: {current_user.username}，"
            f"删除资源统计: {stats}"
        )

        return JSONResponse(content={
            'message': '用户删除成功',
            'deleted_resources': stats
        }, status_code=200)

    except Exception as e:
        db.session.rollback()
        logger.error(f"删除用户失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={'error': f'删除用户失败: {str(e)}'})

@router.post('/users/{user_id}/password')
async def reset_password(user_id, request: Request, current_user=Depends(get_current_user)):
    """重置用户密码（无需验证旧密码）"""
    try:
        # 非管理员只能修改自己的密码
        if not current_user.is_admin and current_user.id != user_id:
            raise HTTPException(status_code=403, detail={'error': '无权限访问'})

        user = User.query.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})

        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})

        new_password = data.get('new_password', '')
        if not new_password:
            raise HTTPException(status_code=400, detail={'error': '新密码不能为空'})



        # 验证新密码强度
        is_valid, error_msg = validate_password(new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail={'error': error_msg})

        user.set_password(new_password)
        user.set_profile_field('updated_by', current_user.id)

        db.session.commit()

        logger.info(f"用户 {user.username} 密码重置成功，操作者: {current_user.username}")

        return {'message': '密码重置成功'}

    except Exception as e:
        db.session.rollback()
        logger.error(f"重置密码失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '重置密码失败'})

@router.put('/users/{user_id}/status')
async def toggle_user_status(user_id, request: Request, current_user=Depends(get_current_user)):
    """切换用户状态（启用/禁用）"""
    try:
        # 不能禁用自己
        if current_user.id == user_id:
            raise HTTPException(status_code=400, detail={'error': '不能禁用自己的账户'})

        user = User.query.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail={'error': '用户不存在'})

        # 不能禁用根用户
        if user.username == 'admin' and not data.get('is_active', True):
            raise HTTPException(status_code=400, detail={'error': '不能禁用根用户'})

        data = await request.json()
        if not data or 'is_active' not in data:
            raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})

        user.is_active = data['is_active']
        user.set_profile_field('updated_by', current_user.id)

        db.session.commit()

        status_text = '启用' if user.is_active else '禁用'
        logger.info(f"用户 {user.username} {status_text}成功，操作者: {current_user.username}")

        return {
            'message': f'用户{status_text}成功',
            'user': user.to_dict()
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"切换用户状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '切换用户状态失败'})

@router.post('/users/change-password')
async def change_password(request: Request, current_user=Depends(get_current_user)):
    """修改当前用户密码"""
    try:
        data = await request.json()

        if not data:
            raise HTTPException(status_code=400, detail={'error': '无效的请求数据'})

        old_password = data.get('old_password')
        new_password = data.get('new_password')

        if not old_password:
            raise HTTPException(status_code=400, detail={'error': '请输入当前密码'})

        if not new_password:
            raise HTTPException(status_code=400, detail={'error': '请输入新密码'})

        # 验证旧密码
        if not current_user.check_password(old_password):
            raise HTTPException(status_code=400, detail={'error': '当前密码不正确'})

        # 验证新密码强度
        is_valid, error_msg = validate_password(new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail={'error': error_msg})

        # 设置新密码
        current_user.set_password(new_password)
        db.session.commit()

        logger.info(f"用户 {current_user.username} 修改密码成功")

        return {'message': '密码修改成功'}

    except Exception as e:
        db.session.rollback()
        logger.error(f"修改密码失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': '修改密码失败'})

