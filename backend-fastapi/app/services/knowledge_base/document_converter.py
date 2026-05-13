"""
文档转换服务
使用配置的文档解析器将文件转换为 Markdown 格式
"""

import os
import logging
import subprocess
import threading
from datetime import datetime
from core.config import settings

logger = logging.getLogger(__name__)

from app.models import KnowledgeFileConversion, db
from app.utils.document_parser_config import (
    get_active_document_parser,
    get_mineru_config,
    get_paddleocr_vl_config,
    build_mineru_command,
    build_paddleocr_vl_command,
    merge_paddleocr_markdown_files
)
from app.services.knowledge_base.pdf_converter import (
    is_office_format,
    convert_office_to_pdf,
    cleanup_temp_pdf
)
def convert_file(knowledge_id, file_path):
    """
    转换文件为 Markdown
    
    Args:
        knowledge_id: 知识库ID
        file_path: 文件路径（相对于知识库目录）
    
    Returns:
        (success, result): 成功标志和结果字典
    """
    temp_pdf_path = None
    original_file_path = file_path
    
    try:
        # 检查是否为 Office 格式，需要先转换为 PDF
        kb_path = os.path.join(settings['KNOWLEDGEBASE_PATH'], knowledge_id)
        files_path = os.path.join(kb_path, 'files')
        full_file_path = os.path.join(files_path, file_path)
        
        if is_office_format(full_file_path):
            logger.info(f"检测到 Office 格式文件，开始转换为 PDF: {file_path}")
            
            # 转换为 PDF（PDF 会被输出到 markdown 目录结构中）
            success, result = convert_office_to_pdf(knowledge_id, file_path)
            if not success:
                return False, {'error': f'PDF 转换失败: {result}'}
            
            # result 是 PDF 的完整路径
            temp_pdf_path = result
            logger.info(f"PDF 转换成功: {temp_pdf_path}")
        
        # 获取当前启用的解析器
        parser_tool = get_active_document_parser()
        
        if parser_tool == 'mineru':
            success, result = _convert_with_mineru(knowledge_id, file_path, original_file_path, temp_pdf_path)
        elif parser_tool == 'paddleocr_vl':
            success, result = _convert_with_paddleocr_vl(knowledge_id, file_path, original_file_path, temp_pdf_path)
        else:
            success, result = False, {'error': f'未知的解析器: {parser_tool}'}
        
        # 清理临时 PDF 文件
        if temp_pdf_path:
            cleanup_temp_pdf(knowledge_id, temp_pdf_path)
        
        return success, result
            
    except Exception as e:
        logger.error(f"文件转换失败: {e}")
        
        # 确保清理临时文件
        if temp_pdf_path:
            cleanup_temp_pdf(knowledge_id, temp_pdf_path)
        
        return False, {'error': str(e)}


def _convert_with_mineru(knowledge_id, file_path, original_file_path=None, temp_pdf_path=None):
    """
    使用 MinerU 转换文件

    Args:
        knowledge_id: 知识库ID
        file_path: 文件路径（相对于知识库目录）
        original_file_path: 原始文件路径（用于输出目录命名）
        temp_pdf_path: 临时PDF的完整路径（如果从Office转换）

    Returns:
        (success, result): 成功标志和结果字典
    """
    try:
        # 获取 MinerU 配置
        config = get_mineru_config()

        # 构建路径
        kb_path = os.path.join(settings['KNOWLEDGEBASE_PATH'], knowledge_id)
        files_path = os.path.join(kb_path, 'files')
        
        # 如果有临时PDF，使用临时PDF作为输入，否则使用原始文件
        if temp_pdf_path:
            input_file = temp_pdf_path
        else:
            input_file = os.path.join(files_path, file_path)

        # 检查输入文件是否存在
        if not os.path.exists(input_file):
            return False, {'error': '输入文件不存在'}

        # 构建输出目录结构
        # 例如：knowledgebase/KB-UUID-markdown/DIR-A/B.pdf/
        kb_markdown_path = os.path.join(
            settings['KNOWLEDGEBASE_PATH'],
            f"{knowledge_id}-markdown"
        )

        # 保持目录结构，为文件创建同名目录
        # 例如：DIR-A/B.pdf -> DIR-A/B.pdf/
        # MinerU 会在这个目录中生成 md 文件和 images 目录
        # 使用原始文件路径作为输出目录名（如果是从 Office 转换的）
        output_file_path = original_file_path if original_file_path else file_path
        file_output_dir = os.path.join(kb_markdown_path, output_file_path)
        os.makedirs(file_output_dir, exist_ok=True)

        # 构建 MinerU 命令
        # --output 参数指向文件对应的目录，MinerU 会在其中生成内容
        cmd = build_mineru_command(input_file, file_output_dir, config)

        logger.info(f"执行 MinerU 命令: {' '.join(cmd)}")

        # 执行命令
        timeout = config.get('timeout', 300)
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or '命令执行失败'
            logger.error(f"MinerU 执行失败: {error_msg}")
            return False, {'error': error_msg}

        # 查找生成的 Markdown 文件
        # MinerU 会在输出目录中生成 md 文件
        # 查找所有 .md 文件
        md_files = []
        for root, dirs, files in os.walk(file_output_dir):
            for file in files:
                if file.endswith('.md'):
                    md_files.append(os.path.join(root, file))

        if not md_files:
            return False, {'error': '未找到生成的 Markdown 文件'}

        # 使用第一个找到的 md 文件
        markdown_file = md_files[0]

        # 计算相对于 kb_markdown_path 的路径
        markdown_relative_path = os.path.relpath(markdown_file, kb_markdown_path)

        logger.info(f"找到 Markdown 文件: {markdown_relative_path}")

        return True, {
            'markdown_path': markdown_relative_path,
            'output_dir': file_output_dir
        }

    except subprocess.TimeoutExpired:
        return False, {'error': f'转换超时（{config.get("timeout", 300)}秒）'}
    except Exception as e:
        logger.error(f"MinerU 转换异常: {e}")
        return False, {'error': str(e)}


def _convert_with_paddleocr_vl(knowledge_id, file_path, original_file_path=None, temp_pdf_path=None):
    """
    使用 PaddleOCR-VL 转换文件

    Args:
        knowledge_id: 知识库ID
        file_path: 文件路径（相对于知识库目录）
        original_file_path: 原始文件路径（用于输出目录命名）
        temp_pdf_path: 临时PDF的完整路径（如果从Office转换）

    Returns:
        (success, result): 成功标志和结果字典
    """
    try:
        # 1. 获取配置
        config = get_paddleocr_vl_config()
        
        # 2. 获取文件路径（与 MinerU 使用相同的路径结构）
        kb_path = os.path.join(settings['KNOWLEDGEBASE_PATH'], knowledge_id)
        files_path = os.path.join(kb_path, 'files')
        
        # 如果有临时PDF，使用临时PDF作为输入，否则使用原始文件
        if temp_pdf_path:
            full_file_path = temp_pdf_path
        else:
            full_file_path = os.path.join(files_path, file_path)
        
        if not os.path.exists(full_file_path):
            return False, {'error': f'文件不存在: {full_file_path}'}
        
        # 3. 创建输出目录（使用与 MinerU 相同的输出结构）
        kb_markdown_path = os.path.join(
            settings['KNOWLEDGEBASE_PATH'],
            f"{knowledge_id}-markdown"
        )
        
        # 为文件创建输出目录
        # 使用原始文件路径作为输出目录名（如果是从 Office 转换的）
        output_file_path = original_file_path if original_file_path else file_path
        file_output_dir = os.path.join(kb_markdown_path, output_file_path)
        os.makedirs(file_output_dir, exist_ok=True)
        
        # 4. 构建并执行命令
        cmd = build_paddleocr_vl_command(full_file_path, file_output_dir, config)
        logger.info(f"执行 PaddleOCR-VL 命令: {' '.join(cmd)}")
        logger.info(f"输出目录: {file_output_dir}")
        
        timeout = int(config.get('timeout', 120)) if isinstance(config.get('timeout'), str) else config.get('timeout', 120)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or '命令执行失败'
            logger.error(f"PaddleOCR-VL 执行失败: {error_msg[:500]}")
            return False, {'error': error_msg}
        
        # 5. 合并生成的 Markdown 文件
        logger.info("开始合并 Markdown 文件...")
        merged_file = merge_paddleocr_markdown_files(file_output_dir, full_file_path)
        
        if merged_file and os.path.exists(merged_file):
            # 使用合并后的文件
            markdown_file = merged_file
            logger.info(f"成功合并为: {os.path.basename(merged_file)}")
        else:
            # 如果合并失败，查找单个输出文件
            logger.warning("合并失败，查找单个输出文件...")
            output_files = []
            for root, dirs, files in os.walk(file_output_dir):
                for file in files:
                    if file.endswith('.md') and not file.endswith('_full.md'):
                        output_files.append(os.path.join(root, file))
            
            if not output_files:
                return False, {'error': '未找到生成的输出文件'}
            
            markdown_file = output_files[0]
        
        # 6. 计算相对路径（相对于 kb_markdown_path）
        markdown_relative_path = os.path.relpath(markdown_file, kb_markdown_path)
        
        logger.info(f"PaddleOCR-VL 转换成功: {markdown_relative_path}")
        
        return True, {
            'markdown_path': markdown_relative_path,
            'output_dir': file_output_dir
        }

    except subprocess.TimeoutExpired:
        return False, {'error': f'转换超时（{config.get("timeout", 120)}秒）'}
    except Exception as e:
        logger.error(f"PaddleOCR-VL 转换异常: {e}")
        return False, {'error': str(e)}


def get_conversion_status(knowledge_id, file_path):
    """
    获取文件转换状态
    
    Args:
        knowledge_id: 知识库ID
        file_path: 文件路径（相对于知识库目录）
    
    Returns:
        转换状态字典，如果未转换则返回 None
    """
    conversion = KnowledgeFileConversion.query.filter_by(
        knowledge_id=knowledge_id,
        file_path=file_path
    ).first()
    
    if not conversion:
        return None
    
    return {
        'conversion_id': conversion.id,
        'status': conversion.status,
        'parser_tool': conversion.parser_tool,
        'markdown_path': conversion.markdown_path,
        'error_message': conversion.error_message,
        'started_at': conversion.started_at,
        'completed_at': conversion.completed_at
    }


def is_file_converted(knowledge_id, file_path):
    """
    检查文件是否已转换
    
    Args:
        knowledge_id: 知识库ID
        file_path: 文件路径（相对于知识库目录）
    
    Returns:
        bool: 是否已转换完成
    """
    from app.models import Job
    
    conversion = KnowledgeFileConversion.query.filter_by(
        knowledge_id=knowledge_id,
        file_path=file_path
    ).first()
    
    if not conversion or not conversion.job_id:
        return False
    
    # 显式查询Job检查状态
    job = Job.query.get(conversion.job_id)
    return job is not None and job.status == 'completed'

