"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: external_knowledge.py
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
# Source: external_knowledge.py
# ============================================================

"""
外部知识库API路由

处理与外部知识库相关的所有API请求，包括：
- 提供商管理
- 外部知识库管理  
- 角色关联管理
- 查询功能
"""

from app.models import (
    ExternalKnowledgeProvider, ExternalKnowledge, RoleExternalKnowledge,
    ExternalKnowledgeQueryLog, Role, db
)
from app.services.external_knowledge import AdapterFactory, ExternalKnowledgeService
from app.services.user_permission_service import UserPermissionService
from sqlalchemy.exc import IntegrityError
import time
import requests
from datetime import datetime

# 创建Blueprint

# ==================== 提供商管理接口 ====================

@router.get('/external-kb/providers')
def get_providers(current_user=Depends(get_current_user)):
    """获取所有外部知识库提供商（已应用多租户权限过滤）"""
    try:
        query = ExternalKnowledgeProvider.query.filter_by(status='active')
        query = UserPermissionService.filter_viewable_resources(query, ExternalKnowledgeProvider, current_user)
        providers = query.all()
        
        result = []
        for provider in providers:
            # 统计该提供商下的知识库数量
            kb_count = ExternalKnowledge.query.filter_by(
                provider_id=provider.id, 
                status='active'
            ).count()
            
            result.append({
                'id': provider.id,
                'name': provider.name,
                'type': provider.type,
                'base_url': provider.base_url,
                'status': provider.status,
                'knowledge_count': kb_count,
                'created_at': provider.created_at.isoformat() if provider.created_at else None,
                'updated_at': provider.updated_at.isoformat() if provider.updated_at else None
            })
        
        return {
            'success': True,
            'data': result,
            'total': len(result)
        }
        
    except Exception as e:
        logger.error(f"获取提供商列表失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取提供商列表失败: {str(e)}'
        })

@router.post('/external-kb/providers')
async def create_provider(request: Request, current_user=Depends(get_current_user)):
    """创建外部知识库提供商"""
    try:
        data = await request.json()
        
        # 验证必填字段
        required_fields = ['name', 'type', 'base_url', 'api_key']
        for field in required_fields:
            if not data.get(field):
                raise HTTPException(status_code=400, detail={
                    'success': False,
                    'message': f'缺少必填字段: {field}'
                })
        
        # 检查名称是否重复
        existing = ExternalKnowledgeProvider.query.filter_by(name=data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '提供商名称已存在'
            })
        
        # 设置多租户字段
        created_by = None
        is_shared = False
        if current_user:
            if current_user.is_admin:
                created_by = data.get('created_by', None)
                is_shared = data.get('is_shared', True if created_by is None else False)
            else:
                created_by = current_user.id
                is_shared = data.get('is_shared', False)
        
        # 创建提供商
        provider = ExternalKnowledgeProvider(
            name=data['name'],
            type=data['type'],
            base_url=data['base_url'].rstrip('/'),
            api_key=data['api_key'],
            config=data.get('config', {}),
            status='active',
            created_by=created_by,
            is_shared=is_shared
        )
        
        db.session.add(provider)
        db.session.commit()
        
        return {
            'success': True,
            'message': '提供商创建成功',
            'data': {
                'id': provider.id,
                'name': provider.name,
                'type': provider.type,
                'base_url': provider.base_url,
                'status': provider.status,
                'created_at': provider.created_at.isoformat()
            }
        }
        
    except IntegrityError:
        db.session.rollback()
        raise HTTPException(status_code=400, detail={
            'success': False,
            'message': '提供商名称已存在'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建提供商失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'创建提供商失败: {str(e)}'
        })

@router.get('/external-kb/providers/{provider_id}')
def get_provider_detail(provider_id, current_user=Depends(get_current_user)):
    """获取单个外部知识库提供商详情"""
    try:
        provider = ExternalKnowledgeProvider.query.get(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '供应商不存在'})

        # 检查查看权限
        if not UserPermissionService.can_view_resource(current_user, provider):
            raise HTTPException(status_code=403, detail={'success': False, 'message': '无权限查看此提供商'})

        # 统计该提供商下的知识库数量
        kb_count = ExternalKnowledge.query.filter_by(
            provider_id=provider.id,
            status='active'
        ).count()

        return {
            'success': True,
            'data': {
                'id': provider.id,
                'name': provider.name,
                'type': provider.type,
                'base_url': provider.base_url,
                'api_key': provider.api_key,  # 详情接口包含API Key
                'config': provider.config,
                'status': provider.status,
                'knowledge_count': kb_count,
                'created_by': provider.created_by,
                'is_shared': provider.is_shared,
                'created_at': provider.created_at.isoformat() if provider.created_at else None,
                'updated_at': provider.updated_at.isoformat() if provider.updated_at else None
            }
        }

    except Exception as e:
        logger.error(f"获取提供商详情失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取提供商详情失败: {str(e)}'
        })

@router.put('/external-kb/providers/{provider_id}')
async def update_provider(provider_id, request: Request, current_user=Depends(get_current_user)):
    """更新外部知识库提供商"""
    try:
        provider = ExternalKnowledgeProvider.query.get(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '供应商不存在'})
        
        # 检查编辑权限
        if not UserPermissionService.can_edit_resource(current_user, provider):
            raise HTTPException(status_code=403, detail={'success': False, 'message': '无权限编辑此提供商'})
        
        data = await request.json()
        
        # 更新字段
        if 'name' in data:
            # 检查名称是否重复（排除自己）
            existing = ExternalKnowledgeProvider.query.filter(
                ExternalKnowledgeProvider.name == data['name'],
                ExternalKnowledgeProvider.id != provider_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail={
                    'success': False,
                    'message': '提供商名称已存在'
                })
            provider.name = data['name']
        
        if 'type' in data:
            provider.type = data['type']
        if 'base_url' in data:
            provider.base_url = data['base_url'].rstrip('/')
        if 'api_key' in data:
            provider.api_key = data['api_key']
        if 'config' in data:
            provider.config = data['config']
        if 'status' in data:
            provider.status = data['status']
        
        # 只有创建者可以修改 is_shared 状态
        if 'is_shared' in data and UserPermissionService.can_share_resource(current_user, provider):
            provider.is_shared = data['is_shared']
        
        provider.updated_at = datetime.utcnow()
        db.session.commit()
        
        return {
            'success': True,
            'message': '提供商更新成功',
            'data': {
                'id': provider.id,
                'name': provider.name,
                'type': provider.type,
                'base_url': provider.base_url,
                'status': provider.status,
                'updated_at': provider.updated_at.isoformat()
            }
        }
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新提供商失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'更新提供商失败: {str(e)}'
        })

@router.delete('/external-kb/providers/{provider_id}')
def delete_provider(provider_id, current_user=Depends(get_current_user)):
    """删除外部知识库提供商"""
    try:
        provider = ExternalKnowledgeProvider.query.get(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '供应商不存在'})
        
        # 检查删除权限
        if not UserPermissionService.can_delete_resource(current_user, provider):
            raise HTTPException(status_code=403, detail={'success': False, 'message': '无权限删除此提供商'})
        
        # 检查是否有关联的知识库
        kb_count = ExternalKnowledge.query.filter_by(provider_id=provider_id).count()
        if kb_count > 0:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': f'无法删除提供商，还有 {kb_count} 个关联的知识库'
            })
        
        db.session.delete(provider)
        db.session.commit()
        
        return {
            'success': True,
            'message': '提供商删除成功'
        }
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除提供商失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'删除提供商失败: {str(e)}'
        })

@router.post('/external-kb/providers/{provider_id}/test')
def test_provider_connection(provider_id, current_user=Depends(get_current_user)):
    """测试提供商连接"""
    try:
        provider = ExternalKnowledgeProvider.query.get(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '供应商不存在'})

        # 检查查看权限
        if not UserPermissionService.can_view_resource(current_user, provider):
            raise HTTPException(status_code=403, detail={'success': False, 'message': '无权限操作此提供商'})

        # 使用适配器工厂测试连接
        provider_config = {
            'base_url': provider.base_url,
            'api_key': provider.api_key,
            'config': provider.config or {}
        }

        result = AdapterFactory.test_adapter(provider.type, provider_config)

        return {
            'success': result['success'],
            'message': result['message'],
            'data': {
                'response_time': result['response_time'],
                'status': 'connected' if result['success'] else 'failed'
            }
        }

    except Exception as e:
        logger.error(f"测试提供商连接失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'测试连接失败: {str(e)}'
        })

# ==================== 外部知识库管理接口 ====================

@router.get('/external-kb/knowledges')
def get_external_knowledges(request: Request, current_user=Depends(get_current_user)):
    """获取所有外部知识库（通过提供商间接隔离）"""
    try:
        # 支持按提供商筛选
        provider_id_str = request.query_params.get('provider_id')
        provider_id = int(provider_id_str) if provider_id_str else None
        
        query = db.session.query(ExternalKnowledge, ExternalKnowledgeProvider).join(
            ExternalKnowledgeProvider, 
            ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
        ).filter(ExternalKnowledge.status == 'active')
        
        if provider_id:
            query = query.filter(ExternalKnowledge.provider_id == provider_id)
        
        results = query.all()
        
        # 过滤用户可见的提供商下的知识库
        data = []
        for knowledge, provider in results:
            if not UserPermissionService.can_view_resource(current_user, provider):
                continue
            # 统计角色关联数量
            role_count = RoleExternalKnowledge.query.filter_by(
                external_knowledge_id=knowledge.id
            ).count()
            
            data.append({
                'id': knowledge.id,
                'name': knowledge.name,
                'description': knowledge.description,
                'external_kb_id': knowledge.external_kb_id,
                'query_config': knowledge.query_config,
                'status': knowledge.status,
                'role_count': role_count,
                'provider': {
                    'id': provider.id,
                    'name': provider.name,
                    'type': provider.type
                },
                'created_at': knowledge.created_at.isoformat() if knowledge.created_at else None,
                'updated_at': knowledge.updated_at.isoformat() if knowledge.updated_at else None
            })
        
        return {
            'success': True,
            'data': data,
            'total': len(data)
        }

    except Exception as e:
        logger.error(f"获取外部知识库列表失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取外部知识库列表失败: {str(e)}'
        })

@router.post('/external-kb/knowledges')
async def create_external_knowledge(request: Request, current_user=Depends(get_current_user)):
    """创建外部知识库"""
    try:
        data = await request.json()

        # 验证必填字段
        required_fields = ['name', 'provider_id', 'external_kb_id']
        for field in required_fields:
            if not data.get(field):
                raise HTTPException(status_code=400, detail={
                    'success': False,
                    'message': f'缺少必填字段: {field}'
                })

        # 验证提供商是否存在且用户有权限
        provider = ExternalKnowledgeProvider.query.get(data['provider_id'])
        if not provider:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '指定的提供商不存在'
            })
        
        if not UserPermissionService.can_view_resource(current_user, provider):
            raise HTTPException(status_code=403, detail={
                'success': False,
                'message': '无权限使用此提供商'
            })

        # 检查名称是否重复
        existing = ExternalKnowledge.query.filter_by(name=data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '知识库名称已存在'
            })

        # 创建外部知识库
        knowledge = ExternalKnowledge(
            name=data['name'],
            description=data.get('description', ''),
            provider_id=data['provider_id'],
            external_kb_id=data['external_kb_id'],
            query_config=data.get('query_config', {
                'top_k': 5,
                'similarity_threshold': 0.7,
                'max_tokens': 4000
            }),
            status='active'
        )

        db.session.add(knowledge)
        db.session.commit()

        return {
            'success': True,
            'message': '外部知识库创建成功',
            'data': {
                'id': knowledge.id,
                'name': knowledge.name,
                'description': knowledge.description,
                'external_kb_id': knowledge.external_kb_id,
                'provider_id': knowledge.provider_id,
                'query_config': knowledge.query_config,
                'status': knowledge.status,
                'created_at': knowledge.created_at.isoformat()
            }
        }

    except IntegrityError:
        db.session.rollback()
        raise HTTPException(status_code=400, detail={
            'success': False,
            'message': '知识库名称已存在'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建外部知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'创建外部知识库失败: {str(e)}'
        })

@router.put('/external-kb/knowledges/{knowledge_id}')
async def update_external_knowledge(knowledge_id, request: Request, current_user=Depends(get_current_user)):
    """更新外部知识库"""
    try:
        knowledge = ExternalKnowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '外部知识库不存在'})
        
        # 检查提供商权限
        provider = ExternalKnowledgeProvider.query.get(knowledge.provider_id)
        if not UserPermissionService.can_edit_resource(current_user, provider):
            raise HTTPException(status_code=403, detail={'success': False, 'message': '无权限编辑此知识库'})
        
        data = await request.json()

        # 更新字段
        if 'name' in data:
            # 检查名称是否重复（排除自己）
            existing = ExternalKnowledge.query.filter(
                ExternalKnowledge.name == data['name'],
                ExternalKnowledge.id != knowledge_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail={
                    'success': False,
                    'message': '知识库名称已存在'
                })
            knowledge.name = data['name']

        if 'description' in data:
            knowledge.description = data['description']
        if 'provider_id' in data:
            knowledge.provider_id = data['provider_id']
        if 'external_kb_id' in data:
            knowledge.external_kb_id = data['external_kb_id']
        if 'query_config' in data:
            knowledge.query_config = data['query_config']
        if 'status' in data:
            knowledge.status = data['status']

        knowledge.updated_at = datetime.utcnow()
        db.session.commit()

        return {
            'success': True,
            'message': '外部知识库更新成功',
            'data': {
                'id': knowledge.id,
                'name': knowledge.name,
                'description': knowledge.description,
                'provider_id': knowledge.provider_id,
                'external_kb_id': knowledge.external_kb_id,
                'query_config': knowledge.query_config,
                'status': knowledge.status,
                'updated_at': knowledge.updated_at.isoformat(),
                'provider': {
                    'id': knowledge.provider.id,
                    'name': knowledge.provider.name,
                    'type': knowledge.provider.type
                }
            }
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"更新外部知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'更新外部知识库失败: {str(e)}'
        })

@router.delete('/external-kb/knowledges/{knowledge_id}')
def delete_external_knowledge(knowledge_id, current_user=Depends(get_current_user)):
    """删除外部知识库"""
    try:
        knowledge = ExternalKnowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '外部知识库不存在'})

        # 检查提供商权限
        provider = ExternalKnowledgeProvider.query.get(knowledge.provider_id)
        if not UserPermissionService.can_delete_resource(current_user, provider):
            raise HTTPException(status_code=403, detail={'success': False, 'message': '无权限删除此知识库'})

        # 检查是否有角色关联
        role_count = RoleExternalKnowledge.query.filter_by(external_knowledge_id=knowledge_id).count()
        if role_count > 0:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': f'无法删除知识库，还有 {role_count} 个角色关联'
            })

        db.session.delete(knowledge)
        db.session.commit()

        return {
            'success': True,
            'message': '外部知识库删除成功'
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"删除外部知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'删除外部知识库失败: {str(e)}'
        })

# ==================== 角色关联管理接口 ====================

@router.get('/roles/{role_id}/external-knowledges')
def get_role_external_knowledges(role_id):
    """获取角色绑定的外部知识库"""
    try:
        # 验证角色是否存在
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '角色不存在'})

        # 查询角色绑定的外部知识库
        query = db.session.query(
            RoleExternalKnowledge, ExternalKnowledge, ExternalKnowledgeProvider
        ).join(
            ExternalKnowledge,
            RoleExternalKnowledge.external_knowledge_id == ExternalKnowledge.id
        ).join(
            ExternalKnowledgeProvider,
            ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
        ).filter(RoleExternalKnowledge.role_id == role_id)

        results = query.all()

        data = []
        for binding, knowledge, provider in results:
            data.append({
                'id': binding.id,
                'role_id': binding.role_id,
                'external_knowledge_id': binding.external_knowledge_id,
                'config': binding.config,
                'knowledge': {
                    'id': knowledge.id,
                    'name': knowledge.name,
                    'description': knowledge.description,
                    'external_kb_id': knowledge.external_kb_id,
                    'query_config': knowledge.query_config,
                    'status': knowledge.status
                },
                'provider': {
                    'id': provider.id,
                    'name': provider.name,
                    'type': provider.type
                },
                'created_at': binding.created_at.isoformat() if binding.created_at else None
            })

        return {
            'success': True,
            'data': data,
            'total': len(data),
            'role': {
                'id': role.id,
                'name': role.name
            }
        }

    except Exception as e:
        logger.error(f"获取角色外部知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取角色外部知识库失败: {str(e)}'
        })

@router.post('/roles/{role_id}/external-knowledges/query')
async def query_role_external_knowledges(role_id, request: Request):
    """为角色查询外部知识库"""
    try:
        data = await request.json()
        query_text = data.get('query', '')
        query_params = data.get('params', {})

        if not query_text:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '查询文本不能为空'
            })

        # 验证角色是否存在
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '角色不存在'})

        # 使用服务查询
        result = ExternalKnowledgeService.query_knowledge_for_role(
            role_id, query_text, query_params
        )

        return result

    except Exception as e:
        logger.error(f"角色知识库查询失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'查询失败: {str(e)}'
        })

@router.post('/roles/{role_id}/external-knowledges/{knowledge_id}')
async def bind_role_external_knowledge(role_id, knowledge_id, request: Request):
    """为角色绑定外部知识库"""
    try:
        logger.info(f"开始绑定外部知识库: role_id={role_id}, knowledge_id={knowledge_id}")

        # 验证角色和知识库是否存在
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '角色不存在'})
        knowledge = ExternalKnowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '外部知识库不存在'})

        logger.info(f"角色和外部知识库验证成功: role={role.name}, knowledge={knowledge.name}")

        # 检查是否已经绑定
        existing = RoleExternalKnowledge.query.filter_by(
            role_id=role_id,
            external_knowledge_id=knowledge_id
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '该角色已绑定此外部知识库'
            })

        # 获取配置参数
        data = await request.json() or {}
        config = data.get('config', {})

        # 创建绑定关系
        binding = RoleExternalKnowledge(
            role_id=role_id,
            external_knowledge_id=knowledge_id,
            config=config
        )

        db.session.add(binding)
        db.session.commit()

        # 自动添加knowledge_access能力
        from app.services.knowledge_base.knowledge_capability_service import knowledge_capability_service
        capability_success, capability_msg = knowledge_capability_service.add_knowledge_access_capability(role_id)
        if capability_success:
            logger.info(f"自动添加knowledge_access能力: {capability_msg}")
        else:
            logger.warning(f"自动添加knowledge_access能力失败: {capability_msg}")

        return {
            'success': True,
            'message': '外部知识库绑定成功',
            'data': {
                'id': binding.id,
                'role_id': binding.role_id,
                'external_knowledge_id': binding.external_knowledge_id,
                'config': binding.config,
                'created_at': binding.created_at.isoformat()
            }
        }

    except IntegrityError:
        db.session.rollback()
        raise HTTPException(status_code=400, detail={
            'success': False,
            'message': '该角色已绑定此外部知识库'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"绑定角色外部知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'绑定失败: {str(e)}'
        })

@router.delete('/roles/{role_id}/external-knowledges/{knowledge_id}')
def unbind_role_external_knowledge(role_id, knowledge_id):
    """解除角色外部知识库绑定"""
    try:
        logger.info(f"开始解绑外部知识库: role_id={role_id}, knowledge_id={knowledge_id}")

        # 查找绑定关系
        binding = RoleExternalKnowledge.query.filter_by(
            role_id=role_id,
            external_knowledge_id=knowledge_id
        ).first()

        logger.info(f"查找绑定关系结果: binding={binding}")

        # 如果没找到，让我们查看这个角色的所有绑定关系
        if not binding:
            all_bindings = RoleExternalKnowledge.query.filter_by(role_id=role_id).all()
            logger.info(f"角色 {role_id} 的所有外部知识库绑定: {[(b.id, b.external_knowledge_id) for b in all_bindings]}")

            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '绑定关系不存在'
            })

        db.session.delete(binding)
        db.session.commit()

        logger.info(f"外部知识库解绑成功: role_id={role_id}, knowledge_id={knowledge_id}")

        # 检查角色是否还有其他知识库绑定，如果没有则移除knowledge_access能力
        capability_success, capability_msg = knowledge_capability_service.sync_knowledge_access_capability(role_id)
        if capability_success:
            logger.info(f"同步knowledge_access能力: {capability_msg}")
        else:
            logger.warning(f"同步knowledge_access能力失败: {capability_msg}")

        return {
            'success': True,
            'message': '外部知识库绑定解除成功'
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"解除角色外部知识库绑定失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'解除绑定失败: {str(e)}'
        })

# ==================== 新增适配器功能接口 ====================

@router.post('/external-kb/knowledges/{knowledge_id}/test')
def test_knowledge_connection(knowledge_id):
    """测试外部知识库连接"""
    try:
        result = ExternalKnowledgeService.test_knowledge_connection(knowledge_id)

        return {
            'success': result['success'],
            'message': result['message'],
            'data': {
                'response_time': result['response_time']
            }
        }

    except Exception as e:
        logger.error(f"测试知识库连接失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'测试连接失败: {str(e)}'
        })

@router.post('/external-kb/knowledges/{knowledge_id}/query')
async def query_external_knowledge(knowledge_id, request: Request):
    """查询外部知识库"""
    try:
        data = await request.json()
        query_text = data.get('query', '')
        query_params = data.get('params', {})

        if not query_text:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '查询文本不能为空'
            })

        # 获取知识库信息
        knowledge = ExternalKnowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '外部知识库不存在'})
        provider = ExternalKnowledgeProvider.query.get(knowledge.provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '供应商不存在'})

        # 创建适配器
        adapter = AdapterFactory.create_adapter(
            provider.type,
            {
                'base_url': provider.base_url,
                'api_key': provider.api_key,
                'config': provider.config or {}
            }
        )

        # 执行查询
        knowledge_config = {
            'external_kb_id': knowledge.external_kb_id,
            'query_config': knowledge.query_config or {}
        }

        result = adapter.query_knowledge(knowledge_config, query_text)

        # 记录查询日志
        log_entry = ExternalKnowledgeQueryLog(
            external_knowledge_id=knowledge_id,
            role_id=None,  # 直接查询没有角色信息
            query_text=query_text,
            response_data=result if result['success'] else None,
            query_time=result.get('query_time', 0),
            status='success' if result['success'] else 'error',
            error_message=result.get('error_message') if not result['success'] else None
        )

        db.session.add(log_entry)
        db.session.commit()

        return result

    except Exception as e:
        db.session.rollback()
        logger.error(f"查询外部知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'查询失败: {str(e)}'
        })

@router.get('/external-kb/knowledges/{knowledge_id}/info')
def get_external_knowledge_info(knowledge_id):
    """获取外部知识库详细信息"""
    try:
        result = ExternalKnowledgeService.get_knowledge_info(knowledge_id)

        if result['success']:
            return {
                'success': True,
                'data': result['info']
            }
        else:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': result['error_message']
            })

    except Exception as e:
        logger.error(f"获取知识库信息失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取信息失败: {str(e)}'
        })

@router.get('/external-kb/provider-types')
def get_provider_types():
    """获取支持的提供商类型"""
    try:
        supported_types = AdapterFactory.get_supported_types()

        return {
            'success': True,
            'data': supported_types
        }

    except Exception as e:
        logger.error(f"获取提供商类型失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取失败: {str(e)}'
        })

@router.get('/external-kb/provider-types/{provider_type}/config')
def get_provider_default_config(provider_type):
    """获取提供商默认配置"""
    try:
        default_config = AdapterFactory.get_default_config(provider_type)

        return {
            'success': True,
            'data': default_config
        }

    except Exception as e:
        logger.error(f"获取默认配置失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取失败: {str(e)}'
        })

