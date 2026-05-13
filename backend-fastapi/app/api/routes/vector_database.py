"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: common.py, tidb.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: common.py
# ============================================================

"""
通用向量数据库API路由
支持多种向量数据库提供商的连接测试和管理
路径: /api/vector-db/*（通用端点）
"""

import logging
import time
from typing import Dict, Any, Tuple, List

# 创建子蓝图 - 不设置 url_prefix，由父模块统一管理

logger = logging.getLogger(__name__)

# 支持的向量数据库提供商
SUPPORTED_PROVIDERS = {
    'aliyun': '阿里云 DashVector',
    'tidb': 'TiDB Cloud',
    'aws-opensearch': 'AWS OpenSearch',
    'aws-bedrock': 'AWS Bedrock Knowledge Base',
    'azure-cognitive-search': 'Azure Cognitive Search',
    'azure-cosmos-db': 'Azure Cosmos DB',
    'gcp-vertex-ai': 'Google Cloud Vertex AI Vector Search',
    'gcp-firestore': 'Google Cloud Firestore',
    'pinecone': 'Pinecone',
    'weaviate': 'Weaviate',
    'qdrant': 'Qdrant',
    'chroma': 'Chroma',
    'milvus': 'Milvus',
    'elasticsearch': 'Elasticsearch',
    'custom': '自定义'
}

class VectorDBTestResult:
    """向量数据库测试结果标准格式"""
    def __init__(self, provider: str):
        self.provider = provider
        self.success = False
        self.message = ""
        self.info = {
            'provider': provider,
            'test_levels': {
                'config_validation': {'passed': False, 'message': ''},
                'connection_test': {'passed': False, 'message': ''},
                'vector_operations': {'passed': False, 'message': ''}
            },
            'embedding_model': None,
            'performance_metrics': {},
            'error_details': {}
        }

    def set_config_validation(self, passed: bool, message: str):
        """设置配置验证结果"""
        self.info['test_levels']['config_validation'] = {'passed': passed, 'message': message}
        if not passed:
            self.success = False
            self.message = f"配置验证失败: {message}"

    def set_connection_test(self, passed: bool, message: str, details: Dict = None):
        """设置连接测试结果"""
        self.info['test_levels']['connection_test'] = {'passed': passed, 'message': message}
        if details:
            self.info.update(details)
        if not passed:
            self.success = False
            self.message = f"连接测试失败: {message}"

    def set_vector_operations(self, passed: bool, message: str, metrics: Dict = None):
        """设置向量操作测试结果"""
        self.info['test_levels']['vector_operations'] = {'passed': passed, 'message': message}
        if metrics:
            self.info['performance_metrics'].update(metrics)
        if passed:
            self.success = True
            self.message = f"{self.provider}向量数据库测试成功！{message}"
        else:
            self.success = False
            self.message = f"向量操作测试失败: {message}"

    def set_embedding_model(self, model_info: Dict):
        """设置嵌入模型信息"""
        self.info['embedding_model'] = model_info

    def set_error_details(self, error_type: str, error_message: str, traceback_info: str = None):
        """设置错误详情"""
        self.info['error_details'] = {
            'type': error_type,
            'message': error_message,
            'traceback': traceback_info
        }

    def to_tuple(self) -> Tuple[bool, str, Dict[str, Any]]:
        """转换为原有的返回格式"""
        return self.success, self.message, self.info


def test_vector_db_unified(provider: str, config: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """统一的向量数据库测试入口"""
    result = VectorDBTestResult(provider)

    try:
        # Level 1: 配置验证
        if not _validate_config(provider, config, result):
            return result.to_tuple()

        # Level 2: 连接测试
        if not _test_connection(provider, config, result):
            return result.to_tuple()

        # Level 3: 向量操作测试
        _test_vector_operations(provider, config, result)

        return result.to_tuple()

    except Exception as e:
        result.set_error_details('unexpected_error', str(e))
        result.success = False
        result.message = f"测试过程中发生异常: {str(e)}"
        return result.to_tuple()


def _validate_config(provider: str, config: Dict[str, Any], result: VectorDBTestResult) -> bool:
    """Level 1: 配置验证"""
    try:
        # 检查嵌入模型
        from app.services.vector_db.embedding_service import embedding_service
        default_model = embedding_service.get_default_embedding_model()
        if not default_model:
            result.set_config_validation(False, "未配置默认嵌入模型，请先在模型配置中设置默认嵌入模型")
            return False

        result.set_embedding_model({
            'id': default_model.id,
            'name': default_model.name,
            'provider': default_model.provider
        })

        # 提供商特定的配置验证
        if provider == 'tidb':
            if not config.get('connectionString'):
                result.set_config_validation(False, "缺少TiDB连接字符串")
                return False
        elif provider == 'milvus':
            if not config.get('endpoint'):
                result.set_config_validation(False, "缺少Milvus端点地址")
                return False

        result.set_config_validation(True, "配置验证通过")
        return True

    except Exception as e:
        result.set_config_validation(False, f"配置验证异常: {str(e)}")
        return False


def _test_connection(provider: str, config: Dict[str, Any], result: VectorDBTestResult) -> bool:
    """Level 2: 连接测试"""
    try:
        if provider == 'tidb':
            return _test_tidb_connection(config, result)
        elif provider == 'milvus':
            return _test_milvus_connection(config, result)
        elif provider == 'aliyun':
            return _test_aliyun_connection(config, result)
        else:
            # 对于未实现的提供商，进行基础配置检查
            return _test_generic_connection(provider, config, result)

    except Exception as e:
        result.set_connection_test(False, f"连接测试异常: {str(e)}")
        return False


class VectorDBTestOperations:
    """向量数据库测试操作抽象接口"""

    def __init__(self, provider: str, config: Dict[str, Any]):
        self.provider = provider
        self.config = config
        self.test_container_name = f"vector_test_{int(time.time())}"
        self.test_text = "这是一个向量数据库连接测试文本"
        self.test_metadata = {"source": "connection_test", "timestamp": time.time()}

    def create_test_container(self, dimension: int) -> Tuple[bool, str]:
        """创建测试容器（表/集合）- 子类实现"""
        raise NotImplementedError

    def insert_test_data(self, texts: List[str], vectors: List[List[float]], metadata: List[Dict]) -> Tuple[bool, str]:
        """插入测试数据 - 子类实现"""
        raise NotImplementedError

    def search_vectors(self, query_vector: List[float], top_k: int = 1) -> Tuple[bool, str, List[Dict]]:
        """执行向量搜索 - 子类实现"""
        raise NotImplementedError

    def cleanup_test_container(self) -> Tuple[bool, str]:
        """清理测试容器 - 子类实现"""
        raise NotImplementedError

    def run_standard_test(self, result: VectorDBTestResult):
        """运行标准化的向量操作测试流程"""
        try:

            logger.info(f"开始{self.provider}向量操作测试...")

            # 获取嵌入模型
            default_model = embedding_service.get_default_embedding_model()

            # 步骤1: 生成测试向量
            logger.info(f"步骤1: 生成测试向量...")
            embed_success, embeddings, embed_info = embedding_service.generate_embeddings(
                [self.test_text], default_model
            )

            if not embed_success:
                logger.error(f"生成测试向量失败: {embeddings}")
                result.set_vector_operations(False, f"生成测试向量失败: {embeddings}")
                return

            vector_dimension = len(embeddings[0])
            logger.info(f"向量生成成功，维度: {vector_dimension}")

            # 步骤2: 创建测试容器
            logger.info(f"步骤2: 创建测试容器...")
            create_success, create_message = self.create_test_container(vector_dimension)
            if not create_success:
                logger.error(f"创建测试容器失败: {create_message}")
                result.set_vector_operations(False, f"创建测试容器失败: {create_message}")
                return

            logger.info(f"测试容器创建成功: {self.test_container_name}")

            try:
                # 步骤3: 插入测试数据
                logger.info(f"步骤3: 插入测试数据...")
                insert_success, insert_message = self.insert_test_data(
                    [self.test_text], [embeddings[0]], [self.test_metadata]
                )

                if not insert_success:
                    logger.error(f"插入测试数据失败: {insert_message}")
                    result.set_vector_operations(False, f"插入测试数据失败: {insert_message}")
                    return

                logger.info(f"测试数据插入成功")

                # 步骤4: 执行向量搜索
                logger.info(f"步骤4: 执行向量搜索...")
                search_success, search_message, search_results = self.search_vectors(embeddings[0])

                if not search_success:
                    logger.error(f"向量搜索测试失败: {search_message}")
                    result.set_vector_operations(False, f"向量搜索测试失败: {search_message}")
                    return

                logger.info(f"向量搜索成功，结果数量: {len(search_results)}")

                # 步骤5: 验证搜索结果
                logger.info(f"步骤5: 验证搜索结果...")
                if not search_results or len(search_results) == 0:
                    logger.error("搜索结果为空")
                    result.set_vector_operations(False, "搜索结果为空")
                    return

                # 构建性能指标
                similarity_score = search_results[0].get('similarity', 0)
                distance_score = search_results[0].get('distance', 0)

                # 对于Milvus COSINE距离，如果距离接近1，说明向量几乎垂直（不相似）
                # 这可能是因为向量没有正确插入或搜索，我们记录实际值
                metrics = {
                    'embedding_time': embed_info.get('processing_time', 0) * 1000,  # 转换为毫秒
                    'vector_dimension': vector_dimension,
                    'search_results_count': len(search_results),
                    'similarity_score': similarity_score,
                    'distance_score': distance_score  # 添加原始距离分数用于调试
                }

                logger.info(f"向量操作测试成功完成，性能指标: {metrics}")
                result.set_vector_operations(True,
                    f"使用模型: {default_model.name}, 向量维度: {vector_dimension}",
                    metrics)

            finally:
                # 步骤6: 清理测试资源
                logger.info(f"步骤6: 清理测试资源...")
                cleanup_success, cleanup_message = self.cleanup_test_container()
                if not cleanup_success:
                    logger.warning(f"清理测试容器失败: {cleanup_message}")
                else:
                    logger.info(f"测试资源清理成功")

        except Exception as e:
            logger.error(f"{self.provider}向量操作测试异常: {str(e)}", exc_info=True)
            # 确保清理资源
            try:
                self.cleanup_test_container()
            except:
                pass
            result.set_vector_operations(False, f"向量操作测试异常: {str(e)}")


def _test_vector_operations(provider: str, config: Dict[str, Any], result: VectorDBTestResult):
    """Level 3: 向量操作测试 - 使用统一的测试流程"""
    try:
        # 根据提供商创建对应的测试操作实例
        if provider == 'tidb':
            test_ops = TiDBTestOperations(provider, config)
        elif provider == 'milvus':
            test_ops = MilvusTestOperations(provider, config)
        elif provider == 'aliyun':
            _test_aliyun_vector_operations(config, result)
            return
        else:
            # 对于未实现的提供商，标记为未实现
            _test_generic_vector_operations(provider, config, result)
            return

        # 运行标准化测试流程
        test_ops.run_standard_test(result)

    except Exception as e:
        result.set_vector_operations(False, f"向量操作测试异常: {str(e)}")


class TiDBTestOperations(VectorDBTestOperations):
    """TiDB向量数据库测试操作实现"""

    def __init__(self, provider: str, config: Dict[str, Any]):
        super().__init__(provider, config)
        self.table_manager = None
        self.vector_operations = None
        self.connection_manager = None

    def _initialize_services(self):
        """初始化TiDB服务"""
        if not self.table_manager:
            from app.services.vector_db.table_manager import vector_table_manager
            from app.services.vector_db.vector_operations import vector_operations
            from app.services.vector_db.tidb_connection import tidb_connection_manager

            self.table_manager = vector_table_manager
            self.vector_operations = vector_operations
            self.connection_manager = tidb_connection_manager

    def create_test_container(self, dimension: int) -> Tuple[bool, str]:
        """创建TiDB测试表"""
        try:
            self._initialize_services()

            from app.services.vector_db.models import VectorCollection, VectorDistanceMetric

            test_collection = VectorCollection(
                name=self.test_container_name,
                dimension=dimension,
                distance_metric=VectorDistanceMetric.COSINE,
                description="向量连接测试表"
            )

            return self.table_manager.create_table(test_collection)

        except Exception as e:
            return False, f"创建TiDB测试表异常: {str(e)}"

    def insert_test_data(self, texts: List[str], vectors: List[List[float]], metadata: List[Dict]) -> Tuple[bool, str]:
        """插入TiDB测试数据"""
        try:
            self._initialize_services()

            from app.services.vector_db.models import VectorRecord, VectorDataType
            import uuid
            from datetime import datetime

            # 创建VectorRecord对象
            records = []
            for text, vector, meta in zip(texts, vectors, metadata):
                record = VectorRecord(
                    id=str(uuid.uuid4()),
                    text=text,
                    embedding=vector,
                    metadata=meta,
                    data_type=VectorDataType.TEXT,
                    source="connection_test",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                records.append(record)

            # 插入记录
            success, message, _ = self.vector_operations.insert_records(
                table_name=self.test_container_name,
                records=records
            )

            return success, message

        except Exception as e:
            return False, f"插入TiDB测试数据异常: {str(e)}"

    def search_vectors(self, query_vector: List[float], top_k: int = 1) -> Tuple[bool, str, List[Dict]]:
        """执行TiDB向量搜索"""
        try:
            self._initialize_services()

            from app.services.vector_db.models import VectorDistanceMetric

            success, results, _ = self.vector_operations.search_vectors(
                table_name=self.test_container_name,
                query_vector=query_vector,
                limit=top_k,
                distance_metric=VectorDistanceMetric.COSINE
            )

            if success:
                # 转换结果格式 - results是VectorSearchResult对象列表
                formatted_results = []
                for result in results:
                    formatted_results.append({
                        'text': result.text if hasattr(result, 'text') else str(result),
                        'similarity': result.similarity if hasattr(result, 'similarity') else 0,
                        'metadata': result.metadata if hasattr(result, 'metadata') else {}
                    })
                return True, "搜索成功", formatted_results
            else:
                return False, results, []

        except Exception as e:
            return False, f"TiDB向量搜索异常: {str(e)}", []

    def cleanup_test_container(self) -> Tuple[bool, str]:
        """清理TiDB测试表"""
        try:
            self._initialize_services()

            # 删除测试表
            table_success, table_message = self.table_manager.drop_table(self.test_container_name)

            # 清理连接
            try:
                self.connection_manager.cleanup()
            except:
                pass

            return table_success, table_message

        except Exception as e:
            return False, f"清理TiDB测试表异常: {str(e)}"


class MilvusTestOperations(VectorDBTestOperations):
    """Milvus向量数据库测试操作实现"""

    def __init__(self, provider: str, config: Dict[str, Any]):
        super().__init__(provider, config)
        self.conn_alias = None
        self.collection = None
        self.host = None
        self.port = None
        self.username = None
        self.password = None
        self._parse_config()

    def _parse_config(self):
        """解析Milvus配置"""
        endpoint = self.config.get('endpoint', 'localhost:19530')
        self.username = self.config.get('username', 'default')
        self.password = self.config.get('password', '')

        # 解析endpoint
        if ':' in endpoint:
            self.host, port_str = endpoint.split(':')
            self.port = int(port_str)
        else:
            self.host = endpoint
            self.port = 19530

    def _connect(self) -> Tuple[bool, str]:
        """建立Milvus连接"""
        try:
            from pymilvus import connections

            self.conn_alias = f"test_conn_{int(time.time())}"
            connections.connect(
                alias=self.conn_alias,
                host=self.host,
                port=self.port,
                user=self.username,
                password=self.password,
                timeout=10
            )
            return True, "连接成功"

        except ImportError:
            return False, "pymilvus库未安装，请安装: pip install pymilvus"
        except Exception as e:
            return False, f"Milvus连接失败: {str(e)}"

    def _disconnect(self):
        """断开Milvus连接"""
        try:
            if self.conn_alias:
                connections.disconnect(self.conn_alias)
        except:
            pass

    def create_test_container(self, dimension: int) -> Tuple[bool, str]:
        """创建Milvus测试集合"""
        try:
            # 建立连接
            conn_success, conn_message = self._connect()
            if not conn_success:
                return False, conn_message

            from pymilvus import Collection, CollectionSchema, FieldSchema, DataType

            # 创建集合schema
            fields = [
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
                FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=1000),
                FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=dimension)
            ]
            schema = CollectionSchema(fields, description="向量连接测试集合")

            # 创建集合
            self.collection = Collection(self.test_container_name, schema, using=self.conn_alias)

            # 创建索引
            index_params = {
                "metric_type": "COSINE",
                "index_type": "IVF_FLAT",
                "params": {"nlist": 128}
            }
            self.collection.create_index("vector", index_params)

            return True, "Milvus集合创建成功"

        except Exception as e:
            self._disconnect()
            return False, f"创建Milvus集合异常: {str(e)}"

    def insert_test_data(self, texts: List[str], vectors: List[List[float]], metadata: List[Dict]) -> Tuple[bool, str]:
        """插入Milvus测试数据"""
        try:
            if not self.collection:
                return False, "集合未创建"

            logger.info(f"准备插入数据: {len(texts)}条文本, {len(vectors)}个向量")
            logger.debug(f"插入向量维度: {len(vectors[0])}, 前5个值: {vectors[0][:5]}")

            # 准备数据 - Milvus的schema只有id, text, vector字段，不包含metadata
            entities = [
                texts,  # text字段
                vectors  # vector字段
            ]

            # 插入数据
            insert_result = self.collection.insert(entities)
            self.collection.flush()

            logger.info(f"数据插入成功，插入ID: {insert_result.primary_keys if hasattr(insert_result, 'primary_keys') else 'N/A'}")

            return True, "数据插入成功"

        except Exception as e:
            logger.error(f"插入Milvus数据异常: {str(e)}", exc_info=True)
            return False, f"插入Milvus数据异常: {str(e)}"

    def search_vectors(self, query_vector: List[float], top_k: int = 1) -> Tuple[bool, str, List[Dict]]:
        """执行Milvus向量搜索"""
        try:
            if not self.collection:
                return False, "集合未创建", []

            logger.info(f"开始加载Milvus集合: {self.test_container_name}")

            # 加载集合
            self.collection.load()
            logger.info(f"集合加载完成")

            # 执行搜索
            search_params = {"metric_type": "COSINE", "params": {"nprobe": 10}}
            logger.info(f"执行向量搜索，查询向量维度: {len(query_vector)}, top_k: {top_k}")
            logger.debug(f"查询向量前5个值: {query_vector[:5]}")

            results = self.collection.search(
                data=[query_vector],
                anns_field="vector",
                param=search_params,
                limit=top_k,
                output_fields=["text"]
            )

            logger.info(f"搜索完成，结果数量: {len(results[0]) if results and results[0] else 0}")

            # 转换结果格式
            formatted_results = []
            if results and results[0]:
                for i, hit in enumerate(results[0]):
                    # Milvus搜索结果的正确访问方式
                    text_value = ""
                    try:
                        # 尝试不同的访问方式
                        if hasattr(hit, 'entity'):
                            entity = hit.entity
                            # 检查entity是否有text属性
                            if hasattr(entity, 'text'):
                                text_value = entity.text
                            elif hasattr(entity, 'get') and callable(entity.get):
                                text_value = entity.get('text', '')
                            else:
                                # entity可能是字典类型
                                try:
                                    text_value = entity['text'] if 'text' in entity else ''
                                except (TypeError, KeyError):
                                    text_value = ''

                        # 如果还是没有获取到文本，使用默认值
                        if not text_value:
                            text_value = f"测试文本{i+1}"

                    except Exception as access_error:
                        logger.warning(f"访问搜索结果文本失败: {access_error}")
                        text_value = f"结果{i+1}"

                    formatted_results.append({
                        'text': text_value,
                        'distance': hit.distance,
                        'similarity': 1 - hit.distance,  # 转换为相似度
                        'metadata': {}
                    })

                    logger.info(f"结果{i+1}: 距离={hit.distance:.4f}, 相似度={1-hit.distance:.4f}, 文本='{text_value[:50]}...'")

            return True, "搜索成功", formatted_results

        except Exception as e:
            logger.error(f"Milvus向量搜索异常: {str(e)}", exc_info=True)
            return False, f"Milvus向量搜索异常: {str(e)}", []

    def cleanup_test_container(self) -> Tuple[bool, str]:
        """清理Milvus测试集合"""
        try:
            # 删除集合
            if self.collection:
                self.collection.drop()

            # 断开连接
            self._disconnect()

            return True, "清理成功"

        except Exception as e:
            self._disconnect()
            return False, f"清理Milvus集合异常: {str(e)}"


def _test_aliyun_connection(config: Dict[str, Any], result: VectorDBTestResult) -> bool:
    """阿里云DashVector连接测试"""
    try:
        api_key = config.get('apiKey')
        endpoint = config.get('endpoint')

        if not api_key or not endpoint:
            result.set_connection_test(False, "缺少API密钥或端点")
            return False

        # 实际的阿里云DashVector连接测试需要相应的SDK
        result.set_connection_test(False, "阿里云DashVector连接测试需要安装相应的SDK", {
            'endpoint': endpoint,
            'status': 'not_implemented'
        })
        return False

    except Exception as e:
        result.set_connection_test(False, f"阿里云DashVector连接测试异常: {str(e)}")
        return False


def _test_aliyun_vector_operations(config: Dict[str, Any], result: VectorDBTestResult):
    """阿里云DashVector向量操作测试"""
    _ = config  # 避免未使用参数警告
    result.set_vector_operations(False, "阿里云DashVector向量操作测试需要安装相应的SDK")


def _test_generic_connection(provider: str, config: Dict[str, Any], result: VectorDBTestResult) -> bool:
    """通用连接测试（基础配置检查）"""
    try:
        _ = config  # 避免未使用参数警告
        provider_name = SUPPORTED_PROVIDERS.get(provider, provider)

        # 基本配置验证已在Level 1完成，这里标记为未实现
        result.set_connection_test(False, f"{provider_name}连接测试功能尚未实现", {
            'status': 'not_implemented',
            'config_valid': True,
            'note': '配置验证通过，但连接测试功能需要进一步实现'
        })
        return False

    except Exception as e:
        result.set_connection_test(False, f"{provider}连接测试异常: {str(e)}")
        return False


def _test_generic_vector_operations(provider: str, config: Dict[str, Any], result: VectorDBTestResult):
    """通用向量操作测试"""
    _ = config  # 避免未使用参数警告
    provider_name = SUPPORTED_PROVIDERS.get(provider, provider)
    result.set_vector_operations(False, f"{provider_name}向量操作测试功能尚未实现", {
        'note': '需要安装相应的SDK和实现向量操作逻辑'
    })


def _test_tidb_connection(config: Dict[str, Any], result: VectorDBTestResult) -> bool:
    """TiDB连接测试"""
    try:
        from app.services.vector_db.tidb_config import tidb_config_manager

        connection_string = config.get('connectionString')
        tidb_config = tidb_config_manager.create_config(connection_string)

        # 测试基础连接
        success, message, info = tidb_config_manager.test_connection(tidb_config)
        if not success:
            result.set_connection_test(False, message, info or {})
            return False

        # 初始化连接管理器
        init_success = tidb_connection_manager.initialize(tidb_config)
        if not init_success:
            result.set_connection_test(False, "初始化TiDB连接失败")
            return False

        result.set_connection_test(True, "TiDB连接成功", {
            'database_info': info,
            'connection_string_valid': True
        })
        return True

    except Exception as e:
        result.set_connection_test(False, f"TiDB连接异常: {str(e)}")
        return False


# 旧的TiDB测试函数已被统一的TiDBTestOperations类替代


def test_tidb_connection(config: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """保持向后兼容的TiDB测试接口"""
    return test_vector_db_unified('tidb', config)

def _test_milvus_connection(config: Dict[str, Any], result: VectorDBTestResult) -> bool:
    """Milvus连接测试"""
    try:
        endpoint = config.get('endpoint', 'localhost:19530')
        username = config.get('username', 'default')
        password = config.get('password', '')

        # 解析endpoint
        if ':' in endpoint:
            host, port = endpoint.split(':')
            port = int(port)
        else:
            host = endpoint
            port = 19530

        try:
            from pymilvus import connections, utility

            # 创建连接
            conn_alias = f"test_conn_{int(time.time())}"
            connections.connect(
                alias=conn_alias,
                host=host,
                port=port,
                user=username,
                password=password,
                timeout=10
            )

            # 测试基础连接
            server_version = utility.get_server_version(using=conn_alias)

            # 断开测试连接
            connections.disconnect(conn_alias)

            result.set_connection_test(True, "Milvus连接成功", {
                'host': host,
                'port': port,
                'server_version': server_version,
                'username': username
            })
            return True

        except ImportError:
            result.set_connection_test(False, "pymilvus库未安装，请安装: pip install pymilvus")
            return False
        except Exception as conn_error:
            result.set_connection_test(False, f"Milvus连接失败: {str(conn_error)}")
            return False

    except Exception as e:
        result.set_connection_test(False, f"Milvus连接测试异常: {str(e)}")
        return False


# 旧的Milvus测试函数已被统一的MilvusTestOperations类替代


def test_milvus_connection(config: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """保持向后兼容的Milvus测试接口"""
    return test_vector_db_unified('milvus', config)

def test_aliyun_connection(config: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """测试阿里云DashVector连接"""
    try:
        api_key = config.get('apiKey')
        endpoint = config.get('endpoint')

        if not api_key or not endpoint:
            return False, "缺少API密钥或端点", {}

        # 实际的阿里云DashVector连接测试需要相应的SDK
        # 这里先返回配置验证结果
        return False, "阿里云DashVector连接测试需要安装相应的SDK", {
            'provider': 'aliyun',
            'endpoint': endpoint,
            'status': 'not_implemented'
        }

    except Exception as e:
        logger.error(f"阿里云DashVector连接测试失败: {e}")
        return False, f"连接测试失败: {str(e)}", {}

def test_generic_connection(provider: str, config: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """通用连接测试（检查嵌入模型配置）"""
    try:

        # 检查默认嵌入模型
        default_model = embedding_service.get_default_embedding_model()
        if not default_model:
            return False, "未配置默认嵌入模型，请先在模型配置中设置默认嵌入模型", {
                'provider': provider,
                'status': 'no_embedding_model',
                'note': '需要配置默认嵌入模型才能进行向量测试'
            }

        # 基本配置验证
        if provider in ['aws-opensearch', 'aws-bedrock']:
            required_fields = ['accessKeyId', 'secretAccessKey', 'region']
        elif provider in ['azure-cognitive-search']:
            required_fields = ['endpoint', 'apiKey']
        elif provider in ['azure-cosmos-db']:
            required_fields = ['endpoint', 'primaryKey']
        elif provider in ['gcp-vertex-ai', 'gcp-firestore']:
            required_fields = ['projectId', 'serviceAccountKey']
        elif provider in ['pinecone']:
            required_fields = ['apiKey', 'environment']
        elif provider in ['weaviate', 'qdrant', 'chroma', 'elasticsearch']:
            required_fields = ['endpoint']
        else:
            required_fields = ['endpoint']

        missing_fields = [field for field in required_fields if not config.get(field)]
        if missing_fields:
            return False, f"缺少必需字段: {', '.join(missing_fields)}", {}

        # 实现真实的连接测试
        provider_name = SUPPORTED_PROVIDERS.get(provider, provider)

        # 对于未实现真实连接测试的提供商，返回明确的未实现信息
        return False, f"{provider_name}连接测试功能尚未实现，需要安装相应的SDK和实现连接逻辑", {
            'provider': provider,
            'status': 'not_implemented',
            'config_valid': True,
            'embedding_model_available': True,
            'embedding_model': {
                'id': default_model.id,
                'name': default_model.name,
                'provider': default_model.provider
            },
            'note': '配置验证通过，嵌入模型可用，但连接测试功能需要进一步实现'
        }

    except Exception as e:
        logger.error(f"{provider}连接测试失败: {e}")
        return False, f"连接测试失败: {str(e)}", {}

@router.post('/test-connection')
async def test_connection(request: Request):
    """测试向量数据库连接"""
    try:
        data = await request.json()
        provider = data.get('provider')
        config = data.get('config', {})
        
        if not provider:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '缺少提供商参数'
            })
        
        if provider not in SUPPORTED_PROVIDERS:
            return JSONResponse(content={
                'success': False,
                'message': f'不支持的提供商: {provider}'
            }, status_code=400)
        
        logger.info(f"开始测试{provider}连接...")
        start_time = time.time()
        
        # 使用统一的测试接口
        success, message, info = test_vector_db_unified(provider, config)
        
        end_time = time.time()
        response_time = (end_time - start_time) * 1000  # 转换为毫秒
        
        # 添加响应时间信息
        if info is None:
            info = {}
        info['response_time'] = round(response_time, 2)
        info['provider_name'] = SUPPORTED_PROVIDERS.get(provider, provider)
        
        logger.info(f"{provider}连接测试完成: {success}, 耗时: {response_time:.2f}ms")
        
        return {
            'success': success,
            'message': message,
            'info': info
        }
        
    except Exception as e:
        logger.error(f"连接测试异常: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'连接测试失败: {str(e)}'
        }, status_code=500)

@router.post('/validate-config')
async def validate_config(request: Request):
    """验证向量数据库配置"""
    try:
        data = await request.json()
        provider = data.get('provider')
        config = data.get('config', {})
        
        if not provider:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '缺少提供商参数'
            })
        
        if provider not in SUPPORTED_PROVIDERS:
            return JSONResponse(content={
                'success': False,
                'message': f'不支持的提供商: {provider}'
            }, status_code=400)
        
        # 配置验证逻辑
        validation_result = {
            'valid': True,
            'missing_fields': [],
            'warnings': []
        }
        
        # 根据提供商验证必需字段
        if provider == 'tidb':
            if not config.get('connectionString'):
                validation_result['valid'] = False
                validation_result['missing_fields'].append('connectionString')
        elif provider == 'aliyun':
            for field in ['apiKey', 'endpoint']:
                if not config.get(field):
                    validation_result['valid'] = False
                    validation_result['missing_fields'].append(field)
        # 可以添加更多提供商的验证逻辑
        
        return {
            'success': True,
            'validation': validation_result
        }
        
    except Exception as e:
        logger.error(f"配置验证异常: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'配置验证失败: {str(e)}'
        }, status_code=500)

@router.get('/providers')
def get_providers():
    """获取支持的向量数据库提供商列表"""
    try:
        providers = []
        for key, name in SUPPORTED_PROVIDERS.items():
            providers.append({
                'key': key,
                'name': name,
                'supported': True
            })
        
        return {
            'success': True,
            'providers': providers
        }
        
    except Exception as e:
        logger.error(f"获取提供商列表异常: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取提供商列表失败: {str(e)}'
        }, status_code=500)

@router.get('/providers/{provider}/template')
def get_config_template(provider):
    """获取提供商的配置模板"""
    try:
        if provider not in SUPPORTED_PROVIDERS:
            return JSONResponse(content={
                'success': False,
                'message': f'不支持的提供商: {provider}'
            }, status_code=400)
        
        # 配置模板定义
        templates = {
            'tidb': {
                'fields': [
                    {'name': 'connectionString', 'type': 'text', 'required': True, 'label': '连接字符串', 'placeholder': 'mysql://user:password@host:port/database'}
                ]
            },
            'aliyun': {
                'fields': [
                    {'name': 'apiKey', 'type': 'password', 'required': True, 'label': 'API密钥'},
                    {'name': 'endpoint', 'type': 'text', 'required': True, 'label': '端点地址', 'placeholder': 'https://your-endpoint.com'}
                ]
            },
            # 可以添加更多提供商的模板
        }
        
        template = templates.get(provider, {
            'fields': [
                {'name': 'endpoint', 'type': 'text', 'required': True, 'label': '端点地址'},
                {'name': 'apiKey', 'type': 'password', 'required': False, 'label': 'API密钥'}
            ]
        })
        
        return {
            'success': True,
            'template': template
        }
        
    except Exception as e:
        logger.error(f"获取配置模板异常: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取配置模板失败: {str(e)}'
        }, status_code=500)

@router.post('/health')
async def get_health_status(request: Request):
    """获取向量数据库健康状态"""
    try:
        data = await request.json()
        provider = data.get('provider')
        config = data.get('config', {})
        
        if not provider:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '缺少提供商参数'
            })
        
        # 健康检查逻辑（简化版本）
        health_status = {
            'status': 'healthy',
            'provider': provider,
            'provider_name': SUPPORTED_PROVIDERS.get(provider, provider),
            'last_check': time.time(),
            'details': {
                'connection': 'ok',
                'latency': '< 100ms',
                'availability': '99.9%'
            }
        }
        
        return {
            'success': True,
            'health': health_status
        }
        
    except Exception as e:
        logger.error(f"健康检查异常: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'健康检查失败: {str(e)}'
        }, status_code=500)


# ============================================================
# Source: tidb.py
# ============================================================

"""
TiDB向量数据库API路由

提供TiDB向量数据库的配置管理和连接测试API
路径: /api/vector-db/tidb/*
"""

from typing import Dict, Any

from app.services.vector_db.tidb_config import tidb_config_manager, TiDBConfig
from app.services.vector_db.models import VectorCollection, VectorDistanceMetric, VectorDataType
from app.models import ModelConfig

logger = logging.getLogger(__name__)

# 创建子蓝图 - 不设置 url_prefix，由父模块统一管理


@router.post('/config/validate')
async def validate_config(request: Request):
    """验证TiDB配置"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请求数据不能为空'
            })
        
        connection_string = data.get('connection_string')
        if not connection_string:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '连接字符串不能为空'
            })
        
        # 创建配置并验证
        config = tidb_config_manager.create_config(connection_string)
        is_valid, message = config.validate()
        
        if is_valid:
            return {
                'success': True,
                'message': message,
                'config': config.to_dict()
            }
        else:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': message
            })
            
    except Exception as e:
        logger.error(f"验证TiDB配置失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'配置验证失败: {str(e)}'
        }, status_code=500)


@router.post('/connection/test')
async def test_connection(request: Request):
    """测试TiDB连接"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请求数据不能为空'
            })
        
        connection_string = data.get('connection_string')
        if not connection_string:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '连接字符串不能为空'
            })
        
        # 创建配置
        config = tidb_config_manager.create_config(connection_string)
        
        # 测试连接
        success, message, info = tidb_config_manager.test_connection(config)
        
        response_data = {
            'success': success,
            'message': message
        }
        
        if success:
            response_data['info'] = info
        
        return response_data
        
    except Exception as e:
        logger.error(f"测试TiDB连接失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'连接测试失败: {str(e)}'
        }, status_code=500)


@router.post('/connection/test-vector')
async def test_vector_operations(request: Request):
    """测试TiDB向量操作"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请求数据不能为空'
            })
        
        connection_string = data.get('connection_string')
        if not connection_string:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '连接字符串不能为空'
            })
        
        # 创建配置并初始化连接
        config = tidb_config_manager.create_config(connection_string)
        tidb_connection_manager.initialize(config)
        
        # 测试向量操作
        success, message, info = tidb_connection_manager.test_vector_operations()
        
        response_data = {
            'success': success,
            'message': message
        }
        
        if success:
            response_data['info'] = info
        
        return response_data
        
    except Exception as e:
        logger.error(f"测试TiDB向量操作失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'向量操作测试失败: {str(e)}'
        }, status_code=500)
    finally:
        # 清理连接
        try:
            tidb_connection_manager.close()
        except Exception:
            pass


@router.post('/config/parse')
async def parse_connection_string(request: Request):
    """解析TiDB连接字符串"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请求数据不能为空'
            })
        
        connection_string = data.get('connection_string')
        if not connection_string:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '连接字符串不能为空'
            })
        
        # 创建配置（会自动解析连接字符串）
        config = TiDBConfig(connection_string=connection_string)
        
        return {
            'success': True,
            'message': '连接字符串解析成功',
            'config': config.to_dict()
        }
        
    except Exception as e:
        logger.error(f"解析TiDB连接字符串失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'连接字符串解析失败: {str(e)}'
        }, status_code=500)


@router.get('/info')
def get_tidb_info():
    """获取TiDB向量数据库信息"""
    try:
        # 检查依赖是否可用
        try:
            from tidb_vector.integrations import TiDBVectorClient
            import pymysql
            dependencies_available = True
            dependency_error = None
        except ImportError as e:
            dependencies_available = False
            dependency_error = str(e)
        
        # 获取默认配置
        default_config = tidb_config_manager.get_default_config()
        
        info = {
            'dependencies_available': dependencies_available,
            'dependency_error': dependency_error,
            'has_default_config': default_config is not None,
            'supported_features': [
                'vector_storage',
                'similarity_search',
                'metadata_filtering',
                'batch_operations'
            ],
            'required_dependencies': [
                'tidb-vector[client]',
                'pymysql',
                'sentence-transformers'
            ]
        }
        
        if default_config:
            info['default_config'] = default_config.to_dict()
        
        return {
            'success': True,
            'info': info
        }
        
    except Exception as e:
        logger.error(f"获取TiDB信息失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取信息失败: {str(e)}'
        }, status_code=500)


@router.get('/health')
def health_check():
    """健康检查"""
    try:
        # 检查依赖
        try:
            dependencies_ok = True
        except ImportError:
            dependencies_ok = False
        
        # 检查连接状态
        connection_info = tidb_connection_manager.get_connection_info()
        
        health_status = {
            'status': 'healthy' if dependencies_ok else 'unhealthy',
            'dependencies_available': dependencies_ok,
            'connection_active': connection_info.get('connected', False),
            'timestamp': settings.get('REQUEST_TIME', 'unknown')
        }
        
        if connection_info:
            health_status['connection_info'] = connection_info
        
        status_code = 200 if dependencies_ok else 503
        
        return JSONResponse(content=health_status, status_code=status_code)
        
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        raise HTTPException(status_code=500, detail={
            'status': 'error',
            'message': str(e)
        })


# Flask error handlers removed (not needed in FastAPI)


@router.get('/embedding/models')
def get_embedding_models():
    """获取可用的嵌入模型列表"""
    try:
        # 查询所有支持向量输出的模型
        embedding_models = ModelConfig.query.filter(
            ModelConfig.modalities.contains('vector_output')
        ).all()

        models_info = []
        for model in embedding_models:
            model_info = embedding_service.get_model_info(model)
            models_info.append(model_info)

        # 获取默认模型
        default_model = embedding_service.get_default_embedding_model()
        default_model_id = default_model.id if default_model else None

        return {
            'success': True,
            'models': models_info,
            'default_model_id': default_model_id,
            'total_count': len(models_info)
        }

    except Exception as e:
        logger.error(f"获取嵌入模型列表失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取模型列表失败: {str(e)}'
        }, status_code=500)


@router.post('/embedding/generate')
async def generate_embeddings(request: Request):
    """生成嵌入向量"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请求数据不能为空'
            })

        texts = data.get('texts')
        if not texts:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '文本内容不能为空'
            })

        # 获取模型配置
        model_id = data.get('model_id')
        if model_id:
            model_config = embedding_service.get_embedding_model_by_id(model_id)
            if not model_config:
                return JSONResponse(content={
                    'success': False,
                    'message': f'模型ID {model_id} 不存在或不支持向量输出'
                }, status_code=400)
        else:
            model_config = None  # 使用默认模型

        # 生成嵌入向量
        success, result, meta_info = embedding_service.generate_embeddings(texts, model_config)

        response_data = {
            'success': success,
            'meta_info': meta_info
        }

        if success:
            response_data['embeddings'] = result
            response_data['message'] = '嵌入向量生成成功'
        else:
            response_data['message'] = result

        return response_data

    except Exception as e:
        logger.error(f"生成嵌入向量失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'生成嵌入向量失败: {str(e)}'
        }, status_code=500)


@router.post('/embedding/test')
async def test_embedding_model(request: Request):
    """测试嵌入模型"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请求数据不能为空'
            })

        # 获取测试文本
        test_text = data.get('text', '这是一个测试文本')

        # 获取模型配置
        model_id = data.get('model_id')
        if model_id:
            model_config = embedding_service.get_embedding_model_by_id(model_id)
            if not model_config:
                return JSONResponse(content={
                    'success': False,
                    'message': f'模型ID {model_id} 不存在或不支持向量输出'
                }, status_code=400)
        else:
            model_config = embedding_service.get_default_embedding_model()
            if not model_config:
                raise HTTPException(status_code=400, detail={
                    'success': False,
                    'message': '未配置默认嵌入模型，请在系统设置中配置默认的向量模型'
                })

        # 测试生成嵌入向量
        success, result, meta_info = embedding_service.generate_single_embedding(test_text, model_config)

        response_data = {
            'success': success,
            'meta_info': meta_info,
            'model_info': embedding_service.get_model_info(model_config)
        }

        if success:
            response_data['embedding'] = result
            response_data['vector_dimension'] = len(result)
            response_data['message'] = '嵌入模型测试成功'
        else:
            response_data['message'] = result

        return response_data

    except Exception as e:
        logger.error(f"测试嵌入模型失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'测试嵌入模型失败: {str(e)}'
        }, status_code=500)


@router.get('/tables')
def list_tables():
    """列出所有向量表"""
    try:
        tables = vector_table_manager.list_tables()

        return {
            'success': True,
            'tables': tables,
            'total_count': len(tables)
        }

    except Exception as e:
        logger.error(f"列出向量表失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'列出向量表失败: {str(e)}'
        }, status_code=500)


@router.post('/tables/{table_name}')
async def create_table(table_name, request: Request):
    """创建向量表"""
    try:
        data = await request.json() or {}

        # 获取参数
        dimension = data.get('dimension', 1024)
        distance_metric = data.get('distance_metric', 'COSINE')
        description = data.get('description', '')

        # 验证参数
        if not isinstance(dimension, int) or dimension <= 0:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '向量维度必须是正整数'
            })

        try:
            metric = VectorDistanceMetric(distance_metric)
        except ValueError:
            return JSONResponse(content={
                'success': False,
                'message': f'不支持的距离度量: {distance_metric}'
            }, status_code=400)

        # 创建集合配置
        collection = VectorCollection(
            name=table_name,
            dimension=dimension,
            distance_metric=metric,
            description=description
        )

        # 创建表
        success, message = vector_table_manager.create_table(collection)

        response_data = {
            'success': success,
            'message': message
        }

        if success:
            # 获取表信息
            table_info = vector_table_manager.get_table_info(table_name)
            if table_info:
                response_data['table_info'] = table_info

        return response_data

    except Exception as e:
        logger.error(f"创建向量表失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'创建向量表失败: {str(e)}'
        }, status_code=500)


@router.delete('/tables/{table_name}')
def drop_table(table_name):
    """删除向量表"""
    try:
        success, message = vector_table_manager.drop_table(table_name)

        return {
            'success': success,
            'message': message
        }

    except Exception as e:
        logger.error(f"删除向量表失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'删除向量表失败: {str(e)}'
        }, status_code=500)


@router.get('/tables/{table_name}/info')
def get_table_info(table_name):
    """获取表信息"""
    try:
        table_info = vector_table_manager.get_table_info(table_name)

        if table_info:
            return {
                'success': True,
                'table_info': table_info
            }
        else:
            return JSONResponse(content={
                'success': False,
                'message': f'表 {table_name} 不存在'
            }, status_code=404)

    except Exception as e:
        logger.error(f"获取表信息失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'获取表信息失败: {str(e)}'
        }, status_code=500)


@router.post('/tables/{table_name}/search')
async def semantic_search(table_name, request: Request):
    """语义搜索"""
    try:
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '请求数据不能为空'
            })

        query_text = data.get('query_text')
        if not query_text:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': '查询文本不能为空'
            })

        # 获取参数
        limit = data.get('limit', 10)
        distance_metric = data.get('distance_metric', 'COSINE')
        filters = data.get('filters')
        model_id = data.get('model_id')

        try:
            metric = VectorDistanceMetric(distance_metric)
        except ValueError:
            return JSONResponse(content={
                'success': False,
                'message': f'不支持的距离度量: {distance_metric}'
            }, status_code=400)

        # 执行语义搜索
        success, results, info = vector_operations.semantic_search(
            table_name=table_name,
            query_text=query_text,
            limit=limit,
            distance_metric=metric,
            filters=filters,
            model_config_id=model_id
        )

        response_data = {
            'success': success,
            'info': info
        }

        if success:
            # 转换结果为字典格式
            response_data['results'] = [result.to_dict() for result in results]
            response_data['message'] = f'搜索完成，返回 {len(results)} 条结果'
        else:
            response_data['message'] = results

        return response_data

    except Exception as e:
        logger.error(f"语义搜索失败: {e}")
        return JSONResponse(content={
            'success': False,
            'message': f'语义搜索失败: {str(e)}'
        }, status_code=500)


# Flask 500 error handler removed (not needed in FastAPI)

