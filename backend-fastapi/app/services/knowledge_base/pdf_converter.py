"""
PDF 转换服务
将 Office 文档（Word、PowerPoint、Excel 等）转换为 PDF 格式
"""

import os
import logging
import subprocess
from core.config import settings

logger = logging.getLogger(__name__)

from app.utils.document_parser_config import get_pdf_converter_config


# Office 文档格式列表
OFFICE_FORMATS = [
    '.doc', '.docx',      # Word
    '.ppt', '.pptx',      # PowerPoint
    '.xls', '.xlsx',      # Excel
    '.odt', '.ods', '.odp'  # OpenDocument
]


def is_office_format(file_path):
    """
    检查文件是否为 Office 格式
    
    Args:
        file_path: 文件路径
    
    Returns:
        bool: 是否为 Office 格式
    """
    ext = os.path.splitext(file_path)[1].lower()
    return ext in OFFICE_FORMATS


def convert_office_to_pdf(knowledge_id, file_path):
    """
    将 Office 文档转换为 PDF
    
    Args:
        knowledge_id: 知识库ID
        file_path: 文件相对路径（相对于知识库 files 目录）
    
    Returns:
        (success, pdf_file_path): 成功标志和 PDF 文件的完整路径或错误信息
    """
    try:
        # 获取配置
        config = get_pdf_converter_config()
        soffice_path = config.get('executable_path', 'soffice')
        timeout = config.get('timeout', 120)
        
        # 构建路径
        kb_path = os.path.join(settings['KNOWLEDGEBASE_PATH'], knowledge_id)
        files_path = os.path.join(kb_path, 'files')
        source_file = os.path.join(files_path, file_path)
        
        # 检查源文件是否存在
        if not os.path.exists(source_file):
            return False, f'源文件不存在: {file_path}'
        
        # 创建输出目录（使用 markdown 目录结构，与原始文件对应）
        kb_markdown_path = os.path.join(
            settings['KNOWLEDGEBASE_PATH'],
            f"{knowledge_id}-markdown"
        )
        # PDF 输出到与原始文件对应的 markdown 目录中
        output_dir = os.path.join(kb_markdown_path, file_path)
        os.makedirs(output_dir, exist_ok=True)
        
        # 构建 soffice 命令
        # soffice --headless --convert-to pdf --outdir <output_dir> <input_file>
        cmd = [
            soffice_path,
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', output_dir,
            source_file
        ]
        
        logger.info(f"执行 PDF 转换命令: {' '.join(cmd)}")
        
        # 执行转换
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or '转换失败'
            logger.error(f"PDF 转换失败: {error_msg}")
            return False, error_msg
        
        # 查找生成的 PDF 文件
        # soffice 会生成与源文件同名但扩展名为 .pdf 的文件
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        pdf_file_name = f"{base_name}.pdf"
        pdf_file_path = os.path.join(output_dir, pdf_file_name)
        
        if not os.path.exists(pdf_file_path):
            return False, f'PDF 文件生成失败: {pdf_file_name}'
        
        logger.info(f"PDF 转换成功: {pdf_file_path}")
        
        # 返回 PDF 文件的完整路径
        return True, pdf_file_path
        
    except subprocess.TimeoutExpired:
        return False, f'PDF 转换超时（{config.get("timeout", 120)}秒）'
    except Exception as e:
        logger.error(f"PDF 转换异常: {e}")
        return False, str(e)


def cleanup_temp_pdf(knowledge_id, pdf_file_path):
    """
    清理临时 PDF 文件
    
    Args:
        knowledge_id: 知识库ID
        pdf_file_path: PDF 文件的完整路径
    """
    try:
        if os.path.exists(pdf_file_path):
            os.remove(pdf_file_path)
            logger.info(f"已删除临时 PDF: {pdf_file_path}")
        
    except Exception as e:
        logger.warning(f"清理临时 PDF 失败: {e}")
