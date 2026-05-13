"""
文档解析器配置工具
提供获取和管理文档解析器配置的辅助函数
"""

import logging

from core.config import settings

logger = logging.getLogger(__name__)


def get_active_document_parser():
    """
    获取当前启用的文档解析器名称

    Returns:
        str: 解析器名称 (mineru, paddleocr_vl)
    """
    # 优先从数据库读取
    from app.models import SystemSetting
    parser_tool = SystemSetting.get('document_parser_tool', None)
    if parser_tool:
        return parser_tool

    # 回退到 app.config
    return settings.get('DOCUMENT_PARSER_TOOL', 'mineru')


def get_document_parser_config(parser_name=None):
    """
    获取指定文档解析器的配置

    Args:
        parser_name: 解析器名称，如果为None则获取当前启用的解析器配置

    Returns:
        dict: 解析器配置字典
    """
    if parser_name is None:
        parser_name = get_active_document_parser()

    # 优先从数据库读取
    from app.models import SystemSetting
    config_key_db = f'document_parser_{parser_name}_config'
    config = SystemSetting.get(config_key_db, None)
    if config:
        return config

    # 回退到 app.config
    config_key = f'DOCUMENT_PARSER_{parser_name.upper()}_CONFIG'
    return settings.get(config_key, {})


def get_mineru_config():
    """获取 MinerU 解析器配置"""
    config = get_document_parser_config('mineru')

    backend_type = config.get('backend_type', 'local')

    # 根据 backend_type 确定 backend 参数
    backend = 'vlm-http-client' if backend_type == 'remote' else 'pipeline'

    # 添加内部使用的默认配置
    # 确保timeout是数值类型
    timeout_value = config.get('timeout', 300)
    timeout = int(timeout_value) if isinstance(timeout_value, str) else timeout_value
    
    result = {
        'backend_type': backend_type,
        'executable_path': config.get('executable_path', ''),
        'timeout': timeout,
        'extra_args': config.get('extra_args', ''),
        # 内部使用的配置
        'backend': backend,  # pipeline | vlm-http-client
        'output_format': 'markdown',  # markdown | text | json
        'extract_images': True,
        'extract_tables': True,
        'extract_formulas': True
    }

    # 如果是远程模式，添加 server_url
    if backend_type == 'remote':
        result['server_url'] = config.get('server_url', '')

    return result





def get_paddleocr_vl_config():
    """获取 PaddleOCR-VL 解析器配置"""
    config = get_document_parser_config('paddleocr_vl')
    
    # 确保timeout是数值类型
    timeout_value = config.get('timeout', 120)
    timeout = int(timeout_value) if isinstance(timeout_value, str) else timeout_value
    
    return {
        'executable_path': config.get('executable_path', 'paddleocr'),
        'vl_rec_backend': config.get('vl_rec_backend', 'vllm-server'),  # 后端类型
        'server_url': config.get('server_url', 'http://127.0.0.1:8118/v1'),  # 远程服务地址
        'extra_args': config.get('extra_args', ''),  # 额外的命令行参数
        'timeout': timeout
    }


def get_pdf_converter_config():
    """获取 PDF 转换器配置"""
    from app.models import SystemSetting
    config = SystemSetting.get('pdf_converter_config', None)
    
    if not config:
        # 回退到默认配置
        config = settings.get('PDF_CONVERTER_CONFIG', {})
    
    # 确保timeout是数值类型
    timeout_value = config.get('timeout', 120)
    timeout = int(timeout_value) if isinstance(timeout_value, str) else timeout_value
    
    return {
        'executable_path': config.get('executable_path', 'soffice'),
        'timeout': timeout
    }


# 解析器元数据（用于前端展示和验证）
DOCUMENT_PARSERS_META = {
    'mineru': {
        'name': 'mineru',
        'display_name': 'MinerU',
        'description': '基于AI的多格式文档解析工具，支持PDF、Word、PowerPoint、Excel、图片等格式',
        'status': 'available',
        'supported_formats': ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']
    },
    'paddleocr_vl': {
        'name': 'paddleocr_vl',
        'display_name': 'PaddleOCR-VL',
        'description': '百度 PaddlePaddle 团队开发的超轻量级视觉语言模型（采用远程服务架构），专门用于多语言文档解析，支持109种语言',
        'status': 'available',
        'supported_formats': ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.bmp', '.tiff']
    }
}


def is_format_supported(file_extension):
    """
    检查文件格式是否被当前启用的解析器支持
    
    Args:
        file_extension: 文件扩展名（包含点，如 '.pdf'）
        
    Returns:
        bool: 是否支持
    """
    parser_name = get_active_document_parser()
    parser_meta = DOCUMENT_PARSERS_META.get(parser_name)
    
    if not parser_meta:
        return False
    
    return file_extension.lower() in parser_meta['supported_formats']


def get_supported_formats():
    """
    获取当前启用的解析器支持的文件格式列表

    Returns:
        list: 支持的文件扩展名列表
    """
    parser_name = get_active_document_parser()
    parser_meta = DOCUMENT_PARSERS_META.get(parser_name)

    if not parser_meta:
        return []

    return parser_meta['supported_formats']


def build_mineru_command(input_path, output_path, config=None):
    """
    构建 MinerU (magic-pdf) 命令行

    Args:
        input_path: 输入文件路径
        output_path: 输出目录路径
        config: MinerU 配置字典，如果为 None 则使用当前配置

    Returns:
        list: 命令行参数列表
    """
    if config is None:
        config = get_mineru_config()

    executable = config.get('executable_path', 'magic-pdf')
    backend_type = config.get('backend_type', 'local')  # local | remote

    # 基础命令 - magic-pdf 的完整用法
    # 本地模式: mineru -p <pdf_path> -o <output_dir> -m <method>
    # 远程模式: mineru -p <pdf_path> -o <output_dir> -m <method> --backend vlm-http-client --url <server_url>
    cmd = [
        executable,
        '-p', input_path,
        '-o', output_path,
        '-m', 'auto'  # 使用 auto 方法自动选择最佳解析方式
    ]

    # 只有远程模式才添加 backend 参数
    if backend_type == 'remote':
        cmd.extend(['--backend', 'vlm-http-client'])
        # 如果是远程模式，添加 server_url
        if config.get('server_url'):
            cmd.extend(['--url', config.get('server_url')])
    # 本地模式不添加 --backend 参数，让 MinerU 使用默认行为

    # 额外参数（用户自定义，仅本地模式）
    if backend_type == 'local':
        extra_args = config.get('extra_args', '').strip()
        if extra_args:
            import shlex
            extra_args_list = shlex.split(extra_args)
            cmd.extend(extra_args_list)

    return cmd


def merge_paddleocr_markdown_files(output_dir, input_filename):
    """
    合并 PaddleOCR 生成的多个 Markdown 文件为一个完整文件
    
    Args:
        output_dir: 输出目录路径
        input_filename: 输入文件名（如 demo1.pdf）
        
    Returns:
        str: 合并后的 Markdown 文件路径，如果没有找到文件则返回 None
    """
    import os
    import re
    
    # 获取基础文件名（不含扩展名）
    base_name = os.path.splitext(os.path.basename(input_filename))[0]
    
    # 查找所有匹配的 Markdown 文件：demo1_0.md, demo1_1.md, ...
    md_files = []
    pattern = re.compile(rf'^{re.escape(base_name)}_(\d+)\.md$')
    
    if not os.path.exists(output_dir):
        return None
    
    for filename in os.listdir(output_dir):
        match = pattern.match(filename)
        if match:
            page_num = int(match.group(1))
            file_path = os.path.join(output_dir, filename)
            md_files.append((page_num, file_path))
    
    if not md_files:
        return None
    
    # 按页码排序
    md_files.sort(key=lambda x: x[0])
    
    # 合并文件
    merged_path = os.path.join(output_dir, f"{base_name}_full.md")
    
    with open(merged_path, 'w', encoding='utf-8') as outfile:
        for i, (page_num, file_path) in enumerate(md_files):
            # 读取并写入内容，页面之间只用换行分隔
            try:
                with open(file_path, 'r', encoding='utf-8') as infile:
                    content = infile.read()
                    outfile.write(content)
                    # 确保页面之间有适当的空行
                    if i < len(md_files) - 1:  # 不是最后一页
                        outfile.write('\n\n')
            except Exception as e:
                outfile.write(f'\n\n[Error reading page {page_num}: {str(e)}]\n\n')
    
    return merged_path


def build_paddleocr_vl_command(input_path, output_path, config=None):
    """
    构建 PaddleOCR-VL 命令行

    Args:
        input_path: 输入文件路径（绝对路径）
        output_path: 输出目录路径
        config: PaddleOCR-VL 配置字典，如果为 None 则使用当前配置

    Returns:
        list: 命令行参数列表
    """
    if config is None:
        config = get_paddleocr_vl_config()

    executable = config.get('executable_path', 'paddleocr')

    # 基础命令 - 使用 --save_path 指定输出目录
    cmd = [
        executable,
        'doc_parser',
        '-i', input_path,
        '--save_path', output_path,  # 指定输出目录
        '--vl_rec_backend', config.get('vl_rec_backend', 'vllm-server'),
        '--vl_rec_server_url', config.get('server_url', 'http://127.0.0.1:8118/v1'),
        '--format_block_content', 'True'  # 格式化块内容为 Markdown，合并输出
    ]

    # 额外参数（用户自定义）
    extra_args = config.get('extra_args', '').strip()
    if extra_args:
        # 将额外参数字符串分割成列表
        # 支持格式：--xxx xxx --aaa aaa 或 --xxx=xxx --aaa=aaa
        import shlex
        extra_args_list = shlex.split(extra_args)
        cmd.extend(extra_args_list)

    return cmd

