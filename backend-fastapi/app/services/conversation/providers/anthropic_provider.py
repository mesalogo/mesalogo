"""
Anthropic/Claude工具调用提供商

处理Claude API的工具调用格式
"""
import json
import uuid
import logging
from typing import Dict, List, Any, Optional

from .base_provider import BaseToolProvider

logger = logging.getLogger(__name__)


class AnthropicToolProvider(BaseToolProvider):
    """Anthropic/Claude工具调用提供商"""
    
    @property
    def provider_name(self) -> str:
        return "anthropic"
    
    def format_tools_for_request(self, tools: List[Dict]) -> List[Dict]:
        """
        将OpenAI格式工具定义转换为Claude格式
        
        OpenAI格式:
        {
            "type": "function",
            "function": {
                "name": "tool_name",
                "description": "description",
                "parameters": { JSON Schema }
            }
        }
        
        Claude格式:
        {
            "name": "tool_name",
            "description": "description",
            "input_schema": { JSON Schema }
        }
        """
        result = []
        
        for tool in tools:
            if tool.get('type') != 'function':
                continue
                
            function = tool.get('function', {})
            
            claude_tool = {
                "name": function.get('name', ''),
                "description": function.get('description', ''),
                "input_schema": function.get('parameters', {
                    "type": "object",
                    "properties": {},
                    "required": []
                })
            }
            
            result.append(claude_tool)
        
        return result
    
    def format_tool_choice(self, tool_choice: str = "auto") -> Any:
        """
        格式化Claude工具选择参数
        
        Claude支持: {"type": "auto"}, {"type": "any"}, {"type": "tool", "name": "xxx"}
        """
        if tool_choice == "auto":
            return {"type": "auto"}
        elif tool_choice == "none":
            return {"type": "auto"}  # Claude没有none，使用auto
        elif tool_choice == "required":
            return {"type": "any"}
        else:
            return {
                "type": "tool",
                "name": tool_choice
            }
    
    def parse_tool_calls_from_response(self, response: Dict) -> List[Dict]:
        """
      从Claude响应中解析工具调用
        
        Claude响应格式:
        {
            "content": [
                {"type": "text", "text": "..."},
                {
                    "type": "tool_use",
                    "id": "toolu_xxx",
                    "name": "tool_name",
                    "input": {"arg": "value"}
                }
            ],
            "stop_reason": "tool_use"
        }
        """
        result = []
        
        try:
            content = response.get('content', [])
            
            for block in content:
                if block.get('type') != 'tool_use':
                    continue
                
                result.append({
                    "id": block.get('id', str(uuid.uuid4())),
                    "name": block.get('name', ''),
                    "arguments": block.get('input', {})
                })
                
        except Exception as e:
            logger.error(f"解析Claude工具调用响应失败: {e}")
        
        return result
    
    def parse_streaming_tool_call(self, chunk: Dict, state: Dict) -> Optional[Dict]:
        """
        解析Claude流式响应中的工具调用
        
        Claude流式事件:
        event: content_block_start
        data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_xxx","name":"tool_name","input":{}}}
        
        event: content_block_delta
        data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"arg\":"}}
        
        event: content_block_stop
        data: {"type":"content_block_stop","index":1}
        
        event: message_delta
        data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}
        """
        try:
            event_type = chunk.get('type', '')
            
            if event_type == 'content_block_start':
                content_block = chunk.get('content_block', {})
                if content_block.get('type') == 'tool_use':
                    # 开始新的工具调用
                    index = chunk.get('index', 0)
                    
                    if 'tool_calls' not in state:
                        state['tool_calls'] = {}
                    
                    state['tool_calls'][index] = {
                        'id': content_block.get('id', str(uuid.uuid4())),
                        'name': content_block.get('name', ''),
                        'input_json': ''
                    }
                    state['current_tool_index'] = index
                    
            elif event_type == 'content_block_delta':
                delta = chunk.get('delta', {})
                if delta.get('type') == 'input_json_delta':
                    # 累积JSON片段
                    index = chunk.get('index', state.get('current_tool_index', 0))
                    if 'tool_calls' in state and index in state['tool_calls']:
                        state['tool_calls'][index]['input_json'] += delta.get('partial_json', '')
                        
            elif event_type == 'content_block_stop':
                # 单个工具调用块完成
                index = chunk.get('index', state.get('current_tool_index', 0))
                if 'tool_calls' in state and index in state['tool_calls']:
                    tc = state['tool_calls'][index]
                    tc['complete'] = True
                    
            elif event_type == 'message_delta':
                delta = chunk.get('delta', {})
                if delta.get('stop_reason') == 'tool_use':
                    state['tool_call_complete'] = True
                    return self._finalize_streaming_tool_calls(state)
            
            return None
            
        except Exception as e:
            logger.error(f"解析Claude流式工具调用失败: {e}")
            return None
    
    def _finalize_streaming_tool_calls(self, state: Dict) -> List[Dict]:
        """完成流式工具调用的解析"""
        result = []
        
        for index, tc in state.get('tool_calls', {}).items():
            if not tc.get('name'):
                continue
            
            try:
                input_json = tc.get('input_json', '{}')
                arguments = json.loads(input_json) if input_json else {}
            except json.JSONDecodeError:
                logger.warning(f"无法解析Claude流式工具参数: {tc.get('input_json')}")
                arguments = {}
            
            result.append({
                "id": tc.get('id', str(uuid.uuid4())),
                "name": tc['name'],
                "arguments": arguments
            })
        
        return result
    
    def format_tool_result_message(self, tool_call_id: str, tool_name: str, content: str) -> Dict:
        """
        格式化Claude工具结果消息
        
        Claude格式:
        {
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": "toolu_xxx",
                "content": "result content"
            }]
        }
        """
        return {
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_call_id,
                "content": content
            }]
        }
    
    def format_assistant_message_with_tool_calls(self, content: str, tool_calls: List[Dict]) -> Dict:
        """
        格式化包含工具调用的Claude assistant消息
        
        Claude格式:
        {
            "role": "assistant",
            "content": [
                {"type": "text": "..."},
                {
                    "type": "tool_use",
                    "id": "toolu_xxx",
                    "name": "tool_name",
                    "input": {...}
                }
            ]
        }
        """
        content_blocks = []
        
        # 添加文本内容（如果有）
        if content:
            content_blocks.append({
                "type": "text",
                "text": content
            })
        
        # 添加工具调用
        for tc in tool_calls:
            content_blocks.append({
                "type": "tool_use",
                "id": tc.get('id', str(uuid.uuid4())),
                "name": tc.get('name', ''),
                "input": tc.get('arguments', {})
            })
        
        return {
            "role": "assistant",
            "content": content_blocks
        }
    
    def is_tool_call_response(self, response: Dict) -> bool:
        """检查Claude响应是否包含工具调用"""
        return response.get('stop_reason') == 'tool_use'
