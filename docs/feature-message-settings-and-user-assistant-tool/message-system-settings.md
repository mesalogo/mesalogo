# 消息与上下文系统设置说明

本文档说明消息处理和上下文管理相关的系统设置参数。

## 参数概览

### 消息/上下文相关

| 参数 | 默认值 | 类型 | 说明 |
|------|--------|------|------|
| `max_conversation_history_length` | 30 | number | 上下文历史消息长度 |
| `tool_call_context_rounds` | 5 | number | 工具调用后保留的对话轮数 |
| `tool_result_max_length` | 2000 | number | 工具结果截断长度（0=不截断） |
| `split_tool_calls_in_history` | true | boolean | 是否将工具调用拆分为独立历史消息 |
| `include_thinking_content_in_context` | false | boolean | 是否在上下文中包含思考内容 |
| `auto_summarize_context` | true | boolean | 消息数超限时自动总结上下文 |
| `auto_summarize_context_autonomous` | true | boolean | 自主任务中是否自动总结上下文 |
| `store_llm_error_messages` | true | boolean | 是否存储LLM错误消息到会话记录 |

### 工具相关

| 参数 | 默认值 | 类型 | 说明 |
|------|--------|------|------|
| `compress_tool_definitions` | false | boolean | 是否压缩工具定义以减少Token |

### LLM/模型相关

| 参数 | 默认值 | 类型 | 说明 |
|------|--------|------|------|
| `default_model_timeout` | 120 | number | 模型请求超时时间（秒） |
| `streaming_enabled` | true | boolean | 是否启用流式输出 |
| `http_connection_timeout` | 10 | number | HTTP连接超时（秒） |
| `http_read_timeout` | 300 | number | HTTP读取超时（秒） |
| `stream_socket_timeout` | 60 | number | 流式响应Socket超时（秒） |

## 消息处理流程图

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              消息处理与上下文构建流程                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  数据库存储的消息格式                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │ role: agent                                                                      │   │
│  │ content: "我来查看...{"content":null,"meta":{"type":"toolResult",...}}...完成！" │   │
│  │          ~~~~~~~~~~~~ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ~~~~~~~~  │   │
│  │          文本部分     工具调用JSON（嵌入在content中）                   文本部分   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  首次调用 LLM (format_messages_for_llm)                                                  │
│                                                                                          │
│  ┌────────────────────────────────────────┐                                             │
│  │  max_conversation_history_length = 10  │ ◄── 控制从数据库获取多少条历史消息            │
│  └────────────────────────────────────────┘                                             │
│                         │                                                                │
│                         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  _format_message_with_tool_calls()                                               │   │
│  │                                                                                   │   │
│  │  ┌──────────────────────────────────┐                                            │   │
│  │  │  tool_result_max_length = 500    │ ◄── 控制工具结果截断长度                     │   │
│  │  └──────────────────────────────────┘                                            │   │
│  │                                                                                   │   │
│  │  输入: "我来查看...{"content":null,"meta":{"type":"toolResult",...}}...完成！"    │   │
│  │                         │                                                         │   │
│  │                         ▼ 解析JSON + 截断                                         │   │
│  │  输出: "我来查看...                                                               │   │
│  │         [Called tool: list_directory]                                            │   │
│  │         [Result: [FILE] xxx...(truncated)]                                       │   │
│  │         ...完成！"                                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                         │                                                                │
│                         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  构建消息数组: [system, user] 或 [system, ...history..., user]                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  LLM 流式响应 (handle_streaming_response)                                                │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  streaming输出: "好的，我来查询..." + tool_call + tool_result + "查询完成..."     │   │
│  │                                       │              │                           │   │
│  │                                       ▼              ▼                           │   │
│  │                              解析工具调用      执行工具获取结果                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                         │                                                                │
│                         ▼ 需要再次调用LLM处理工具结果                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  二次调用 LLM (call_llm_with_tool_results)                                               │
│                                                                                          │
│  ┌────────────────────────────────────────┐                                             │
│  │  tool_call_context_rounds = 3          │ ◄── 控制保留几轮工具调用历史                 │
│  └────────────────────────────────────────┘                                             │
│                         │                                                                │
│                         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  消息分类:                                                                        │   │
│  │  ┌─────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────┐  │   │
│  │  │ system_msg      │  │ conversation_msgs   │  │ tool_call_history           │  │   │
│  │  │ (系统提示词)     │  │ (普通user/assistant)│  │ (assistant+tool_calls/tool) │  │   │
│  │  │ 全部保留        │  │ 全部保留            │  │ 只保留最近N轮               │  │   │
│  │  └─────────────────┘  └─────────────────────┘  └─────────────────────────────┘  │   │
│  │                                                              │                    │   │
│  │                                                              ▼                    │   │
│  │                                               ┌─────────────────────────────┐    │   │
│  │                                               │ 轮次1: assistant(tool_calls)│    │   │
│  │                                               │        + tool results       │    │   │
│  │                                               │ 轮次2: ...                  │    │   │
│  │                                               │ 轮次3: ... (最近N轮)        │    │   │
│  │                                               └─────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                         │                                                                │
│                         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  + 本轮工具调用 (tool_calls参数)                                                  │   │
│  │  + 本轮工具结果 (tool_results参数)                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 参数作用总结

| 参数 | 作用范围 | 效果 |
|------|----------|------|
| `max_conversation_history_length` | 数据库读取 | 限制获取历史消息条数 |
| `tool_result_max_length` | 历史消息格式化 | 截断工具结果字符长度 |
| `tool_call_context_rounds` | 隔离模式/递归工具调用 | 保留最近N轮工具调用历史 |
| `split_tool_calls_in_history` | 隔离模式 | 拆分工具调用为独立消息 |
| `compress_tool_definitions` | 工具定义构建 | 压缩工具schema节省Token |

## 两种对话模式的差异

系统支持两种对话模式，参数在不同模式下的行为有所不同：

### 多Agent模式（默认）

多个智能体协作，同一时间只有一个智能体回复。

```
┌─────────────────────────────────────────────────────────────────┐
│  messages 数组结构                                               │
├─────────────────────────────────────────────────────────────────┤
│  [0] system: "你是法律顾问...                                    │
│                                                                  │
│              ## 对话历史                                         │
│              **User said:** 帮我查看文件                         │
│              **Agent A said:**                                   │
│                好的，我来查看。                                   │
│                [Called tool: list_directory]                    │
│                [Result: [FILE] doc1.md...]  ◄── tool_result_max_length 截断
│                文件列表如上。                                     │
│              **User said:** 读取doc1"                            │
│                                                                  │
│  [1] user: "读取doc1"                                            │
└─────────────────────────────────────────────────────────────────┘

特点：
- 历史消息（包括工具调用）放在 system prompt 中作为文本
- tool_result_max_length 生效（截断历史工具结果）
- tool_call_context_rounds 不生效（没有独立的工具调用消息）
- split_tool_calls_in_history 不生效
```

### 隔离模式

单智能体对话，历史消息作为独立消息传递。

```
┌─────────────────────────────────────────────────────────────────┐
│  messages 数组结构                                               │
├─────────────────────────────────────────────────────────────────┤
│  [0] system: "你是法律顾问..."                                   │
│  [1] user: "帮我查看文件"                                        │
│  [2] assistant: "好的，我来查看。"                               │
│      tool_calls: [{name: "list_directory", ...}]                │
│  [3] tool: "[FILE] doc1.md, [FILE] doc2.md"  ◄── 独立的tool消息  │
│  [4] assistant: "文件列表如上。"                                 │
│  [5] user: "读取doc1"                                            │
└─────────────────────────────────────────────────────────────────┘

特点：
- 历史消息作为独立的 assistant/tool 消息
- tool_call_context_rounds 生效（控制保留几轮工具调用历史）
- split_tool_calls_in_history 生效（控制是否拆分为独立消息）
```

### 参数在不同模式下的生效情况

| 参数 | 多Agent模式 | 隔离模式 |
|------|------------|---------|
| `max_conversation_history_length` | ✅ 生效 | ✅ 生效 |
| `tool_result_max_length` | ✅ 生效 | ✅ 生效 |
| `tool_call_context_rounds` | ✅ 生效 | ✅ 生效 |
| `split_tool_calls_in_history` | ❌ 不生效 | ✅ 生效 |
| `compress_tool_definitions` | ✅ 生效 | ✅ 生效 |

## 压缩效果实测

以一条包含12次工具调用的消息为例（原始65,292字符）：

| tool_result_max_length | 压缩后长度 | 压缩率 |
|------------------------|-----------|--------|
| 0 (不截断) | 54,273 字符 | 16.9% |
| 100 | 1,838 字符 | 97.2% |
| 500 (默认) | 6,118 字符 | 90.6% |
| 1000 | 10,204 字符 | 84.4% |

## 参数详解与示例

### max_conversation_history_length

**作用**：控制首次调用 LLM 时从数据库获取的 user/agent 历史消息条数。

**示例**：假设数据库中有 50 条历史消息

```
设置 max_conversation_history_length = 10

数据库消息（50条）:
  [1] user: "你好"
  [2] agent: "你好！"
  ...
  [49] user: "帮我查看文件"
  [50] agent: "好的，文件列表..."

实际获取（最近10条）:
  [41] user: "..."
  [42] agent: "..."
  ...
  [49] user: "帮我查看文件"
  [50] agent: "好的，文件列表..."
```

### tool_result_max_length

**作用**：控制历史消息中工具调用结果的最大字符数。

**示例**：假设工具返回了一个很长的文件内容

```
设置 tool_result_max_length = 100

原始工具结果（5000字符）:
  "# 合伙人协议\n\n## 第一条 总则\n\n本协议由以下各方签订...(省略4900字符)"

格式化后（截断到100字符）:
  [Called tool: read_file]
  [Result: # 合伙人协议\n\n## 第一条 总则\n\n本协议由以下各方签订...(truncated)]
```

### tool_call_context_rounds

**作用**：控制隔离模式下，工具调用后二次调用 LLM 时保留多少轮工具调用历史。

**示例**：假设智能体连续调用了 5 次工具

```
设置 tool_call_context_rounds = 2

原始消息历史:
  [system] 你是助手...
  [user] 帮我分析这些文件
  [assistant] 好的，我先列出文件。 tool_calls: [list_directory]
  [tool] [FILE] a.md, b.md, c.md
  [assistant] 我来读取第一个文件。 tool_calls: [read_file("a.md")]
  [tool] # 文件A内容...
  [assistant] 继续读取第二个。 tool_calls: [read_file("b.md")]
  [tool] # 文件B内容...
  [assistant] 读取第三个。 tool_calls: [read_file("c.md")]
  [tool] # 文件C内容...
  [assistant] 最后一个。 tool_calls: [read_file("d.md")]
  [tool] # 文件D内容...

压缩后（只保留最近2轮）:
  [system] 你是助手...
  [user] 帮我分析这些文件
  [assistant] 读取第三个。 tool_calls: [read_file("c.md")]  ◄── 倒数第2轮
  [tool] # 文件C内容...
  [assistant] 最后一个。 tool_calls: [read_file("d.md")]    ◄── 倒数第1轮
  [tool] # 文件D内容...
  + 本轮新的工具调用和结果
```

**注意**：此参数仅在**隔离模式**下生效。多Agent模式下历史工具调用已在system prompt中以文本形式存在。

### split_tool_calls_in_history

**作用**：控制隔离模式下，是否将历史消息中的工具调用拆分为独立的 assistant + tool 消息。

**示例**：

```
数据库中存储的消息:
  role: agent
  content: "我来查看文件。{\"content\":null,\"meta\":{\"type\":\"toolResult\",...}}文件列表如上。"

split_tool_calls_in_history = true 时:
  [assistant] "我来查看文件。" tool_calls: [{name: "list_directory"}]
  [tool] "[FILE] doc1.md, doc2.md"
  [assistant] "文件列表如上。"

split_tool_calls_in_history = false 时:
  [assistant] "我来查看文件。
              [工具调用结果 - list_directory]: [FILE] doc1.md, doc2.md
              文件列表如上。"
```

**注意**：此参数仅在**隔离模式**下生效。

### compress_tool_definitions

**作用**：是否压缩工具定义以减少 Token 消耗。

**示例**：

```
compress_tool_definitions = false（原始）:
{
  "name": "read_file",
  "description": "读取指定路径的文件内容，支持文本文件和二进制文件的读取操作",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "要读取的文件的完整路径，支持相对路径和绝对路径"
      },
      "encoding": {
        "type": "string",
        "description": "文件编码格式，默认为utf-8",
        "default": "utf-8"
      }
    },
    "required": ["path"]
  }
}

compress_tool_definitions = true（压缩后）:
{
  "name": "read_file",
  "description": "读取指定路径的文件内容，支持文本文件和二进制文件的读取操作...",  ◄── 截断到80字符
  "parameters": {
    "type": "object",
    "properties": {
      "path": {"type": "string"},      ◄── 移除description
      "encoding": {"type": "string"}   ◄── 移除description和default
    },
    "required": ["path"]
  }
}
```

## 参数关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                        首次 LLM 调用                              │
├─────────────────────────────────────────────────────────────────┤
│  [system]                                                        │
│  [user] [assistant] ... ← max_conversation_history_length 控制   │
│  [当前 user 消息]                                                 │
│  tools: [...] ← compress_tool_definitions 控制是否压缩            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         LLM 返回 tool_call
                              ↓
                         执行工具
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        二次 LLM 调用                              │
├─────────────────────────────────────────────────────────────────┤
│  [system]                                                        │
│  [user] [assistant] ... ← 普通对话历史（全部保留）                  │
│  [assistant+tool_calls] [tool_results] × N                       │
│       ↑                                                          │
│       └── tool_call_context_rounds 控制保留轮数                   │
│  [本轮 assistant+tool_calls]                                     │
│  [本轮 tool_results] ← tool_result_max_length 控制截断            │
└─────────────────────────────────────────────────────────────────┘
```

## 工具调用消息格式规范

### 核心原则

**当前轮次正在输出的 agent 消息在 agentDone 之前不应该被作为 history。**

这意味着：
- `original_messages` 是从数据库加载的**已完成的历史消息**
- 当前轮次的 `assistant(tool_use)` 和 `user(tool_result)` 需要在流式响应处理时动态追加

### Claude/Anthropic API 消息格式要求

Claude API 对消息格式有严格要求：

1. **必须有 user 消息**：消息历史中必须包含至少一条 `role: user` 的消息
2. **tool_result 必须紧跟 tool_use**：`tool_result` 块必须紧跟在对应的 `tool_use` 块之后
3. **tool_result 放在 user 消息中**：Claude 格式要求所有 `tool_result` 合并到一个 `role: user` 的消息中

### 正确的消息流程

```
首次调用 LLM:
┌─────────────────────────────────────────────────────────────────┐
│  messages = [                                                    │
│    {role: "system", content: "你是助手..."},                     │
│    {role: "user", content: "之前的问题"},      ← 历史消息         │
│    {role: "assistant", content: "之前的回答"}, ← 历史消息         │
│    {role: "user", content: "当前问题"}         ← 当前用户输入     │
│  ]                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    LLM 返回 tool_use (streaming)
                              ↓
                         执行工具
                              ↓
二次调用 LLM (call_llm_with_tool_results):
┌─────────────────────────────────────────────────────────────────┐
│  messages = [                                                    │
│    {role: "system", content: "你是助手..."},                     │
│    {role: "user", content: "之前的问题"},      ← 历史消息         │
│    {role: "assistant", content: "之前的回答"}, ← 历史消息         │
│    {role: "user", content: "当前问题"},        ← 当前用户输入     │
│    {role: "assistant", content: [...tool_use blocks...]},        │
│         ↑ 当前轮次的 assistant 消息（包含 tool_use）              │
│    {role: "user", content: [...tool_result blocks...]}           │
│         ↑ 当前轮次的 tool_result（Claude 格式放在 user 消息中）   │
│  ]                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### OpenAI vs Claude 格式差异

**OpenAI 格式**：
```json
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "当前问题"},
  {"role": "assistant", "content": null, "tool_calls": [{"id": "call_xxx", "function": {...}}]},
  {"role": "tool", "tool_call_id": "call_xxx", "content": "工具结果"}
]
```

**Claude/Anthropic 格式**：
```json
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "当前问题"},
  {"role": "assistant", "content": [{"type": "tool_use", "id": "toolu_xxx", "name": "...", "input": {...}}]},
  {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_xxx", "content": "工具结果"}]}
]
```

### 常见错误及解决方案

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `No user messages found` | 消息历史中没有 user 消息 | 确保 original_messages 包含用户的原始问题 |
| `tool_result block(s) that are not immediately after tool_use` | tool_result 没有紧跟 tool_use | 检查消息顺序，确保 assistant(tool_use) 后紧跟 user(tool_result) |
| `tool_use ids were found without tool_result blocks` | 有 tool_use 但缺少对应的 tool_result | 确保每个 tool_use 都有对应的 tool_result |

### 实现要点

`call_llm_with_tool_results` 函数的正确实现：

```python
def call_llm_with_tool_results(original_messages, tool_calls, tool_results, ...):
    # 1. 直接使用 original_messages（已经是正确的历史消息）
    messages = list(original_messages)
    
    # 2. 追加当前轮次的 assistant 消息（包含 tool_use）
    assistant_message = format_assistant_with_tool_calls(tool_calls, provider)
    messages.append(assistant_message)
    
    # 3. 追加当前轮次的 tool_result
    if provider == 'anthropic':
        # Claude: 所有 tool_result 合并到一个 user 消息
        messages.append({
            "role": "user",
            "content": [{"type": "tool_result", "tool_use_id": id, "content": result} for ...]
        })
    else:
        # OpenAI: 每个 tool_result 作为独立的 tool 消息
        for tool_result in tool_results:
            messages.append({"role": "tool", "tool_call_id": id, "content": result})
    
    # 4. 调用 LLM
    return model_client.send_request(messages=messages, ...)
```

## 推荐配置

### 多智能体场景（默认）

```json
{
    "max_conversation_history_length": 30,
    "tool_call_context_rounds": 5,
    "tool_result_max_length": 2000,
    "compress_tool_definitions": false
}
```

### 节省 Token 场景

```json
{
    "max_conversation_history_length": 10,
    "tool_call_context_rounds": 2,
    "tool_result_max_length": 500,
    "compress_tool_definitions": true
}
```

### 长上下文场景

```json
{
    "max_conversation_history_length": 50,
    "tool_call_context_rounds": 8,
    "tool_result_max_length": 0,
    "compress_tool_definitions": false
}
```

## 相关文件

- `backend/app/services/conversation/message_processor.py` - 消息处理核心逻辑
- `backend/app/services/conversation/stream_handler.py` - 流式响应和工具调用处理
- `backend/app/services/conversation/tool_json_utils.py` - 工具调用 JSON 解析与清理
- `backend/app/services/conversation/tool_definition_builder.py` - 工具定义构建和压缩
- `backend/app/seed_data/seed_data_system_settings.json` - 默认配置值

## 关键实现细节

### 工具调用 JSON 解析与清理

**核心模块**：`backend/app/services/conversation/tool_json_utils.py`

提供以下功能：
- `extract_json_objects(content)` - 从字符串中提取所有 JSON 对象（基于 StackOverflow 最佳实践）
- `is_tool_result_json(obj)` - 判断 JSON 对象是否为工具调用结果
- `extract_tool_result_jsons(content)` - 提取所有工具调用结果 JSON
- `remove_tool_result_jsons(content)` - 移除所有工具调用结果 JSON（保留纯文本）

**使用位置**：

1. **message_processor.py**
   - `_parse_message_segments_with_tool_calls()` - 解析消息段落，识别工具调用
   - `_expand_assistant_message_with_tool_calls()` - 扩展消息为标准格式

2. **stream_handler.py**
   - `handle_streaming_response()` - 清理当前流式输出中的 JSON
   - `call_llm_with_tool_results()` - 清理历史消息中的 JSON

**重要**：在发送给 LLM 之前，必须清理所有工具调用 JSON，只保留纯文本内容。这样可以防止模型（特别是 Qwen 等中文模型）学习并模仿自定义 JSON 格式。

**实现原理**：

```python
# 1. 提取所有 JSON 对象（支持嵌套）
json_objects = extract_json_objects(content)

# 2. 过滤出工具调用结果
tool_results = [
    (obj, start, end) for obj, start, end in json_objects
    if is_tool_result_json(obj)
]

# 3. 从后往前删除（避免位置偏移）
cleaned = content
for _, start_pos, end_pos in reversed(tool_results):
    cleaned = cleaned[:start_pos] + cleaned[end_pos:]

# 4. 清理多余空行
cleaned = re.sub(r'\n\s*\n\s*\n+', '\n\n', cleaned).strip()
```

**清理时机**：

1. **历史消息读取后** - `_expand_assistant_message_with_tool_calls()`
2. **当前流式输出** - `handle_streaming_response()`
3. **二次 LLM 调用前** - `call_llm_with_tool_results()`

**清理范围**：

- ✓ 所有 `role: assistant` 的消息
- ✓ 当前轮次的流式输出内容
- ✓ 工具调用后的历史消息
- ✗ `role: tool` 的消息（标准格式，不需要清理）
- ✗ `role: user` 的消息（用户输入，不包含 JSON）
