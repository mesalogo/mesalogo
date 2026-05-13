"""
知识库相关后台任务处理器
"""

import logging
import os
from typing import Dict, Any

from app.models import KnowledgeFileChunk, KnowledgeDocument, KnowledgeFileConversion, Job, db
from app.services.knowledge_base.knowledge_vectorizer import KnowledgeVectorizer

logger = logging.getLogger(__name__)


def handle_convert_file(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    处理文件转换后台任务
    
    Args:
        job_id: 后台任务ID
        params: {
            "knowledge_id": "kb_123",
            "file_path": "docs/manual.pdf"
        }
        context: {
            "job_id": job_id,
            "user_id": user_id,
            "manager": TaskManager实例
        }
    
    Returns:
        Dict: {
            "success": True,
            "conversion_id": "conv_123",
            "markdown_path": "xxx.md"
        }
    """
    try:
        manager = context['manager']
        knowledge_id = params.get('knowledge_id')
        file_path = params.get('file_path')
        
        if not knowledge_id or not file_path:
            raise ValueError("缺少必需参数: knowledge_id 或 file_path")
        
        manager.update_progress(job_id, 10, "开始文件转换...")
        
        # 查找文档记录
        document = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id,
            file_path=file_path
        ).first()
        
        if not document:
            raise ValueError(f"文档不存在: {file_path}")
        
        # 查找或创建转换记录
        conversion = KnowledgeFileConversion.query.filter_by(
            document_id=document.id
        ).first()
        
        if not conversion:
            import uuid
            conversion = KnowledgeFileConversion(
                id=str(uuid.uuid4()),
                document_id=document.id,
                knowledge_id=knowledge_id,
                file_path=file_path,
                file_name=os.path.basename(file_path),
                job_id=job_id  # 关联Job ID
            )
            db.session.add(conversion)
        else:
            # 更新job_id
            conversion.job_id = job_id
        
        db.session.commit()
        
        manager.update_progress(job_id, 20, f"转换文件: {file_path}")
        
        # 调用实际的转换逻辑
        from app.services.knowledge_base.document_converter import convert_file
        
        success, result = convert_file(knowledge_id, file_path)
        
        if not success:
            error_msg = result.get('error', '转换失败')
            raise Exception(error_msg)
        
        # 保存转换结果
        conversion.markdown_path = result.get('markdown_path')
        conversion.parser_tool = result.get('parser_tool', 'unknown')
        db.session.commit()
        
        manager.update_progress(job_id, 100, "转换完成")
        
        return {
            'success': True,
            'conversion_id': conversion.id,
            'markdown_path': result.get('markdown_path'),
            'file_name': os.path.basename(file_path)
        }
        
    except Exception as e:
        logger.error(f"文件转换失败: {e}")
        raise


def handle_vectorize_file(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    处理文件向量化后台任务
    
    Args:
        job_id: 后台任务ID
        params: {
            "knowledge_id": "kb_123",
            "file_path": "docs/manual.pdf"
        }
        context: {
            "job_id": job_id,
            "user_id": user_id,
            "manager": TaskManager实例
        }
    
    Returns:
        {
            "success": True,
            "total_chunks": 50,
            "vector_dimension": 768
        }
    """
    from app.models import KnowledgeFileEmbedding
    
    manager = context["manager"]
    knowledge_id = params["knowledge_id"]
    file_path = params["file_path"]
    
    logger.info(f"开始向量化文件: knowledge_id={knowledge_id}, file_path={file_path}")
    
    # 0. 查找文档并创建/更新embedding记录
    document = KnowledgeDocument.query.filter_by(
        knowledge_id=knowledge_id,
        file_path=file_path
    ).first()
    
    embedding = None
    if document:
        embedding = KnowledgeFileEmbedding.query.filter_by(
            document_id=document.id
        ).first()
        
        if not embedding:
            import uuid
            embedding = KnowledgeFileEmbedding(
                id=str(uuid.uuid4()),
                document_id=document.id,
                knowledge_id=knowledge_id,
                file_path=file_path,
                file_name=os.path.basename(file_path),
                job_id=job_id
            )
            db.session.add(embedding)
        else:
            embedding.job_id = job_id
        db.session.commit()
    
    # 1. 清理旧的向量数据（重新向量化时）
    manager.update_progress(job_id, 5, f"清理旧向量数据...")
    
    try:
        from app.services.vector_db_service import get_vector_db_service, get_collection_name
        
        vector_db_service = get_vector_db_service()
        if vector_db_service.is_available() and document:
            kb_name = get_collection_name(knowledge_id)
            # 使用document_id精确删除该文档的所有向量
            success, message, info = vector_db_service.delete_by_metadata(
                kb_name,
                {'document_id': document.id}
            )
            if success:
                logger.info(f"已删除旧向量数据: {message}")
            else:
                logger.warning(f"删除旧向量数据失败（继续执行）: {message}")
    except Exception as e:
        logger.warning(f"清理旧向量数据时出错（继续执行）: {e}")
    
    # 2. 读取分段
    manager.update_progress(job_id, 10, f"读取文件: {file_path}")
    
    chunks = KnowledgeFileChunk.query.filter_by(
        knowledge_id=knowledge_id,
        file_path=file_path
    ).order_by(KnowledgeFileChunk.chunk_index).all()
    
    if not chunks:
        raise ValueError(f"文件 {file_path} 没有分段数据，请先进行分段")
    
    total = len(chunks)
    logger.info(f"找到 {total} 个分段")
    manager.update_progress(job_id, 20, f"共 {total} 个分段")
    
    # 2. 检查后台任务是否被取消
    job = Job.query.get(job_id)
    if job.status == 'cancelled':
        logger.info(f"后台任务已取消: {job_id}")
        raise Exception("后台任务已取消")
    
    # 3. 向量化（使用现有的向量化服务）
    vectorizer = KnowledgeVectorizer()
    
    try:
        # 调用现有的向量化方法
        success, result = vectorizer.vectorize_file(knowledge_id, file_path)
        
        if not success:
            error_msg = result.get('error', '向量化失败')
            logger.error(f"向量化失败: {error_msg}")
            raise Exception(error_msg)
        
        logger.info(f"向量化成功: {result}")
        
        # 4. 更新embedding记录的结果数据
        if document and embedding:
            embedding.vector_count = result.get('chunks_processed', total)
            embedding.vector_dimension = result.get('vector_dimension', 0)
            embedding.embedding_model = result.get('embedding_model', 'unknown')
            db.session.commit()
        
        # 5. 更新文档状态为"已处理"（嵌入是最后一步）
        if document:
            document.status = 'completed'
            db.session.commit()
            logger.info(f"文档 {file_path} 向量化完成，状态已更新为 completed")
        
        # 6. 检查是否需要同步到 LightRAG（图谱增强）
        knowledge = Knowledge.query.get(knowledge_id)
        if knowledge and knowledge.settings and knowledge.settings.get('graph_enhancement', {}).get('enabled'):
            logger.info(f"检测到图谱增强已启用，准备同步到 LightRAG: {file_path}")
            try:
                # 提交 LightRAG 上传任务
                from app.services.job_queue.handlers.lightrag_job_handlers import handle_lightrag_upload
                
                manager.update_progress(job_id, 95, "同步到 LightRAG...")
                
                # 调用 LightRAG 上传处理器
                handle_lightrag_upload(job_id, {
                    'knowledge_id': knowledge_id,
                    'file_path': file_path,
                    'workspace': knowledge_id
                }, context)
                
                logger.info(f"文档已同步到 LightRAG: {file_path}")
            except Exception as e:
                logger.error(f"同步到 LightRAG 失败: {e}")
                # 不中断主流程，只记录错误
                manager._add_log(job_id, "WARNING", f"LightRAG 同步失败: {e}")
        
        # 7. 更新进度
        manager.update_progress(job_id, 100, "向量化完成")
        
        # 7. 返回结果
        return {
            "success": True,
            "total_chunks": result.get('chunks_processed', total),
            "vector_dimension": result.get('vector_dimension'),
            "details": result
        }
        
    except Exception as e:
        logger.exception(f"向量化过程中出错: {e}")
        raise


def handle_chunk_file(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    处理文件分段后台任务
    
    Args:
        job_id: 后台任务ID
        params: {
            "knowledge_id": "kb_123",
            "file_path": "docs/manual.pdf"
        }
        context: 任务上下文
    
    Returns:
        Dict: {
            "success": True,
            "chunk_count": 50,
            "file_name": "manual.pdf"
        }
    """
    try:
        manager = context['manager']
        knowledge_id = params.get('knowledge_id')
        file_path = params.get('file_path')
        
        if not knowledge_id or not file_path:
            raise ValueError("缺少必需参数: knowledge_id 或 file_path")
        
        manager.update_progress(job_id, 10, "开始文件分段...")
        
        # 查找文档记录
        document = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id,
            file_path=file_path
        ).first()
        
        if not document:
            raise ValueError(f"文档不存在: {file_path}")
        
        manager.update_progress(job_id, 20, f"分段文件: {file_path}")
        
        # 调用实际的分段逻辑
        from app.services.knowledge_base.document_chunker import DocumentChunker
        
        success, result = DocumentChunker.chunk_file(knowledge_id, file_path)
        
        if not success:
            error_msg = result.get('error', '分段失败')
            raise Exception(error_msg)
        
        chunk_count = result.get('chunk_count', 0)
        
        manager.update_progress(job_id, 100, f"分段完成，共 {chunk_count} 个分块")
        
        return {
            'success': True,
            'chunk_count': chunk_count,
            'file_name': os.path.basename(file_path),
            'details': result
        }
        
    except Exception as e:
        logger.error(f"文件分段失败: {e}")
        raise


def handle_embed_file(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    处理文件嵌入后台任务
    
    Args:
        job_id: 后台任务ID
        params: {
            "knowledge_id": "kb_123",
            "file_path": "docs/manual.pdf"
        }
        context: 任务上下文
    
    Returns:
        Dict: {
            "success": True,
            "vector_count": 50,
            "vector_dimension": 768
        }
    """
    from app.models import KnowledgeFileEmbedding
    
    try:
        manager = context['manager']
        knowledge_id = params.get('knowledge_id')
        file_path = params.get('file_path')
        
        if not knowledge_id or not file_path:
            raise ValueError("缺少必需参数: knowledge_id 或 file_path")
        
        manager.update_progress(job_id, 10, "开始向量嵌入...")
        
        # 查找文档记录
        document = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id,
            file_path=file_path
        ).first()
        
        if not document:
            raise ValueError(f"文档不存在: {file_path}")
        
        # 查找或创建嵌入记录
        embedding = KnowledgeFileEmbedding.query.filter_by(
            document_id=document.id
        ).first()
        
        if not embedding:
            import uuid
            embedding = KnowledgeFileEmbedding(
                id=str(uuid.uuid4()),
                document_id=document.id,
                knowledge_id=knowledge_id,
                file_path=file_path,
                file_name=os.path.basename(file_path),
                job_id=job_id  # 关联Job ID
            )
            db.session.add(embedding)
        else:
            # 更新job_id
            embedding.job_id = job_id
        
        db.session.commit()
        
        manager.update_progress(job_id, 20, f"嵌入文件: {file_path}")
        
        # 调用实际的向量化逻辑
        vectorizer = KnowledgeVectorizer()
        success, result = vectorizer.vectorize_file(knowledge_id, file_path)
        
        if not success:
            error_msg = result.get('error', '向量嵌入失败')
            raise Exception(error_msg)
        
        # 保存嵌入结果
        embedding.vector_count = result.get('chunks_processed', 0)
        embedding.vector_dimension = result.get('vector_dimension', 0)
        embedding.embedding_model = result.get('embedding_model', 'unknown')
        
        # 更新文档状态为完成
        document.status = 'completed'
        db.session.commit()
        
        manager.update_progress(job_id, 100, "向量嵌入完成")
        
        return {
            'success': True,
            'vector_count': result.get('chunks_processed', 0),
            'vector_dimension': result.get('vector_dimension', 0),
            'file_name': os.path.basename(file_path),
            'details': result
        }
        
    except Exception as e:
        logger.error(f"向量嵌入失败: {e}")
        raise


def handle_batch_vectorize(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    批量向量化多个文件
    
    Args:
        params: {
            "knowledge_id": "kb_123",
            "file_paths": ["doc1.pdf", "doc2.txt", "doc3.md"]
        }
    
    Returns:
        {
            "success": True,
            "total_files": 3,
            "completed_files": 3,
            "failed_files": 0
        }
    """
    manager = context["manager"]
    knowledge_id = params["knowledge_id"]
    file_paths = params["file_paths"]
    
    total_files = len(file_paths)
    completed = 0
    failed = 0
    
    logger.info(f"开始批量向量化: {total_files} 个文件")
    
    for idx, file_path in enumerate(file_paths):
        # 检查是否被取消
        job = Job.query.get(job_id)
        if job.status == 'cancelled':
            logger.info(f"批量后台任务已取消: {job_id}")
            raise Exception("后台任务已取消")
        
        try:
            # 更新进度
            progress = int(100 * idx / total_files)
            manager.update_progress(
                job_id,
                progress,
                f"处理文件 {idx+1}/{total_files}: {file_path}"
            )
            
            # 调用单文件向量化
            handle_vectorize_file(job_id, {
                "knowledge_id": knowledge_id,
                "file_path": file_path
            }, context)
            
            completed += 1
            logger.info(f"文件处理成功: {file_path}")
            
        except Exception as e:
            failed += 1
            logger.error(f"文件处理失败 {file_path}: {e}")
            manager._add_log(job_id, "ERROR", f"文件 {file_path} 处理失败: {e}")
            # 继续处理下一个文件，不中断整个后台任务
    
    # 最终结果
    manager.update_progress(job_id, 100, f"批量处理完成: 成功{completed}, 失败{failed}")
    
    return {
        "success": True,
        "total_files": total_files,
        "completed_files": completed,
        "failed_files": failed
    }
