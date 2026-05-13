"""
OpenAI兼容适配器

处理与OpenAI兼容API的交互，用于内部角色
"""
import json
import logging
from typing import Dict, List, Any, Optional, Tuple

from .base_adapter import BaseAdapter

logger = logging.getLogger(__name__)


class OpenAIAdapter(BaseAdapter):
    """OpenAI兼容适配器"""

    @property
    def platform_name(self) -> str:
        return "OpenAI兼容"

    def get_api_endpoint(self) -> str:
        """获取OpenAI兼容API端点"""
        # 确保URL格式正确
        base_url = self.base_url.rstrip('/')

        # OpenAI使用chat/completions端点
        if not base_url.endswith('/chat/completions'):
            endpoint = f"{base_url}/chat/completions"
        else:
            endpoint = base_url

        logger.debug(f"OpenAI兼容API端点: {endpoint}")
        return endpoint

    def get_headers(self) -> Dict[str, str]:
        """获取OpenAI兼容请求头"""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def format_request(self, messages: List[Dict[str, str]],
                      model: str, agent_info: Optional[Dict[str, Any]] = None,
                      is_stream: bool = False, **kwargs) -> Dict[str, Any]:
        """
        准备OpenAI兼容请求数据

        OpenAI API格式:
        {
            "model": "gpt-3.5-turbo",
            "messages": [...],
            "stream": false,
            "temperature": 0.7,
            ...
        }
        """
        # 构建基础请求数据
        request_data = {
            "model": model,
            "messages": messages,
            "stream": is_stream
        }

        # 添加其他参数
        for key, value in kwargs.items():
            if value is not None and key not in ['agent_info', 'task_id', 'conversation_id']:
                if key == 'max_tokens' and value == 0:
                    continue
                request_data[key] = value

        # 添加工具定义(如果有)
        if agent_info and 'tools' in agent_info and agent_info['tools']:
            request_data['tools'] = agent_info['tools']
            if 'tool_choice' not in request_data:
                request_data['tool_choice'] = "auto"

        logger.debug(f"OpenAI兼容请求数据: {json.dumps(request_data, ensure_ascii=False, indent=2)}")
        return request_data

    def parse_response(self, response_data: Dict[str, Any]) -> str:
        """
        解析OpenAI兼容响应数据

        OpenAI响应格式:
        {
            "choices": [
                {
                    "message": {
                        "content": "回复内容",
                        "role": "assistant"
                    }
                }
            ]
        }
        """
        try:
            # 从choices中获取回复
            if 'choices' in response_data and len(response_data['choices']) > 0:
                choice = response_data['choices'][0]

                if 'message' in choice and 'content' in choice['message']:
                    return choice['message']['content']
                elif 'text' in choice:
                    # 兼容一些变体格式
                    return choice['text']

            # 如果没有找到标准格式，返回整个响应的字符串表示
            logger.warning(f"OpenAI兼容响应格式未知: {response_data}")
            return str(response_data)

        except Exception as e:
            logger.error(f"解析OpenAI兼容响应失败: {e}")
            return f"解析响应失败: {str(e)}"

    def parse_streaming_chunk(self, chunk: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        解析OpenAI兼容流式响应块

        OpenAI流式响应格式:
        data: {"choices": [{"delta": {"content": "内容"}}]}
        data: [DONE]
        """
        try:
            # 移除"data: "前缀
            if chunk.startswith('data: '):
                chunk = chunk[6:]

            # 跳过空行和结束标记
            if not chunk.strip() or chunk.strip() == '[DONE]':
                return None, None

            # 解析JSON
            try:
                data = json.loads(chunk)
            except json.JSONDecodeError:
                # 如果不是JSON格式，直接返回文本
                return chunk, None

            # 处理choices
            if 'choices' in data and len(data['choices']) > 0:
                choice = data['choices'][0]

                # 检查是否有delta内容
                if 'delta' in choice and 'content' in choice['delta']:
                    content = choice['delta']['content']
                    if content:
                        return content, None

                # 检查是否结束
                if 'finish_reason' in choice and choice['finish_reason']:
                    meta = {
                        "type": "done",
                        "agentId": None,  # 这里需要从外部传入
                        "agentName": None,
                        "roleName": None
                    }
                    return None, meta

            # 检查错误
            if 'error' in data:
                error_msg = data['error'].get('message', '未知错误')
                logger.error(f"OpenAI兼容流式响应错误: {error_msg}")
                return f"[错误] {error_msg}", None

            # 其他情况暂时忽略
            return None, None

        except Exception as e:
            logger.error(f"解析OpenAI兼容流式响应块失败: {e}, chunk: {chunk}")
            return None, None

    def stop_streaming(self) -> bool:
        """
        停止OpenAI兼容平台的流式响应

        大多数OpenAI兼容平台没有标准的停止API，
        所以这里返回False，依赖底层HTTP连接的强制关闭

        Returns:
            bool: 是否成功调用停止API（对于OpenAI兼容平台通常为False）
        """
        logger.info(f"{self.platform_name}平台没有标准的停止API，依赖底层连接管理器强制关闭")
        return False

    def validate_config(self) -> bool:
        """验证OpenAI兼容配置"""
        if not super().validate_config():
            return False

        # OpenAI兼容特定验证
        # 这里可以添加更多验证逻辑

        return True
