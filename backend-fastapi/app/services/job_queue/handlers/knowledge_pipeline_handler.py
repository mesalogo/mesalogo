"""
知识库文件处理流水线Handler

完整流程：转换 → 分段 → 嵌入
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def handle_process_file_pipeline(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    完整的文件处理流水线：转换 → 分段 → 嵌入
    
    Args:
        job_id: 任务ID
        params: {
            "knowledge_id": "kb_xxx",
            "file_path": "doc.pdf",
            "document_id": "doc_xxx",
            "file_name": "doc.pdf"
        }
        context: {
            "manager": JobManager实例
        }
    
    Returns:
        {
            "success": True,
            "convert": {...},
            "chunk": {...},
            "embed": {...}
        }
    """
    from app.models import db, KnowledgeDocument, KnowledgeFileConversion, KnowledgeFileChunking, KnowledgeFileChunk, KnowledgeFileEmbedding, Job
    from app.services.vector_db_service import get_vector_db_service, get_collection_name
    
    manager = context["manager"]
    knowledge_id = params["knowledge_id"]
    file_path = params["file_path"]
    document_id = params.get("document_id")
    file_name = params.get("file_name", file_path)
    
    # 获取当前Pipeline Job的user_id
    pipeline_job = Job.query.get(job_id)
    user_id = pipeline_job.user_id if pipeline_job else None
    
    result = {
        "success": False,
        "convert": None,
        "chunk": None,
        "embed": None
    }
    
    try:
        # ===== 步骤 0: 清理旧数据 =====
        logger.info(f"[Pipeline] 步骤0: 清理文件 {file_name} 的旧数据...")
        manager.update_progress(job_id, 5, "清理旧数据...")
        
        # 查找文档记录
        document = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id,
            file_path=file_path
        ).first()
        
        if not document:
            raise ValueError(f"文档不存在: {file_path}")
        
        # 更新文档状态为"处理中"
        document.status = 'processing'
        document.error_message = None
        db.session.commit()
        logger.info(f"[Pipeline] 文档状态: processing")
        
        if document:
            # 1. 删除转换记录
            KnowledgeFileConversion.query.filter_by(
                document_id=document.id
            ).delete()
            
            # 2. 删除分段记录（元数据和数据）
            KnowledgeFileChunking.query.filter_by(
                document_id=document.id
            ).delete()
            KnowledgeFileChunk.query.filter_by(
                knowledge_id=knowledge_id,
                file_path=file_path
            ).delete()
            
            # 3. 删除嵌入记录
            KnowledgeFileEmbedding.query.filter_by(
                document_id=document.id
            ).delete()
            
            # 4. 删除向量数据（使用document_id精确删除）
            try:
                vector_db_service = get_vector_db_service()
                if vector_db_service.is_available():
                    kb_name = get_collection_name(knowledge_id)
                    success, message, info = vector_db_service.delete_by_metadata(
                        kb_name,
                        {'document_id': document.id}
                    )
                    if success:
                        logger.info(f"[Pipeline] 已删除向量数据: {message}")
                    else:
                        logger.warning(f"[Pipeline] 删除向量数据返回失败: {message}")
            except Exception as e:
                logger.warning(f"[Pipeline] 删除向量数据失败（继续执行）: {e}")
            
            db.session.commit()
            logger.info(f"[Pipeline] 旧数据清理完成")
        
        manager.update_progress(job_id, 8, "旧数据已清理 ✓", extra_data={
            "conversion_status": "not_converted",
            "chunking_status": "not_chunked",
            "embedding_status": "not_embedded"
        })
        # ===== 步骤 1/3: 转换 =====
        logger.info(f"[Pipeline] 步骤1/3: 开始转换文件 {file_name}")
        manager.update_progress(job_id, 10, "步骤1/3: 转换文档...", extra_data={
            "conversion_status": "converting",
            "chunking_status": "not_chunked",
            "embedding_status": "not_embedded"
        })
        
        # 直接调用转换服务（避免Job状态检查）
        from app.services.knowledge_base.document_converter import convert_file
        from app.utils.document_parser_config import get_active_document_parser
        
        success, convert_result = convert_file(knowledge_id, file_path)
        
        if not success:
            error_msg = convert_result.get('error', '转换失败')
            raise Exception(f"转换失败: {error_msg}")
        
        # Pipeline直接调用服务，需要手动创建转换Job和记录
        if document:
            # 创建一个已完成的转换Job
            convert_job = Job(
                job_type='kb:convert_file',
                status='completed',
                user_id=user_id,
                data={
                    'priority': 'medium',
                    'progress': 100,
                    'message': '转换完成',
                    'started_at': None,
                    'completed_at': None,
                    'retry_count': 0,
                    'max_retries': 0,
                    'error': None,
                    'params': {
                        'knowledge_id': knowledge_id,
                        'file_path': file_path
                    },
                    'result': convert_result,
                    'logs': []
                }
            )
            db.session.add(convert_job)
            db.session.flush()  # 获取convert_job.id
            
            # 创建转换记录，关联到独立的转换Job
            conversion = KnowledgeFileConversion(
                document_id=document.id,
                knowledge_id=knowledge_id,
                file_path=file_path,
                file_name=file_name,
                job_id=convert_job.id,  # 指向独立的已完成Job
                parser_tool=get_active_document_parser(),
                markdown_path=convert_result.get('markdown_path')
            )
            db.session.add(conversion)
            db.session.commit()
            logger.info(f"[Pipeline] 已创建转换Job({convert_job.id})和记录: {conversion.markdown_path}")
        
        result["convert"] = convert_result
        logger.info(f"[Pipeline] 步骤1/3: 转换完成")
        manager.update_progress(job_id, 40, "步骤1/3: 转换完成 ✓", extra_data={
            "conversion_status": "converted",
            "chunking_status": "not_chunked",
            "embedding_status": "not_embedded"
        })
        
        # ===== 步骤 2/3: 分段 =====
        logger.info(f"[Pipeline] 步骤2/3: 开始分段文件 {file_name}")
        manager.update_progress(job_id, 45, "步骤2/3: 分段文档...", extra_data={
            "conversion_status": "converted",
            "chunking_status": "chunking",
            "embedding_status": "not_embedded"
        })
        
        # 直接调用分段服务（避免Job状态检查）
        from app.services.knowledge_base.document_chunker import DocumentChunker
        success, chunk_result = DocumentChunker.chunk_file(knowledge_id, file_path, skip_status_check=True)
        
        if not success:
            error_msg = chunk_result.get('error', '分段失败')
            raise Exception(f"分段失败: {error_msg}")
        
        # Pipeline直接调用服务，需要手动创建分段Job和记录
        if document:
            # 创建一个已完成的分段Job
            chunk_job = Job(
                job_type='kb:chunk_file',
                status='completed',
                user_id=user_id,
                data={
                    'priority': 'medium',
                    'progress': 100,
                    'message': '分段完成',
                    'started_at': None,
                    'completed_at': None,
                    'retry_count': 0,
                    'max_retries': 0,
                    'error': None,
                    'params': {
                        'knowledge_id': knowledge_id,
                        'file_path': file_path
                    },
                    'result': chunk_result,
                    'logs': []
                }
            )
            db.session.add(chunk_job)
            db.session.flush()  # 获取chunk_job.id
            
            # 创建分段记录，关联到独立的分段Job
            chunking = KnowledgeFileChunking(
                document_id=document.id,
                knowledge_id=knowledge_id,
                file_path=file_path,
                file_name=file_name,
                job_id=chunk_job.id,  # 指向独立的已完成Job
                chunk_method=chunk_result.get('chunk_method', 'recursive'),
                chunk_size=chunk_result.get('chunk_size'),
                chunk_overlap=chunk_result.get('chunk_overlap'),
                chunk_count=chunk_result.get('chunk_count', 0)
            )
            db.session.add(chunking)
            db.session.commit()
            logger.info(f"[Pipeline] 已创建分段Job({chunk_job.id})和记录: {chunking.chunk_count} 个分块")
        
        result["chunk"] = chunk_result
        logger.info(f"[Pipeline] 步骤2/3: 分段完成")
        manager.update_progress(job_id, 70, "步骤2/3: 分段完成 ✓", extra_data={
            "conversion_status": "converted",
            "chunking_status": "chunked",
            "embedding_status": "not_embedded"
        })
        
        # ===== 步骤 3/3: 嵌入 =====
        logger.info(f"[Pipeline] 步骤3/3: 开始向量嵌入 {file_name}")
        manager.update_progress(job_id, 75, "步骤3/3: 向量嵌入...", extra_data={
            "conversion_status": "converted",
            "chunking_status": "chunked",
            "embedding_status": "embedding"
        })
        
        # 直接调用向量化服务（避免Job状态检查）
        from app.services.knowledge_base.knowledge_vectorizer import KnowledgeVectorizer
        vectorizer = KnowledgeVectorizer()
        success, embed_result = vectorizer.vectorize_file(knowledge_id, file_path)
        
        if not success:
            error_msg = embed_result.get('error', '向量化失败')
            raise Exception(f"向量化失败: {error_msg}")
        
        # Pipeline直接调用服务，需要手动创建嵌入Job和记录
        if document:
            # 创建一个已完成的嵌入Job
            embed_job = Job(
                job_type='kb:vectorize_file',
                status='completed',
                user_id=user_id,
                data={
                    'priority': 'medium',
                    'progress': 100,
                    'message': '向量化完成',
                    'started_at': None,
                    'completed_at': None,
                    'retry_count': 0,
                    'max_retries': 0,
                    'error': None,
                    'params': {
                        'knowledge_id': knowledge_id,
                        'file_path': file_path
                    },
                    'result': embed_result,
                    'logs': []
                }
            )
            db.session.add(embed_job)
            db.session.flush()  # 获取embed_job.id
            
            # 创建嵌入记录，关联到独立的嵌入Job
            kb_name = get_collection_name(knowledge_id)
            embedding = KnowledgeFileEmbedding(
                document_id=document.id,
                knowledge_id=knowledge_id,
                file_path=file_path,
                file_name=file_name,
                job_id=embed_job.id,  # 指向独立的已完成Job
                embedding_model=embed_result.get('embedding_model'),
                vector_count=embed_result.get('chunk_count', 0),
                vector_dimension=embed_result.get('vector_dimension', 0),
                collection_name=kb_name
            )
            db.session.add(embedding)
            db.session.commit()
            logger.info(f"[Pipeline] 已创建嵌入Job({embed_job.id})和记录: {embedding.vector_count} 个向量")
        
        result["embed"] = embed_result
        logger.info(f"[Pipeline] 步骤3/3: 向量嵌入完成")
        manager.update_progress(job_id, 100, "全部完成！✓", extra_data={
            "conversion_status": "converted",
            "chunking_status": "chunked",
            "embedding_status": "embedded"
        })
        
        # ===== 完成 =====
        result["success"] = True
        
        # 更新文档状态为"已完成"
        document.status = 'completed'
        db.session.commit()
        logger.info(f"[Pipeline] 文档状态: completed")
        
        # 检查是否需要同步到 LightRAG（图谱增强）
        knowledge = Knowledge.query.get(knowledge_id)
        if knowledge and knowledge.settings and knowledge.settings.get('graph_enhancement', {}).get('enabled'):
            logger.info(f"[Pipeline] 检测到图谱增强已启用，准备同步到 LightRAG: {file_name}")
            try:
                from app.services.job_queue.handlers.lightrag_job_handlers import handle_lightrag_upload
                
                manager.update_progress(job_id, 95, "同步到 LightRAG...", extra_data={
                    "lightrag_sync": "in_progress"
                })
                
                # 调用 LightRAG 上传处理器
                handle_lightrag_upload(job_id, {
                    'knowledge_id': knowledge_id,
                    'file_path': file_path,
                    'workspace': knowledge_id
                }, context)
                
                logger.info(f"[Pipeline] 文档已同步到 LightRAG: {file_name}")
                manager.update_progress(job_id, 98, "LightRAG 同步完成", extra_data={
                    "lightrag_sync": "completed"
                })
            except Exception as e:
                logger.error(f"[Pipeline] 同步到 LightRAG 失败: {e}")
                # 不中断主流程，只记录错误
                manager._add_log(job_id, "WARNING", f"LightRAG 同步失败: {e}")
                manager.update_progress(job_id, 98, "LightRAG 同步失败（不影响主流程）", extra_data={
                    "lightrag_sync": "failed",
                    "lightrag_error": str(e)
                })
        
        logger.info(f"[Pipeline] ✅ 文件处理流水线完成: {file_name}")
        
        return result
        
    except Exception as e:
        error_msg = f"流水线执行失败: {str(e)}"
        logger.error(f"[Pipeline] {error_msg}", exc_info=True)
        
        # 更新文档状态为"失败"
        try:
            if document:
                document.status = 'failed'
                document.error_message = str(e)
                db.session.commit()
                logger.info(f"[Pipeline] 文档状态: failed")
        except:
            pass  # 避免错误处理中的错误
        
        raise Exception(error_msg)
