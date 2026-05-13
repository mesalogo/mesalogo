"""
工具格式转换器模块

提供统一的工具格式转换功能，支持OpenAI和Anthropic格式之间的转换
"""
import json
import uuid
import logging
from typing import Dict, List, Any, Optional, TypedDict

logger = logging.getLogger(__name__)


class UnifiedToolDefinition(TypedDict):
    """统一的工具定义格式"""
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema


class UnifiedToolCall(TypedDict):
    """统一的工具调用格式"""
    id: str
    name: str
    arguments: Dict[str, Any]  # 已解析的参数字典


class UnifiedToolResult(TypedDict):
    """统一的工具结果格式"""
    tool_call_id: str
    content: str
    status: str  # "success" | "error"


class ToolFormatConverter:
    """工具格式转换器"""
    
    @staticmethod
    def to_unified_tools(tools: List[Dict]) -> List[UnifiedToolDefinition]:
        """
        将OpenAI格式工具定义转换为统一格式
        
        Args:
            tools: OpenAI格式的工具定义列表
            
        Returns:
            List[UnifiedToolDefinition]: 统一格式的工具定义列表
        """
        result = []
        for tool in tools:
            if tool.get('type') != 'function':
                continue
            
            function = tool.get('function', {})
            result.append({
                "name": function.get('name', ''),
                "description": function.get('description', ''),
                "parameters": function.get('parameters', {
                    "type": "object",
                    "properties": {},
                    "required": []
                })
            })
        return result
    
    @staticmethod
    def to_provider_tools(tools: List[Dict], provider: str) -> List[Dict]:
        """
        将OpenAI格式工具定义转换为目标提供商格式
        
        Args:
            tools: OpenAI格式的工具定义列表
            provider: 目标提供商 ('openai', 'anthropic', 'ollama', 'gpustack' 等)
            
        Returns:
            List[Dict]: 提供商格式的工具定义列表
        """
        if provider == 'anthropic':
            return ToolFormatConverter._to_anthropic_tools(tools)
        else:
            # OpenAI及兼容格式，直接返回
            return tools
    
    @staticmethod
    def _to_anthropic_tools(tools: List[Dict]) -> List[Dict]:
        """
        将OpenAI格式转换为Anthropic/Claude格式
        
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
    
    @staticmethod
    def format_tool_choice(tool_choice: str, provider: str) -> Any:
        """
        格式化工具选择参数
        
        Args:
            tool_choice: 工具选择策略 ("auto", "none", "required" 或具体工具名)
            provider: 提供商名称
            
        Returns:
            提供商格式的tool_choice参数
        """
        if provider == 'anthropic':
            if tool_choice == "auto":
                return {"type": "auto"}
            elif tool_choice == "none":
                return {"type": "auto"}  # Claude没有none
            elif tool_choice == "required":
                return {"type": "any"}
            else:
                return {"type": "tool", "name": tool_choice}
        else:
            # OpenAI格式
            if tool_choice in ["auto", "none", "required"]:
                return tool_choice
            else:
                return {"type": "function", "function": {"name": tool_choice}}
    
    @staticmethod
    def from_openai_tool_calls(tool_calls: List[Dict]) -> List[UnifiedToolCall]:
        """
        从OpenAI响应解析工具调用为统一格式
        
        Args:
            tool_calls: OpenAI格式的工具调用列表
            
        Returns:
            List[UnifiedToolCall]: 统一格式的工具调用列表
        """
        result = []
        for tc in tool_calls:
            if tc.get('type') != 'function':
                continue
            
            function = tc.get('function', {})
            arguments_str = function.get('arguments', '{}')
            
            try:
                arguments = json.loads(arguments_str) if isinstance(arguments_str, str) else arguments_str
            except json.JSONDecodeError:
                logger.warning(f"无法解析工具参数: {arguments_str}")
                arguments = {}
            
            result.append({
                "id": tc.get('id', str(uuid.uuid4())),
                "name": function.get('name', ''),
                "arguments": arguments
            })
        return result
    
    @staticmethod
    def from_anthropic_content(content: List[Dict]) -> List[UnifiedToolCall]:
        """
        从Claude响应内容解析工具调用为统一格式
        
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
            ]
        }
        """
        result = []
        for block in content:
            if block.get('type') != 'tool_use':
                continue
            
            result.append({
                "id": block.get('id', str(uuid.uuid4())),
                "name": block.get('name', ''),
                "arguments": block.get('input', {})
            })
        return result
    
    @staticmethod
    def to_provider_tool_result(result: UnifiedToolResult, provider: str) -> Dict:
        """
        将统一格式工具结果转换为提供商格式
        
        Args:
            result: 统一格式的工具结果
            provider: 提供商名称
            
        Returns:
            Dict: 提供商格式的工具结果消息
        """
        if provider == 'anthropic':
            return {
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": result["tool_call_id"],
                    "content": result["content"]
                }]
            }
        else:
            # OpenAI格式
            return {
                "role": "tool",
                "tool_call_id": result["tool_call_id"],
                "content": result["content"]
            }
    
    @staticmethod
    def to_provider_assistant_message(content: str, tool_calls: List[UnifiedToolCall], provider: str) -> Dict:
        """
        将包含工具调用的assistant消息转换为提供商格式
        
        Args:
            content: 助手消息内容
            tool_calls: 统一格式的工具调用列表
            provider: 提供商名称
            
        Returns:
            Dict: 提供商格式的assistant消息
        """
        if provider == 'anthropic':
            content_blocks = []
            
            # 添加文本内容
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
        else:
            # OpenAI格式
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
    
    @staticmethod
    def unified_to_openai_tool_call(unified_tc: UnifiedToolCall) -> Dict:
        """
        将统一格式工具调用转换为OpenAI格式（用于内部处理）
        
        Args:
            unified_tc: 统一格式的工具调用
            
        Returns:
            Dict: OpenAI格式的工具调用
        """
        arguments = unified_tc.get('arguments', {})
        if isinstance(arguments, dict):
            arguments_str = json.dumps(arguments, ensure_ascii=False)
        else:
            arguments_str = str(arguments)
        
        return {
            "id": unified_tc.get('id', str(uuid.uuid4())),
            "type": "function",
            "function": {
                "name": unified_tc.get('name', ''),
                "arguments": arguments_str
            }
        }


def get_tool_provider(provider: str):
    """
    获取工具提供商实例
    
    Args:
        provider: 提供商名称
        
    Returns:
        BaseToolProvider: 工具提供商实例
    """
    from .providers import OpenAIToolProvider, AnthropicToolProvider
    
    if provider == 'anthropic':
        return AnthropicToolProvider()
    else:
        return OpenAIToolProvider()
