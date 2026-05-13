"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: market.py
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
# Source: market.py
# ============================================================

"""
实体应用市场API路由

处理与实体应用市场相关的所有API请求
"""
from app.models import MarketApp, ActionSpace, ActionSpaceApp, db
from app.services.vnc_proxy import vnc_proxy
from sqlalchemy.exc import IntegrityError
from datetime import datetime
import logging

# 创建Blueprint

# 设置日志
logger = logging.getLogger(__name__)

def get_current_user_id():
    """获取当前用户ID（临时实现）"""
    # TODO: 从session或token中获取真实用户ID
    return 1

@router.get('/market/apps')
def get_apps(request: Request):
    """获取应用列表"""
    try:
        # 获取所有应用（包括禁用的，前端会根据enabled字段处理）
        apps = MarketApp.query.order_by(
            MarketApp.sort_order.desc(), MarketApp.name
        ).all()
        
        # 应用过滤
        category = request.query_params.get('category')
        search = request.query_params.get('search')
        featured = request.query_params.get('featured', 'false').lower() == 'true'
        enabled_only = request.query_params.get('enabled_only', 'true').lower() == 'true'
        
        result = []
        for app in apps:
            app_config = app.config
            
            # 过滤逻辑
            if enabled_only and not app.enabled:
                continue
            if category and category != '全部' and app_config.get('basic', {}).get('category') != category:
                continue
            if featured and not app_config.get('basic', {}).get('featured'):
                continue
            if search:
                searchable = f"{app.name} {app_config.get('basic', {}).get('description', '')} {' '.join(app_config.get('basic', {}).get('tags', []))}"
                if search.lower() not in searchable.lower():
                    continue
            
            # 组装应用数据
            app_data = {
                'id': app.app_id,
                'name': app.name,
                'enabled': app.enabled,
                'launchable': app.launchable if app.launchable is not None else True,
                'sort_order': app.sort_order,
                'scope': app.scope or 'space',
                **app_config
            }
            result.append(app_data)
        
        return {'apps': result, 'total': len(result)}
        
    except Exception as e:
        logger.error(f"获取应用列表失败: {e}")
        raise HTTPException(status_code=500, detail={'error': '获取应用列表失败', 'message': str(e)})

@router.get('/market/apps/{app_id}')
def get_app_detail(app_id):
    """获取应用详情"""
    try:
        app = MarketApp.query.filter_by(app_id=app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail={'error': '应用不存在'})
        
        return {
            'id': app.app_id,
            'name': app.name,
            'enabled': app.enabled,
            'sort_order': app.sort_order,
            'scope': app.scope or 'space',
            **app.config
        }
        
    except Exception as e:
        logger.error(f"获取应用详情失败: {e}")
        raise HTTPException(status_code=500, detail={'error': '获取应用详情失败', 'message': str(e)})

@router.post('/market/apps/{app_id}/toggle')
async def toggle_app_enabled(app_id, request: Request):
    """切换应用启用/禁用状态"""
    try:
        app = MarketApp.query.filter_by(app_id=app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail={'error': '应用不存在'})
        
        data = await request.json() or {}
        enabled = data.get('enabled', not app.enabled)
        
        app.enabled = enabled
        app.updated_at = datetime.utcnow()
        db.session.commit()
        
        # NextRPA 禁用时，清理所有 VNC 会话
        if app_id == 'next-rpa' and not enabled:
            vnc_proxy.stop_all()
        
        return {
            'success': True,
            'app_id': app_id,
            'enabled': enabled,
            'message': f'应用已{"启用" if enabled else "禁用"}'
        }
        
    except Exception as e:
        logger.error(f"切换应用状态失败: {e}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': '切换应用状态失败', 'message': str(e)})

@router.post('/market/apps/{app_id}/launch')
def launch_app(app_id):
    """启动应用"""
    try:
        app = MarketApp.query.filter_by(app_id=app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail={'error': '应用不存在'})
        
        if not app.enabled:
            raise HTTPException(status_code=400, detail={'error': '应用已禁用，无法启动'})
        
        # 更新启动统计
        if 'stats' not in app.config:
            app.config['stats'] = {'install_count': 0, 'launch_count': 0}
        
        app.config['stats']['launch_count'] += 1
        app.updated_at = datetime.utcnow()
        
        # 标记为已修改，确保SQLAlchemy知道JSON字段已更新
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(app, 'config')
        
        db.session.commit()
        
        return {
            'success': True,
            'launch_config': app.config.get('launch', {}),
            'app_name': app.name,
            'app_id': app_id
        }
        
    except Exception as e:
        logger.error(f"启动应用失败: {e}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': '启动应用失败', 'message': str(e)})

@router.get('/market/categories')
def get_categories():
    """获取所有分类"""
    try:
        apps = MarketApp.query.all()
        categories = set()
        
        for app in apps:
            category = app.config.get('basic', {}).get('category')
            if category:
                categories.add(category)
        
        return {'categories': ['全部'] + sorted(list(categories))}
        
    except Exception as e:
        logger.error(f"获取分类失败: {e}")
        raise HTTPException(status_code=500, detail={'error': '获取分类失败', 'message': str(e)})

# 管理员接口
@router.post('/market/apps')
async def create_app(request: Request):
    """创建新应用（管理员功能）"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={'error': '请求数据不能为空'})
        
        # 检查必需字段
        required_fields = ['app_id', 'name', 'config']
        for field in required_fields:
            if field not in data:
                raise HTTPException(status_code=400, detail={'error': f'缺少必需字段: {field}'})
        
        # 检查app_id是否已存在
        existing = MarketApp.query.filter_by(app_id=data['app_id']).first()
        if existing:
            raise HTTPException(status_code=400, detail={'error': '应用ID已存在'})
        
        app = MarketApp(
            app_id=data['app_id'],
            name=data['name'],
            enabled=data.get('enabled', True),
            sort_order=data.get('sort_order', 0),
            config=data['config']
        )
        
        db.session.add(app)
        db.session.commit()
        
        return JSONResponse(content={'success': True, 'app_id': app.app_id}, status_code=201)
        
    except IntegrityError as e:
        logger.error(f"创建应用失败（数据完整性错误）: {e}")
        db.session.rollback()
        raise HTTPException(status_code=400, detail={'error': '应用ID已存在或数据格式错误'})
    except Exception as e:
        logger.error(f"创建应用失败: {e}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': '创建应用失败', 'message': str(e)})

@router.put('/market/apps/{app_id}')
async def update_app(app_id, request: Request):
    """更新应用配置（管理员功能）"""
    try:
        app = MarketApp.query.filter_by(app_id=app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail={'error': '应用不存在'})
        
        data = await request.json() or {}
        
        if 'name' in data:
            app.name = data['name']
        if 'enabled' in data:
            app.enabled = data['enabled']
        if 'sort_order' in data:
            app.sort_order = data['sort_order']
        if 'config' in data:
            app.config = data['config']
            # 标记JSON字段已修改
            flag_modified(app, 'config')
        
        app.updated_at = datetime.utcnow()
        db.session.commit()
        
        return {'success': True, 'app_id': app_id}
        
    except Exception as e:
        logger.error(f"更新应用失败: {e}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': '更新应用失败', 'message': str(e)})

@router.put('/market/apps/{app_id}/config')
async def update_app_config(app_id, request: Request):
    """更新应用配置（仅更新config字段）"""
    try:
        app = MarketApp.query.filter_by(app_id=app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail={'error': '应用不存在'})
        
        data = await request.json() or {}
        new_config = data.get('config')
        
        if not new_config:
            raise HTTPException(status_code=400, detail={'error': '配置数据不能为空'})
        
        # 更新配置
        app.config = new_config
        
        # 标记JSON字段已修改
        flag_modified(app, 'config')
        
        app.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"应用 {app_id} 配置已更新")
        return {
            'success': True,
            'app_id': app_id,
            'message': '配置更新成功'
        }
        
    except Exception as e:
        logger.error(f"更新应用配置失败: {e}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': '更新应用配置失败', 'message': str(e)})

@router.delete('/market/apps/{app_id}')
def delete_app(app_id):
    """删除应用（管理员功能）"""
    try:
        app = MarketApp.query.filter_by(app_id=app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail={'error': '应用不存在'})
        
        db.session.delete(app)
        db.session.commit()
        
        return {'success': True, 'message': '应用已删除'}

    except Exception as e:
        logger.error(f"删除应用失败: {e}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': '删除应用失败', 'message': str(e)})


@router.post('/market/apps/{app_id}/bind-spaces')
async def bind_app_to_spaces(app_id, request: Request):
    """绑定应用到行动空间"""
    try:
        data = await request.json()
        space_ids = data.get('space_ids', [])

        if not space_ids:
            raise HTTPException(status_code=400, detail={'error': '请选择至少一个行动空间'})

        # 检查应用是否存在
        app = MarketApp.query.filter_by(app_id=app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail={'error': '应用不存在'})

        # 检查行动空间是否存在
        spaces = ActionSpace.query.filter(ActionSpace.id.in_(space_ids)).all()
        if len(spaces) != len(space_ids):
            raise HTTPException(status_code=400, detail={'error': '部分行动空间不存在'})

        # 删除现有绑定
        ActionSpaceApp.query.filter_by(app_id=app_id).delete()

        # 创建新的绑定关系
        for space_id in space_ids:
            binding = ActionSpaceApp(
                action_space_id=space_id,
                app_id=app_id,
                enabled=True
            )
            db.session.add(binding)

        db.session.commit()

        return {
            'success': True,
            'message': f'应用已绑定到 {len(space_ids)} 个行动空间',
            'bound_spaces': len(space_ids)
        }

    except Exception as e:
        logger.error(f"绑定应用到行动空间失败: {e}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': '绑定失败', 'message': str(e)})


@router.get('/market/apps/{app_id}/bound-spaces')
def get_app_bound_spaces(app_id):
    """获取应用绑定的行动空间列表"""
    try:
        # 检查应用是否存在
        app = MarketApp.query.filter_by(app_id=app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail={'error': '应用不存在'})

        # 获取绑定的行动空间
        bindings = db.session.query(ActionSpaceApp, ActionSpace).join(
            ActionSpace, ActionSpaceApp.action_space_id == ActionSpace.id
        ).filter(ActionSpaceApp.app_id == app_id).all()

        bound_spaces = []
        for binding, space in bindings:
            bound_spaces.append({
                'id': space.id,
                'name': space.name,
                'description': space.description,
                'enabled': binding.enabled,
                'bound_at': binding.created_at.isoformat() if binding.created_at else None
            })

        return {
            'success': True,
            'bound_spaces': bound_spaces,
            'total': len(bound_spaces)
        }

    except Exception as e:
        logger.error(f"获取应用绑定空间失败: {e}")
        raise HTTPException(status_code=500, detail={'error': '获取绑定空间失败', 'message': str(e)})


@router.get('/market/action-spaces')
def get_action_spaces():
    """获取所有行动空间列表（用于绑定选择）"""
    try:
        spaces = ActionSpace.query.order_by(ActionSpace.name).all()

        result = []
        for space in spaces:
            result.append({
                'id': space.id,
                'name': space.name,
                'description': space.description,
                'created_at': space.created_at.isoformat() if space.created_at else None
            })

        return {
            'success': True,
            'action_spaces': result,
            'total': len(result)
        }

    except Exception as e:
        logger.error(f"获取行动空间列表失败: {e}")
        raise HTTPException(status_code=500, detail={'error': '获取行动空间列表失败', 'message': str(e)})


@router.get('/market/action-spaces/{space_id}/apps')
def get_action_space_apps(space_id):
    """获取特定行动空间可用的应用列表（包含绑定的空间级应用和全局应用）"""
    try:
        # 检查行动空间是否存在
        space = ActionSpace.query.get(space_id)
        if not space:
            raise HTTPException(status_code=404, detail={'error': '行动空间不存在'})

        result = []
        added_app_ids = set()

        # 1. 获取绑定到该行动空间的应用（scope='space' 的应用需要绑定）
        bindings = db.session.query(ActionSpaceApp, MarketApp).join(
            MarketApp, ActionSpaceApp.app_id == MarketApp.app_id
        ).filter(
            ActionSpaceApp.action_space_id == space_id,
            ActionSpaceApp.enabled == True,  # 在该空间中启用
            MarketApp.enabled == True        # 应用本身也启用
        ).all()

        for binding, app in bindings:
            app_data = app.to_dict()
            # 添加绑定信息
            app_data['binding'] = {
                'enabled': binding.enabled,
                'settings': binding.settings,
                'bound_at': binding.created_at.isoformat() if binding.created_at else None
            }
            result.append(app_data)
            added_app_ids.add(app.app_id)

        # 2. 获取全局应用（scope='global' 的应用在所有空间都可用，无需绑定）
        # 但排除 launchable=False 的应用（功能开关型应用不需要在任务中显示）
        global_apps = MarketApp.query.filter(
            MarketApp.scope == 'global',
            MarketApp.enabled == True,
            MarketApp.launchable == True
        ).all()

        for app in global_apps:
            if app.app_id not in added_app_ids:
                app_data = app.to_dict()
                # 全局应用没有绑定信息
                app_data['binding'] = None
                result.append(app_data)

        # 按 sort_order 降序排序
        result.sort(key=lambda x: x.get('sort_order', 0), reverse=True)

        return {
            'success': True,
            'apps': result,
            'total': len(result),
            'space_info': {
                'id': space.id,
                'name': space.name,
                'description': space.description
            }
        }

    except Exception as e:
        logger.error(f"获取行动空间应用失败: {e}")
        raise HTTPException(status_code=500, detail={'error': '获取行动空间应用失败', 'message': str(e)})

