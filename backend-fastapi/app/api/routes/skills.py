"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: skills.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: skills.py
# ============================================================

"""
技能管理 API 路由
"""
import io
import logging

from app.models import db, Skill, RoleSkill
from app.services.skill_service import SkillService
from app.services.user_permission_service import UserPermissionService

logger = logging.getLogger(__name__)
skill_service = SkillService()


# ── 技能 CRUD ──

@router.get('/skills')
def list_skills(current_user=Depends(get_current_user)):
    try:
        skills = skill_service.list_skills(current_user)
        return JSONResponse(content={'status': 'success', 'data': skills}, status_code=200)
    except Exception as e:
        logger.error(f"获取技能列表失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.post('/skills')
async def create_skill(request: Request, current_user=Depends(get_current_user)):
    try:
        data = await request.json()
        data['created_by'] = current_user.id if current_user else None
        result = skill_service.create_skill(data)
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=201)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'status': 'error', 'message': str(e)})
    except Exception as e:
        logger.error(f"创建技能失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.get('/skills/{name}')
def get_skill(name):
    try:
        result = skill_service.get_skill(name)
        if not result:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '技能不存在'})
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except Exception as e:
        logger.error(f"获取技能详情失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.put('/skills/{name}')
async def update_skill(name, request: Request):
    try:
        data = await request.json()
        result = skill_service.update_skill(name, data)
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'status': 'error', 'message': str(e)})
    except Exception as e:
        logger.error(f"更新技能失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.delete('/skills/{name}')
def delete_skill(name):
    try:
        skill_service.delete_skill(name)
        return JSONResponse(content={'status': 'success', 'message': '删除成功'}, status_code=200)
    except Exception as e:
        logger.error(f"删除技能失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


# ── SKILL.md 内容 ──

@router.get('/skills/{name}/content')
def get_skill_content(name):
    try:
        content = skill_service.get_skill_content(name)
        if content is None:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': 'SKILL.md 不存在'})
        return JSONResponse(content={'status': 'success', 'data': {'content': content}}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.put('/skills/{name}/content')
async def update_skill_content(name, request: Request):
    try:
        data = await request.json()
        content = data.get('content', '')
        skill_service.update_skill_content(name, content)
        return JSONResponse(content={'status': 'success'}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


# ── 脚本管理 ──

@router.get('/skills/{name}/scripts')
def list_scripts(name):
    try:
        scripts = skill_service.list_scripts(name)
        return JSONResponse(content={'status': 'success', 'data': scripts}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.get('/skills/{name}/scripts/{script_path:path}')
def get_script(name, script_path):
    try:
        content = skill_service.get_script(name, script_path)
        if content is None:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '脚本不存在'})
        return JSONResponse(content={'status': 'success', 'data': {'content': content}}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.post('/skills/{name}/scripts')
async def create_script(name, request: Request):
    try:
        data = await request.json()
        script_name = data.get('name', '')
        content = data.get('content', '')
        skill_service.create_script(name, script_name, content)
        return JSONResponse(content={'status': 'success'}, status_code=201)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.put('/skills/{name}/scripts/{script_path:path}')
async def update_script(name, script_path, request: Request):
    try:
        data = await request.json()
        content = data.get('content', '')
        skill_service.update_script(name, script_path, content)
        return JSONResponse(content={'status': 'success'}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.delete('/skills/{name}/scripts/{script_path:path}')
def delete_script(name, script_path):
    try:
        skill_service.delete_script(name, script_path)
        return JSONResponse(content={'status': 'success'}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


# ── 参考资料管理 ──

@router.get('/skills/{name}/references')
def list_references(name):
    try:
        refs = skill_service.list_references(name)
        return JSONResponse(content={'status': 'success', 'data': refs}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.get('/skills/{name}/references/{ref_path:path}')
def get_reference(name, ref_path):
    try:
        content = skill_service.get_reference(name, ref_path)
        if content is None:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '参考资料不存在'})
        return JSONResponse(content={'status': 'success', 'data': {'content': content}}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.put('/skills/{name}/references/{ref_path:path}')
async def update_reference(name, ref_path, request: Request):
    try:
        data = await request.json()
        content = data.get('content', '')
        skill_service.update_reference(name, ref_path, content)
        return JSONResponse(content={'status': 'success'}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


# ── 资源管理 ──

@router.get('/skills/{name}/assets')
def list_assets(name):
    try:
        assets = skill_service.list_assets(name)
        return JSONResponse(content={'status': 'success', 'data': assets}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.post('/skills/{name}/assets')
async def upload_asset(name, file: UploadFile = File(...)):
    try:
        file_data = await file.read()
        skill_service.save_asset(name, file.filename, file_data)
        return JSONResponse(content={'status': 'success'}, status_code=201)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


# ── 导入导出 ──

@router.post('/skills/import/preview')
async def import_preview(file: UploadFile = File(...)):
    try:
        zip_data = await file.read()
        result = skill_service.import_preview(zip_data)
        if not result.get('success'):
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': result.get('error', '预览失败')})
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except Exception as e:
        logger.error(f"导入预览失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.post('/skills/import/confirm')
async def import_confirm(file: UploadFile = File(...), preview: str = Form('{}')):
    try:
        zip_data = await file.read()
        import json
        preview_obj = json.loads(preview)
        result = skill_service.import_confirm(zip_data, preview_obj)
        if not result.get('success'):
            raise HTTPException(status_code=400, detail={'status': 'error', 'message': result.get('error', '导入失败')})
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except Exception as e:
        logger.error(f"导入确认失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.get('/skills/{name}/export')
def export_skill(name):
    try:
        zip_bytes = skill_service.export_skill(name)
        if not zip_bytes:
            raise HTTPException(status_code=404, detail={'status': 'error', 'message': '技能不存在'})
        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type='application/zip',
            headers={'Content-Disposition': f'attachment; filename="{name}.zip"'}
        )
    except Exception as e:
        logger.error(f"导出技能失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


# ── 文件系统同步 ──

@router.post('/skills/sync')
def sync_filesystem():
    """扫描 backend/skills/ 目录，将文件系统中的技能同步到数据库"""
    try:
        result = skill_service.sync_filesystem_to_db()
        return JSONResponse(content={'status': 'success', 'data': result}, status_code=200)
    except Exception as e:
        logger.error(f"同步文件系统失败: {e}")
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


# ── 角色绑定 ──


@router.get('/roles/{role_id}/skills')
def get_role_skills(role_id):
    try:
        skills = skill_service.get_role_skills(role_id)
        return JSONResponse(content={'status': 'success', 'data': skills}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.post('/roles/{role_id}/skills')
async def bind_role_skills(role_id, request: Request):
    try:
        data = await request.json()
        skill_ids = data.get('skill_ids', [])
        skill_service.bind_role_skills(role_id, skill_ids)
        return JSONResponse(content={'status': 'success'}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})


@router.delete('/roles/{role_id}/skills/{skill_id}')
def unbind_role_skill(role_id, skill_id):
    try:
        skill_service.unbind_role_skill(role_id, skill_id)
        return JSONResponse(content={'status': 'success'}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail={'status': 'error', 'message': str(e)})

