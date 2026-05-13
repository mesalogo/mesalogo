"""IM 服务抽象基类"""
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class BaseIMService(ABC):
    """所有 IM 平台服务的基类"""

    @property
    @abstractmethod
    def platform_name(self) -> str:
        pass

    @abstractmethod
    def parse_webhook(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        解析 Webhook 请求体，返回统一消息格式。
        返回 None 表示该消息不需要处理（如 bot 自己的消息）。

        Returns:
            {
                "chat_id": str,
                "user_id": str,
                "user_name": str,
                "text": str,
                "message_id": str,
                "is_group": bool,
            }
        """
        pass

    @abstractmethod
    def send_reply(self, credentials: Dict, chat_id: str, text: str) -> bool:
        """发送回复消息到 IM 平台"""
        pass

    @abstractmethod
    def register_webhook(self, credentials: Dict, webhook_url: str) -> Tuple[bool, str]:
        """注册 Webhook URL 到平台，返回 (success, message)"""
        pass

    @abstractmethod
    def test_connection(self, credentials: Dict) -> Tuple[bool, str]:
        """测试凭证是否有效，返回 (success, message)"""
        pass
