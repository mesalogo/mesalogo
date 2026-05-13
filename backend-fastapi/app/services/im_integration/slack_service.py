"""Slack Bot 服务实现"""
import hashlib
import hmac
import logging
import time
from typing import Dict, Any, Optional, Tuple

import requests as http_requests

from app.services.im_integration.base_im_service import BaseIMService

logger = logging.getLogger(__name__)

SLACK_API = 'https://slack.com/api'


class SlackService(BaseIMService):

    @property
    def platform_name(self) -> str:
        return 'slack'

    def verify_signature(self, signing_secret: str, timestamp: str, body: str, signature: str) -> bool:
        """验证 Slack 请求签名"""
        if abs(time.time() - float(timestamp)) > 60 * 5:
            return False
        sig_basestring = f"v0:{timestamp}:{body}"
        my_signature = 'v0=' + hmac.new(
            signing_secret.encode(), sig_basestring.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(my_signature, signature)

    def parse_webhook(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        event = payload.get('event', {})
        event_type = event.get('type')

        if event_type != 'message':
            return None

        # 忽略 bot 消息和子类型消息（如 message_changed, message_deleted）
        if event.get('bot_id') or event.get('subtype'):
            return None

        text = event.get('text', '').strip()
        if not text:
            return None

        channel = event.get('channel', '')
        channel_type = event.get('channel_type', '')

        return {
            'chat_id': channel,
            'user_id': event.get('user', ''),
            'user_name': event.get('user', ''),
            'text': text,
            'message_id': event.get('ts', ''),
            'is_group': channel_type in ('channel', 'group'),
        }

    def send_reply(self, credentials: Dict, chat_id: str, text: str) -> bool:
        bot_token = credentials.get('bot_token', '')
        if not bot_token:
            logger.error('Slack bot_token is missing')
            return False

        url = f"{SLACK_API}/chat.postMessage"
        try:
            resp = http_requests.post(url, json={
                'channel': chat_id,
                'text': text,
            }, headers={
                'Authorization': f'Bearer {bot_token}',
                'Content-Type': 'application/json',
            }, timeout=30)
            data = resp.json()
            if not data.get('ok'):
                logger.error(f"Slack send_reply error: {data.get('error')}")
                return False
            return True
        except Exception as e:
            logger.error(f'Slack send_reply error: {e}')
            return False

    def register_webhook(self, credentials: Dict, webhook_url: str) -> Tuple[bool, str]:
        # Slack 使用 Event Subscriptions，需要在 Slack App 管理页面手动配置 Request URL
        # 这里只返回提示信息
        return True, (
            'Slack uses Event Subscriptions. '
            f'Please set the Request URL to: {webhook_url} '
            'in your Slack App settings under "Event Subscriptions".'
        )

    def unregister_webhook(self, credentials: Dict) -> Tuple[bool, str]:
        return True, 'Please remove the Event Subscription URL manually in Slack App settings.'

    def test_connection(self, credentials: Dict) -> Tuple[bool, str]:
        bot_token = credentials.get('bot_token', '')
        if not bot_token:
            return False, 'bot_token is missing'

        url = f"{SLACK_API}/auth.test"
        try:
            resp = http_requests.post(url, headers={
                'Authorization': f'Bearer {bot_token}',
                'Content-Type': 'application/json',
            }, timeout=15)
            data = resp.json()
            if data.get('ok'):
                return True, f"Connected: {data.get('bot_id', '')}@{data.get('team', 'unknown')}"
            return False, data.get('error', 'Unknown error')
        except Exception as e:
            return False, str(e)


slack_service = SlackService()
