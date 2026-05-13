"""
TiDB向量数据库统一服务接口

提供高级API供其他模块调用，封装底层的向量数据库操作
"""

import logging
from typing import Dict, Any, List, Optional, Union, Tuple
from datetime import datetime

from .tidb_config import tidb_config_manager, TiDBConfig
from .tidb_connection import tidb_connection_manager
from .table_manager import vector_table_manager
from .embedding_service import embedding_service
from .vector_operations import vector_operations
from .models import (
    VectorRecord, VectorSearchResult, VectorCollection, 
    VectorDistanceMetric, VectorDataType
)

logger = logging.getLogger(__name__)


class TiDBVectorService:
    """TiDB向量数据库统一服务"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._initialized = False
        self._config = None
    
    def initialize(self, connection_string: str) -> Tuple[bool, str]:
        """初始化向量数据库服务"""
        try:
            # 创建配置
            self._config = tidb_config_manager.create_config(connection_string)
            
            # 初始化连接
            success = tidb_connection_manager.initialize(self._config)
            
            if success:
                self._initialized = True
                self.logger.info("TiDB向量数据库服务初始化成功")
                return True, "向量数据库服务初始化成功"
            else:
                return False, "向量数据库连接初始化失败"
                
        except Exception as e:
            error_msg = f"向量数据库服务初始化失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def is_initialized(self) -> bool:
        """检查服务是否已初始化"""
        return self._initialized
    
    def create_knowledge_base(
        self, 
        name: str, 
        dimension: int = 1024,
        distance_metric: VectorDistanceMetric = VectorDistanceMetric.COSINE,
        description: Optional[str] = None
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """创建知识库（向量表）"""
        try:
            if not self._initialized:
                return False, "服务未初始化", {}
            
            # 创建集合配置
            collection = VectorCollection(
                name=name,
                dimension=dimension,
                distance_metric=distance_metric,
                description=description or f"知识库: {name}"
            )
            
            # 创建表
            success, message = vector_table_manager.create_table(collection)
            
            info = {}
            if success:
                # 获取表信息
                table_info = vector_table_manager.get_table_info(name)
                if table_info:
                    info = table_info
            
            return success, message, info
            
        except Exception as e:
            error_msg = f"创建知识库失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def add_documents(
        self,
        knowledge_base: str,
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        source: Optional[str] = None,
        model_id: Optional[int] = None
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """添加文档到知识库"""
        try:
            if not self._initialized:
                return False, "服务未初始化", {}
            
            if not documents:
                return False, "文档列表不能为空", {}
            
            # 批量插入文档和向量
            success, message, info = vector_operations.batch_insert_with_embeddings(
                table_name=knowledge_base,
                texts=documents,
                metadatas=metadatas,
                data_type=VectorDataType.DOCUMENT,
                source=source,
                model_config_id=model_id
            )
            
            return success, message, info
            
        except Exception as e:
            error_msg = f"添加文档失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def search_knowledge(
        self,
        knowledge_base: str,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        model_id: Optional[int] = None
    ) -> Tuple[bool, Union[List[Dict[str, Any]], str], Dict[str, Any]]:
        """搜索知识库"""
        try:
            if not self._initialized:
                return False, "服务未初始化", {}
            
            if not query:
                return False, "查询内容不能为空", {}
            
            # 执行语义搜索
            success, results, info = vector_operations.semantic_search(
                table_name=knowledge_base,
                query_text=query,
                limit=top_k,
                distance_metric=VectorDistanceMetric.COSINE,
                filters=filters,
                model_config_id=model_id
            )
            
            if success:
                # 转换结果格式
                formatted_results = []
                for result in results:
                    formatted_result = {
                        'id': result.record.id,
                        'text': result.record.text,
                        'metadata': result.record.metadata,
                        'distance': result.distance,
                        'score': result.score,
                        'source': result.record.source,
                        'data_type': result.record.data_type.value
                    }
                    formatted_results.append(formatted_result)
                
                return True, formatted_results, info
            else:
                return False, results, info
            
        except Exception as e:
            error_msg = f"搜索知识库失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def delete_documents(
        self,
        knowledge_base: str,
        document_ids: List[str]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """删除知识库中的文档"""
        try:
            if not self._initialized:
                return False, "服务未初始化", {}
            
            if not document_ids:
                return False, "文档ID列表不能为空", {}
            
            # 删除记录
            success, message, info = vector_operations.delete_records(
                table_name=knowledge_base,
                record_ids=document_ids
            )
            
            return success, message, info
            
        except Exception as e:
            error_msg = f"删除文档失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def get_knowledge_base_info(self, knowledge_base: str) -> Tuple[bool, Union[Dict[str, Any], str]]:
        """获取知识库信息"""
        try:
            if not self._initialized:
                return False, "服务未初始化"
            
            # 获取表信息
            table_info = vector_table_manager.get_table_info(knowledge_base)
            
            if table_info:
                # 获取统计信息
                success, stats = vector_operations.get_table_statistics(knowledge_base)
                if success:
                    table_info['statistics'] = stats
                
                return True, table_info
            else:
                return False, f"知识库 '{knowledge_base}' 不存在"
            
        except Exception as e:
            error_msg = f"获取知识库信息失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def list_knowledge_bases(self) -> Tuple[bool, Union[List[Dict[str, Any]], str]]:
        """列出所有知识库"""
        try:
            if not self._initialized:
                return False, "服务未初始化"
            
            tables = vector_table_manager.list_tables()
            
            # 为每个表添加统计信息
            knowledge_bases = []
            for table in tables:
                table_name = table['name']
                success, stats = vector_operations.get_table_statistics(table_name)
                if success:
                    table['statistics'] = stats
                knowledge_bases.append(table)
            
            return True, knowledge_bases
            
        except Exception as e:
            error_msg = f"列出知识库失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def delete_knowledge_base(self, knowledge_base: str) -> Tuple[bool, str]:
        """删除知识库"""
        try:
            if not self._initialized:
                return False, "服务未初始化"
            
            success, message = vector_table_manager.drop_table(knowledge_base)
            return success, message
            
        except Exception as e:
            error_msg = f"删除知识库失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def test_connection(self) -> Tuple[bool, str, Dict[str, Any]]:
        """测试数据库连接"""
        try:
            if not self._config:
                return False, "服务未配置", {}
            
            # 测试基础连接
            success, message, info = tidb_config_manager.test_connection(self._config)
            
            if success and self._initialized:
                # 测试向量操作
                vector_success, vector_message, vector_info = tidb_connection_manager.test_vector_operations()
                info['vector_test'] = {
                    'success': vector_success,
                    'message': vector_message,
                    'info': vector_info
                }
            
            return success, message, info
            
        except Exception as e:
            error_msg = f"测试连接失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def get_service_status(self) -> Dict[str, Any]:
        """获取服务状态"""
        try:
            status = {
                'initialized': self._initialized,
                'connection_active': False,
                'embedding_models_available': False,
                'default_embedding_model': None,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if self._initialized:
                # 检查连接状态
                connection_info = tidb_connection_manager.get_connection_info()
                status['connection_active'] = connection_info.get('connected', False)
                status['connection_info'] = connection_info
                
                # 检查嵌入模型
                default_model = embedding_service.get_default_embedding_model()
                if default_model:
                    status['embedding_models_available'] = True
                    status['default_embedding_model'] = embedding_service.get_model_info(default_model)
            
            return status
            
        except Exception as e:
            self.logger.error(f"获取服务状态失败: {e}")
            return {
                'initialized': False,
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def close(self):
        """关闭服务"""
        try:
            if self._initialized:
                tidb_connection_manager.close()
                self._initialized = False
                self._config = None
                self.logger.info("TiDB向量数据库服务已关闭")
        except Exception as e:
            self.logger.error(f"关闭服务失败: {e}")


# 全局向量数据库服务实例
tidb_vector_service = TiDBVectorService()
