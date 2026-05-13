"""
外部知识库服务包

提供外部知识库的适配器和服务功能
"""

from .base_adapter import ExternalKnowledgeAdapter
from .dify_adapter import DifyAdapter
from .ragflow_adapter import RagFlowAdapter
from .fastgpt_adapter import FastGPTAdapter
from .custom_adapter import CustomAdapter
from .adapter_factory import AdapterFactory
from .external_knowledge_service import ExternalKnowledgeService

__all__ = [
    'ExternalKnowledgeAdapter',
    'DifyAdapter',
    'RagFlowAdapter', 
    'FastGPTAdapter',
    'CustomAdapter',
    'AdapterFactory',
    'ExternalKnowledgeService'
]
