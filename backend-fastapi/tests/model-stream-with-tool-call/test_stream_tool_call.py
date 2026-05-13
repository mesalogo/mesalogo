#!/usr/bin/env python3
"""
测试流式工具调用的完整数据流

这个脚本用于测试：
1. 流式响应中工具调用的解析
2. 工具执行后结果的格式化
3. 二次LLM调用时工具结果的传递

运行方式：
cd /Volumes/NVME_1T_ORI/my_git/abm-llm-v2/backend
python -m tests.model-stream-with-tool-call.test_stream_tool_call
"""

import os
import sys
import json
import httpx
import logging
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 测试工具定义 - 5个工具用于测试连续调用
TEST_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前时间",
            "parameters": {
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "时区，如 Asia/Shanghai"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "读取文件内容",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "文件路径"
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "执行数学计算",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "数学表达式，如 2+3*4"
                    }
                },
                "required": ["expression"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "搜索网页信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词"
                    }
                },
                "required": ["query"]
            }
        }
    }
]

def get_default_model_config():
    """从数据库直接获取默认模型配置（不初始化Flask应用）"""
    try:
        import sqlite3
        
        # 直接连接数据库
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            'data', 'app.db'
        )
        logger.info(f"数据库路径: {db_path}")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 查询默认文本生成模型
        cursor.execute("""
            SELECT name, provider, model_id, base_url, api_key, max_output_tokens 
            FROM model_configs 
            WHERE is_default_text = 1
            LIMIT 1
        """)
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'name': row[0],
                'provider': row[1],
                'model_id': row[2],
                'base_url': row[3],
                'api_key': row[4],
                'max_output_tokens': row[5] or 2000
            }
        else:
            logger.error("未找到默认文本生成模型")
            return None
    except Exception as e:
        logger.error(f"获取模型配置失败: {e}")
        import traceback
        traceback.print_exc()
        return None

def simulate_tool_execution(tool_name: str, arguments: dict) -> str:
    """模拟工具执行"""
    if tool_name == "get_current_time":
        return json.dumps({
            "meta": None,
            "content": [{"type": "text", "text": f"当前时间: {datetime.now().isoformat()}", "annotations": None, "meta": None}],
            "structuredContent": None,
            "isError": False
        })
    elif tool_name == "read_file":
        path = arguments.get("path", "unknown")
        return json.dumps({
            "meta": None,
            "content": [{"type": "text", "text": f"文件内容: 这是 {path} 的模拟内容", "annotations": None, "meta": None}],
            "structuredContent": None,
            "isError": False
        })
    elif tool_name == "get_weather":
        city = arguments.get("city", "未知城市")
        return json.dumps({
            "meta": None,
            "content": [{"type": "text", "text": f"{city}天气: 晴，温度25°C，湿度60%", "annotations": None, "meta": None}],
            "structuredContent": None,
            "isError": False
        })
    elif tool_name == "calculate":
        expression = arguments.get("expression", "0")
        try:
            result = eval(expression)
        except:
            result = "计算错误"
        return json.dumps({
            "meta": None,
            "content": [{"type": "text", "text": f"计算结果: {expression} = {result}", "annotations": None, "meta": None}],
            "structuredContent": None,
            "isError": False
        })
    elif tool_name == "search_web":
        query = arguments.get("query", "")
        return json.dumps({
            "meta": None,
            "content": [{"type": "text", "text": f"搜索'{query}'的结果: 找到10条相关内容，包括教程、文档和示例代码", "annotations": None, "meta": None}],
            "structuredContent": None,
            "isError": False
        })
    else:
        return json.dumps({
            "meta": None,
            "content": [{"type": "text", "text": f"未知工具: {tool_name}"}],
            "isError": True
        })

def send_streaming_request(messages, model_config, headers):
    """发送流式请求并解析响应"""
    request_body = {
        "model": model_config['model_id'],
        "messages": messages,
        "tools": TEST_TOOLS,
        "stream": True,
        "max_tokens": model_config.get('max_output_tokens', 2000),
        "temperature": 0.7
    }
    
    full_content = ""
    tool_calls = []
    current_tool_call = None
    
    with httpx.Client(timeout=120.0) as client:
        with client.stream(
            "POST",
            f"{model_config['base_url']}/chat/completions",
            json=request_body,
            headers=headers
        ) as response:
            logger.info(f"HTTP状态码: {response.status_code}")
            
            if response.status_code != 200:
                error_body = response.read()
                logger.error(f"请求失败: {error_body}")
                return "", []
            
            for line in response.iter_lines():
                if not line or line == "data: [DONE]":
                    continue
                
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        
                        # 处理文本内容
                        if "content" in delta and delta["content"]:
                            content = delta["content"]
                            full_content += content
                            print(content, end="", flush=True)
                        
                        # 处理工具调用
                        if "tool_calls" in delta:
                            for tc in delta["tool_calls"]:
                                # 新的工具调用
                                if tc.get("id"):
                                    if current_tool_call:
                                        tool_calls.append(current_tool_call)
                                    current_tool_call = {
                                        "id": tc["id"],
                                        "type": "function",
                                        "function": {
                                            "name": tc.get("function", {}).get("name", ""),
                                            "arguments": tc.get("function", {}).get("arguments", "")
                                        }
                                    }
                                elif current_tool_call:
                                    # 累积参数
                                    if "function" in tc and "arguments" in tc["function"]:
                                        current_tool_call["function"]["arguments"] += tc["function"]["arguments"]
                                    if "function" in tc and "name" in tc["function"]:
                                        current_tool_call["function"]["name"] += tc["function"]["name"]
                    except json.JSONDecodeError as e:
                        logger.warning(f"JSON解析失败: {line}")
            
            # 添加最后一个工具调用
            if current_tool_call:
                tool_calls.append(current_tool_call)
    
    print()  # 换行
    return full_content, tool_calls


def test_streaming_with_tool_call():
    """测试流式工具调用 - 支持多轮连续调用"""
    model_config = get_default_model_config()
    if not model_config:
        logger.error("无法获取模型配置，退出测试")
        return
    
    logger.info(f"使用模型: {model_config['name']} ({model_config['model_id']})")
    logger.info(f"API URL: {model_config['base_url']}")
    
    # 构建请求 - 设计一个需要多次工具调用的任务
    messages = [
        {"role": "system", "content": "你是一个助手，可以使用工具来帮助用户。你必须完成用户要求的所有任务，每次调用一个工具后继续下一个任务，直到全部完成。"},
        {"role": "user", "content": "请依次完成以下5个任务，每个任务都必须执行：\n1. 调用get_current_time获取当前时间\n2. 调用read_file读取/tmp/test.txt文件\n3. 调用get_weather查询北京天气\n4. 调用calculate计算123*456\n5. 调用search_web搜索'Python教程'\n\n请逐个完成，不要跳过任何一个任务。"}
    ]
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {model_config['api_key']}"
    }
    
    MAX_ROUNDS = 10  # 最大轮次，防止无限循环
    round_num = 0
    total_tool_calls = 0
    
    try:
        while round_num < MAX_ROUNDS:
            round_num += 1
            logger.info("=" * 60)
            logger.info(f"第 {round_num} 轮请求")
            logger.info("=" * 60)
            
            # 打印当前消息历史摘要
            logger.info(f"当前消息历史: {len(messages)} 条")
            for i, msg in enumerate(messages):
                role = msg.get('role')
                if role == 'tool':
                    content_len = len(msg.get('content', ''))
                    logger.info(f"  [{i}] role=tool, tool_call_id={msg.get('tool_call_id')}, content长度={content_len}")
                    if content_len == 0:
                        logger.error(f"      *** 警告: tool消息的content为空! ***")
                elif role == 'assistant' and msg.get('tool_calls'):
                    logger.info(f"  [{i}] role=assistant, tool_calls数量={len(msg.get('tool_calls', []))}, content长度={len(msg.get('content', ''))}")
                else:
                    content = msg.get('content', '')
                    logger.info(f"  [{i}] role={role}, content长度={len(content)}")
            
            # 发送请求
            full_content, tool_calls = send_streaming_request(messages, model_config, headers)
            
            logger.info("-" * 60)
            logger.info(f"第 {round_num} 轮响应完成")
            logger.info(f"文本内容长度: {len(full_content)}")
            logger.info(f"工具调用数量: {len(tool_calls)}")
            
            # 如果没有工具调用，说明任务完成
            if not tool_calls:
                logger.info("=" * 60)
                logger.info(f"任务完成！共进行了 {round_num} 轮对话，{total_tool_calls} 次工具调用")
                logger.info("=" * 60)
                break
            
            total_tool_calls += len(tool_calls)
            
            # 打印工具调用详情
            logger.info("工具调用详情:")
            for i, tc in enumerate(tool_calls):
                logger.info(f"  工具调用 {i+1}: {tc['function']['name']}")
                logger.info(f"    ID: {tc['id']}")
                logger.info(f"    参数: {tc['function']['arguments']}")
            
            # 执行工具调用
            tool_results = []
            for tc in tool_calls:
                try:
                    args = json.loads(tc['function']['arguments']) if tc['function']['arguments'] else {}
                except json.JSONDecodeError:
                    args = {}
                
                result = simulate_tool_execution(tc['function']['name'], args)
                tool_results.append({
                    "tool_call_id": tc['id'],
                    "tool_name": tc['function']['name'],
                    "result": result
                })
                logger.info(f"  执行 {tc['function']['name']}: 结果长度={len(result)}")
            
            # 构建下一轮请求的消息
            # 添加assistant消息（包含工具调用）
            assistant_message = {
                "role": "assistant",
                "content": full_content if full_content else "",
                "tool_calls": tool_calls
            }
            messages.append(assistant_message)
            
            # 添加工具结果消息
            for tr in tool_results:
                tool_message = {
                    "role": "tool",
                    "tool_call_id": tr['tool_call_id'],
                    "content": tr['result']
                }
                messages.append(tool_message)
                
                # 关键检查：content是否为空
                if not tr['result']:
                    logger.error(f"*** 警告: 工具 {tr['tool_name']} 返回空结果! ***")
        
        if round_num >= MAX_ROUNDS:
            logger.warning(f"达到最大轮次限制 ({MAX_ROUNDS})，强制结束")
    
    except Exception as e:
        logger.error(f"请求失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_streaming_with_tool_call()
