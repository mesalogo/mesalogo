"""
知识库向量化服务

从 knowledge_file_chunks 表读取分段内容，生成向量并存储到向量数据库
"""

import logging
from typing import Dict, Any, List, Tuple
from app.models import KnowledgeFileChunk, Knowledge, db
from app.services.vector_db.embedding_service import embedding_service
from app.services.vector_db_service import get_vector_db_service, get_collection_name

logger = logging.getLogger(__name__)


class KnowledgeVectorizer:
    """知识库向量化服务"""
    
    def __init__(self):
        self.embedding_service = embedding_service
        self._vector_db_service = None
    
    @property
    def vector_db_service(self):
        if self._vector_db_service is None:
            self._vector_db_service = get_vector_db_service()
        return self._vector_db_service
    
    def vectorize_file(self, knowledge_id: str, file_path: str) -> Tuple[bool, Dict[str, Any]]:
        """
        对指定文件的分段进行向量化
        
        Args:
            knowledge_id: 知识库ID
            file_path: 文件路径（相对于知识库目录）
            
        Returns:
            (success, result)
            - success: 是否成功
            - result: 向量化结果或错误信息
        """
        try:
            # 1. 验证知识库存在
            knowledge = Knowledge.query.filter_by(id=knowledge_id).first()
            if not knowledge:
                return False, {'error': f'知识库 {knowledge_id} 不存在'}
            
            # 2. 读取文件的所有分段
            chunks = KnowledgeFileChunk.query.filter_by(
                knowledge_id=knowledge_id,
                file_path=file_path
            ).order_by(KnowledgeFileChunk.chunk_index).all()
            
            if not chunks:
                return False, {'error': f'文件 {file_path} 没有分段数据，请先进行分段'}
            
            logger.info(f"开始向量化文件 {file_path}，共 {len(chunks)} 个分段")
            
            # 3. 提取分段文本
            texts = [chunk.content for chunk in chunks]
            
            # 4. 调用嵌入服务生成向量
            success, embeddings, meta_info = self.embedding_service.generate_embeddings(texts)
            
            if not success:
                return False, {
                    'error': '生成向量失败',
                    'details': embeddings  # embeddings 包含错误信息
                }
            
            logger.info(
                f"向量生成成功: {len(embeddings)} 个向量, "
                f"维度: {meta_info.get('vector_dimension')}, "
                f"耗时: {meta_info.get('processing_time')}秒"
            )
            
            # 5. 准备向量数据库所需的元数据
            metadatas = []
            for chunk in chunks:
                metadata = {
                    'chunk_id': chunk.id,
                    'document_id': chunk.document_id,  # ⭐ 添加document_id用于精确删除
                    'knowledge_id': knowledge_id,
                    'file_path': file_path,
                    'chunk_index': chunk.chunk_index,
                }
                # 添加分段元数据
                if chunk.chunk_metadata:
                    metadata.update(chunk.chunk_metadata)
                metadatas.append(metadata)
            
            # 6. 检查向量数据库服务是否可用
            if not self.vector_db_service.is_available():
                return False, {
                    'error': '向量数据库服务不可用',
                    'details': '请检查系统设置中的向量数据库配置'
                }
            
            # 7. 存储向量到向量数据库
            kb_name = get_collection_name(knowledge_id)
            success, message, db_info = self.vector_db_service.insert_vectors(
                knowledge_base=kb_name,
                embeddings=embeddings,
                metadatas=metadatas
            )
            
            if not success:
                return False, {
                    'error': '存储向量失败',
                    'details': message
                }
            
            logger.info(f"向量存储成功: {message}")
            
            # 8. 返回成功结果
            result = {
                'knowledge_id': knowledge_id,
                'file_path': file_path,
                'chunk_count': len(chunks),
                'vector_dimension': meta_info.get('vector_dimension'),
                'embedding_model': meta_info.get('model_name'),
                'embedding_provider': meta_info.get('provider'),
                'processing_time': meta_info.get('processing_time'),
                'vector_db_info': db_info
            }
            
            return True, result
            
        except Exception as e:
            logger.error(f"向量化失败: {e}")
            import traceback
            traceback.print_exc()
            return False, {'error': f'向量化失败: {str(e)}'}
    
    def vectorize_knowledge_base(self, knowledge_id: str) -> Tuple[bool, Dict[str, Any]]:
        """
        对整个知识库的所有文件进行向量化
        
        Args:
            knowledge_id: 知识库ID
            
        Returns:
            (success, result)
        """
        try:
            # 获取知识库中所有有分段的文件
            chunks_query = KnowledgeFileChunk.query.filter_by(
                knowledge_id=knowledge_id
            ).distinct(KnowledgeFileChunk.file_path).all()
            
            if not chunks_query:
                return False, {'error': '知识库中没有分段数据'}
            
            # 获取所有唯一的文件路径
            file_paths = list(set(chunk.file_path for chunk in chunks_query))
            
            logger.info(f"开始向量化知识库 {knowledge_id}，共 {len(file_paths)} 个文件")
            
            # 逐个文件进行向量化
            successful_files = []
            failed_files = []
            
            for file_path in file_paths:
                success, result = self.vectorize_file(knowledge_id, file_path)
                
                if success:
                    successful_files.append({
                        'file_path': file_path,
                        'chunk_count': result.get('chunk_count', 0),
                        'processing_time': result.get('processing_time', 0)
                    })
                else:
                    failed_files.append({
                        'file_path': file_path,
                        'error': result.get('error', '未知错误')
                    })
            
            # 返回汇总结果
            return True, {
                'knowledge_id': knowledge_id,
                'total_files': len(file_paths),
                'successful_count': len(successful_files),
                'failed_count': len(failed_files),
                'successful_files': successful_files,
                'failed_files': failed_files
            }
            
        except Exception as e:
            logger.error(f"批量向量化失败: {e}")
            import traceback
            traceback.print_exc()
            return False, {'error': f'批量向量化失败: {str(e)}'}
    
    def get_vectorization_status(self, knowledge_id: str, file_path: str = None) -> Dict[str, Any]:
        """
        获取向量化状态
        
        Args:
            knowledge_id: 知识库ID
            file_path: 可选，指定文件路径
            
        Returns:
            状态信息
        """
        try:
            if file_path:
                # 获取指定文件的状态
                chunks = KnowledgeFileChunk.query.filter_by(
                    knowledge_id=knowledge_id,
                    file_path=file_path
                ).all()
                
                if not chunks:
                    return {
                        'status': 'no_chunks',
                        'message': '文件没有分段数据'
                    }
                
                return {
                    'status': 'has_chunks',
                    'file_path': file_path,
                    'chunk_count': len(chunks),
                    'message': '已完成分段，可以进行向量化'
                }
            else:
                # 获取整个知识库的状态
                chunks = KnowledgeFileChunk.query.filter_by(
                    knowledge_id=knowledge_id
                ).all()
                
                if not chunks:
                    return {
                        'status': 'no_chunks',
                        'message': '知识库没有分段数据'
                    }
                
                # 统计文件数量
                file_paths = list(set(chunk.file_path for chunk in chunks))
                
                return {
                    'status': 'has_chunks',
                    'file_count': len(file_paths),
                    'total_chunks': len(chunks),
                    'message': '已完成分段，可以进行向量化'
                }
                
        except Exception as e:
            logger.error(f"获取向量化状态失败: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }


# 全局向量化服务实例
knowledge_vectorizer = KnowledgeVectorizer()
