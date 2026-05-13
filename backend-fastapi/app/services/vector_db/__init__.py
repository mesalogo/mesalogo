"""
TiDB向量数据库服务模块

提供TiDB向量数据库的完整功能，包括连接管理、向量操作、嵌入服务等
"""

import logging
from typing import Optional, Tuple, Dict, Any

from .tidb_vector_service import tidb_vector_service
from .tidb_config import tidb_config_manager
from .embedding_service import embedding_service
from .models import VectorDistanceMetric, VectorDataType

logger = logging.getLogger(__name__)

# 导出主要的类和函数
__all__ = [
    'tidb_vector_service',
    'tidb_config_manager', 
    'embedding_service',
    'VectorDistanceMetric',
    'VectorDataType',
    'initialize_vector_db',
    'get_vector_db_status',
    'is_vector_db_available'
]


def initialize_vector_db(connection_string: Optional[str] = None) -> Tuple[bool, str]:
    """
    初始化TiDB向量数据库服务
    
    Args:
        connection_string: TiDB连接字符串，如果为None则尝试从环境变量获取
        
    Returns:
        (成功标志, 消息)
    """
    try:
        # 如果没有提供连接字符串，尝试从环境变量获取
        if not connection_string:
            default_config = tidb_config_manager.get_default_config()
            if default_config:
                connection_string = default_config.connection_string
            else:
                return False, "未提供连接字符串且未找到默认配置"
        
        # 初始化服务
        success, message = tidb_vector_service.initialize(connection_string)
        
        if success:
            logger.info("TiDB向量数据库服务初始化成功")
        else:
            logger.error(f"TiDB向量数据库服务初始化失败: {message}")
        
        return success, message
        
    except Exception as e:
        error_msg = f"初始化向量数据库服务失败: {str(e)}"
        logger.error(error_msg)
        return False, error_msg


def get_vector_db_status() -> Dict[str, Any]:
    """
    获取向量数据库服务状态
    
    Returns:
        服务状态信息
    """
    try:
        return tidb_vector_service.get_service_status()
    except Exception as e:
        logger.error(f"获取向量数据库状态失败: {e}")
        return {
            'initialized': False,
            'error': str(e)
        }


def is_vector_db_available() -> bool:
    """
    检查向量数据库是否可用
    
    Returns:
        是否可用
    """
    try:
        status = get_vector_db_status()
        return (
            status.get('initialized', False) and 
            status.get('connection_active', False) and
            status.get('embedding_models_available', False)
        )
    except Exception as e:
        logger.error(f"检查向量数据库可用性失败: {e}")
        return False


def create_default_knowledge_bases() -> Tuple[bool, str, Dict[str, Any]]:
    """
    创建默认的知识库
    
    Returns:
        (成功标志, 消息, 详细信息)
    """
    try:
        if not tidb_vector_service.is_initialized():
            return False, "向量数据库服务未初始化", {}
        
        # 定义默认知识库
        default_knowledge_bases = [
            {
                'name': 'documents',
                'dimension': 1024,
                'description': '文档知识库'
            },
            {
                'name': 'conversations', 
                'dimension': 1024,
                'description': '对话历史知识库'
            },
            {
                'name': 'knowledge_base',
                'dimension': 1536,
                'description': '通用知识库'
            }
        ]
        
        results = []
        success_count = 0
        
        for kb_config in default_knowledge_bases:
            success, message, info = tidb_vector_service.create_knowledge_base(
                name=kb_config['name'],
                dimension=kb_config['dimension'],
                description=kb_config['description']
            )
            
            results.append({
                'name': kb_config['name'],
                'success': success,
                'message': message,
                'info': info
            })
            
            if success:
                success_count += 1
        
        overall_success = success_count > 0
        overall_message = f"创建默认知识库完成: {success_count}/{len(default_knowledge_bases)} 个成功"
        
        detailed_info = {
            'total_count': len(default_knowledge_bases),
            'success_count': success_count,
            'results': results
        }
        
        logger.info(overall_message)
        return overall_success, overall_message, detailed_info
        
    except Exception as e:
        error_msg = f"创建默认知识库失败: {str(e)}"
        logger.error(error_msg)
        return False, error_msg, {}


def cleanup_vector_db():
    """清理向量数据库服务"""
    try:
        tidb_vector_service.close()
        embedding_service.clear_model_cache()
        logger.info("向量数据库服务清理完成")
    except Exception as e:
        logger.error(f"清理向量数据库服务失败: {e}")


# 模块级别的初始化检查
def _check_dependencies():
    """检查依赖是否可用"""
    try:
        import tidb_vector
        import pymysql
        import sentence_transformers
        return True, "所有依赖可用"
    except ImportError as e:
        return False, f"缺少依赖: {str(e)}"


# 检查依赖
DEPENDENCIES_AVAILABLE, DEPENDENCY_ERROR = _check_dependencies()

if not DEPENDENCIES_AVAILABLE:
    logger.warning(f"TiDB向量数据库依赖不完整: {DEPENDENCY_ERROR}")
else:
    logger.debug("TiDB向量数据库依赖检查通过")


# 提供便捷的访问接口
class VectorDB:
    """向量数据库便捷访问接口"""
    
    @staticmethod
    def initialize(connection_string: Optional[str] = None) -> Tuple[bool, str]:
        """初始化向量数据库"""
        return initialize_vector_db(connection_string)
    
    @staticmethod
    def is_available() -> bool:
        """检查是否可用"""
        return is_vector_db_available()
    
    @staticmethod
    def get_status() -> Dict[str, Any]:
        """获取状态"""
        return get_vector_db_status()
    
    @staticmethod
    def create_knowledge_base(name: str, dimension: int = 1024, description: str = None) -> Tuple[bool, str, Dict[str, Any]]:
        """创建知识库"""
        return tidb_vector_service.create_knowledge_base(name, dimension, description=description)
    
    @staticmethod
    def add_documents(knowledge_base: str, documents: list, metadatas: list = None, source: str = None) -> Tuple[bool, str, Dict[str, Any]]:
        """添加文档"""
        return tidb_vector_service.add_documents(knowledge_base, documents, metadatas, source)
    
    @staticmethod
    def search(knowledge_base: str, query: str, top_k: int = 5, filters: dict = None) -> Tuple[bool, Any, Dict[str, Any]]:
        """搜索知识库"""
        return tidb_vector_service.search_knowledge(knowledge_base, query, top_k, filters)
    
    @staticmethod
    def delete_documents(knowledge_base: str, document_ids: list) -> Tuple[bool, str, Dict[str, Any]]:
        """删除文档"""
        return tidb_vector_service.delete_documents(knowledge_base, document_ids)
    
    @staticmethod
    def list_knowledge_bases() -> Tuple[bool, Any]:
        """列出知识库"""
        return tidb_vector_service.list_knowledge_bases()
    
    @staticmethod
    def cleanup():
        """清理资源"""
        cleanup_vector_db()


# 导出便捷接口
vector_db = VectorDB()
