"""
FastGPT平台适配器

处理与FastGPT平台的API交互
FastGPT使用OpenAI兼容格式，实现相对简单
"""
import json
import logging
from typing import Dict, List, Any, Optional, Tuple

from .base_adapter import BaseAdapter

logger = logging.getLogger(__name__)


class FastGPTAdapter(BaseAdapter):
    """FastGPT平台适配器"""

    @property
    def platform_name(self) -> str:
        return "FastGPT"

    def get_api_endpoint(self) -> str:
        """获取FastGPT API端点"""
        # 智能处理API端点
        # 如果用户提供的是完整的chat/completions端点，直接使用
        # 如果用户提供的是基础URL或/api，则补全为完整端点
        base_url = self.base_url.rstrip('/')

        if base_url.endswith('/chat/completions'):
            endpoint = base_url
        elif base_url.endswith('/v1'):
            endpoint = f"{base_url}/chat/completions"
        elif base_url.endswith('/api'):
            endpoint = f"{base_url}/v1/chat/completions"
        else:
            # 假设用户提供的是基础URL
            endpoint = f"{base_url}/api/v1/chat/completions"

        logger.debug(f"FastGPT API端点: {endpoint}")
        return endpoint

    def get_headers(self) -> Dict[str, str]:
        """获取FastGPT请求头"""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def format_request(self, messages: List[Dict[str, str]],
                      model: str, agent_info: Optional[Dict[str, Any]] = None,
                      is_stream: bool = False, **kwargs) -> Dict[str, Any]:
        """
        准备FastGPT请求数据
        
        FastGPT使用OpenAI兼容格式:
        {
            "messages": [...],
            "stream": true/false,
            "chatId": "可选",
            "detail": false
        }
        """
        # 基础请求数据 - 直接使用OpenAI格式
        request_data = {
            "messages": messages,  # 无需转换！
            "stream": is_stream
        }
        
        # FastGPT可选参数
        if self.platform_specific.get('chat_id'):
            request_data["chatId"] = self.platform_specific['chat_id']
        
        if self.platform_specific.get('detail'):
            request_data["detail"] = self.platform_specific['detail']
        
        # 变量参数
        variables = self.platform_specific.get('variables', {})
        if variables:
            request_data["variables"] = variables

        logger.debug(f"FastGPT请求数据: {json.dumps(request_data, ensure_ascii=False)}")
        return request_data

    def parse_response(self, response_data: Dict[str, Any]) -> str:
        """
        解析FastGPT响应数据
        
        FastGPT返回标准OpenAI格式:
        {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "回复内容"
                    }
                }
            ]
        }
        """
        try:
            choices = response_data.get('choices', [])
            if choices and len(choices) > 0:
                message = choices[0].get('message', {})
                content = message.get('content', '')
                return content
            
            logger.warning(f"FastGPT响应格式异常: {response_data}")
            return "抱歉，获取回复失败"
            
        except Exception as e:
            logger.error(f"解析FastGPT响应失败: {e}")
            return "抱歉，解析回复失败"

    def parse_streaming_chunk(self, chunk: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        解析FastGPT流式响应块
        
        FastGPT使用OpenAI兼容的流式格式:
        data: {"choices":[{"delta":{"content":"文本"}}]}
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

            # 处理OpenAI格式的流式响应
            choices = data.get('choices', [])
            if choices and len(choices) > 0:
                delta = choices[0].get('delta', {})
                content = delta.get('content', '')
                
                if content:
                    return content, None
                    
                # 检查是否结束
                finish_reason = choices[0].get('finish_reason')
                if finish_reason:
                    return None, {'finish_reason': finish_reason}

            return None, None

        except Exception as e:
            logger.error(f"解析FastGPT流式响应失败: {e}")
            return None, None

    def validate_config(self) -> bool:
        """
        验证FastGPT配置是否完整
        """
        if not self.api_key:
            logger.error("FastGPT适配器缺少API密钥")
            return False

        if not (self.api_key.startswith('fastgpt-') or self.api_key.startswith('app-')):
            logger.error("FastGPT API密钥格式不正确，应以'fastgpt-'或'app-'开头")
            return False

        if not self.base_url:
            logger.error("FastGPT适配器缺少基础URL")
            return False

        if not self.external_id:
            logger.warning("FastGPT适配器缺少应用ID，将使用默认应用")

        return True

    def get_timeout_config(self) -> int:
        """获取超时配置"""
        return self.platform_specific.get('timeout', 60)
