#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
知识库MCP服务器

提供统一的知识库查询服务，支持：
- 基于智能体ID的知识库查询
- 自动推断角色并查询绑定的知识库
- 支持Dify、RAGFlow等多种知识库类型
"""

import asyncio
import json
import logging
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP

# 设置日志
logger = logging.getLogger(__name__)

# 创建MCP服务器
mcp = FastMCP("knowledge-base")

# 知识库工具定义
KNOWLEDGE_BASE_TOOLS = [
    {
        "name": "query_knowledge",
        "description": "智能体查询知识库（系统自动根据agent_id推断role_id并查询绑定的知识库）",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "智能体ID"
                },
                "query": {
                    "type": "string",
                    "description": "查询文本"
                },
                "knowledge_id": {
                    "type": "string",
                    "description": "可选：指定查询的知识库ID。如果不指定，则查询该角色绑定的所有知识库"
                }
            },
            "required": ["agent_id", "query"]
        }
    },
    {
        "name": "list_knowledge_bases",
        "description": "列出智能体可访问的知识库及其详细信息",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "integer",
                    "description": "智能体ID"
                }
            },
            "required": ["agent_id"]
        }
    }
]

def get_tools() -> List[Dict]:
    """获取工具列表（为了与MCPServerManager兼容）"""
    return KNOWLEDGE_BASE_TOOLS

@mcp.tool()
def list_knowledge_bases(agent_id: int) -> Dict[str, Any]:
    """
    列出智能体可访问的知识库
    
    Args:
        agent_id: 智能体ID
        
    Returns:
        dict: 知识库列表及元数据
    """
    try:
        from app.models import Agent, Knowledge, ExternalKnowledge, RoleKnowledge, RoleExternalKnowledge, KnowledgeDocument, KnowledgeFileChunk
        from app.extensions import db
        from sqlalchemy import func
        
        # 获取智能体
        agent = Agent.query.get(agent_id)
        if not agent:
            return {
                "success": False,
                "error": f"智能体ID {agent_id} 不存在",
                "knowledge_bases": [],
                "total_count": 0
            }
        
        role_id = agent.role_id
        if not role_id:
            return {
                "success": False,
                "error": f"智能体 {agent_id} 没有关联的角色",
                "knowledge_bases": [],
                "total_count": 0
            }
        
        knowledge_bases = []
        
        # === 查询内部知识库 ===
        internal_kbs = db.session.query(Knowledge).join(
            RoleKnowledge, RoleKnowledge.knowledge_id == Knowledge.id
        ).filter(RoleKnowledge.role_id == role_id).all()
        
        for kb in internal_kbs:
            # 统计文档数量
            doc_count = KnowledgeDocument.query.filter_by(
                knowledge_id=kb.id,
                status='completed'
            ).count()
            
            # 统计分块数量
            chunk_count = KnowledgeFileChunk.query.filter_by(
                knowledge_id=kb.id
            ).count()
            
            knowledge_bases.append({
                "id": kb.id,
                "name": kb.name,
                "type": "internal",
                "description": kb.description or "",
                "document_count": doc_count,
                "chunk_count": chunk_count,
                "last_updated": kb.updated_at.isoformat() if kb.updated_at else None
            })
        
        # === 查询外部知识库 ===
        external_kbs = db.session.query(ExternalKnowledge).join(
            RoleExternalKnowledge, RoleExternalKnowledge.external_knowledge_id == ExternalKnowledge.id
        ).filter(RoleExternalKnowledge.role_id == role_id).all()
        
        for kb in external_kbs:
            knowledge_bases.append({
                "id": kb.id,
                "name": kb.name,
                "type": "external",
                "description": kb.description or "",
                "document_count": 0,  # 外部知识库无法统计
                "chunk_count": 0,
                "last_updated": kb.updated_at.isoformat() if kb.updated_at else None,
                "provider_type": kb.provider.type if kb.provider else "unknown",
                "provider_name": kb.provider.name if kb.provider else "Unknown"
            })
        
        return {
            "success": True,
            "agent_id": agent_id,
            "agent_name": agent.name,
            "role_id": role_id,
            "role_name": agent.role.name if agent.role else None,
            "knowledge_bases": knowledge_bases,
            "total_count": len(knowledge_bases),
            "metadata": {
                "query_time": 0,
                "timestamp": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"列出知识库失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": f"列出知识库失败: {str(e)}",
            "knowledge_bases": [],
            "total_count": 0
        }

@mcp.tool()
def query_knowledge(
    agent_id: int,
    query: str,
    knowledge_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    智能体查询知识库（统一查询内部和外部知识库）
    
    Args:
        agent_id: 智能体ID
        query: 查询文本
        knowledge_id: 可选的知识库ID，指定则只查询该知识库，否则查询所有绑定的知识库
        
    Returns:
        dict: 聚合查询结果（包含内部和外部知识库的结果）
    """
    try:
        # 导入必要的模块
        from app.models import Agent, db
        from app.services.knowledge_base.knowledge_query_service import KnowledgeQueryService
        
        # 根据agent_id获取对应的role_id
        agent = Agent.query.get(agent_id)
        if not agent:
            return {
                "success": False,
                "error": f"智能体ID {agent_id} 不存在",
                "results": [],
                "total_count": 0,
                "query_time": 0,
                "queried_knowledge_bases": 0,
                "metadata": {
                    "agent_id": agent_id,
                    "query_text": query,
                    "error": "智能体不存在"
                }
            }
        
        # 获取角色信息
        role_id = agent.role_id
        if not role_id:
            return {
                "success": False,
                "error": f"智能体 {agent_id} 没有关联的角色",
                "results": [],
                "total_count": 0,
                "query_time": 0,
                "queried_knowledge_bases": 0,
                "metadata": {
                    "agent_id": agent_id,
                    "agent_name": agent.name,
                    "query_text": query,
                    "error": "智能体没有关联角色"
                }
            }
        
        # 准备查询参数
        query_params = {}
        
        # 如果指定了knowledge_id，添加到查询参数中
        if knowledge_id:
            query_params["knowledge_id"] = knowledge_id
        
        # 使用统一知识库查询服务（会同时查询内部和外部知识库）
        # 返回结果数 = 所有知识库的 top_k 之和
        result = KnowledgeQueryService.query_knowledge_for_role(
            role_id, query, query_params
        )
        
        # 过滤MCP返回结果中不需要的字段
        if result.get('success') and 'results' in result:
            filtered_results = []
            for item in result['results']:
                # 只保留必要字段
                filtered_item = {
                    'content': item.get('content', ''),
                    'relevance_score': item.get('relevance_score', 0),
                    'document_name': item.get('document_name', ''),
                    'source': item.get('source', '')
                }
                filtered_results.append(filtered_item)
            result['results'] = filtered_results
        
        # 增强返回结果的元数据
        if "metadata" not in result:
            result["metadata"] = {}
            
        result["metadata"].update({
            "agent_id": agent_id,
            "agent_name": agent.name,
            "role_id": role_id,
            "role_name": agent.role.name if agent.role else None
        })
        
        return result
        
    except Exception as e:
        logger.error(f"查询知识库失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": f"查询失败: {str(e)}",
            "results": [],
            "total_count": 0,
            "query_time": 0,
            "queried_knowledge_bases": 0,
            "metadata": {
                "agent_id": agent_id,
                "query_text": query,
                "error": str(e)
            }
        }

def handle_request(request_data: Dict) -> Dict:
    """
    处理MCP工具调用请求（为了与MCPServerManager兼容）

    Args:
        request_data: MCP请求数据

    Returns:
        Dict: MCP响应数据
    """
    try:
        # 从请求中提取工具名称和参数
        tool_name = request_data.get('name')
        tool_input = request_data.get('input', {})
        tool_use_id = request_data.get('id', 'unknown_id')

        if not tool_name:
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": "缺少工具名称"
            }

        # 工具函数映射
        tool_map = {
            "list_knowledge_bases": list_knowledge_bases,
            "query_knowledge": query_knowledge,
        }

        tool_function = tool_map.get(tool_name)
        if not tool_function:
            return {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": True,
                "error": f"未找到工具: {tool_name}"
            }

        # 直接同步调用工具函数（内部全是同步 ORM 操作）
        result = tool_function(**tool_input)

        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": json.dumps(result, ensure_ascii=False, indent=2)
        }

    except Exception as e:
        logger.error(f"处理MCP请求失败: {str(e)}")
        return {
            "type": "tool_result",
            "tool_use_id": request_data.get('id', 'unknown_id'),
            "is_error": True,
            "error": f"处理请求失败: {str(e)}"
        }

if __name__ == "__main__":
    # 作为独立服务器运行
    import uvicorn
    
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger.info("启动知识库MCP服务器...")
    
    # 运行服务器
    try:
        mcp.run()
    except KeyboardInterrupt:
        logger.info("服务器已停止")
    except Exception as e:
        logger.error(f"服务器运行失败: {e}")
        sys.exit(1)
