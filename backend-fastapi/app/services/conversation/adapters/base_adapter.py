"""
外部平台适配器基类

提供统一的接口来处理不同外部平台的API调用
"""
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class BaseAdapter(ABC):
    """外部平台适配器基类"""

    def __init__(self, role_config: Dict[str, Any]):
        """
        初始化适配器

        Args:
            role_config: 角色配置信息，包含external_config
        """
        self.role_config = role_config

        # 从settings.external_config中获取配置
        settings = role_config.get('settings', {})
        self.external_config = settings.get('external_config', {})
        self.api_config = self.external_config.get('api_config', {})
        self.platform_specific = self.external_config.get('platform_specific', {})

        # 基础配置
        self.api_key = self.api_config.get('api_key', '')
        self.base_url = self.api_config.get('base_url', '')
        self.model = self.api_config.get('model', 'default')
        self.external_id = self.external_config.get('external_id', '')

        logger.info(f"初始化{self.platform_name}适配器: base_url={self.base_url}, external_id={self.external_id}")

    @property
    @abstractmethod
    def platform_name(self) -> str:
        """平台名称"""
        pass

    @abstractmethod
    def get_api_endpoint(self) -> str:
        """获取API端点URL"""
        pass

    @abstractmethod
    def get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        pass

    @abstractmethod
    def format_request(self, messages: List[Dict[str, str]],
                      model: str, agent_info: Optional[Dict[str, Any]] = None,
                      is_stream: bool = False, **kwargs) -> Dict[str, Any]:
        """
        格式化请求数据

        Args:
            messages: 消息列表
            model: 模型名称
            agent_info: 智能体信息
            is_stream: 是否流式响应
            **kwargs: 其他参数

        Returns:
            Dict: 请求数据
        """
        pass

    @abstractmethod
    def parse_response(self, response_data: Dict[str, Any]) -> str:
        """
        解析响应数据

        Args:
            response_data: 响应数据

        Returns:
            str: 解析后的文本内容
        """
        pass

    @abstractmethod
    def parse_streaming_chunk(self, chunk: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        解析流式响应块

        Args:
            chunk: 响应块

        Returns:
            Tuple[Optional[str], Optional[Dict]]: (文本内容, 元数据)
        """
        pass

    def stop_streaming(self) -> bool:
        """
        停止流式响应

        子类可以重写此方法来实现特定平台的停止逻辑

        Returns:
            bool: 是否成功停止流式响应
        """
        logger.warning(f"{self.platform_name}适配器未实现停止流式响应功能")
        return False

    def get_timeout_config(self) -> int:
        """
        获取超时配置

        Returns:
            int: 超时时间（秒）
        """
        # 优先从api_config中获取超时设置，然后从platform_specific中获取，最后使用默认值
        timeout = self.api_config.get('timeout') or self.platform_specific.get('timeout', 60)
        return timeout

    def validate_config(self) -> bool:
        """
        验证配置是否完整

        Returns:
            bool: 配置是否有效
        """
        if not self.api_key:
            logger.error(f"{self.platform_name}适配器缺少API密钥")
            return False

        if not self.base_url:
            logger.error(f"{self.platform_name}适配器缺少基础URL")
            return False

        return True

    def extract_user_message(self, messages: List[Dict[str, str]]) -> str:
        """
        从消息列表中提取用户消息

        Args:
            messages: 消息列表

        Returns:
            str: 用户消息内容
        """
        # 从后往前查找最新的用户消息
        for message in reversed(messages):
            if message.get('role') == 'user':
                return message.get('content', '')

        # 如果没有找到用户消息，返回空字符串
        return ''

    def extract_system_prompt(self, messages: List[Dict[str, str]]) -> str:
        """
        从消息列表中提取系统提示词

        Args:
            messages: 消息列表

        Returns:
            str: 系统提示词
        """
        # 查找系统消息
        for message in messages:
            if message.get('role') == 'system':
                return message.get('content', '')

        return ''
