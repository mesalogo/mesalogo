"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: document_parser.py
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
# Source: document_parser.py
# ============================================================

"""
文档解析器API路由
提供文档解析器相关的API接口
"""

from app.utils.document_parser_test import test_parser
from app.utils.document_parser_config import (
    get_active_document_parser,
    get_supported_formats,
    DOCUMENT_PARSERS_META
)

# 创建Blueprint


@router.post('/document-parser/test')
async def test_document_parser(request: Request):
    """
    测试文档解析器
    
    Request Body:
        {
            "parser_name": "mineru"  // 可选，默认使用当前配置的解析器
        }
    
    Response:
        {
            "success": true,
            "data": {
                "parser_name": "mineru",
                "duration": 3.2,
                "message": "测试成功",
                "details": {
                    "execution_time": 3.1,
                    "output_files": 5,
                    "output_size": 102400,
                    "markdown_files": 1
                },
                "output_preview": "# 文档标题\n\n内容预览..."
            }
        }
    
    Error Response:
        {
            "success": false,
            "message": "测试失败: 可执行文件不存在"
        }
    """
    try:
        data = await request.json() or {}
        parser_name = data.get('parser_name', None)
        
        logger.info(f"收到文档解析器测试请求: parser_name={parser_name}")
        
        # 执行测试
        result = test_parser(parser_name)
        
        # 返回结果
        if result['success']:
            return {
                'success': True,
                'data': result
            }
        else:
            raise HTTPException(status_code=400, detail={
                'success': False,
                'message': result['message'],
                'data': result
            })
        
    except Exception as e:
        logger.error(f"测试文档解析器失败: {e}", exc_info=True)
        return JSONResponse(content={
            'success': False,
            'message': f'测试失败: {str(e)}'
        }, status_code=500)


@router.get('/document-parser/info')
def get_document_parser_info():
    """
    获取文档解析器信息
    
    Response:
        {
            "success": true,
            "data": {
                "active_parser": "mineru",
                "supported_formats": [".pdf", ".docx", ...],
                "parsers": {
                    "mineru": {
                        "name": "mineru",
                        "display_name": "MinerU",
                        "description": "...",
                        "status": "available",
                        "supported_formats": [...]
                    },
                    ...
                }
            }
        }
    """
    try:
        active_parser = get_active_document_parser()
        supported_formats = get_supported_formats()
        
        return {
            'success': True,
            'data': {
                'active_parser': active_parser,
                'supported_formats': supported_formats,
                'parsers': DOCUMENT_PARSERS_META
            }
        }
        
    except Exception as e:
        logger.error(f"获取文档解析器信息失败: {e}", exc_info=True)
        return JSONResponse(content={
            'success': False,
            'message': f'获取信息失败: {str(e)}'
        }, status_code=500)


