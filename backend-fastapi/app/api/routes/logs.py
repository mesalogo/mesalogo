"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: logs.py
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
# Source: logs.py
# ============================================================

"""
日志文件API路由

处理与系统日志文件相关的所有API请求
"""
import os
import logging

# 创建Blueprint

# 设置日志
logger = logging.getLogger(__name__)

def read_with_fallback_encoding(file_path, mode='r'):
    """
    使用多种编码尝试读取文件

    Args:
        file_path: 文件路径
        mode: 文件打开模式

    Returns:
        tuple: (文件对象, 使用的编码)
    """
    encodings = ['utf-8', 'gbk', 'gb2312', 'latin-1']
    for encoding in encodings:
        try:
            f = open(file_path, mode, encoding=encoding, errors='replace')
            return f, encoding
        except UnicodeDecodeError:
            continue
        except Exception:
            continue
    # 如果所有编码都失败，使用utf-8并忽略错误
    return open(file_path, mode, encoding='utf-8', errors='ignore'), 'utf-8'

@router.get('/logs')
def get_logs(request: Request):
    """获取系统日志文件内容"""
    try:
        # 获取查询参数
        max_lines = int(request.query_params.get('max_lines', '1000'))
        start_line = int(request.query_params.get('start_line', '0'))
        
        # 日志文件路径
        log_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'logs', 'app.log')
        
        # 检查文件是否存在
        if not os.path.exists(log_file_path):
            raise HTTPException(status_code=404, detail={
                'status': 'error',
                'message': '日志文件不存在'
            })
        
        # 获取文件大小
        file_size = os.path.getsize(log_file_path)
        
        # 读取日志文件内容
        lines = []
        total_lines = 0
        
        with read_with_fallback_encoding(log_file_path)[0] as f:
            # 如果需要跳过前面的行
            if start_line > 0:
                for _ in range(start_line):
                    next(f, None)

            # 读取指定行数
            for i, line in enumerate(f):
                if i >= max_lines:
                    break
                lines.append(line.rstrip())
                total_lines += 1

        # 获取文件总行数
        with read_with_fallback_encoding(log_file_path)[0] as f:
            all_lines_count = sum(1 for _ in f)
        
        return {
            'status': 'success',
            'data': {
                'file_path': log_file_path,
                'file_size': file_size,
                'total_lines': all_lines_count,
                'start_line': start_line,
                'lines_count': total_lines,
                'content': lines
            }
        }
    
    except Exception as e:
        logger.error(f"获取日志文件内容失败: {str(e)}")
        return JSONResponse(content={
            'status': 'error',
            'message': f'获取日志文件内容失败: {str(e)}'
        }, status_code=500)

@router.get('/logs/tail')
def tail_logs(request: Request):
    """获取日志文件的最后几行"""
    try:
        # 获取查询参数
        lines_count = int(request.query_params.get('lines', '100'))
        
        # 日志文件路径
        log_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'logs', 'app.log')
        
        # 检查文件是否存在
        if not os.path.exists(log_file_path):
            raise HTTPException(status_code=404, detail={
                'status': 'error',
                'message': '日志文件不存在'
            })
        
        # 获取文件大小
        file_size = os.path.getsize(log_file_path)
        
        # 高效读取文件最后几行（从文件末尾向前读取，避免遍历整个文件）
        lines = []
        try:
            with open(log_file_path, 'rb') as f:
                # 从文件末尾向前搜索
                f.seek(0, 2)  # 移到文件末尾
                end_pos = f.tell()
                
                # 每次读取 8KB 块
                block_size = 8192
                blocks = []
                remaining = end_pos
                found_lines = 0
                
                while remaining > 0 and found_lines <= lines_count:
                    read_size = min(block_size, remaining)
                    remaining -= read_size
                    f.seek(remaining)
                    block = f.read(read_size)
                    blocks.insert(0, block)
                    found_lines += block.count(b'\n')
                
                content = b''.join(blocks)
                all_lines = content.decode('utf-8', errors='replace').split('\n')
                
                # 取最后 lines_count 行（去除末尾可能的空行）
                if all_lines and all_lines[-1] == '':
                    all_lines = all_lines[:-1]
                lines = [line.rstrip() for line in all_lines[-lines_count:]]
        except Exception:
            # fallback: 使用 deque
            from collections import deque
            with read_with_fallback_encoding(log_file_path)[0] as f:
                lines = list(deque(f, lines_count))
                lines = [line.rstrip() for line in lines]

        all_lines_count = -1  # 跳过行数计算，避免遍历 5GB 文件
        
        return {
            'status': 'success',
            'data': {
                'file_path': log_file_path,
                'file_size': file_size,
                'total_lines': all_lines_count,
                'lines_count': len(lines),
                'content': lines
            }
        }
    
    except Exception as e:
        logger.error(f"获取日志文件尾部内容失败: {str(e)}")
        return JSONResponse(content={
            'status': 'error',
            'message': f'获取日志文件尾部内容失败: {str(e)}'
        }, status_code=500)

