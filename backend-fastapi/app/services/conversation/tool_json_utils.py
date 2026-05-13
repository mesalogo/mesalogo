"""
工具调用JSON处理工具

提供从文本中提取和清理工具调用结果JSON的功能
"""
import json
from typing import List, Tuple, Any


def extract_json_objects(content: str, index: int = 0) -> List[Tuple[Any, int, int]]:
    """
    从字符串中提取所有JSON对象
    
    基于StackOverflow最佳实践:
    https://stackoverflow.com/questions/55525623/how-to-extract-a-json-object-enclosed-between-paragraphs-of-string
    
    Args:
        content: 包含JSON对象的字符串
        index: 开始搜索的位置
        
    Returns:
        List[Tuple[Any, int, int]]: (JSON对象, 开始位置, 结束位置) 的列表
    """
    def RawJSONDecoder(idx):
        class _RawJSONDecoder(json.JSONDecoder):
            end = None
            def decode(self, s, *_):
                data, self.__class__.end = self.raw_decode(s, idx)
                return data
        return _RawJSONDecoder
    
    json_objects = []
    while (index := content.find('{', index)) != -1:
        try:
            decoder = RawJSONDecoder(index)
            obj = json.loads(content, cls=decoder)
            json_objects.append((obj, index, decoder.end))
            index = decoder.end
        except json.JSONDecodeError:
            index += 1
    
    return json_objects


def is_tool_result_json(obj: Any) -> bool:
    """
    判断JSON对象是否为工具调用结果
    
    Args:
        obj: JSON对象
        
    Returns:
        bool: 是否为工具调用结果
    """
    return (isinstance(obj, dict) and
            obj.get('content') is None and
            isinstance(obj.get('meta'), dict) and
            obj['meta'].get('type') == 'toolResult' and
            obj['meta'].get('role') == 'tool')


def extract_tool_result_jsons(content: str) -> List[Tuple[Any, int, int]]:
    """
    从字符串中提取所有工具调用结果JSON
    
    Args:
        content: 包含工具调用JSON的字符串
        
    Returns:
        List[Tuple[Any, int, int]]: (JSON对象, 开始位置, 结束位置) 的列表
    """
    json_objects = extract_json_objects(content)
    return [(obj, start, end) for obj, start, end in json_objects 
            if is_tool_result_json(obj)]


def remove_tool_result_jsons(content: str) -> str:
    """
    从内容中移除所有工具调用结果JSON
    
    Args:
        content: 包含工具调用JSON的内容
        
    Returns:
        str: 清理后的纯文本内容
    """
    import re
    
    tool_results = extract_tool_result_jsons(content)
    
    if not tool_results:
        return content
    
    # 从后往前删除（避免位置偏移）
    cleaned = content
    for _, start_pos, end_pos in reversed(tool_results):
        cleaned = cleaned[:start_pos] + cleaned[end_pos:]
    
    # 清理多余的空行
    cleaned = re.sub(r'\n\s*\n\s*\n+', '\n\n', cleaned)
    return cleaned.strip()
