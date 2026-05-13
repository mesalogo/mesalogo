"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: graph_mcp.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: graph_mcp.py
# ============================================================

"""
图谱增强MCP服务接口

提供OpenAI兼容的MCP服务接口，支持外部应用调用图谱增强功能
"""

import json
import uuid
from datetime import datetime

from app.models import GraphEnhancement
from app.services.graph_enhancement import GraphEnhancementService

# 创建Blueprint

# 图谱增强服务实例
graph_service = GraphEnhancementService()

# ==================== OpenAI兼容接口 ====================

@router.post('/v1/chat/completions')
async def openai_compatible_chat(request: Request):
    """OpenAI兼容的聊天完成接口"""
    try:
        data = await request.json()
        
        # 解析OpenAI格式的请求
        messages = data.get('messages', [])
        model = data.get('model', 'graph-enhancement')
        stream = data.get('stream', False)
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('max_tokens', 2000)
        
        # 提取用户查询
        user_message = None
        for message in messages:
            if message.get('role') == 'user':
                user_message = message.get('content', '')
                break
        
        if not user_message:
            raise HTTPException(status_code=400, detail={
                'error': {
                    'message': '未找到用户消息',
                    'type': 'invalid_request_error',
                    'code': 'missing_user_message'
                }
            })
        
        # 获取图谱增强配置
        config = GraphEnhancement.query.filter_by(framework='graphiti').first()
        if not config or not config.enabled:
            raise HTTPException(status_code=503, detail={
                'error': {
                    'message': '图谱增强服务未启用',
                    'type': 'service_unavailable_error',
                    'code': 'service_disabled'
                }
            })
        
        # 执行图谱增强查询
        query_params = {
            'mode': 'hybrid',
            'top_k': 60,
            'chunk_top_k': 10,
            'response_type': 'Multiple Paragraphs'
        }
        
        success, result = graph_service.query(config, user_message, query_params)
        
        if not success:
            raise HTTPException(status_code=500, detail={
                'error': {
                    'message': f'查询失败: {result}',
                    'type': 'internal_error',
                    'code': 'query_failed'
                }
            })
        
        # 构建OpenAI格式的响应
        response_id = f"chatcmpl-{uuid.uuid4().hex[:29]}"
        created = int(datetime.now().timestamp())
        
        if stream:
            # 流式响应
            def generate_stream():
                # 开始流
                start_chunk = {
                    'id': response_id,
                    'object': 'chat.completion.chunk',
                    'created': created,
                    'model': model,
                    'choices': [{
                        'index': 0,
                        'delta': {'role': 'assistant', 'content': ''},
                        'finish_reason': None
                    }]
                }
                yield f"data: {json.dumps(start_chunk)}\n\n"

                # 分块发送内容
                chunk_size = 50
                content = str(result)
                for i in range(0, len(content), chunk_size):
                    chunk = content[i:i+chunk_size]
                    content_chunk = {
                        'id': response_id,
                        'object': 'chat.completion.chunk',
                        'created': created,
                        'model': model,
                        'choices': [{
                            'index': 0,
                            'delta': {'content': chunk},
                            'finish_reason': None
                        }]
                    }
                    yield f"data: {json.dumps(content_chunk)}\n\n"

                # 结束流
                end_chunk = {
                    'id': response_id,
                    'object': 'chat.completion.chunk',
                    'created': created,
                    'model': model,
                    'choices': [{
                        'index': 0,
                        'delta': {},
                        'finish_reason': 'stop'
                    }]
                }
                yield f"data: {json.dumps(end_chunk)}\n\n"
                yield "data: [DONE]\n\n"
            
            return StreamingResponse(
                generate_stream(),
                media_type='text/event-stream',
                headers={
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no'
                }
            )
        else:
            # 非流式响应
            return {
                'id': response_id,
                'object': 'chat.completion',
                'created': created,
                'model': model,
                'choices': [{
                    'index': 0,
                    'message': {
                        'role': 'assistant',
                        'content': str(result)
                    },
                    'finish_reason': 'stop'
                }],
                'usage': {
                    'prompt_tokens': len(user_message.split()),
                    'completion_tokens': len(str(result).split()),
                    'total_tokens': len(user_message.split()) + len(str(result).split())
                }
            }
        
    except Exception as e:
        logger.error(f"OpenAI兼容接口错误: {e}")
        raise HTTPException(status_code=500, detail={
            'error': {
                'message': f'内部服务器错误: {str(e)}',
                'type': 'internal_error',
                'code': 'server_error'
            }
        })

@router.get('/v1/models')
def list_models():
    """列出可用模型"""
    return {
        'object': 'list',
        'data': [
            {
                'id': 'graph-enhancement',
                'object': 'model',
                'created': int(datetime.now().timestamp()),
                'owned_by': 'graph-enhancement-service',
                'permission': [],
                'root': 'graph-enhancement',
                'parent': None
            }
        ]
    }

# ==================== MCP特定接口 ====================

@router.get('/mcp/graph-tools')
def list_mcp_tools():
    """列出图谱增强MCP工具"""
    return {
        'tools': [
            {
                'name': 'graph_query',
                'description': '使用图谱增强技术查询知识库',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'query': {
                            'type': 'string',
                            'description': '要查询的问题或内容'
                        },
                        'mode': {
                            'type': 'string',
                            'enum': ['hybrid', 'local', 'global', 'mix'],
                            'description': '查询模式',
                            'default': 'hybrid'
                        },
                        'top_k': {
                            'type': 'integer',
                            'description': '返回结果数量',
                            'default': 60,
                            'minimum': 1,
                            'maximum': 200
                        }
                    },
                    'required': ['query']
                }
            },
            {
                'name': 'graph_add_document',
                'description': '向图谱增强系统添加文档',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'content': {
                            'type': 'string',
                            'description': '要添加的文档内容'
                        }
                    },
                    'required': ['content']
                }
            },
            {
                'name': 'graph_status',
                'description': '获取图谱增强系统状态',
                'inputSchema': {
                    'type': 'object',
                    'properties': {}
                }
            }
        ]
    }

@router.post('/mcp/graph-tools/call')
async def call_mcp_tool(request: Request):
    """调用图谱增强MCP工具"""
    try:
        data = await request.json()
        
        tool_name = data.get('name')
        arguments = data.get('arguments', {})
        
        if tool_name == 'graph_query':
            return handle_graph_query(arguments)
        elif tool_name == 'graph_add_document':
            return handle_graph_add_document(arguments)
        elif tool_name == 'graph_status':
            return handle_graph_status(arguments)
        else:
            raise HTTPException(status_code=400, detail={
                'error': f'未知工具: {tool_name}'
            })
            
    except Exception as e:
        logger.error(f"MCP工具调用错误: {e}")
        raise HTTPException(status_code=500, detail={
            'error': f'工具调用失败: {str(e)}'
        })

def handle_graph_query(arguments):
    """处理图谱查询工具"""
    query = arguments.get('query')
    if not query:
        raise HTTPException(status_code=400, detail={'error': '查询内容不能为空'})
    
    config = GraphEnhancement.query.filter_by(framework='graphiti').first()
    if not config or not config.enabled:
        raise HTTPException(status_code=503, detail={'error': '图谱增强服务未启用'})
    
    query_params = {
        'mode': arguments.get('mode', 'hybrid'),
        'top_k': arguments.get('top_k', 60),
        'chunk_top_k': 10,
        'response_type': 'Multiple Paragraphs'
    }
    
    success, result = graph_service.query(config, query, query_params)
    
    if success:
        return {
            'content': [
                {
                    'type': 'text',
                    'text': str(result)
                }
            ]
        }
    else:
        raise HTTPException(status_code=500, detail={'error': f'查询失败: {result}'})

def handle_graph_add_document(arguments):
    """处理添加文档工具"""
    content = arguments.get('content')
    if not content:
        raise HTTPException(status_code=400, detail={'error': '文档内容不能为空'})
    
    config = GraphEnhancement.query.filter_by(framework='graphiti').first()
    if not config or not config.enabled:
        raise HTTPException(status_code=503, detail={'error': '图谱增强服务未启用'})
    
    success, message = graph_service.add_documents(config, [content])
    
    if success:
        return {
            'content': [
                {
                    'type': 'text',
                    'text': message
                }
            ]
        }
    else:
        raise HTTPException(status_code=500, detail={'error': message})

def handle_graph_status(arguments):
    """处理状态查询工具"""
    config = GraphEnhancement.query.filter_by(framework='graphiti').first()
    if not config:
        return {
            'content': [
                {
                    'type': 'text',
                    'text': '图谱增强服务未配置'
                }
            ]
        }
    
    status = graph_service.get_status(config)
    
    return {
        'content': [
            {
                'type': 'text',
                'text': json.dumps(status, ensure_ascii=False, indent=2)
            }
        ]
    }

