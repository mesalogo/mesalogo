"""Telegram Bot 服务实现"""
import logging
from typing import Dict, Any, Optional, Tuple

import requests as http_requests

from app.services.im_integration.base_im_service import BaseIMService

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org/bot{token}'


class TelegramService(BaseIMService):

    @property
    def platform_name(self) -> str:
        return 'telegram'

    def parse_webhook(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        message = payload.get('message') or payload.get('edited_message')
        if not message:
            return None

        from_user = message.get('from', {})
        if from_user.get('is_bot', False):
            return None

        text = message.get('text', '')
        if not text:
            return None

        chat = message.get('chat', {})
        return {
            'chat_id': str(chat.get('id', '')),
            'user_id': str(from_user.get('id', '')),
            'user_name': from_user.get('first_name', '') or from_user.get('username', ''),
            'text': text,
            'message_id': str(message.get('message_id', '')),
            'is_group': chat.get('type') in ('group', 'supergroup'),
        }

    def send_reply(self, credentials: Dict, chat_id: str, text: str) -> bool:
        bot_token = credentials.get('bot_token', '')
        if not bot_token:
            logger.error('Telegram bot_token is missing')
            return False

        url = f"{TELEGRAM_API.format(token=bot_token)}/sendMessage"
        try:
            resp = http_requests.post(url, json={
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'Markdown',
            }, timeout=30)
            if not resp.ok:
                # Markdown 解析失败时回退到纯文本
                resp2 = http_requests.post(url, json={
                    'chat_id': chat_id,
                    'text': text,
                }, timeout=30)
                return resp2.ok
            return True
        except Exception as e:
            logger.error(f'Telegram send_reply error: {e}')
            return False

    def register_webhook(self, credentials: Dict, webhook_url: str) -> Tuple[bool, str]:
        bot_token = credentials.get('bot_token', '')
        if not bot_token:
            return False, 'bot_token is missing'

        url = f"{TELEGRAM_API.format(token=bot_token)}/setWebhook"
        try:
            resp = http_requests.post(url, json={'url': webhook_url}, timeout=30)
            data = resp.json()
            if data.get('ok'):
                return True, 'Webhook registered'
            return False, data.get('description', 'Unknown error')
        except Exception as e:
            return False, str(e)

    def unregister_webhook(self, credentials: Dict) -> Tuple[bool, str]:
        bot_token = credentials.get('bot_token', '')
        if not bot_token:
            return False, 'bot_token is missing'

        url = f"{TELEGRAM_API.format(token=bot_token)}/deleteWebhook"
        try:
            resp = http_requests.post(url, timeout=30)
            data = resp.json()
            if data.get('ok'):
                return True, 'Webhook removed'
            return False, data.get('description', 'Unknown error')
        except Exception as e:
            return False, str(e)

    def test_connection(self, credentials: Dict) -> Tuple[bool, str]:
        bot_token = credentials.get('bot_token', '')
        if not bot_token:
            return False, 'bot_token is missing'

        url = f"{TELEGRAM_API.format(token=bot_token)}/getMe"
        try:
            resp = http_requests.get(url, timeout=15)
            data = resp.json()
            if data.get('ok'):
                bot_info = data.get('result', {})
                return True, f"Connected: @{bot_info.get('username', 'unknown')}"
            return False, data.get('description', 'Unknown error')
        except Exception as e:
            return False, str(e)


telegram_service = TelegramService()
