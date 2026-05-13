"""
请求工具模块

提供请求ID生成、agent_id规范化等辅助函数
优化目标：避免代码重复，统一处理逻辑
"""
from typing import Optional


def normalize_agent_id(agent_id) -> Optional[str]:
    """
    规范化agent_id为字符串类型
    
    Args:
        agent_id: 智能体ID，可能是int、str或None
        
    Returns:
        Optional[str]: 规范化后的字符串类型ID，如果输入为None则返回None
        
    Examples:
        >>> normalize_agent_id(123)
        '123'
        >>> normalize_agent_id('456')
        '456'
        >>> normalize_agent_id(None)
        None
    """
    if agent_id is None:
        return None
    return str(agent_id)


def generate_request_id(task_id: int, conversation_id: int, agent_id: Optional[str] = None) -> str:
    """
    生成请求ID
    
    统一的请求ID生成逻辑，避免在多处重复相同代码
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        agent_id: 智能体ID（可选）
        
    Returns:
        str: 格式化的请求ID
        
    Examples:
        >>> generate_request_id(1, 2, '3')
        '1:2:3'
        >>> generate_request_id(1, 2)
        '1:2'
    """
    # 确保agent_id是字符串类型（如果不为None）
    agent_id = normalize_agent_id(agent_id)
    
    if agent_id:
        return f"{task_id}:{conversation_id}:{agent_id}"
    else:
        return f"{task_id}:{conversation_id}"


def generate_task_key(task_id: int) -> str:
    """
    生成任务键
    
    用于自主任务字典的键值
    
    Args:
        task_id: 行动任务ID
        
    Returns:
        str: 任务键
        
    Examples:
        >>> generate_task_key(123)
        '123'
    """
    return str(task_id)
