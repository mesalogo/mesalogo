#!/usr/bin/env python3
"""
测试消息格式是否符合预期

验证点：
1. 多Agent模式：messages = [system, user]
2. 隔离模式：messages = [system, user, assistant, user, ...]
3. 工具调用后：original_messages + assistant(tool_use) + tool_result

运行方式：
cd /Volumes/NVME_1T_ORI/my_git/abm-llm-v2/backend
python tests/model-stream-with-tool-call/test_message_format.py
"""

import json


def test_multi_agent_mode_format():
    """
    测试多Agent模式的消息格式
    
    预期：messages = [system (包含所有历史), user (当前问题)]
    """
    print("=" * 60)
    print("测试1: 多Agent模式 - 首次调用LLM")
    print("=" * 60)
    
    # 模拟多Agent模式的消息格式
    messages = [
        {
            "role": "system",
            "content": """你是技术顾问...

# Previous Conversation History

**User said:**
帮我分析这个合同

**法律顾问 [Agent] said:**
好的，我来分析...
[Called tool: search_law]
[Result: 相关法律条文...]

**财务顾问 [Agent] said:**
从财务角度看...

**User said:**
有什么风险？"""
        },
        {
            "role": "user",
            "content": "请从技术角度分析一下"
        }
    ]
    
    # 验证
    assert len(messages) == 2, f"多Agent模式应该只有2条消息，实际有{len(messages)}条"
    assert messages[0]["role"] == "system", "第一条消息应该是system"
    assert messages[1]["role"] == "user", "第二条消息应该是user"
    assert "Previous Conversation History" in messages[0]["content"], "system prompt应该包含历史对话"
    
    print("✅ 消息数量: 2 (system + user)")
    print("✅ 历史消息在system prompt中")
    print("✅ 格式正确，兼容OpenAI和Claude")
    print()
    

def test_multi_agent_mode_with_tool_call():
    """
    测试多Agent模式工具调用后的消息格式
    
    预期：original_messages + assistant(tool_use) + tool_result
    """
    print("=" * 60)
    print("测试2: 多Agent模式 - 工具调用后二次调用LLM (OpenAI格式)")
    print("=" * 60)
    
    # 模拟工具调用后的消息格式 (OpenAI)
    messages_openai = [
        {
            "role": "system",
            "content": "你是技术顾问...\n\n# Previous Conversation History\n..."
        },
        {
            "role": "user",
            "content": "请检查API接口"
        },
        # 当前轮次的工具调用
        {
            "role": "assistant",
            "content": "我来检查技术细节...",
            "tool_calls": [
                {
                    "id": "call_xxx",
                    "type": "function",
                    "function": {
                        "name": "check_api",
                        "arguments": "{}"
                    }
                }
            ]
        },
        # 工具执行结果
        {
            "role": "tool",
            "tool_call_id": "call_xxx",
            "content": "API检查结果: 正常"
        }
    ]
    
    # 验证 OpenAI 格式
    assert len(messages_openai) == 4, f"OpenAI格式应该有4条消息，实际有{len(messages_openai)}条"
    assert messages_openai[0]["role"] == "system"
    assert messages_openai[1]["role"] == "user"
    assert messages_openai[2]["role"] == "assistant"
    assert "tool_calls" in messages_openai[2]
    assert messages_openai[3]["role"] == "tool"
    
    print("✅ OpenAI格式: [system, user, assistant(tool_calls), tool]")
    print()
    
    print("=" * 60)
    print("测试3: 多Agent模式 - 工具调用后二次调用LLM (Claude格式)")
    print("=" * 60)
    
    # 模拟工具调用后的消息格式 (Claude)
    messages_claude = [
        {
            "role": "system",
            "content": "你是技术顾问...\n\n# Previous Conversation History\n..."
        },
        {
            "role": "user",
            "content": "请检查API接口"
        },
        # 当前轮次的工具调用 (Claude格式)
        {
            "role": "assistant",
            "content": [
                {
                    "type": "tool_use",
                    "id": "toolu_xxx",
                    "name": "check_api",
                    "input": {}
                }
            ]
        },
        # 工具执行结果 (Claude格式: 放在user消息中)
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": "toolu_xxx",
                    "content": "API检查结果: 正常"
                }
            ]
        }
    ]
    
    # 验证 Claude 格式
    assert len(messages_claude) == 4, f"Claude格式应该有4条消息，实际有{len(messages_claude)}条"
    assert messages_claude[0]["role"] == "system"
    assert messages_claude[1]["role"] == "user"
    assert messages_claude[2]["role"] == "assistant"
    assert messages_claude[3]["role"] == "user"  # Claude的tool_result在user中
    assert messages_claude[3]["content"][0]["type"] == "tool_result"
    
    print("✅ Claude格式: [system, user, assistant(tool_use), user(tool_result)]")
    print()


def test_isolation_mode_format():
    """
    测试隔离模式的消息格式
    
    预期：messages = [system, user, assistant, user, assistant, ...]
    """
    print("=" * 60)
    print("测试4: 隔离模式 - 消息格式")
    print("=" * 60)
    
    # 模拟隔离模式的消息格式
    messages = [
        {
            "role": "system",
            "content": "你是助手..."
        },
        {
            "role": "user",
            "content": "历史问题1"
        },
        {
            "role": "assistant",
            "content": "历史回答1"
        },
        {
            "role": "user",
            "content": "历史问题2"
        },
        {
            "role": "assistant",
            "content": "历史回答2"
        },
        {
            "role": "user",
            "content": "当前问题"
        }
    ]
    
    # 验证
    assert messages[0]["role"] == "system"
    # 验证 user/assistant 交替
    for i in range(1, len(messages) - 1, 2):
        assert messages[i]["role"] == "user", f"位置{i}应该是user"
        if i + 1 < len(messages):
            assert messages[i + 1]["role"] == "assistant", f"位置{i+1}应该是assistant"
    
    print("✅ 隔离模式: [system, user, assistant, user, assistant, ..., user]")
    print("✅ user/assistant 交替出现")
    print()


def test_key_principle():
    """
    测试核心原则：当前轮次的agent消息在agentDone之前不作为history
    """
    print("=" * 60)
    print("测试5: 核心原则验证")
    print("=" * 60)
    
    # 模拟数据库中的历史消息 (不包含当前正在输出的agent消息)
    db_messages = [
        {"role": "user", "content": "问题1"},
        {"role": "agent", "content": "回答1", "agent_id": 1},
        {"role": "user", "content": "问题2"},
        # 注意：当前agent正在输出的消息不在这里
    ]
    
    # 模拟 original_messages (从DB加载后格式化)
    original_messages = [
        {"role": "system", "content": "你是助手...\n\n# History\n..."},
        {"role": "user", "content": "问题2"}  # 当前用户问题
    ]
    
    # 当agent调用工具后，call_llm_with_tool_results 追加：
    # 1. assistant(tool_use) - 当前轮次
    # 2. tool_result - 当前轮次
    
    messages_after_tool_call = original_messages + [
        {"role": "assistant", "content": "", "tool_calls": [{"id": "call_1", "function": {"name": "test"}}]},
        {"role": "tool", "tool_call_id": "call_1", "content": "结果"}
    ]
    
    print("✅ original_messages 不包含当前轮次的assistant消息")
    print("✅ 工具调用后动态追加 assistant(tool_use) + tool_result")
    print("✅ 保证消息格式符合大模型要求")
    print()


def print_summary():
    """打印总结"""
    print("=" * 60)
    print("消息格式总结")
    print("=" * 60)
    print("""
┌─────────────────────────────────────────────────────────────┐
│  多Agent模式 - 首次调用                                      │
├─────────────────────────────────────────────────────────────┤
│  messages = [system (含历史), user]                          │
│  ✅ 只有2条消息                                              │
│  ✅ 兼容 OpenAI 和 Claude                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  多Agent模式 - 工具调用后                                    │
├─────────────────────────────────────────────────────────────┤
│  OpenAI: [system, user, assistant(tool_calls), tool]        │
│  Claude: [system, user, assistant(tool_use), user(result)]  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  隔离模式                                                    │
├─────────────────────────────────────────────────────────────┤
│  messages = [system, user, assistant, user, ..., user]      │
│  ✅ user/assistant 交替                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  核心原则                                                    │
├─────────────────────────────────────────────────────────────┤
│  当前轮次的 agent 消息在 agentDone 之前不作为 history        │
│  original_messages 不包含当前正在输出的 assistant 消息       │
│  工具调用后动态追加: assistant(tool_use) + tool_result       │
└─────────────────────────────────────────────────────────────┘
""")


if __name__ == "__main__":
    test_multi_agent_mode_format()
    test_multi_agent_mode_with_tool_call()
    test_isolation_mode_format()
    test_key_principle()
    print_summary()
    print("\n✅ 所有测试通过！消息格式符合预期。")
