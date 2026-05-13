#!/usr/bin/env python3
"""
消息格式处理测试脚本

用于测试和调试工具调用前后的消息格式处理，包括：
1. 历史消息格式化和分类
2. 工具调用解析（XML/JSON/OpenAI/Claude格式）
3. Provider格式转换（OpenAI/Claude）
4. 上下文构建验证
5. 从数据库读取真实消息历史
6. 模拟流式输出回调

使用方法：
    # 使用硬编码测试数据
    python test_message_format.py
    
    # 从数据库读取指定会话的消息
    python test_message_format.py --conversation-id <conversation_id>
    
    # 从数据库读取指定任务的消息
    python test_message_format.py --task-id <action_task_id>
    
    # 模拟流式回调
    python test_message_format.py --simulate-stream

运行环境：conda activate abm
必须在backend目录下运行：cd backend && python ../docs/test_message_format.py
"""

import json
import sys
import os
import argparse
import re
from datetime import datetime

# 添加backend路径以便导入模块
# 脚本在docs目录，需要添加backend到路径
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.abspath(os.path.join(script_dir, '../backend'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# 也尝试当前工作目录（如果在backend目录下运行）
cwd = os.getcwd()
if cwd not in sys.path:
    sys.path.insert(0, cwd)

from typing import List, Dict, Any, Optional, Callable

# ============================================================
# 测试数据定义
# ============================================================

# 测试场景1: 纯文本对话历史
SCENARIO_1_PLAIN_MESSAGES = [
    {"role": "system", "content": "你是一个助手"},
    {"role": "user", "content": "你好"},
    {"role": "assistant", "content": "你好！有什么可以帮助你的？"},
    {"role": "user", "content": "今天天气怎么样？"},
]

# 测试场景2: 带tool_calls字段的assistant消息（OpenAI格式）
SCENARIO_2_OPENAI_TOOL_CALLS = [
    {"role": "system", "content": "你是一个助手，可以使用工具"},
    {"role": "user", "content": "帮我查询北京的天气"},
    {
        "role": "assistant",
        "content": "好的，我来帮你查询北京的天气。",
        "tool_calls": [
            {
                "id": "call_abc123",
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "arguments": '{"city": "北京"}'
                }
            }
        ]
    },
    {
        "role": "tool",
        "tool_call_id": "call_abc123",
        "content": '{"temperature": 25, "weather": "晴天"}'
    },
    {"role": "assistant", "content": "北京今天天气晴朗，气温25度。"},
    {"role": "user", "content": "上海呢？"},
]

# 测试场景3: Claude格式的工具调用
SCENARIO_3_CLAUDE_TOOL_CALLS = [
    {"role": "system", "content": "你是一个助手，可以使用工具"},
    {"role": "user", "content": "帮我查询北京的天气"},
    {
        "role": "assistant",
        "content": [
            {"type": "text", "text": "好的，我来帮你查询北京的天气。"},
            {
                "type": "tool_use",
                "id": "toolu_abc123",
                "name": "get_weather",
                "input": {"city": "北京"}
            }
        ]
    },
    {
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": "toolu_abc123",
                "content": '{"temperature": 25, "weather": "晴天"}'
            }
        ]
    },
    {"role": "assistant", "content": "北京今天天气晴朗，气温25度。"},
]

# 测试场景4: 多轮工具调用
SCENARIO_4_MULTI_TOOL_CALLS = [
    {"role": "system", "content": "你是一个助手"},
    {"role": "user", "content": "帮我查询北京和上海的天气"},
    {
        "role": "assistant",
        "content": "好的，我先查询北京的天气。",
        "tool_calls": [
            {"id": "call_1", "type": "function", "function": {"name": "get_weather", "arguments": '{"city": "北京"}'}}
        ]
    },
    {"role": "tool", "tool_call_id": "call_1", "content": '{"temperature": 25, "weather": "晴天"}'},
    {
        "role": "assistant",
        "content": "北京天气查到了，现在查询上海。",
        "tool_calls": [
            {"id": "call_2", "type": "function", "function": {"name": "get_weather", "arguments": '{"city": "上海"}'}}
        ]
    },
    {"role": "tool", "tool_call_id": "call_2", "content": '{"temperature": 28, "weather": "多云"}'},
    {"role": "assistant", "content": "北京25度晴天，上海28度多云。"},
    {"role": "user", "content": "谢谢"},
]

# 测试场景5: full_content包含工具调用文本（XML格式）
SCENARIO_5_XML_TOOL_IN_CONTENT = """好的，我来帮你查询天气。

<tool_call>
<name>get_weather</name>
<arguments>{"city": "北京"}</arguments>
</tool_call>

让我查询一下..."""

# 测试场景6: full_content包含工具调用文本（JSON格式）
SCENARIO_6_JSON_TOOL_IN_CONTENT = """好的，我来帮你查询天气。

{"id": "call_123", "function": {"name": "get_weather", "arguments": "{\\"city\\": \\"北京\\"}"}}

让我查询一下..."""

# 当前streaming的工具调用
CURRENT_TOOL_CALLS = [
    {
        "id": "call_current_1",
        "type": "function",
        "function": {
            "name": "read_file",
            "arguments": '{"path": "/tmp/test.txt"}'
        }
    }
]

CURRENT_TOOL_RESULTS = [
    {
        "tool_call_id": "call_current_1",
        "tool_name": "read_file",
        "result": "文件内容：Hello World"
    }
]


# ============================================================
# 测试函数
# ============================================================

def print_separator(title: str):
    """打印分隔线"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_messages(messages: List[Dict], title: str = "消息列表"):
    """格式化打印消息列表"""
    print(f"\n--- {title} ({len(messages)}条) ---")
    for i, msg in enumerate(messages):
        role = msg.get('role', 'unknown')
        content = msg.get('content', '')
        tool_calls = msg.get('tool_calls')
        
        # 截断长内容
        if isinstance(content, str) and len(content) > 100:
            content_display = content[:100] + "..."
        elif isinstance(content, list):
            content_display = f"[{len(content)} blocks]"
        else:
            content_display = content
            
        print(f"  [{i}] role={role}")
        print(f"      content={content_display}")
        if tool_calls:
            print(f"      tool_calls={len(tool_calls)}个")
            for tc in tool_calls:
                print(f"        - {tc.get('function', {}).get('name')}({tc.get('id')})")


def test_message_classification():
    """测试消息分类逻辑"""
    print_separator("测试1: 消息分类逻辑")
    
    try:
        from app.services.conversation.stream_handler import call_llm_with_tool_results
        print("✓ 成功导入 call_llm_with_tool_results")
    except ImportError as e:
        print(f"✗ 导入失败: {e}")
        print("  请确保在backend目录下运行或正确设置PYTHONPATH")
        return
    
    # 测试消息分类
    test_messages = SCENARIO_4_MULTI_TOOL_CALLS
    print_messages(test_messages, "输入消息")
    
    # 模拟分类逻辑
    system_msg = None
    conversation_messages = []
    tool_call_history = []
    current_tool_assistant = None
    current_tool_results = []
    
    for msg in test_messages:
        role = msg.get('role')
        
        if role == 'system':
            system_msg = msg
        elif role == 'user':
            content = msg.get('content')
            if isinstance(content, list) and any(
                isinstance(item, dict) and item.get('type') == 'tool_result'
                for item in content
            ):
                if current_tool_assistant:
                    current_tool_results.append(msg)
                    tool_call_history.append((current_tool_assistant, current_tool_results))
                    current_tool_assistant = None
                    current_tool_results = []
            else:
                if current_tool_assistant:
                    tool_call_history.append((current_tool_assistant, current_tool_results))
                    current_tool_assistant = None
                    current_tool_results = []
                conversation_messages.append(msg)
        elif role == 'assistant':
            if msg.get('tool_calls'):
                if current_tool_assistant:
                    tool_call_history.append((current_tool_assistant, current_tool_results))
                    current_tool_results = []
                current_tool_assistant = msg
            else:
                if current_tool_assistant:
                    tool_call_history.append((current_tool_assistant, current_tool_results))
                    current_tool_assistant = None
                    current_tool_results = []
                conversation_messages.append(msg)
        elif role == 'tool':
            if current_tool_assistant:
                current_tool_results.append(msg)
    
    if current_tool_assistant:
        tool_call_history.append((current_tool_assistant, current_tool_results))
    
    print("\n--- 分类结果 ---")
    print(f"  系统消息: {'有' if system_msg else '无'}")
    print(f"  普通对话消息: {len(conversation_messages)}条")
    print(f"  工具调用历史: {len(tool_call_history)}轮")
    
    for i, (assistant, results) in enumerate(tool_call_history):
        tool_names = [tc.get('function', {}).get('name') for tc in assistant.get('tool_calls', [])]
        print(f"    轮次{i+1}: {tool_names} -> {len(results)}个结果")


def test_tool_format_converter():
    """测试工具格式转换器"""
    print_separator("测试2: 工具格式转换器")
    
    try:
        from app.services.conversation.tool_format_converter import ToolFormatConverter
        print("✓ 成功导入 ToolFormatConverter")
    except ImportError as e:
        print(f"✗ 导入失败: {e}")
        return
    
    # 测试统一格式的工具调用
    unified_tool_calls = [
        {"id": "call_123", "name": "get_weather", "arguments": {"city": "北京"}},
        {"id": "call_456", "name": "read_file", "arguments": {"path": "/tmp/test.txt"}}
    ]
    
    print("\n--- 统一格式工具调用 ---")
    print(json.dumps(unified_tool_calls, ensure_ascii=False, indent=2))
    
    # 转换为OpenAI格式
    print("\n--- 转换为OpenAI格式 ---")
    openai_msg = ToolFormatConverter.to_provider_assistant_message("我来调用工具", unified_tool_calls, "openai")
    print(json.dumps(openai_msg, ensure_ascii=False, indent=2))
    
    # 转换为Claude格式
    print("\n--- 转换为Claude格式 ---")
    claude_msg = ToolFormatConverter.to_provider_assistant_message("我来调用工具", unified_tool_calls, "anthropic")
    print(json.dumps(claude_msg, ensure_ascii=False, indent=2))


def test_tool_result_formatting():
    """测试工具结果格式化"""
    print_separator("测试3: 工具结果格式化")
    
    try:
        from app.services.conversation.tool_format_converter import ToolFormatConverter
        print("✓ 成功导入 ToolFormatConverter")
    except ImportError as e:
        print(f"✗ 导入失败: {e}")
        return
    
    # 测试工具结果
    tool_results = [
        {"tool_call_id": "call_123", "content": '{"temperature": 25}'},
        {"tool_call_id": "call_456", "content": "文件内容：Hello World"}
    ]
    
    print("\n--- 原始工具结果 ---")
    print(json.dumps(tool_results, ensure_ascii=False, indent=2))
    
    # 转换为OpenAI格式
    print("\n--- OpenAI格式工具结果 ---")
    for result in tool_results:
        openai_result = ToolFormatConverter.to_provider_tool_result(result, "openai")
        print(json.dumps(openai_result, ensure_ascii=False, indent=2))
    
    # 转换为Claude格式
    print("\n--- Claude格式工具结果 ---")
    claude_results = []
    for result in tool_results:
        claude_result = ToolFormatConverter.to_provider_tool_result(result, "anthropic")
        claude_results.append(claude_result)
    # Claude格式需要合并到一个user消息中
    print(json.dumps({"role": "user", "content": claude_results}, ensure_ascii=False, indent=2))


def test_context_building():
    """测试上下文构建"""
    print_separator("测试4: 上下文构建（模拟call_llm_with_tool_results）")
    
    # 模拟原始消息
    original_messages = SCENARIO_2_OPENAI_TOOL_CALLS.copy()
    
    # 模拟当前streaming内容
    full_content = "好的，我来帮你查询上海的天气。"
    
    # 模拟当前工具调用
    tool_calls = CURRENT_TOOL_CALLS
    tool_results = CURRENT_TOOL_RESULTS
    
    print_messages(original_messages, "原始消息历史")
    print(f"\n--- 当前streaming内容 ---\n  {full_content}")
    print(f"\n--- 当前工具调用 ---")
    for tc in tool_calls:
        print(f"  {tc['function']['name']}({tc['id']})")
    
    # 构建新的消息上下文
    messages_with_current = list(original_messages)
    if full_content.strip():
        messages_with_current.append({
            "role": "assistant",
            "content": full_content
        })
    
    print_messages(messages_with_current, "添加当前streaming后的消息")
    
    print("\n--- 说明 ---")
    print("  1. full_content作为普通assistant消息添加（不带tool_calls字段）")
    print("  2. call_llm_with_tool_results内部会单独处理tool_calls和tool_results")
    print("  3. 这样避免了工具调用的重复")


def test_tool_call_parsing():
    """测试工具调用解析"""
    print_separator("测试5: 工具调用解析")
    
    try:
        from app.services.conversation.tool_handler import parse_tool_calls
        print("✓ 成功导入 parse_tool_calls")
    except ImportError as e:
        print(f"✗ 导入失败: {e}")
        return
    
    # 测试XML格式解析
    print("\n--- XML格式工具调用 ---")
    print(f"  输入: {SCENARIO_5_XML_TOOL_IN_CONTENT[:80]}...")
    xml_calls = parse_tool_calls(SCENARIO_5_XML_TOOL_IN_CONTENT)
    print(f"  解析结果: {len(xml_calls)}个工具调用")
    for tc in xml_calls:
        print(f"    - {tc.get('function', {}).get('name')}")
    
    # 测试JSON格式解析
    print("\n--- JSON格式工具调用 ---")
    print(f"  输入: {SCENARIO_6_JSON_TOOL_IN_CONTENT[:80]}...")
    # JSON格式在stream_handler中用正则解析，这里简单测试
    import re
    json_pattern = r'(\{[\s\S]*?"function"\s*:\s*\{[\s\S]*?"name"\s*:\s*"[^"]+?"[\s\S]*?\}[\s\S]*?\})'
    json_matches = re.findall(json_pattern, SCENARIO_6_JSON_TOOL_IN_CONTENT)
    print(f"  解析结果: {len(json_matches)}个匹配")


def test_message_processor():
    """测试消息处理器"""
    print_separator("测试6: 消息处理器（历史消息格式化）")
    
    try:
        from app.services.conversation.message_processor import MessageProcessor
        print("✓ 成功导入 MessageProcessor")
    except ImportError as e:
        print(f"✗ 导入失败: {e}")
        return
    
    # 测试格式化历史消息
    test_messages = SCENARIO_4_MULTI_TOOL_CALLS
    print_messages(test_messages, "输入消息")
    
    # 注意：MessageProcessor需要数据库连接，这里只测试静态方法
    print("\n--- 说明 ---")
    print("  MessageProcessor.format_messages_for_llm() 需要数据库连接")
    print("  实际测试请通过API端点进行")


def test_full_flow_simulation():
    """模拟完整的工具调用流程"""
    print_separator("测试7: 完整流程模拟")
    
    print("""
    完整的工具调用流程：
    
    1. 用户发送消息 -> 构建消息历史 -> 调用LLM
    
    2. LLM返回streaming响应，可能包含：
       - 纯文本内容
       - 工具调用（XML/JSON/OpenAI/Claude格式）
    
    3. 解析工具调用：
       - parse_tool_calls() 解析XML格式
       - 正则解析JSON格式
       - 直接从streaming chunk解析OpenAI/Claude格式
    
    4. 执行工具调用：
       - execute_and_format_tool_call()
       - 结果追加到full_content（序列化的JSON）
    
    5. 再次调用LLM（call_llm_with_tool_results）：
       - 输入：original_messages + full_content + tool_calls + tool_results
       - 消息分类：system / conversation / tool_call_history
       - 压缩：只保留最近N轮工具调用历史
       - 格式转换：根据provider转换为OpenAI/Claude格式
    
    6. LLM返回最终响应
    """)
    
    print("\n--- 关键点 ---")
    print("  1. full_content包含工具结果的JSON字符串，但不会被重复解析执行")
    print("  2. call_llm_with_tool_results通过msg.get('tool_calls')识别工具调用消息")
    print("  3. 纯文本content不会触发工具调用解析")
    print("  4. 工具调用压缩通过tool_call_context_rounds设置控制")


# ============================================================
# 数据库相关函数
# ============================================================

def init_flask_app():
    """初始化Flask应用上下文"""
    try:
        from app import create_app
        app = create_app()
        return app
    except Exception as e:
        print(f"✗ 初始化Flask应用失败: {e}")
        return None


def get_messages_from_db(conversation_id: str = None, action_task_id: str = None, limit: int = 50) -> List[Dict]:
    """从数据库读取消息历史"""
    try:
        from app.models import Message, db
        
        query = Message.query
        
        if conversation_id:
            query = query.filter(Message.conversation_id == conversation_id)
        elif action_task_id:
            query = query.filter(Message.action_task_id == action_task_id)
        else:
            print("✗ 需要指定 conversation_id 或 action_task_id")
            return []
        
        # 按创建时间排序，获取最近的消息
        messages = query.order_by(Message.created_at.desc()).limit(limit).all()
        messages = list(reversed(messages))  # 反转为时间正序
        
        result = []
        for msg in messages:
            msg_dict = {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
                "agent_id": msg.agent_id,
                "source": msg.source,
            }
            # 解析meta中的tool_calls
            if msg.meta:
                if isinstance(msg.meta, str):
                    try:
                        meta = json.loads(msg.meta)
                    except:
                        meta = {}
                else:
                    meta = msg.meta
                if meta.get('tool_calls'):
                    msg_dict['tool_calls'] = meta['tool_calls']
                if meta.get('tool_call_id'):
                    msg_dict['tool_call_id'] = meta['tool_call_id']
            result.append(msg_dict)
        
        return result
    except Exception as e:
        print(f"✗ 读取数据库失败: {e}")
        import traceback
        traceback.print_exc()
        return []


def list_recent_conversations(limit: int = 10) -> List[Dict]:
    """列出最近的会话"""
    try:
        from app.models import Conversation, db
        
        conversations = Conversation.query.order_by(
            Conversation.updated_at.desc()
        ).limit(limit).all()
        
        result = []
        for conv in conversations:
            result.append({
                "id": conv.id,
                "title": conv.title,
                "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
            })
        return result
    except Exception as e:
        print(f"✗ 读取会话列表失败: {e}")
        return []


def list_recent_action_tasks(limit: int = 10) -> List[Dict]:
    """列出最近的任务"""
    try:
        from app.models import ActionTask, db
        
        tasks = ActionTask.query.order_by(
            ActionTask.updated_at.desc()
        ).limit(limit).all()
        
        result = []
        for task in tasks:
            result.append({
                "id": task.id,
                "title": task.title,
                "updated_at": task.updated_at.isoformat() if task.updated_at else None,
            })
        return result
    except Exception as e:
        print(f"✗ 读取任务列表失败: {e}")
        return []


# ============================================================
# 流式回调模拟
# ============================================================

class StreamCallbackSimulator:
    """模拟流式输出回调"""
    
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.chunks = []
        self.tool_calls = []
        self.tool_results = []
        self.full_content = ""
        
    def callback(self, content: str):
        """模拟回调函数"""
        self.chunks.append(content)
        self.full_content += content
        
        if self.verbose:
            # 检测特殊内容
            if content.startswith('{"content":'):
                print(f"  [TOOL_RESULT] {content[:60]}...")
            elif '<tool_call>' in content or '"function"' in content:
                print(f"  [TOOL_CALL] {content[:60]}...")
            else:
                # 普通文本，逐字符显示效果
                print(content, end='', flush=True)
    
    def reset(self):
        """重置状态"""
        self.chunks = []
        self.tool_calls = []
        self.tool_results = []
        self.full_content = ""
    
    def summary(self):
        """输出摘要"""
        print(f"\n\n--- 流式输出摘要 ---")
        print(f"  总chunks数: {len(self.chunks)}")
        print(f"  总字符数: {len(self.full_content)}")
        
        # 检测工具调用
        tool_call_pattern = r'<tool_call>.*?</tool_call>'
        xml_calls = re.findall(tool_call_pattern, self.full_content, re.DOTALL)
        print(f"  XML工具调用: {len(xml_calls)}个")
        
        # 检测工具结果
        tool_result_pattern = r'\{"content":\s*null,\s*"meta":\s*\{"type":\s*"toolResult"'
        results = re.findall(tool_result_pattern, self.full_content)
        print(f"  工具结果: {len(results)}个")


def test_stream_callback_simulation():
    """测试流式回调模拟"""
    print_separator("测试8: 流式回调模拟")
    
    simulator = StreamCallbackSimulator(verbose=True)
    
    # 模拟LLM流式输出
    print("\n--- 模拟流式输出 ---")
    
    # 模拟文本输出
    text_chunks = ["好的", "，", "我来", "帮你", "查询", "天气", "。\n\n"]
    for chunk in text_chunks:
        simulator.callback(chunk)
    
    # 模拟工具调用
    tool_call_chunks = [
        '<tool_call>\n',
        '<name>get_weather</name>\n',
        '<arguments>{"city": "北京"}</arguments>\n',
        '</tool_call>\n'
    ]
    for chunk in tool_call_chunks:
        simulator.callback(chunk)
    
    # 模拟工具结果
    tool_result = json.dumps({
        "content": None,
        "meta": {
            "type": "toolResult",
            "role": "tool",
            "content": '{"temperature": 25}',
            "tool_call_id": "call_123",
            "tool_name": "get_weather",
            "status": "success"
        }
    }, ensure_ascii=False)
    simulator.callback(tool_result)
    
    # 模拟后续文本
    more_text = ["\n\n", "北京", "今天", "天气", "晴朗", "，", "气温", "25度", "。"]
    for chunk in more_text:
        simulator.callback(chunk)
    
    simulator.summary()
    
    print("\n--- full_content内容 ---")
    print(simulator.full_content[:200] + "..." if len(simulator.full_content) > 200 else simulator.full_content)


def test_db_messages(conversation_id: str = None, action_task_id: str = None):
    """测试从数据库读取消息"""
    print_separator("测试9: 从数据库读取消息")
    
    app = init_flask_app()
    if not app:
        return
    
    with app.app_context():
        if not conversation_id and not action_task_id:
            # 列出最近的会话和任务供选择
            print("\n--- 最近的会话 ---")
            conversations = list_recent_conversations(5)
            for conv in conversations:
                print(f"  {conv['id'][:8]}... | {conv['title']} | {conv['updated_at']}")
            
            print("\n--- 最近的任务 ---")
            tasks = list_recent_action_tasks(5)
            for task in tasks:
                print(f"  {task['id'][:8]}... | {task['name']} | {task['updated_at']}")
            
            print("\n提示: 使用 --conversation-id 或 --task-id 参数指定要测试的会话/任务")
            return
        
        # 读取消息
        messages = get_messages_from_db(conversation_id, action_task_id)
        if not messages:
            print("未找到消息")
            return
        
        print(f"\n读取到 {len(messages)} 条消息")
        print_messages(messages, "数据库消息")
        
        # 分析消息格式
        print("\n--- 消息格式分析 ---")
        roles = {}
        has_tool_calls = 0
        has_tool_results = 0
        
        for msg in messages:
            role = msg.get('role', 'unknown')
            roles[role] = roles.get(role, 0) + 1
            if msg.get('tool_calls'):
                has_tool_calls += 1
            if msg.get('tool_call_id') or role == 'tool':
                has_tool_results += 1
        
        print(f"  角色分布: {roles}")
        print(f"  带tool_calls的消息: {has_tool_calls}条")
        print(f"  工具结果消息: {has_tool_results}条")
        
        # 测试消息分类
        print("\n--- 应用消息分类逻辑 ---")
        system_msgs = [m for m in messages if m.get('role') == 'system']
        user_msgs = [m for m in messages if m.get('role') == 'user' or m.get('role') == 'human']
        assistant_msgs = [m for m in messages if m.get('role') == 'assistant']
        tool_msgs = [m for m in messages if m.get('role') == 'tool']
        
        print(f"  系统消息: {len(system_msgs)}条")
        print(f"  用户消息: {len(user_msgs)}条")
        print(f"  助手消息: {len(assistant_msgs)}条")
        print(f"  工具消息: {len(tool_msgs)}条")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='消息格式处理测试脚本')
    parser.add_argument('--conversation-id', '-c', help='指定会话ID从数据库读取消息')
    parser.add_argument('--task-id', '-t', help='指定任务ID从数据库读取消息')
    parser.add_argument('--simulate-stream', '-s', action='store_true', help='运行流式回调模拟测试')
    parser.add_argument('--all', '-a', action='store_true', help='运行所有测试')
    parser.add_argument('--list', '-l', action='store_true', help='列出最近的会话和任务')
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("  消息格式处理测试脚本")
    print("  用于调试工具调用前后的消息格式处理")
    print("=" * 60)
    
    # 根据参数运行不同测试
    if args.list:
        app = init_flask_app()
        if app:
            with app.app_context():
                print("\n--- 最近的会话 ---")
                conversations = list_recent_conversations(10)
                for conv in conversations:
                    print(f"  {conv['id']} | {conv['title']}")
                
                print("\n--- 最近的任务 ---")
                tasks = list_recent_action_tasks(10)
                for task in tasks:
                    print(f"  {task['id']} | {task['name']}")
        return
    
    if args.conversation_id or args.task_id:
        test_db_messages(args.conversation_id, args.task_id)
        return
    
    if args.simulate_stream:
        test_stream_callback_simulation()
        return
    
    # 默认运行所有基础测试
    test_message_classification()
    test_tool_format_converter()
    test_tool_result_formatting()
    test_context_building()
    test_tool_call_parsing()
    test_message_processor()
    test_full_flow_simulation()
    
    if args.all:
        test_stream_callback_simulation()
        test_db_messages()
    
    print("\n" + "=" * 60)
    print("  测试完成")
    print("=" * 60)
    print("\n使用提示:")
    print("  --list, -l              列出最近的会话和任务")
    print("  --conversation-id, -c   从数据库读取指定会话的消息")
    print("  --task-id, -t           从数据库读取指定任务的消息")
    print("  --simulate-stream, -s   运行流式回调模拟测试")
    print("  --all, -a               运行所有测试\n")


if __name__ == "__main__":
    main()
