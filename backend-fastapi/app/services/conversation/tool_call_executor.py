"""
工具调用执行模块

从 stream_handler.py 抽离，负责工具调用的执行和格式化
"""
import json
import uuid
import logging
from typing import Dict, Any, Callable, List

from app.services.conversation.tool_handler import execute_tool_call
from app.services.conversation.message_formater import format_tool_call, format_tool_result_as_role, serialize_message

logger = logging.getLogger(__name__)


def detect_tool_status(tool_result: str) -> str:
    """
    检测工具调用结果的状态
    
    Args:
        tool_result: 工具调用结果字符串
        
    Returns:
        str: "success" 或 "error"
    """
    try:
        result_obj = json.loads(tool_result) if isinstance(tool_result, str) else tool_result
        if isinstance(result_obj, dict):
            # HTTP响应特殊处理：error_type=HTTPError 且 is_error=True 表示错误
            if result_obj.get('error_type') == 'HTTPError':
                if result_obj.get('is_error') == True:
                    return "error"
                return "success"
            # isError=True 或 is_error=True（除非error=False）
            if result_obj.get('isError') == True or result_obj.get('is_error') == True:
                if result_obj.get('error') is not False:
                    return "error"
            # error字段存在且不是False且不是空字符串
            if 'error' in result_obj and result_obj['error'] is not False and result_obj['error'] != '':
                return "error"
    except:
        # 解析失败时，检查字符串中的错误关键词
        if isinstance(tool_result, str):
            if any(kw in tool_result for kw in ['错误', 'Error', 'error', '失败']):
                if 'error=False' not in tool_result and '"error":false' not in tool_result.lower():
                    return "error"
    return "success"


def execute_and_format_tool_call(tool_call: Dict[str, Any], callback: Callable) -> Dict[str, Any]:
    """
    执行工具调用并格式化结果
    
    Args:
        tool_call: 工具调用对象，包含id, function.name, function.arguments
        callback: 回调函数，用于发送结果
        
    Returns:
        Dict: 包含tool_call_id, tool_name, result的字典
    """
    # 确保有ID
    if not tool_call.get('id'):
        tool_call['id'] = str(uuid.uuid4())
    
    # 先发送 ToolCallAction 事件，让前端立即显示工具名称（而非等执行完才显示）
    tool_call_action = format_tool_call(
        function_name=tool_call['function']['name'],
        arguments=tool_call['function'].get('arguments', '{}'),
        tool_call_id=tool_call['id']
    )
    callback(serialize_message(tool_call_action))
    
    # 执行工具调用
    tool_result = execute_tool_call(tool_call)
    
    # 检测状态
    status = detect_tool_status(tool_result)
    
    # 格式化并发送结果
    tool_result_message = format_tool_result_as_role(
        result=tool_result,
        tool_name=tool_call['function']['name'],
        tool_call_id=tool_call['id'],
        tool_parameter=tool_call['function']['arguments'],
        status=status
    )
    tool_result_str = serialize_message(tool_result_message)
    callback(tool_result_str)
    
    return {
        "tool_call_id": tool_call['id'],
        "tool_name": tool_call['function']['name'],
        "result": tool_result
    }


def execute_tool_calls_batch(tool_calls: List[Dict[str, Any]], callback: Callable) -> List[Dict[str, Any]]:
    """
    批量执行工具调用
    
    Args:
        tool_calls: 工具调用列表
        callback: 回调函数
        
    Returns:
        List[Dict]: 工具调用结果列表
    """
    results = []
    for tool_call in tool_calls:
        result = execute_and_format_tool_call(tool_call, callback)
        results.append(result)
    return results


def normalize_tool_call(tool_call: Dict[str, Any]) -> Dict[str, Any]:
    """
    规范化工具调用格式为OpenAI标准格式
    
    Args:
        tool_call: 可能是各种格式的工具调用
        
    Returns:
        Dict: OpenAI标准格式的工具调用
    """
    # 如果已经是标准格式
    if 'function' in tool_call and 'name' in tool_call.get('function', {}):
        normalized = {
            'id': tool_call.get('id', str(uuid.uuid4())),
            'type': 'function',
            'function': {
                'name': tool_call['function']['name'],
                'arguments': tool_call['function'].get('arguments', '{}')
            }
        }
        # 确保arguments是字符串
        if isinstance(normalized['function']['arguments'], dict):
            normalized['function']['arguments'] = json.dumps(normalized['function']['arguments'], ensure_ascii=False)
        return normalized
    
    # 如果是简化格式 {name, arguments}
    if 'name' in tool_call and 'arguments' in tool_call:
        arguments = tool_call['arguments']
        if isinstance(arguments, dict):
            arguments = json.dumps(arguments, ensure_ascii=False)
        return {
            'id': tool_call.get('id', str(uuid.uuid4())),
            'type': 'function',
            'function': {
                'name': tool_call['name'],
                'arguments': arguments
            }
        }
    
    # 无法识别的格式，返回原样
    logger.warning(f"无法规范化工具调用格式: {tool_call}")
    return tool_call
