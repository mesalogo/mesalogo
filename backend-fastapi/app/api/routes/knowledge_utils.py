"""
知识库模块共享工具函数 (FastAPI version)
"""

import os
import re
from core.config import settings


def fix_url_encoding(text):
    """
    修复 URL 编码问题
    """
    try:
        return text.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


def allowed_file(filename):
    """检查文件扩展名是否允许 - 现在允许所有文件类型"""
    return '.' in filename


def safe_filename_with_unicode(filename):
    """
    生成支持中文的安全文件名
    """
    if not filename:
        return 'unnamed_file'

    dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0']
    safe_name = filename

    for char in dangerous_chars:
        safe_name = safe_name.replace(char, '_')

    safe_name = safe_name.strip(' .')

    if not safe_name or safe_name == '.' or safe_name == '..':
        safe_name = 'unnamed_file'

    max_length = 200
    if len(safe_name.encode('utf-8')) > max_length:
        name, ext = os.path.splitext(safe_name)
        while len(name.encode('utf-8')) + len(ext.encode('utf-8')) > max_length and len(name) > 1:
            name = name[:-1]
        safe_name = name + ext

    return safe_name


def get_knowledge_base_path(knowledge_id):
    """获取知识库文件存储路径"""
    return os.path.join(settings.get('KNOWLEDGEBASE_PATH', 'knowledgebase'), str(knowledge_id))


def _replace_image_urls(markdown_content, knowledge_id, markdown_path):
    """替换Markdown中的图片相对路径为API URL"""
    base_dir = os.path.dirname(markdown_path)
    
    def replace_image(match):
        img_alt = match.group(1)
        img_path = match.group(2).lstrip('./')
        api_url = f"/api/knowledges/{knowledge_id}/markdown-files/{base_dir}/{img_path}"
        return f"![{img_alt}]({api_url})"
    
    pattern = r'!\[(.*?)\]\((\.?/?(?:auto/)?images/[^\)]+)\)'
    return re.sub(pattern, replace_image, markdown_content)


def ensure_knowledge_base_dirs(knowledge_id):
    """确保知识库目录存在"""
    kb_path = get_knowledge_base_path(knowledge_id)
    dirs = ['files', 'processed']
    
    for dir_name in dirs:
        dir_path = os.path.join(kb_path, dir_name)
        os.makedirs(dir_path, exist_ok=True)
    
    return kb_path
