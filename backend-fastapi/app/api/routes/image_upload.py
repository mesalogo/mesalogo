"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: image_upload.py
"""
import logging
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

from app.services.conversation.image_processor import image_processor

logger = logging.getLogger(__name__)

router = APIRouter()


def _secure_filename(filename: str) -> str:
    """简单的安全文件名处理（替代 werkzeug.utils.secure_filename）"""
    # 只保留字母、数字、点、连字符、下划线
    filename = re.sub(r'[^\w.\-]', '_', filename)
    return filename.strip('._') or 'unnamed'


def _create_error_response(message: str, status_code: int = 400):
    """创建统一的错误响应"""
    return JSONResponse(content={
        'success': False,
        'message': message
    }, status_code=status_code)

def _create_success_response(data=None, message='操作成功'):
    """创建统一的成功响应"""
    response = {'success': True, 'message': message}
    if data is not None:
        response['data'] = data
    return JSONResponse(content=response, status_code=200)

@router.post('/images/upload')
async def upload_image(file: UploadFile = File(...)):
    """
    上传图像文件

    Returns:
        JSON响应包含Base64编码的图像数据和图像信息
    """
    try:
        # 检查文件名
        if not file.filename:
            return _create_error_response('没有选择文件')

        # 读取文件数据
        file_data = await file.read()

        # 验证图像（ImageProcessor内部已包含格式检查）
        is_valid, error_msg = image_processor.validate_image(file_data)
        if not is_valid:
            return _create_error_response(f'图像验证失败: {error_msg}')

        # 获取图像信息
        image_info = image_processor.get_image_info(file_data)

        # 编码为Base64
        base64_data = image_processor.encode_to_base64(file_data, include_prefix=True)

        # 返回结果
        return _create_success_response({
            'filename': _secure_filename(file.filename),
            'base64': base64_data,
            'info': image_info
        }, '图像上传成功')

    except Exception as e:
        logger.error(f"图像上传失败: {e}")
        return _create_error_response(f'图像上传失败: {str(e)}', 500)



@router.post('/images/process')
async def process_image(request: Request):
    """
    处理图像 - 统一的图像处理端点

    支持的操作：
    - validate: 验证图像
    - info: 获取图像信息
    - resize: 调整图像大小
    - upload: 上传并处理图像

    Returns:
        JSON响应包含处理结果
    """
    try:
        content_type = request.headers.get('content-type', '')
        if 'application/json' not in content_type:
            return _create_error_response('请求必须为JSON格式')

        json_data = await request.json()
        operation = json_data.get('operation', 'info')
        base64_str = json_data.get('base64', '')

        if not base64_str:
            return _create_error_response('没有提供Base64图像数据')

        # 解码Base64数据
        try:
            file_data = image_processor.decode_from_base64(base64_str)
        except Exception as e:
            return _create_error_response(f'Base64解码失败: {str(e)}')

        # 验证图像
        is_valid, error_msg = image_processor.validate_image(file_data)
        if not is_valid:
            return _create_error_response(f'图像无效: {error_msg}')

        # 根据操作类型处理
        if operation == 'validate':
            return _create_success_response({'valid': True}, '图像验证通过')

        elif operation == 'info':
            image_info = image_processor.get_image_info(file_data)
            return _create_success_response(image_info, '获取图像信息成功')

        elif operation == 'resize':
            max_width = json_data.get('max_width', 1024)
            max_height = json_data.get('max_height', 1024)
            quality = json_data.get('quality', 85)

            resized_data = image_processor.resize_image(file_data, (max_width, max_height), quality)
            resized_base64 = image_processor.encode_to_base64(resized_data, include_prefix=True)
            resized_info = image_processor.get_image_info(resized_data)

            return _create_success_response({
                'base64': resized_base64,
                'info': resized_info
            }, '图像调整成功')

        else:
            return _create_error_response(f'不支持的操作: {operation}')

    except Exception as e:
        logger.error(f"图像处理失败: {e}")
        return _create_error_response(f'图像处理失败: {str(e)}', 500)

@router.get('/images/formats')
def get_supported_formats():
    """
    获取支持的图像格式和限制

    Returns:
        JSON响应包含支持的格式列表和限制信息
    """
    # 构建用户友好的格式列表，包含常见的文件扩展名
    formats = []
    for format_key in image_processor.SUPPORTED_FORMATS.keys():
        if format_key == 'jpeg':
            formats.extend(['jpg', 'jpeg'])  # JPEG格式支持两种扩展名
        else:
            formats.append(format_key)

    return _create_success_response({
        'formats': formats,
        'max_size': image_processor.max_size,
        'max_dimension': image_processor.max_dimension,
        'max_size_mb': round(image_processor.max_size / 1024 / 1024, 1)
    }, '获取格式信息成功')

