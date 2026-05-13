"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: published_tasks.py
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
# Source: published_tasks.py
# ============================================================

"""
发布任务管理API路由

处理行动任务的发布、配置和管理
"""
from app.models import PublishedTask, ActionTask, db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import secrets
import logging

# 创建Blueprint

# 设置日志
logger = logging.getLogger(__name__)


def generate_share_token():
    """生成唯一的分享令牌"""
    while True:
        token = secrets.token_urlsafe(32)  # 生成32字节的URL安全令牌
        # 检查是否已存在
        existing = PublishedTask.query.filter_by(share_token=token).first()
        if not existing:
            return token


@router.post('/action-tasks/{task_id}/publish')
async def publish_task(task_id, request: Request, current_user=Depends(get_current_user)):
    """
    发布行动任务

    请求体:
    {
        "title": "自定义标题",
        "description": "自定义描述",
        "access_type": "public|password",
        "access_password": "密码（当access_type为password时必填）",
        "mode": "readonly|interactive",
        "show_messages": true,
        "expires_at": "2025-12-31T23:59:59Z"
    }

    注意:
    - mode='interactive' 时自动允许发送消息，mode='readonly' 时不允许发送消息
    - access_type只支持'public'（公开访问）和'password'（密码保护）
    """
    try:
        # 获取当前用户
        # 检查任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})
        
        # 检查权限
        if not current_user.is_admin and task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail={'error': '无权限发布此任务'})
        
        data = await request.json() or {}
        
        # 检查是否已经发布
        existing_publish = PublishedTask.query.filter_by(action_task_id=task_id).first()
        if existing_publish:
            raise HTTPException(status_code=400, detail={'error': '任务已发布，请使用更新接口'})
        
        # 生成分享令牌
        share_token = generate_share_token()
        
        # 处理密码
        access_password_hash = None
        if data.get('access_type') == 'password' and data.get('access_password'):
            access_password_hash = generate_password_hash(data['access_password'])
        
        # 处理过期时间
        expires_at = None
        if data.get('expires_at'):
            try:
                expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail={'error': '过期时间格式错误'})
        
        # 创建发布配置
        published_task = PublishedTask(
            action_task_id=task_id,
            share_token=share_token,
            title=data.get('title', task.title),
            description=data.get('description', task.description),
            access_type=data.get('access_type', 'public'),
            access_password=access_password_hash,
            allowed_domains=data.get('allowed_domains', []),
            mode=data.get('mode', 'readonly'),
            show_messages=data.get('show_messages', True),
            theme=data.get('theme'),
            branding=data.get('branding'),
            is_active=True,
            expires_at=expires_at,
            user_id=current_user.id
        )
        
        db.session.add(published_task)
        db.session.commit()

        # 生成分享URL和嵌入代码
        # 使用前端URL而不是后端URL
        frontend_url = settings.get('FRONTEND_URL', 'http://localhost:3000')
        share_url = f"{frontend_url}/public/task/{share_token}"
        embed_code = f'<iframe src="{frontend_url}/embed/task/{share_token}" width="100%" height="600" frameborder="0"></iframe>'
        
        return JSONResponse(content={
            'success': True,
            'share_url': share_url,
            'embed_code': embed_code,
            'share_token': share_token,
            'published_task': published_task.to_dict()
        }, status_code=201)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"发布任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'发布任务失败: {str(e)}'})


@router.get('/action-tasks/{task_id}/publish')
def get_publish_config(task_id, current_user=Depends(get_current_user)):
    """获取任务的发布配置"""
    try:
        # 获取当前用户
        # 检查任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})
        
        # 检查权限
        if not current_user.is_admin and task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail={'error': '无权限查看此任务的发布配置'})
        
        # 获取发布配置
        published_task = PublishedTask.query.filter_by(action_task_id=task_id).first()
        
        if not published_task:
            return {
                'published': False,
                'message': '任务未发布'
            }

        # 生成分享URL和嵌入代码
        # 使用前端URL而不是后端URL
        frontend_url = settings.get('FRONTEND_URL', 'http://localhost:3000')
        share_url = f"{frontend_url}/public/task/{published_task.share_token}"
        embed_code = f'<iframe src="{frontend_url}/embed/task/{published_task.share_token}" width="100%" height="600" frameborder="0"></iframe>'
        
        return {
            'published': True,
            'share_url': share_url,
            'embed_code': embed_code,
            'config': published_task.to_dict()
        }
        
    except Exception as e:
        logger.error(f"获取发布配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取发布配置失败: {str(e)}'})


@router.put('/action-tasks/{task_id}/publish')
async def update_publish_config(task_id, request: Request, current_user=Depends(get_current_user)):
    """更新发布配置"""
    try:
        # 获取当前用户
        # 检查任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})
        
        # 检查权限
        if not current_user.is_admin and task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail={'error': '无权限更新此任务的发布配置'})
        
        # 获取发布配置
        published_task = PublishedTask.query.filter_by(action_task_id=task_id).first()
        if not published_task:
            raise HTTPException(status_code=404, detail={'error': '任务未发布'})
        
        data = await request.json() or {}
        
        # 更新配置
        if 'title' in data:
            published_task.title = data['title']
        if 'description' in data:
            published_task.description = data['description']
        if 'access_type' in data:
            published_task.access_type = data['access_type']
        if 'access_password' in data and data.get('access_type') == 'password':
            published_task.access_password = generate_password_hash(data['access_password'])
        if 'allowed_domains' in data:
            published_task.allowed_domains = data['allowed_domains']
        if 'mode' in data:
            published_task.mode = data['mode']
        if 'show_messages' in data:
            published_task.show_messages = data['show_messages']
        if 'theme' in data:
            published_task.theme = data['theme']
        if 'branding' in data:
            published_task.branding = data['branding']
        if 'is_active' in data:
            published_task.is_active = data['is_active']
        if 'expires_at' in data:
            if data['expires_at']:
                try:
                    published_task.expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
                except ValueError:
                    raise HTTPException(status_code=400, detail={'error': '过期时间格式错误'})
            else:
                published_task.expires_at = None
        
        published_task.updated_at = datetime.utcnow()
        db.session.commit()
        
        return {
            'success': True,
            'message': '发布配置更新成功',
            'config': published_task.to_dict()
        }
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新发布配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'更新发布配置失败: {str(e)}'})


@router.delete('/action-tasks/{task_id}/publish')
def unpublish_task(task_id, current_user=Depends(get_current_user)):
    """取消发布"""
    try:
        # 获取当前用户
        # 检查任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})
        
        # 检查权限
        if not current_user.is_admin and task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail={'error': '无权限取消发布此任务'})
        
        # 获取发布配置
        published_task = PublishedTask.query.filter_by(action_task_id=task_id).first()
        if not published_task:
            raise HTTPException(status_code=404, detail={'error': '任务未发布'})
        
        db.session.delete(published_task)
        db.session.commit()
        
        return {
            'success': True,
            'message': '已取消发布'
        }
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"取消发布失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'取消发布失败: {str(e)}'})


@router.get('/action-tasks/{task_id}/publish/stats')
def get_publish_stats(task_id, current_user=Depends(get_current_user)):
    """获取发布统计信息"""
    try:
        # 获取当前用户
        # 检查任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': '任务不存在'})
        
        # 检查权限
        if not current_user.is_admin and task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail={'error': '无权限查看此任务的统计信息'})
        
        # 获取发布配置
        published_task = PublishedTask.query.filter_by(action_task_id=task_id).first()
        if not published_task:
            raise HTTPException(status_code=404, detail={'error': '任务未发布'})
        
        return {
            'view_count': published_task.view_count,
            'last_viewed_at': published_task.last_viewed_at.isoformat() if published_task.last_viewed_at else None,
            'created_at': published_task.created_at.isoformat() if published_task.created_at else None,
            'is_active': published_task.is_active,
            'expires_at': published_task.expires_at.isoformat() if published_task.expires_at else None
        }
        
    except Exception as e:
        logger.error(f"获取发布统计失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取发布统计失败: {str(e)}'})


