"""
知识库文件管理服务

统一管理文件的创建、查询、删除等操作
"""

import os
import logging
import hashlib
from datetime import datetime
from typing import Tuple, Dict, Any, Optional, List
from core.config import settings

logger = logging.getLogger(__name__)

from app.models import (
    KnowledgeDocument, KnowledgeFileConversion, 
    KnowledgeFileChunk, KnowledgeFileEmbedding,
    db
)


def calculate_file_hash(file_path: str) -> Optional[str]:
    """
    计算文件的 SHA256 hash
    
    Args:
        file_path: 文件路径
        
    Returns:
        文件的 SHA256 hash，失败返回 None
    """
    try:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception as e:
        logger.error(f"计算文件hash失败: {file_path}, 错误: {e}")
        return None


def create_document_record(
    knowledge_id: str,
    file_name: str,
    file_path: str,
    physical_path: str
) -> Tuple[bool, Any, str]:
    """
    创建文档记录
    
    Args:
        knowledge_id: 知识库ID
        file_name: 文件名
        file_path: 文件相对路径（相对于知识库目录）
        physical_path: 文件物理路径
        
    Returns:
        (success, document, message)
    """
    try:
        import uuid
        
        # 检查文件是否已存在（按路径）
        existing = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id,
            file_path=file_path
        ).first()
        
        if existing:
            return False, None, f"文件已存在: {file_path}"
        
        # 计算文件hash和大小
        file_hash = calculate_file_hash(physical_path)
        file_size = os.path.getsize(physical_path)
        
        # 对于 LightRAG 类型知识库，跳过内容去重检查
        # 因为 LightRAG 可能需要重新上传相同内容的文件
        from app.models import Knowledge
        knowledge = Knowledge.query.get(knowledge_id)
        
        if knowledge and knowledge.kb_type != 'lightrag':
            # 只对 Vector 类型知识库进行内容去重
            if file_hash:
                duplicate = KnowledgeDocument.query.filter_by(
                    knowledge_id=knowledge_id,
                    file_hash=file_hash
                ).first()
                
                if duplicate:
                    return False, None, f"文件内容重复（与 {duplicate.file_name} 相同）"
        
        # 创建document记录
        document = KnowledgeDocument(
            id=str(uuid.uuid4()),
            knowledge_id=knowledge_id,
            file_name=file_name,
            file_path=file_path,
            file_hash=file_hash,
            file_size=file_size,
            status='uploaded'  # 初始状态：已上传
        )
        
        db.session.add(document)
        db.session.commit()
        
        logger.info(f"创建文档记录成功: {knowledge_id}/{file_path}")
        
        return True, document, "创建成功"
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建文档记录失败: {e}")
        return False, None, f"创建失败: {str(e)}"


def get_document_with_status(document_id: str) -> Optional[Dict[str, Any]]:
    """
    获取文档及其所有状态信息（从Job系统读取状态）
    
    Args:
        document_id: 文档ID
        
    Returns:
        包含文档和状态信息的字典，未找到返回 None
    """
    try:
        from app.models import Job
        
        document = KnowledgeDocument.query.get(document_id)
        if not document:
            return None
        
        # 查询转换记录和Job状态
        conversion = KnowledgeFileConversion.query.filter_by(
            document_id=document_id
        ).first()
        
        if conversion and conversion.job_id:
            # 通过job_id查询Job状态
            job = Job.query.get(conversion.job_id)
            if job:
                if job.status == 'pending' or job.status == 'running':
                    conversion_status = 'converting'
                elif job.status == 'completed':
                    conversion_status = 'converted'
                elif job.status == 'failed':
                    conversion_status = 'conversion_failed'
                else:
                    conversion_status = 'not_converted'
            else:
                conversion_status = 'not_converted'
        else:
            conversion_status = 'not_converted'
        
        # 查询分块状态（分块是同步的，通过chunk数量判断）
        chunk_count = KnowledgeFileChunk.query.filter_by(
            document_id=document_id
        ).count()
        
        chunking_status = 'chunked' if chunk_count > 0 else 'not_chunked'
        
        # 查询嵌入记录和Job状态
        embedding = KnowledgeFileEmbedding.query.filter_by(
            document_id=document_id
        ).first()
        
        if embedding and embedding.job_id:
            # 通过job_id查询Job状态
            job = Job.query.get(embedding.job_id)
            if job:
                if job.status == 'pending' or job.status == 'running':
                    embedding_status = 'embedding'
                elif job.status == 'completed':
                    embedding_status = 'embedded'
                elif job.status == 'failed':
                    embedding_status = 'embedding_failed'
                else:
                    embedding_status = 'not_embedded'
            else:
                embedding_status = 'not_embedded'
        else:
            embedding_status = 'not_embedded'
        
        # 格式化文件大小
        size = document.file_size or 0
        if size < 1024:
            size_str = f"{size} B"
        elif size < 1024 * 1024:
            size_str = f"{size / 1024:.1f} KB"
        else:
            size_str = f"{size / (1024 * 1024):.1f} MB"
        
        # 获取文件类型
        ext = document.file_name.rsplit('.', 1)[1].lower() if '.' in document.file_name else ''
        
        return {
            'id': document.id,
            'file_name': document.file_name,
            'name': document.file_name,
            'path': document.file_path,
            'type': ext,
            'size': size_str,
            'size_bytes': document.file_size,
            'hash': document.file_hash,
            'status': document.status,
            'upload_time': document.created_at.isoformat() if document.created_at else None,
            'created_at': document.created_at.isoformat() if document.created_at else None,
            'chunks': chunk_count,
            'conversion_status': conversion_status,
            'chunking_status': chunking_status,
            'embedding_status': embedding_status,
            'vector_count': embedding.vector_count if embedding else 0,
            'vector_dimension': embedding.vector_dimension if embedding else 0,
            'lightrag_synced': document.lightrag_synced,
            'lightrag_workspace': document.lightrag_workspace,
            'lightrag_sync_job_id': document.lightrag_sync_job_id
        }
        
    except Exception as e:
        logger.error(f"获取文档状态失败: {e}")
        return None


def list_knowledge_documents(knowledge_id: str) -> List[Dict[str, Any]]:
    """
    列出知识库的所有文档
    
    Args:
        knowledge_id: 知识库ID
        
    Returns:
        文档列表
    """
    try:
        documents = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id
        ).order_by(KnowledgeDocument.created_at.desc()).all()
        
        result = []
        for doc in documents:
            doc_info = get_document_with_status(doc.id)
            if doc_info:
                result.append(doc_info)
        
        return result
        
    except Exception as e:
        logger.error(f"列出文档失败: {e}")
        return []


def delete_document(document_id: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    删除文档及其所有相关数据
    
    Args:
        document_id: 文档ID
        
    Returns:
        (success, message, info)
    """
    try:
        document = KnowledgeDocument.query.get(document_id)
        if not document:
            return False, "文档不存在", {}
        
        knowledge_id = document.knowledge_id
        file_path = document.file_path
        
        # 获取知识库信息，判断类型
        from app.models import Knowledge
        knowledge = Knowledge.query.get(knowledge_id)
        kb_type = knowledge.kb_type if knowledge else 'vector'
        
        result = {
            'document_id': document_id,
            'file_path': file_path,
            'conversion_deleted': 0,
            'chunks_deleted': 0,
            'embedding_deleted': 0,
            'vector_deleted': False,
            'lightrag_deleted': False,
            'file_deleted': False,
            'markdown_deleted': False
        }
        
        # 1. 删除转换记录和markdown文件
        conversions = KnowledgeFileConversion.query.filter_by(
            document_id=document_id
        ).all()
        
        for conversion in conversions:
            # 删除markdown文件
            if conversion.markdown_path:
                kb_markdown_path = os.path.join(
                    settings['KNOWLEDGEBASE_PATH'],
                    f"{knowledge_id}-markdown"
                )
                markdown_file = os.path.join(kb_markdown_path, conversion.markdown_path)
                if os.path.exists(markdown_file):
                    try:
                        os.remove(markdown_file)
                        result['markdown_deleted'] = True
                        logger.info(f"已删除Markdown文件: {markdown_file}")
                    except Exception as e:
                        logger.warning(f"删除Markdown文件失败: {e}")
            
            db.session.delete(conversion)
            result['conversion_deleted'] += 1
        
        # 2. 删除分块数据
        chunks_deleted = KnowledgeFileChunk.query.filter_by(
            document_id=document_id
        ).delete()
        result['chunks_deleted'] = chunks_deleted
        
        # 3. 删除嵌入记录
        embeddings_deleted = KnowledgeFileEmbedding.query.filter_by(
            document_id=document_id
        ).delete()
        result['embedding_deleted'] = embeddings_deleted
        
        # 4. 根据知识库类型删除对应的数据
        if kb_type == 'lightrag':
            # LightRAG 类型：删除 LightRAG 中的文档
            try:
                from app.services.lightrag import LightRAGService, LightRAGConfigService
                
                config = LightRAGConfigService.get_lightrag_config()
                if config and config.enabled:
                    service_url = LightRAGConfigService.DEFAULT_SERVICE_URL
                    if config.framework_config:
                        service_url = config.framework_config.get('service_url', service_url)
                    
                    service = LightRAGService(service_url)
                    workspace = document.lightrag_workspace or knowledge.lightrag_workspace or knowledge_id
                    
                    # 使用文件名作为 document_id 删除
                    # LightRAG 的 document_id 通常是文件名
                    doc_name = document.file_name
                    success, message = service.delete_document(doc_name, workspace)
                    result['lightrag_deleted'] = success
                    
                    if success:
                        logger.info(f"已从 LightRAG 删除文档: {doc_name}, workspace: {workspace}")
                    else:
                        logger.warning(f"从 LightRAG 删除文档失败: {message}")
                else:
                    logger.warning("LightRAG 服务未启用，跳过 LightRAG 删除")
            except Exception as e:
                logger.warning(f"删除 LightRAG 文档时出错: {e}")
        else:
            # Vector 类型：删除向量数据（使用document_id精确删除）
            try:
                from app.services.vector_db_service import get_vector_db_service, get_collection_name
                
                vector_db_service = get_vector_db_service()
                if vector_db_service.is_available():
                    kb_name = get_collection_name(knowledge_id)
                    success, message, info = vector_db_service.delete_by_metadata(
                        kb_name, 
                        {'document_id': document_id}
                    )
                    result['vector_deleted'] = success
                    if success:
                        logger.info(f"已删除向量数据: {message}")
                    else:
                        logger.warning(f"删除向量数据失败: {message}")
            except Exception as e:
                logger.warning(f"删除向量数据时出错: {e}")
        
        # 5. 删除物理文件
        kb_path = os.path.join(
            settings['KNOWLEDGEBASE_PATH'],
            knowledge_id,
            'files',
            file_path
        )
        if os.path.exists(kb_path):
            try:
                os.remove(kb_path)
                result['file_deleted'] = True
                logger.info(f"已删除物理文件: {kb_path}")
            except Exception as e:
                logger.warning(f"删除物理文件失败: {e}")
        
        # 6. 删除 document 记录（会级联删除剩余的关联记录）
        db.session.delete(document)
        db.session.commit()
        
        logger.info(f"文档删除成功: {document_id}")
        
        return True, "文档删除成功", result
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除文档失败: {e}")
        return False, f"删除失败: {str(e)}", {}
