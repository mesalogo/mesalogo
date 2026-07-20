"""
模型客户端模块

处理模型API调用，发送流式模型请求，处理模型响应
统一ModelClient和ModelService功能，支持测试和生产两种场景
支持异步流式请求，通过 asyncio.Task.cancel() 实现真正的硬取消
"""
import json
import logging
import traceback
import asyncio
import httpx
import threading
import queue
from typing import Dict, List, Any, Callable, Optional, Tuple

from config import DEBUG_LLM_RESPONSE
from app.services.conversation.event_types import *
from app.services.conversation.observer import event_manager
# 导入连接管理器
from app.services.conversation.connection_manager import connection_manager
# 导入请求工具函数
from app.services.conversation.request_utils import normalize_agent_id, generate_request_id

logger = logging.getLogger(__name__)

# 平台标准参数到供应商参数的映射
PROVIDER_PARAMETER_MAPPING = {
    'openai': {
        'temperature': 'temperature',
        'max_tokens': 'max_tokens',
        'top_p': 'top_p',
        'frequency_penalty': 'frequency_penalty',
        'presence_penalty': 'presence_penalty',
        'stop_sequences': 'stop'
    },
    'anthropic': {
        'temperature': 'temperature',
        'max_tokens': 'max_tokens',
        'top_p': 'top_p',
        'stop_sequences': 'stop_sequences',
        # frequency_penalty 和 presence_penalty 不支持，会被过滤掉
    },
    'google': {
        'temperature': 'temperature',
        'max_tokens': 'max_tokens',
        'top_p': 'top_p',
        # frequency_penalty, presence_penalty, stop_sequences 不支持
    },
    'ollama': {
        'temperature': 'temperature',
        'max_tokens': 'max_tokens',
        'top_p': 'top_p',
        'frequency_penalty': 'frequency_penalty',
        'presence_penalty': 'presence_penalty',
        'stop_sequences': 'stop'
    },
    'gpustack': {
        'temperature': 'temperature',
        'max_tokens': 'max_tokens',
        'top_p': 'top_p',
        'frequency_penalty': 'frequency_penalty',
        'presence_penalty': 'presence_penalty',
        'stop_sequences': 'stop'
    }
}

# 优化：移除重复的请求跟踪机制，统一使用connection_manager
# _active_requests 和 register_request 已废弃，使用 connection_manager 替代

class AsyncStreamRunner:
    """
    异步流式请求运行器
    在独立线程中运行 asyncio 事件循环，支持通过 task.cancel() 实现硬取消
    """
    
    def __init__(self, request_id: str, http_read_timeout: int = 120,
                 poll_interval: float = 2.0):
        self.request_id = request_id
        self.http_read_timeout = http_read_timeout
        # 队列轮询间隔：决定取消信号的响应速度（默认2s，测试可调小）
        self.poll_interval = poll_interval
        self.loop = None
        self.task = None
        self.line_queue = queue.Queue()  # 用于传递流式数据
        self.error = None
        self.completed = False
        
    async def _async_stream(self, url: str, headers: dict, payload: dict, timeout: httpx.Timeout):
        """异步流式请求"""
        try:
            async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    # 检查状态码
                    if response.status_code != 200:
                        error_text = await response.aread()
                        self.error = f"HTTP {response.status_code}: {error_text.decode('utf-8', errors='replace')}"
                        # 将错误放入队列通知消费者
                        self.line_queue.put(('error', self.error))
                        return
                    
                    # 流式读取
                    async for line in response.aiter_lines():
                        self.line_queue.put(('line', line))
                        
            # 标记完成
            self.line_queue.put(('done', None))
            self.completed = True
            
        except asyncio.CancelledError:
            # 被取消 - 这是正常的硬取消
            logger.info(f"[异步流式] 请求被取消（硬取消）: {self.request_id}")
            self.line_queue.put(('cancelled', None))
            raise  # 重新抛出，让事件循环知道任务被取消
            
        except Exception as e:
            # 确保错误消息不为空
            error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
            logger.error(f"[异步流式] 请求出错: {self.request_id}, 错误: {error_msg}")
            self.error = error_msg
            self.line_queue.put(('error', error_msg))
    
    def _run_loop(self, url: str, headers: dict, payload: dict, timeout: httpx.Timeout):
        """在独立线程中运行事件循环"""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        
        try:
            self.task = self.loop.create_task(self._async_stream(url, headers, payload, timeout))
            
            # 注册到连接管理器（异步模式）
            connection_manager.register_connection(
                self.request_id,
                async_task=self.task,
                event_loop=self.loop
            )
            logger.info(f"[异步流式] 已注册异步任务: {self.request_id}")
            
            # 运行直到完成或取消
            self.loop.run_until_complete(self.task)
            
        except asyncio.CancelledError:
            logger.info(f"[异步流式] 事件循环检测到取消: {self.request_id}")
        except Exception as e:
            logger.error(f"[异步流式] 事件循环出错: {self.request_id}, 错误: {str(e)}")
            self.error = str(e)
        finally:
            self.loop.close()
    
    def start(self, url: str, headers: dict, payload: dict, timeout: httpx.Timeout) -> threading.Thread:
        """启动异步流式请求"""
        thread = threading.Thread(
            target=self._run_loop,
            args=(url, headers, payload, timeout),
            daemon=True
        )
        thread.start()
        return thread
    
    def iter_lines(self):
        """迭代流式数据（同步接口）"""
        consecutive_timeouts = 0
        # 使用构造时传入的超时配置计算最大轮询次数
        max_consecutive_timeouts = max(1, int(self.http_read_timeout / self.poll_interval))
        
        while True:
            try:
                # 使用较短的轮询超时，以便快速响应取消请求
                msg_type, data = self.line_queue.get(timeout=self.poll_interval)
                consecutive_timeouts = 0  # 重置超时计数
                
                if msg_type == 'line':
                    yield data
                elif msg_type == 'done':
                    break
                elif msg_type == 'cancelled':
                    logger.info(f"[异步流式] 迭代器检测到取消: {self.request_id}")
                    break
                elif msg_type == 'error':
                    raise Exception(data)
                    
            except queue.Empty:
                consecutive_timeouts += 1
                # 每次超时都检查连接管理器的取消状态
                if connection_manager.is_cancelled(self.request_id) or connection_manager.should_interrupt(self.request_id):
                    logger.info(f"[异步流式] 检测到取消信号，退出迭代: {self.request_id}")
                    break
                # 达到最大超时次数：必须抛错而不是静默 break，否则用户看到的是
                # 一段"正常结束"的截断回复，毫无错误提示
                if consecutive_timeouts >= max_consecutive_timeouts:
                    elapsed = consecutive_timeouts * self.poll_interval
                    logger.warning(f"[异步流式] 等待数据超时（{elapsed:.0f}秒）: {self.request_id}")
                    raise TimeoutError(
                        f"等待流式数据超时（{elapsed:.0f}秒），响应可能被截断"
                    ) from None
                # 继续等待下一个数据

def cancel_request(task_id: int, conversation_id: int, agent_id: str = None) -> bool:
    """
    取消请求 - 使用连接管理器直接断开连接

    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        agent_id: 智能体ID，如果提供则只取消该智能体的请求；如果为None则取消所有匹配的连接

    Returns:
        bool: 是否成功取消请求
    """
    if agent_id:
        # 有 agent_id：只取消特定连接
        request_id = generate_request_id(task_id, conversation_id, agent_id)
        logger.info(f"[连接取消] 开始取消请求: {request_id}")
        success = connection_manager.force_close_connection(request_id)
        if success:
            logger.info(f"[连接取消] 连接管理器成功关闭连接: {request_id}")
        else:
            logger.warning(f"[连接取消] 连接管理器未找到连接: {request_id}")
    else:
        # 没有 agent_id：取消所有匹配 task_id:conversation_id:* 的连接。
        # 复用 connection_manager 的带锁前缀清理，避免无锁遍历 _active_connections。
        prefix = f"{task_id}:{conversation_id}:"
        logger.info(f"[连接取消] 开始取消所有匹配的请求: {prefix}*")
        closed_count = connection_manager.force_close_connections_by_prefix(prefix)
        if closed_count == 0:
            logger.warning(f"[连接取消] 未找到匹配的连接: {prefix}*")

    # 总是返回成功，避免前端卡住
    return True

class ModelClient:
    """统一模型客户端 - 支持测试和生产两种场景"""

    def __init__(self):
        """初始化模型客户端"""
        logger.debug("初始化统一模型客户端")

    def send_request(self, model_config, messages: List[Dict[str, str]],
                    is_stream: bool = False, callback: Optional[Callable] = None,
                    agent_info: Optional[Dict[str, Any]] = None, **kwargs) -> str:
        """
        发送模型请求

        Args:
            model_config: ModelConfig对象
            messages: 消息列表
            is_stream: 是否使用流式响应
            callback: 回调函数，如果提供则使用流式响应
            agent_info: 智能体信息(可选)，包含角色和工具信息
            **kwargs: 其他参数

        Returns:
            str: 模型响应内容
        """
        try:
            api_url = model_config.base_url
            api_key = model_config.api_key
            model = model_config.model_id

            # 检测提供商类型（vendor，仅用于视觉适配等厂商相关处理）
            detected_provider = self._detect_provider(
                api_url,
                model_config,
                kwargs.get('provider'),
                model,
            )

            # 解析线协议（wire protocol）：唯一驱动请求构建/解析分支的轴
            # openai = Responses API (/v1/responses)
            # openai-compatible = Chat Completions (/v1/chat/completions)
            # anthropic = Messages (/v1/messages)
            api_format = self._resolve_api_format(model_config, kwargs.get('format_compatibility'))

            # 处理图像消息（如果包含图像）
            from .vision_adapter import vision_adapter
            if vision_adapter.has_images(messages):
                logger.debug(f"[ModelClient] 检测到图像内容，使用视觉适配器处理")
                messages = vision_adapter.format_for_provider(messages, detected_provider)

            # 根据线协议规范化 API URL 和设置请求头
            if api_format == 'anthropic':
                # Anthropic API 使用 /v1/messages 端点
                if not api_url.endswith('/'):
                    api_url = api_url.rstrip('/')
                if not api_url.endswith('/v1/messages'):
                    if '/v1/messages' in api_url:
                        # URL已包含完整路径
                        pass
                    elif '/v1' in api_url:
                        api_url = f"{api_url}/messages"
                    else:
                        api_url = f"{api_url}/v1/messages"

                headers = {
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01"
                }

                # Anthropic API 格式：system 作为顶级参数
                system_message = None
                user_messages = []

                for msg in messages:
                    if msg.get('role') == 'system':
                        system_message = msg.get('content', '')
                    else:
                        user_messages.append(msg)

                payload = {
                    "model": model,
                    "messages": user_messages,
                    "stream": is_stream
                }

                if system_message:
                    payload["system"] = system_message
            elif api_format == 'openai':
                # OpenAI 官方 Responses API (/v1/responses)
                if not api_url.endswith('/'):
                    api_url = api_url.rstrip('/')
                if not api_url.endswith('/responses'):
                    if '/v1' in api_url:
                        api_url = f"{api_url}/responses"
                    else:
                        api_url = f"{api_url}/v1/responses"

                headers = {
                    "Content-Type": "application/json",
                }
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

                # Responses API：system 提取为顶级 instructions，其余消息作为 input
                system_message = None
                input_messages = []
                for msg in messages:
                    if msg.get('role') == 'system':
                        system_message = msg.get('content', '')
                    else:
                        input_messages.append(msg)

                payload = {
                    "model": model,
                    "input": input_messages,
                    "stream": is_stream,
                }
                if system_message:
                    payload["instructions"] = system_message
            else:
                # OpenAI 兼容格式 (Chat Completions /v1/chat/completions，默认)
                if not api_url.endswith('/'):
                    api_url = api_url.rstrip('/')
                if not api_url.endswith('/chat/completions'):
                    api_url = f"{api_url}/chat/completions"

                headers = {
                    "Content-Type": "application/json",
                }
                # 仅在 api_key 非空时添加 Authorization 头（Ollama 等本地模型不需要认证）
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

                # 构建请求payload
                payload = {
                    "model": model,
                    "messages": messages,
                    "stream": is_stream
                }

            # 添加其他参数（根据提供商过滤）
            # 注意：OpenAI 兼容分支是"denylist 透传"，任何未列出的 kwarg 都会进入请求体。
            # 内部路由/控制类 kwargs（如 send_target/isolation_mode/user_id）绝不能进入
            # 上游请求体——严格网关会以 "Extra inputs are not permitted" 报 400。
            excluded_keys = [
                'agent_info', 'task_id', 'conversation_id', 'config', 'provider',
                'model_config',
                'send_target', 'isolation_mode', 'user_id', 'smart_dispatch',
                'enable_subagent', 'wire_stream', 'response_order',
                # Wire-protocol / stream-control keys re-threaded from api_config on
                # the tool-call follow-up round (see stream_handler.handle_tool_calls).
                # They drive request construction, never the request body.
                'api_format',
                'tool_call_context_rounds', 'tool_call_correction',
                'tool_call_correction_threshold',
                # HTTP-transport controls consumed locally (httpx.Timeout is built
                # from SystemSetting), never part of the model request body.
                'timeout', 'request_timeout',
            ]

            # Responses API 用 max_output_tokens 而非 max_tokens
            excluded_keys_format = list(excluded_keys) + ['format_compatibility']

            for key, value in kwargs.items():
                if value is not None and value != [] and key not in excluded_keys_format:
                    if key == 'max_tokens' and value == 0:
                        continue

                    # 根据线协议过滤参数
                    if api_format == 'anthropic':
                        # Anthropic 支持的参数（注意：Claude 不支持 top_p，只支持 top_k）
                        if key in ['temperature', 'max_tokens', 'top_k', 'stop_sequences']:
                            payload[key] = value
                    elif api_format == 'openai':
                        # Responses API 参数（max_tokens -> max_output_tokens）
                        if key == 'max_tokens':
                            payload['max_output_tokens'] = value
                        elif key in ['temperature', 'top_p']:
                            payload[key] = value
                    else:
                        # OpenAI 兼容参数
                        payload[key] = value

            # 添加工具定义(如果有) - 支持 OpenAI/Anthropic/Responses 格式
            if agent_info and 'tools' in agent_info and agent_info['tools']:
                from .tool_format_converter import ToolFormatConverter

                if api_format == 'anthropic':
                    # 转换为Anthropic格式
                    payload['tools'] = ToolFormatConverter.to_provider_tools(agent_info['tools'], 'anthropic')
                    payload['tool_choice'] = ToolFormatConverter.format_tool_choice('auto', 'anthropic')
                    logger.info(f"[ModelClient] 为Anthropic添加了 {len(payload['tools'])} 个工具定义")
                elif api_format == 'openai':
                    # Responses API 工具格式：function 字段平铺到顶层
                    payload['tools'] = ToolFormatConverter.to_provider_tools(agent_info['tools'], 'openai-responses')
                    if 'tool_choice' not in payload:
                        payload['tool_choice'] = "auto"
                    logger.info(f"[ModelClient] 为Responses API添加了 {len(payload['tools'])} 个工具定义")
                else:
                    # OpenAI兼容格式
                    payload['tools'] = agent_info['tools']
                    if 'tool_choice' not in payload:
                        payload['tool_choice'] = "auto"

            # 合并用户配置的 custom_headers / custom_body（来自 ModelConfig）。
            # 类型校验交给 llm_http 模块；非 dict 输入会抛 TypeError，让上游崩出（fail loud）。
            from app.services.llm_http import merge_custom_headers, merge_custom_body
            custom_headers = getattr(model_config, 'custom_headers', None) or {}
            custom_body = getattr(model_config, 'custom_body', None) or {}
            modalities = getattr(model_config, 'modalities', None) or []
            if custom_headers:
                headers = merge_custom_headers(headers, custom_headers)
            if custom_body:
                payload = merge_custom_body(payload, custom_body, modalities=modalities)

            # 根据调试开关输出详细日志
            if DEBUG_LLM_RESPONSE:
                # 恢复详细的日志输出
                logger.debug("\n" + "="*80)
                logger.debug(f"[API请求] 发送到LLM的{'流式' if is_stream else ''}原始数据:")
                logger.debug("-"*40)

                # 打印智能体和角色信息
                if agent_info:
                    logger.debug(f"智能体信息: ID={agent_info.get('id')}, 名称={agent_info.get('name')}")
                    logger.debug(f"角色信息: ID={agent_info.get('role_id')}, 名称={agent_info.get('role_name')}")
                    if 'capabilities' in agent_info and agent_info['capabilities']:
                        logger.debug(f"角色能力: {', '.join(agent_info['capabilities'])}")
                    if 'tool_names' in agent_info and agent_info['tool_names']:
                        logger.debug(f"角色工具: {', '.join(agent_info['tool_names'])}")

                logger.debug(f"模型信息: {model}, 温度={kwargs.get('temperature', 0.7)}")
                logger.debug("-"*40)

                # 打印消息内容（仅在非流式模式下）
                if not is_stream:
                    logger.debug("消息内容:")
                    for i, msg in enumerate(messages):
                        logger.debug(f"[{i+1}] {msg.get('role')}: {msg.get('content')[:100]}..." if len(msg.get('content', '')) > 100 else f"[{i+1}] {msg.get('role')}: {msg.get('content')}")

            logger.debug("*"*80 + "\n")
            logger.debug("完整请求体:")
            logger.debug(json.dumps(payload, ensure_ascii=False, indent=2))
            logger.debug("*"*80 + "\n")

            # 使用已检测的提供商信息进行日志记录
            provider_name = detected_provider if detected_provider else 'unknown'
            logger.info(f"[ModelClient] {'流式' if is_stream else ''}请求: 提供商={provider_name}, URL={api_url}, 模型={model}")

            # 发送请求前发出事件通知
            event_data = {
                'api_url': api_url,
                'model': model,
                'is_stream': is_stream,
                'agent_info': agent_info
            }

            if is_stream:
                event_manager.emit(STREAM_STARTED, event_data)

            # 发送请求
            if DEBUG_LLM_RESPONSE:
                logger.debug(f"[API请求] 正在发送HTTP请求到: {api_url}")

            # 从系统设置获取超时配置
            tool_call_context_rounds = 5  # 默认值
            tool_call_correction = False  # 默认关闭
            tool_call_correction_threshold = 5  # 默认5次
            try:
                from app.models import SystemSetting
                connection_timeout = SystemSetting.get('http_connection_timeout', 5)
                read_timeout = SystemSetting.get('http_read_timeout', 120)
                tool_call_context_rounds = SystemSetting.get('tool_call_context_rounds', 5)
                tool_call_correction = SystemSetting.get('tool_call_correction', False)
                tool_call_correction_threshold = SystemSetting.get('tool_call_correction_threshold', 5)
            except Exception:
                connection_timeout = 5
                read_timeout = 120

            # Per-request controls win over the model setting, which wins over
            # the global HTTP read timeout. ``timeout`` is retained as the
            # runtime alias used by SummaryService; neither key belongs in the
            # upstream model payload.
            configured_read_timeout = kwargs.get('request_timeout')
            if configured_read_timeout is None:
                configured_read_timeout = kwargs.get('timeout')
            if configured_read_timeout is None:
                configured_read_timeout = getattr(model_config, 'request_timeout', None)
            if configured_read_timeout is not None:
                if isinstance(configured_read_timeout, bool):
                    raise TypeError("request timeout must be a positive number")
                configured_read_timeout = float(configured_read_timeout)
                if configured_read_timeout <= 0:
                    raise ValueError("request timeout must be greater than zero")
                read_timeout = configured_read_timeout

            timeout = httpx.Timeout(float(connection_timeout), read=float(read_timeout))
            
            # 生成请求ID
            request_id = None
            task_id = kwargs.get('task_id')
            conversation_id = kwargs.get('conversation_id')
            agent_id = agent_info.get('id') if agent_info else None
            if agent_id is not None:
                agent_id = str(agent_id)
            if task_id and conversation_id:
                request_id = generate_request_id(task_id, conversation_id, agent_id)

            # 流式请求使用异步模式（支持硬取消）
            if is_stream:
                # 创建异步流式运行器，传入read_timeout用于计算轮询超时
                async_runner = AsyncStreamRunner(request_id, http_read_timeout=int(read_timeout))
                async_runner.start(api_url, headers, payload, timeout)
                
                # 等待一小段时间让请求开始
                import time
                time.sleep(0.1)
                
                # 检查是否有错误
                if async_runner.error:
                    raise httpx.HTTPStatusError(
                        f"[API请求] 错误: {async_runner.error}",
                        request=None,
                        response=None
                    )
                
                # 创建一个包装对象，模拟 httpx.Response 的 iter_lines 接口
                class AsyncResponseWrapper:
                    def __init__(self, runner):
                        self._runner = runner
                        self.status_code = 200  # 假设成功（错误已在上面处理）
                    
                    def iter_lines(self):
                        return self._runner.iter_lines()
                    
                    def close(self):
                        pass
                    
                    def raise_for_status(self):
                        if self._runner.error:
                            raise Exception(self._runner.error)
                
                response = AsyncResponseWrapper(async_runner)
                logger.info(f"[API请求] 流式请求已启动（异步模式）: {request_id}")
                
            else:
                # 非流式对外契约：同步返回完整文本。
                # 线级默认走 stream=true 并同步聚合——所有模型都支持流式，且部分模型
                # （如网关上的 minimax-m3 / deepseek-v4-pro）仅支持流式，非流式会 400。
                # 若某模型确需一次性 POST，可在其 additional_params 里设 wire_stream=false。
                _ap = getattr(model_config, 'additional_params', None) or {}
                wire_stream = not (isinstance(_ap, dict) and _ap.get('wire_stream') is False)
                if wire_stream:
                    payload["stream"] = True
                    return self._collect_stream_as_text(api_url, headers, payload, timeout, api_format)

                # 显式关闭线级流式：回退到一次性 POST
                client = httpx.Client(timeout=timeout)
                response = client.post(api_url, headers=headers, json=payload)
                
                # 检查响应状态
                status_code = response.status_code
                if DEBUG_LLM_RESPONSE:
                    logger.debug(f"[API请求] 收到HTTP响应状态码: {status_code}")
                    if status_code != 200:
                        logger.error(f"[API请求] 错误: 服务器返回非200状态码: {status_code}")
                        logger.error(f"[API请求] 响应内容: {response.text}")

            # 非流式请求：检查状态码
            if not is_stream:
                if status_code != 200:
                    error_detail = ""
                    try:
                        error_json = response.json()
                        if 'error' in error_json and 'message' in error_json['error']:
                            error_detail = error_json['error']['message']
                        else:
                            error_detail = response.text
                    except:
                        error_detail = response.text

                    # 抛出带有详细错误信息的异常
                    raise httpx.HTTPStatusError(
                        f"[API请求] 错误: 服务器返回非200状态码: {status_code}\n[API请求] 响应内容: {error_detail}",
                        request=response.request,
                        response=response
                    )

                # 如果状态码是200，继续处理
                response.raise_for_status()

            # 处理流式响应
            if is_stream:
                if DEBUG_LLM_RESPONSE:
                    logger.debug("[API请求] 开始处理流式响应...")

                # 延迟导入，避免循环依赖
                from app.services.conversation.stream_handler import handle_streaming_response, register_streaming_task

                # 准备API配置，用于在工具调用后再次调用LLM
                api_config = {
                    "api_url": api_url,
                    "api_key": api_key,
                    "model": model,
                    "model_config": model_config,
                    "agent_info": agent_info,
                    # 线协议，stream_handler 据此选择 SSE 解析分支
                    "api_format": api_format,
                    # 传递系统设置，避免子函数在无Flask上下文时读取数据库
                    "tool_call_context_rounds": tool_call_context_rounds,
                    "tool_call_correction": tool_call_correction,
                    "tool_call_correction_threshold": tool_call_correction_threshold,
                }
                # 添加其他参数
                for key, value in kwargs.items():
                    if value is not None:
                        api_config[key] = value

                # 如果有任务ID和会话ID，注册流式任务
                task_id = kwargs.get('task_id')
                conversation_id = kwargs.get('conversation_id')
                agent_id = agent_info.get('id') if agent_info else None

                # 确保智能体ID是字符串类型
                if agent_id is not None:
                    agent_id = str(agent_id)

                # 记录调试信息
                if DEBUG_LLM_RESPONSE:
                    logger.debug(f"[API请求] 准备注册流式任务: 任务ID={task_id}, 会话ID={conversation_id}, 智能体ID={agent_id}")
                    logger.debug(f"[API请求] 回调对象: {callback}, 是否有result_queue: {hasattr(callback, 'result_queue')}")

                # 如果提供了任务ID和会话ID，注册流式任务
                if task_id and conversation_id and hasattr(callback, 'result_queue'):
                    # 获取 send_target 参数，默认为 'task'
                    send_target = kwargs.get('send_target', 'task')
                    
                    # 即使没有智能体ID，也注册常规流式任务
                    register_streaming_task(
                        task_id=task_id,
                        conversation_id=conversation_id,
                        result_queue=callback.result_queue,
                        agent_id=agent_id,
                        send_target=send_target
                    )

                    if DEBUG_LLM_RESPONSE:
                        if agent_id:
                            logger.debug(f"[API请求] 已注册智能体流式任务: 任务ID={task_id}, 会话ID={conversation_id}, 智能体ID={agent_id}, send_target={send_target}")
                        else:
                            logger.debug(f"[API请求] 已注册常规流式任务: 任务ID={task_id}, 会话ID={conversation_id}, send_target={send_target}")

                # 传递原始消息和API配置给handle_streaming_response
                return handle_streaming_response(
                    response,
                    callback,
                    original_messages=messages,
                    api_config=api_config
                )
            else:
                # 处理普通响应
                result = response.json()
                if DEBUG_LLM_RESPONSE:
                    logger.debug(f"[API请求] 收到普通响应: {json.dumps(result, ensure_ascii=False)[:500]}...")

                # 尝试从不同格式的响应中提取内容
                content = None
                
                # OpenAI 格式: choices[0].message.content
                if result.get('choices') and result['choices'][0].get('message', {}).get('content'):
                    content = result['choices'][0]['message']['content']
                # Responses API 格式: output_text 便捷字段，或 output[].content[].text
                elif result.get('output_text'):
                    content = result['output_text']
                elif result.get('output') and isinstance(result['output'], list):
                    for item in result['output']:
                        if item.get('type') == 'message':
                            for block in item.get('content', []):
                                if block.get('type') == 'output_text' and block.get('text'):
                                    content = block['text']
                                    break
                        if content:
                            break
                # Anthropic 格式: content[0].text
                elif result.get('content') and isinstance(result['content'], list) and len(result['content']) > 0:
                    first_content = result['content'][0]
                    if isinstance(first_content, dict) and first_content.get('text'):
                        content = first_content['text']
                    elif isinstance(first_content, str):
                        content = first_content
                # Google/Gemini 格式: candidates[0].content.parts[0].text
                elif result.get('candidates') and result['candidates'][0].get('content', {}).get('parts'):
                    parts = result['candidates'][0]['content']['parts']
                    if parts and parts[0].get('text'):
                        content = parts[0]['text']
                
                if content:
                    return content
                else:
                    error_msg = f"Error: 无法从响应中获取内容，响应格式: {list(result.keys())}"
                    if DEBUG_LLM_RESPONSE:
                        logger.error(f"[API请求] {error_msg}")

                    # 发出错误事件
                    event_manager.emit(STREAM_ERROR, {
                        **event_data,
                        'error': error_msg
                    })
                    # 如果有回调函数和智能体信息，使用format_agent_error_done格式化错误消息
                    if callback and agent_info:
                        from app.services.conversation.message_formater import format_agent_error_done

                        # 获取智能体和角色信息
                        agent_id = str(agent_info.get('id', 'unknown'))
                        agent_name = agent_info.get('name', '智能体')
                        role_name = agent_info.get('role_name', '未知角色')

                        # 格式化错误消息 - 直接使用完整错误信息
                        formatted_error = format_agent_error_done(
                            agent_id=agent_id,
                            agent_name=agent_name,
                            role_name=role_name,
                            error_content=error_msg
                        )

                        # 发送格式化的错误消息
                        try:
                            # 尝试使用两个参数调用
                            callback(None, formatted_error["meta"])
                        except TypeError:
                            # 如果回调函数只接受一个参数，则使用一个参数调用
                            try:
                                callback(f"\n[错误] {error_msg}")
                            except:
                                logger.warning(f"[ModelClient] 警告: 无法调用回调函数")

                    return error_msg

        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            error_msg = f"API请求失败: {str(e)}"
            logger.error(f"[ModelClient] 错误: {error_msg}")
            if DEBUG_LLM_RESPONSE:
                logger.error(f"[API请求] 异常详情: {traceback.format_exc()}")

            # 检查是否是由于取消导致的异常
            is_cancelled = False
            task_id = kwargs.get('task_id')
            conversation_id = kwargs.get('conversation_id')
            agent_id = agent_info.get('id') if agent_info else None

            # 使用统一的请求ID生成函数
            request_id = generate_request_id(task_id, conversation_id, agent_id)

            # 检查是否是已注册的请求 - 使用connection_manager
            if connection_manager.is_cancelled(request_id):
                is_cancelled = True
                logger.info(f"[ModelClient] 请求已被取消: {request_id}")

            # 如果不是由于取消导致的异常，发出错误事件
            if not is_cancelled:
                # 发出错误事件
                event_manager.emit(STREAM_ERROR, {
                    'api_url': api_url,
                    'model': model,
                    'is_stream': is_stream,
                    'error': error_msg,
                    'agent_info': agent_info  # 添加智能体信息
                })

                # 如果有回调函数和智能体信息，使用format_agent_error_done格式化错误消息
                if callback and agent_info:
                    from app.services.conversation.message_formater import format_agent_error_done

                    # 获取智能体和角色信息
                    agent_id = str(agent_info.get('id', 'unknown'))
                    agent_name = agent_info.get('name', '智能体')
                    role_name = agent_info.get('role_name', '未知角色')

                    # 格式化错误消息 - 直接使用完整错误信息
                    formatted_error = format_agent_error_done(
                        agent_id=agent_id,
                        agent_name=agent_name,
                        role_name=role_name,
                        error_content=error_msg
                    )

                    # 发送格式化的错误消息
                    try:
                        # 尝试使用两个参数调用
                        callback(None, formatted_error["meta"])
                    except TypeError:
                        # 如果回调函数只接受一个参数，则使用一个参数调用
                        try:
                            callback(f"\n[错误] {error_msg}")
                        except:
                            logger.warning(f"[ModelClient] 警告: 无法调用回调函数")
                elif callback:
                    callback(f"\n[错误] {error_msg}")

            return f"Error: {error_msg}"

        except Exception as e:
            error_msg = f"处理消息时出错: {str(e)}"
            logger.error(f"[ModelClient] 错误: {error_msg}")
            if DEBUG_LLM_RESPONSE:
                logger.error(f"[API请求] 异常详情: {traceback.format_exc()}")

            # 检查是否是由于取消导致的异常
            is_cancelled = False
            task_id = kwargs.get('task_id')
            conversation_id = kwargs.get('conversation_id')
            agent_id = agent_info.get('id') if agent_info else None

            # 使用统一的请求ID生成函数（只有在有task_id和conversation_id时才构建）
            request_id = None
            if task_id and conversation_id:
                request_id = generate_request_id(task_id, conversation_id, agent_id)

            # 检查是否是由于取消导致的异常
            if request_id and connection_manager.is_cancelled(request_id):
                is_cancelled = True
                logger.info(f"[ModelClient] 请求已被取消（非错误）: {request_id}")
            
            # 检查异常消息是否包含取消相关的内容
            error_str = str(e)
            if "流式处理被取消" in error_str or "CancelledError" in error_str:
                is_cancelled = True
                logger.info(f"[ModelClient] 根据异常消息判断请求被取消: {error_str[:100]}")

            # 如果是取消，返回空字符串（不是错误）
            if is_cancelled:
                return ""  # 返回空字符串表示正常取消

            # 如果不是由于取消导致的异常，发出错误事件
            if not is_cancelled:
                # 发出错误事件
                event_manager.emit(STREAM_ERROR, {
                    'api_url': api_url,
                    'model': model,
                    'is_stream': is_stream,
                    'error': error_msg,
                    'agent_info': agent_info  # 添加智能体信息
                })
                # 如果有回调函数和智能体信息，使用format_agent_error_done格式化错误消息
                if callback and agent_info:
                    from app.services.conversation.message_formater import format_agent_error_done

                    # 获取智能体和角色信息
                    agent_id = str(agent_info.get('id', 'unknown'))
                    agent_name = agent_info.get('name', '智能体')
                    role_name = agent_info.get('role_name', '未知角色')

                    # 格式化错误消息 - 直接使用完整错误信息
                    formatted_error = format_agent_error_done(
                        agent_id=agent_id,
                        agent_name=agent_name,
                        role_name=role_name,
                        error_content=error_msg
                    )

                    # 发送格式化的错误消息
                    try:
                        # 尝试使用两个参数调用
                        callback(None, formatted_error["meta"])
                    except TypeError:
                        # 如果回调函数只接受一个参数，则使用一个参数调用
                        try:
                            callback(f"\n[错误] {error_msg}")
                        except:
                            logger.warning(f"[ModelClient] 警告: 无法调用回调函数")
                elif callback:
                        callback(f"\n[错误] {error_msg}")

                return f"Error: {error_msg}"

    # === 测试方法 (兼容ModelService接口) ===

    def test_model(self, config, prompt: str, system_prompt: str = None,
                  use_stream: bool = False, callback: Optional[Callable] = None, **kwargs):
        """
        测试模型配置 - ModelConfig层使用，兼容原ModelService.test_model接口

        Args:
            config: ModelConfig对象，只使用基础模型配置参数
            prompt: 测试提示词
            system_prompt: 系统提示词
            use_stream: 是否使用流式响应
            callback: 回调函数
            **kwargs: 额外参数

        Returns:
            dict: 测试结果，包含success状态和消息
        """
        try:
            # 准备测试消息
            test_messages = [
                {"role": "system", "content": system_prompt or "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ]

            # 构建参数
            params, prompt_info = self._build_parameters_from_hierarchy(
                model_config=config,
                runtime_params=kwargs
            )

            # 检测供应商
            provider = self._detect_provider(config=config)

            # 映射和过滤参数
            filtered_params = self._map_and_filter_parameters(provider, **params)

            if use_stream:
                # 流式测试
                def handle_stream_chunk(content):
                    if callback:
                        callback(content)

                # 构建agent_info以传递provider信息
                agent_info = {
                    'provider': config.provider if hasattr(config, 'provider') else 'unknown',
                    'name': '模型测试系统',
                    'role_name': '模型测试器'
                }

                # 调用现有的send_request方法进行流式测试
                result = self.send_request(
                    model_config=config,
                    messages=test_messages,
                    is_stream=True,
                    callback=handle_stream_chunk,
                    agent_info=agent_info,
                    **filtered_params
                )

                # 检查响应是否包含错误信息
                if result.startswith('Error:'):
                    return {
                        'success': False,
                        'message': result,
                        'stream': True
                    }

                return {
                    'success': True,
                    'message': '流式API连接测试成功',
                    'response': result,
                    'stream': True
                }
            else:
                # 构建agent_info以传递provider信息
                agent_info = {
                    'provider': config.provider if hasattr(config, 'provider') else 'unknown',
                    'name': '模型测试系统',
                    'role_name': '模型测试器'
                }

                # 非流式测试
                result = self.send_request(
                    model_config=config,
                    messages=test_messages,
                    is_stream=False,
                    agent_info=agent_info,
                    **filtered_params
                )

                # 检查响应是否包含错误信息
                if result.startswith('Error:'):
                    return {
                        'success': False,
                        'message': result
                    }

                return {
                    'success': True,
                    'message': f'API连接测试成功: {result[:50]}...',
                    'response': result
                }

        except Exception as e:
            return {
                'success': False,
                'message': f'API连接测试失败: {str(e)}'
            }

    def test_model_stream(self, config, prompt: str, system_prompt: str = None,
                         callback: Optional[Callable] = None, **kwargs):
        """
        流式测试模型配置 - Role层使用，兼容原ModelService.test_model_stream接口

        Args:
            config: ModelConfig对象，包含基础参数
            prompt: 测试提示词
            system_prompt: 系统提示词
            callback: 流式回调函数
            **kwargs: 角色参数 (temperature, top_p, frequency_penalty, presence_penalty, max_tokens, stop_sequences)

        Returns:
            dict: 测试结果，包含success状态、响应内容和消息
        """
        try:
            logger.info(f"[ModelClient] 开始流式测试: URL={config.base_url}, 模型={config.model_id}")

            # 准备测试消息
            test_messages = [
                {"role": "system", "content": system_prompt or "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ]

            # 构建参数 - 将kwargs作为role_params传递
            params, prompt_info = self._build_parameters_from_hierarchy(
                model_config=config,
                role_params=kwargs
            )

            # 检测供应商
            provider = self._detect_provider(config=config)

            # 映射和过滤参数
            filtered_params = self._map_and_filter_parameters(provider, **params)

            # 定义流式回调函数
            def streaming_callback(content):
                if content and callback:
                    # 确保内容是字符串
                    if isinstance(content, bytes):
                        try:
                            content = content.decode('utf-8')
                        except UnicodeDecodeError:
                            content = content.decode('utf-8', errors='replace')

                    # 直接调用回调函数
                    callback(content)

            # 构建agent_info以传递provider信息
            agent_info = {
                'provider': config.provider if hasattr(config, 'provider') else 'unknown',
                'name': '模型流式测试系统',
                'role_name': '模型流式测试器'
            }

            # 调用现有的send_request方法进行流式测试
            result = self.send_request(
                model_config=config,
                messages=test_messages,
                is_stream=True,
                callback=streaming_callback,
                agent_info=agent_info,
                **filtered_params
            )

            # 如果响应以"Error:"开头，表示出错
            if result and result.startswith("Error:"):
                return {
                    'success': False,
                    'message': result
                }

            return {
                'success': True,
                'response': result,
                'message': f'模型流式测试成功'
            }

        except Exception as e:
            logger.error(f"[ModelClient] 模型流式测试出错: {str(e)}")
            error_message = f"API连接测试失败: {str(e)}"

            # 如果设置了回调，通知错误
            if callback:
                callback(f"Error: {error_message}")

            return {
                'success': False,
                'message': error_message
            }

    # === 内部方法 ===

    def _collect_stream_as_text(self, api_url: str, headers: dict, payload: dict,
                                timeout: "httpx.Timeout", api_format: str) -> str:
        """同步发起线级流式请求并将增量拼接为完整文本。

        用于对外契约为"非流式/同步返回完整文本"的内部调用（子智能体、摘要、
        智能分发、supervisor 等）。这些调用运行在线程池中，没有 SSE 所需的
        connection_manager 上下文，因此不能走异步流式路径；这里用同步
        httpx 流式读取，既兼容"仅支持流式"的模型，又保持同步返回契约。

        兼容 openai-compatible(chat) / openai(responses) / anthropic 三种 SSE 增量形态。
        非 200 直接抛 httpx.HTTPStatusError，交由上层统一错误处理。
        """
        parts: List[str] = []
        has_reasoning = False
        with httpx.Client(timeout=timeout) as client:
            with client.stream("POST", api_url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    body = response.read().decode("utf-8", errors="replace")
                    raise httpx.HTTPStatusError(
                        f"[API请求] 错误: 服务器返回非200状态码: {response.status_code}\n[API请求] 响应内容: {body}",
                        request=response.request,
                        response=response,
                    )
                for line in response.iter_lines():
                    if not line:
                        continue
                    data = line[len("data:"):].strip() if line.startswith("data:") else line.strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        obj = json.loads(data)
                    except (json.JSONDecodeError, ValueError):
                        continue
                    reasoning, content = self._extract_stream_delta(obj)
                    # reasoning_content 用 <thinking>…</thinking> 包裹，与 stream_handler 保持一致
                    if reasoning:
                        if not has_reasoning:
                            parts.append("<thinking>\n")
                            has_reasoning = True
                        parts.append(reasoning)
                    if content:
                        if has_reasoning:
                            parts.append("\n</thinking>\n")
                            has_reasoning = False
                        parts.append(content)
        if has_reasoning:
            parts.append("\n</thinking>")
        return "".join(parts)

    @staticmethod
    def _extract_stream_delta(obj: dict) -> tuple:
        """从单条 SSE 增量对象中提取 (reasoning, content)，兼容三种线协议。"""
        if not isinstance(obj, dict):
            return None, None
        choices = obj.get("choices")
        if choices and isinstance(choices, list):
            delta = choices[0].get("delta") or {}
            return delta.get("reasoning_content"), delta.get("content")
        obj_type = obj.get("type", "")
        if obj_type == "content_block_delta":
            return None, (obj.get("delta") or {}).get("text")
        if obj_type.endswith("output_text.delta"):
            return None, obj.get("delta")
        return None, None

    def _detect_provider(self, api_url: str = None, config = None, provider: str = None, model_id: str = None) -> str:
        """
        获取服务供应商（基于确定性原则，不进行推断）

        Args:
            api_url: API地址（保留参数以兼容旧代码，但不再用于推断）
            config: 模型配置对象
            provider: 直接指定的供应商
            model_id: 模型ID（用于从数据库查询provider）

        Returns:
            str: 供应商名称
        """
        # 优先使用直接指定的供应商
        if provider:
            return provider

        # 其次从配置对象中获取提供商信息
        if config and hasattr(config, 'provider') and config.provider:
            return config.provider

        # 通过 model_id 从数据库查询 provider
        if model_id:
            try:
                from app.models import ModelConfig
                model_config = ModelConfig.query.filter_by(model_id=model_id).first()
                if model_config and model_config.provider:
                    return model_config.provider
            except Exception as e:
                logger.warning(f"[ModelClient] 通过model_id={model_id}查询provider失败: {str(e)}")

        # 默认返回 openai（OpenAI 兼容格式是最通用的）
        return 'openai'

    def _resolve_api_format(self, model_config=None, override: str = None) -> str:
        """解析线协议（wire protocol）。

        唯一驱动请求构建与响应解析分支的轴，取值：
        - 'openai'            OpenAI 官方 Responses API (/v1/responses)
        - 'openai-compatible' Chat Completions (/v1/chat/completions)，默认
        - 'anthropic'         Anthropic Messages (/v1/messages)

        优先级：显式 override > model_config.format_compatibility > 默认。
        旧值 'custom' 归一为 'openai-compatible'。
        """
        valid = {'openai', 'openai-compatible', 'anthropic'}
        value = override or getattr(model_config, 'format_compatibility', None)
        if value == 'custom' or not value:
            return 'openai-compatible'
        if value not in valid:
            logger.warning(
                f"[ModelClient] 未知 format_compatibility={value!r}，回退到 openai-compatible"
            )
            return 'openai-compatible'
        return value

    def _build_parameters_from_hierarchy(self, model_config=None, platform_params=None,
                                        role_params=None, runtime_params=None) -> Tuple[Dict, Dict]:
        """
        构建参数层级继承

        Args:
            model_config: ModelConfig对象，包含max_tokens等基础参数
            platform_params: Platform层参数，包含辅助提示词等平台功能配置
            role_params: Role层参数，包含temperature等扩展参数
            runtime_params: 运行时传入的参数，可覆盖上层参数

        Returns:
            Tuple[Dict, Dict]: (合并后的参数字典, 提示词信息)
        """
        final_params = {}
        prompt_info = {}

        # 1. 从ModelConfig继承基础参数
        if model_config:
            if hasattr(model_config, 'max_output_tokens') and model_config.max_output_tokens:
                final_params['max_tokens'] = model_config.max_output_tokens
            else:
                final_params['max_tokens'] = 2000  # 默认值

        # 2. 从Platform继承平台级参数 (与ModelConfig并行)
        if platform_params:
            prompt_info.update({
                'auxiliary_prompts': platform_params.get('auxiliary_prompts', []),
                'platform_specific_settings': platform_params.get('platform_specific_settings', {}),
                'platform_function_configs': platform_params.get('platform_function_configs', {})
            })

        # 3. 从Role继承扩展参数 (继承ModelConfig)
        if role_params:
            role_param_mapping = {
                'temperature': role_params.get('temperature'),
                'top_p': role_params.get('top_p'),
                'frequency_penalty': role_params.get('frequency_penalty'),
                'presence_penalty': role_params.get('presence_penalty'),
                'stop_sequences': role_params.get('stop_sequences'),
                'max_tokens': role_params.get('max_tokens')  # Role层可以覆盖ModelConfig的max_tokens
            }
            # 只添加非None的参数
            for key, value in role_param_mapping.items():
                if value is not None:
                    final_params[key] = value

            # 角色提示词
            if role_params.get('role_prompt'):
                prompt_info['role_prompt'] = role_params.get('role_prompt')

        # 4. 运行时参数覆盖
        if runtime_params:
            for key, value in runtime_params.items():
                if value is not None:
                    final_params[key] = value

        return final_params, prompt_info

    def _map_and_filter_parameters(self, provider: str, **kwargs) -> Dict:
        """
        根据供应商映射和过滤参数

        Args:
            provider: 供应商名称
            **kwargs: 平台标准参数

        Returns:
            Dict: 映射后的供应商参数
        """
        provider_mapping = PROVIDER_PARAMETER_MAPPING.get(provider, {})
        mapped_params = {}

        for platform_param, value in kwargs.items():
            if value is None:
                continue

            # 跳过特殊值
            if platform_param == 'max_tokens' and value == 0:
                continue

            # 检查是否有映射
            if platform_param in provider_mapping:
                provider_param = provider_mapping[platform_param]
                mapped_params[provider_param] = value
            # 如果没有映射但参数名相同，检查是否是标准参数
            elif platform_param in ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop_sequences']:
                # 对于标准参数，如果映射表中没有定义，说明该供应商不支持，跳过
                logger.debug(f"[ModelClient] 供应商 {provider} 不支持参数 {platform_param}，已跳过")
                continue
            else:
                # 其他参数直接传递
                mapped_params[platform_param] = value

        logger.debug(f"[ModelClient] 供应商 {provider} 参数映射结果: {mapped_params}")
        return mapped_params
