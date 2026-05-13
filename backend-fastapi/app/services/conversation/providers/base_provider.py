"""
工具调用提供商基类

定义统一的工具调用接口，各提供商实现具体的格式转换
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional


class BaseToolProvider(ABC):
    """工具调用提供商基类"""
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """提供商名称"""
        pass
    
    @abstractmethod
    def format_tools_for_request(self, tools: List[Dict]) -> List[Dict]:
        """
        将统一格式工具定义转换为提供商格式
        
        Args:
            tools: 统一格式的工具定义列表（OpenAI格式作为内部标准）
            
        Returns:
            List[Dict]: 提供商格式的工具定义列表
        """
        pass
    
    @abstractmethod
    def format_tool_choice(self, tool_choice: str = "auto") -> Any:
        """
        格式化工具选择参数
        
        Args:
            tool_choice: 工具选择策略 ("auto", "none", "required" 或具体工具名)
            
        Returns:
            提供商格式的tool_choice参数
        """
        pass
    
    @abstractmethod
    def parse_tool_calls_from_response(self, response: Dict) -> List[Dict]:
        """
        从非流式响应中解析工具调用
        
        Args:
            response: 提供商的响应对象
            
        Returns:
            List[Dict]: 统一格式的工具调用列表
                [{
                    "id": str,
                    "name": str,
                    "arguments": Dict[str, Any]
                }]
        """
        pass
    
    @abstractmethod
    def parse_streaming_tool_call(self, chunk: Dict, state: Dict) -> Optional[Dict]:
        """
        解析流式响应中的工具调用
        
        Args:
            chunk: 流式响应的一个数据块
            state: 用于跨chunk累积状态的字典
            
        Returns:
            Optional[Dict]: 如果工具调用完成，返回统一格式的工具调用；否则返回None
        """
        pass
    
    @abstractmethod
    def format_tool_result_message(self, tool_call_id: str, tool_name: str, content: str) -> Dict:
        """
        格式化工具结果消息，用于传回LLM
          Args:
            tool_call_id: 工具调用ID
            tool_name: 工具名称
            content: 工具执行结果
            
        Returns:
            Dict: 提供商格式的工具结果消息
        """
        pass
    
    @abstractmethod
    def format_assistant_message_with_tool_calls(self, content: str, tool_calls: List[Dict]) -> Dict:
        """
        格式化包含工具调用的assistant消息
        
        Args:
            content: 助手消息内容（可能为空）
            tool_calls: 工具调用列表
            
        Returns:
            Dict: 提供商格式的assistant消息
        """
        pass
    
    def is_tool_call_response(self, response: Dict) -> bool:
        """
        检查响应是否包含工具调用
        
        Args:
            response: 提供商的响应对象
            
        Returns:
            bool: 是否包含工具调用
        """
        tool_calls = self.parse_tool_calls_from_response(response)
        return len(tool_calls) > 0
    
    def is_streaming_tool_call_complete(self, state: Dict) -> bool:
        """
        检查流式工具调用是否完成
        
        Args:
            state: 流式状态字典
            
        Returns:
            bool: 工具调用是否完成
        """
        return state.get('tool_call_complete', False)
