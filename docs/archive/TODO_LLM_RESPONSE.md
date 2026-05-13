# LLM API 消息处理流程文档

本文档描述了系统中处理大语言模型(LLM) API消息的完整流程，包括接收LLM API的响应，处理数据，以及通过SSE将消息转发到前端的各个环节。

## 整体流程概述

```
用户请求 → API路由 → 处理线程 → LLM API请求 → 接收响应 → 解析与转换 → SSE消息队列 → 前端展示
```

## 详细处理流程

### 1. 接收用户请求并初始化

1. 用户通过前端发送请求到后端API端点：`/action-tasks/<task_id>/conversations/<conversation_id>/messages`
2. 请求被路由到`create_conversation_message`函数处理
3. 系统创建消息队列(`result_queue`)用于存储SSE消息
4. 启动新线程执行`ConversationService.process_stream_message`，传入应用上下文和消息队列

### 2. 处理用户消息

1. 在`process_stream_message`中创建用户消息并存入数据库
2. 创建回调函数`sse_callback = ConversationService.wrap_stream_callback(result_queue)`
3. 根据以下规则确定需要响应的智能体：
   - 用户指定的智能体(`target_agent_ids`)
   - 行动任务的模式(`sequential`或默认)
   - 任务配置中的默认智能体

### 3. 发送请求到LLM API

1. 对每个智能体调用`_process_single_agent_response`方法
2. 发送智能体信息的元数据消息通知前端当前响应智能体：
   ```json
   {
     "type": "agentInfo",
     "meta": {
       "turnPrompt": "轮到智能体 XXX 回应",
       "responseOrder": 1,
       "totalAgents": 3,
       "agentId": "123",
       "agentName": "智能体名称(角色名)"
     }
   }
   ```
3. 创建处理内容的回调函数`content_callback`，用于处理LLM的流式响应
4. 调用`send_model_request_stream`向LLM API发送请求，传入上下文和回调函数

### 4. 接收LLM API响应

1. 在`send_model_request_stream`中创建流式HTTP请求到LLM API
2. 使用不同格式适配不同的LLM提供商(OpenAI/Ollama等)：
   ```python
   payload = {
     "model": model_name,
     "messages": messages,
     "stream": True,
     # 其他参数
   }
   ```
3. 发送请求并获取流式响应：`response = requests.post(api_url, ..., stream=True)`
4. 调用`_handle_streaming_response`函数处理流式数据

### 5. 解析和转换LLM API响应

`_handle_streaming_response`函数负责处理不同类型的响应：

1. **解析SSE格式**：
   ```python
   line_text = line.decode('utf-8')
   if line_text.startswith('data: '):
     content = line_text[6:]  # 移除'data: '前缀
   ```

2. **处理[DONE]消息**：
   ```python
   if content.strip() == '[DONE]':
     # 处理结束信号
   ```

3. **处理JSON格式响应**：
   ```python
   chunk = json.loads(content)
   # 处理不同提供商的格式差异
   ```

4. **提取内容增量**：
   - OpenAI格式: `chunk['choices'][0]['delta']['content']`
   - Ollama格式: `chunk['response']`

5. **处理特殊工具调用**：
   - 解析工具调用开始和参数：`chunk['choices'][0]['delta']['tool_calls']`
   - 解析自定义XML格式工具调用：`<tool_call name="工具名">参数</tool_call>`

### 6. 转换为统一消息格式

系统将不同类型的内容转换为统一的消息格式：

#### 文本内容消息处理
```python
# 通过content_callback发送
callback({"content": chunk})
# 转换为SSE JSON格式
{"content": "文本内容", "meta": null}
```

#### 工具调用处理
```python
# 工具调用开始
callback(json.dumps({
  "content": None,
  "meta": {
    "ToolCallAction": {
      "Function": func_name,
      "Arguments": arguments
    },
    "toolCallId": id,
    "status": "pending"
  }
}))

# 工具调用结果
callback(json.dumps({
  "content": None,
  "meta": {
    "ToolCallResult": result,
    "toolName": func_name,
    "toolCallId": id,
    "status": status
  }
}))
```

#### 状态消息处理
```python
callback({
  "connectionStatus": "done",
  "responseObj": {
    "response": {
      "id": message_id,
      "content": full_content,
      # 其他字段
    }
  }
})
```

### 7. 消息入队与SSE转发

1. 所有处理后的消息被放入`result_queue`：
   ```python
   def callback(content):
     result_queue.put(content)
   ```

2. 在`queue_to_sse`函数中，队列中的消息被转换为SSE格式：
   ```python
   while True:
     message = result_queue.get()
     if message is None:  # 结束信号
       yield "data: \n\n"
       break

     if isinstance(message, dict):
       message = json.dumps(message, ensure_ascii=False)
     
     yield f"data: {message}\n\n"
   ```

3. SSE消息通过HTTP响应流式传输到前端

### 8. 响应完成处理

1. 将完整生成的内容存入数据库：
   ```python
   agent_message = Message(
     content=api_response,
     # 其他字段
   )
   db.session.add(agent_message)
   db.session.commit()
   ```

2. 发送完成状态消息：
   ```python
   sse_callback({
     "connectionStatus": "done" if result_queue else "agentDone",
     "responseObj": response_object
   })
   ```

3. 结束消息队列：`result_queue.put(None)`

## 关键组件与职责

### 1. 消息转换链路

```
LLM API → _handle_streaming_response → content_callback → sse_callback → result_queue → queue_to_sse → 前端
```

### 2. 主要处理函数

| 函数名 | 职责 |
|-------|------|
| `process_stream_message` | 总体处理流程协调 |
| `_process_single_agent_response` | 处理单个智能体响应 |
| `content_callback` | 处理LLM内容片段 |
| `_handle_streaming_response` | 解析LLM API流式响应 |
| `wrap_stream_callback` | 包装回调函数写入队列 |
| `queue_to_sse` | 将队列消息转换为SSE格式 |
| `_execute_tool_call` | 执行工具调用 |
| `parse_tool_calls` | 解析工具调用格式 |

### 3. 数据流转换示意

```
         ┌─────────────┐
         │  LLM API    │
         └──────┬──────┘
                ▼
         ┌─────────────┐
         │ 解析原始响应  │  ←── _handle_streaming_response
         └──────┬──────┘
                ▼
┌───────────────────────────┐
│       消息类型判断         │
└───┬─────────┬─────────┬───┘
    ▼         ▼         ▼
┌──────┐  ┌──────┐  ┌──────┐
│ 文本  │  │ 工具  │  │ 状态 │
│ 内容  │  │ 调用  │  │ 消息 │
└───┬──┘  └───┬──┘  └───┬──┘
    │         │         │
    ▼         ▼         ▼
┌───────────────────────────┐
│    统一消息格式转换        │  ←── content_callback, sse_callback
└───────────┬───────────────┘
            ▼
    ┌───────────────┐
    │  消息队列     │  ←── result_queue
    └───────┬───────┘
            ▼
    ┌───────────────┐
    │  SSE格式转换  │  ←── queue_to_sse
    └───────┬───────┘
            ▼
    ┌───────────────┐
    │     前端      │
    └───────────────┘
```

## 注意事项

1. 不同的LLM提供商(OpenAI/Ollama)返回的格式不同，需要针对性处理
2. 工具调用支持两种格式：官方JSON格式和自定义XML格式
3. 错误处理贯穿整个流程，确保异常情况下也能向前端返回有意义的信息
4. 消息队列使用None作为结束信号
5. 统一消息格式确保前端能一致处理不同类型的消息 