"""
文档解析器测试服务
提供各种文档解析器的测试功能
"""

import logging
import os
import subprocess
import tempfile
import time
import shutil

from core.config import settings

logger = logging.getLogger(__name__)

from app.utils.document_parser_config import (
    get_active_document_parser,
    get_document_parser_config,
    get_mineru_config,
    get_paddleocr_vl_config,
    build_mineru_command,
    build_paddleocr_vl_command,
    merge_paddleocr_markdown_files
)


# 测试文件路径（相对于backend目录）
DEMO_FILE_PATH = 'knowledgebase/demo_files/demo1.pdf'


def test_parser(parser_name=None):
    """
    测试指定的文档解析器
    
    Args:
        parser_name: 解析器名称 (mineru, paddleocr_vl)
                    如果为 None，则测试当前启用的解析器
    
    Returns:
        dict: {
            'success': bool,
            'parser_name': str,
            'duration': float,  # 秒
            'message': str,
            'details': dict,
            'output_preview': str  # 输出预览（可选）
        }
    """
    if parser_name is None:
        parser_name = get_active_document_parser()
    
    logger.info(f"开始测试文档解析器: {parser_name}")
    
    # 根据解析器类型分发
    if parser_name == 'mineru':
        return test_mineru_parser()
    elif parser_name == 'paddleocr_vl':
        return test_paddleocr_vl_parser()
    else:
        return {
            'success': False,
            'parser_name': parser_name,
            'duration': 0,
            'message': f'未知的解析器: {parser_name}',
            'details': {}
        }


def test_mineru_parser():
    """
    测试 MinerU 解析器
    
    Returns:
        dict: 测试结果
    """
    start_time = time.time()
    temp_dir = None
    
    try:
        # 1. 获取配置
        config = get_mineru_config()
        executable = config.get('executable_path', 'magic-pdf')
        # 确保timeout是数值类型
        timeout = int(config.get('timeout', 300)) if isinstance(config.get('timeout'), str) else config.get('timeout', 300)
        
        logger.info(f"MinerU 配置: executable={executable}, timeout={timeout}")
        
        # 2. 检查可执行文件
        if not executable:
            return {
                'success': False,
                'parser_name': 'mineru',
                'duration': time.time() - start_time,
                'message': '未配置可执行文件路径',
                'details': {
                    'error': '请在设置中配置 MinerU 可执行文件路径'
                }
            }
        
        # 检查可执行文件是否存在
        if not os.path.exists(executable) and not shutil.which(executable):
            return {
                'success': False,
                'parser_name': 'mineru',
                'duration': time.time() - start_time,
                'message': '可执行文件不存在',
                'details': {
                    'error': f'找不到可执行文件: {executable}',
                    'suggestion': '请检查配置中的 executable_path 是否正确'
                }
            }
        
        # 3. 检查测试文件
        # 尝试多个可能的路径
        possible_paths = [
            DEMO_FILE_PATH,  # 相对于backend目录
            os.path.join('backend', DEMO_FILE_PATH),  # 相对于项目根目录
            os.path.join(os.getcwd(), DEMO_FILE_PATH),  # 使用当前工作目录
        ]

        demo_file = None
        for path in possible_paths:
            if os.path.exists(path):
                demo_file = path
                break

        if not demo_file:
            return {
                'success': False,
                'parser_name': 'mineru',
                'duration': time.time() - start_time,
                'message': '测试文件不存在',
                'details': {
                    'error': f'在以下路径中找不到测试文件: {possible_paths}',
                    'expected_path': DEMO_FILE_PATH,
                    'current_dir': os.getcwd()
                }
            }
        
        # 确保使用绝对路径
        demo_file = os.path.abspath(demo_file)
        logger.info(f"使用测试文件（绝对路径）: {demo_file}")
        
        # 4. 创建临时输出目录
        temp_dir = tempfile.mkdtemp(prefix='mineru_test_')
        logger.info(f"临时输出目录: {temp_dir}")
        
        # 5. 构建命令
        cmd = build_mineru_command(demo_file, temp_dir, config)
        logger.info(f"执行命令: {' '.join(cmd)}")
        
        # 6. 执行命令
        exec_start_time = time.time()
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        exec_duration = time.time() - exec_start_time
        
        # 记录完整的输出用于调试
        logger.info(f"命令返回码: {result.returncode}")
        if result.stdout:
            logger.info(f"标准输出: {result.stdout[:1000]}")
        if result.stderr:
            logger.warning(f"标准错误: {result.stderr[:1000]}")
        
        # 7. 检查执行结果
        # 检查stderr中是否包含错误信息（即使returncode为0）
        has_error = (result.returncode != 0 or 
                    (result.stderr and ('error' in result.stderr.lower() or 
                                       'traceback' in result.stderr.lower() or
                                       'failed' in result.stderr.lower())))
        
        if has_error:
            # 合并stdout和stderr以获取完整错误信息
            full_output = ''
            if result.stderr:
                full_output = result.stderr
            elif result.stdout:
                full_output = result.stdout
            else:
                full_output = '命令执行失败，但未捕获到错误信息'
                
            logger.error(f"MinerU 执行失败: {full_output[:1000]}")
            
            return {
                'success': False,
                'parser_name': 'mineru',
                'duration': time.time() - start_time,
                'message': 'MinerU 解析失败',
                'details': {
                    'error': full_output[:2000],  # 增加错误信息长度
                    'returncode': result.returncode,
                    'stdout': result.stdout[:1000] if result.stdout else '',
                    'stderr': result.stderr[:1000] if result.stderr else '',
                    'execution_time': exec_duration,
                    'command': ' '.join(cmd)  # 包含实际执行的命令
                }
            }
        
        # 8. 查找生成的 Markdown 文件
        md_files = []
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.endswith('.md'):
                    md_files.append(os.path.join(root, file))
        
        if not md_files:
            # 即使returncode为0，也可能有错误（检查输出内容）
            error_msg = '命令执行返回成功，但未找到生成的 Markdown 文件'
            if result.stderr:
                error_msg += f'\n错误输出: {result.stderr[:1000]}'
            if result.stdout:
                error_msg += f'\n标准输出: {result.stdout[:1000]}'
                
            return {
                'success': False,
                'parser_name': 'mineru',
                'duration': time.time() - start_time,
                'message': '未生成 Markdown 文件',
                'details': {
                    'error': error_msg,
                    'output_dir': temp_dir,
                    'stdout': result.stdout[:1000] if result.stdout else '',
                    'stderr': result.stderr[:1000] if result.stderr else '',
                    'returncode': result.returncode,
                    'execution_time': exec_duration,
                    'command': ' '.join(cmd)  # 包含实际执行的命令
                }
            }
        
        # 9. 读取 Markdown 完整内容
        md_file = md_files[0]
        output_preview = ''
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
                # 返回完整内容，不截断
                output_preview = content
        except Exception as e:
            logger.warning(f"读取 Markdown 文件失败: {e}")
            output_preview = '(无法读取预览)'
        
        # 10. 统计输出文件
        total_files = sum([len(files) for _, _, files in os.walk(temp_dir)])
        total_size = sum([os.path.getsize(os.path.join(root, file)) 
                         for root, _, files in os.walk(temp_dir) 
                         for file in files])
        
        duration = time.time() - start_time
        
        logger.info(f"MinerU 测试成功，耗时: {duration:.2f}秒")
        
        return {
            'success': True,
            'parser_name': 'mineru',
            'duration': duration,
            'message': '测试成功',
            'details': {
                'execution_time': exec_duration,
                'output_files': total_files,
                'output_size': total_size,
                'markdown_files': len(md_files),
                'output_dir': temp_dir,
                'stdout': result.stdout[:200] if result.stdout else ''
            },
            'output_preview': output_preview
        }
        
    except subprocess.TimeoutExpired:
        duration = time.time() - start_time
        return {
            'success': False,
            'parser_name': 'mineru',
            'duration': duration,
            'message': '执行超时',
            'details': {
                'error': f'命令执行超过 {timeout} 秒',
                'suggestion': '请尝试增加超时时间或检查文件是否过大'
            }
        }
    
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"MinerU 测试异常: {e}", exc_info=True)
        return {
            'success': False,
            'parser_name': 'mineru',
            'duration': duration,
            'message': '测试异常',
            'details': {
                'error': str(e),
                'type': type(e).__name__
            }
        }
    
    finally:
        # 清理临时目录（可选：保留用于调试）
        if temp_dir and os.path.exists(temp_dir):
            try:
                # 注释掉以保留临时文件用于调试
                # shutil.rmtree(temp_dir)
                logger.info(f"保留临时目录用于调试: {temp_dir}")
            except Exception as e:
                logger.warning(f"清理临时目录失败: {e}")


def test_paddleocr_vl_parser():
    """
    测试 PaddleOCR-VL 解析器
    
    Returns:
        dict: 测试结果
    """
    start_time = time.time()
    temp_dir = None
    
    try:
        # 1. 获取配置
        config = get_paddleocr_vl_config()
        executable = config.get('executable_path', 'paddleocr')
        server_url = config.get('server_url', '')
        timeout = int(config.get('timeout', 120)) if isinstance(config.get('timeout'), str) else config.get('timeout', 120)
        
        logger.info(f"PaddleOCR-VL 配置: executable={executable}, server_url={server_url}, timeout={timeout}")
        
        # 2. 检查可执行文件
        if not executable:
            return {
                'success': False,
                'parser_name': 'paddleocr_vl',
                'duration': time.time() - start_time,
                'message': '未配置可执行文件路径',
                'details': {
                    'error': '请在设置中配置 PaddleOCR 可执行文件路径'
                }
            }
        
        # 检查可执行文件是否存在
        if not os.path.exists(executable) and not shutil.which(executable):
            return {
                'success': False,
                'parser_name': 'paddleocr_vl',
                'duration': time.time() - start_time,
                'message': '可执行文件不存在',
                'details': {
                    'error': f'找不到可执行文件: {executable}',
                    'suggestion': '请检查配置中的 executable_path 是否正确'
                }
            }
        
        # 检查服务地址配置
        if not server_url:
            return {
                'success': False,
                'parser_name': 'paddleocr_vl',
                'duration': time.time() - start_time,
                'message': '未配置服务地址',
                'details': {
                    'error': '请在设置中配置 vLLM 服务地址',
                    'suggestion': '例如: http://127.0.0.1:8118/v1'
                }
            }
        
        # 3. 检查测试文件
        possible_paths = [
            DEMO_FILE_PATH,
            os.path.join('backend', DEMO_FILE_PATH),
            os.path.join(os.getcwd(), DEMO_FILE_PATH),
        ]

        demo_file = None
        for path in possible_paths:
            if os.path.exists(path):
                demo_file = path
                break

        if not demo_file:
            return {
                'success': False,
                'parser_name': 'paddleocr_vl',
                'duration': time.time() - start_time,
                'message': '测试文件不存在',
                'details': {
                    'error': f'在以下路径中找不到测试文件: {possible_paths}',
                    'expected_path': DEMO_FILE_PATH,
                    'current_dir': os.getcwd()
                }
            }
        
        # 确保使用绝对路径（PaddleOCR 需要绝对路径，因为我们会改变工作目录）
        demo_file = os.path.abspath(demo_file)
        logger.info(f"使用测试文件（绝对路径）: {demo_file}")
        
        # 4. 创建临时输出目录
        temp_dir = tempfile.mkdtemp(prefix='paddleocr_vl_test_')
        logger.info(f"临时输出目录: {temp_dir}")
        
        # 5. 构建命令
        cmd = build_paddleocr_vl_command(demo_file, temp_dir, config)
        logger.info(f"执行命令: {' '.join(cmd)}")
        logger.info(f"输出目录: {temp_dir}")
        
        # 6. 执行命令
        exec_start_time = time.time()
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        exec_duration = time.time() - exec_start_time
        
        # 记录完整的输出用于调试
        logger.info(f"命令返回码: {result.returncode}")
        if result.stdout:
            logger.info(f"标准输出 ({len(result.stdout)} 字符): {result.stdout[:1000]}")
        if result.stderr:
            logger.warning(f"标准错误 ({len(result.stderr)} 字符)")
            # 记录完整的 stderr 用于调试
            if result.returncode != 0:
                logger.error(f"完整标准错误输出:\n{result.stderr}")
            else:
                logger.warning(f"标准错误前 2000 字符: {result.stderr[:2000]}")
        
        # 7. 检查执行结果
        # 注意：PaddleOCR 会在 stderr 输出警告和调试信息，但只要 returncode == 0 就认为成功
        # 不能仅凭 stderr 中有 "error" 或 "traceback" 就判断失败
        if result.returncode != 0:
            full_output = ''
            if result.stderr:
                full_output = result.stderr
            elif result.stdout:
                full_output = result.stdout
            else:
                full_output = '命令执行失败，但未捕获到错误信息'
                
            logger.error(f"PaddleOCR-VL 执行失败，完整错误信息见上方日志")
            
            return {
                'success': False,
                'parser_name': 'paddleocr_vl',
                'duration': time.time() - start_time,
                'message': 'PaddleOCR-VL 解析失败',
                'details': {
                    'error': full_output[:2000],
                    'returncode': result.returncode,
                    'stdout': result.stdout[:1000] if result.stdout else '',
                    'stderr': result.stderr[:1000] if result.stderr else '',
                    'execution_time': exec_duration,
                    'command': ' '.join(cmd)
                }
            }
        
        # 8. 合并生成的 Markdown 文件
        logger.info("开始合并 Markdown 文件...")
        merged_file = merge_paddleocr_markdown_files(temp_dir, demo_file)
        
        if not merged_file or not os.path.exists(merged_file):
            # 如果合并失败，尝试查找单个文件
            logger.warning("合并失败，查找单个输出文件...")
            output_files = []
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    if file.endswith('.md') and not file.endswith('_full.md'):
                        output_files.append(os.path.join(root, file))
            
            if not output_files:
                error_msg = '命令执行返回成功，但未找到生成的输出文件'
                if result.stderr:
                    error_msg += f'\n错误输出: {result.stderr[:1000]}'
                if result.stdout:
                    error_msg += f'\n标准输出: {result.stdout[:1000]}'
                    
                return {
                    'success': False,
                    'parser_name': 'paddleocr_vl',
                    'duration': time.time() - start_time,
                    'message': '未生成输出文件',
                    'details': {
                        'error': error_msg,
                        'output_dir': temp_dir,
                        'stdout': result.stdout[:1000] if result.stdout else '',
                        'stderr': result.stderr[:1000] if result.stderr else '',
                        'returncode': result.returncode,
                        'execution_time': exec_duration,
                        'command': ' '.join(cmd)
                    }
                }
            
            output_file = output_files[0]
        else:
            output_file = merged_file
            logger.info(f"成功合并为: {os.path.basename(merged_file)}")
        
        # 9. 读取输出内容
        output_preview = ''
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                content = f.read()
                # 只预览前 2000 个字符
                output_preview = content[:2000] if len(content) > 2000 else content
        except Exception as e:
            logger.warning(f"读取输出文件失败: {e}")
            output_preview = '(无法读取预览)'
        
        # 10. 统计输出文件
        total_files = sum([len(files) for _, _, files in os.walk(temp_dir)])
        total_size = sum([os.path.getsize(os.path.join(root, file)) 
                         for root, _, files in os.walk(temp_dir) 
                         for file in files])
        
        duration = time.time() - start_time
        
        logger.info(f"PaddleOCR-VL 测试成功，耗时: {duration:.2f}秒")
        
        return {
            'success': True,
            'parser_name': 'paddleocr_vl',
            'duration': duration,
            'message': '测试成功',
            'details': {
                'execution_time': exec_duration,
                'output_files': total_files,
                'output_size': total_size,
                'output_file_path': output_file,
                'output_dir': temp_dir,
                'stdout': result.stdout[:200] if result.stdout else ''
            },
            'output_preview': output_preview
        }
        
    except subprocess.TimeoutExpired:
        duration = time.time() - start_time
        return {
            'success': False,
            'parser_name': 'paddleocr_vl',
            'duration': duration,
            'message': '执行超时',
            'details': {
                'error': f'命令执行超过 {timeout} 秒',
                'suggestion': '请尝试增加超时时间或检查 vLLM 服务是否正常运行'
            }
        }
    
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"PaddleOCR-VL 测试异常: {e}", exc_info=True)
        return {
            'success': False,
            'parser_name': 'paddleocr_vl',
            'duration': duration,
            'message': '测试异常',
            'details': {
                'error': str(e),
                'type': type(e).__name__
            }
        }
    
    finally:
        # 保留临时目录用于调试
        if temp_dir and os.path.exists(temp_dir):
            try:
                logger.info(f"保留临时目录用于调试: {temp_dir}")
            except Exception as e:
                logger.warning(f"清理临时目录失败: {e}")


