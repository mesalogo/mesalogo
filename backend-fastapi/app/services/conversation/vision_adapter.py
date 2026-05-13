"""
统一视觉适配器

处理不同供应商的图像消息格式转换，支持：
- Ollama: images数组格式
- OpenAI: image_url格式
- Anthropic: image source格式
- GPUStack: OpenAI兼容格式
"""

import logging
from typing import List, Dict, Any, Optional, Union
import json

logger = logging.getLogger(__name__)

class VisionAdapter:
    """统一视觉适配器"""
    
    def __init__(self):
        """初始化适配器"""
        self.supported_providers = {
            'ollama', 'openai', 'anthropic', 'google', 'gpustack'
        }
    
    def has_images(self, messages: List[Dict[str, Any]]) -> bool:
        """
        检查消息列表中是否包含图像
        
        Args:
            messages: 消息列表
            
        Returns:
            bool: 是否包含图像
        """
        try:
            for message in messages:
                content = message.get('content', '')
                
                # 检查content是否为数组格式（多模态）
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and item.get('type') == 'image':
                            return True
                
                # 检查是否为字符串中的Base64图像
                elif isinstance(content, str):
                    from .image_processor import ImageProcessor
                    if ImageProcessor.is_base64_image(content):
                        return True
            
            return False
            
        except Exception as e:
            logger.error(f"检查图像内容失败: {e}")
            return False
    
    def format_for_provider(self, messages: List[Dict[str, Any]], 
                           provider: str) -> List[Dict[str, Any]]:
        """
        根据供应商格式化消息
        
        Args:
            messages: 原始消息列表
            provider: 供应商名称
            
        Returns:
            List[Dict[str, Any]]: 格式化后的消息列表
        """
        try:
            if provider not in self.supported_providers:
                logger.warning(f"不支持的供应商: {provider}，返回原始消息")
                return messages
            
            # 如果没有图像，直接返回原始消息
            if not self.has_images(messages):
                return messages
            
            # 根据供应商转换格式
            if provider == 'ollama':
                return self._format_for_ollama(messages)
            elif provider == 'openai':
                return self._format_for_openai(messages)
            elif provider == 'anthropic':
                return self._format_for_anthropic(messages)
            elif provider == 'google':
                return self._format_for_google(messages)
            elif provider == 'gpustack':
                # GPUStack使用OpenAI兼容格式
                return self._format_for_openai(messages)
            else:
                return messages
                
        except Exception as e:
            logger.error(f"消息格式转换失败: {e}")
            return messages
    
    def _format_for_ollama(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        转换为Ollama格式
        
        Ollama格式:
        {
            "role": "user",
            "content": "文本内容",
            "images": ["data:image/jpeg;base64,..."]
        }
        """
        formatted_messages = []
        
        for message in messages:
            role = message.get('role', 'user')
            content = message.get('content', '')
            
            if isinstance(content, list):
                # 多模态内容
                text_parts = []
                images = []
                
                for item in content:
                    if isinstance(item, dict):
                        if item.get('type') == 'text':
                            text_parts.append(item.get('text', ''))
                        elif item.get('type') == 'image':
                            # 提取图像数据
                            source = item.get('source', {})
                            if source.get('type') == 'base64':
                                data = source.get('data', '')
                                media_type = source.get('media_type', 'image/jpeg')
                                
                                # 确保有data URI前缀
                                if not data.startswith('data:'):
                                    data = f"data:{media_type};base64,{data}"
                                
                                images.append(data)
                
                # 构建Ollama消息
                formatted_message = {
                    'role': role,
                    'content': ' '.join(text_parts).strip()
                }
                
                if images:
                    formatted_message['images'] = images
                
                formatted_messages.append(formatted_message)
                
            else:
                # 纯文本内容
                formatted_messages.append({
                    'role': role,
                    'content': content
                })
        
        return formatted_messages
    
    def _format_for_openai(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        转换为OpenAI格式
        
        OpenAI格式:
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "文本内容"},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
            ]
        }
        """
        formatted_messages = []
        
        for message in messages:
            role = message.get('role', 'user')
            content = message.get('content', '')
            
            if isinstance(content, list):
                # 已经是多模态格式，转换图像部分
                formatted_content = []
                
                for item in content:
                    if isinstance(item, dict):
                        if item.get('type') == 'text':
                            formatted_content.append(item)
                        elif item.get('type') == 'image':
                            # 转换为OpenAI格式
                            source = item.get('source', {})
                            if source.get('type') == 'base64':
                                data = source.get('data', '')
                                media_type = source.get('media_type', 'image/jpeg')
                                
                                # 确保有data URI前缀
                                if not data.startswith('data:'):
                                    data = f"data:{media_type};base64,{data}"
                                
                                formatted_content.append({
                                    'type': 'image_url',
                                    'image_url': {'url': data}
                                })
                
                formatted_messages.append({
                    'role': role,
                    'content': formatted_content
                })
                
            else:
                # 纯文本内容
                formatted_messages.append({
                    'role': role,
                    'content': content
                })
        
        return formatted_messages
    
    def _format_for_anthropic(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        转换为Anthropic格式
        
        Anthropic格式:
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "文本内容"},
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "..."}}
            ]
        }
        """
        # Anthropic格式与我们的内部格式相同，直接返回
        return messages
    
    def _format_for_google(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        转换为Google Gemini格式
        
        Google格式:
        {
            "role": "user",
            "parts": [
                {"text": "文本内容"},
                {"inline_data": {"mime_type": "image/jpeg", "data": "base64_data"}}
            ]
        }
        """
        formatted_messages = []
        
        for message in messages:
            role = message.get('role', 'user')
            content = message.get('content', '')
            
            if isinstance(content, list):
                # 多模态内容
                parts = []
                
                for item in content:
                    if isinstance(item, dict):
                        if item.get('type') == 'text':
                            parts.append({'text': item.get('text', '')})
                        elif item.get('type') == 'image':
                            # 转换为Google格式
                            source = item.get('source', {})
                            if source.get('type') == 'base64':
                                data = source.get('data', '')
                                media_type = source.get('media_type', 'image/jpeg')
                                
                                # 移除data URI前缀（如果存在）
                                if data.startswith('data:'):
                                    data = data.split(',', 1)[1]
                                
                                parts.append({
                                    'inline_data': {
                                        'mime_type': media_type,
                                        'data': data
                                    }
                                })
                
                formatted_messages.append({
                    'role': role,
                    'parts': parts
                })
                
            else:
                # 纯文本内容
                formatted_messages.append({
                    'role': role,
                    'parts': [{'text': content}]
                })
        
        return formatted_messages
    
    def extract_images_from_content(self, content: Union[str, List[Dict[str, Any]]]) -> List[str]:
        """
        从消息内容中提取图像数据
        
        Args:
            content: 消息内容
            
        Returns:
            List[str]: Base64图像数据列表
        """
        images = []
        
        try:
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get('type') == 'image':
                        source = item.get('source', {})
                        if source.get('type') == 'base64':
                            data = source.get('data', '')
                            if data:
                                images.append(data)
            
            elif isinstance(content, str):
                from .image_processor import ImageProcessor
                if ImageProcessor.is_base64_image(content):
                    images.append(content)
        
        except Exception as e:
            logger.error(f"提取图像失败: {e}")
        
        return images
    
    def parse_multimodal_content(self, content: Any) -> List[Dict[str, Any]]:
        """
        解析多模态内容为统一格式
        
        Args:
            content: 原始内容
            
        Returns:
            List[Dict[str, Any]]: 统一格式的内容列表
        """
        try:
            if isinstance(content, str):
                # 纯文本内容
                return [{'type': 'text', 'text': content}]
            
            elif isinstance(content, list):
                # 已经是多模态格式
                return content
            
            else:
                # 其他格式转为文本
                return [{'type': 'text', 'text': str(content)}]
                
        except Exception as e:
            logger.error(f"解析多模态内容失败: {e}")
            return [{'type': 'text', 'text': str(content)}]


# 全局实例
vision_adapter = VisionAdapter()
