# 问题：历史消息中工具调用结果的 content 为空

## 状态：已修复

## 问题描述

在多轮工具调用场景中，当从历史消息重建对话上下文时，部分 `tool` 角色消息的 `content` 字段为空字符串，导致 LLM 无法获取工具执行结果。

## 设计背景

系统采用**富格式存储**策略：
- 存储时保留完整的展示信息（方便前端直接读取展示）
- 用于 LLM 调用时，需要从富格式中**提取**原始内容

## 问题表现

### 日志中的异常数据

```json
{
  "role": "assistant",
  "content": "",
  "tool_calls": [
    {
      "id": "tooluse_fJC-TbYMS7Oabh2Sx1FxZg",
      "type": "function",
      "function": {
        "name": "edit_file",
        "arguments": "{...}"
      }
    }
  ]
},
{
  "role": "tool",
  "tool_call_id": "tooluse_fJC-TbYMS7Oabh2Sx1FxZg",
  "content": ""  // <-- 这里是空的！
}
```

### 实际情况

工具调用结果实际上存在于数据库中，格式为内嵌在 assistant 消息 content 中的 JSON：

```json
{
  "role": "assistant",
  "content": "文件读取成功！现在让我使用 `edit_file` 工具来添加第三次编辑内容：{\"content\": null, \"meta\": {\"type\": \"toolResult\", \"role\": \"tool\", \"content\": \"{...实际的工具结果...}\", \"tool_call_id\": \"tooluse_fJC-TbYMS7Oabh2Sx1FxZg\", \"tool_name\": \"edit_file\", \"tool_parameter\": \"{...}\", \"status\": \"success\"}}"
}
```

## 问题根源分析

### 数据流程

1. **工具执行阶段**（第一次调用）
   - `execute_and_format_tool_call()` 执行工具
   - `format_tool_result_as_role()` 格式化结果为 SSE 消息
   - 结果以 JSON 格式内嵌在 assistant 消息的 content 中
   - 保存到数据库

2. **历史消息加载阶段**（后续调用）
   - `message_processor.py` 的 `_expand_assistant_message_with_tool_calls()` 解析历史消息
   - `_parse_message_segments_with_tool_calls()` 提取工具调用结果
   - 从 `meta.content` 获取工具结果内容
   - 构建 OpenAI 格式的 tool 消息

3. **二次 LLM 调用阶段**
   - `stream_handler.py` 的 `call_llm_with_tool_results()` 构建消息历史
   - 从 `recent_tool_history` 获取历史工具调用轮次
   - **问题**：历史轮次中的 tool 消息 content 为空

### 关键代码位置

#### 1. 解析工具结果（message_processor.py）

```python
def _parse_message_segments_with_tool_calls(content):
    # 从消息内容中提取 JSON 对象
    json_objects = extract_json_objects(content)
    
    # 过滤出工具调用结果
    for obj, start_pos, end_pos in json_objects:
        if (isinstance(obj, dict) and
            obj.get('content') is None and
            isinstance(obj.get('meta'), dict) and
            obj['meta'].get('type') == 'toolResult' and
            obj['meta'].get('role') == 'tool'):
            
            meta = obj['meta']
            tool_call_id = meta.get('tool_call_id', str(uuid.uuid4()))
            tool_name = meta.get('tool_name', 'unknown_tool')
            tool_content = meta.get('content', '')  # <-- 从这里获取
            tool_parameter = meta.get('tool_parameter', '{}')
            
            # 添加工具调用结果段落
            segments.append({
                'type': 'tool_result',
                'content': tool_content,  # <-- 传递给 segment
                'tool_call': tool_call
            })
```

#### 2. 构建 tool 消息（message_processor.py）

```python
def _expand_assistant_message_with_tool_calls(msg, split_tool_calls=True):
    message_segments = _parse_message_segments_with_tool_calls(message_content)
    
    for segment in message_segments:
        if segment['type'] == 'tool_result':
            # 创建 tool 消息
            tool_message = {
                "role": "tool",
                "tool_call_id": segment['tool_call']['id'],
                "content": segment['content']  # <-- 使用 segment['content']
            }
            expanded_messages.append(tool_message)
```

#### 3. 二次 LLM 调用（stream_handler.py）

```python
def call_llm_with_tool_results(original_messages, tool_calls, tool_results, api_config, callback):
    # 分离历史消息
    for msg in original_messages:
        role = msg.get('role')
        if role == 'tool':
            # OpenAI 格式的工具结果
            if current_tool_assistant:
                current_tool_results.append(msg)  # <-- 直接添加历史 tool 消息
    
    # 添加历史工具调用轮次
    for tool_assistant, tool_results in recent_tool_history:
        minimal_messages.append(tool_assistant)
        minimal_messages.extend(tool_results)  # <-- 这里的 tool_results 是历史消息
    
    # 添加当前轮次的工具结果
    for i, tool_call in enumerate(tool_calls):
        if i < len(tool_results):
            tool_result = tool_results[i]
            result_content = tool_result.get("result", "")  # <-- 当前轮次用 "result" 字段
            tool_result_message = {
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": result_content
            }
```

## 问题原因

**数据结构不一致**：

1. **当前轮次的工具结果**：来自 `execute_and_format_tool_call()`，格式为：
   ```python
   {
       "result": "工具执行结果",
       "tool_call_id": "xxx",
       "tool_name": "xxx"
   }
   ```

2. **历史轮次的工具结果**：来自 `recent_tool_history`，格式为 OpenAI 标准：
   ```python
   {
       "role": "tool",
       "tool_call_id": "xxx",
       "content": ""  # <-- 这里可能为空
   }
   ```

**根本原因**：在 `_parse_message_segments_with_tool_calls()` 中，`meta.get('content', '')` 获取的内容可能为空，因为：

1. 工具结果的实际内容在 `meta.content` 中是一个**复杂的 JSON 字符串**
2. 这个 JSON 字符串需要进一步解析才能获取真正的结果
3. 但是代码直接使用了 `meta.get('content', '')`，没有进一步处理

## 实际数据格式

从日志中可以看到，`meta.content` 的实际格式是：

```json
{
  "meta": null,
  "content": [
    {
      "type": "text",
      "text": "````diff\n...(实际的工具结果)...\n````"
    }
  ],
  "structuredContent": null,
  "isError": false
}
```

所以 `meta.get('content')` 返回的是这个 JSON 字符串，而不是最终的文本结果。

## 解决方案

### ✅ 已实施：方案 1 - 修复解析逻辑

**修改文件**：`backend/app/services/conversation/message_processor.py`

**修改位置**：`_parse_message_segments_with_tool_calls()` 函数中的工具结果解析部分

**修复内容**：

```python
# 解析工具调用结果
try:
    meta = obj['meta']
    tool_call_id = meta.get('tool_call_id', str(uuid.uuid4()))
    tool_name = meta.get('tool_name', 'unknown_tool')
    tool_content = meta.get('content', '')
    tool_parameter = meta.get('tool_parameter', '{}')

    # 如果 content 是 JSON 字符串，需要进一步解析提取实际文本
    if isinstance(tool_content, str) and tool_content.strip().startswith('{'):
        try:
            content_obj = json.loads(tool_content)
            # MCP 工具返回格式: {"meta": null, "content": [{"type": "text", "text": "..."}], ...}
            if isinstance(content_obj, dict) and 'content' in content_obj:
                content_list = content_obj['content']
                if isinstance(content_list, list) and len(content_list) > 0:
                    # 提取所有 text 字段并合并
                    text_parts = []
                    for item in content_list:
                        if isinstance(item, dict) and 'text' in item:
                            text_parts.append(item['text'])
                    if text_parts:
                        tool_content = '\n'.join(text_parts)
                        logger.debug(f"[工具调用解析] 从 MCP 格式中提取文本，长度: {len(tool_content)}")
        except json.JSONDecodeError:
            # 如果解析失败，保持原始内容
            logger.debug(f"[工具调用解析] content 不是有效的 JSON，保持原始内容")
            pass

    # 创建工具调用对象
    tool_call = {
        "id": tool_call_id,
        "type": "function",
        "function": {
            "name": tool_name,
            "arguments": tool_parameter
        }
    }

    # 添加工具调用结果段落
    segments.append({
        'type': 'tool_result',
        'content': tool_content,
        'tool_call': tool_call
    })

    logger.debug(f"解析到工具调用结果段落: {tool_name}, 位置: {start_pos}-{end_pos}, 内容长度: {len(tool_content)}")
```

**修复说明**：

1. 识别 `meta.content` 是 JSON 字符串的情况
2. 解析 MCP 工具返回的标准格式：`{"meta": null, "content": [{"type": "text", "text": "..."}], ...}`
3. 提取所有 `text` 字段并合并为最终的工具结果内容
4. 如果解析失败，保持原始内容不变
5. 添加调试日志，记录提取的内容长度

**效果**：

- 修复了历史消息中 tool 角色消息 content 为空的问题
- 支持 MCP 工具的标准返回格式
- 向后兼容纯文本格式的工具结果

### 其他可选方案（未实施）

#### 方案 2：统一数据格式

修改 `format_tool_result_as_role()` 的输出格式，直接在 `meta.content` 中存储纯文本结果，而不是复杂的 JSON 结构。

**优点**：从源头解决问题
**缺点**：需要修改多个地方，可能影响现有功能

#### 方案 3：在构建历史消息时处理

在 `call_llm_with_tool_results()` 中，检查历史 tool 消息的 content 是否为空，如果为空则尝试从原始消息中重新解析。

**优点**：不影响消息存储格式
**缺点**：需要在每次构建历史时重新解析，性能开销较大

## 影响范围

- 多轮工具调用场景
- 工具调用历史超过 1 轮时
- 特别是 `tool_call_context_rounds > 1` 的配置

## 测试用例

需要测试以下场景：

1. 单轮工具调用（当前正常）
2. 多轮工具调用，每轮都有工具结果
3. 工具调用结果包含大量文本
4. 工具调用结果为空或错误

## 相关文件

- `backend/app/services/conversation/message_processor.py`
- `backend/app/services/conversation/stream_handler.py`
- `backend/app/services/conversation/message_formater.py`
- `backend/app/services/conversation/tool_call_executor.py`
