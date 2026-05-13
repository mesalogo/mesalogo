"""
知识库向量化服务（KISS版本）

简单直接：从 knowledge_file_chunks 读取 → 生成向量 → 存储
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Tuple

from app.models import KnowledgeFileChunk, Knowledge, KnowledgeDocument, KnowledgeFileEmbedding, db
from app.services.vector_db.embedding_service import embedding_service
from app.services.vector_db_service import get_vector_db_service, get_collection_name

logger = logging.getLogger(__name__)


def vectorize_file(knowledge_id: str, file_path: str, embedding_record_id: str) -> Tuple[bool, Dict[str, Any]]:
    """
    对文件的分段进行向量化
    
    流程：读取chunks → 生成向量 → 存储到向量数据库
    
    Args:
        knowledge_id: 知识库ID
        file_path: 文件路径
        embedding_record_id: embedding 记录ID（由 API 创建）
        
    Returns:
        (success, result)
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
        
        # 3. 读取分段
        chunks = KnowledgeFileChunk.query.filter_by(
            document_id=document.id
        ).order_by(KnowledgeFileChunk.chunk_index).all()
        
        if not chunks:
            return False, {'error': f'文件 {file_path} 没有分段数据，请先进行分段'}
        
        logger.info(f"向量化文件 {file_path}，共 {len(chunks)} 个分段")
        
        # ⭐ 获取 embedding 记录（由 API 创建）
        embedding_record = KnowledgeFileEmbedding.query.get(embedding_record_id)
        if not embedding_record:
            return False, {'error': f'Embedding 记录不存在: {embedding_record_id}'}
        
        logger.info(f"使用 embedding 记录: {embedding_record.id}, status={embedding_record.status}")
        
        # 4. 提取文本
        texts = [chunk.content for chunk in chunks]
        
        # 5. 生成向量
        success, embeddings, meta_info = embedding_service.generate_embeddings(texts)
        
        if not success:
            return False, {'error': '生成向量失败', 'details': embeddings}
        
        logger.info(
            f"生成向量成功: {len(embeddings)} 个, "
            f"维度: {meta_info.get('vector_dimension')}, "
            f"耗时: {meta_info.get('processing_time'):.2f}秒"
        )
        
        # 6. 准备元数据
        # 获取 document_id（数据库中的文档记录ID）
        # 注意: document 变量在函数开头已经获取过了，这里使用之前的 document
        
        if not document:
            return False, {
                'error': f'找不到文档记录: {file_path}',
                'details': '文档可能已被删除'
            }
        
        metadatas = [
            {
                'chunk_id': chunk.id,
                'document_id': document.id,  # ⭐ 使用真正的 document_id
                'knowledge_id': knowledge_id,
                'file_path': file_path,
                'chunk_index': chunk.chunk_index,
            }
            for chunk in chunks
        ]
        
        # 7. 存储到向量数据库
        vector_db_service = get_vector_db_service()
        
        if not vector_db_service.is_available():
            return False, {
                'error': '向量数据库服务不可用',
                'details': '请检查系统设置中的向量数据库配置'
            }
        
        kb_name = get_collection_name(knowledge_id)
        
        # ⭐ 重新嵌入时，先删除该文档的旧向量数据
        logger.info(f"清理文档 {document.id} 的旧向量数据...")
        delete_success, delete_message, _ = vector_db_service.delete_by_metadata(
            knowledge_base=kb_name,
            metadata_filter={'document_id': document.id}
        )
        
        if delete_success:
            logger.info(f"已删除旧向量数据: {delete_message}")
        else:
            # 如果是 Collection 不存在，不算错误
            if "不存在" not in delete_message and "not exist" not in delete_message.lower():
                logger.warning(f"删除旧向量数据失败（可能是首次嵌入）: {delete_message}")
        
        # ⭐ 使用新的 insert_vectors 函数，只负责存储向量
        success, message, db_info = vector_db_service.insert_vectors(
            knowledge_base=kb_name,
            embeddings=embeddings,
            metadatas=metadatas
        )
        
        if not success:
            # 更新 embedding 记录为失败
            embedding_record.status = 'failed'
            embedding_record.completed_at = datetime.utcnow()
            embedding_record.error_message = message
            db.session.commit()
            logger.error(f"向量存储失败: {message}")
            return False, {'error': '存储向量失败', 'details': message}
        
        logger.info(f"向量存储成功: {message}")
        
        # 8. 更新 embedding 记录为完成
        embedding_record.status = 'completed'
        embedding_record.completed_at = datetime.utcnow()
        embedding_record.vector_count = len(chunks)
        embedding_record.vector_dimension = meta_info.get('vector_dimension')
        embedding_record.embedding_model = meta_info.get('model_name')
        db.session.commit()
        logger.info(f"Embedding 记录更新为 completed: {embedding_record.id}")
        
        # 9. 返回结果
        return True, {
            'knowledge_id': knowledge_id,
            'file_path': file_path,
            'chunk_count': len(chunks),
            'vector_dimension': meta_info.get('vector_dimension'),
            'embedding_model': meta_info.get('model_name'),
            'processing_time': meta_info.get('processing_time'),
        }
        
    except Exception as e:
        logger.error(f"向量化失败: {e}")
        import traceback
        traceback.print_exc()
        
        # 更新 embedding 记录为失败
        try:
            db.session.rollback()  # ⭐ 先回滚
            
            # 重新查询 embedding 记录（避免 detached 状态）
            embedding_record = KnowledgeFileEmbedding.query.get(embedding_record_id)
            if embedding_record:
                embedding_record.status = 'failed'
                embedding_record.completed_at = datetime.utcnow()
                embedding_record.error_message = str(e)
                db.session.commit()
                logger.info(f"Embedding 记录更新为 failed: {embedding_record.id}")
        except Exception as db_error:
            logger.error(f"更新 embedding 记录失败: {db_error}")
            db.session.rollback()
        
        return False, {'error': f'向量化失败: {str(e)}'}
