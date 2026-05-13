"""
工作流基类模块

定义工作流基类和接口，提供共享方法和事件发送功能，所有具体工作流都继承自此基类
"""
import logging
import traceback
from typing import Dict, Any, Optional, List, Tuple, Union

from app.services.conversation.observer import event_manager
from app.services.conversation.event_types import *

logger = logging.getLogger(__name__)

class BaseWorkflow:
    """工作流基类"""
    
    def __init__(self):
        """初始化工作流"""
        self.name = self.__class__.__name__
        logger.debug(f"初始化工作流: {self.name}")
    
    def execute(self, *args, **kwargs) -> Dict[str, Any]:
        """
        执行工作流
        
        Args:
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            Dict[str, Any]: 执行结果
        """
        raise NotImplementedError("工作流必须实现execute方法")
    
    def validate(self, *args, **kwargs) -> Tuple[bool, Optional[str]]:
        """
        验证输入参数
        
        Args:
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            Tuple[bool, Optional[str]]: (是否有效, 错误消息)
        """
        # 默认实现：不进行验证，直接返回有效
        return True, None
    
    def emit_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """
        发出事件通知
        
        Args:
            event_type: 事件类型
            data: 事件数据
        """
        # 添加工作流信息到事件数据
        data['workflow'] = self.name
        
        # 使用事件管理器发出事件
        event_manager.emit(event_type, data)
    
    def run(self, *args, **kwargs) -> Dict[str, Any]:
        """
        运行工作流，包括验证、执行和错误处理
        
        Args:
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            Dict[str, Any]: 执行结果
        """
        try:
            # 验证输入参数
            is_valid, error_message = self.validate(*args, **kwargs)
            if not is_valid:
                logger.error(f"工作流 {self.name} 验证失败: {error_message}")
                return {
                    'status': 'error',
                    'message': error_message or '输入参数验证失败'
                }
            
            # 执行工作流
            logger.info(f"开始执行工作流: {self.name}")
            result = self.execute(*args, **kwargs)
            logger.info(f"工作流 {self.name} 执行完成")
            
            return result
            
        except Exception as e:
            # 处理异常
            error_message = f"工作流 {self.name} 执行出错: {str(e)}"
            logger.error(error_message)
            logger.error(traceback.format_exc())
            
            return {
                'status': 'error',
                'message': error_message
            }
    
    def get_model_client(self):
        """
        获取模型客户端
        
        Returns:
            ModelClient: 模型客户端实例
        """
        # 延迟导入，避免循环依赖
        from app.services.conversation.model_client import ModelClient
        return ModelClient()
    
    def handle_stream_response(self, response, callback):
        """
        处理流式响应
        
        Args:
            response: 响应对象
            callback: 回调函数
            
        Returns:
            str: 处理结果
        """
        # 延迟导入，避免循环依赖
        from app.services.conversation.stream_handler import handle_streaming_response
        return handle_streaming_response(response, callback)
    
    def parse_tool_calls(self, content):
        """
        解析工具调用
        
        Args:
            content: 智能体回复内容
            
        Returns:
            List[Dict]: 解析后的工具调用列表
        """
        # 延迟导入，避免循环依赖
        from app.services.conversation.tool_handler import parse_tool_calls
        return parse_tool_calls(content)
    
    def execute_tool_call(self, tool_call):
        """
        执行工具调用
        
        Args:
            tool_call: 工具调用信息
            
        Returns:
            str: 工具执行结果
        """
        # 延迟导入，避免循环依赖
        from app.services.conversation.tool_handler import execute_tool_call
        return execute_tool_call(tool_call)
    
    def process_message(self, conversation_id, content, **kwargs):
        """
        处理消息
        
        Args:
            conversation_id: 会话ID
            content: 消息内容
            **kwargs: 其他参数
            
        Returns:
            tuple: 处理结果
        """
        # 延迟导入，避免循环依赖
        from app.services.conversation.message_processor import process_message_common
        return process_message_common(conversation_id, content, **kwargs)
