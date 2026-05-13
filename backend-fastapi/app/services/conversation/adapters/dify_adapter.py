"""
Dify平台适配器

处理与Dify平台的API交互
"""
import json
import logging
from typing import Dict, List, Any, Optional, Tuple

from .base_adapter import BaseAdapter

logger = logging.getLogger(__name__)


class DifyAdapter(BaseAdapter):
    """Dify平台适配器"""

    @property
    def platform_name(self) -> str:
        return "Dify"

    def get_api_endpoint(self) -> str:
        """获取Dify API端点"""
        # 确保URL格式正确
        base_url = self.base_url.rstrip('/')

        # 如果base_url为空，返回默认路径
        if not base_url:
            endpoint = "/chat-messages"
        else:
            # Dify使用chat-messages端点
            endpoint = f"{base_url}/chat-messages"

        logger.debug(f"Dify API端点: {endpoint}")
        return endpoint

    def get_headers(self) -> Dict[str, str]:
        """获取Dify请求头"""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def format_request(self, messages: List[Dict[str, str]],
                      model: str, agent_info: Optional[Dict[str, Any]] = None,
                      is_stream: bool = False, **kwargs) -> Dict[str, Any]:
        """
        准备Dify请求数据

        Dify API格式:
        {
            "inputs": {},
            "query": "完整的查询内容（包含系统提示词、历史消息和用户消息）",
            "response_mode": "streaming" | "blocking",
            "conversation_id": "",
            "user": "用户标识"
        }
        """
        # 获取平台特定配置
        response_mode = "streaming" if is_stream else "blocking"

        # 获取用户标识符，确保不为空
        user_identifier = self.platform_specific.get('user_identifier') if self.platform_specific else None
        if not user_identifier:
            user_identifier = 'abm_user'  # 使用默认用户标识符

        # 构建完整的查询内容
        query_parts = []

        # 1. 添加系统提示词（如果有）
        system_prompt = self.extract_system_prompt(messages)
        if system_prompt:
            query_parts.append(f"<!--系统提示词\n{system_prompt}-->")

        # 2. 添加历史消息（除了系统消息和最后的用户消息）
        history_messages = []
        current_user_message = ""

        for message in messages:
            role = message.get('role', '')
            content = message.get('content', '')

            if role == 'system':
                continue  # 系统消息已经处理过了
            elif role == 'user':
                current_user_message = content  # 保存最后的用户消息
            elif role == 'assistant':
                history_messages.append(f"助手: {content}")

        # 如果有历史消息，添加到查询中
        if history_messages:
            history_text = "\n".join(history_messages)
            query_parts.append(f"<!--历史消息\n{history_text}-->")

        # 3. 添加当前用户请求
        if current_user_message:
            query_parts.append("<!--以下为用户请求-->")
            query_parts.append(current_user_message)

        # 组合完整的查询
        full_query = "\n".join(query_parts)

        # 构建请求数据
        request_data = {
            "inputs": {},  # Dify的输入变量，暂时为空
            "query": full_query,
            "response_mode": response_mode,
            "conversation_id": "",  # 每次都是新对话
            "user": user_identifier
        }

        logger.debug(f"Dify请求数据: {json.dumps(request_data, ensure_ascii=False, indent=2)}")
        return request_data

    def parse_response(self, response_data: Dict[str, Any]) -> str:
        """
        解析Dify响应数据

        Dify响应格式:
        {
            "answer": "回复内容",
            "conversation_id": "会话ID",
            "message_id": "消息ID",
            ...
        }
        """
        try:
            # 直接从answer字段获取回复
            if 'answer' in response_data:
                return response_data['answer']

            # 如果没有answer字段，尝试从data.answer获取
            if 'data' in response_data and 'answer' in response_data['data']:
                return response_data['data']['answer']

            # 如果都没有，返回整个响应的字符串表示
            logger.warning(f"Dify响应格式未知: {response_data}")
            return str(response_data)

        except Exception as e:
            logger.error(f"解析Dify响应失败: {e}")
            return f"解析响应失败: {str(e)}"

    def parse_streaming_chunk(self, chunk: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        解析Dify流式响应块

        Dify流式响应格式:
        data: {"event": "message", "message_id": "...", "conversation_id": "...", "answer": "内容", "task_id": "..."}
        data: {"event": "message_end", ...}
        """
        try:
            # 移除"data: "前缀
            if chunk.startswith('data: '):
                chunk = chunk[6:]

            # 跳过空行和特殊标记
            if not chunk.strip() or chunk.strip() == '[DONE]':
                return None, None

            # 解析JSON
            try:
                data = json.loads(chunk)
            except json.JSONDecodeError:
                # 如果不是JSON格式，直接返回文本
                return chunk, None

            # 处理不同的事件类型
            event = data.get('event', '')

            if event == 'message':
                # 消息事件，包含回复内容
                answer = data.get('answer', '')

                # 提取task_id并存储，用于后续的停止操作
                task_id = data.get('task_id')
                if task_id and not hasattr(self, '_current_task_id'):
                    self._current_task_id = task_id
                    logger.debug(f"Dify适配器提取到task_id: {task_id}")

                if answer:
                    return answer, None

            elif event == 'message_end':
                # 消息结束事件
                meta = {
                    "type": "done",
                    "agentId": None,  # 这里需要从外部传入
                    "agentName": None,
                    "roleName": None
                }
                return None, meta

            elif event == 'error':
                # 错误事件
                error_msg = data.get('message', '未知错误')
                logger.error(f"Dify流式响应错误: {error_msg}")
                return f"[错误] {error_msg}", None

            # 其他事件类型暂时忽略
            return None, None

        except Exception as e:
            logger.error(f"解析Dify流式响应块失败: {e}, chunk: {chunk}")
            return None, None

    def stop_streaming(self) -> bool:
        """
        停止Dify流式响应

        调用Dify的停止API: POST /chat-messages/{task_id}/stop
        需要在请求体中包含user参数

        Returns:
            bool: 是否成功调用停止API
        """
        if not hasattr(self, '_current_task_id') or not self._current_task_id:
            logger.warning("Dify适配器没有可用的task_id，无法停止流式响应")
            return False

        try:
            # 构建停止API的URL
            stop_url = f"{self.base_url.rstrip('/')}/chat-messages/{self._current_task_id}/stop"

            # 准备请求头
            headers = self.get_headers()

            # 准备请求体 - Dify停止API需要user参数
            user_identifier = self.platform_specific.get('user_identifier') if self.platform_specific else None
            if not user_identifier:
                user_identifier = 'abm_user'  # 使用默认用户标识符

            request_body = {
                "user": user_identifier
            }

            logger.info(f"调用Dify停止API: {stop_url}, user: {request_body['user']}")

            # 发送停止请求
            import httpx
            timeout = self.get_timeout_config()
            http_timeout = httpx.Timeout(timeout[0], read=timeout[1]) if isinstance(timeout, tuple) else httpx.Timeout(timeout)
            with httpx.Client(timeout=http_timeout) as client:
                response = client.post(stop_url, headers=headers, json=request_body)

            if response.status_code == 200:
                logger.info(f"成功调用Dify停止API，task_id: {self._current_task_id}")
                return True
            else:
                logger.warning(f"Dify停止API返回错误状态码: {response.status_code}, 响应: {response.text}")
                return False

        except Exception as e:
            logger.error(f"调用Dify停止API失败: {str(e)}")
            return False
        finally:
            # 清理task_id
            if hasattr(self, '_current_task_id'):
                delattr(self, '_current_task_id')

    def validate_config(self) -> bool:
        """验证Dify配置"""
        if not super().validate_config():
            return False

        # Dify特定验证
        if not self.external_id:
            logger.warning(f"Dify适配器缺少external_id（应用ID），但可能不是必需的")

        return True
