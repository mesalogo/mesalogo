#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工具模式缓存管理器

本模块提供MCP服务器工具模式(tool schema)的缓存管理功能，
在应用启动时预加载工具模式并存储在内存中，以便在后续LLM请求中直接使用。
"""

import logging
from typing import Dict, List, Any, Optional
import threading

# 设置日志
logger = logging.getLogger(__name__)

class ToolSchemaCache:
    """工具模式缓存管理器类"""

    def __init__(self):
        """初始化工具模式缓存管理器"""
        self._cache = {}  # 服务器ID -> 工具模式列表的映射
        self._lock = threading.RLock()  # 使用可重入锁保护缓存访问
        logger.info("工具模式缓存管理器已初始化")

    @staticmethod
    def _count_tools(tools: Any) -> int:
        """计算工具数量的辅助方法"""
        if isinstance(tools, list):
            return len(tools)
        if isinstance(tools, dict) and 'tools' in tools:
            return len(tools['tools'])
        return 0
    
    def set_tools(self, server_id: str, tools: List[Dict]) -> None:
        """设置服务器的工具模式缓存

        Args:
            server_id: 服务器ID
            tools: 工具模式列表
        """
        with self._lock:
            self._cache[server_id] = tools
            actual_count = self._count_tools(tools)
            logger.info(f"已缓存服务器 {server_id} 的 {actual_count} 个工具模式")
    
    def get_tools(self, server_id: str) -> Optional[List[Dict]]:
        """获取服务器的工具模式缓存
        
        Args:
            server_id: 服务器ID
            
        Returns:
            List[Dict]: 工具模式列表，如果缓存不存在则返回None
        """
        with self._lock:
            return self._cache.get(server_id)
    
    def has_tools(self, server_id: str) -> bool:
        """检查是否存在服务器的工具模式缓存
        
        Args:
            server_id: 服务器ID
            
        Returns:
            bool: 是否存在缓存
        """
        with self._lock:
            return server_id in self._cache
    
    def remove_tools(self, server_id: str) -> None:
        """移除服务器的工具模式缓存
        
        Args:
            server_id: 服务器ID
        """
        with self._lock:
            if server_id in self._cache:
                del self._cache[server_id]
                logger.info(f"已移除服务器 {server_id} 的工具模式缓存")
    
    def clear(self) -> None:
        """清空所有工具模式缓存"""
        with self._lock:
            self._cache.clear()
            logger.info("已清空所有工具模式缓存")
    
    def get_all_server_ids(self) -> List[str]:
        """获取所有已缓存的服务器ID列表
        
        Returns:
            List[str]: 服务器ID列表
        """
        with self._lock:
            return list(self._cache.keys())
    
    def get_all_tools(self) -> Dict[str, List[Dict]]:
        """获取所有已缓存的工具模式
        
        Returns:
            Dict[str, List[Dict]]: 服务器ID到工具模式列表的映射
        """
        with self._lock:
            return self._cache.copy()

# 创建全局单例实例
tool_schema_cache = ToolSchemaCache()
