"""
外部知识库适配器工厂

负责创建和管理不同类型的知识库适配器
"""

from typing import Dict, Any, Optional
from .base_adapter import ExternalKnowledgeAdapter
from .dify_adapter import DifyAdapter
from .ragflow_adapter import RagFlowAdapter
from .fastgpt_adapter import FastGPTAdapter
from .custom_adapter import CustomAdapter
import logging

logger = logging.getLogger(__name__)

class AdapterFactory:
    """适配器工厂类"""
    
    # 注册的适配器类型
    ADAPTER_TYPES = {
        'dify': DifyAdapter,
        'ragflow': RagFlowAdapter,
        'fastgpt': FastGPTAdapter,
        'custom': CustomAdapter
    }
    
    @classmethod
    def create_adapter(cls, provider_type: str, provider_config: Dict[str, Any]) -> Optional[ExternalKnowledgeAdapter]:
        """
        创建适配器实例
        
        Args:
            provider_type: 提供商类型
            provider_config: 提供商配置
            
        Returns:
            ExternalKnowledgeAdapter: 适配器实例
            
        Raises:
            ValueError: 不支持的提供商类型
        """
        if provider_type not in cls.ADAPTER_TYPES:
            raise ValueError(f"不支持的提供商类型: {provider_type}")
        
        adapter_class = cls.ADAPTER_TYPES[provider_type]
        
        try:
            adapter = adapter_class(provider_config)
            logger.info(f"成功创建 {provider_type} 适配器")
            return adapter
        except Exception as e:
            logger.error(f"创建 {provider_type} 适配器失败: {e}")
            raise
    
    @classmethod
    def get_supported_types(cls) -> Dict[str, Dict[str, Any]]:
        """
        获取支持的提供商类型信息
        
        Returns:
            Dict: 支持的提供商类型及其信息
        """
        return {
            'dify': {
                'name': 'Dify.AI',
                'description': 'Dify.AI是一个强大的LLM应用开发平台',
                'features': ['semantic_search', 'keyword_search', 'hybrid_search', 'reranking', 'hit_testing'],
                'required_config': ['base_url', 'api_key'],
                'optional_config': ['app_id', 'dataset_id', 'timeout', 'max_retries'],
                'api_docs': 'https://docs.dify.ai/api-reference'
            },
            'ragflow': {
                'name': 'RAGFlow',
                'description': 'RAGFlow是一个开源的检索增强生成平台',
                'features': ['vector_search', 'keyword_search', 'hybrid_search', 'reranking', 'conversation', 'knowledge_graph'],
                'required_config': ['base_url', 'api_key'],
                'optional_config': ['user_id', 'timeout', 'max_retries'],
                'api_docs': 'https://ragflow.ai/docs/api'
            },
            'fastgpt': {
                'name': 'FastGPT',
                'description': 'FastGPT是一个基于LLM的知识库问答系统',
                'features': ['embedding_search', 'full_text_recall', 'mixed_recall', 'rerank', 'qa_split', 'multimodal'],
                'required_config': ['base_url', 'api_key'],
                'optional_config': ['team_id', 'timeout', 'max_retries'],
                'api_docs': 'https://doc.fastgpt.in/docs/development/openapi'
            },
            'custom': {
                'name': '自定义API',
                'description': '连接到自定义知识库API',
                'features': ['custom_query', 'flexible_auth', 'format_conversion', 'configurable_endpoints'],
                'required_config': ['base_url', 'api_key'],
                'optional_config': ['auth_type', 'auth_header', 'query_endpoint', 'info_endpoint', 'test_endpoint', 'timeout', 'max_retries'],
                'api_docs': '根据具体API文档配置'
            }
        }
    
    @classmethod
    def validate_config(cls, provider_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证提供商配置
        
        Args:
            provider_type: 提供商类型
            config: 配置信息
            
        Returns:
            Dict: 验证结果
                - valid: bool, 是否有效
                - errors: List[str], 错误信息列表
                - warnings: List[str], 警告信息列表
        """
        result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        if provider_type not in cls.ADAPTER_TYPES:
            result['valid'] = False
            result['errors'].append(f"不支持的提供商类型: {provider_type}")
            return result
        
        supported_types = cls.get_supported_types()
        type_info = supported_types[provider_type]
        
        # 检查必需配置
        for required_field in type_info['required_config']:
            if required_field not in config or not config[required_field]:
                result['valid'] = False
                result['errors'].append(f"缺少必需配置: {required_field}")
        
        # 检查URL格式
        if 'base_url' in config:
            base_url = config['base_url']
            if not base_url.startswith(('http://', 'https://')):
                result['valid'] = False
                result['errors'].append("base_url必须以http://或https://开头")
        
        # 检查API密钥
        if 'api_key' in config:
            api_key = config['api_key']
            if len(api_key) < 10:
                result['warnings'].append("API密钥长度较短，请确认是否正确")
        
        # 特定类型的验证
        if provider_type == 'dify':
            if 'config' in config and 'app_id' in config['config']:
                app_id = config['config']['app_id']
                if not app_id:
                    result['warnings'].append("建议配置app_id以获得更好的性能")
        
        elif provider_type == 'fastgpt':
            if 'config' in config and 'team_id' in config['config']:
                team_id = config['config']['team_id']
                if not team_id:
                    result['warnings'].append("如果使用团队版FastGPT，建议配置team_id")
        
        elif provider_type == 'custom':
            if 'config' in config:
                custom_config = config['config']
                auth_type = custom_config.get('auth_type', 'bearer')
                if auth_type not in ['bearer', 'api_key', 'basic']:
                    result['errors'].append("auth_type必须是bearer、api_key或basic之一")
        
        return result
    
    @classmethod
    def get_default_config(cls, provider_type: str) -> Dict[str, Any]:
        """
        获取提供商的默认配置
        
        Args:
            provider_type: 提供商类型
            
        Returns:
            Dict: 默认配置
        """
        default_configs = {
            'dify': {
                'timeout': 30,
                'max_retries': 3,
                'search_method': 'semantic_search',
                'reranking_enable': True,
                'reranking_provider': 'cohere',
                'reranking_model': 'rerank-english-v2.0'
            },
            'ragflow': {
                'timeout': 30,
                'max_retries': 3,
                'vector_similarity_weight': 0.3,
                'keywords_similarity_weight': 0.7,
                'rerank': True,
                'rerank_model': 'BAAI/bge-reranker-base'
            },
            'fastgpt': {
                'timeout': 30,
                'max_retries': 3,
                'search_mode': 'embedding',
                'using_rerank': False
            },
            'custom': {
                'timeout': 30,
                'max_retries': 3,
                'auth_type': 'bearer',
                'auth_header': 'Authorization',
                'query_endpoint': '/api/v1/query',
                'info_endpoint': '/api/v1/info',
                'test_endpoint': '/api/v1/health'
            }
        }
        
        return default_configs.get(provider_type, {})
    
    @classmethod
    def register_adapter(cls, provider_type: str, adapter_class: type):
        """
        注册新的适配器类型
        
        Args:
            provider_type: 提供商类型
            adapter_class: 适配器类
        """
        if not issubclass(adapter_class, ExternalKnowledgeAdapter):
            raise ValueError("适配器类必须继承自ExternalKnowledgeAdapter")
        
        cls.ADAPTER_TYPES[provider_type] = adapter_class
        logger.info(f"注册新的适配器类型: {provider_type}")
    
    @classmethod
    def test_adapter(cls, provider_type: str, provider_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试适配器连接
        
        Args:
            provider_type: 提供商类型
            provider_config: 提供商配置
            
        Returns:
            Dict: 测试结果
        """
        try:
            adapter = cls.create_adapter(provider_type, provider_config)
            return adapter.test_connection()
        except Exception as e:
            logger.error(f"测试适配器失败: {e}")
            return {
                'success': False,
                'message': f'测试失败: {str(e)}',
                'response_time': 0
            }
