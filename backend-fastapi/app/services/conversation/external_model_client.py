"""
外部模型客户端

专门处理外部平台角色的模型客户端
"""
import json
import logging
import httpx
from typing import Dict, List, Any, Optional, Callable

from .adapters.adapter_factory import AdapterFactory
from .stream_handler import handle_streaming_response_with_adapter

logger = logging.getLogger(__name__)

# 调试开关
DEBUG_LLM_RESPONSE = True


class ExternalModelClient:
    """外部模型客户端，专门处理外部平台角色"""

    def __init__(self):
        self.adapter_factory = AdapterFactory()
        # 存储活动的适配器实例，用于停止操作
        self._active_adapters = {}

    def send_request_with_adapter(self, role_config: Dict[str, Any],
                                 model_config: Optional[Dict[str, Any]],
                                 messages: List[Dict[str, str]], model: str,
                                 is_stream: bool = False, callback: Optional[Callable] = None,
                                 agent_info: Optional[Dict[str, Any]] = None, **kwargs) -> str:
        """
        使用适配器发送外部平台模型请求

        Args:
            role_config: 角色配置
            model_config: 模型配置（外部角色时为None）
            messages: 消息列表
            model: 模型名称
            is_stream: 是否使用流式响应
            callback: 回调函数
            agent_info: 智能体信息
            **kwargs: 其他参数

        Returns:
            str: 模型响应内容
        """
        try:
            # 创建适配器
            adapter = self.adapter_factory.create_adapter(role_config, model_config)

            logger.info(f"[外部ModelClient] 使用{adapter.platform_name}适配器处理请求")

            # 验证配置
            if not adapter.validate_config():
                raise ValueError(f"{adapter.platform_name}平台配置无效")

            # 格式化请求数据
            request_data = adapter.format_request(
                messages=messages,
                model=model,
                agent_info=agent_info,
                is_stream=is_stream,
                **kwargs
            )

            # 获取API端点和请求头
            api_endpoint = adapter.get_api_endpoint()
            headers = adapter.get_headers()
            timeout = adapter.get_timeout_config()

            # 记录请求信息
            logger.info(f"[外部ModelClient] 发送{'流式' if is_stream else ''}请求到: {api_endpoint}")

            if DEBUG_LLM_RESPONSE:
                logger.debug(f"[外部ModelClient] 请求头: {headers}")
                logger.debug(f"[外部ModelClient] 请求数据: {json.dumps(request_data, ensure_ascii=False, indent=2)}")

            # 创建 httpx 客户端
            http_timeout = httpx.Timeout(timeout[0], read=timeout[1]) if isinstance(timeout, tuple) else httpx.Timeout(timeout)
            client = httpx.Client(timeout=http_timeout)

            # 发送HTTP请求
            if is_stream:
                request = client.build_request("POST", api_endpoint, headers=headers, json=request_data)
                response = client.send(request, stream=True)
            else:
                response = client.post(api_endpoint, headers=headers, json=request_data)

            # 检查响应状态
            if response.status_code != 200:
                error_detail = self._extract_error_detail(response)
                raise httpx.HTTPStatusError(
                    f"[{adapter.platform_name}] API请求失败: {response.status_code}\n响应内容: {error_detail}",
                    request=request if is_stream else response.request,
                    response=response
                )

            # 处理响应
            if is_stream:
                # 如果是流式响应，存储适配器实例用于可能的停止操作
                task_id = kwargs.get('task_id')
                conversation_id = kwargs.get('conversation_id')
                agent_id = agent_info.get('id') if agent_info else None

                if task_id and conversation_id and agent_id:
                    request_key = f"{task_id}:{conversation_id}:{agent_id}"
                    self._active_adapters[request_key] = adapter
                    logger.debug(f"[外部ModelClient] 存储适配器实例: {request_key}")

                try:
                    return self._handle_streaming_response(adapter, response, callback, agent_info, **kwargs)
                finally:
                    # 流式响应完成后清理适配器实例
                    if task_id and conversation_id and agent_id:
                        request_key = f"{task_id}:{conversation_id}:{agent_id}"
                        if request_key in self._active_adapters:
                            del self._active_adapters[request_key]
                            logger.debug(f"[外部ModelClient] 清理适配器实例: {request_key}")
            else:
                return self._handle_non_streaming_response(adapter, response)

        except Exception as e:
            error_msg = f"外部角色API请求失败: {str(e)}"
            logger.error(f"[外部ModelClient] 错误: {error_msg}")

            # 如果有回调函数，发送错误信息
            if callback and agent_info:
                self._send_error_callback(callback, agent_info, error_msg)

            return f"Error: {error_msg}"

    def _handle_non_streaming_response(self, adapter, response: httpx.Response) -> str:
        """处理非流式响应"""
        try:
            response_data = response.json()
            return adapter.parse_response(response_data)
        except Exception as e:
            logger.error(f"解析{adapter.platform_name}响应失败: {e}")
            return f"解析响应失败: {str(e)}"

    def _handle_streaming_response(self, adapter, response: httpx.Response,
                                 callback: Optional[Callable], agent_info: Dict[str, Any],
                                 **kwargs) -> str:
        """处理流式响应"""
        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[外部ModelClient] 开始处理{adapter.platform_name}流式响应...")

        # 准备API配置
        api_config = {
            'agent_info': agent_info
        }
        api_config.update(kwargs)

        # 使用stream_handler处理流式响应
        return handle_streaming_response_with_adapter(
            adapter=adapter,
            response=response,
            callback=callback,
            api_config=api_config
        )

    def _extract_error_detail(self, response: httpx.Response) -> str:
        """提取错误详情"""
        try:
            return response.text[:500]
        except:
            return "无法获取错误详情"

    def stop_external_streaming(self, task_id: int, conversation_id: int, agent_id: str) -> bool:
        """
        停止外部平台的流式响应

        Args:
            task_id: 行动任务ID
            conversation_id: 会话ID
            agent_id: 智能体ID

        Returns:
            bool: 是否成功调用外部平台的停止API
        """
        request_key = f"{task_id}:{conversation_id}:{agent_id}"

        if request_key not in self._active_adapters:
            logger.warning(f"[外部ModelClient] 未找到活动的适配器实例: {request_key}")
            return False

        adapter = self._active_adapters[request_key]

        try:
            logger.info(f"[外部ModelClient] 调用{adapter.platform_name}平台停止API: {request_key}")
            success = adapter.stop_streaming()

            if success:
                logger.info(f"[外部ModelClient] 成功调用{adapter.platform_name}平台停止API")
            else:
                logger.warning(f"[外部ModelClient] {adapter.platform_name}平台停止API调用失败")

            return success

        except Exception as e:
            logger.error(f"[外部ModelClient] 调用{adapter.platform_name}平台停止API时出错: {str(e)}")
            return False
        finally:
            # 无论成功与否，都清理适配器实例
            if request_key in self._active_adapters:
                del self._active_adapters[request_key]
                logger.debug(f"[外部ModelClient] 清理适配器实例: {request_key}")

    def _send_error_callback(self, callback: Callable, agent_info: Dict[str, Any], error_msg: str):
        """发送错误回调"""
        try:
            from .message_formater import format_agent_error_done

            agent_id = str(agent_info.get('id', 'unknown'))
            agent_name = agent_info.get('name', '外部智能体')
            role_name = agent_info.get('role_name', '外部角色')

            formatted_error = format_agent_error_done(
                agent_id=agent_id,
                agent_name=agent_name,
                role_name=role_name,
                error_content=error_msg
            )

            try:
                callback(None, formatted_error["meta"])
            except TypeError:
                callback(f"\n[错误] {error_msg}")
        except Exception as e:
            logger.warning(f"发送错误回调失败: {e}")
            try:
                callback(f"\n[错误] {error_msg}")
            except:
                pass


# 创建全局实例
external_model_client = ExternalModelClient()
