"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: base.py, config.py, documents.py, files.py, lightrag.py, roles.py, search.py, utils.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: base.py
# ============================================================

"""
知识库基础管理 - CRUD和文件管理
"""

import os
import json
from datetime import datetime
from werkzeug.utils import secure_filename
from sqlalchemy.exc import IntegrityError

from app.models import Knowledge, RoleKnowledge, SystemSetting, KnowledgeDocument, KnowledgeFileConversion, KnowledgeFileChunk, KnowledgeFileChunking, KnowledgeFileEmbedding, ChunkConfig, db
from app.services.user_permission_service import UserPermissionService
from app.services.knowledge_base.document_manager import (
    create_document_record,
    get_document_with_status,
    list_knowledge_documents,
    delete_document
)
from .knowledge_utils import (
    fix_url_encoding,
    allowed_file,
    safe_filename_with_unicode,
    get_knowledge_base_path,
    ensure_knowledge_base_dirs
)

# 创建Blueprint

@router.get('/knowledges')
def get_knowledges(current_user=Depends(get_current_user)):
    """获取所有内部知识库（已应用多租户权限过滤）"""
    try:
        # 获取当前用户
        # 应用权限过滤
        query = Knowledge.query
        query = UserPermissionService.filter_viewable_resources(query, Knowledge, current_user)
        knowledges = query.all()
        
        result = []
        for kb in knowledges:
            # 获取知识库统计信息
            kb_path = get_knowledge_base_path(kb.id)
            files_path = os.path.join(kb_path, 'files')
            
            document_count = 0
            total_size = 0
            
            if os.path.exists(files_path):
                for filename in os.listdir(files_path):
                    file_path = os.path.join(files_path, filename)
                    if os.path.isfile(file_path):
                        document_count += 1
                        total_size += os.path.getsize(file_path)
            
            # 格式化文件大小
            if total_size < 1024:
                size_str = f"{total_size} B"
            elif total_size < 1024 * 1024:
                size_str = f"{total_size / 1024:.1f} KB"
            else:
                size_str = f"{total_size / (1024 * 1024):.1f} MB"
            
            result.append({
                'id': kb.id,
                'name': kb.name,
                'description': kb.description,
                'type': kb.type,
                'kb_type': kb.kb_type,
                'lightrag_workspace': kb.lightrag_workspace,
                'lightrag_config': kb.lightrag_config,
                'status': 'active',  # 内部知识库默认为活跃状态
                'document_count': document_count,
                'size': size_str,
                'created_at': kb.created_at.isoformat() if kb.created_at else None,
                'updated_at': kb.updated_at.isoformat() if kb.updated_at else None,
                'settings': kb.settings or {},  # 包含检索配置等设置
                # 多租户字段
                'created_by': kb.created_by,
                'is_shared': kb.is_shared
            })
        
        return {
            'success': True,
            'data': result
        }
        
    except Exception as e:
        logger.error(f"获取知识库列表失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取知识库列表失败: {str(e)}'
        })

@router.post('/knowledges')
async def create_knowledge(request: Request, current_user=Depends(get_current_user)):
    """创建新的内部知识库"""
    try:
        # 获取当前用户
        data = await request.json()

        # 验证必填字段
        required_fields = ['name']
        for field in required_fields:
            if not data.get(field):
                raise HTTPException(status_code=400, detail={
                    'success': False,
                    'message': f'缺少必填字段: {field}'
                })

        # 配额检查
        from app.services.subscription_service import SubscriptionService
        quota_result = SubscriptionService.check_quota(current_user.id, 'knowledge_bases')
        if not quota_result['allowed']:
            raise HTTPException(status_code=403, detail={
                'success': False,
                'error': '已达到计划限额',
                'message': f'您的计划最多可创建 {quota_result["limit"]} 个知识库',
                'quota': quota_result
            })

        # 检查名称是否重复
        existing = Knowledge.query.filter_by(name=data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '知识库名称已存在'
            })

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

        # 创建知识库
        kb_type = data.get('kb_type', 'vector')
        
        knowledge = Knowledge(
            name=data['name'],
            description=data.get('description', ''),
            type='knowledge',  # 统一设置为knowledge类型
            content='',
            settings=data.get('settings', {}),
            # LightRAG 集成字段
            kb_type=kb_type,  # 默认 vector，可选 lightrag
            lightrag_workspace=data.get('lightrag_workspace'),  # LightRAG workspace，稍后设置
            lightrag_config=data.get('lightrag_config', {}),  # LightRAG 配置
            # 多租户字段
            created_by=created_by,
            is_shared=is_shared
        )
        
        db.session.add(knowledge)
        db.session.flush()  # 获取 knowledge.id
        
        # 如果是 LightRAG 类型且没有指定 workspace，自动使用 knowledge_id 作为 workspace
        if kb_type == 'lightrag' and not knowledge.lightrag_workspace:
            knowledge.lightrag_workspace = knowledge.id
        
        db.session.commit()
        
        # 创建文件存储目录
        ensure_knowledge_base_dirs(knowledge.id)
        
        # 创建元数据文件
        metadata = {
            'id': knowledge.id,
            'name': knowledge.name,
            'description': knowledge.description,
            'type': knowledge.type,
            'created_at': knowledge.created_at.isoformat(),
            'vector_config': {
                'embedding_model': None,
                'vector_db_provider': SystemSetting.get('vector_db_provider', 'aliyun'),
                'use_builtin_vector_db': SystemSetting.get('use_builtin_vector_db', True)
            },
            'statistics': {
                'document_count': 0,
                'total_chunks': 0,
                'total_vectors': 0
            }
        }
        
        metadata_path = os.path.join(get_knowledge_base_path(knowledge.id), 'metadata.json')
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        return {
            'success': True,
            'message': '知识库创建成功',
            'data': {
                'id': knowledge.id,
                'name': knowledge.name,
                'description': knowledge.description,
                'type': knowledge.type,
                'kb_type': knowledge.kb_type,
                'lightrag_workspace': knowledge.lightrag_workspace,
                'lightrag_config': knowledge.lightrag_config,
                'settings': knowledge.settings,
                'status': 'active',  # 内部知识库默认为活跃状态
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
        logger.error(f"创建知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'创建知识库失败: {str(e)}'
        })

@router.get('/knowledges/files')
def get_all_knowledge_files():
    """获取所有知识库中的文件列表（从 knowledge_documents 表查询）"""
    try:
        knowledges = Knowledge.query.all()
        all_files = []

        for knowledge in knowledges:
            # 使用新的文档管理服务获取文档列表
            files = list_knowledge_documents(knowledge.id)
            
            # 为每个文件添加 knowledge_id 和 knowledge_name
            for file_info in files:
                file_info['knowledge_id'] = knowledge.id
                file_info['knowledge_name'] = knowledge.name
                all_files.append(file_info)

        return {
            'success': True,
            'data': all_files
        }

    except Exception as e:
        logger.error(f"获取所有文件列表失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取所有文件列表失败: {str(e)}'
        })

@router.get('/knowledges/{knowledge_id}')
def get_knowledge(knowledge_id, current_user=Depends(get_current_user)):
    """获取知识库详情"""
    try:
        # 获取当前用户
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})

        # 检查查看权限
        if not UserPermissionService.can_view_resource(current_user, knowledge):
            raise HTTPException(status_code=403, detail={
                'success': False,
                'message': '无权限查看此知识库'
            })

        # 读取元数据
        metadata_path = os.path.join(get_knowledge_base_path(knowledge_id), 'metadata.json')
        metadata = {}
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

        return {
            'success': True,
            'data': {
                'id': knowledge.id,
                'name': knowledge.name,
                'description': knowledge.description,
                'type': knowledge.type,
                'kb_type': knowledge.kb_type,
                'lightrag_workspace': knowledge.lightrag_workspace,
                'lightrag_config': knowledge.lightrag_config,
                'status': 'active',  # 内部知识库默认为活跃状态
                'settings': knowledge.settings,
                'search_config': knowledge.get_search_config(),  # 知识库检索配置
                'created_at': knowledge.created_at.isoformat() if knowledge.created_at else None,
                'updated_at': knowledge.updated_at.isoformat() if knowledge.updated_at else None,
                'metadata': metadata,
                # 多租户字段
                'created_by': knowledge.created_by,
                'is_shared': knowledge.is_shared
            }
        }
        
    except Exception as e:
        logger.error(f"获取知识库详情失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取知识库详情失败: {str(e)}'
        })

@router.put('/knowledges/{knowledge_id}')
async def update_knowledge(knowledge_id, request: Request, current_user=Depends(get_current_user)):
    """更新知识库信息"""
    try:
        # 获取当前用户
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})

        # 检查编辑权限
        if not UserPermissionService.can_edit_resource(current_user, knowledge):
            raise HTTPException(status_code=403, detail={
                'success': False,
                'message': '无权限编辑此知识库'
            })

        data = await request.json()

        # 更新字段
        if 'name' in data:
            # 检查名称是否重复（排除自己）
            existing = Knowledge.query.filter(
                Knowledge.name == data['name'],
                Knowledge.id != knowledge_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail={
                    'success': False,
                    'message': '知识库名称已存在'
                })
            knowledge.name = data['name']

        if 'description' in data:
            knowledge.description = data['description']

        if 'settings' in data:
            knowledge.settings = data['settings']

        if 'search_config' in data:
            knowledge.search_config = data['search_config']

        # 只有创建者可以修改 is_shared 状态
        if 'is_shared' in data and UserPermissionService.can_share_resource(current_user, knowledge):
            knowledge.is_shared = data['is_shared']

        db.session.commit()
        
        # 更新元数据文件
        metadata_path = os.path.join(get_knowledge_base_path(knowledge_id), 'metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            metadata.update({
                'name': knowledge.name,
                'description': knowledge.description,
                'type': knowledge.type,
                'updated_at': datetime.utcnow().isoformat()
            })
            
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        return {
            'success': True,
            'message': '知识库更新成功',
            'data': {
                'id': knowledge.id,
                'name': knowledge.name,
                'description': knowledge.description,
                'type': knowledge.type,
                'updated_at': knowledge.updated_at.isoformat()
            }
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"更新知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'更新知识库失败: {str(e)}'
        })

@router.delete('/knowledges/{knowledge_id}')
def delete_knowledge(knowledge_id, current_user=Depends(get_current_user)):
    """删除知识库及其所有相关数据"""
    try:
        # 获取当前用户
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})

        # 检查删除权限
        if not UserPermissionService.can_delete_resource(current_user, knowledge):
            raise HTTPException(status_code=403, detail={
                'success': False,
                'message': '无权限删除此知识库'
            })

        logger.info(f"开始删除知识库及所有相关数据: {knowledge_id} - {knowledge.name}")

        # 1. 批量删除所有文件相关数据
        # 注意：直接批量删除比逐个调用 _delete_file_related_data 更高效
        conversions_deleted = KnowledgeFileConversion.query.filter_by(
            knowledge_id=knowledge_id
        ).delete()
        
        chunks_deleted = KnowledgeFileChunk.query.filter_by(
            knowledge_id=knowledge_id
        ).delete()
        
        # ⭐ 新增：删除分段元数据记录
        chunkings_deleted = KnowledgeFileChunking.query.filter_by(
            knowledge_id=knowledge_id
        ).delete()
        
        # ⭐ 新增：删除嵌入记录
        embeddings_deleted = KnowledgeFileEmbedding.query.filter_by(
            knowledge_id=knowledge_id
        ).delete()
        
        # ⭐ 新增：删除文档记录
        documents_deleted = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id
        ).delete()
        
        # ⭐ 新增：删除分段配置（避免外键约束错误）
        chunk_configs_deleted = ChunkConfig.query.filter_by(
            knowledge_id=knowledge_id
        ).delete()
        
        logger.info(
            f"批量删除完成: {documents_deleted} 个文档, {conversions_deleted} 个转换记录, "
            f"{chunks_deleted} 个分段, {chunkings_deleted} 个分段元数据, "
            f"{embeddings_deleted} 个嵌入记录, {chunk_configs_deleted} 个分段配置"
        )

        # 2. 删除向量数据库中的整个知识库（drop collection）
        vector_deleted = False
        try:
            from app.services.vector_db_service import get_vector_db_service, get_collection_name
            
            vector_db_service = get_vector_db_service()
            if vector_db_service.is_available():
                kb_name = get_collection_name(knowledge_id)
                logger.info(f"尝试删除向量数据库中的知识库: {kb_name}")
                # ⭐ 使用 drop_collection 删除整个 collection
                success, message, info = vector_db_service.drop_collection(kb_name)
                vector_deleted = success
                if success:
                    logger.info(f"向量数据库删除成功: {message}")
                else:
                    logger.warning(f"向量数据库删除失败: {message}")
        except Exception as e:
            logger.warning(f"删除向量数据库时出错: {e}")

        # 3. 删除关联的角色知识库关系
        role_relations_deleted = RoleKnowledge.query.filter_by(knowledge_id=knowledge_id).delete()
        logger.info(f"已删除 {role_relations_deleted} 个角色关联")

        # 4. 删除知识库记录
        db.session.delete(knowledge)
        db.session.commit()

        # 5. 删除物理文件存储目录
        import shutil
        kb_path = get_knowledge_base_path(knowledge_id)
        if os.path.exists(kb_path):
            shutil.rmtree(kb_path)
            logger.info(f"已删除知识库文件目录: {kb_path}")
        
        # 6. 删除markdown目录
        kb_markdown_path = os.path.join(
            settings['KNOWLEDGEBASE_PATH'],
            f"{knowledge_id}-markdown"
        )
        if os.path.exists(kb_markdown_path):
            shutil.rmtree(kb_markdown_path)
            logger.info(f"已删除Markdown目录: {kb_markdown_path}")

        logger.info(f"知识库删除成功: {knowledge_id}")

        return {
            'success': True,
            'message': '知识库及所有相关数据删除成功',
            'data': {
                'documents_deleted': documents_deleted,
                'conversions_deleted': conversions_deleted,
                'chunks_deleted': chunks_deleted,
                'chunkings_deleted': chunkings_deleted,
                'embeddings_deleted': embeddings_deleted,
                'chunk_configs_deleted': chunk_configs_deleted,
                'vector_deleted': vector_deleted,
                'role_relations_deleted': role_relations_deleted
            }
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"删除知识库失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'删除知识库失败: {str(e)}'
        })

# ==================== 文件管理接口 ====================

@router.get('/knowledges/{knowledge_id}/files')
def get_knowledge_files(knowledge_id):
    """获取知识库中的文件列表（从 knowledge_documents 表查询）"""
    try:
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        
        # 使用新的文档管理服务
        files = list_knowledge_documents(knowledge_id)
        
        return {
            'success': True,
            'data': files
        }

    except Exception as e:
        logger.error(f"获取文件列表失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取文件列表失败: {str(e)}'
        })

@router.post('/knowledges/{knowledge_id}/files')
async def upload_knowledge_file(knowledge_id, file: UploadFile = File(...), current_user=Depends(get_current_user)):
    """上传文件到知识库"""
    try:
        # 获取当前用户
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})

        # 检查编辑权限（上传文件需要编辑权限）
        if not UserPermissionService.can_edit_resource(current_user, knowledge):
            raise HTTPException(status_code=403, detail={
                'success': False,
                'message': '无权限上传文件到此知识库'
            })

        # file is injected via UploadFile parameter

        # 检查文件名
        if file.filename == '':
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '未选择文件'
            })

        # 检查文件类型 - 现在由前端控制，后端不再限制
        if not allowed_file(file.filename):
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '文件名格式无效，请确保文件有有效的扩展名'
            })

        # 确保目录存在
        kb_path = ensure_knowledge_base_dirs(knowledge_id)
        files_path = os.path.join(kb_path, 'files')

        # 生成支持中文的安全文件名
        filename = safe_filename_with_unicode(file.filename)

        # 如果文件已存在，添加时间戳
        if os.path.exists(os.path.join(files_path, filename)):
            name, ext = os.path.splitext(filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{name}_{timestamp}{ext}"

        # 保存文件
        file_path = os.path.join(files_path, filename)
        _content = await file.read()
        with open(file_path, 'wb') as f:
            f.write(_content)

        # ⭐ 创建 document 记录
        success, document, message = create_document_record(
            knowledge_id=knowledge_id,
            file_name=filename,
            file_path=filename,  # 相对路径（就是文件名）
            physical_path=file_path  # 物理路径
        )
        
        if not success:
            # 如果创建记录失败，删除已上传的文件
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"已删除上传失败的文件: {file_path}")
                except Exception as e:
                    logger.error(f"删除文件失败: {e}")
            
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': message
            })

        logger.info(f"文件上传成功: {filename}, document_id: {document.id}")

        # 检查是否为 LightRAG 类型知识库
        if knowledge.kb_type == 'lightrag' or (knowledge.settings and knowledge.settings.get('graph_enhancement', {}).get('enabled')):
            # LightRAG 类型：直接提交到 LightRAG
            logger.info(f"检测到 LightRAG 类型知识库，直接提交到 LightRAG: {filename}")
            try:
                from app.services.job_queue import job_manager
                
                job_id = job_manager.submit_job(
                    job_type='kb:lightrag_upload',
                    params={
                        'knowledge_id': knowledge_id,
                        'file_path': filename,
                        'workspace': knowledge_id
                    },
                    user_id=current_user.id,
                    priority='medium'
                )
                
                logger.info(f"LightRAG 上传任务已提交: job_id={job_id}")
                
                # 更新文档记录，关联 job_id
                document.lightrag_sync_job_id = job_id
                db.session.commit()
                
                return {
                    'success': True,
                    'message': '文件上传成功，正在提交到 LightRAG',
                    'data': get_document_with_status(document.id),
                    'job_id': job_id
                }
            except Exception as e:
                logger.error(f"提交 LightRAG 任务失败: {e}")
                # 即使提交失败，文件也已上传成功
                return {
                    'success': True,
                    'message': f'文件上传成功，但提交到 LightRAG 失败: {str(e)}',
                    'data': get_document_with_status(document.id)
                }
        
        # Vector 类型：返回文档信息（等待用户手动触发处理）
        return {
            'success': True,
            'message': '文件上传成功',
            'data': get_document_with_status(document.id)
        }

    except Exception as e:
        logger.error(f"文件上传失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'文件上传失败: {str(e)}'
        })

# ⭐ 已移除 _delete_file_related_data 函数
# 现在使用 document_manager.delete_document() 替代

@router.delete('/knowledges/{knowledge_id}/files/{filename}')
def delete_knowledge_file(knowledge_id, filename, current_user=Depends(get_current_user)):
    """删除知识库中的文件及其所有相关数据"""
    try:
        # 获取当前用户
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        
        # 检查编辑权限（删除文件需要编辑权限）
        if not UserPermissionService.can_edit_resource(current_user, knowledge):
            raise HTTPException(status_code=403, detail={
                'success': False,
                'message': '无权限删除此文件'
            })
        
        # 修复 URL 编码问题
        filename = fix_url_encoding(filename)
        
        # ⭐ 查找 document 记录
        document = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id,
            file_path=filename
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文件不存在'
            })
        
        # ⭐ 使用新的删除函数（会级联删除所有相关数据）
        success, message, info = delete_document(document.id)
        
        if success:
            return {
                'success': True,
                'message': message,
                'data': info
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'message': message
            })
        
    except Exception as e:
        logger.error(f"删除文件失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'删除文件失败: {str(e)}'
        })

@router.get('/knowledges/{knowledge_id}/files/{filename}/content')
def get_file_content(knowledge_id, filename):
    """获取文件内容（用于预览）"""
    try:
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})

        # 尝试直接使用文件名（支持中文）
        files_dir = os.path.join(get_knowledge_base_path(knowledge_id), 'files')
        file_path = os.path.join(files_dir, filename)

        # 如果文件不存在，尝试使用secure_filename处理后的文件名（向后兼容）
        if not os.path.exists(file_path):
            safe_filename = secure_filename(filename)
            file_path = os.path.join(files_dir, safe_filename)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文件不存在'
            })

        # 根据文件类型读取内容
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

        try:
            if ext in ['txt', 'md', 'json']:
                # 文本文件直接读取
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            else:
                # 其他文件类型暂时不支持预览
                content = f"文件类型 .{ext} 暂不支持预览"

            return {
                'success': True,
                'data': {
                    'filename': filename,
                    'content': content,
                    'type': ext
                }
            }

        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '文件编码不支持或文件已损坏'
            })

    except Exception as e:
        logger.error(f"获取文件内容失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取文件内容失败: {str(e)}'
        })



# ============================================================
# Source: config.py
# ============================================================

"""
知识库分段配置管理
"""


from app.models import Knowledge, ChunkConfig, db

# 创建Blueprint

# ==================== 分段配置 API ====================

@router.get('/knowledges/{knowledge_id}/chunk-config')
def get_chunk_config(knowledge_id):
    """
    获取知识库的分段配置
    
    Returns:
        配置信息
    """
    try:
        from app.services.knowledge_base.chunking.config import get_or_create_chunk_config
        
        # 验证知识库存在（不抛出404，而是返回友好错误）
        knowledge = Knowledge.query.filter_by(id=knowledge_id).first()
        if not knowledge:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': f'知识库 {knowledge_id} 不存在'
            })
        
        # 获取或创建配置
        config = get_or_create_chunk_config(knowledge_id)
        
        return {
            'success': True,
            'data': config.to_dict()
        }
        
    except Exception as e:
        logger.error(f"获取分段配置失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取配置失败: {str(e)}'
        })


@router.put('/knowledges/{knowledge_id}/chunk-config')
async def update_chunk_config_route(knowledge_id, request: Request):
    """
    更新知识库的分段配置
    
    Request Body:
        {
            "method": "recursive",
            "config": {
                "chunk_size": 512,
                "chunk_overlap": 128,
                ...
            }
        }
    
    Returns:
        更新后的配置
    """
    try:
        from app.services.knowledge_base.chunking.config import update_chunk_config
        from app.services.knowledge_base.chunking.chonkie_wrapper import ChonkieWrapper
        
        # 验证知识库存在
        knowledge = Knowledge.query.filter_by(id=knowledge_id).first()
        if not knowledge:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': f'知识库 {knowledge_id} 不存在'
            })
        
        data = await request.json()
        method = data.get('method')
        config = data.get('config', {})
        
        if not method:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '缺少 method 参数'
            })
        
        # 验证配置
        error = ChonkieWrapper.validate_config(method, config)
        if error:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': f'配置验证失败: {error}'
            })
        
        # 更新配置
        updated_config = update_chunk_config(knowledge_id, method, config)
        
        return {
            'success': True,
            'message': '分段配置已更新',
            'data': updated_config.to_dict()
        }
        
    except Exception as e:
        logger.error(f"更新分段配置失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'更新失败: {str(e)}'
        })


@router.get('/knowledges/chunk-config/defaults')
def get_default_configs_route():
    """
    获取所有分段方法的默认配置和元信息
    
    Returns:
        所有方法的列表和推荐方法
    """
    try:
        from app.services.knowledge_base.chunking.config import get_default_configs
        from app.services.knowledge_base.chunking.chonkie_wrapper import check_chonkie_availability
        
        methods = get_default_configs()
        availability = check_chonkie_availability()
        
        return {
            'success': True,
            'data': {
                'methods': methods,
                'recommended': 'recursive',
                'availability': availability
            }
        }
        
    except Exception as e:
        logger.error(f"获取默认配置失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取失败: {str(e)}'
        })



# ==================== 检索配置 API ====================

@router.get('/knowledges/{knowledge_id}/search-config')
def get_search_config(knowledge_id):
    """
    获取知识库的检索配置（根据 kb_type 返回对应配置）
    
    Returns:
        检索配置信息
    """
    try:
        knowledge = Knowledge.query.filter_by(id=knowledge_id).first()
        if not knowledge:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': f'知识库 {knowledge_id} 不存在'
            })
        
        kb_type = knowledge.kb_type or 'vector'
        
        if kb_type == 'lightrag':
            # LightRAG 类型知识库返回 LightRAG 检索配置
            search_config = knowledge.get_lightrag_search_config()
            search_config['kb_type'] = 'lightrag'
        else:
            # 向量类型知识库返回向量检索配置
            search_config = knowledge.get_search_config()
            search_config['kb_type'] = 'vector'
        
        return {
            'success': True,
            'data': search_config
        }
        
    except Exception as e:
        logger.error(f"获取检索配置失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取配置失败: {str(e)}'
        })


@router.put('/knowledges/{knowledge_id}/search-config')
async def update_search_config(knowledge_id, request: Request):
    """
    更新知识库的检索配置（根据 kb_type 更新对应配置）
    
    Request Body (向量知识库):
        {
            "search_mode": "hybrid",  // 'vector', 'bm25', 'hybrid'
            "top_k": 5,
            "vector_weight": 0.7
        }
    
    Request Body (LightRAG 知识库):
        {
            "query_mode": "hybrid",  // 'naive', 'local', 'global', 'hybrid', 'mix'
            "top_k": 10,
            "response_type": "Multiple Paragraphs"
        }
    
    Returns:
        更新后的配置
    """
    try:
        knowledge = Knowledge.query.filter_by(id=knowledge_id).first()
        if not knowledge:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': f'知识库 {knowledge_id} 不存在'
            })
        
        data = await request.json()
        kb_type = knowledge.kb_type or 'vector'
        
        if kb_type == 'lightrag':
            # 更新 LightRAG 检索配置
            if not knowledge.lightrag_config:
                knowledge.lightrag_config = {}
            
            # 更新 LightRAG 配置项
            if 'query_mode' in data:
                # 验证 query_mode 值
                valid_modes = ['naive', 'local', 'global', 'hybrid', 'mix']
                if data['query_mode'] not in valid_modes:
                    raise HTTPException(status_code=400, detail={
                        'success': False,
                        'message': f'无效的 query_mode，可选值: {valid_modes}'
                    })
                knowledge.lightrag_config['query_mode'] = data['query_mode']
            if 'top_k' in data:
                knowledge.lightrag_config['top_k'] = data['top_k']
            if 'response_type' in data:
                knowledge.lightrag_config['response_type'] = data['response_type']
            
            # 标记 JSON 字段已修改，确保 SQLAlchemy 检测到变化
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(knowledge, 'lightrag_config')
            
            db.session.commit()
            
            result_config = knowledge.get_lightrag_search_config()
            result_config['kb_type'] = 'lightrag'
        else:
            # 更新向量检索配置
            if not knowledge.search_config:
                knowledge.search_config = {}
            
            # 更新各个配置项
            if 'search_mode' in data:
                knowledge.search_config['search_mode'] = data['search_mode']
            if 'top_k' in data:
                knowledge.search_config['top_k'] = data['top_k']
            if 'vector_weight' in data:
                knowledge.search_config['vector_weight'] = data['vector_weight']
            if 'enable_reranker' in data:
                knowledge.search_config['enable_reranker'] = data['enable_reranker']
            if 'reranker_model_id' in data:
                knowledge.search_config['reranker_model_id'] = data['reranker_model_id']
            
            # 标记 JSON 字段已修改，确保 SQLAlchemy 检测到变化
            flag_modified(knowledge, 'search_config')
            
            db.session.commit()
            
            result_config = knowledge.get_search_config()
            result_config['kb_type'] = 'vector'
        
        return {
            'success': True,
            'message': '检索配置已更新',
            'data': result_config
        }
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新检索配置失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'更新失败: {str(e)}'
        })


# ==================== LightRAG 检索配置 API ====================

@router.get('/knowledges/lightrag-config/defaults')
def get_lightrag_default_config():
    """
    获取 LightRAG 检索配置的默认值和可选项
    
    Returns:
        LightRAG 配置的默认值和元信息
    """
    try:
        return {
            'success': True,
            'data': {
                'defaults': {
                    'query_mode': 'hybrid',
                    'top_k': 10,
                    'response_type': 'Multiple Paragraphs'
                },
                'options': {
                    'query_mode': [
                        {'value': 'naive', 'label': 'Naive', 'description': '简单检索，直接匹配'},
                        {'value': 'local', 'label': 'Local', 'description': '局部检索，基于实体邻域'},
                        {'value': 'global', 'label': 'Global', 'description': '全局检索，基于社区摘要'},
                        {'value': 'hybrid', 'label': 'Hybrid', 'description': '混合检索，结合局部和全局'},
                        {'value': 'mix', 'label': 'Mix', 'description': '混合模式，综合多种策略'}
                    ],
                    'response_type': [
                        {'value': 'Multiple Paragraphs', 'label': '多段落'},
                        {'value': 'Single Paragraph', 'label': '单段落'},
                        {'value': 'List', 'label': '列表形式'}
                    ]
                },
                'recommended': {
                    'query_mode': 'hybrid',
                    'description': '推荐使用 hybrid 模式，兼顾局部精确性和全局理解'
                }
            }
        }
        
    except Exception as e:
        logger.error(f"获取 LightRAG 默认配置失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取失败: {str(e)}'
        })


# ============================================================
# Source: documents.py
# ============================================================

"""
知识库文档处理流程 - 转换、分段、嵌入
"""


from app.models import Knowledge, KnowledgeDocument, KnowledgeFileConversion, KnowledgeFileChunk, KnowledgeFileChunking, KnowledgeFileEmbedding, Job, db
from .knowledge_utils import _replace_image_urls

# 创建Blueprint

@router.post('/knowledges/{knowledge_id}/documents/{document_id}/convert')
def convert_file(knowledge_id, document_id, current_user=Depends(get_current_user)):
    """
    转换知识库文件为 Markdown（任务队列版本）

    Args:
        knowledge_id: 知识库ID
        document_id: 文档ID

    Returns:
        任务ID和状态
    """
    try:
        # 通过 document_id 查询文档
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在'
            })
        
        file_path = document.file_path
        
        # 检查知识库是否存在
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '知识库不存在'
            })

        # 检查文件是否存在
        kb_path = os.path.join(settings['KNOWLEDGEBASE_PATH'], knowledge_id)
        files_path = os.path.join(kb_path, 'files')
        full_file_path = os.path.join(files_path, file_path)

        if not os.path.exists(full_file_path):
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文件不存在'
            })

        # 清理旧数据（如果重新转换）
        conversion = KnowledgeFileConversion.query.filter_by(
            document_id=document.id
        ).first()

        if conversion:
            # 清理旧的markdown文件
            if conversion.markdown_path:
                kb_markdown_path = os.path.join(
                    settings['KNOWLEDGEBASE_PATH'],
                    f"{knowledge_id}-markdown"
                )
                old_markdown_file = os.path.join(kb_markdown_path, conversion.markdown_path)
                if os.path.exists(old_markdown_file):
                    try:
                        os.remove(old_markdown_file)
                        logger.info(f"已删除旧的Markdown文件: {old_markdown_file}")
                    except Exception as e:
                        logger.error(f"删除旧Markdown文件失败: {e}")

            # 清理依赖的下游数据
            logger.info(f"重新转换，清理文档 {document.id} 的下游数据...")
            
            # 1. 删除旧的 chunks
            chunks_deleted = KnowledgeFileChunk.query.filter_by(
                document_id=document.id
            ).delete()
            logger.info(f"已删除 {chunks_deleted} 个旧分块")
            
            # 2. 删除旧的 embedding 记录
            embeddings_deleted = KnowledgeFileEmbedding.query.filter_by(
                document_id=document.id
            ).delete()
            logger.info(f"已删除 {embeddings_deleted} 个旧嵌入记录")
            
            # 3. 删除 Milvus 中的向量
            try:
                
                vector_db_service = get_vector_db_service()
                if vector_db_service.is_available():
                    kb_name = get_collection_name(knowledge_id)
                    success, message, info = vector_db_service.delete_by_metadata(
                        kb_name,
                        {'document_id': document.id}
                    )
                    if success:
                        logger.info(f"已删除旧向量数据: {message}")
                    else:
                        logger.warning(f"删除旧向量数据失败: {message}")
            except Exception as e:
                logger.warning(f"删除向量数据时出错: {e}")
            
            db.session.commit()

        # 使用新的后台任务队列系统
        
        job_id = job_manager.submit_job(
            job_type='kb:convert_file',
            params={
                'knowledge_id': knowledge_id,
                'file_path': file_path
            },
            user_id=current_user.id,
            priority='high'
        )
        
        logger.info(f"已提交转换任务: {job_id} for {file_path}")
        
        return {
            'success': True,
            'message': '转换任务已提交',
            'data': {
                'job_id': job_id,
                'status': 'pending'
            }
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"创建文件转换任务失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'创建转换任务失败: {str(e)}'
        })


@router.get('/knowledges/{knowledge_id}/documents/{document_id}/conversion-status')
def get_conversion_status(knowledge_id, document_id):
    """
    获取文件转换状态（向后兼容API，数据来自Job系统）
    
    Args:
        knowledge_id: 知识库ID
        document_id: 文档ID
    
    Returns:
        转换状态信息
    """
    try:
        # 查找文档
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在',
                'data': {'status': 'not_found'}
            })
        
        # 查找转换记录
        conversion = KnowledgeFileConversion.query.filter_by(
            document_id=document_id
        ).first()
        
        if not conversion or not conversion.job_id:
            return {
                'success': True,
                'data': {
                    'status': 'not_converted',
                    'message': '文件尚未转换'
                }
            }
        
        # 显式查询Job获取状态
        job = Job.query.get(conversion.job_id)
        if not job:
            return {
                'success': True,
                'data': {
                    'status': 'not_converted',
                    'message': 'Job记录不存在'
                }
            }
        
        # 映射Job状态到前端状态
        status_map = {
            'pending': 'converting',
            'running': 'converting',
            'completed': 'converted',
            'failed': 'conversion_failed',
            'cancelled': 'conversion_failed'
        }
        frontend_status = status_map.get(job.status, 'not_converted')
        
        # 从Job.data读取错误和时间信息
        error_message = job.data.get('error') if job.data else None
        started_at = job.data.get('started_at') if job.data else None
        completed_at = job.data.get('completed_at') if job.data else None
        
        return {
            'success': True,
            'data': {
                'conversion_id': conversion.id,
                'status': frontend_status,
                'db_status': job.status,
                'parser_tool': conversion.parser_tool,
                'markdown_path': conversion.markdown_path,
                'error_message': error_message,
                'started_at': started_at,
                'completed_at': completed_at
            }
        }
        
    except Exception as e:
        logger.error(f"获取转换状态失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取转换状态失败: {str(e)}'
        })


@router.get('/knowledges/{knowledge_id}/documents/{document_id}/markdown')
def get_markdown_content(knowledge_id, document_id):
    """
    获取转换后的 Markdown 内容（图片链接已替换为API URL）

    Args:
        knowledge_id: 知识库ID
        document_id: 文档ID

    Returns:
        Markdown 内容
    """
    try:
        # 查找文档记录
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在'
            })
        
        # 查找转换记录
        conversion = KnowledgeFileConversion.query.filter_by(
            document_id=document_id
        ).first()

        if not conversion or not conversion.job_id:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文件尚未转换'
            })
        
        # 显式查询Job检查状态
        job = Job.query.get(conversion.job_id)
        if not job or job.status != 'completed':
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文件尚未转换或转换失败'
            })

        # 读取 Markdown 文件
        kb_markdown_path = os.path.join(
            settings['KNOWLEDGEBASE_PATH'],
            f"{knowledge_id}-markdown"
        )
        markdown_file_path = os.path.join(kb_markdown_path, conversion.markdown_path)

        if not os.path.exists(markdown_file_path):
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': 'Markdown 文件不存在'
            })

        with open(markdown_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 替换图片链接为API URL
        content = _replace_image_urls(content, knowledge_id, conversion.markdown_path)

        return {
            'success': True,
            'data': {
                'content': content,
                'file_path': document.file_path,
                'markdown_path': conversion.markdown_path
            }
        }

    except Exception as e:
        logger.error(f"获取 Markdown 内容失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取内容失败: {str(e)}'
        })


# ==================== 文件分段相关接口 ====================

@router.post('/knowledges/{knowledge_id}/documents/{document_id}/chunk')
def chunk_file(knowledge_id, document_id, current_user=Depends(get_current_user)):
    """
    对转换后的Markdown文件进行分段（使用后台任务）
    
    Args:
        knowledge_id: 知识库ID
        document_id: 文档ID
    
    Returns:
        后台任务信息
    """
    try:
        # 获取当前用户
        # 通过 document_id 查询文档
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在'
            })
        
        file_path = document.file_path
        
        logger.info(f"提交分段任务: knowledge_id={knowledge_id}, file_path={file_path}")
        
        # 使用后台任务队列系统
        
        job_id = job_manager.submit_job(
            job_type='kb:chunk_file',
            params={
                'knowledge_id': knowledge_id,
                'file_path': file_path
            },
            user_id=current_user.id,
            priority='high'
        )
        
        logger.info(f"已提交分段任务: {job_id} for {file_path}")
        
        return {
            'success': True,
            'message': '分段任务已提交',
            'data': {
                'job_id': job_id,
                'status': 'pending'
            }
        }
        
    except Exception as e:
        logger.error(f"创建分段任务失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'创建分段任务失败: {str(e)}'
        })


@router.get('/knowledges/{knowledge_id}/documents/{document_id}/chunking-status')
def get_chunking_status(knowledge_id, document_id):
    """
    获取文件分段状态（基于Job系统，KISS原则）
    """
    try:
        from app.models import KnowledgeFileChunking, Job
        
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在',
                'data': {'status': 'not_found'}
            })
        
        # 查询分段记录
        chunking = KnowledgeFileChunking.query.filter_by(
            document_id=document_id
        ).first()
        
        if not chunking:
            # 无记录 = 未分段
            return {
                'success': True,
                'data': {
                    'status': 'not_chunked',
                    'chunk_count': 0,
                    'message': '文件尚未分段'
                }
            }
        
        # 查询Job状态
        if not chunking.job_id:
            return {
                'success': True,
                'data': {
                    'status': 'unknown',
                    'chunk_count': chunking.chunk_count,
                    'message': '分段记录异常：缺少Job ID'
                }
            }
        
        job = Job.query.get(chunking.job_id)
        if not job:
            return {
                'success': True,
                'data': {
                    'status': 'unknown',
                    'chunk_count': chunking.chunk_count,
                    'message': '找不到关联的Job记录'
                }
            }
        
        # 根据Job状态返回
        status_map = {
            'completed': ('chunked', f'已分段，共{chunking.chunk_count}个分块'),
            'failed': ('chunking_failed', job.data.get('error') or '分段失败'),
            'running': ('chunking', job.data.get('message') or '分段中...'),
            'pending': ('pending', '等待分段')
        }
        
        status, message = status_map.get(job.status, ('unknown', f'未知状态: {job.status}'))
        
        return {
            'success': True,
            'data': {
                'status': status,
                'chunk_count': chunking.chunk_count,
                'chunk_method': chunking.chunk_method,
                'message': message
            }
        }
        
    except Exception as e:
        logger.error(f"获取分段状态失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取分段状态失败: {str(e)}'
        })


@router.get('/knowledges/{knowledge_id}/documents/{document_id}/chunks')
def get_file_chunks(knowledge_id, document_id):
    """获取文件的所有分段"""
    try:
        # 查找文档记录
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在'
            })
        
        # 查询所有分段
        chunks = KnowledgeFileChunk.query.filter_by(
            document_id=document_id
        ).order_by(KnowledgeFileChunk.chunk_index).all()
        
        chunk_list = [
            {
                'id': chunk.id,
                'chunk_index': chunk.chunk_index,
                'content': chunk.content,
                'metadata': chunk.chunk_metadata
            }
            for chunk in chunks
        ]
        
        return {
            'success': True,
            'data': {
                'chunks': chunk_list,
                'total': len(chunk_list)
            }
        }
        
    except Exception as e:
        logger.error(f"获取文件分段失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取文件分段失败: {str(e)}'
        })


# ==================== 文件嵌入相关接口 ====================

@router.post('/knowledges/{knowledge_id}/documents/{document_id}/embed')
def embed_file(knowledge_id, document_id, current_user=Depends(get_current_user)):
    """
    对分段后的文件生成向量嵌入（使用后台任务）
    
    Args:
        knowledge_id: 知识库ID
        document_id: 文档ID
    
    Returns:
        后台任务信息
    """
    try:
        # 获取当前用户
        # 通过 document_id 查询文档
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在'
            })
        
        file_path = document.file_path
        
        logger.info(f"提交嵌入任务: knowledge_id={knowledge_id}, file_path={file_path}")
        
        # 使用后台任务队列系统
        
        job_id = job_manager.submit_job(
            job_type='kb:embed_file',
            params={
                'knowledge_id': knowledge_id,
                'file_path': file_path
            },
            user_id=current_user.id,
            priority='high'
        )
        
        logger.info(f"已提交嵌入任务: {job_id} for {file_path}")
        
        return {
            'success': True,
            'message': '嵌入任务已提交',
            'data': {
                'job_id': job_id,
                'status': 'pending'
            }
        }
        
    except Exception as e:
        logger.error(f"创建嵌入任务失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'创建嵌入任务失败: {str(e)}'
        })


@router.get('/knowledges/{knowledge_id}/documents/{document_id}/embedding-status')
def get_embedding_status(knowledge_id, document_id):
    """
    获取文件嵌入状态（向后兼容API，数据来自Job系统）
    
    Args:
        knowledge_id: 知识库ID
        document_id: 文档ID
    
    Returns:
        嵌入状态信息
    """
    try:
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            return {
                'success': True,
                'data': {
                    'status': 'not_embedded',
                    'message': '文件记录不存在'
                }
            }
        
        # 查找嵌入记录
        embedding = KnowledgeFileEmbedding.query.filter_by(
            document_id=document.id
        ).first()
        
        if not embedding or not embedding.job_id:
            return {
                'success': True,
                'data': {
                    'status': 'not_embedded',
                    'message': '文件尚未嵌入'
                }
            }
        
        # 显式查询Job获取状态
        job = Job.query.get(embedding.job_id)
        if not job:
            return {
                'success': True,
                'data': {
                    'status': 'not_embedded',
                    'message': 'Job记录不存在'
                }
            }
        
        # 映射Job状态到前端状态
        status_map = {
            'pending': 'embedding',
            'running': 'embedding',
            'completed': 'embedded',
            'failed': 'embedding_failed',
            'cancelled': 'embedding_failed'
        }
        frontend_status = status_map.get(job.status, 'not_embedded')
        
        # 从Job.data读取错误和时间信息
        error_message = job.data.get('error') if job.data else None
        started_at = job.data.get('started_at') if job.data else None
        completed_at = job.data.get('completed_at') if job.data else None
        
        return {
            'success': True,
            'data': {
                'embedding_id': embedding.id,
                'status': frontend_status,
                'db_status': job.status,
                'vector_count': embedding.vector_count,
                'vector_dimension': embedding.vector_dimension,
                'embedding_model': embedding.embedding_model,
                'error_message': error_message,
                'started_at': started_at,
                'completed_at': completed_at,
                'message': f'文件{frontend_status}'
            }
        }
        
    except Exception as e:
        logger.error(f"获取嵌入状态失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取嵌入状态失败: {str(e)}'
        })

# ==================== 文件处理（完整流程）相关接口 ====================

@router.post('/knowledges/{knowledge_id}/documents/{document_id}/process')
def process_file(knowledge_id, document_id, current_user=Depends(get_current_user)):
    """
    执行完整的文件处理流程（转换→分段→嵌入）
    使用Job系统提交3个后台任务
    
    Args:
        knowledge_id: 知识库ID
        document_id: 文档ID
    
    Returns:
        已提交的Job ID列表
    """
    try:
        # 获取当前用户
        # 检查编辑权限
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        if not UserPermissionService.can_edit_resource(current_user, knowledge):
            raise HTTPException(status_code=403, detail={
                'success': False,
                'message': '无权限处理此知识库的文件'
            })
        
        # 验证文档存在
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在'
            })
        
        logger.info(f"开始一键处理文档: {document_id} (使用Job Pipeline)")
        
        # 使用Job系统提交1个流水线任务（内部顺序执行：转换→分段→嵌入）
        from app.services.job_queue.job_manager import job_manager
        
        pipeline_job_id = job_manager.submit_job(
            job_type='kb:process_file_pipeline',
            params={
                'knowledge_id': knowledge_id,
                'file_path': document.file_path,
                'document_id': document_id,
                'file_name': document.file_name
            },
            user_id=current_user.id
        )
        
        logger.info(f"已提交Pipeline Job: {pipeline_job_id}")
        
        return {
            'success': True,
            'message': '文档处理流水线已启动（转换→分段→嵌入将依次执行）',
            'data': {
                'document_id': document_id,
                'job_id': pipeline_job_id
            }
        }
        
    except Exception as e:
        logger.error(f"处理文件失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'处理失败: {str(e)}'
        })


@router.post('/knowledges/{knowledge_id}/documents/{document_id}/copy-to-workspace')
async def copy_markdown_to_workspace(knowledge_id, document_id, request: Request):
    """
    复制转换后的 Markdown 文件到行动任务工作空间

    Args:
        knowledge_id: 知识库ID
        document_id: 文档ID
        
    Request Body:
        task_id: 目标行动任务ID
        target_path: 目标路径（可选，默认为根目录）

    Returns:
        复制结果
    """
    from app.models import ActionTask
    
    try:
        data = await request.json() or {}
        task_id = data.get('task_id')
        target_path = data.get('target_path', '')
        
        if not task_id:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请指定目标行动任务ID'
            })
        
        # 检查行动任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '行动任务不存在'
            })
        
        # 检查文档是否存在
        document = KnowledgeDocument.query.filter_by(
            id=document_id,
            knowledge_id=knowledge_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '文档不存在'
            })
        
        # 检查转换记录
        conversion = KnowledgeFileConversion.query.filter_by(
            document_id=document.id
        ).first()
        
        if not conversion or not conversion.markdown_path:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '文档尚未转换为Markdown'
            })
        
        # 检查Job状态
        job = Job.query.get(conversion.job_id)
        if not job or job.status != 'completed':
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '文档转换尚未完成'
            })
        
        # 构建源文件路径
        kb_markdown_path = os.path.join(
            settings['KNOWLEDGEBASE_PATH'],
            f"{knowledge_id}-markdown"
        )
        source_file = os.path.join(kb_markdown_path, conversion.markdown_path)
        
        if not os.path.exists(source_file):
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': 'Markdown文件不存在'
            })
        
        # 构建目标路径 - 使用 agent-workspace/ActionTask-xxx 格式
        # __file__ is app/api/routes/knowledge.py, go up 3 levels to get backend-fastapi/
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
        task_workspace = os.path.join(backend_dir, 'agent-workspace', f'ActionTask-{task_id}')
        
        # 确保工作空间目录存在
        os.makedirs(task_workspace, exist_ok=True)
        
        # 生成目标文件名
        file_name = document.file_name
        base_name = os.path.splitext(file_name)[0]
        target_filename = f"{base_name}.md"
        
        if target_path:
            target_dir = os.path.join(task_workspace, target_path)
            os.makedirs(target_dir, exist_ok=True)
            target_file = os.path.join(target_dir, target_filename)
        else:
            target_file = os.path.join(task_workspace, target_filename)
        
        # 复制文件
        shutil.copy2(source_file, target_file)
        
        # 计算相对路径用于返回
        relative_path = os.path.relpath(target_file, task_workspace)
        
        logger.info(f"已复制Markdown到工作空间: {source_file} -> {target_file}")
        
        return {
            'success': True,
            'message': '复制成功',
            'data': {
                'file_path': relative_path,
                'task_id': task_id
            }
        }
        
    except Exception as e:
        logger.error(f"复制Markdown到工作空间失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'复制失败: {str(e)}'
        })




# ============================================================
# Source: files.py
# ============================================================

"""
知识库向量化和静态文件访问
"""


from app.models import Knowledge, db
from .knowledge_utils import get_knowledge_base_path

# 创建Blueprint

@router.post('/knowledges/{knowledge_id}/vectorize')
def vectorize_knowledge(knowledge_id, current_user=Depends(get_current_user)):
    """对知识库进行向量化处理"""
    try:
        # 获取当前用户
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})

        # 检查编辑权限（向量化需要编辑权限）
        if not UserPermissionService.can_edit_resource(current_user, knowledge):
            raise HTTPException(status_code=403, detail={
                'success': False,
                'message': '无权限对此知识库进行向量化处理'
            })

        # 获取知识库文件目录
        kb_path = get_knowledge_base_path(knowledge_id)
        files_path = os.path.join(kb_path, 'files')

        if not os.path.exists(files_path):
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '知识库文件目录不存在'
            })

        # 处理所有文件
        from app.services.knowledge_base.document_processor import knowledge_processor
        processed_files = []
        failed_files = []

        for filename in os.listdir(files_path):
            file_path = os.path.join(files_path, filename)
            if os.path.isfile(file_path):
                try:
                    success, result = knowledge_processor.process_file_for_knowledge_base(
                        knowledge_id, file_path
                    )

                    if success:
                        # 保存处理结果
                        processed_path = os.path.join(kb_path, 'processed', f"{filename}.json")
                        with open(processed_path, 'w', encoding='utf-8') as f:
                            json.dump(result, f, ensure_ascii=False, indent=2)

                        processed_files.append({
                            'filename': filename,
                            'chunks': result.get('processing_summary', {}).get('total_chunks', 0),
                            'chars': result.get('processing_summary', {}).get('total_chars', 0)
                        })
                    else:
                        failed_files.append({
                            'filename': filename,
                            'error': result.get('error', '处理失败')
                        })

                except Exception as e:
                    failed_files.append({
                        'filename': filename,
                        'error': f'处理异常: {str(e)}'
                    })

        return {
            'success': True,
            'message': f'向量化处理完成，成功处理 {len(processed_files)} 个文件',
            'data': {
                'processed_files': processed_files,
                'failed_files': failed_files,
                'total_files': len(processed_files) + len(failed_files),
                'success_count': len(processed_files),
                'failed_count': len(failed_files)
            }
        }

    except Exception as e:
        logger.error(f"向量化处理失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'向量化处理失败: {str(e)}'
        })

# ==================== Markdown静态文件访问接口 ====================

@router.get('/knowledges/{knowledge_id}/markdown-files/{file_path:path}')
def get_markdown_file(knowledge_id, file_path):
    """访问Markdown目录下的静态文件（主要用于图片）"""
    
    kb_markdown_path = os.path.join(
        settings['KNOWLEDGEBASE_PATH'],
        f"{knowledge_id}-markdown"
    )
    # Flask内置的安全静态文件服务，自动处理MIME类型和路径安全检查
    import mimetypes
    full_path = os.path.join(kb_markdown_path, file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail={'success': False, 'message': '文件不存在'})
    from fastapi.responses import FileResponse
    return FileResponse(full_path)


# ============================================================
# Source: lightrag.py
# ============================================================

"""
知识库 LightRAG 集成 API 路由
"""
from app.models import Knowledge, KnowledgeDocument, db
from app.services.lightrag import LightRAGService, LightRAGConfigService



@router.post('/knowledge/{kb_id}/lightrag/upload')
async def upload_to_lightrag(kb_id, request: Request, current_user=Depends(get_current_user)):
    """
    上传文档到 LightRAG（提交异步任务）
    
    Request Body:
    {
        "file_path": "docs/manual.pdf",  # 单个文件
        "file_paths": ["doc1.pdf", "doc2.txt"],  # 或批量文件
        "workspace": "kb_123"  # 可选，默认使用 knowledge_id
    }
    
    Response:
    {
        "success": true,
        "job_id": "job_123",
        "message": "已提交 LightRAG 上传任务"
    }
    """
    try:
        data = await request.json()
        
        # 检查知识库是否存在
        knowledge = Knowledge.query.get(kb_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        
        # 检查 LightRAG 是否启用
        config = LightRAGConfigService.get_lightrag_config()
        if not config or not config.enabled:
            raise HTTPException(status_code=400, detail={'success': False, 'message': 'LightRAG 服务未启用'})
        
        workspace = data.get('workspace', kb_id)
        
        # 判断是单文件还是批量文件
        file_path = data.get('file_path')
        file_paths = data.get('file_paths')
        
        if file_path:
            # 单文件上传
            job_id = job_manager.submit_job(
                job_type='kb:lightrag_upload',
                params={
                    'knowledge_id': kb_id,
                    'file_path': file_path,
                    'workspace': workspace
                },
                user_id=current_user.id
            )
            message = f'已提交文档上传任务: {file_path}'
            
        elif file_paths and isinstance(file_paths, list):
            # 批量上传
            job_id = job_manager.submit_job(
                job_type='kb:lightrag_batch_upload',
                params={
                    'knowledge_id': kb_id,
                    'file_paths': file_paths,
                    'workspace': workspace
                },
                user_id=current_user.id
            )
            message = f'已提交批量上传任务: {len(file_paths)} 个文件'
            
        else:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请提供 file_path 或 file_paths 参数'
            })
        
        return {
            'success': True,
            'job_id': job_id,
            'message': message
        }
        
    except Exception as e:
        logger.error(f"提交 LightRAG 上传任务失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'提交任务失败: {str(e)}'
        })


@router.post('/knowledge/{kb_id}/lightrag/sync-all')
def sync_all_to_lightrag(kb_id, current_user=Depends(get_current_user)):
    """
    同步知识库的所有文档到 LightRAG（用于 Vector 类型的图谱增强）
    
    Response:
    {
        "success": true,
        "job_id": "job_123",
        "message": "已提交同步任务"
    }
    """
    try:
        # 检查知识库是否存在
        knowledge = Knowledge.query.get(kb_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        
        # 提交同步任务
        job_id = job_manager.submit_job(
            job_type='kb:lightrag_sync_all',
            params={
                'knowledge_id': kb_id
            },
            user_id=current_user.id
        )
        
        return {
            'success': True,
            'job_id': job_id,
            'message': '已提交同步任务'
        }
        
    except Exception as e:
        logger.error(f"提交同步任务失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'提交任务失败: {str(e)}'
        })


@router.post('/knowledge/{kb_id}/lightrag/query')
async def query_lightrag(kb_id, request: Request):
    """
    查询 LightRAG 知识库（同步调用）
    
    Request Body:
    {
        "query": "什么是机器学习？",
        "mode": "hybrid",  # naive/local/global/hybrid/mix
        "top_k": 10,
        "response_type": "Multiple Paragraphs"
    }
    
    Response:
    {
        "success": true,
        "data": {
            "query": "什么是机器学习？",
            "result": "...",
            "response_time": 1.23,
            "query_params": {...}
        }
    }
    """
    try:
        data = await request.json()
        
        # 检查知识库是否存在
        knowledge = Knowledge.query.get(kb_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        
        # 检查 LightRAG 是否启用
        config = LightRAGConfigService.get_lightrag_config()
        if not config or not config.enabled:
            raise HTTPException(status_code=400, detail={'success': False, 'message': 'LightRAG 服务未启用'})
        
        query = data.get('query', '')
        if not query:
            raise HTTPException(status_code=400, detail={'success': False, 'message': '查询内容不能为空'})
        
        # 获取查询参数
        workspace = knowledge.lightrag_workspace or kb_id
        mode = data.get('mode')
        
        # 如果没有指定 mode，使用知识库配置的默认值
        if not mode and knowledge.lightrag_config:
            mode = knowledge.lightrag_config.get('default_query_mode', 'mix')
        if not mode:
            mode = 'mix'
        
        top_k = data.get('top_k', 10)
        response_type = data.get('response_type', 'Multiple Paragraphs')
        
        # 获取 LightRAG 服务
        service_url = LightRAGConfigService.DEFAULT_SERVICE_URL
        if config.framework_config:
            service_url = config.framework_config.get('service_url', service_url)
        
        service = LightRAGService(service_url)
        
        # 执行查询
        start_time = datetime.now()
        
        success, result = service.query(
            query=query,
            workspace=workspace,
            mode=mode,
            top_k=top_k,
            response_type=response_type
        )
        
        end_time = datetime.now()
        response_time = (end_time - start_time).total_seconds()
        
        if success:
            return {
                'success': True,
                'data': {
                    'query': query,
                    'result': result,
                    'response_time': response_time,
                    'query_params': {
                        'mode': mode,
                        'top_k': top_k,
                        'workspace': workspace
                    }
                }
            }
        else:
            # 返回实际的错误信息，不包装成 500
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': result
            })
            
    except Exception as e:
        logger.error(f"LightRAG 查询失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'查询失败: {str(e)}'
        })


@router.get('/knowledge/{kb_id}/lightrag/documents')
def get_lightrag_documents(kb_id):
    """
    获取 LightRAG 知识库的文档列表（从本地数据库 + LightRAG 状态）
    
    Response:
    {
        "success": true,
        "data": {
            "documents": [
                {
                    "id": "doc_123",
                    "name": "file.pdf",
                    "lightrag_synced": true,
                    "lightrag_workspace": "kb_123",
                    "lightrag_status": "COMPLETED",
                    "created_at": "2024-01-01T00:00:00"
                }
            ]
        }
    }
    """
    try:
        # 检查知识库是否存在
        knowledge = Knowledge.query.get(kb_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        
        # 从本地数据库获取文档列表
        from app.services.knowledge_base.document_manager import list_knowledge_documents
        
        documents = list_knowledge_documents(kb_id)
        
        # 获取 LightRAG 服务
        workspace = knowledge.lightrag_workspace or kb_id
        config = LightRAGConfigService.get_lightrag_config()
        service_url = LightRAGConfigService.DEFAULT_SERVICE_URL
        if config and config.framework_config:
            service_url = config.framework_config.get('service_url', service_url)
        
        service = LightRAGService(service_url)
        
        # 尝试获取 LightRAG 文档状态（如果失败则使用本地状态）
        lightrag_status_map = {}
        try:
            # 调用 LightRAG API 获取文档状态
            lightrag_docs_raw = service.get_documents(workspace)
            logger.info(f"LightRAG 返回数据: {lightrag_docs_raw}")
            
            # LightRAG API 返回格式: {"statuses": {"processed": [...], "failed": [...], ...}}
            # 按 file_path 建立状态映射
            if lightrag_docs_raw and isinstance(lightrag_docs_raw, dict):
                statuses = lightrag_docs_raw.get('statuses', {})
                
                for status_key, docs_list in statuses.items():
                    # 统一转为大写状态
                    status_value = status_key.upper()
                    for doc in docs_list:
                        file_path = doc.get('file_path', '')
                        if file_path:
                            lightrag_status_map[file_path] = status_value
                        
                logger.info(f"LightRAG 状态映射: {lightrag_status_map}")
        except Exception as e:
            logger.warning(f"获取 LightRAG 文档状态失败，使用本地状态: {e}")
        
        # 过滤出已同步到 LightRAG 的文档（只显示已成功同步的）
        lightrag_docs = []
        for doc in documents:
            if doc.get('lightrag_synced') == 1:  # 只显示已成功同步的文档
                file_name = doc.get('file_name', '')
                
                # 通过 file_path (文件名) 获取 LightRAG 状态
                lightrag_status = lightrag_status_map.get(file_name, 'UNKNOWN')
                
                lightrag_docs.append({
                    'id': doc['id'],
                    'name': file_name,
                    'file_path': doc.get('path', ''),
                    'lightrag_synced': bool(doc.get('lightrag_synced')),
                    'lightrag_workspace': doc.get('lightrag_workspace') or kb_id,
                    'lightrag_sync_job_id': doc.get('lightrag_sync_job_id'),
                    'lightrag_status': lightrag_status,
                    'created_at': doc.get('created_at'),
                    'status': doc.get('status', 'unknown')
                })
        
        return {
            'success': True,
            'data': {
                'documents': lightrag_docs
            }
        }
        
    except Exception as e:
        logger.error(f"获取 LightRAG 文档列表失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取文档列表失败: {str(e)}'
        })


@router.delete('/knowledge/{kb_id}/lightrag/documents/{document_id}')
def delete_lightrag_document(kb_id, document_id):
    """
    删除 LightRAG 文档
    
    Response:
    {
        "success": true,
        "message": "文档删除成功"
    }
    """
    try:
        # 检查知识库是否存在
        knowledge = Knowledge.query.get(kb_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        
        # 查找本地文档记录
        document = KnowledgeDocument.query.get(document_id)
        if not document:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '文档不存在'})
        
        # 计算 LightRAG doc_id（基于文件名的 hash）
        import hashlib
        file_name = document.file_name
        lightrag_doc_id = f"doc-{hashlib.md5(file_name.encode()).hexdigest()}"
        
        # 获取 workspace
        workspace = knowledge.lightrag_workspace or kb_id
        
        # 获取 LightRAG 服务
        config = LightRAGConfigService.get_lightrag_config()
        service_url = LightRAGConfigService.DEFAULT_SERVICE_URL
        if config and config.framework_config:
            service_url = config.framework_config.get('service_url', service_url)
        
        service = LightRAGService(service_url)
        
        # 使用 LightRAG doc_id 删除
        success, message = service.delete_document(lightrag_doc_id, workspace)
        
        if not success:
            logger.warning(f"从 LightRAG 删除文档失败（可能文档不存在）: {message}")
        
        # 无论 LightRAG 删除是否成功，都删除本地记录
        # 原因：
        # 1. LightRAG 删除成功 → 本地也应该删除
        # 2. LightRAG 返回 404 → 说明文档已经不存在，本地也应该删除
        # 3. LightRAG 其他错误 → 本地删除后用户可以重新上传
        
        # 1. 删除本地文件
        from app.api.routes.knowledge.utils import get_knowledge_base_path
        kb_path = get_knowledge_base_path(kb_id)
        full_path = os.path.join(kb_path, 'files', document.file_path)
        
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                logger.info(f"已删除本地文件: {full_path}")
            except Exception as e:
                logger.warning(f"删除本地文件失败: {e}")
        
        # 2. 删除数据库记录
        db.session.delete(document)
        db.session.commit()
        
        return {
            'success': True,
            'message': '文档删除成功'
        }
            
    except Exception as e:
        logger.error(f"删除 LightRAG 文档失败: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'删除文档失败: {str(e)}'
        })


@router.get('/knowledge/{kb_id}/lightrag/graph')
def get_lightrag_graph(kb_id, request: Request):
    """
    获取知识图谱数据（用于可视化）
    
    Query Params:
    - limit: 返回节点数量限制（默认 100）
    
    Response:
    {
        "success": true,
        "data": {
            "nodes": [...],
            "edges": [...]
        }
    }
    """
    try:
        # 检查知识库是否存在
        knowledge = Knowledge.query.get(kb_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        
        # 获取 workspace
        workspace = knowledge.lightrag_workspace or kb_id
        limit = int(request.query_params.get('limit', 100))
        
        # 获取 LightRAG 服务
        config = LightRAGConfigService.get_lightrag_config()
        service_url = LightRAGConfigService.DEFAULT_SERVICE_URL
        if config and config.framework_config:
            service_url = config.framework_config.get('service_url', service_url)
        
        service = LightRAGService(service_url)
        success, data = service.get_graph_data(workspace, limit)
        
        if success:
            return {
                'success': True,
                'data': data
            }
        else:
            raise HTTPException(status_code=500, detail={
                'success': False,
                'message': data
            })
            
    except Exception as e:
        logger.error(f"获取知识图谱数据失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取图谱数据失败: {str(e)}'
        })


# ============================================================
# Source: roles.py
# ============================================================

"""
知识库角色绑定管理
"""


from app.models import Knowledge, Role, RoleKnowledge, db

# 创建Blueprint

@router.get('/roles/{role_id}/knowledges')
def get_role_knowledges(role_id):
    """获取角色绑定的内部知识库"""
    try:
        # 验证角色是否存在
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '角色不存在'})

        # 查询角色绑定的内部知识库
        query = db.session.query(
            RoleKnowledge, Knowledge
        ).join(
            Knowledge,
            RoleKnowledge.knowledge_id == Knowledge.id
        ).filter(RoleKnowledge.role_id == role_id)

        results = query.all()

        data = []
        for role_knowledge, knowledge in results:
            data.append({
                'id': knowledge.id,
                'name': knowledge.name,
                'description': knowledge.description,
                'type': knowledge.type,
                'status': 'active',  # 内部知识库默认为活跃状态
                'created_at': knowledge.created_at.isoformat() if knowledge.created_at else None,
                'updated_at': knowledge.updated_at.isoformat() if knowledge.updated_at else None,
                'binding_created_at': role_knowledge.created_at.isoformat() if role_knowledge.created_at else None
            })

        return {
            'success': True,
            'data': data,
            'total': len(data)
        }

    except Exception as e:
        logger.error(f"获取角色内部知识库绑定失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'获取绑定失败: {str(e)}'
        })

@router.post('/roles/{role_id}/knowledges/{knowledge_id}')
def bind_role_knowledge(role_id, knowledge_id):
    """为角色绑定内部知识库"""
    try:
        logger.info(f"开始绑定内部知识库: role_id={role_id}, knowledge_id={knowledge_id}")

        # 验证角色和知识库是否存在
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '角色不存在'})
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})

        logger.info(f"角色和知识库验证成功: role={role.name}, knowledge={knowledge.name}")

        # 检查是否已经绑定
        existing = RoleKnowledge.query.filter_by(
            role_id=role_id,
            knowledge_id=knowledge_id
        ).first()

        if existing:
            logger.warning(f"角色已绑定此内部知识库: role_id={role_id}, knowledge_id={knowledge_id}")
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '该角色已绑定此内部知识库'
            })

        # 创建绑定关系
        binding = RoleKnowledge(
            role_id=role_id,
            knowledge_id=knowledge_id
        )

        db.session.add(binding)
        db.session.commit()

        logger.info(f"内部知识库绑定成功: binding_id={binding.id}")

        # 自动添加knowledge_access能力
        from app.services.knowledge_base.knowledge_capability_service import knowledge_capability_service
        capability_success, capability_msg = knowledge_capability_service.add_knowledge_access_capability(role_id)
        if capability_success:
            logger.info(f"自动添加knowledge_access能力: {capability_msg}")
        else:
            logger.warning(f"自动添加knowledge_access能力失败: {capability_msg}")

        return {
            'success': True,
            'message': '内部知识库绑定成功',
            'data': {
                'id': binding.id,
                'role_id': binding.role_id,
                'knowledge_id': binding.knowledge_id,
                'created_at': binding.created_at.isoformat()
            }
        }

    except IntegrityError:
        db.session.rollback()
        raise HTTPException(status_code=400, detail={
            'success': False,
            'message': '该角色已绑定此内部知识库'
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"绑定角色内部知识库失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'绑定失败: {str(e)}'
        })

@router.delete('/roles/{role_id}/knowledges/{knowledge_id}')
def unbind_role_knowledge(role_id, knowledge_id):
    """解除角色内部知识库绑定"""
    try:
        # 查找绑定关系
        binding = RoleKnowledge.query.filter_by(
            role_id=role_id,
            knowledge_id=knowledge_id
        ).first()

        if not binding:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'message': '绑定关系不存在'
            })

        db.session.delete(binding)
        db.session.commit()

        # 检查角色是否还有其他知识库绑定，如果没有则移除knowledge_access能力
        capability_success, capability_msg = knowledge_capability_service.sync_knowledge_access_capability(role_id)
        if capability_success:
            logger.info(f"同步knowledge_access能力: {capability_msg}")
        else:
            logger.warning(f"同步knowledge_access能力失败: {capability_msg}")

        return {
            'success': True,
            'message': '内部知识库绑定解除成功'
        }

    except Exception as e:
        db.session.rollback()
        logger.error(f"解除角色内部知识库绑定失败: {e}")
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'解除绑定失败: {str(e)}'
        })


# ==================== 文件转换、分段、嵌入相关接口 ====================


# ============================================================
# Source: search.py
# ============================================================

"""
知识库搜索功能
"""



# 创建Blueprint

@router.post('/knowledges/{knowledge_id}/search')
async def search_knowledge(knowledge_id, request: Request):
    """搜索知识库内容（支持混合检索）"""
    try:
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise HTTPException(status_code=404, detail={'success': False, 'message': '知识库不存在'})
        data = await request.json()

        query = data.get('query', '')
        if not query:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '查询内容不能为空'
            })

        # 使用知识库查询服务（支持混合检索）
        from app.services.knowledge_base.knowledge_query_service import KnowledgeQueryService
        from app.services.vector_db_service import get_vector_db_service
        
        score_threshold = data.get('score_threshold', 0.0)
        
        vector_db_service = get_vector_db_service()
        
        if vector_db_service.is_available():
            # 使用混合检索服务（top_k从知识库配置中读取）
            search_results = KnowledgeQueryService._search_single_knowledge(
                knowledge, query, score_threshold, vector_db_service
            )
            
            success = True

            if success:
                # search_results 已经是格式化好的结果列表
                # 记录过滤后的结果数量
                logger.info(
                    f"搜索返回 {len(search_results)} 条结果, "
                    f"score_threshold={score_threshold}"
                )
                
                # 获取检索配置信息
                search_config = knowledge.get_search_config()
                search_info = {
                    'search_mode': search_config.get('search_mode', 'hybrid'),
                    'bm25_k1': search_config.get('bm25_k1', 1.5),
                    'bm25_b': search_config.get('bm25_b', 0.75),
                    'rrf_k': search_config.get('rrf_k', 60)
                }
                
                return {
                    'success': True,
                    'data': {
                        'query': query,
                        'results': search_results,
                        'total_count': len(search_results),
                        'search_info': search_info
                    }
                }
            else:
                raise HTTPException(status_code=500, detail={
                    'success': False,
                    'message': '搜索失败'
                })
        else:
            # 向量数据库不可用，返回提示
            raise HTTPException(status_code=503, detail={
                'success': False,
                'message': '向量搜索服务不可用，请检查向量数据库配置'
            })

    except Exception as e:
        logger.error(f"搜索知识库失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            'success': False,
            'message': f'搜索知识库失败: {str(e)}'
        })


