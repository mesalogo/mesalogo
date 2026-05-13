# 消息流转路径文档

本文档描述了系统中所有主要的消息流转路径，从生产者到API调用，再到最终接收者。文档按照不同的功能场景组织，每个场景包含完整的数据流转路径和相关的消息格式。

## 相关文档

- [消息协议文档](MESSAGE_FORMAT.md) - 详细的消息格式规范
- [工具调用数据包协议](TOOL_CALL_PROTOCOL.md) - 工具调用的完整协议规范
- [LLM响应处理文档](TODO_LLM_RESPONSE.md) - LLM API响应的处理流程

## 1. 用户发送消息流程

### 基本流程

**生产者**: 用户输入框
**API调用**: `conversationAPI.sendConversationMessageStream()`
**后端路由**: `/api/action-tasks/<task_id>/conversations/<conversation_id>/messages?stream=1`
**处理流程**:
```
用户输入框
-> sendConversationMessageStream(task_id, conversation_id, messageData, handleStreamResponse)
-> /action-tasks/<task_id>/conversations/<conversation_id>/messages?stream=1
-> process_stream_message(app_context, task_id, conversation_id, message_data, result_queue)
-> _process_single_agent_response(agent_id, message_id, prompt, sse_callback)
-> LLM API
-> content_callback(chunk)
-> sse_callback({"content": chunk})
-> result_queue.put(content)
-> queue_to_sse(result_queue)
-> yield f"data: {message}\n\n"
-> handleStreamResponse(content, meta)
-> setCurrentStreamingResponse(prev => prev + content)
-> 对话消息框显示流式响应
```

### 消息格式

1. **文本内容消息**:
   ```json
   {"content": "智能体回复的文本内容片段", "meta": null}
   ```

2. **智能体信息消息**:
   ```json
   {
     "content": null,
     "meta": {
       "type": "agentInfo",
       "turnPrompt": "轮到智能体回应",
       "agentId": "123",
       "agentName": "智能体名称"
     }
   }
   ```

3. **连接状态消息**:
   ```json
   {
     "content": null,
     "meta": {
       "connectionStatus": "done",
       "responseObj": {
         "response": {
           "id": "msg-123",
           "content": "完整回复内容",
           "agent_id": "123",
           "agent_name": "智能体名称"
         }
       }
     }
   }
   ```

### 接收者

- 对话消息框 (`handleStreamResponse`)
- 流式响应显示区域 (`currentStreamingResponse`)

## 2. 自动讨论流程

### 基本流程

**生产者**: 自动讨论按钮
**API调用**: `conversationAPI.startAutoDiscussion()`
**后端路由**: `/api/action-tasks/<task_id>/conversations/<conversation_id>/auto-discussion?stream=1`
**处理流程**:
```
自动讨论按钮
-> startAutoDiscussion(task_id, conversation_id, discussionOptions, handleAutoDiscussionResponse)
-> /action-tasks/<task_id>/conversations/<conversation_id>/auto-discussion?stream=1
-> start_auto_discussion_stream(app_context, task_id, conversation_id, rounds, topic, summarize, result_queue)
-> start_auto_discussion(task_id, conversation_id, rounds, topic, summarize, streaming=True, result_queue=result_queue)
-> 多个智能体轮流生成响应
-> sse_callback(format_agent_info(...))
-> result_queue.put(content)
-> queue_to_sse(result_queue)
-> yield f"data: {message}\n\n"
-> handleAutoDiscussionResponse(content, meta)
-> 对话消息框 + 讨论进度横幅
```

### 消息格式

1. **轮次信息消息**:
   ```json
   {
     "content": null,
     "meta": {
       "roundInfo": {
         "current": 1,
         "total": 3
       }
     }
   }
   ```

2. **智能体信息消息**:
   ```json
   {
     "content": null,
     "meta": {
       "type": "agentInfo",
       "turnPrompt": "轮到智能体回应",
       "responseOrder": 1,
       "totalAgents": 3,
       "agentId": "123",
       "agentName": "智能体名称",
       "round": 1,
       "totalRounds": 3,
       "isSummarizing": false
     }
   }
   ```

3. **虚拟消息**:
   ```json
   {
     "content": "虚拟消息内容",
     "meta": {
       "type": "virtualMessage",
       "isVirtual": true,
       "virtualRole": "human",
       "timestamp": "2023-01-01T12:00:00Z"
     }
   }
   ```

### 接收者

- 对话消息框 (`handleAutoDiscussionResponse`)
- 讨论进度横幅 (`discussionBanner`)
- 流式响应显示区域 (`currentStreamingResponse`)

## 3. 工具调用流程

> **详细协议规范**: 请参考 [工具调用数据包协议文档](TOOL_CALL_PROTOCOL.md) 获取完整的协议规范、错误处理和最佳实践。

### 基本流程

**生产者**: LLM生成的工具调用
**内部调用**: `_execute_tool_call()`
**处理流程**:
```
LLM API
-> handle_streaming_response
-> 检测工具调用 (parse_tool_calls)
-> 发送工具调用消息 (format_tool_call)
-> _execute_tool_call(tool_call)
-> 发送工具调用结果 (format_tool_result_as_role)
-> result_queue.put(content)
-> queue_to_sse(result_queue)
-> yield f"data: {message}\n\n"
-> handleStreamResponse(content, meta)
-> ConversationExtraction组件解析
-> 工具调用卡片渲染
```

### 消息格式

#### 1. 工具调用开始消息 (ToolCallAction)
```json
{
  "content": null,
  "meta": {
    "ToolCallAction": {
      "Function": "工具名称",
      "Arguments": "{\"query\":\"搜索内容\"}"
    },
    "toolCallId": "12345678-1234-1234-1234-123456789abc"
  }
}
```

**注意**: 当前后端实现不包含`status`字段。

#### 2. 工具调用结果消息 (新格式 - role:tool)
```json
{
  "content": null,
  "meta": {
    "type": "toolResult",
    "role": "tool",
    "content": "工具执行结果内容",
    "tool_call_id": "12345678-1234-1234-1234-123456789abc",
    "tool_name": "工具名称",
    "tool_parameter": "{\"query\":\"搜索内容\"}",
    "status": "success"
  }
}
```

#### 3. 工具调用结果消息 (旧格式 - 兼容性)
```json
{
  "content": null,
  "meta": {
    "ToolCallResult": "工具执行结果内容",
    "toolName": "工具名称",
    "toolCallId": "12345678-1234-1234-1234-123456789abc",
    "toolParameter": "{\"query\":\"搜索内容\"}",
    "status": "success"
  }
}
```

#### 4. 工具调用状态值
- `"pending"`: 工具调用正在执行中
- `"success"`: 工具调用成功完成
- `"error"`: 工具调用执行失败
- `"warning"`: 工具调用完成但有警告

#### 5. 工具调用分隔符
```
<!-- LLM开始处理工具调用结果 -->
<!-- LLM处理工具调用结果结束 -->
```

### 接收者

- 工具调用卡片 (`ConversationExtraction` 组件)
- 对话消息框 (最终响应)
- 变量刷新触发器 (检测工具调用结果后触发)

## 4. 取消响应流程

### 基本流程

**生产者**: 停止按钮
**API调用**: `conversationAPI.cancelStreamingResponse()`
**后端路由**: `/api/action-tasks/<task_id>/conversations/<conversation_id>/cancel-stream`
**处理流程**:
```
停止按钮
-> cancelStreamingResponse(agent_id)
-> /action-tasks/<task_id>/conversations/<conversation_id>/cancel-stream
-> cancel_streaming_task(task_id, conversation_id, agent_id)
-> 查找活动的流式任务
-> 向队列发送取消信号
-> 关闭LLM API连接
-> 发送取消完成消息
-> handleStreamResponse(null, {"connectionStatus": "agentDone", ...})
-> 对话消息框显示已取消的消息
```

### 消息格式

1. **取消信号**:
   ```json
   {
     "type": "cancel",
     "agent_id": "123"
   }
   ```

2. **取消完成消息**:
   ```json
   {
     "content": null,
     "meta": {
       "connectionStatus": "agentDone",
       "responseObj": {
         "response": {
           "id": "msg-123",
           "content": "已取消的内容",
           "agent_id": "123",
           "agent_name": "智能体名称",
           "is_cancelled": true
         }
       }
     }
   }
   ```

### 接收者

- 对话消息框 (显示已取消的消息)
- 系统消息 (显示取消通知)

## 5. 思考内容流程

### 基本流程

**生产者**: LLM生成的思考内容
**处理流程**:
```
LLM API
-> handle_streaming_response
-> 检测思考内容标签
-> content_callback(null, {"type": "thinking", ...})
-> sse_callback(format_thinking(...))
-> result_queue.put(content)
-> queue_to_sse(result_queue)
-> yield f"data: {message}\n\n"
-> handleStreamResponse(null, meta)
-> setIsObserving(true)
-> setCurrentObservingContent(prev => prev + meta.content)
-> 对话消息框显示思考内容
```

### 消息格式

1. **思考内容消息**:
   ```json
   {
     "content": null,
     "meta": {
       "type": "thinking",
       "content": "智能体的思考内容",
       "agentId": "123"
     }
   }
   ```

### 接收者

- 对话消息框 (思考内容区域)



## 6. 消息格式化函数

系统使用一系列格式化函数来标准化消息格式，主要包括：

### 后端格式化函数 (backend/app/services/conversation/message_formater.py)

1. `format_text_content(content)` - 格式化纯文本内容
2. `format_agent_info(...)` - 格式化智能体信息
3. `format_connection_status(...)` - 格式化连接状态
4. `format_thinking(...)` - 格式化思考内容
5. `format_tool_call(function_name, arguments, tool_call_id)` - 格式化工具调用开始消息
6. `format_tool_result_as_role(result, tool_name, tool_call_id, tool_parameter, status)` - 格式化工具调用结果为role:tool格式（新格式）
7. `format_virtual_message(...)` - 格式化虚拟消息
8. `format_round_info(...)` - 格式化轮次信息
9. `format_system_message(...)` - 格式化系统消息
10. `format_agent_cancel_done(...)` - 格式化智能体取消完成消息
11. `format_reasoning(...)` - 格式化推理内容（用于Qwen3模型）
12. `format_agent_error_done(...)` - 格式化智能体处理失败但完成的消息
13. `format_all_agents_done(...)` - 格式化所有智能体处理完成的消息
14. `serialize_message(message)` - 将消息对象序列化为JSON字符串

## 7. 消息处理回调函数

系统中的主要回调函数包括：

### 后端回调函数

1. `content_callback(chunk, meta=None)` - 处理LLM生成的内容块
2. `sse_callback(content)` - 将内容放入结果队列
3. `stream_callback(content)` - 流式回调
4. `wrap_stream_callback(result_queue)` - 创建将内容放入队列的回调函数

### 前端回调函数

1. `handleStreamResponse(content, meta)` - 前端处理流式响应
2. `handleAutoDiscussionResponse(content, meta)` - 前端处理自动讨论响应
3. `onUserMessageSent()` - 用户消息发送后的回调（用于变量刷新）

### 工具调用相关回调

1. `_execute_tool_call(tool_call)` - 执行工具调用
2. `parse_tool_calls(content)` - 解析工具调用
3. `inject_partition_identifier(tool_name, arguments, server_id)` - 为图谱增强工具注入分区标识符

## 8. 消息队列与SSE转换

系统使用队列和SSE (Server-Sent Events) 来实现流式传输：

1. `result_queue = queue.Queue()` - 创建消息队列
2. `wrap_stream_callback(result_queue)` - 创建将内容放入队列的回调函数
3. `queue_to_sse(result_queue)` - 将队列中的消息转换为SSE格式
4. `create_sse_response(generator_function)` - 创建SSE响应

## 9. 完整消息流转示例

以下是一个完整的消息流转示例，展示了从用户发送消息到接收智能体响应的整个过程：

```
用户输入 -> 前端UI -> conversationAPI.sendConversationMessageStream() ->
后端API路由 -> 创建消息队列 -> 启动处理线程 ->
LLM API请求 -> 流式响应 -> 解析内容 ->
格式化消息 -> 放入队列 -> 转换为SSE ->
前端接收 -> 解析消息 -> 更新UI -> 用户查看
```

### 消息序列示例（包含工具调用）

1. **连接建立**: `{"content": null, "meta": {"connectionStatus": "connected"}}`
2. **智能体信息**: `{"content": null, "meta": {"type": "agentInfo", "agentId": "123", "agentName": "助手", ...}}`
3. **思考内容**: `{"content": null, "meta": {"type": "thinking", "content": "我需要搜索相关信息", ...}}`
4. **文本内容**: `{"content": "我来帮您搜索相关信息。", "meta": null}`
5. **工具调用开始**: `{"content": null, "meta": {"ToolCallAction": {"Function": "search", "Arguments": "{\"query\":\"关键词\"}"}, "toolCallId": "tool-123", "status": "pending"}}`
6. **工具调用结果**: `{"content": null, "meta": {"type": "toolResult", "role": "tool", "content": "搜索结果内容", "tool_call_id": "tool-123", "tool_name": "search", "status": "success"}}`
7. **更多文本内容**: `{"content": "根据搜索结果，我可以告诉您...", "meta": null}`
8. **响应完成**: `{"content": null, "meta": {"connectionStatus": "done", "responseObj": {"response": {...}}}}`

### 工具调用错误处理示例

1. **工具调用开始**: `{"content": null, "meta": {"ToolCallAction": {...}, "status": "pending"}}`
2. **工具调用失败**: `{"content": null, "meta": {"type": "toolResult", "role": "tool", "content": "工具执行失败：参数错误", "status": "error"}}`
3. **错误处理响应**: `{"content": "抱歉，工具调用失败，让我用其他方式帮您。", "meta": null}`
