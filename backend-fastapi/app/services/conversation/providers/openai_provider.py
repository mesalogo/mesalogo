"""
OpenAI工具调用提供商

处理OpenAI及兼容格式的工具调用
"""
import json
import uuid
import logging
from typing import Dict, List, Any, Optional

from .base_provider import BaseToolProvider

logger = logging.getLogger(__name__)


class OpenAIToolProvider(BaseToolProvider):
    """OpenAI工具调用提供商"""
    
    @property
    def provider_name(self) -> str:
        return "openai"
    
    def format_tools_for_request(self, tools: List[Dict]) -> List[Dict]:
        """
        OpenAI格式是内部标准格式，直接返回
        
        格式:
        {
            "type": "function",
            "function": {
                "name": "tool_name",
                "description": "tool description",
                "parameters": { JSON Schema }
            }
        }
        """
        return tools
    
    def format_tool_choice(self, tool_choice: str = "auto") -> Any:
        """
        格式化工具选择参数
        
        OpenAI支持: "auto", "none", "required", 或 {"type": "function", "function": {"name": "xxx"}}
        """
        if tool_choice in ["auto", "none", "required"]:
            return tool_choice
        else:
            return {
                "type": "function",
                "function": {"name": tool_choice}
            }
    
    def parse_tool_calls_from_response(self, response: Dict) -> List[Dict]:
        """
        从OpenAI响应中解析工具调用
        
        OpenAI响应格式:
        {
            "choices": [{
                "message": {
                    "tool_calls": [{
                        "id": "call_xxx",
                        "type": "function",
                        "function": {
                            "name": "tool_name",
                            "arguments": "{\"arg\": \"value\"}"
                        }
                    }]
                }
            }]
        }
        """
        result = []
        
        try:
            choices = response.get('choices', [])
            if not choices:
                return result
            
            message = choices[0].get('message', {})
            tool_calls = message.get('tool_calls', [])
            
            for tc in tool_calls:
                if tc.get('type') != 'function':
                    continue
                    
                function = tc.get('function', {})
                arguments_str = function.get('arguments', '{}')
                
                try:
                    arguments = json.loads(arguments_str)
                except json.JSONDecodeError:
                    logger.warning(f"无法解析工具参数: {arguments_str}")
                    arguments = {}
                
                result.append({
                    "id": tc.get('id', str(uuid.uuid4())),
                    "name": function.get('name', ''),
                    "arguments": arguments
                })
                
        except Exception as e:
            logger.error(f"解析OpenAI工具调用响应失败: {e}")
        
        return result
    
    def parse_streaming_tool_call(self, chunk: Dict, state: Dict) -> Optional[Dict]:
        """
        解析OpenAI流式响应中的工具调用
        
        流式格式:
        {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_xxx","function":{"name":"tool_name"}}]}}]}
        {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"arg\":"}}]}}]}
        {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"value\"}"}}]}}]}
        {"choices":[{"finish_reason":"tool_calls"}]}
        """
        try:
            choices = chunk.get('choices', [])
            if not choices:
                return None
            
            choice = choices[0]
            delta = choice.get('delta', {})
            finish_reason = choice.get('finish_reason')
            
            # 检查是否完成
            if finish_reason == 'tool_calls':
                state['tool_call_complete'] = True
                # 返回累积的工具调用
                return self._finalize_streaming_tool_calls(state)
            
            # 处理工具调用增量
            delta_tool_calls = delta.get('tool_calls', [])
            if not delta_tool_calls:
                return None
            
            # 初始化状态
            if 'tool_calls' not in state:
                state['tool_calls'] = []
            
            for delta_tc in delta_tool_calls:
                index = delta_tc.get('index', 0)
                
                # 确保有足够的槽位
                while len(state['tool_calls']) <= index:
                    state['tool_calls'].append({
                        'id': '',
                        'name': '',
                        'arguments': ''
                    })
                
                tc = state['tool_calls'][index]
                
                # 更新ID
                if 'id' in delta_tc:
                    tc['id'] = delta_tc['id']
                
                # 更新函数信息
                if 'function' in delta_tc:
                    func = delta_tc['function']
                    if 'name' in func:
                        tc['name'] = func['name']
                    if 'arguments' in func and func['arguments'] is not None:
                        tc['arguments'] += func['arguments']
            
            return None
            
        except Exception as e:
            logger.error(f"解析OpenAI流式工具调用失败: {e}")
            return None
    
    def _finalize_streaming_tool_calls(self, state: Dict) -> List[Dict]:
        """完成流式工具调用的解析"""
        result = []
        
        for tc in state.get('tool_calls', []):
            if not tc.get('name'):
                continue
                
            try:
                arguments = json.loads(tc.get('arguments', '{}'))
            except json.JSONDecodeError:
                logger.warning(f"无法解析流式工具参数: {tc.get('arguments')}")
                arguments = {}
            
            result.append({
                "id": tc.get('id') or str(uuid.uuid4()),
                "name": tc['name'],
                "arguments": arguments
            })
        
        return result
    
    def format_tool_result_message(self, tool_call_id: str, tool_name: str, content: str) -> Dict:
        """
        格式化OpenAI工具结果消息
        
        格式:
        {
            "role": "tool",
            "tool_call_id": "call_xxx",
            "content": "result content"
        }
        """
        return {
            "role": "tool",
            "tool_call_id": tool_call_id,
            "content": content
        }
    
    def format_assistant_message_with_tool_calls(self, content: str, tool_calls: List[Dict]) -> Dict:
        """
        格式化包含工具调用的OpenAI assistant消息
        
        格式:
        {
            "role": "assistant",
            "content": "...",
            "tool_calls": [{
                "id": "call_xxx",
                "type": "function",
                "function": {
                    "name": "tool_name",
                    "arguments": "{...}"
                }
            }]
        }
        """
        formatted_tool_calls = []
        
        for tc in tool_calls:
            arguments = tc.get('arguments', {})
            if isinstance(arguments, dict):
                arguments_str = json.dumps(arguments, ensure_ascii=False)
            else:
                arguments_str = str(arguments)
            
            formatted_tool_calls.append({
                "id": tc.get('id', str(uuid.uuid4())),
                "type": "function",
                "function": {
                    "name": tc.get('name', ''),
                    "arguments": arguments_str
                }
            })
        
        return {
            "role": "assistant",
            "content": content or "",
            "tool_calls": formatted_tool_calls
        }
