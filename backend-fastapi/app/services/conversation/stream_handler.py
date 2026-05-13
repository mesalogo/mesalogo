"""
流式处理模块

提供处理流式响应和SSE事件流的功能

函数与关键变量说明:
---------------------------------------

SSE相关函数:
* create_sse_response - 创建SSE响应
  - generator_function: 生成器函数

* queue_to_sse - 将队列内容转换为SSE事件流
  - result_queue: 结果队列

* wrap_stream_callback - 包装流式回调函数
  - result_queue: 结果队列

流式响应处理:
* handle_streaming_response - 处理流式响应
  - response: 响应对象
  - callback: 回调函数

* call_llm_with_tool_results - 在工具调用执行后再次调用LLM
  - original_messages: 原始消息历史
  - tool_calls: 工具调用列表
  - tool_results: 工具调用结果列表
  - api_config: API配置信息
  - callback: 回调函数
"""
import json
import logging
import queue
import re
import threading
import traceback
import uuid
import asyncio
import httpx
from typing import Dict, Any, Callable, Generator, List

from starlette.responses import StreamingResponse
from config import DEBUG_LLM_RESPONSE
from app.services.conversation.tool_handler import execute_tool_call, parse_tool_calls
from app.services.conversation.message_formater import format_tool_call, format_tool_result_as_role, serialize_message
from app.services.conversation.model_client import ModelClient
from app.services.conversation.connection_manager import connection_manager
from app.services.conversation.tool_call_executor import detect_tool_status, execute_and_format_tool_call
from app.services.conversation.tool_json_utils import remove_tool_result_jsons

logger = logging.getLogger(__name__)

# 自定义异常类，用于主动中断流式处理
class StreamCancelledException(Exception):
    """流式处理被取消异常"""
    def __init__(self, request_id: str, agent_id: str = None):
        self.request_id = request_id
        self.agent_id = agent_id
        super().__init__(f"流式处理被取消: {request_id}")

# 线程锁，保护全局字典
_tasks_lock = threading.RLock()
# 添加全局变量来跟踪流式任务
_active_streaming_tasks = {}
# 添加全局变量来跟踪智能体流式任务
_agent_streaming_tasks = {}

def create_sse_response(generator_function: Callable) -> StreamingResponse:
    """创建SSE响应"""
    return StreamingResponse(
        generator_function(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )

def queue_to_sse(result_queue: queue.Queue) -> Generator[str, None, None]:
    """将队列内容转换为SSE事件流"""
    # 导入格式化函数
    from app.services.conversation.message_formater import format_agent_cancel_done, serialize_message
    from app.models import Agent, Role

    while True:
        message = result_queue.get()
        if message is None:  # 结束信号
            # 使用空行或结束事件表示传输结束
            yield "data: \n\n"
            break

        # 检查是否是取消信号
        if isinstance(message, dict) and message.get('type') == 'cancel':
            logger.info(f"收到取消信号: {message}")

            # 如果包含agent_id，说明是特定智能体的取消信号
            agent_id = message.get('agent_id')
            if agent_id:
                try:
                    # 获取智能体信息
                    agent = Agent.query.get(agent_id)
                    if agent:
                        agent_role = Role.query.get(agent.role_id) if hasattr(agent, 'role_id') and agent.role_id else None
                        role_name = agent_role.name if agent_role else "智能助手"

                        # 生成取消消息
                        cancel_content = f"智能体响应被用户取消: {agent.name}({role_name})"

                        # 格式化取消完成消息
                        cancel_done_msg = format_agent_cancel_done(
                            agent_id=str(agent_id),
                            agent_name=agent.name,
                            role_name=role_name,
                            timestamp=None,
                            response_order=1,
                            cancel_content=cancel_content
                        )

                        # 序列化并发送取消完成消息（agentDone）
                        cancel_done_str = serialize_message(cancel_done_msg)
                        yield f"data: {cancel_done_str}\n\n"

                        # 同时发送done信号，确保前端正确更新状态
                        done_msg = {
                            "content": None,
                            "meta": {
                                "connectionStatus": "done"
                            }
                        }
                        done_str = serialize_message(done_msg)
                        yield f"data: {done_str}\n\n"

                        logger.info(f"已发送智能体取消完成消息和done信号: {agent_id}")
                        # 取消单个智能体后，继续等待下一个智能体的输出（不关闭 SSE 流）
                        continue
                except Exception as e:
                    logger.error(f"处理智能体取消信号出错: {str(e)}")
                    # 即使出错也要发送一个基本的完成信号
                    error_meta = {
                        "content": None,
                        "meta": {
                            "connectionStatus": "agentDone",
                            "responseObj": {
                                "response": {
                                    "id": f"error-cancel-{agent_id}",
                                    "content": f"取消处理出错: {str(e)}",
                                    "agent_id": str(agent_id),
                                    "is_cancelled": True
                                }
                            }
                        }
                    }
                    error_str = serialize_message(error_meta)
                    yield f"data: {error_str}\n\n"
                    # 出错后也继续等待下一个智能体
                    continue
            
            # 如果没有 agent_id，说明是全局取消信号，结束流
            yield "data: \n\n"
            break

        # 简化：移除agent_cancel的特殊处理
        # agent_cancel原本设计用于自主任务中取消某个智能体但继续其他智能体
        # 但实际上这个场景已经不需要了，因为：
        # 1. 取消单个智能体时应该结束流（发送cancel而不是agent_cancel）
        # 2. 自主任务的停止由conversation_service.py在入口处理
        # 保留此注释以供参考，如果未来需要可以恢复

        # 如果是字典，序列化为JSON
        if isinstance(message, dict):
            try:
                message = json.dumps(message, ensure_ascii=False)
                yield f"data: {message}\n\n"
            except Exception as e:
                error_msg = f"错误: 无法序列化消息为JSON: {str(e)}"
                yield f"data: {error_msg}\n\n"
        else:
            # 否则直接发送字符串
            yield f"data: {message}\n\n"

def wrap_stream_callback(result_queue: queue.Queue) -> Callable:
    """包装流式回调函数"""
    def callback(content):
        result_queue.put(content)
    # 将 result_queue 附加到回调函数上，供 model_client 使用
    callback.result_queue = result_queue
    return callback

def register_streaming_task(task_id: int, conversation_id: int, result_queue: queue.Queue, agent_id: str = None, send_target: str = 'task') -> None:
    """
    注册流式任务以便后续管理

    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        result_queue: 结果队列
        agent_id: 智能体ID，如果提供则同时注册智能体流式任务
        send_target: 发送目标，'task'表示任务会话，'supervisor'表示监督者会话
    """
    with _tasks_lock:
        # 使用 send_target 区分监督者会话和任务会话，避免key冲突
        task_key = f"{task_id}:{conversation_id}:{send_target}"
        _active_streaming_tasks[task_key] = result_queue

        # 如果提供了智能体ID，同时注册智能体流式任务
        if agent_id:
            agent_key = f"{task_id}:{conversation_id}:{send_target}:{agent_id}"
            _agent_streaming_tasks[agent_key] = result_queue
            logger.info(f"已注册智能体流式任务: {agent_key}")

        logger.info(f"已注册流式任务: {task_key}")

def cancel_streaming_task(task_id: int, conversation_id: int, agent_id: str = None, send_target: str = None) -> bool:
    """
    取消正在进行的流式任务

    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        agent_id: 智能体ID，如果提供则只取消该智能体的流式任务（不停止自主任务调度）
        send_target: 发送目标，'task'表示任务会话，'supervisor'表示监督者会话，None表示取消所有

    Returns:
        bool: 是否成功取消任务
    """
    from app.services.conversation.model_client import cancel_request

    logger.info(f"开始取消流式任务: task_id={task_id}, conversation_id={conversation_id}, agent_id={agent_id}, send_target={send_target}")

    # 1. 取消底层HTTP请求（关闭socket）
    cancel_request(task_id, conversation_id, agent_id)

    # 2. 尝试调用外部平台的停止API
    if agent_id:
        try:
            from app.services.conversation.external_model_client import external_model_client
            external_model_client.stop_external_streaming(task_id, conversation_id, agent_id)
        except Exception as e:
            logger.warning(f"调用外部平台停止API失败: {str(e)}")

    # 3. 处理队列和任务字典（加锁保护）
    with _tasks_lock:
        if agent_id:
            # 只取消特定智能体的流式任务
            agent_id = str(agent_id)
            
            # 查找匹配的智能体任务
            matching_keys = []
            if send_target:
                # 如果指定了 send_target，只查找对应的任务
                agent_key = f"{task_id}:{conversation_id}:{send_target}:{agent_id}"
                if agent_key in _agent_streaming_tasks:
                    matching_keys.append(agent_key)
            else:
                # 如果没有指定 send_target，查找所有匹配的任务
                for key in list(_agent_streaming_tasks.keys()):
                    parts = key.split(':')
                    if len(parts) >= 3 and parts[0] == str(task_id) and parts[1] == str(conversation_id):
                        # 检查最后一部分是否是 agent_id（兼容旧格式和新格式）
                        if parts[-1] == agent_id:
                            matching_keys.append(key)
            
            # 发送取消信号并清理
            for key in matching_keys:
                try:
                    queue_obj = _agent_streaming_tasks.get(key)
                    if queue_obj:
                        queue_obj.put({"type": "cancel", "message": "用户取消了智能体流式输出", "agent_id": agent_id})
                        del _agent_streaming_tasks[key]
                        logger.info(f"成功取消智能体流式任务: {key}")
                except Exception as e:
                    logger.error(f"取消智能体流式任务出错: {str(e)}")
            
            # 如果没找到智能体任务，尝试通过常规任务发送取消信号
            if not matching_keys:
                # 尝试所有可能的 task_key
                possible_keys = []
                if send_target:
                    possible_keys.append(f"{task_id}:{conversation_id}:{send_target}")
                else:
                    # 尝试所有 send_target
                    for key in list(_active_streaming_tasks.keys()):
                        if key.startswith(f"{task_id}:{conversation_id}:"):
                            possible_keys.append(key)
                
                for task_key in possible_keys:
                    queue_obj = _active_streaming_tasks.get(task_key)
                    if queue_obj:
                        queue_obj.put({"type": "cancel", "message": "用户取消了智能体流式输出", "agent_id": agent_id})
                        logger.info(f"通过常规任务取消智能体: {agent_id}, key: {task_key}")
        else:
            # 取消整个会话的流式任务
            if send_target:
                # 只取消指定 send_target 的任务
                task_key = f"{task_id}:{conversation_id}:{send_target}"
                queue_obj = _active_streaming_tasks.get(task_key)
                if queue_obj:
                    queue_obj.put({"type": "cancel", "message": "用户取消了流式输出"})
                    del _active_streaming_tasks[task_key]
                    logger.info(f"成功取消流式任务: {task_key}")
                
                # 清理相关的智能体流式任务
                for key in list(_agent_streaming_tasks.keys()):
                    if key.startswith(f"{task_id}:{conversation_id}:{send_target}:"):
                        try:
                            q = _agent_streaming_tasks.get(key)
                            if q:
                                q.put({"type": "cancel", "message": "用户取消了流式输出"})
                            del _agent_streaming_tasks[key]
                        except Exception as e:
                            logger.error(f"清理智能体任务出错: {key}, {str(e)}")
            else:
                # 取消所有 send_target 的任务
                for key in list(_active_streaming_tasks.keys()):
                    if key.startswith(f"{task_id}:{conversation_id}:"):
                        try:
                            queue_obj = _active_streaming_tasks.get(key)
                            if queue_obj:
                                queue_obj.put({"type": "cancel", "message": "用户取消了流式输出"})
                            del _active_streaming_tasks[key]
                            logger.info(f"成功取消流式任务: {key}")
                        except Exception as e:
                            logger.error(f"取消流式任务出错: {key}, {str(e)}")
                
                # 清理所有相关的智能体流式任务
                for key in list(_agent_streaming_tasks.keys()):
                    if key.startswith(f"{task_id}:{conversation_id}:"):
                        try:
                            q = _agent_streaming_tasks.get(key)
                            if q:
                                q.put({"type": "cancel", "message": "用户取消了流式输出"})
                            del _agent_streaming_tasks[key]
                        except Exception as e:
                            logger.error(f"清理智能体任务出错: {key}, {str(e)}")

    # 职责分离：cancel_streaming_task 只负责取消HTTP流
    # 停止自主任务调度由 stop API 单独调用 stop_auto_discussion
    # - cancel-stream 带 agent_id：只取消当前Agent的流，继续下一个
    # - cancel-stream 不带 agent_id：取消所有流（但不停止调度）
    # - stop API：停止调度 + 取消流

    return True

def call_llm_with_tool_results(original_messages: List[Dict[str, Any]],
                         tool_calls: List[Dict[str, Any]],
                         tool_results: List[Dict[str, Any]],
                         api_config: Dict[str, Any],
                         callback: Callable):
    """
    在工具调用执行后再次调用LLM
    
    正确的消息流程：
    - original_messages 已经是从数据库加载的完整历史（system + user + 之前完成的对话）
    - 当前轮次只需要在末尾追加：assistant(tool_use) + user(tool_result)
    
    注意：当前正在输出的 agent 消息在 agentDone 之前不应该被作为 history，
    所以 original_messages 中不包含当前轮次的 assistant 消息。

    Args:
        original_messages: 原始消息历史（不包含当前轮次的 assistant 消息）
        tool_calls: 当前轮次的工具调用列表
        tool_results: 当前轮次的工具调用结果列表
        api_config: API配置信息，包含api_url, api_key, model, agent_info等
        callback: 回调函数

    Returns:
        str: LLM的最终回复
    """
    if DEBUG_LLM_RESPONSE:
        logger.debug("\n" + "="*40)
        logger.debug("[工具调用后再次调用LLM] 开始处理")
        logger.debug("-"*40)

    try:
        # 1. 清理original_messages中的工具调用JSON
        cleaned_messages = []
        for msg in original_messages:
            if msg.get('role') == 'assistant' and isinstance(msg.get('content'), str):
                # 清理assistant消息中的JSON
                cleaned_content = remove_tool_result_jsons(msg['content'])
                if cleaned_content.strip():
                    cleaned_messages.append({
                        **msg,
                        'content': cleaned_content
                    })
                    if DEBUG_LLM_RESPONSE:
                        logger.debug(f"[工具调用后再次调用LLM] 清理了assistant消息中的JSON，原长度: {len(msg['content'])}, 清理后: {len(cleaned_content)}")
                else:
                    # 如果清理后为空，检查是否有tool_calls字段
                    if msg.get('tool_calls'):
                        cleaned_messages.append(msg)
                        if DEBUG_LLM_RESPONSE:
                            logger.debug(f"[工具调用后再次调用LLM] assistant消息清理后为空但有tool_calls，保留")
                    else:
                        if DEBUG_LLM_RESPONSE:
                            logger.debug(f"[工具调用后再次调用LLM] assistant消息清理后为空且无tool_calls，跳过")
            else:
                cleaned_messages.append(msg)
        
        messages = cleaned_messages
        logger.info(f"[工具调用后再次调用LLM] 清理后消息数量: {len(messages)}, 原始: {len(original_messages)}")

        # 2. 检测提供商类型
        agent_info = api_config.get("agent_info", {})
        provider = agent_info.get('provider', 'openai')
        
        # 导入格式转换器
        from .tool_format_converter import ToolFormatConverter
        
        # 3. 准备统一格式的工具调用
        unified_tool_calls = []
        for tool_call in tool_calls:
            tool_call_id = tool_call.get("id")
            if not tool_call_id:
                tool_call_id = str(uuid.uuid4())
                tool_call["id"] = tool_call_id
            
            # 解析arguments
            arguments = tool_call["function"]["arguments"]
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments)
                except json.JSONDecodeError:
                    arguments = {}
            
            unified_tool_calls.append({
                "id": tool_call_id,
                "name": tool_call["function"]["name"],
                "arguments": arguments
            })
        
        # 4. 追加当前轮次的 assistant 消息（包含 tool_use）
        assistant_message = ToolFormatConverter.to_provider_assistant_message("", unified_tool_calls, provider)
        messages.append(assistant_message)

        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[工具调用后再次调用LLM] 创建了{provider}格式的assistant消息，包含 {len(unified_tool_calls)} 个工具调用")

        # 5. 追加当前轮次的工具调用结果
        # 构建 tool_call_id -> tool_result 的映射
        tool_result_map = {}
        for tr in tool_results:
            tr_id = tr.get("tool_call_id")
            if tr_id:
                tool_result_map[tr_id] = tr
        
        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[工具调用后再次调用LLM] 工具结果映射: {list(tool_result_map.keys())}")
            logger.debug(f"[工具调用后再次调用LLM] 工具调用ID列表: {[tc.get('id') for tc in tool_calls]}")
        
        if provider == 'anthropic':
            # Claude 格式：所有工具结果合并到一个 user 消息的 content 数组中
            tool_result_blocks = []
            for tool_call in tool_calls:
                tool_call_id = tool_call.get("id")
                tool_result = tool_result_map.get(tool_call_id)
                if tool_result:
                    result_content = tool_result.get("result", "")
                    tool_result_blocks.append({
                        "type": "tool_result",
                        "tool_use_id": tool_call_id,
                        "content": result_content
                    })
                    if DEBUG_LLM_RESPONSE:
                        logger.debug(f"[工具调用后再次调用LLM] 添加Claude工具结果块: {tool_call['function']['name']}, ID: {tool_call_id}, 结果长度: {len(result_content)}")
                else:
                    logger.warning(f"[工具调用后再次调用LLM] 未找到工具调用 {tool_call_id} 的结果")
            
            if tool_result_blocks:
                messages.append({
                    "role": "user",
                    "content": tool_result_blocks
                })
                if DEBUG_LLM_RESPONSE:
                    logger.debug(f"[工具调用后再次调用LLM] Claude格式: 合并 {len(tool_result_blocks)} 个工具结果到同一个user消息")
        else:
            # OpenAI 格式：每个工具结果作为单独的 tool 角色消息
            for tool_call in tool_calls:
                tool_call_id = tool_call.get("id")
                tool_result = tool_result_map.get(tool_call_id)
                if tool_result:
                    result_content = tool_result.get("result", "")
                    tool_result_message = {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": result_content
                    }
                    messages.append(tool_result_message)
                    if DEBUG_LLM_RESPONSE:
                        logger.debug(f"[工具调用后再次调用LLM] 添加OpenAI格式工具结果消息: {tool_call['function']['name']}, ID: {tool_call_id}, 结果长度: {len(result_content)}")
                else:
                    logger.warning(f"[工具调用后再次调用LLM] 未找到工具调用 {tool_call_id} 的结果")

        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[工具调用后再次调用LLM] 最终消息数量: {len(messages)}")
            logger.debug(f"[工具调用后再次调用LLM] 添加了 {len(tool_calls)} 个工具调用和 {len(tool_results)} 个工具结果")

            # 打印消息历史摘要
            logger.debug("[工具调用后再次调用LLM] 消息历史摘要:")
            for i, msg in enumerate(messages):
                role = msg.get("role")
                if role == "tool":
                    logger.debug(f"  [{i+1}] {role}: tool_call_id={msg.get('tool_call_id')}")
                elif role == "assistant" and msg.get("tool_calls"):
                    tool_calls_info = [f"{tc.get('function', {}).get('name')}({tc.get('id')})" for tc in msg.get("tool_calls", [])]
                    logger.debug(f"  [{i+1}] {role}: tool_calls={tool_calls_info}")
                elif role == "user":
                    content = msg.get("content", "")
                    if isinstance(content, list):
                        # Claude 格式的 tool_result
                        logger.debug(f"  [{i+1}] {role}: [tool_result x {len(content)}]")
                    else:
                        if content and len(content) > 50:
                            content = content[:50] + "..."
                        logger.debug(f"  [{i+1}] {role}: {content}")
                else:
                    content = msg.get("content", "")
                    if content and len(content) > 50:
                        content = content[:50] + "..."
                    logger.debug(f"  [{i+1}] {role}: {content}")

        # 6. 再次调用LLM
        model_client = ModelClient()

        # 准备API配置
        api_url = api_config.get("api_url")
        api_key = api_config.get("api_key")
        model = api_config.get("model")
        agent_info = api_config.get("agent_info")

        # 其他参数
        kwargs = {k: v for k, v in api_config.items()
                 if k not in ["api_url", "api_key", "model", "agent_info"]}

        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[工具调用后再次调用LLM] 使用模型: {model}")
            logger.debug(f"[工具调用后再次调用LLM] API URL: {api_url}")

            # 打印消息历史JSON，用于调试
            logger.debug("[工具调用后再次调用LLM] 消息历史JSON:")
            logger.debug(json.dumps(messages, ensure_ascii=False, indent=2))

        # 7. 发送请求并获取响应
        final_response = model_client.send_request(
            api_url=api_url,
            api_key=api_key,
            messages=messages,
            model=model,
            is_stream=True,  # 使用流式响应
            callback=callback,  # 使用相同的回调函数
            agent_info=agent_info,
            **kwargs  # 这里已经包含了task_id和conversation_id
        )

        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[工具调用后再次调用LLM] 完成处理，响应长度: {len(final_response) if final_response else 0}")
            logger.debug("="*40 + "\n")

        return final_response

    except Exception as e:
        error_msg = f"工具调用后再次调用LLM时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)

        # 发送错误消息给客户端
        if callback:
            callback(f"\n[错误] {error_msg}")

        return f"Error: {error_msg}"

def handle_streaming_response_with_adapter(adapter, response, callback, api_config=None):
    """使用适配器处理流式响应"""
    if DEBUG_LLM_RESPONSE:
        logger.debug(f"[适配器流式响应] 开始处理{adapter.platform_name}流式响应...")

    full_content = ""

    try:
        for line in response.iter_lines(decode_unicode=True):
            if line:
                # 使用适配器解析流式响应块
                content, meta = adapter.parse_streaming_chunk(line)

                if content:
                    full_content += content
                    if callback:
                        callback(content)

                if meta:
                    # 补充智能体信息到元数据
                    agent_info = api_config.get('agent_info', {}) if api_config else {}
                    if 'agentId' in meta and meta['agentId'] is None:
                        meta['agentId'] = str(agent_info.get('id', 'unknown'))
                        meta['agentName'] = agent_info.get('name', '外部智能体')
                        meta['roleName'] = agent_info.get('role_name', '外部角色')

                    if callback:
                        try:
                            callback(None, meta)
                        except TypeError:
                            # 如果回调函数只接受一个参数
                            pass

        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[适配器流式响应] {adapter.platform_name}流式响应处理完成，内容长度: {len(full_content)}")

        return full_content

    except Exception as e:
        error_msg = f"处理{adapter.platform_name}流式响应失败: {str(e)}"
        logger.error(f"[适配器流式响应] 错误: {error_msg}")

        if callback:
            try:
                from app.services.conversation.message_formater import format_agent_error_done

                agent_info = api_config.get('agent_info', {}) if api_config else {}
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
            except Exception as format_error:
                logger.error(f"发送错误回调失败: {format_error}")
                try:
                    callback(f"\n[错误] {error_msg}")
                except:
                    pass

        return f"Error: {error_msg}"

def _infer_tool_name_from_args(arguments_str: str, api_config: dict) -> str:
    """从工具参数推断工具名称

    通过匹配参数的key与已注册工具定义的参数schema来推断工具名称。
    当某些provider的流式响应中缺少tool name时使用。

    Args:
        arguments_str: JSON格式的工具参数字符串
        api_config: API配置，包含agent_info.tools

    Returns:
        str: 推断出的工具名称，如果无法推断则返回空字符串
    """
    if not api_config or not arguments_str:
        return ''

    try:
        args = json.loads(arguments_str)
        if not isinstance(args, dict):
            return ''
    except (json.JSONDecodeError, TypeError):
        return ''

    arg_keys = set(args.keys())
    if not arg_keys:
        return ''

    # 从api_config中获取工具定义
    agent_info = api_config.get('agent_info')
    if not agent_info or not isinstance(agent_info, dict):
        return ''

    tools = agent_info.get('tools', [])
    if not tools:
        return ''

    # 遍历工具定义，匹配参数key
    best_match = ''
    best_score = 0

    for tool_def in tools:
        if not isinstance(tool_def, dict):
            continue
        func = tool_def.get('function', {})
        tool_name = func.get('name', '')
        params = func.get('parameters', {})
        properties = params.get('properties', {})

        if not properties:
            continue

        tool_param_keys = set(properties.keys())

        # 计算参数key的匹配度
        if arg_keys.issubset(tool_param_keys):
            # 调用方的参数是工具定义参数的子集，可能匹配
            score = len(arg_keys & tool_param_keys)
            if score > best_score:
                best_score = score
                best_match = tool_name

    if best_match:
        logger.debug(f"[工具名推断] 从参数 {arg_keys} 推断工具名为: {best_match}")

    return best_match

def handle_streaming_response(response, callback, original_messages=None, api_config=None):
    """处理流式响应 - 支持 OpenAI 和 Claude/Anthropic 格式"""
    # 初始化状态变量
    full_content = ""
    buffer = ""
    has_reasoning = False  # 用于跟踪是否有未关闭的reasoning标签

    # 用于跟踪和累积OpenAI格式的工具调用
    openai_tool_calls = []
    current_tool_call = {}
    openai_tool_call_collecting = False

    # 用于跟踪和累积Claude/Anthropic格式的工具调用
    anthropic_tool_calls = []
    current_anthropic_tool = None  # 当前正在收集的Claude工具调用

    # 用于检测取消信号
    is_cancelled = False
    cancelled_agent_id = None
    
    # 用于诊断空响应问题
    http_status_code = None
    received_any_data = False
    last_error_info = None
    last_finish_reason = None
    total_chunks_received = 0
    chunks_with_content = 0

    if DEBUG_LLM_RESPONSE:
        logger.debug("\n" + "="*40)
        logger.debug("[LLM流式响应] 开始处理LLM流式响应")
        logger.debug("-"*40)

    # 预先构建 request_id，避免每次检查都重复计算
    _task_id = api_config.get('task_id') if api_config else None
    _conv_id = api_config.get('conversation_id') if api_config else None
    _agent_info = api_config.get('agent_info') if api_config else None
    _agent_id = _agent_info.get('id') if _agent_info else None
    _request_id = f"{_task_id}:{_conv_id}:{_agent_id}" if _task_id and _conv_id and _agent_id else \
                  f"{_task_id}:{_conv_id}" if _task_id and _conv_id else None

    def check_for_cancel_signal():
        """检查是否有取消信号，检测到则抛出 StreamCancelledException"""
        nonlocal is_cancelled, cancelled_agent_id

        if is_cancelled:
            return True

        # 检查连接管理器中的取消状态或中断标志
        if _request_id:
            if connection_manager.is_cancelled(_request_id) or connection_manager.should_interrupt(_request_id):
                is_cancelled = True
                cancelled_agent_id = _agent_id
                set_socket_timeout(0.1)
                logger.info(f"[LLM流式响应] 检测到取消信号: {_request_id}")
                raise StreamCancelledException(_request_id, _agent_id)

        # 检查队列中的取消信号
        if hasattr(callback, 'result_queue') and callback.result_queue:
            try:
                message = callback.result_queue.get_nowait()
                if isinstance(message, dict) and message.get('type') == 'cancel':
                    is_cancelled = True
                    cancelled_agent_id = message.get('agent_id')
                    logger.info(f"[LLM流式响应] 队列检测到取消信号: {message}")
                    raise StreamCancelledException(_request_id or "unknown", cancelled_agent_id)
                else:
                    callback.result_queue.put(message)
            except queue.Empty:
                pass
        return False

    # 处理流式响应 - 仅收集内容，不在流中执行工具调用
    try:
        # 使用带超时的迭代器来避免无限阻塞
        import socket

        # 动态设置socket超时 - 只在需要快速响应取消时设置短超时
        def set_socket_timeout(timeout_seconds):
            """动态设置socket超时"""
            if hasattr(response, 'raw') and hasattr(response.raw, '_connection') and hasattr(response.raw._connection, 'sock'):
                try:
                    response.raw._connection.sock.settimeout(timeout_seconds)
                    logger.debug(f"[LLM流式响应] 已设置socket超时为{timeout_seconds}秒")
                    return True
                except Exception as e:
                    logger.debug(f"[LLM流式响应] 设置socket超时失败: {str(e)}")
                    return False
            return False

        # 从api_config获取流式Socket超时配置，避免在无Flask上下文时读取数据库
        stream_socket_timeout = api_config.get('stream_socket_timeout', 60) if api_config else 60
        set_socket_timeout(float(stream_socket_timeout))

        # 尝试获取HTTP状态码用于诊断
        if hasattr(response, 'status_code'):
            http_status_code = response.status_code
            if DEBUG_LLM_RESPONSE:
                logger.debug(f"[LLM流式响应] HTTP状态码: {http_status_code}")

        # 添加一个计数器来定期检查取消状态
        line_count = 0

        for line in response.iter_lines():
            received_any_data = True
            # 增加行计数
            line_count += 1

            # 每处理一行数据，检查是否有取消信号
            if check_for_cancel_signal():
                logger.info("[LLM流式响应] 收到取消信号，中断流式处理")
                break

            if not line:
                # 优化：每个空行都检查取消状态，确保快速响应停止请求
                if check_for_cancel_signal():
                    logger.info("[LLM流式响应] 在空行处检测到取消信号")
                    break
                continue

            # 解析SSE格式（httpx iter_lines 返回的已经是 str）
            line_text = line if isinstance(line, str) else line.decode('utf-8')
            # 打印原始SSE行
            if DEBUG_LLM_RESPONSE:
                logger.debug(f"[LLM原始输出] {line_text}")

            # 检测Claude/Anthropic SSE事件类型 (event: xxx)
            if line_text.startswith('event:'):
                # Claude SSE事件行，跳过（实际事件类型从data JSON中的type字段获取）
                if DEBUG_LLM_RESPONSE:
                    logger.debug(f"[LLM流式响应] Claude事件类型: {line_text[6:].strip()}")
                continue

            if line_text.startswith('data: '):
                content = line_text[6:]  # 移除'data: '前缀

                # 处理[DONE]消息
                if content.strip() == '[DONE]':
                    if DEBUG_LLM_RESPONSE:
                        logger.debug("[LLM流式响应] 收到结束标志 [DONE]")

                    # 消息累计到buffer中，是之前的流式输出中检测工具调用的，现在已经改成输出完后再执行工具，所以这里不应发送
                    if buffer:
                        #callback(buffer)
                        logger.debug(f"[LLM流式响应] BUFFER中的最后一块内容（不发送）: {buffer}")
                    continue

                # 解析JSON
                try:
                    chunk = json.loads(content)
                    total_chunks_received += 1
                    # 打印解析后的JSON内容
                    if DEBUG_LLM_RESPONSE:
                        logger.debug(f"[LLM解析内容] {json.dumps(chunk, ensure_ascii=False)}")

                    # 记录 finish_reason（用于诊断空响应）
                    if chunk.get('choices') and chunk['choices'][0].get('finish_reason'):
                        last_finish_reason = chunk['choices'][0]['finish_reason']

                    # 检查是否是API错误响应
                    if chunk.get('error'):
                        error_obj = chunk['error']
                        error_message = error_obj.get('message', str(error_obj))
                        error_type = error_obj.get('type', 'unknown')
                        error_code = error_obj.get('code', '')
                        last_error_info = f"{error_type}: {error_message}" + (f" (code: {error_code})" if error_code else "")
                        logger.warning(f"[LLM流式响应] API返回错误: {last_error_info}")
                        # 将 API 错误信息通过 callback 发送给前端，确保用户能看到实际错误
                        if callback:
                            callback(f"\n[API错误] {last_error_info}")
                        continue

                    # 在处理每个chunk前检查取消状态
                    if check_for_cancel_signal():
                        logger.info("[LLM流式响应] 在处理chunk时检测到取消信号")
                        break

                    # ========== Claude/Anthropic 流式响应处理 ==========
                    # 检测 Claude 格式: 有 type 字段且不是 OpenAI 格式
                    chunk_type = chunk.get('type')
                    if chunk_type and not chunk.get('choices'):
                        # content_block_start: 开始一个新的内容块
                        if chunk_type == 'content_block_start':
                            content_block = chunk.get('content_block', {})
                            block_type = content_block.get('type')
                            
                            if block_type == 'tool_use':
                                # 开始收集工具调用
                                current_anthropic_tool = {
                                    'id': content_block.get('id', str(uuid.uuid4())),
                                    'name': content_block.get('name', ''),
                                    'input_json': ''
                                }
                                if DEBUG_LLM_RESPONSE:
                                    logger.debug(f"[LLM流式响应] Claude工具调用开始: {current_anthropic_tool['name']}")
                            elif block_type == 'text':
                                # 文本块开始，可能包含初始文本
                                initial_text = content_block.get('text', '')
                                if initial_text:
                                    buffer += initial_text
                                    full_content += initial_text
                                    callback(initial_text)
                        
                        # content_block_delta: 内容块增量更新
                        elif chunk_type == 'content_block_delta':
                            delta = chunk.get('delta', {})
                            delta_type = delta.get('type')
                            
                            if delta_type == 'input_json_delta':
                                # 累积工具调用的JSON参数
                                if current_anthropic_tool:
                                    partial_json = delta.get('partial_json', '')
                                    current_anthropic_tool['input_json'] += partial_json
                                    if DEBUG_LLM_RESPONSE:
                                        logger.debug(f"[LLM流式响应] Claude工具参数增量: {partial_json}")
                            elif delta_type == 'text_delta':
                                # 文本内容增量
                                text_piece = delta.get('text', '')
                                if text_piece:
                                    buffer += text_piece
                                    full_content += text_piece
                                    callback(text_piece)
                        
                        # content_block_stop: 内容块结束
                        elif chunk_type == 'content_block_stop':
                            if current_anthropic_tool:
                                # 工具调用完成，解析JSON并转换为OpenAI格式
                                try:
                                    input_args = json.loads(current_anthropic_tool['input_json']) if current_anthropic_tool['input_json'] else {}
                                except json.JSONDecodeError:
                                    input_args = {}
                                    logger.warning(f"[LLM流式响应] Claude工具参数JSON解析失败: {current_anthropic_tool['input_json']}")
                                
                                # 转换为OpenAI格式的工具调用（统一后续处理）
                                openai_format_tool = {
                                    'id': current_anthropic_tool['id'],
                                    'type': 'function',
                                    'function': {
                                        'name': current_anthropic_tool['name'],
                                        'arguments': json.dumps(input_args, ensure_ascii=False)
                                    }
                                }
                                anthropic_tool_calls.append(openai_format_tool)
                                
                                if DEBUG_LLM_RESPONSE:
                                    logger.debug(f"[LLM流式响应] Claude工具调用完成: {current_anthropic_tool['name']}, 参数: {input_args}")
                                
                                current_anthropic_tool = None
                        
                        # message_delta: 消息级别的增量（包含stop_reason）
                        elif chunk_type == 'message_delta':
                            delta = chunk.get('delta', {})
                            stop_reason = delta.get('stop_reason')
                            if stop_reason == 'tool_use':
                                if DEBUG_LLM_RESPONSE:
                                    logger.debug(f"[LLM流式响应] Claude消息结束，原因: tool_use, 共 {len(anthropic_tool_calls)} 个工具调用")
                        
                        # message_stop: 消息完全结束
                        elif chunk_type == 'message_stop':
                            if DEBUG_LLM_RESPONSE:
                                logger.debug("[LLM流式响应] Claude消息流结束")
                        
                        # 跳过其他Claude事件类型的进一步处理
                        continue

                    # ========== OpenAI 格式流式响应处理 ==========
                    # 先检查完整消息格式（某些provider在流式模式下也会发完整tool call在message中）
                    if chunk.get('choices') and chunk['choices'][0].get('message') \
                           and chunk['choices'][0]['message'].get('tool_calls'):
                        for tc in chunk['choices'][0]['message']['tool_calls']:
                            openai_tool_calls.append({
                                'id': tc.get('id') or f"call_{uuid.uuid4().hex[:24]}",
                                'type': 'function',
                                'function': {
                                    'name': tc.get('function', {}).get('name', ''),
                                    'arguments': tc.get('function', {}).get('arguments', '')
                                }
                            })
                        openai_tool_call_collecting = False
                        if DEBUG_LLM_RESPONSE:
                            logger.debug(f"[LLM流式响应] 从message中检测到 {len(chunk['choices'][0]['message']['tool_calls'])} 个完整工具调用")

                    # 检测OpenAI格式的工具调用开始或继续（流式delta格式）
                    elif chunk.get('choices') and chunk['choices'][0].get('delta') and chunk['choices'][0]['delta'].get('tool_calls') is not None:
                        delta_tool_calls = chunk['choices'][0]['delta']['tool_calls']

                        if DEBUG_LLM_RESPONSE:
                            logger.debug(f"[LLM流式响应] 检测到有效的tool_calls: {len(delta_tool_calls)}个")

                        for delta_tool_call in delta_tool_calls:
                            tool_call_index = delta_tool_call.get('index', 0)

                            # 确保有足够的工具调用槽位
                            while len(openai_tool_calls) <= tool_call_index:
                                openai_tool_calls.append({
                                    'id': '',
                                    'type': 'function',
                                    'function': {'name': '', 'arguments': ''}
                                })

                            # 更新id和type
                            if 'id' in delta_tool_call:
                                openai_tool_calls[tool_call_index]['id'] = delta_tool_call['id']
                            if 'type' in delta_tool_call:
                                openai_tool_calls[tool_call_index]['type'] = delta_tool_call['type']

                            # 更新函数信息
                            if 'function' in delta_tool_call:
                                if 'name' in delta_tool_call['function']:
                                    openai_tool_calls[tool_call_index]['function']['name'] = delta_tool_call['function']['name']
                                if 'arguments' in delta_tool_call['function']:
                                    if delta_tool_call['function']['arguments'] is not None:
                                        openai_tool_calls[tool_call_index]['function']['arguments'] += delta_tool_call['function']['arguments']

                        openai_tool_call_collecting = True

                    # 检查是否收到工具调用完成的信号（兼容 finish_reason 值 'tool_calls' 和 'stop'）
                    elif chunk.get('choices') and chunk['choices'][0].get('finish_reason') in ('tool_calls', 'stop') and openai_tool_call_collecting:
                        if DEBUG_LLM_RESPONSE:
                            logger.debug(f"[LLM流式响应] 工具调用完成信号 (finish_reason={chunk['choices'][0]['finish_reason']}): {len(openai_tool_calls)} 个工具调用")

                        openai_tool_call_collecting = False

                    # 检查delta的内容，收集文本内容
                    elif chunk.get('choices') and chunk['choices'][0].get('delta', {}).get('content'):
                        content_piece = chunk['choices'][0]['delta']['content']
                        # 检查是否是reasoning的结束（content有内容，但没有reasoning_content）
                        if has_reasoning and not chunk['choices'][0].get('delta', {}).get('reasoning_content'):
                            if DEBUG_LLM_RESPONSE:
                                logger.debug("[LLM流式响应] 检测到reasoning可能结束，添加</thinking>标签")

                            # 添加结束标签
                            thinking_end_tag = "\n</thinking>\n"
                            # 更新buffer和full_content
                            buffer += thinking_end_tag
                            full_content += thinking_end_tag
                            # 发送结束标签
                            callback(thinking_end_tag)
                            has_reasoning = False

                            # 将content_piece添加到buffer和full_content
                            buffer += content_piece
                            full_content += content_piece
                            # 使用回调发送内容块
                            callback(content_piece)
                        else:
                            # 将content_piece添加到buffer和full_content
                            buffer += content_piece
                            full_content += content_piece
                            # 使用回调发送内容块
                            callback(content_piece)
                    # 检查是否有reasoning_content字段（Qwen3模型特有）
                    elif chunk.get('choices') and chunk['choices'][0].get('delta', {}).get('reasoning_content'):
                        # 从Aliyun Qwen3模型响应中提取reasoning_content
                        reasoning_content = chunk['choices'][0]['delta']['reasoning_content']
                        content_value = chunk['choices'][0].get('delta', {}).get('content')

                        if DEBUG_LLM_RESPONSE:
                            logger.debug(f"[LLM流式响应] 检测到Qwen3 reasoning_content: '{reasoning_content}' (长度: {len(reasoning_content)})")
                            logger.debug(f"[LLM流式响应] content值: {content_value}")
                            logger.debug(f"[LLM流式响应] has_reasoning状态: {has_reasoning}")

                        # 检查是否是reasoning的开始（content为null，reasoning_content不为null）
                        if not has_reasoning and content_value is None and reasoning_content:
                            # 添加<thinking>标签
                            thinking_tag = "<thinking>\n"
                            # 更新buffer和full_content
                            buffer += thinking_tag
                            full_content += thinking_tag
                            # 发送标签和reasoning_content
                            combined_content = thinking_tag + reasoning_content
                            if DEBUG_LLM_RESPONSE:
                                logger.debug(f"[LLM流式响应] 发送thinking开始标签和内容: '{combined_content}'")
                            callback(combined_content)
                            has_reasoning = True
                        else:
                            # 直接发送reasoning_content，但只有当内容不是纯空白字符时才发送
                            if reasoning_content and reasoning_content.strip():
                                if DEBUG_LLM_RESPONSE:
                                    logger.debug(f"[LLM流式响应] 直接发送reasoning_content: '{reasoning_content}'")
                                callback(reasoning_content)
                            else:
                                if DEBUG_LLM_RESPONSE:
                                    logger.debug(f"[LLM流式响应] 跳过空白reasoning_content: '{reasoning_content}'")
                                # 仍然需要将内容添加到buffer和full_content中，即使不发送给前端

                        # 无论是否是开始，都将reasoning_content添加到buffer和full_content
                        buffer += reasoning_content
                        full_content += reasoning_content

                except json.JSONDecodeError as e:
                    if DEBUG_LLM_RESPONSE:
                        logger.debug(f"[LLM流式响应] JSON解析错误: {e}, 原始内容: {content}")
                    continue
    except StreamCancelledException as e:
        # 流式处理被主动取消异常
        logger.info(f"[LLM流式响应] 流式处理被主动取消: {e.request_id}")
        is_cancelled = True
        cancelled_agent_id = e.agent_id
        # 直接返回，不需要进一步处理
        return ""
    except socket.timeout:
        # Socket超时异常，区分取消操作和真正的网络超时
        logger.info("[LLM流式响应] Socket超时，检查是否为取消操作")
        # 检查是否确实被取消
        try:
            if check_for_cancel_signal():
                logger.info("[LLM流式响应] 确认是取消操作导致的超时")
                is_cancelled = True
            else:
                # 如果不是取消操作，这可能是真正的网络超时
                if is_cancelled:
                    logger.info("[LLM流式响应] 已标记为取消状态，超时是预期的")
                else:
                    logger.warning("[LLM流式响应] Socket超时但未检测到取消信号，可能是网络问题或模型响应过慢")
                    # 对于真正的网络超时，通知用户
                    if callback and not is_cancelled:
                        callback(f"\n[警告] 模型响应超时，可能是网络问题或模型处理时间过长")
        except StreamCancelledException as e:
            logger.info(f"[LLM流式响应] 在超时检查中检测到取消: {e.request_id}")
            is_cancelled = True
            cancelled_agent_id = e.agent_id
            return ""
    except asyncio.CancelledError:
        # 异步任务被取消（硬取消）- 这是正常的取消流程
        logger.info("[LLM流式响应] 检测到 asyncio.CancelledError（硬取消成功）")
        is_cancelled = True
    except (httpx.RequestError, httpx.HTTPStatusError, AttributeError) as e:
        # 捕获请求异常和属性错误（可能是由于连接被关闭）
        error_str = str(e)

        # 检查是否是由于取消导致的特定错误
        if is_cancelled or "'NoneType' object has no attribute 'read'" in error_str or "Connection aborted" in error_str or "Connection reset" in error_str or "timeout" in error_str.lower():
            # 这是一个预期的错误，发生在我们成功关闭HTTP连接后
            logger.info(f"[LLM流式响应] 流式处理被取消，异常信息: {error_str}")

            # 如果是由于取消导致的错误，但尚未标记为已取消，则标记为已取消
            if not is_cancelled:
                is_cancelled = True
                logger.info("[LLM流式响应] 根据异常信息判断流式处理已被取消")
        else:
            logger.error(f"[LLM流式响应] 流式处理出错: {error_str}\n{traceback.format_exc()}")
            # 如果不是由于取消导致的错误，通知用户
            if callback and not is_cancelled:
                callback(f"\n[错误] 流式处理出错: {error_str}")
    except Exception as e:
        # 捕获其他所有异常
        error_str = str(e)

        # 检查是否是由于取消导致的特定错误
        if is_cancelled or "'NoneType' object has no attribute 'read'" in error_str or "Connection aborted" in error_str or "Connection reset" in error_str:
            # 这是一个预期的错误，发生在我们成功关闭HTTP连接后
            logger.info(f"[LLM流式响应] 流式处理被取消，异常信息: {error_str}")

            # 如果是由于取消导致的错误，但尚未标记为已取消，则标记为已取消
            if not is_cancelled:
                is_cancelled = True
                logger.info("[LLM流式响应] 根据异常信息判断流式处理已被取消")
        else:
            logger.error(f"[LLM流式响应] 未预期的错误: {error_str}\n{traceback.format_exc()}")
            # 通知用户
            if callback and not is_cancelled:
                callback(f"\n[错误] 未预期的错误: {error_str}")
    # 如果有未关闭的reasoning标签，添加结束标签
    if has_reasoning:
        if DEBUG_LLM_RESPONSE:
            logger.debug("[LLM流式响应] 流式响应结束时添加reasoning结束标签</thinking>")

        # 添加结束标签
        thinking_end_tag = "\n</thinking>"
        # 更新full_content
        full_content += thinking_end_tag
        # 发送结束标签
        callback(thinking_end_tag)
    # 在进入工具调用处理前，再次检查取消状态（处理异步迭代器退出但 is_cancelled 未设置的情况）
    if not is_cancelled and _request_id:
        if connection_manager.is_cancelled(_request_id) or connection_manager.should_interrupt(_request_id):
            is_cancelled = True
            logger.info(f"[LLM流式响应] 循环结束后检测到取消状态: {_request_id}")
    
    # 如果流式处理被取消，返回已处理的内容
    if is_cancelled:
        logger.info(f"[LLM流式响应] 流式处理被取消，已处理内容长度: {len(full_content)}")
        return full_content

    # 流式响应完成后，处理工具调用
    if DEBUG_LLM_RESPONSE:
        logger.debug("[LLM流式响应] 流式输出完成，开始处理工具调用")

    # 提取工具调用
    tool_call_content = []
    tool_result_content = []

    # 处理XML格式的工具调用
    xml_tool_calls = parse_tool_calls(full_content)
    if xml_tool_calls:
        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[LLM流式响应] 解析出 {len(xml_tool_calls)} 个XML格式工具调用")

        for tool_call in xml_tool_calls:
            # 检查是否有取消信号
            if check_for_cancel_signal():
                logger.info("[LLM流式响应] 收到取消信号，中断工具调用处理")
                return full_content

            # 执行工具调用并格式化结果
            tool_result_info = execute_and_format_tool_call(tool_call, callback)
            full_content += serialize_message(format_tool_result_as_role(
                result=tool_result_info['result'],
                tool_name=tool_result_info['tool_name'],
                tool_call_id=tool_result_info['tool_call_id'],
                tool_parameter=tool_call['function']['arguments'],
                status=detect_tool_status(tool_result_info['result'])
            ))

            # 收集工具调用和结果
            tool_call_content.append(tool_call)
            tool_result_content.append(tool_result_info)

    # 合并OpenAI格式和Claude格式的工具调用（Claude已转换为OpenAI格式）
    all_openai_format_tool_calls = openai_tool_calls + anthropic_tool_calls
    
    # 处理OpenAI格式的工具调用（包括从Claude转换的）
    if all_openai_format_tool_calls:
        if DEBUG_LLM_RESPONSE:
            logger.debug(f"[LLM流式响应] 处理 {len(all_openai_format_tool_calls)} 个工具调用 (OpenAI: {len(openai_tool_calls)}, Claude: {len(anthropic_tool_calls)})")

        for openai_tool_call in all_openai_format_tool_calls:
            # 检查是否有取消信号
            if check_for_cancel_signal():
                logger.info("[LLM流式响应] 收到取消信号，中断OpenAI工具调用处理")
                return full_content

            # 检查工具调用是否完整 - arguments为空才是真正不完整
            if not openai_tool_call['function']['arguments']:
                if DEBUG_LLM_RESPONSE:
                    logger.debug(f"[LLM流式响应] 跳过不完整的OpenAI工具调用（无arguments）: {openai_tool_call}")
                continue

            # 补全缺失的id
            if not openai_tool_call['id']:
                openai_tool_call['id'] = f"call_{uuid.uuid4().hex[:24]}"
                logger.warning(f"[LLM流式响应] 工具调用缺少id，自动生成: {openai_tool_call['id']}")

            # 补全缺失的name - 从已注册工具定义中推断
            if not openai_tool_call['function']['name']:
                inferred_name = _infer_tool_name_from_args(
                    openai_tool_call['function']['arguments'], api_config
                )
                if inferred_name:
                    openai_tool_call['function']['name'] = inferred_name
                    logger.warning(f"[LLM流式响应] 工具调用缺少name，从参数推断为: {inferred_name}")
                else:
                    logger.warning(f"[LLM流式响应] 工具调用缺少name且无法推断，跳过: {openai_tool_call}")
                    continue

            # 修正参数格式 (确保是有效的JSON字符串)
            try:
                json.loads(openai_tool_call['function']['arguments'])
            except json.JSONDecodeError:
                try:
                    fixed_args = openai_tool_call['function']['arguments']
                    if not fixed_args.startswith('{'):
                        fixed_args = '{' + fixed_args
                    if not fixed_args.endswith('}'):
                        fixed_args = fixed_args + '}'
                    json.loads(fixed_args)
                    openai_tool_call['function']['arguments'] = fixed_args
                except:
                    openai_tool_call['function']['arguments'] = f'{{"value": "{openai_tool_call["function"]["arguments"]}"}}'

            # 执行工具调用并格式化结果
            tool_result_info = execute_and_format_tool_call(openai_tool_call, callback)
            full_content += serialize_message(format_tool_result_as_role(
                result=tool_result_info['result'],
                tool_name=tool_result_info['tool_name'],
                tool_call_id=tool_result_info['tool_call_id'],
                tool_parameter=openai_tool_call['function']['arguments'],
                status=detect_tool_status(tool_result_info['result'])
            ))

            # 收集工具调用和结果
            tool_call_content.append(openai_tool_call)
            tool_result_content.append(tool_result_info)

    # 解析JSON格式的工具调用
    json_tool_pattern = r'(\{[\s\S]*?"function"\s*:\s*\{[\s\S]*?"name"\s*:\s*"[^"]+?"[\s\S]*?\}[\s\S]*?\})'
    json_tool_matches = re.findall(json_tool_pattern, full_content)

    for json_tool_str in json_tool_matches:
        # 检查是否有取消信号
        if check_for_cancel_signal():
            logger.info("[LLM流式响应] 收到取消信号，中断JSON工具调用处理")
            return full_content

        try:
            tool_call = json.loads(json_tool_str)
            if 'function' in tool_call and 'name' in tool_call['function'] and 'arguments' in tool_call['function']:
                # 跳过重复工具调用
                tool_name = tool_call['function']['name']
                tool_id = tool_call.get('id', '')
                if any(tc.get('id', '') == tool_id for tc in tool_call_content) or \
                   any(tc['function']['name'] == tool_name and
                       tc['function']['arguments'] == tool_call['function']['arguments'] for tc in tool_call_content):
                    continue

                # 执行工具调用并格式化结果
                tool_result_info = execute_and_format_tool_call(tool_call, callback)
                full_content += serialize_message(format_tool_result_as_role(
                    result=tool_result_info['result'],
                    tool_name=tool_result_info['tool_name'],
                    tool_call_id=tool_result_info['tool_call_id'],
                    tool_parameter=tool_call['function']['arguments'],
                    status=detect_tool_status(tool_result_info['result'])
                ))

                # 收集工具调用和结果
                tool_call_content.append(tool_call)
                tool_result_content.append(tool_result_info)
        except json.JSONDecodeError:
            if DEBUG_LLM_RESPONSE:
                logger.debug(f"[LLM流式响应] JSON格式工具调用解析失败: {json_tool_str}")

    # 再次检查是否有取消信号，如果有则跳过二次LLM调用
    if check_for_cancel_signal():
        logger.info("[LLM流式响应] 收到取消信号，跳过二次LLM调用")
        return full_content

    # 检查是否需要再次调用LLM
    if tool_call_content and tool_result_content and original_messages and api_config:
        if DEBUG_LLM_RESPONSE:
            logger.debug("\n[LLM流式响应] 检测到工具调用和结果，将再次调用LLM")
            logger.debug(f"[LLM流式响应] 工具调用数量: {len(tool_call_content)}")
            logger.debug(f"[LLM流式响应] 工具结果数量: {len(tool_result_content)}")

        # 工具调用纠正：统计尾部连续失败数，达到阈值时注入提示
        tool_call_correction_enabled = api_config.get("tool_call_correction", False)
        if tool_call_correction_enabled:
            threshold = api_config.get("tool_call_correction_threshold", 5)
            consecutive_failures = 0
            for tr in reversed(tool_result_content):
                if detect_tool_status(tr.get('result', '')) == "error":
                    consecutive_failures += 1
                else:
                    break
            if consecutive_failures >= threshold:
                correction_hint = (
                    f"[SYSTEM NOTICE] The last {consecutive_failures} consecutive tool calls have failed. "
                    "Please carefully analyze the error messages above, adjust your approach, "
                    "and try a different strategy instead of repeating the same failing calls."
                )
                logger.warning(f"[工具调用纠正] 连续失败 {consecutive_failures} 次，已达到阈值 {threshold}，注入纠正提示")
                last_result = tool_result_content[-1]
                last_result['result'] = last_result.get('result', '') + f"\n\n{correction_hint}"

        # 将当前streaming输出的文本内容添加到消息历史中
        # 这样工具调用时LLM能看到自己之前输出的上下文（思考过程等）
        # 注意：只添加文本内容，工具调用由call_llm_with_tool_results内部处理
        messages_with_current_output = list(original_messages)
        if full_content.strip():
            # 重要：清理full_content中的工具调用JSON，只保留纯文本
            cleaned_content = remove_tool_result_jsons(full_content)
            if cleaned_content.strip():
                messages_with_current_output.append({
                    "role": "assistant",
                    "content": cleaned_content
                })
                if DEBUG_LLM_RESPONSE:
                    logger.debug(f"[LLM流式响应] 已将当前streaming文本内容({len(cleaned_content)}字符)添加到消息历史（已清理JSON）")
            else:
                if DEBUG_LLM_RESPONSE:
                    logger.debug(f"[LLM流式响应] 清理JSON后内容为空，不添加到消息历史")

        # 调用二次LLM处理
        second_response = call_llm_with_tool_results(
            original_messages=messages_with_current_output,
            tool_calls=tool_call_content,
            tool_results=tool_result_content,
            api_config=api_config,
            callback=callback
        )

        # 不再需要添加HTML注释完成标记
        # 前端可以通过消息类型识别工具调用和结果处理的完成

        if DEBUG_LLM_RESPONSE:
            logger.debug("\n[LLM流式响应] 二次调用LLM完成")

        # 将二次调用的结果添加到完整的响应中
        if second_response:
            if second_response.startswith("Error:"):
                # 二次调用失败，将错误信息通过 callback 发送给前端
                logger.warning(f"[LLM流式响应] 工具调用后二次LLM调用失败: {second_response}")
                if callback:
                    callback(f"\n{second_response}")
                full_content += f"\n{second_response}"
            else:
                full_content += f"\n{second_response}"

    if DEBUG_LLM_RESPONSE:
        logger.debug("-"*40)
        logger.debug(f"[LLM流式响应] 完成处理，总内容长度: {len(full_content)}")
        logger.debug(f"[LLM流式响应] 工具调用数量: {len(tool_call_content)}")
        logger.debug(f"[LLM流式响应] 工具结果数量: {len(tool_result_content)}")
        logger.debug("="*40 + "\n")

    # 如果流式响应完成但内容为空（非取消情况），返回更详细的错误信息
    # 注意：工具调用场景下 full_content 可能为空（模型只返回了工具调用，没有文本），这不是错误
    has_tool_calls = bool(tool_call_content) or bool(openai_tool_calls) or bool(anthropic_tool_calls)
    if not full_content.strip() and not is_cancelled and not has_tool_calls:
        # 构建诊断信息
        diag_parts = []
        if http_status_code is not None:
            diag_parts.append(f"HTTP {http_status_code}")
        if last_finish_reason:
            diag_parts.append(f"finish_reason={last_finish_reason}")
        diag_parts.append(f"收到{total_chunks_received}个chunk")
        if received_any_data:
            diag_parts.append("有SSE数据")
        else:
            diag_parts.append("未收到任何SSE数据")
        diag_info = ", ".join(diag_parts)

        # 优先使用API返回的实际错误信息
        if last_error_info:
            error_msg = f"模型返回空响应: {last_error_info} ({diag_info})"
        elif http_status_code is not None and http_status_code != 200:
            error_msg = f"模型返回空响应 (HTTP {http_status_code}, {diag_info})"
        elif not received_any_data:
            error_msg = f"模型返回空响应 (未收到任何流式数据, {diag_info})"
        elif last_finish_reason == 'content_filter':
            error_msg = f"模型返回空响应: 内容被安全过滤器拦截 ({diag_info})"
        elif last_finish_reason == 'length':
            error_msg = f"模型返回空响应: max_tokens设置过小或token用尽 ({diag_info})"
        else:
            error_msg = f"模型返回空响应 ({diag_info})"
        
        logger.warning(f"[LLM流式响应] {error_msg}")
        return f"Error: {error_msg}"

    return full_content

