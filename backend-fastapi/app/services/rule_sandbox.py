"""
规则沙盒执行服务
提供安全的规则代码执行环境
"""

import subprocess
import tempfile
import json
import os
import signal
from typing import Dict, Any, Tuple


class RuleSandbox:
    """规则沙盒执行器"""

    def __init__(self):
        self.timeout = 5  # 5秒超时
        self.max_memory = 50 * 1024 * 1024  # 50MB内存限制

    def execute_javascript(self, code: str, context: Dict[str, Any]) -> Tuple[bool, str, str]:
        """
        在安全的Node.js环境中执行JavaScript代码

        Args:
            code: 要执行的JavaScript代码
            context: 传递给代码的上下文变量

        Returns:
            (success, result, error_message)
        """
        # 首先检查Node.js是否可用
        node_path = self._find_node_executable()
        if not node_path:
            return False, None, "Node.js未安装或不在PATH中，无法执行JavaScript规则"

        try:
            # 创建临时文件
            with tempfile.NamedTemporaryFile(suffix='.js', delete=False, mode='w') as temp_file:
                # 构建安全的JavaScript代码
                safe_js_code = self._build_safe_javascript(code, context)
                temp_file.write(safe_js_code)
                temp_file_path = temp_file.name

            try:
                # 执行Node.js代码，使用安全参数
                proc = subprocess.run(
                    [node_path, '--max-old-space-size=50', temp_file_path],  # 限制内存
                    capture_output=True,
                    text=True,
                    timeout=self.timeout,
                    env=self._get_safe_env()  # 使用安全的环境变量
                )

                if proc.returncode == 0:
                    try:
                        result = json.loads(proc.stdout.strip())
                        return True, result, None
                    except json.JSONDecodeError as e:
                        return False, None, f"输出解析错误: {str(e)}"
                else:
                    return False, None, f"执行错误: {proc.stderr}"

            finally:
                # 清理临时文件
                try:
                    os.unlink(temp_file_path)
                except:
                    pass

        except subprocess.TimeoutExpired:
            return False, None, "执行超时"
        except Exception as e:
            return False, None, f"执行失败: {str(e)}"

    def execute_python(self, code: str, context: Dict[str, Any]) -> Tuple[bool, str, str]:
        """
        在受限的Python环境中执行Python代码

        Args:
            code: 要执行的Python代码
            context: 传递给代码的上下文变量

        Returns:
            (success, result, error_message)
        """
        try:
            # 构建安全的执行环境
            safe_globals = self._get_safe_python_globals()
            # 将context添加到globals中，确保在函数内部可以访问
            safe_globals['context'] = context
            safe_locals = {}

            # 构建要执行的代码
            exec_code = f"""
def execute_rule():
    {self._indent_code(code)}

result = execute_rule()
"""

            # 检查是否在主线程中，只有在主线程中才使用signal
            import threading
            is_main_thread = threading.current_thread() is threading.main_thread()

            # 在受限环境中执行代码
            if is_main_thread:
                # 在主线程中，可以使用signal进行超时控制
                def timeout_handler(signum, frame):
                    raise TimeoutError("规则执行超时")

                old_handler = signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(self.timeout)

                try:
                    exec(exec_code, safe_globals, safe_locals)
                finally:
                    signal.alarm(0)
                    signal.signal(signal.SIGALRM, old_handler)
            else:
                # 在非主线程中，直接执行（不使用signal超时）
                # 注意：这里没有超时保护，但避免了signal错误
                exec(exec_code, safe_globals, safe_locals)

            # 获取执行结果
            result = bool(safe_locals.get('result', False))
            return True, {'passed': result, 'rawResult': safe_locals.get('result')}, None

        except TimeoutError:
            return False, None, "执行超时"
        except Exception as e:
            return False, None, f"执行错误: {str(e)}"

    def _build_safe_javascript(self, user_code: str, context: Dict[str, Any]) -> str:
        """构建安全的JavaScript代码"""
        return f"""
// 禁用危险功能
const process = undefined;
const require = undefined;
const global = undefined;
const Buffer = undefined;

// 传递上下文
const context = {json.dumps(context)};

// 执行用户规则
const rule = function() {{
    {user_code}
}};

try {{
    const result = rule();
    console.log(JSON.stringify({{
        passed: !!result,
        rawResult: result,
        resultType: typeof result,
        error: null
    }}));
}} catch (error) {{
    console.log(JSON.stringify({{
        passed: false,
        error: error.message
    }}));
}}
"""

    def _find_node_executable(self) -> str:
        """查找Node.js可执行文件路径"""
        # 常见的Node.js安装路径
        possible_paths = [
            '/usr/bin/node',
            '/usr/local/bin/node',
            '/opt/homebrew/bin/node',
            '/opt/homebrew/opt/node@22/bin/node',
            '/opt/homebrew/opt/node@20/bin/node',
            '/opt/homebrew/opt/node@18/bin/node',
        ]

        # 首先尝试从PATH中查找
        try:
            result = subprocess.run(['which', 'node'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0 and result.stdout.strip():
                node_path = result.stdout.strip()
                if os.path.isfile(node_path) and os.access(node_path, os.X_OK):
                    return node_path
        except:
            pass

        # 如果PATH中找不到，尝试常见路径
        for path in possible_paths:
            if os.path.isfile(path) and os.access(path, os.X_OK):
                return path

        return None

    def _get_safe_env(self) -> Dict[str, str]:
        """获取安全的环境变量"""
        # 保留必要的PATH，但限制范围
        safe_path = '/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/opt/node@22/bin'
        return {
            'NODE_ENV': 'sandbox',
            'PATH': safe_path,
            'HOME': '/tmp',  # 限制HOME目录
        }

    def _get_safe_python_globals(self) -> Dict[str, Any]:
        """获取安全的Python全局环境"""
        # 只允许安全的内置函数
        safe_builtins = {
            'len': len,
            'str': str,
            'int': int,
            'float': float,
            'bool': bool,
            'list': list,
            'dict': dict,
            'tuple': tuple,
            'set': set,
            'min': min,
            'max': max,
            'sum': sum,
            'abs': abs,
            'round': round,
            'range': range,
            'enumerate': enumerate,
            'zip': zip,
            'sorted': sorted,
            'reversed': reversed,
            'any': any,
            'all': all,
        }

        return {
            '__builtins__': safe_builtins,
            '__name__': '__sandbox__',
        }

    def _indent_code(self, code: str) -> str:
        """为代码添加缩进"""
        lines = code.split('\n')
        indented_lines = ['    ' + line for line in lines]
        return '\n'.join(indented_lines)


# 全局沙盒实例
sandbox = RuleSandbox()


def test_rule_safely(rule_type: str, code: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    安全地测试规则代码

    Args:
        rule_type: 规则类型 ('javascript' 或 'python')
        code: 规则代码
        context: 测试上下文

    Returns:
        测试结果字典
    """
    if rule_type.lower() == 'javascript':
        success, result, error = sandbox.execute_javascript(code, context)

        # 如果JavaScript执行失败（比如没有Node.js），提供友好的错误信息
        if not success and "Node.js未安装" in str(error):
            return {
                'passed': False,
                'error': error,
                'details': f"JavaScript执行环境不可用: {error}。建议安装Node.js或使用Python规则。"
            }

    elif rule_type.lower() == 'python':
        success, result, error = sandbox.execute_python(code, context)
    else:
        return {
            'passed': False,
            'error': f'不支持的规则类型: {rule_type}',
            'details': '仅支持 JavaScript 和 Python'
        }

    if success:
        return {
            'passed': result.get('passed', False),
            'rawResult': result.get('rawResult'),
            'resultType': result.get('resultType'),
            'error': None,
            'details': f"执行成功，返回值: {result.get('passed', False)}"
        }
    else:
        return {
            'passed': False,
            'error': error,
            'details': f"执行失败: {error}"
        }
