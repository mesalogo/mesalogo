"""
向量数据库服务 - 简化版
只实现必要的功能, KISS原则
"""

import logging
from typing import List, Dict, Any, Optional, Tuple, Union
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


# ==================== 抽象基类 ====================

class VectorDBAdapter(ABC):
    """向量数据库适配器抽象基类"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    def create_knowledge_base(self, name: str, dimension: int = 1024, **kwargs) -> Tuple[bool, str, Dict[str, Any]]:
        """创建知识库"""
        pass
    
    @abstractmethod
    def insert_vectors(self, knowledge_base: str, embeddings: List[List[float]], 
                      metadatas: List[Dict[str, Any]]) -> Tuple[bool, str, Dict[str, Any]]:
        """插入向量(向量已生成)"""
        pass
    
    @abstractmethod
    def search(self, knowledge_base: str, query: str, top_k: int = 5, 
              filters: Optional[Dict[str, Any]] = None) -> Tuple[bool, Union[List[Dict[str, Any]], str], Dict[str, Any]]:
        """搜索知识库"""
        pass
    
    @abstractmethod
    def delete_documents(self, knowledge_base: str, document_ids: List[str]) -> Tuple[bool, str, Dict[str, Any]]:
        """删除文档"""
        pass


# ==================== Milvus 适配器 ====================

class BuiltinVectorAdapter(VectorDBAdapter):
    """Milvus 向量数据库适配器"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.host = config.get('host', 'localhost')
        self.port = config.get('port', 19530)
        self.uri = f"http://{self.host}:{self.port}"
        self._connection_alias = "default"
        self.logger.info(f"初始化 Milvus 适配器: {self.uri}")
    
    def _connect(self) -> bool:
        """连接到 Milvus"""
        try:
            from pymilvus import connections
            connections.connect(
                alias=self._connection_alias,
                host=self.host,
                port=self.port
            )
            self.logger.info(f"Milvus 连接成功: {self.uri}")
            return True
        except Exception as e:
            self.logger.error(f"连接 Milvus 失败: {e}")
            return False
    
    def _truncate_utf8(self, text: str, max_bytes: int) -> str:
        """截断字符串到指定字节数(UTF-8编码)"""
        if not text:
            return text
        
        encoded = text.encode('utf-8')
        if len(encoded) <= max_bytes:
            return text
        
        # 截断并移除不完整的多字节字符
        return encoded[:max_bytes].decode('utf-8', errors='ignore')
    
    def create_knowledge_base(self, name: str, dimension: int = 1024, **kwargs) -> Tuple[bool, str, Dict[str, Any]]:
        """创建知识库(Milvus Collection)"""
        try:
            from pymilvus import Collection, FieldSchema, CollectionSchema, DataType, utility
            
            if not self._connect():
                return False, "无法连接到 Milvus", {}
            
            # 如果已存在, 返回成功
            if utility.has_collection(name, using=self._connection_alias):
                self.logger.info(f"Collection {name} 已存在")
                return True, f"知识库 {name} 已存在", {'name': name, 'uri': self.uri}
            
            # 定义 Schema
            fields = [
                FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=36),
                FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=dimension),
                FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
                FieldSchema(name="document_id", dtype=DataType.VARCHAR, max_length=255)
            ]
            schema = CollectionSchema(fields, description=f"Knowledge base: {name}")
            
            # 创建 Collection
            collection = Collection(name=name, schema=schema, using=self._connection_alias)
            
            # 创建索引
            index_params = {
                "metric_type": "COSINE",
                "index_type": "HNSW",
                "params": {"M": 16, "efConstruction": 200}
            }
            collection.create_index(field_name="vector", index_params=index_params)
            
            self.logger.info(f"Collection {name} 创建成功, 维度: {dimension}")
            return True, f"知识库 {name} 创建成功", {'name': name, 'dimension': dimension, 'uri': self.uri}
            
        except Exception as e:
            self.logger.error(f"创建 Collection 失败: {e}")
            import traceback
            traceback.print_exc()
            return False, f"创建知识库失败: {str(e)}", {}
    
    def insert_vectors(self, knowledge_base: str, embeddings: List[List[float]], 
                      metadatas: List[Dict[str, Any]]) -> Tuple[bool, str, Dict[str, Any]]:
        """
        插入向量到数据库
        
        数据库存储层: 只负责存储, 不负责向量化
        """
        try:
            from pymilvus import Collection, utility
            
            if not embeddings:
                return False, "向量列表不能为空", {}
            
            if not metadatas or len(metadatas) != len(embeddings):
                return False, f"元数据数量必须与向量数量一致", {}
            
            if not self._connect():
                return False, "无法连接到 Milvus", {}
            
            self.logger.info(f"准备插入 {len(embeddings)} 个向量到 {knowledge_base}")
            
            # 获取向量维度
            vector_dimension = len(embeddings[0]) if embeddings else 0
            
            # 检查 Collection 是否存在, 不存在则创建
            if not utility.has_collection(knowledge_base, using=self._connection_alias):
                self.logger.info(f"Collection {knowledge_base} 不存在, 自动创建...")
                create_success, create_message, _ = self.create_knowledge_base(knowledge_base, vector_dimension)
                if not create_success:
                    return False, f"自动创建 Collection 失败: {create_message}", {}
            
            # 获取 Collection
            collection = Collection(knowledge_base, using=self._connection_alias)
            
            # 准备插入数据
            insert_data = [
                [metadata.get('chunk_id', '') for metadata in metadatas],  # id (主键: chunk_id)
                embeddings,  # vector
                [metadata.get('chunk_id', '')[:65535] for metadata in metadatas],  # content (用chunk_id占位)
                [self._truncate_utf8(metadata.get('document_id', ''), 36) for metadata in metadatas]  # document_id (真正的文档ID)
            ]
            
            # 插入
            self.logger.info(f"开始插入 {len(embeddings)} 条向量数据")
            insert_result = collection.insert(insert_data)
            collection.flush()
            
            self.logger.info(f"成功插入 {len(insert_result.primary_keys)} 条向量数据")
            
            return True, f"已添加 {len(insert_result.primary_keys)} 个文档到知识库", {
                'count': len(insert_result.primary_keys),
                'vector_dimension': vector_dimension,
                'uri': self.uri
            }
            
        except Exception as e:
            self.logger.error(f"插入向量失败: {e}")
            import traceback
            traceback.print_exc()
            return False, f"插入向量失败: {str(e)}", {}
    
    def search(self, knowledge_base: str, query: str, top_k: int = 5,
              filters: Optional[Dict[str, Any]] = None) -> Tuple[bool, Union[List[Dict[str, Any]], str], Dict[str, Any]]:
        """搜索知识库"""
        try:
            from pymilvus import Collection
            from app.services.vector_db.embedding_service import embedding_service
            
            if not self._connect():
                return False, "无法连接到 Milvus", {}
            
            collection = Collection(knowledge_base, using=self._connection_alias)
            collection.load()
            
            # 为查询生成向量
            self.logger.info(f"为查询生成向量: {query[:50]}...")
            success, query_embeddings, _ = embedding_service.generate_embeddings([query])
            if not success:
                return False, f"生成查询向量失败: {query_embeddings}", {}
            
            # 构建过滤表达式
            filter_expr = None
            if filters and 'file_path' in filters:
                filter_expr = f'document_id == "{filters["file_path"]}"'
            
            # 搜索
            self.logger.info(f"开始搜索, top_k: {top_k}")
            search_result = collection.search(
                data=[query_embeddings[0]],
                anns_field="vector",
                param={"metric_type": "COSINE", "params": {"ef": 200}},
                limit=top_k,
                expr=filter_expr,
                output_fields=["content", "document_id"]
            )
            
            # 解析结果
            results = []
            if search_result and len(search_result) > 0:
                for hit in search_result[0]:
                    results.append({
                        'id': hit.id,
                        'content': hit.entity.get('content', ''),
                        'score': float(hit.score),
                        'metadata': {'document_id': hit.entity.get('document_id', '')}
                    })
            
            self.logger.info(f"搜索完成, 找到 {len(results)} 条结果")
            return True, results, {'query': query, 'results_count': len(results)}
            
        except Exception as e:
            self.logger.error(f"搜索失败: {e}")
            import traceback
            traceback.print_exc()
            return False, f"搜索失败: {str(e)}", {}
    
    def delete_documents(self, knowledge_base: str, document_ids: List[str]) -> Tuple[bool, str, Dict[str, Any]]:
        """删除文档"""
        try:
            from pymilvus import Collection
            
            if not self._connect():
                return False, "无法连接到 Milvus", {}
            
            collection = Collection(knowledge_base, using=self._connection_alias)
            
            # 使用 ID 删除
            expr = f"id in {document_ids}"
            collection.delete(expr)
            collection.flush()
            
            self.logger.info(f"已删除 {len(document_ids)} 个文档")
            return True, f"已删除 {len(document_ids)} 个文档", {'deleted_count': len(document_ids)}
            
        except Exception as e:
            self.logger.error(f"删除文档失败: {e}")
            return False, f"删除失败: {str(e)}", {}
    
    def delete_by_metadata(self, knowledge_base: str, metadata_filter: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
        """按元数据删除文档"""
        try:
            from pymilvus import Collection, utility, MilvusException
            
            if not self._connect():
                return False, "无法连接到 Milvus", {}
            
            # 检查 Collection 是否存在
            if not utility.has_collection(knowledge_base, using=self._connection_alias):
                self.logger.info(f"Collection {knowledge_base} 不存在，无需删除")
                return True, "Collection 不存在，无需删除", {}
            
            collection = Collection(knowledge_base, using=self._connection_alias)
            
            # 加载 collection（确保可以执行删除操作）
            try:
                collection.load()
                self.logger.info(f"Collection {knowledge_base} 已加载")
            except Exception as load_error:
                # 如果加载失败，尝试继续（可能已经加载）
                self.logger.info(f"Collection {knowledge_base} 加载时出错（可能已加载）: {load_error}")
            
            # 构建删除表达式
            if 'document_id' in metadata_filter:
                # 按 document_id 删除
                document_id = metadata_filter['document_id']
                expr = f'document_id == "{document_id}"'
                
                # 先查询匹配的数量（用于日志）
                try:
                    query_result = collection.query(
                        expr=expr,
                        output_fields=["id"],
                        limit=10000
                    )
                    match_count = len(query_result)
                    self.logger.info(f"查询到 {match_count} 条匹配 document_id={document_id} 的向量")
                except Exception as query_error:
                    self.logger.warning(f"查询匹配数量失败: {query_error}")
                    match_count = -1
                
                try:
                    delete_result = collection.delete(expr)
                    collection.flush()
                    self.logger.info(f"已删除 document_id={document_id} 的向量，匹配数: {match_count}")
                    return True, f"已删除文档 {document_id} 的 {match_count if match_count >= 0 else '?'} 个向量", {}
                except MilvusException as me:
                    # 如果是 "collection not loaded" 错误，认为没有数据需要删除
                    if "not loaded" in str(me).lower():
                        self.logger.info(f"Collection 未加载或为空，无需删除")
                        return True, "Collection 未加载或为空，无需删除", {}
                    raise
            
            elif 'file_path' in metadata_filter:
                # 按 file_path 删除（兼容旧代码）
                file_path = metadata_filter['file_path']
                expr = f'document_id == "{file_path}"'
                try:
                    collection.delete(expr)
                    collection.flush()
                    self.logger.info(f"已删除文件 {file_path} 的向量")
                    return True, f"已删除文件 {file_path} 的向量", {}
                except MilvusException as me:
                    # 如果是 "collection not loaded" 错误，认为没有数据需要删除
                    if "not loaded" in str(me).lower():
                        self.logger.info(f"Collection 未加载或为空，无需删除")
                        return True, "Collection 未加载或为空，无需删除", {}
                    raise
            
            return False, "不支持的过滤条件（需要 document_id 或 file_path）", {}
            
        except Exception as e:
            self.logger.error(f"按元数据删除失败: {e}")
            import traceback
            traceback.print_exc()
            return False, f"删除失败: {str(e)}", {}
    
    def drop_collection(self, knowledge_base: str) -> Tuple[bool, str, Dict[str, Any]]:
        """删除整个 Collection"""
        try:
            from pymilvus import utility
            
            if not self._connect():
                return False, "无法连接到 Milvus", {}
            
            utility.drop_collection(knowledge_base, using=self._connection_alias)
            self.logger.info(f"已删除 Collection: {knowledge_base}")
            return True, f"已删除知识库 {knowledge_base}", {}
            
        except Exception as e:
            self.logger.error(f"删除 Collection 失败: {e}")
            return False, f"删除失败: {str(e)}", {}


# ==================== 服务层 ====================

class VectorDBService:
    """向量数据库统一服务"""
    
    def __init__(self):
        self._adapter = None
        self._initialize()
    
    def _initialize(self):
        """初始化向量数据库适配器"""
        try:
            from app.models import SystemSetting
            use_builtin = SystemSetting.get('use_builtin_vector_db', True)
            logger.debug(f"use_builtin_vector_db = {use_builtin}")
            
            if use_builtin:
                host = SystemSetting.get('builtin_vector_db_host', 'localhost')
                port = SystemSetting.get('builtin_vector_db_port', 19530)
                logger.info(f"初始化内置向量数据库: {host}:{port}")
                
                builtin_config = {
                    'host': host,
                    'port': port
                }
                self._adapter = BuiltinVectorAdapter(builtin_config)
                logger.info("向量数据库服务初始化成功")
            else:
                logger.warning("暂不支持外部向量数据库")
                self._adapter = None
                
        except Exception as e:
            logger.error(f"向量数据库服务初始化失败: {e}", exc_info=True)
            self._adapter = None
    
    def is_available(self) -> bool:
        """检查服务是否可用"""
        # 如果adapter未初始化，尝试重新初始化
        if self._adapter is None:
            logger.info("尝试重新初始化向量数据库服务")
            self._initialize()
        
        return self._adapter is not None
    
    def create_knowledge_base(self, name: str, dimension: int = 1024, **kwargs) -> Tuple[bool, str, Dict[str, Any]]:
        """创建知识库"""
        if not self._adapter:
            return False, "向量数据库服务不可用", {}
        return self._adapter.create_knowledge_base(name, dimension, **kwargs)
    
    def insert_vectors(self, knowledge_base: str, embeddings: List[List[float]], 
                      metadatas: List[Dict[str, Any]]) -> Tuple[bool, str, Dict[str, Any]]:
        """插入向量(推荐使用)"""
        if not self._adapter:
            return False, "向量数据库服务不可用", {}
        return self._adapter.insert_vectors(knowledge_base, embeddings, metadatas)
    
    def search(self, knowledge_base: str, query: str, top_k: int = 5, 
              filters: Optional[Dict[str, Any]] = None) -> Tuple[bool, Union[List[Dict[str, Any]], str], Dict[str, Any]]:
        """搜索知识库"""
        if not self._adapter:
            return False, "向量数据库服务不可用", {}
        return self._adapter.search(knowledge_base, query, top_k, filters)
    
    def delete_documents(self, knowledge_base: str, document_ids: List[str]) -> Tuple[bool, str, Dict[str, Any]]:
        """删除文档"""
        if not self._adapter:
            return False, "向量数据库服务不可用", {}
        return self._adapter.delete_documents(knowledge_base, document_ids)
    
    def delete_by_metadata(self, knowledge_base: str, metadata_filter: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
        """按元数据删除文档"""
        if not self._adapter:
            return False, "向量数据库服务不可用", {}
        
        if hasattr(self._adapter, 'delete_by_metadata'):
            return self._adapter.delete_by_metadata(knowledge_base, metadata_filter)
        
        return False, "适配器不支持按元数据删除", {}
    
    def drop_collection(self, knowledge_base: str) -> Tuple[bool, str, Dict[str, Any]]:
        """删除整个知识库"""
        if not self._adapter:
            return False, "向量数据库服务不可用", {}
        
        if hasattr(self._adapter, 'drop_collection'):
            return self._adapter.drop_collection(knowledge_base)
        
        return False, "适配器不支持删除知识库", {}


# 全局服务实例
vector_db_service = None

def get_vector_db_service():
    """获取向量数据库服务实例"""
    global vector_db_service
    if vector_db_service is None:
        vector_db_service = VectorDBService()
    return vector_db_service


def get_collection_name(knowledge_id: str) -> str:
    """将知识库ID转换为有效的Collection名称"""
    return f"knowledge_{knowledge_id.replace('-', '_')}"
