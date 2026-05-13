# 工具调用上下文策略分析

## 核心问题

**在工具调用后再次调用LLM时，是否应该包含历史工具调用信息？**

## 当前实现分析

### 当前代码（stream_handler.py 第420-427行）

```python
conversation_msgs = []
for msg in reversed(original_messages):
    # 只收集用户和助手的对话消息
    # 排除工具调用和工具结果消息
    if (msg.get('role') in ['user', 'assistant'] and 
        not msg.get('tool_calls') and  # ← 排除历史工具调用
        msg.get('role') != 'tool'):    # ← 排除历史工具结果
        conversation_msgs.append(msg)
```

### 问题场景

**示例1：引用型问题**
```
轮次1:
- User: "帮我查询知识库A"
- Assistant: [工具调用] query_knowledge(...)
- Tool: [返回3条记录，5000字符]
- Assistant: "我找到了3条相关内容"

轮次2:
- User: "第2条的详细信息是什么？"  ← 引用了轮次1的工具结果
- Assistant: [需要再次调用工具]
```

**当前上下文（缺失关键信息）：**
```json
[
  {"role": "system", "content": "你是..."},
  {"role": "assistant", "content": "我找到了3条相关内容"},  // 只有总结
  {"role": "user", "content": "第2条的详细信息是什么？"},
  // ❌ 缺少：轮次1的工具调用和5000字符的详细结果
]
```

**后果：** LLM 不知道"第2条"指什么，无法正确回答

**示例2：连续工具调用**
```
轮次1:
- User: "分析这个文件"
- Assistant: [工具调用] read_file("contract.md")
- Tool: [返回文件内容]
- Assistant: "文件已读取"

轮次2:
- User: "把刚才的内容保存到摘要文件"
- Assistant: [工具调用] write_file("summary.md", ???)
```

**后果：** LLM 不知道"刚才的内容"是什么，无法正确写入

## 两种策略对比

### 策略A：排除历史工具调用（当前实现）

| 方面 | 评估 | 说明 |
|------|------|------|
| **Token节省** | ⭐⭐⭐⭐⭐ | 70-80% |
| **上下文完整性** | ⭐⭐ | 可能丢失关键信息 |
| **适用场景** | ⭐⭐ | 仅适合工具结果已被完整总结的情况 |
| **用户体验** | ⭐⭐ | 引用型问题可能失败 |

**适用条件：**
- ✅ Assistant 的回复已经**完整总结**了工具结果
- ✅ 用户不会引用之前的工具结果
- ✅ 单次工具调用，无连续依赖

**不适用条件：**
- ❌ Assistant 回复很简短（如"已完成"）
- ❌ 用户可能引用之前的结果（如"第2条"）
- ❌ 连续工具调用有依赖关系

### 策略B：保留历史工具调用

| 方面 | 评估 | 说明 |
|------|------|------|
| **Token节省** | ⭐⭐⭐ | 30-50% |
| **上下文完整性** | ⭐⭐⭐⭐⭐ | 完整保留推理链 |
| **适用场景** | ⭐⭐⭐⭐⭐ | 通用 |
| **用户体验** | ⭐⭐⭐⭐⭐ | 可正确处理引用 |

**优点：**
- ✅ 上下文完整，推理链清晰
- ✅ 可正确处理引用型问题
- ✅ 符合 OpenAI/Anthropic 标准格式
- ✅ 适用于所有场景

**缺点：**
- ⚠️ Token 节省较少（但仍然有30-50%）
- ⚠️ 工具调用过多时可能超限

## 混合策略（推荐）

### 方案1：按轮次保留完整上下文

```python
def get_recent_rounds_complete(original_messages, rounds=2):
    """
    保留最近N轮的完整对话（包括工具调用）
    
    一轮 = user消息 + assistant回复 + [可选的工具调用+结果]
    """
    # 倒序遍历，收集完整的轮次
    current_round = []
    collected_rounds = []
    
    for msg in reversed(original_messages):
        current_round.insert(0, msg)
        
        # 如果是user消息，说明一轮开始
        if msg.get('role') == 'user':
            collected_rounds.insert(0, current_round)
            current_round = []
            
            if len(collected_rounds) >= rounds:
                break
    
    # 展平所有轮次
    result = []
    for round_msgs in collected_rounds:
        result.extend(round_msgs)
    
    return result
```

**效果：**
```json
[
  {"role": "system", "content": "..."},
  // 轮次1 - 完整保留
  {"role": "user", "content": "查询知识库A"},
  {"role": "assistant", "content": "", "tool_calls": [...]},
  {"role": "tool", "tool_call_id": "...", "content": "找到3条记录..."},
  {"role": "assistant", "content": "我找到了3条相关内容"},
  // 轮次2
  {"role": "user", "content": "第2条的详细信息是什么？"},
  // 本轮工具调用
]
```

### 方案2：智能选择性保留

```python
def get_recent_messages_smart(original_messages, rounds=2):
    """
    智能选择：
    - 如果assistant回复很短（<100字符），保留该轮的工具调用
    - 如果assistant回复已经总结了结果，可以省略工具调用
    """
    recent_msgs = []
    
    for msg in get_recent_rounds(original_messages, rounds):
        if msg.get('role') == 'assistant':
            # 检查是否有完整的总结
            if len(msg.get('content', '')) < 100:
                # 回复很短，需要保留对应的工具调用
                recent_msgs.append(msg)
                # TODO: 找到并添加关联的工具调用
            else:
                # 回复较长，认为已经总结了，不需要工具调用
                recent_msgs.append(msg)
        else:
            recent_msgs.append(msg)
    
    return recent_msgs
```

### 方案3：配置化（最灵活）

```python
# 系统配置
TOOL_CALL_CONTEXT_STRATEGY = {
    'strategy': 'recent_rounds_complete',  # or 'text_only' or 'smart'
    'recent_rounds': 2,
    'max_tool_results_per_round': 5,  # 限制单轮工具调用数量
}
```

## 性能对比

### 场景：10轮对话，5次工具调用

| 策略 | 消息数 | 预估Token | 节省 | 功能完整性 |
|------|--------|-----------|------|------------|
| 原始（全部历史） | 40条 | 30,000 | 0% | ⭐⭐⭐⭐⭐ |
| **策略A（只文本）** | 7条 | 8,000 | 73% | ⭐⭐ |
| **策略B（完整2轮）** | 15条 | 15,000 | 50% | ⭐⭐⭐⭐⭐ |
| 策略B（完整1轮）| 10条 | 10,000 | 67% | ⭐⭐⭐⭐ |

## 建议

### 短期（立即修改）

**使用策略B：保留完整的最近2轮对话**

理由：
1. ✅ 仍然有50%的token节省（vs 原始的0%）
2. ✅ 保证功能正确性
3. ✅ 避免引用型问题失败
4. ✅ 实现简单

**代码修改：**
```python
# 将第420-427行修改为：
def get_recent_complete_rounds(original_messages, rounds=2):
    """获取最近N轮的完整对话"""
    messages_by_turn = []
    current_turn = []
    
    for msg in reversed(original_messages):
        if msg.get('role') == 'system':
            continue  # 系统消息单独处理
            
        current_turn.insert(0, msg)
        
        # user消息标志着一轮的开始
        if msg.get('role') == 'user':
            messages_by_turn.insert(0, current_turn)
            current_turn = []
            
            if len(messages_by_turn) >= rounds:
                break
    
    # 展平
    result = []
    for turn in messages_by_turn:
        result.extend(turn)
    
    return result

# 使用
recent_conversation = get_recent_complete_rounds(original_messages, rounds=2)
```

### 中期（可配置）

添加系统配置，允许用户选择策略：

```json
{
  "key": "tool_call_context_strategy",
  "value": "recent_rounds_complete",  
  "options": ["text_only", "recent_rounds_complete", "smart"],
  "description": "工具调用上下文策略"
}
```

### 长期（智能优化）

实现智能选择：
- 分析assistant回复的完整性
- 检测用户问题是否引用了历史内容
- 动态调整保留策略

## 结论

**当前实现（策略A）过于激进**，在某些场景下会导致功能问题。

**建议立即修改为策略B**：保留最近2轮的完整对话（包括工具调用），这样既能保证功能正确性，又能实现50%的token节省。

---

**优先级：** 🔴 高  
**影响范围：** 所有使用工具调用的场景  
**建议修改时间：** 立即
