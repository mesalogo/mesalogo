"""
文档分段服务
负责将转换后的Markdown文档进行分段处理
"""
import os
import logging
from typing import Dict, List, Any, Optional
from core.config import settings
from app.models import Knowledge, KnowledgeDocument, KnowledgeFileConversion, KnowledgeFileChunk, Job, db

logger = logging.getLogger(__name__)
from app.services.knowledge_base.chunking.config import get_or_create_chunk_config
from app.services.knowledge_base.chunking.chonkie_wrapper import ChonkieWrapper


class DocumentChunker:
    """文档分段处理器"""
    
    @staticmethod
    def chunk_file(knowledge_id: str, file_path: str, skip_status_check: bool = False) -> tuple[bool, Dict[str, Any]]:
        """
        对已转换的文件进行分段
        
        Args:
            knowledge_id: 知识库ID
            file_path: 文件路径（相对于知识库目录）
            skip_status_check: 是否跳过转换状态检查（Pipeline内部调用时使用）
            
        Returns:
            (success, result)
            - success: 是否成功
            - result: 分段结果或错误信息
        """
        try:
            # 1. 验证知识库存在
            knowledge = Knowledge.query.filter_by(id=knowledge_id).first()
            if not knowledge:
                return False, {'error': f'知识库 {knowledge_id} 不存在'}
            
            # 2. 查找 document 记录
            document = KnowledgeDocument.query.filter_by(
                knowledge_id=knowledge_id,
                file_path=file_path
            ).first()
            
            if not document:
                return False, {'error': '文件记录不存在，请先上传文件'}
            
            # 3. 检查文件是否已转换
            conversion = KnowledgeFileConversion.query.filter_by(
                document_id=document.id
            ).first()
            
            if not skip_status_check:
                # 只在非Pipeline调用时检查Job状态
                if not conversion or not conversion.job_id:
                    return False, {'error': '文件尚未转换'}
                
                # 检查转换状态（显式查询Job）
                job = Job.query.get(conversion.job_id)
                if not job or job.status != 'completed':
                    job_status = job.status if job else 'unknown'
                    return False, {'error': f'文件转换未完成，当前状态: {job_status}'}
            
            # Pipeline调用时，直接检查markdown_path
            if not conversion or not conversion.markdown_path:
                return False, {'error': '未找到转换后的Markdown文件路径'}
            
            # 4. 读取Markdown文件
            kb_markdown_path = os.path.join(
                settings['KNOWLEDGEBASE_PATH'],
                f"{knowledge_id}-markdown"
            )
            markdown_file = os.path.join(kb_markdown_path, conversion.markdown_path)
            
            if not os.path.exists(markdown_file):
                return False, {'error': f'Markdown文件不存在: {markdown_file}'}
            
            try:
                with open(markdown_file, 'r', encoding='utf-8') as f:
                    text = f.read()
            except Exception as e:
                return False, {'error': f'读取Markdown文件失败: {str(e)}'}
            
            if not text.strip():
                return False, {'error': 'Markdown文件内容为空'}
            
            # 5. 获取分段配置
            chunk_config = get_or_create_chunk_config(knowledge_id)
            method = chunk_config.method
            config = chunk_config.config
            
            logger.info(f"使用分段方法: {method}, 配置: {config}")
            
            # 6. 清理旧的分段数据及其依赖的下游数据（embeddings + 向量）
            logger.info(f"重新分段，清理文档 {document.id} 的旧分段和下游数据...")
            
            # 6.1 删除旧的 chunks
            chunks_deleted = KnowledgeFileChunk.query.filter_by(
                document_id=document.id
            ).delete()
            logger.info(f"已删除 {chunks_deleted} 个旧分块")
            
            # 6.2 删除旧的 embedding 记录
            from app.models import KnowledgeFileEmbedding
            embeddings_deleted = KnowledgeFileEmbedding.query.filter_by(
                document_id=document.id
            ).delete()
            logger.info(f"已删除 {embeddings_deleted} 个旧嵌入记录")
            
            # 6.3 删除 Milvus 中的向量
            try:
                from app.services.vector_db_service import get_vector_db_service, get_collection_name
                
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
            
            # 7. 执行分段
            wrapper = ChonkieWrapper(method, config)
            chunks = wrapper.chunk(text)
            
            if not chunks:
                # ✅ 优化：提供更详细的错误信息，特别是针对TableChunker
                if method == 'table':
                    return False, {'error': '分段结果为空：该文档不包含Markdown格式的表格。TableChunker只能处理包含表格的文档，请使用其他分段方法（如"递归分割"或"Token分割"）'}
                return False, {'error': '分段结果为空'}
            
            # 8. 保存分段结果
            chunk_objects = []
            for idx, chunk_text in enumerate(chunks):
                chunk = KnowledgeFileChunk(
                    document_id=document.id,  # ⭐ 添加 document_id
                    knowledge_id=knowledge_id,
                    file_path=file_path,
                    chunk_index=idx,
                    content=chunk_text,
                    chunk_metadata={
                        'method': method,
                        'file_name': conversion.file_name,
                        'source_file': file_path,
                        'chunk_count': len(chunks)
                    }
                )
                chunk_objects.append(chunk)
            
            db.session.bulk_save_objects(chunk_objects)
            db.session.commit()
            
            logger.info(f"文件分段完成: {file_path}, 共 {len(chunks)} 个分块")
            
            return True, {
                'chunk_count': len(chunks),
                'chunk_method': method,  # 统一使用 chunk_method
                'chunk_size': config.get('chunk_size'),
                'chunk_overlap': config.get('chunk_overlap'),
                'file_path': file_path
            }
            
        except Exception as e:
            logger.error(f"分段处理失败: {e}")
            import traceback
            traceback.print_exc()
            return False, {'error': str(e)}
    
    @staticmethod
    def get_chunking_status(knowledge_id: str, file_path: str) -> Dict[str, Any]:
        """
        获取文件的分段状态
        
        Args:
            knowledge_id: 知识库ID
            file_path: 文件路径
            
        Returns:
            分段状态信息
        """
        try:
            # 查询分段数据
            chunks = KnowledgeFileChunk.query.filter_by(
                knowledge_id=knowledge_id,
                file_path=file_path
            ).all()
            
            if not chunks:
                return {
                    'status': 'not_chunked',
                    'chunk_count': 0
                }
            
            # 获取分段方法
            method = chunks[0].chunk_metadata.get('method', 'unknown') if chunks else 'unknown'
            
            return {
                'status': 'chunked',
                'chunk_count': len(chunks),
                'method': method,
                'first_chunk_preview': chunks[0].content[:200] if chunks else None
            }
            
        except Exception as e:
            logger.error(f"获取分段状态失败: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    @staticmethod
    def get_chunks(knowledge_id: str, file_path: str) -> List[Dict[str, Any]]:
        """
        获取文件的所有分块
        
        Args:
            knowledge_id: 知识库ID
            file_path: 文件路径
            
        Returns:
            分块列表
        """
        try:
            chunks = KnowledgeFileChunk.query.filter_by(
                knowledge_id=knowledge_id,
                file_path=file_path
            ).order_by(KnowledgeFileChunk.chunk_index).all()
            
            return [
                {
                    'id': chunk.id,
                    'chunk_index': chunk.chunk_index,
                    'content': chunk.content,
                    'metadata': chunk.chunk_metadata
                }
                for chunk in chunks
            ]
            
        except Exception as e:
            logger.error(f"获取分块失败: {e}")
            return []
