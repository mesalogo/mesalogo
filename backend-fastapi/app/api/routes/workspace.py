"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: workspace.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: workspace.py
# ============================================================

"""
项目空间API路由

处理与项目空间文件相关的所有API请求，包括项目空间管理功能
"""
import os
from app.services.workspace_service import workspace_service
from app.models import ActionTask, ActionTaskAgent, Agent

import logging
logger = logging.getLogger(__name__)

# 创建Blueprint


def _list_directory_contents(current_dir, current_path_prefix, sub_path=''):
    """
    辅助函数：列出目录内容

    Args:
        current_dir: 完整的目录路径
        current_path_prefix: 路径前缀（用于构建file_path）
        sub_path: 子路径（用于返回结果）

    Returns:
        dict: 包含items和current_path的字典
    """
    # 检查目录是否存在
    if not os.path.exists(current_dir):
        raise FileNotFoundError(f'目录不存在: {current_path_prefix}')

    # 标准文件浏览器实现 - 只返回当前目录的直接子项
    items = []
    try:
        for item in os.listdir(current_dir):
            item_path = os.path.join(current_dir, item)

            # 跳过隐藏文件
            if item.startswith('.'):
                continue

            if os.path.isfile(item_path):
                # 文件
                items.append({
                    'file_name': item,
                    'file_path': f'{current_path_prefix}/{item}',
                    'is_directory': False,
                    'size': os.path.getsize(item_path),
                    'modified_time': os.path.getmtime(item_path)
                })
            elif os.path.isdir(item_path):
                # 目录
                items.append({
                    'file_name': item,
                    'file_path': f'{current_path_prefix}/{item}',
                    'is_directory': True,
                    'size': 0,
                    'modified_time': os.path.getmtime(item_path)
                })
    except PermissionError:
        raise PermissionError(f'没有权限访问目录: {current_path_prefix}')
    except Exception as e:
        raise Exception(f'读取目录失败: {str(e)}')

    # 对items进行排序：目录在前，文件在后，同类型按名称排序
    items.sort(key=lambda x: (not x['is_directory'], x['file_name'].lower()))

    # 构建结果
    return {
        'items': items,
        'current_path': sub_path
    }

@router.get('/action-tasks/{task_id}/workspace-files')
@router.get('/action-tasks/{task_id}/workspace-files/{sub_path:path}')
def get_workspace_files(task_id, sub_path=''):
    """获取行动任务的所有项目文件列表，支持子目录浏览"""
    try:
        # 首先验证任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': f'行动任务 {task_id} 不存在'})

        # 纯粹的文件浏览器，不需要验证智能体权限

        # 获取项目空间目录路径
        task_dir = os.path.join(workspace_service.workspace_dir, f'ActionTask-{task_id}')

        # 如果有子路径，则进入子目录
        if sub_path:
            current_dir = os.path.join(task_dir, sub_path)
            current_path_prefix = f'ActionTask-{task_id}/{sub_path}'
        else:
            current_dir = task_dir
            current_path_prefix = f'ActionTask-{task_id}'

        # 使用辅助函数列出目录内容
        try:
            result = _list_directory_contents(current_dir, current_path_prefix, sub_path)
            return result
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail={'error': str(e)})
        except PermissionError as e:
            raise HTTPException(status_code=403, detail={'error': str(e)})
        except Exception as e:
            raise HTTPException(status_code=500, detail={'error': str(e)})

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取项目文件列表失败: {str(e)}'})

@router.get('/workspace-files/{file_path:path}')
def get_workspace_file_content(file_path):
    """获取项目文件内容"""
    try:
        # 构建完整的文件路径
        full_path = os.path.join(workspace_service.workspace_dir, file_path)

        # 检查文件是否存在
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail={'error': f'项目文件 {file_path} 不存在'})

        # 读取文件内容
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 构建结果
        result = {
            'file_path': file_path,
            'content': content
        }

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取项目文件内容失败: {str(e)}'})


@router.get('/workspace-root-directories')
def get_workspace_root_directories():
    """获取agent-workspace根目录下的所有目录和文件"""
    try:
        # 获取agent-workspace根目录
        workspace_root = workspace_service.workspace_dir

        if not os.path.exists(workspace_root):
            raise HTTPException(status_code=404, detail={'error': 'workspace根目录不存在'})

        items = []
        try:
            for item in os.listdir(workspace_root):
                item_path = os.path.join(workspace_root, item)

                # 跳过隐藏文件
                if item.startswith('.'):
                    continue

                if os.path.isfile(item_path):
                    # 文件
                    items.append({
                        'name': item,
                        'path': item,
                        'is_directory': False,
                        'size': os.path.getsize(item_path),
                        'modified_time': os.path.getmtime(item_path),
                        'type': 'file'
                    })
                elif os.path.isdir(item_path):
                    # 目录
                    # 判断是否是ActionTask目录
                    is_action_task = item.startswith('ActionTask-')

                    items.append({
                        'name': item,
                        'path': item,
                        'is_directory': True,
                        'size': 0,
                        'modified_time': os.path.getmtime(item_path),
                        'type': 'action_task' if is_action_task else 'custom_directory'
                    })
        except PermissionError:
            raise HTTPException(status_code=403, detail={'error': '没有权限访问workspace根目录'})
        except Exception as e:
            raise HTTPException(status_code=500, detail={'error': f'读取workspace根目录失败: {str(e)}'})

        # 对items进行排序：目录在前，文件在后，同类型按名称排序
        items.sort(key=lambda x: (not x['is_directory'], x['name'].lower()))

        # 构建结果
        result = {
            'items': items,
            'workspace_root': workspace_root
        }

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取workspace根目录失败: {str(e)}'})


@router.get('/workspace-directory/{dir_path:path}')
@router.get('/workspace-directory/{dir_path:path}/{sub_path:path}')
def get_workspace_directory_files(dir_path, sub_path=''):
    """获取workspace中任意目录的文件列表，支持子目录浏览"""
    try:
        # 构建完整的目录路径
        if sub_path:
            current_dir = os.path.join(workspace_service.workspace_dir, dir_path, sub_path)
            current_path_prefix = f'{dir_path}/{sub_path}'
        else:
            current_dir = os.path.join(workspace_service.workspace_dir, dir_path)
            current_path_prefix = dir_path

        # 检查是否在workspace目录范围内
        workspace_root = os.path.abspath(workspace_service.workspace_dir)
        current_dir_abs = os.path.abspath(current_dir)
        if not current_dir_abs.startswith(workspace_root):
            raise HTTPException(status_code=403, detail={'error': '访问被拒绝：超出workspace范围'})

        # 使用辅助函数列出目录内容
        try:
            result = _list_directory_contents(current_dir, current_path_prefix, sub_path)
            # 添加directory_path字段
            result['directory_path'] = dir_path
            return result
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail={'error': str(e)})
        except PermissionError as e:
            raise HTTPException(status_code=403, detail={'error': str(e)})
        except Exception as e:
            raise HTTPException(status_code=500, detail={'error': str(e)})

    except Exception as e:
        raise HTTPException(status_code=500, detail={'error': f'获取目录文件列表失败: {str(e)}'})


# ==================== 项目空间管理API ====================
# 以下是专门为项目空间管理页面提供的优化API接口

@router.get('/workspace-management/tasks-with-agents')
def get_tasks_with_agents_for_workspace():
    """
    获取所有行动任务及其智能体信息，专门用于项目空间管理页面
    优化版本，减少API请求次数
    """
    try:
        # 获取所有行动任务
        action_tasks = ActionTask.query.all()
        result = []

        for task in action_tasks:
            # 获取任务的智能体
            task_agents = ActionTaskAgent.query.filter_by(action_task_id=task.id).all()
            agents = []

            for ta in task_agents:
                agent = Agent.query.get(ta.agent_id)
                if agent:
                    agents.append({
                        'id': agent.id,
                        'name': agent.name,
                        'description': agent.description,
                        'avatar': agent.avatar,
                        'is_default': ta.is_default,
                        'is_observer': agent.is_observer,
                        'type': agent.type
                    })

            # 检查是否有项目文件
            has_shared_files = False
            agent_workspace_count = 0

            try:
                workspace_files = workspace_service.get_workspace_files_for_task(task.id)
                has_shared_files = len(workspace_files.get('shared_files', [])) > 0
                agent_workspace_count = len(workspace_files.get('agent_workspaces', []))
            except Exception as e:
                logger.error(f"获取任务 {task.id} 项目文件失败: {e}")

            task_data = {
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'status': task.status,
                'mode': task.mode,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None,
                'agents': agents,
                'agent_count': len(agents),
                'has_shared_workspace': has_shared_files,
                'agent_workspace_count': agent_workspace_count
            }

            result.append(task_data)

        return {
            'success': True,
            'tasks': result,
            'total_count': len(result)
        }

    except Exception as e:
        logger.error(f"获取任务和智能体信息失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'获取任务和智能体信息失败: {str(e)}'
        }, status_code=500)

@router.get('/workspace-management/task/{task_id}/workspaces')
def get_task_workspaces(task_id):
    """
    获取指定任务的所有项目空间信息
    包括共享工作区和所有智能体的工作区
    """
    try:
        # 验证任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={
                'success': False,
                'error': '行动任务未找到'
            })

        # 获取项目文件
        workspace_files = workspace_service.get_workspace_files_for_task(task_id)

        # 获取任务的智能体信息
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task_id).all()
        agents_info = {}

        for ta in task_agents:
            agent = Agent.query.get(ta.agent_id)
            if agent:
                agents_info[agent.id] = {
                    'id': agent.id,
                    'name': agent.name,
                    'description': agent.description,
                    'avatar': agent.avatar,
                    'is_default': ta.is_default,
                    'is_observer': agent.is_observer,
                    'type': agent.type
                }

        # 组织返回数据
        result = {
            'task_id': task_id,
            'task_title': task.title,
            'shared_files': workspace_files.get('shared_files', []),
            'agent_workspaces': workspace_files.get('agent_workspaces', []),
            'agents_info': agents_info
        }

        return {
            'success': True,
            'data': result
        }

    except Exception as e:
        logger.error(f"获取任务 {task_id} 项目空间信息失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'获取项目空间信息失败: {str(e)}'
        }, status_code=500)

@router.get('/workspace-management/workspace-file/{file_path:path}')
def get_workspace_file_content_v2(file_path):
    """
    获取项目文件内容（项目空间管理版本）
    对于PDF等二进制文件，返回预览URL供前端在新标签页打开
    """
    try:
        # 检查文件扩展名
        _, ext = os.path.splitext(file_path.lower())
        
        # 可预览但不支持文本读取的文件类型
        preview_extensions = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'}
        
        if ext in preview_extensions:
            # 构建完整路径检查文件是否存在
            full_path = os.path.join(workspace_service.workspace_dir, file_path)
            if not os.path.exists(full_path):
                return JSONResponse(content={
                    'success': False,
                    'error': f'文件不存在: {file_path}'
                }, status_code=404)
            
            # 返回预览模式响应，前端可以用download端点获取blob后在新标签页打开
            return {
                'success': True,
                'preview_mode': True,
                'file_path': file_path,
                'file_type': ext[1:],  # 去掉点号
                'download_url': f'/api/workspace-management/workspace-file/{file_path}/download'
            }
        
        # 文本文件正常读取内容
        content = workspace_service.get_workspace_file_content(file_path)
        return {
            'success': True,
            'content': content,
            'file_path': file_path
        }
    except Exception as e:
        logger.error(f"获取项目文件内容失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'获取项目文件内容失败: {str(e)}'
        }, status_code=500)


@router.get('/workspace-management/workspace-file/{file_path:path}/download')
def download_workspace_file(file_path):
    """
    下载项目文件（直接返回文件，支持二进制文件）
    """
    try:

        # 构建完整的文件路径
        full_path = os.path.join(workspace_service.workspace_dir, file_path)

        # 检查文件是否存在
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail={'error': f'项目文件 {file_path} 不存在'})

        # 检查是否在workspace目录范围内（安全检查）
        workspace_root = os.path.abspath(workspace_service.workspace_dir)
        full_path_abs = os.path.abspath(full_path)
        if not full_path_abs.startswith(workspace_root):
            raise HTTPException(status_code=403, detail={'error': '访问被拒绝：超出workspace范围'})

        # 获取文件名
        filename = os.path.basename(file_path)

        # 直接返回文件
        return FileResponse(full_path, filename=filename, media_type='application/octet-stream')

    except Exception as e:
        logger.error(f"下载项目文件失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'下载项目文件失败: {str(e)}'
        }, status_code=500)


@router.put('/workspace-management/workspace-file/{file_path:path}')
async def update_workspace_file_content(file_path, request: Request):
    """
    更新项目文件内容
    """
    try:
        data = await request.json()
        content = data.get('content', '')

        # 更新文件内容
        workspace_service.update_workspace_file_content(file_path, content)

        return {
            'success': True,
            'message': '项目文件更新成功',
            'file_path': file_path
        }
    except Exception as e:
        logger.error(f"更新项目文件内容失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'更新项目文件内容失败: {str(e)}'
        }, status_code=500)

@router.post('/workspace-management/workspace-file')
async def create_workspace_file(request: Request):
    """
    创建新的项目文件
    """
    try:
        data = await request.json()
        task_id = data.get('task_id')
        agent_id = data.get('agent_id')  # 可选，如果是共享工作区则为None
        title = data.get('title', '未命名记忆')
        content = data.get('content', '')
        memory_type = data.get('type', 'agent')  # 'agent' 或 'shared'

        # 创建项目文件
        file_path = workspace_service.create_workspace_file(
            task_id=task_id,
            agent_id=agent_id,
            title=title,
            content=content,
            file_type=memory_type
        )

        return {
            'success': True,
            'message': '项目文件创建成功',
            'file_path': file_path
        }
    except Exception as e:
        logger.error(f"创建项目文件失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'创建项目文件失败: {str(e)}'
        }, status_code=500)

@router.delete('/workspace-management/workspace-file/{file_path:path}')
def delete_workspace_file(file_path):
    """
    删除项目文件
    """
    try:
        workspace_service.delete_workspace_file(file_path)

        return {
            'success': True,
            'message': '记忆文件删除成功',
            'file_path': file_path
        }
    except Exception as e:
        logger.error(f"删除记忆文件失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'删除项目文件失败: {str(e)}'
        }, status_code=500)

@router.post('/action-tasks/{task_id}/workspace-files/upload')
@router.post('/action-tasks/{task_id}/workspace-files/{sub_path:path}/upload')
async def upload_workspace_file(task_id, file: UploadFile = File(...), sub_path=''):
    """
    上传文件到工作空间目录
    """
    try:
        # 首先验证任务是否存在
        task = ActionTask.query.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail={'error': f'行动任务 {task_id} 不存在'})

        # 检查文件名
        if not file.filename or file.filename == '':
            raise HTTPException(status_code=400, detail={
                'success': False,
                'error': '未选择文件'
            })

        # 读取文件内容并创建一个兼容 .save() 的包装对象
        file_content = await file.read()

        class _FileWrapper:
            """Wrapper to provide Flask-like .save() for UploadFile content"""
            def __init__(self, content, fname):
                self.filename = fname
                self._content = content
            def save(self, path):
                with open(path, 'wb') as f:
                    f.write(self._content)

        file_wrapper = _FileWrapper(file_content, file.filename)

        # 上传文件
        file_path = workspace_service.upload_workspace_file(
            task_id=task_id,
            sub_path=sub_path,
            file_obj=file_wrapper,
            filename=file.filename
        )

        # 上传成功后更新项目索引
        try:
            workspace_service.update_project_index_if_needed(task_id)
        except Exception as e:
            logger.error(f"更新项目索引失败: {e}")
            # 不影响上传结果，只记录错误

        return {
            'success': True,
            'message': '文件上传成功',
            'file_path': file_path,
            'filename': file.filename
        }

    except Exception as e:
        logger.error(f"上传文件失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'上传文件失败: {str(e)}'
        }, status_code=500)

@router.post('/workspace-management/workspace-template')
async def create_workspace_template(request: Request):
    """
    从项目文件创建模板
    """
    try:
        data = await request.json()
        source_file_path = data.get('source_file_path')
        template_name = data.get('template_name')
        template_description = data.get('template_description', '')

        # 创建模板
        template_path = workspace_service.create_workspace_template(
            source_file_path=source_file_path,
            template_name=template_name,
            template_description=template_description
        )

        return {
            'success': True,
            'message': '工作空间模板创建成功',
            'template_path': template_path
        }
    except Exception as e:
        logger.error(f"创建工作空间模板失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'创建工作空间模板失败: {str(e)}'
        }, status_code=500)

@router.get('/workspace-management/workspace-templates')
def get_workspace_templates():
    """
    获取工作空间模板列表
    """
    try:
        templates = workspace_service.get_workspace_templates()
        return {
            'success': True,
            'templates': templates
        }
    except Exception as e:
        logger.error(f"获取记忆模板列表失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'获取工作空间模板列表失败: {str(e)}'
        }, status_code=500)

@router.put('/workspace-management/workspace-template/{template_id}')
async def update_workspace_template(template_id, request: Request):
    """
    更新工作空间模板
    """
    try:
        data = await request.json()
        template_name = data.get('name')
        template_content = data.get('content')
        template_description = data.get('description', '')
        template_category = data.get('category', 'agent')

        # 更新模板
        updated_template = workspace_service.update_workspace_template(
            template_id=template_id,
            template_name=template_name,
            template_content=template_content,
            template_description=template_description,
            template_category=template_category
        )

        return {
            'success': True,
            'message': '记忆模板更新成功',
            'template': updated_template
        }
    except Exception as e:
        logger.error(f"更新工作空间模板失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'更新工作空间模板失败: {str(e)}'
        }, status_code=500)

@router.delete('/workspace-management/workspace-template/{template_id}')
def delete_workspace_template(template_id):
    """
    删除工作空间模板
    """
    try:
        workspace_service.delete_workspace_template(template_id)

        return {
            'success': True,
            'message': '工作空间模板删除成功'
        }
    except Exception as e:
        logger.error(f"删除工作空间模板失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'删除工作空间模板失败: {str(e)}'
        }, status_code=500)

@router.post('/workspace-management/workspace-template/new')
async def create_new_workspace_template(request: Request):
    """
    创建新的工作空间模板
    """
    try:
        data = await request.json()
        template_name = data.get('name')
        template_content = data.get('content')
        template_description = data.get('description', '')
        template_category = data.get('category', 'agent')

        if not template_name:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'error': '模板名称不能为空'
            })

        if not template_content:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'error': '模板内容不能为空'
            })

        # 创建新模板
        template = workspace_service.create_new_workspace_template(
            template_name=template_name,
            template_content=template_content,
            template_description=template_description,
            template_category=template_category
        )

        return {
            'success': True,
            'message': '工作空间模板创建成功',
            'template': template
        }
    except Exception as e:
        logger.error(f"创建新工作空间模板失败: {e}")
        return JSONResponse(content={
            'success': False,
            'error': f'创建新工作空间模板失败: {str(e)}'
        }, status_code=500)

