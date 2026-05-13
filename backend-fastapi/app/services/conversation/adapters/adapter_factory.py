"""
适配器工厂

根据角色配置创建相应的适配器实例
"""
import logging
from typing import Dict, Any, Optional

from .base_adapter import BaseAdapter
from .dify_adapter import DifyAdapter
from .fastgpt_adapter import FastGPTAdapter
from .coze_adapter import CozeAdapter

logger = logging.getLogger(__name__)


class AdapterFactory:
    """适配器工厂类"""

    # 注册的适配器映射
    _adapters = {
        'dify': DifyAdapter,
        'fastgpt': FastGPTAdapter,
        'coze': CozeAdapter,
        # 可以在这里添加更多适配器
        # 'openai': OpenAIAdapter,
        # 'custom': CustomAdapter,
    }

    @classmethod
    def create_adapter(cls, role_config: Dict[str, Any],
                      model_config: Optional[Dict[str, Any]] = None) -> BaseAdapter:
        """
        创建适配器实例

        Args:
            role_config: 角色配置信息
            model_config: 模型配置信息（用于内部角色，外部角色时为None）

        Returns:
            BaseAdapter: 适配器实例

        Raises:
            ValueError: 当无法确定适配器类型或不支持的平台时
        """
        # 检查是否为外部角色
        if role_config.get('source') == 'external':
            return cls._create_external_adapter(role_config)
        else:
            return cls._create_internal_adapter(role_config, model_config)

    @classmethod
    def _create_external_adapter(cls, role_config: Dict[str, Any]) -> BaseAdapter:
        """创建外部角色适配器"""
        external_config = role_config.get('settings', {}).get('external_config', {})
        platform = external_config.get('platform', 'custom').lower()

        logger.info(f"创建外部角色适配器: platform={platform}")

        # 获取适配器类
        adapter_class = cls._adapters.get(platform)
        if not adapter_class:
            raise ValueError(f"不支持的外部平台: {platform}")

        # 创建适配器实例
        return adapter_class(role_config)

    @classmethod
    def _create_internal_adapter(cls, role_config: Dict[str, Any],
                                model_config: Optional[Dict[str, Any]]) -> BaseAdapter:
        """创建内部角色适配器"""
        # 内部角色暂时不支持适配器模式，抛出异常
        raise ValueError("内部角色暂不支持适配器模式，请使用标准ModelClient")

    @classmethod
    def register_adapter(cls, platform: str, adapter_class: type):
        """
        注册新的适配器

        Args:
            platform: 平台名称
            adapter_class: 适配器类
        """
        cls._adapters[platform.lower()] = adapter_class
        logger.info(f"注册适配器: {platform} -> {adapter_class.__name__}")

    @classmethod
    def get_supported_platforms(cls) -> list:
        """获取支持的平台列表"""
        return list(cls._adapters.keys())

    @classmethod
    def is_platform_supported(cls, platform: str) -> bool:
        """检查平台是否支持"""
        return platform.lower() in cls._adapters
