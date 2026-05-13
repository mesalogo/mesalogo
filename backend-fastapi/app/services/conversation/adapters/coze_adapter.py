"""
Coze平台适配器

支持Coze智能体的API调用
"""
import json
import logging
from typing import Dict, List, Any, Optional, Tuple

from .base_adapter import BaseAdapter

logger = logging.getLogger(__name__)


class CozeAdapter(BaseAdapter):
    """Coze平台适配器"""

    @property
    def platform_name(self) -> str:
        return "Coze"

    def get_api_endpoint(self) -> str:
        """获取Coze API端点"""
        # 使用v3版本的chat API
        base_url = self.base_url.rstrip('/')
        if not base_url:
            base_url = "https://api.coze.cn"

        endpoint = f"{base_url}/v3/chat"
        logger.debug(f"Coze API端点: {endpoint}")
        return endpoint

    def get_headers(self) -> Dict[str, str]:
        """获取Coze请求头"""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def format_request(self, messages: List[Dict[str, str]],
                      model: str, agent_info: Optional[Dict[str, Any]] = None,
                      is_stream: bool = False, **kwargs) -> Dict[str, Any]:
        """
        格式化Coze请求数据

        Coze API格式:
        {
            "bot_id": "智能体ID",
            "user_id": "用户ID",
            "stream": true/false,
            "additional_messages": [
                {
                    "content": "用户消息",
                    "content_type": "text",
                    "role": "user",
                    "type": "question"
                }
            ],
            "parameters": {}
        }
        """
        # 获取用户ID，优先从api_config获取user_identifier，否则使用默认值
        user_id = self.api_config.get('user_identifier') or self.api_config.get('user_id', 'default_user')

        # 转换消息格式
        additional_messages = []
        for msg in messages:
            if msg.get('role') == 'user':
                additional_messages.append({
                    "content": msg.get('content', ''),
                    "content_type": "text",
                    "role": "user",
                    "type": "question"
                })

        # 如果没有用户消息，使用最后一条消息
        if not additional_messages and messages:
            last_msg = messages[-1]
            additional_messages.append({
                "content": last_msg.get('content', ''),
                "content_type": "text",
                "role": "user",
                "type": "question"
            })

        request_data = {
            "bot_id": self.external_id,  # 使用external_id作为bot_id
            "user_id": user_id,
            "stream": is_stream,
            "additional_messages": additional_messages,
            "parameters": {}
        }

        # 添加对话ID（如果有）
        conversation_id = self.platform_specific.get('conversation_id')
        if conversation_id:
            request_data["conversation_id"] = conversation_id

        logger.debug(f"Coze请求数据: {json.dumps(request_data, ensure_ascii=False, indent=2)}")
        return request_data

    def parse_response(self, response_data: Dict[str, Any]) -> str:
        """
        解析Coze非流式响应

        Coze优先使用流式响应，非流式仅用于测试连接
        """
        try:
            if response_data.get('code') != 0:
                error_msg = response_data.get('msg', '未知错误')
                logger.error(f"Coze API错误: {error_msg}")
                return f"错误: {error_msg}"

            # 非流式响应主要用于连接测试
            return "Coze连接测试成功，请使用流式模式进行正常对话。"

        except Exception as e:
            logger.error(f"解析Coze响应失败: {str(e)}")
            return f"响应解析错误: {str(e)}"

    def parse_streaming_chunk(self, chunk: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        解析Coze流式响应块

        Coze流式响应格式:
        event:conversation.message.delta
        data:{"id":"...","content":"部分内容","type":"answer",...}

        event:conversation.chat.completed
        data:{"id":"...","status":"completed",...}
        """
        try:
            # 跳过空行
            if not chunk.strip():
                return None, None

            # 处理事件行
            if chunk.startswith('event:'):
                # 存储事件类型，但不返回内容
                event_type = chunk[6:].strip()
                return None, {"event_type": event_type}

            # 处理数据行
            if chunk.startswith('data:'):
                data_str = chunk[5:].strip()

                # 处理结束标记
                if data_str == '"[DONE]"' or data_str == '[DONE]':
                    return None, {"event_type": "done"}

                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    logger.warning(f"无法解析JSON数据: {data_str}")
                    return None, None

                # 提取消息内容
                if data.get('type') == 'answer' and 'content' in data:
                    content = data.get('content', '')
                    if content:
                        return content, data

                # 返回元数据
                return None, data

            return None, None

        except Exception as e:
            logger.error(f"解析Coze流式响应块失败: {str(e)}")
            return None, None

    def validate_config(self) -> bool:
        """验证Coze配置"""
        if not self.api_key:
            logger.error("Coze API Key未配置")
            return False

        if not self.external_id:
            logger.error("Coze Bot ID未配置")
            return False

        return True

    def stop_streaming(self) -> bool:
        """
        停止Coze流式响应

        Coze暂不支持主动停止，返回False
        """
        logger.warning("Coze平台暂不支持主动停止流式响应")
        return False

    def get_timeout_config(self) -> int:
        """获取超时配置"""
        # Coze响应可能较慢，设置较长的超时时间
        return self.platform_specific.get('timeout', 120)