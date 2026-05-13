"""
LightRAG 相关后台任务处理器
"""

import logging
import os
from typing import Dict, Any

from app.models import KnowledgeDocument, Knowledge, db
from app.services.lightrag import LightRAGService, LightRAGConfigService

logger = logging.getLogger(__name__)


def handle_lightrag_upload(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    处理 LightRAG 文档上传后台任务（Long Job：上传 + 等待处理完成）
    
    Args:
        job_id: 后台任务ID
        params: {
            "knowledge_id": "kb_123",
            "file_path": "docs/manual.pdf",
            "workspace": "kb_123",  # LightRAG workspace (可选，默认使用 knowledge_id)
            "wait_for_processing": True,  # 是否等待 LightRAG 处理完成（默认 True）
            "processing_timeout": 600  # 处理超时时间（秒，默认 10 分钟）
        }
        context: {
            "job_id": job_id,
            "user_id": user_id,
            "manager": JobManager实例
        }
    
    Returns:
        Dict: {
            "success": True,
            "workspace": "kb_123",
            "file_name": "manual.pdf",
            "track_id": "upload_xxx",
            "lightrag_status": "PROCESSED"
        }
    """
    document = None
    knowledge = None
    
    try:
        manager = context['manager']
        knowledge_id = params.get('knowledge_id')
        file_path = params.get('file_path')
        workspace = params.get('workspace', knowledge_id)
        wait_for_processing = params.get('wait_for_processing', True)
        processing_timeout = params.get('processing_timeout', 600)
        
        if not knowledge_id or not file_path:
            raise ValueError("缺少必需参数: knowledge_id 或 file_path")
        
        manager.update_progress(job_id, 5, "查找文档记录...")
        
        # 1. 查找文档记录
        document = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id,
            file_path=file_path
        ).first()
        
        if not document:
            raise ValueError(f"文档不存在: {file_path}")
        
        # 2. 查找知识库配置
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            raise ValueError(f"知识库不存在: {knowledge_id}")
        
        manager.update_progress(job_id, 10, "准备上传到 LightRAG...")
        
        # 3. 获取 LightRAG 服务
        config = LightRAGConfigService.get_lightrag_config()
        if not config or not config.enabled:
            raise ValueError("LightRAG 服务未启用")
        
        service_url = LightRAGConfigService.DEFAULT_SERVICE_URL
        if config.framework_config:
            service_url = config.framework_config.get('service_url', service_url)
        
        service = LightRAGService(service_url)
        
        # 4. 根据知识库类型选择上传方式
        manager.update_progress(job_id, 15, "上传到 LightRAG...")
        
        track_id = None
        
        if knowledge.kb_type == 'lightrag':
            # LightRAG 类型：直接上传原文件
            from app.api.routes.knowledge.utils import get_knowledge_base_path
            kb_path = get_knowledge_base_path(knowledge_id)
            full_path = os.path.join(kb_path, 'files', file_path)
            
            if not os.path.exists(full_path):
                raise ValueError(f"文件不存在: {full_path}")
            
            success, result = service.upload_file(
                file_path=full_path,
                workspace=workspace
            )
            
            if success and isinstance(result, dict):
                track_id = result.get('track_id')
        else:
            # Vector 类型（图谱增强）：使用解析后的 Markdown 内容
            from app.models import KnowledgeFileConversion
            conversion = KnowledgeFileConversion.query.filter_by(
                document_id=document.id
            ).first()
            
            if not conversion or not conversion.markdown_path:
                raise ValueError(f"文档未转换为 Markdown: {file_path}")
            
            # 读取 Markdown 内容
            md_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                'knowledgebase',
                knowledge_id,
                conversion.markdown_path
            )
            
            if not os.path.exists(md_path):
                raise ValueError(f"Markdown 文件不存在: {md_path}")
            
            with open(md_path, 'r', encoding='utf-8') as f:
                md_content = f.read()
            
            success, result = service.upload_document(
                content=md_content,
                workspace=workspace,
                filename=document.file_name
            )
            
            if success and isinstance(result, dict):
                track_id = result.get('track_id')
        
        if not success:
            error_msg = result if isinstance(result, str) else result.get('error', '上传失败')
            raise Exception(error_msg)
        
        manager.update_progress(job_id, 30, f"上传成功，track_id: {track_id}")
        logger.info(f"文档上传成功: {file_path}, track_id: {track_id}")
        
        # 5. 更新文档状态（标记为已提交）
        document.lightrag_synced = True
        document.lightrag_workspace = workspace
        document.lightrag_sync_job_id = job_id
        if track_id:
            document.lightrag_track_id = track_id
        db.session.commit()
        
        # 6. 等待 LightRAG 处理完成
        lightrag_status = 'PENDING'
        
        if wait_for_processing and track_id:
            manager.update_progress(job_id, 35, "等待 LightRAG 处理...")
            
            def progress_callback(status_summary, documents):
                """进度回调：更新 Job 进度"""
                # 计算进度：35% - 95% 之间
                total = sum(status_summary.values())
                processed = status_summary.get('PROCESSED', 0) + status_summary.get('FAILED', 0)
                if total > 0:
                    processing_progress = int(35 + (processed / total) * 60)
                    status_str = ', '.join([f"{k}:{v}" for k, v in status_summary.items()])
                    manager.update_progress(job_id, processing_progress, f"LightRAG 处理中: {status_str}")
            
            processing_success, final_result = service.wait_for_processing(
                track_id=track_id,
                workspace=workspace,
                timeout=processing_timeout,
                poll_interval=5,
                progress_callback=progress_callback
            )
            
            if processing_success:
                lightrag_status = 'PROCESSED'
                manager.update_progress(job_id, 95, "LightRAG 处理完成")
            else:
                # 检查是否有失败的文档
                status_summary = final_result.get('status_summary', {})
                if status_summary.get('FAILED', 0) > 0:
                    lightrag_status = 'FAILED'
                    error_docs = [d for d in final_result.get('documents', []) if d.get('status') == 'FAILED']
                    error_msg = error_docs[0].get('error_msg', '处理失败') if error_docs else '处理失败'
                    raise Exception(f"LightRAG 处理失败: {error_msg}")
                else:
                    lightrag_status = 'TIMEOUT'
                    raise Exception(f"LightRAG 处理超时: {final_result.get('error', '超时')}")
        else:
            # 不等待处理完成
            lightrag_status = 'SUBMITTED'
        
        manager.update_progress(job_id, 100, "LightRAG 上传完成")
        
        return {
            'success': True,
            'workspace': workspace,
            'file_name': document.file_name,
            'track_id': track_id,
            'lightrag_status': lightrag_status
        }
        
    except Exception as e:
        logger.error(f"LightRAG 上传失败: {e}")
        
        # 如果是 LightRAG 类型知识库，上传失败后清理本地文件和数据库记录
        try:
            if knowledge and knowledge.kb_type == 'lightrag' and document:
                logger.info(f"清理上传失败的文档: {document.file_name}")
                
                # 1. 删除本地文件
                from app.api.routes.knowledge.utils import get_knowledge_base_path
                kb_path = get_knowledge_base_path(params.get('knowledge_id'))
                full_path = os.path.join(kb_path, 'files', params.get('file_path'))
                
                if os.path.exists(full_path):
                    os.remove(full_path)
                    logger.info(f"已删除本地文件: {full_path}")
                
                # 2. 删除数据库记录
                db.session.delete(document)
                db.session.commit()
                logger.info(f"已删除数据库记录: {document.id}")
                
        except Exception as cleanup_error:
            logger.error(f"清理失败文档时出错: {cleanup_error}")
        
        raise


def handle_lightrag_batch_upload(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    批量上传多个文档到 LightRAG
    
    Args:
        job_id: 后台任务ID
        params: {
            "knowledge_id": "kb_123",
            "file_paths": ["doc1.pdf", "doc2.txt", "doc3.md"],
            "workspace": "kb_123"  # 可选
        }
        context: 任务上下文
    
    Returns:
        {
            "success": True,
            "total_files": 3,
            "completed_files": 3,
            "failed_files": 0,
            "failed_list": []
        }
    """
    manager = context["manager"]
    knowledge_id = params["knowledge_id"]
    file_paths = params["file_paths"]
    workspace = params.get("workspace", knowledge_id)
    
    total_files = len(file_paths)
    completed = 0
    failed = 0
    failed_list = []
    
    logger.info(f"开始批量上传到 LightRAG: {total_files} 个文件")
    
    for idx, file_path in enumerate(file_paths):
        # 检查是否被取消
        from app.models import Job
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
            
            # 调用单文件上传
            handle_lightrag_upload(job_id, {
                "knowledge_id": knowledge_id,
                "file_path": file_path,
                "workspace": workspace
            }, context)
            
            completed += 1
            logger.info(f"文件上传成功: {file_path}")
            
        except Exception as e:
            failed += 1
            failed_list.append({
                'file_path': file_path,
                'error': str(e)
            })
            logger.error(f"文件上传失败 {file_path}: {e}")
            manager._add_log(job_id, "ERROR", f"文件 {file_path} 上传失败: {e}")
            # 继续处理下一个文件，不中断整个后台任务
    
    # 最终结果
    manager.update_progress(job_id, 100, f"批量上传完成: 成功{completed}, 失败{failed}")
    
    return {
        "success": True,
        "total_files": total_files,
        "completed_files": completed,
        "failed_files": failed,
        "failed_list": failed_list
    }


def handle_lightrag_sync_all(job_id: str, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    同步知识库的所有文档到 LightRAG（用于 Vector 类型的图谱增强）
    
    Args:
        params: {
            "knowledge_id": "kb_123"
        }
    
    Returns:
        {
            "success": True,
            "total_documents": 10,
            "synced_documents": 10
        }
    """
    manager = context["manager"]
    knowledge_id = params["knowledge_id"]
    
    logger.info(f"开始同步知识库所有文档到 LightRAG: {knowledge_id}")
    
    # 1. 查找知识库
    knowledge = Knowledge.query.get(knowledge_id)
    if not knowledge:
        raise ValueError(f"知识库不存在: {knowledge_id}")
    
    # 2. 获取所有已处理的文档
    documents = KnowledgeDocument.query.filter_by(
        knowledge_id=knowledge_id,
        status='completed'
    ).all()
    
    total = len(documents)
    if total == 0:
        manager.update_progress(job_id, 100, "没有需要同步的文档")
        return {
            "success": True,
            "total_documents": 0,
            "synced_documents": 0
        }
    
    # 3. 批量上传
    file_paths = [doc.file_path for doc in documents]
    
    result = handle_lightrag_batch_upload(job_id, {
        "knowledge_id": knowledge_id,
        "file_paths": file_paths,
        "workspace": knowledge_id
    }, context)
    
    return {
        "success": True,
        "total_documents": total,
        "synced_documents": result['completed_files'],
        "failed_documents": result['failed_files']
    }
