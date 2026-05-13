"""
外部知识库适配器基类

定义了所有外部知识库适配器的通用接口和基础功能
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import time
import requests
import logging

logger = logging.getLogger(__name__)

class ExternalKnowledgeAdapter(ABC):
    """外部知识库适配器基类"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        """
        初始化适配器
        
        Args:
            provider_config: 提供商配置信息
                - base_url: 服务器地址
                - api_key: API密钥
                - config: 其他配置参数
        """
        self.base_url = provider_config.get('base_url', '').rstrip('/')
        self.api_key = provider_config.get('api_key', '')
        self.config = provider_config.get('config', {})
        self.timeout = self.config.get('timeout', 30)
        self.max_retries = self.config.get('max_retries', 3)
        
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        测试连接是否正常
        
        Returns:
            Dict: 测试结果
                - success: bool, 是否成功
                - message: str, 结果消息
                - response_time: float, 响应时间(毫秒)
        """
        pass
    
    @abstractmethod
    def query_knowledge(self, knowledge_config: Dict[str, Any], query_text: str) -> Dict[str, Any]:
        """
        查询知识库

        Args:
            knowledge_config: 知识库配置
                - external_kb_id: 外部知识库ID
                - query_config: 用户配置的额外参数
            query_text: 查询文本

        Returns:
            Dict: 查询结果
                - success: bool, 是否成功
                - results: List[Dict], 查询结果列表
                - total_count: int, 结果总数
                - query_time: float, 查询耗时(秒)
                - error_message: str, 错误信息(如果有)
        """
        pass
    
    @abstractmethod
    def get_knowledge_info(self, external_kb_id: str) -> Dict[str, Any]:
        """
        获取知识库信息
        
        Args:
            external_kb_id: 外部知识库ID
            
        Returns:
            Dict: 知识库信息
                - success: bool, 是否成功
                - info: Dict, 知识库详细信息
                - error_message: str, 错误信息(如果有)
        """
        pass
    
    def _make_request(self, method: str, url: str, **kwargs) -> requests.Response:
        """
        发起HTTP请求的通用方法
        
        Args:
            method: HTTP方法
            url: 请求URL
            **kwargs: 其他请求参数
            
        Returns:
            requests.Response: 响应对象
            
        Raises:
            requests.RequestException: 请求异常
        """
        # 设置默认超时
        kwargs.setdefault('timeout', self.timeout)
        
        # 设置默认headers
        headers = kwargs.get('headers', {})
        headers.setdefault('Content-Type', 'application/json')
        headers.setdefault('User-Agent', 'ABM-LLM-ExternalKnowledge/1.0')
        kwargs['headers'] = headers
        
        # 重试机制
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                response = requests.request(method, url, **kwargs)
                return response
            except requests.RequestException as e:
                last_exception = e
                if attempt < self.max_retries - 1:
                    wait_time = 2 ** attempt  # 指数退避
                    logger.warning(f"请求失败，{wait_time}秒后重试: {e}")
                    time.sleep(wait_time)
                else:
                    logger.error(f"请求最终失败: {e}")
        
        raise last_exception
    
    def _format_query_result(self, raw_result: Dict[str, Any], query_time: float) -> Dict[str, Any]:
        """
        格式化查询结果为标准格式
        
        Args:
            raw_result: 原始查询结果
            query_time: 查询耗时
            
        Returns:
            Dict: 标准格式的查询结果
        """
        return {
            'success': True,
            'results': raw_result.get('results', []),
            'total_count': raw_result.get('total_count', 0),
            'query_time': query_time,
            'metadata': raw_result.get('metadata', {})
        }
    
    def _format_error_result(self, error_message: str, query_time: float = 0) -> Dict[str, Any]:
        """
        格式化错误结果
        
        Args:
            error_message: 错误信息
            query_time: 查询耗时
            
        Returns:
            Dict: 错误结果
        """
        return {
            'success': False,
            'results': [],
            'total_count': 0,
            'query_time': query_time,
            'error_message': error_message
        }
    
    def _validate_config(self, required_fields: List[str]) -> bool:
        """
        验证配置是否完整
        
        Args:
            required_fields: 必需字段列表
            
        Returns:
            bool: 配置是否有效
        """
        if not self.base_url:
            logger.error("缺少base_url配置")
            return False
        
        if not self.api_key:
            logger.error("缺少api_key配置")
            return False
        
        for field in required_fields:
            if field not in self.config:
                logger.error(f"缺少必需配置字段: {field}")
                return False
        
        return True
    
    def get_adapter_info(self) -> Dict[str, Any]:
        """
        获取适配器信息
        
        Returns:
            Dict: 适配器信息
        """
        return {
            'adapter_type': self.__class__.__name__,
            'base_url': self.base_url,
            'timeout': self.timeout,
            'max_retries': self.max_retries,
            'config_keys': list(self.config.keys())
        }
