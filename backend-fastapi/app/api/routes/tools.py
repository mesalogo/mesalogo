"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: tools.py
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
# Source: tools.py
# ============================================================

from app.models import Tool, RoleTool, Role
from app.extensions import db
from sqlalchemy.exc import SQLAlchemyError
import logging
import json

logger = logging.getLogger(__name__)

@router.get('/tools')
def get_tools():
    """获取所有工具列表"""
    try:
        tools = Tool.query.all()
        result = []
        for tool in tools:
            tool_data = {
                'id': tool.id,
                'name': tool.name,
                'description': tool.description,
                'type': tool.type,
                'config': tool.config,
                'settings': tool.settings,
                'created_at': tool.created_at.isoformat() if tool.created_at else None,
                'updated_at': tool.updated_at.isoformat() if tool.updated_at else None
            }
            result.append(tool_data)
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except Exception as e:
        logger.error(f"获取工具列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'获取工具列表失败: {str(e)}'})

@router.get('/tools/{tool_id}')
def get_tool(tool_id):
    """获取特定工具详情"""
    try:
        tool = Tool.query.get(tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '工具不存在'})
        
        # 获取使用该工具的角色列表
        role_tools = RoleTool.query.filter_by(tool_id=tool_id).all()
        roles = []
        for rt in role_tools:
            role = Role.query.get(rt.role_id)
            if role:
                roles.append({
                    'id': role.id,
                    'name': role.name
                })
        
        tool_data = {
            'id': tool.id,
            'name': tool.name,
            'description': tool.description,
            'type': tool.type,
            'config': tool.config,
            'settings': tool.settings,
            'roles': roles,
            'created_at': tool.created_at.isoformat() if tool.created_at else None,
            'updated_at': tool.updated_at.isoformat() if tool.updated_at else None
        }
        return JSONResponse(content={'status': 'success', 'data': tool_data}, status_code=200)
    except Exception as e:
        logger.error(f"获取工具详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'获取工具详情失败: {str(e)}'})

@router.post('/tools')
async def create_tool(request: Request):
    """创建新工具"""
    try:
        data = await request.json()
        
        # 验证必填字段
        if not data.get('name'):
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': '缺少必填字段: name'})
        
        # 检查名称是否重复
        existing = Tool.query.filter_by(name=data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': '工具名称已存在'})
        
        new_tool = Tool(
            name=data['name'],
            description=data.get('description', ''),
            type=data.get('type', ''),
            config=data.get('config', {}),
            settings=data.get('settings', {})
        )
        
        db.session.add(new_tool)
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '工具创建成功',
            'data': {
                'id': new_tool.id,
                'name': new_tool.name
            }
        }, status_code=201)
    except Exception as e:
        db.session.rollback()
        logger.error(f"创建工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'创建工具失败: {str(e)}'})

@router.put('/tools/{tool_id}')
async def update_tool(tool_id, request: Request):
    """更新工具信息"""
    try:
        tool = Tool.query.get(tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '工具不存在'})
        
        data = await request.json()
        
        # 检查名称是否重复（如果更改了名称）
        if 'name' in data and data['name'] != tool.name:
            existing = Tool.query.filter_by(name=data['name']).first()
            if existing:
                raise HTTPException(status_code=400, detail={'status': 'error', 'message': '工具名称已存在'})
            tool.name = data['name']
        
        # 更新其他字段
        if 'description' in data:
            tool.description = data['description']
        if 'type' in data:
            tool.type = data['type']
        if 'config' in data:
            tool.config = data['config']
        if 'settings' in data:
            tool.settings = data['settings']
        
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '工具更新成功',
            'data': {
                'id': tool.id,
                'name': tool.name
            }
        }, status_code=200)
    except Exception as e:
        db.session.rollback()
        logger.error(f"更新工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'更新工具失败: {str(e)}'})

@router.delete('/tools/{tool_id}')
def delete_tool(tool_id):
    """删除工具"""
    try:
        tool = Tool.query.get(tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '工具不存在'})
        
        # 删除关联的角色工具关系
        RoleTool.query.filter_by(tool_id=tool_id).delete()
        
        # 删除工具
        db.session.delete(tool)
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '工具删除成功'
        }, status_code=200)
    except Exception as e:
        db.session.rollback()
        logger.error(f"删除工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'删除工具失败: {str(e)}'})

@router.get('/roles/{role_id}/tools')
def get_role_tools(role_id):
    """获取角色的工具列表"""
    try:
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '角色不存在'})
        
        role_tools = RoleTool.query.filter_by(role_id=role_id).all()
        result = []
        
        for rt in role_tools:
            tool = Tool.query.get(rt.tool_id)
            if tool:
                tool_data = {
                    'id': tool.id,
                    'name': tool.name,
                    'description': tool.description,
                    'type': tool.type
                }
                result.append(tool_data)
        
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except Exception as e:
        logger.error(f"获取角色工具列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'获取角色工具列表失败: {str(e)}'})

@router.post('/roles/{role_id}/tools/{tool_id}')
def add_tool_to_role(role_id, tool_id):
    """为角色添加工具"""
    try:
        role = Role.query.get(role_id)
        if not role:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '角色不存在'})
        
        tool = Tool.query.get(tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '工具不存在'})
        
        # 检查是否已存在关联
        existing = RoleTool.query.filter_by(role_id=role_id, tool_id=tool_id).first()
        if existing:
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': '角色已拥有该工具'})
        
        # 创建关联
        role_tool = RoleTool(role_id=role_id, tool_id=tool_id)
        db.session.add(role_tool)
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '工具添加成功'
        }, status_code=201)
    except Exception as e:
        db.session.rollback()
        logger.error(f"为角色添加工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'为角色添加工具失败: {str(e)}'})

@router.delete('/roles/{role_id}/tools/{tool_id}')
def remove_tool_from_role(role_id, tool_id):
    """从角色移除工具"""
    try:
        role_tool = RoleTool.query.filter_by(role_id=role_id, tool_id=tool_id).first()
        if not role_tool:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '角色未拥有该工具'})
        
        db.session.delete(role_tool)
        db.session.commit()
        
        return JSONResponse(content={
            'status': 'success',
            'message': '工具移除成功'
        }, status_code=200)
    except Exception as e:
        db.session.rollback()
        logger.error(f"从角色移除工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'从角色移除工具失败: {str(e)}'})

@router.post('/tools/{tool_id}/execute')
async def execute_tool(tool_id, request: Request):
    """执行工具"""
    try:
        tool = Tool.query.get(tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '工具不存在'})
        
        data = await request.json()
        if not data:
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': '缺少执行参数'})
        
        # 这里应该根据工具类型实现真正的工具执行逻辑
        # 当前只返回模拟结果
        
        # 简单模拟工具执行结果
        result = {
            'status': 'success',
            'message': f'工具 {tool.name} 执行成功',
            'data': {
                'tool_id': tool.id,
                'tool_name': tool.name,
                'tool_type': tool.type,
                'input_params': data,
                'result': f"工具 {tool.name} 的执行结果",
                'execution_time': '0.5s'
            }
        }
        
        return JSONResponse(content=result, status_code=200)
    except Exception as e:
        logger.error(f"执行工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': f'执行工具失败: {str(e)}'})
