#!/usr/bin/env python3
"""
测试使用 OpenAI 和 Anthropic SDK 进行工具调用

目标：
1. 使用官方 SDK 处理工具调用，避免手动解析流式响应中的工具调用
2. SDK 会自动处理工具调用的解析和格式化
3. 保持与前端渲染的兼容性

运行方式：
cd /Volumes/NVME_1T_ORI/my_git/abm-llm-v2/backend
pip install openai anthropic
python tests/model-stream-with-tool-call/test_sdk_tool_call.py
"""

import os
import sys
import json
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 测试工具定义 - OpenAI 格式
TEST_TOOLS_OPENAI = [
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
    }
]

# Anthropic 格式的工具定义
TEST_TOOLS_ANTHROPIC = [
    {
        "name": "get_current_time",
        "description": "获取当前时间",
        "input_schema": {
            "type": "object",
            "properties": {
                "timezone": {
                    "type": "string",
                    "description": "时区，如 Asia/Shanghai"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_weather",
        "description": "获取指定城市的天气信息",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "城市名称"
                }
            },
            "required": ["city"]
        }
    },
    {
        "name": "calculate",
        "description": "执行数学计算",
        "input_schema": {
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
]


def simulate_tool_execution(tool_name: str, arguments: dict) -> str:
    """模拟工具执行"""
    if tool_name == "get_current_time":
        return f"当前时间: {datetime.now().isoformat()}"
    elif tool_name == "get_weather":
        city = arguments.get("city", "未知城市")
        return f"{city}天气: 晴，温度25°C，湿度60%"
    elif tool_name == "calculate":
        expression = arguments.get("expression", "0")
        try:
            result = eval(expression)
        except:
            result = "计算错误"
        return f"计算结果: {expression} = {result}"
    else:
        return f"未知工具: {tool_name}"


def get_model_config():
    """从数据库获取模型配置"""
    import sqlite3
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'data', 'app.db'
    )
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
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
    return None


def test_openai_sdk_streaming():
    """测试 OpenAI SDK 流式工具调用"""
    try:
        from openai import OpenAI
    except ImportError:
        logger.error("请先安装 openai: pip install openai")
        return
    
    config = get_model_config()
    if not config:
        logger.error("无法获取模型配置")
        return
    
    logger.info(f"使用模型: {config['name']} ({config['model_id']})")
    logger.info(f"API URL: {config['base_url']}")
    
    # 创建 OpenAI 客户端
    client = OpenAI(
        api_key=config['api_key'],
        base_url=config['base_url']
    )
    
    messages = [
        {"role": "system", "content": "你是一个助手，可以使用工具来帮助用户。"},
        {"role": "user", "content": "请获取当前时间，查询北京天气，并计算 123*456"}
    ]
    
    logger.info("=" * 60)
    logger.info("测试 OpenAI SDK 流式工具调用")
    logger.info("=" * 60)
    
    MAX_ROUNDS = 5
    round_num = 0
    
    while round_num < MAX_ROUNDS:
        round_num += 1
        logger.info(f"\n--- 第 {round_num} 轮 ---")
        
        # 创建流式响应
        stream = client.chat.completions.create(
            model=config['model_id'],
            messages=messages,
            tools=TEST_TOOLS_OPENAI,
            stream=True
        )
        
        # 收集流式响应
        full_content = ""
        tool_calls = []
        current_tool_call = None
        
        for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue
            
            # 处理文本内容
            if delta.content:
                full_content += delta.content
                print(delta.content, end="", flush=True)
            
            # 处理工具调用
            if delta.tool_calls:
                for tc_delta in delta.tool_calls:
                    # 新的工具调用
                    if tc_delta.id:
                        if current_tool_call:
                            tool_calls.append(current_tool_call)
                        current_tool_call = {
                            "id": tc_delta.id,
                            "type": "function",
                            "function": {
                                "name": tc_delta.function.name if tc_delta.function else "",
                                "arguments": tc_delta.function.arguments if tc_delta.function else ""
                            }
                        }
                    elif current_tool_call:
                        # 累积参数
                        if tc_delta.function:
                            if tc_delta.function.name:
                                current_tool_call["function"]["name"] += tc_delta.function.name
                            if tc_delta.function.arguments:
                                current_tool_call["function"]["arguments"] += tc_delta.function.arguments
        
        # 添加最后一个工具调用
        if current_tool_call:
            tool_calls.append(current_tool_call)
        
        print()  # 换行
        
        logger.info(f"文本内容长度: {len(full_content)}")
        logger.info(f"工具调用数量: {len(tool_calls)}")
        
        # 如果没有工具调用，完成
        if not tool_calls:
            logger.info("任务完成！")
            break
        
        # 添加 assistant 消息
        assistant_message = {
            "role": "assistant",
            "content": full_content if full_content else None,
            "tool_calls": tool_calls
        }
        messages.append(assistant_message)
        
        # 执行工具调用并添加结果
        for tc in tool_calls:
            tool_name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"]) if tc["function"]["arguments"] else {}
            except:
                args = {}
            
            result = simulate_tool_execution(tool_name, args)
            logger.info(f"执行工具 {tool_name}: {result}")
            
            # 添加工具结果消息
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result
            })
    
    logger.info("=" * 60)
    logger.info("OpenAI SDK 测试完成")
    logger.info("=" * 60)


def test_anthropic_sdk_streaming():
    """测试 Anthropic SDK 流式工具调用"""
    try:
        import anthropic
    except ImportError:
        logger.error("请先安装 anthropic: pip install anthropic")
        return
    
    config = get_model_config()
    if not config:
        logger.error("无法获取模型配置")
        return
    
    # 检查是否是 Anthropic 模型
    if 'claude' not in config['model_id'].lower():
        logger.warning(f"当前模型 {config['model_id']} 可能不是 Anthropic 模型，跳过测试")
        return
    
    logger.info(f"使用模型: {config['name']} ({config['model_id']})")
    
    # 创建 Anthropic 客户端
    # 注意：Anthropic SDK 需要原生 API，不支持 OpenAI 兼容端点
    # 如果使用代理，需要设置 base_url
    client = anthropic.Anthropic(
        api_key=config['api_key'],
        base_url=config['base_url'].replace('/v1', '') if '/v1' in config['base_url'] else config['base_url']
    )
    
    messages = [
        {"role": "user", "content": "请获取当前时间，查询北京天气，并计算 123*456"}
    ]
    
    logger.info("=" * 60)
    logger.info("测试 Anthropic SDK 流式工具调用")
    logger.info("=" * 60)
    
    MAX_ROUNDS = 5
    round_num = 0
    
    while round_num < MAX_ROUNDS:
        round_num += 1
        logger.info(f"\n--- 第 {round_num} 轮 ---")
        
        try:
            # 创建流式响应
            with client.messages.stream(
                model=config['model_id'],
                max_tokens=config['max_output_tokens'],
                messages=messages,
                tools=TEST_TOOLS_ANTHROPIC
            ) as stream:
                # 收集响应
                full_content = ""
                tool_uses = []
                
                for event in stream:
                    if hasattr(event, 'type'):
                        if event.type == 'content_block_delta':
                            if hasattr(event.delta, 'text'):
                                full_content += event.delta.text
                                print(event.delta.text, end="", flush=True)
                        elif event.type == 'content_block_start':
                            if hasattr(event.content_block, 'type') and event.content_block.type == 'tool_use':
                                tool_uses.append({
                                    "id": event.content_block.id,
                                    "name": event.content_block.name,
                                    "input": {}
                                })
                        elif event.type == 'content_block_delta':
                            if hasattr(event.delta, 'partial_json') and tool_uses:
                                # 累积工具参数
                                pass
                
                # 获取最终消息
                final_message = stream.get_final_message()
                
                # 从最终消息中提取工具调用
                tool_uses = []
                for block in final_message.content:
                    if block.type == 'tool_use':
                        tool_uses.append({
                            "id": block.id,
                            "name": block.name,
                            "input": block.input
                        })
                    elif block.type == 'text':
                        if not full_content:
                            full_content = block.text
                
                print()  # 换行
                
                logger.info(f"文本内容长度: {len(full_content)}")
                logger.info(f"工具调用数量: {len(tool_uses)}")
                
                # 如果没有工具调用，完成
                if not tool_uses:
                    logger.info("任务完成！")
                    break
                
                # 添加 assistant 消息
                messages.append({
                    "role": "assistant",
                    "content": final_message.content
                })
                
                # 执行工具调用并添加结果
                tool_results = []
                for tu in tool_uses:
                    result = simulate_tool_execution(tu["name"], tu["input"])
                    logger.info(f"执行工具 {tu['name']}: {result}")
                    
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu["id"],
                        "content": result
                    })
                
                # 添加工具结果消息
                messages.append({
                    "role": "user",
                    "content": tool_results
                })
                
        except Exception as e:
            logger.error(f"Anthropic SDK 调用失败: {e}")
            import traceback
            traceback.print_exc()
            break
    
    logger.info("=" * 60)
    logger.info("Anthropic SDK 测试完成")
    logger.info("=" * 60)


def test_openai_sdk_with_custom_callback():
    """
    测试 OpenAI SDK 流式工具调用，同时支持自定义回调
    这个版本展示如何在使用 SDK 的同时，保持与前端渲染的兼容性
    """
    try:
        from openai import OpenAI
    except ImportError:
        logger.error("请先安装 openai: pip install openai")
        return
    
    config = get_model_config()
    if not config:
        logger.error("无法获取模型配置")
        return
    
    logger.info("=" * 60)
    logger.info("测试 OpenAI SDK + 自定义回调（前端兼容）")
    logger.info("=" * 60)
    
    # 创建 OpenAI 客户端
    client = OpenAI(
        api_key=config['api_key'],
        base_url=config['base_url']
    )
    
    messages = [
        {"role": "system", "content": "你是一个助手，可以使用工具来帮助用户。"},
        {"role": "user", "content": "请获取当前时间，查询北京天气，并计算 123*456"}
    ]
    
    # 模拟前端回调
    def frontend_callback(content=None, meta=None):
        """模拟前端回调，用于渲染"""
        if content:
            # 文本内容 - 直接发送给前端
            print(f"[STREAM] {content}", end="", flush=True)
        if meta:
            # 元数据 - 工具调用信息等
            print(f"\n[META] {json.dumps(meta, ensure_ascii=False)}")
    
    MAX_ROUNDS = 5
    round_num = 0
    
    while round_num < MAX_ROUNDS:
        round_num += 1
        logger.info(f"\n--- 第 {round_num} 轮 ---")
        
        # 创建流式响应
        stream = client.chat.completions.create(
            model=config['model_id'],
            messages=messages,
            tools=TEST_TOOLS_OPENAI,
            stream=True
        )
        
        # 收集流式响应
        full_content = ""
        tool_calls = []
        current_tool_call = None
        
        for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue
            
            # 处理文本内容 - 实时发送给前端
            if delta.content:
                full_content += delta.content
                frontend_callback(content=delta.content)
            
            # 处理工具调用
            if delta.tool_calls:
                for tc_delta in delta.tool_calls:
                    if tc_delta.id:
                        if current_tool_call:
                            tool_calls.append(current_tool_call)
                        current_tool_call = {
                            "id": tc_delta.id,
                            "type": "function",
                            "function": {
                                "name": tc_delta.function.name if tc_delta.function else "",
                                "arguments": tc_delta.function.arguments if tc_delta.function else ""
                            }
                        }
                        # 通知前端：开始工具调用
                        frontend_callback(meta={
                            "type": "tool_call_start",
                            "tool_call_id": tc_delta.id,
                            "tool_name": tc_delta.function.name if tc_delta.function else ""
                        })
                    elif current_tool_call:
                        if tc_delta.function:
                            if tc_delta.function.name:
                                current_tool_call["function"]["name"] += tc_delta.function.name
                            if tc_delta.function.arguments:
                                current_tool_call["function"]["arguments"] += tc_delta.function.arguments
        
        if current_tool_call:
            tool_calls.append(current_tool_call)
        
        print()  # 换行
        
        if not tool_calls:
            logger.info("任务完成！")
            break
        
        # 添加 assistant 消息
        messages.append({
            "role": "assistant",
            "content": full_content if full_content else None,
            "tool_calls": tool_calls
        })
        
        # 执行工具调用
        for tc in tool_calls:
            tool_name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"]) if tc["function"]["arguments"] else {}
            except:
                args = {}
            
            # 通知前端：工具执行中
            frontend_callback(meta={
                "type": "tool_executing",
                "tool_call_id": tc["id"],
                "tool_name": tool_name,
                "arguments": args
            })
            
            result = simulate_tool_execution(tool_name, args)
            
            # 通知前端：工具执行完成
            frontend_callback(meta={
                "type": "tool_result",
                "tool_call_id": tc["id"],
                "tool_name": tool_name,
                "result": result,
                "status": "success"
            })
            
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result
            })
    
    logger.info("=" * 60)
    logger.info("OpenAI SDK + 自定义回调测试完成")
    logger.info("=" * 60)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="测试 SDK 工具调用")
    parser.add_argument("--provider", choices=["openai", "anthropic", "callback", "all"], 
                       default="openai", help="选择测试的提供商")
    args = parser.parse_args()
    
    if args.provider == "openai" or args.provider == "all":
        test_openai_sdk_streaming()
    
    if args.provider == "anthropic" or args.provider == "all":
        test_anthropic_sdk_streaming()
    
    if args.provider == "callback" or args.provider == "all":
        test_openai_sdk_with_custom_callback()
