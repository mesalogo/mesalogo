# 消息协议文档

本文档描述了智能体对话系统中使用的SSE (Server-Sent Events) 消息协议，用于实现实时流式响应。

全部为后端到前端的消息，后端接收到LLM API的消息在TODO_LLM_RESPONSE中。

## 基本消息结构

所有SSE消息都遵循以下JSON格式：

```json
{
  "content": "文本内容或null",
  "meta": {
    // 元数据信息，可选
  }
}
```

### 字段说明

- `content`: 字符串或null
  - 用于传递实际的文本内容（智能体的回复文本）
  - 当消息是元信息或事件时，此字段可能为null

- `meta`: 对象或null
  - 包含与消息相关的元数据和事件信息
  - 当消息仅包含文本内容时，此字段可能为null

## 消息类型

### 1. 文本内容消息

用于传递智能体的实时回复内容。

```json
{
  "content": "智能体回复的文本内容片段",
  "meta": null
}
```

### 2. 智能体信息消息 (agentInfo)

用于通知前端当前正在回应的智能体信息。

```json
{
  "content": null,
  "meta": {
    "type": "agentInfo",
    "turnPrompt": "轮到智能体 物理学教授(物理学教授) 回应",
    "responseOrder": 1,
    "totalAgents": 3,
    "agentId": "123",
    "agentName": "物理学教授(物理学教授)",
    "round": 1,
    "totalRounds": 3,
    "isSummarizing": false
  }
}
```

### 3. 连接状态消息

用于通知前端SSE连接的状态变化。

#### 连接建立

```json
{
  "content": null,
  "meta": {
    "connectionStatus": "connected"
  }
}
```

#### 连接活跃

```json
{
  "content": null,
  "meta": {
    "connectionStatus": "active"
  }
}
```

#### 连接出错

```json
{
  "content": null,
  "meta": {
    "connectionStatus": "error",
    "error": "错误信息描述"
  }
}
```

#### 连接完成

```json
{
  "content": null,
  "meta": {
    "connectionStatus": "done",
    "message": "所有智能体已完成响应",
    "tokenUsage": 100, // 未实现，用于显示模型的token使用情况
    "responseObj": {
      // 可能包含完整的响应对象
    }
  }
}
```

#### 单个智能体响应完成

```json
{
  "content": null,
  "meta": {
    "connectionStatus": "agentDone",
    "tokenUsage": 100, // 未实现，用于显示模型的token使用情况
    "responseObj": {
      "response": {
        "id": "msg-123",
        "content": "智能体的完整回复内容",
        "agent_id": "123",
        "agent_name": "智能体名称",
        "role_name": "角色名称",
        "timestamp": "2023-01-01T12:00:00Z",
        "response_order": 1
      }
    }
  }
}
```

### 4. 思考内容消息 (thinking)

用于传递智能体的思考过程。

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

### 5. 轮次信息消息 (roundInfo)

用于自动讨论模式中通知当前轮次。

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

### 6. 系统消息 (message)

用于传递系统通知消息，主要在自主任务（自动讨论、变量停止）中使用。

#### 消息格式

```json
{
  "content": null,
  "meta": {
    "message": {
      "id": "msg-123",
      "content": "系统消息内容",
      "role": "system",
      "created_at": "2023-01-01T12:00:00Z"
    }
  }
}
```

#### 使用场景

**自动讨论模式**：
- 任务开始提示
- 轮次进度通知
- 任务完成/停止通知

**变量停止模式**：
- 任务开始提示：`"提示：现在开始变量停止模式的自主行动，智能体将持续轮流行动，直到满足停止条件。\n任务主题：{topic}"`
- 停止条件满足：`"提示：停止条件已满足，变量停止任务结束。共进行了 {round_count} 轮行动，第 {i+1} 个智能体发言前停止。"`
- 超时停止：`"提示：达到最大运行时间限制 {max_runtime} 分钟，变量停止任务结束。共进行了 {round_count} 轮行动，第 {i+1} 个智能体发言前停止。"`
- 手动停止：`"提示：变量停止任务被用户手动停止。"`

#### 前端处理逻辑

前端在 `ActionTaskConversation.js` 中处理系统消息：

```javascript
// 处理自动讨论中的消息
if (meta.message) {
  console.log('收到系统消息:', meta.message);

  // 添加系统消息，直接显示而非等待刷新
  const systemMessage = {
    id: meta.message.id || `system-${Date.now()}`,
    role: 'system',
    content: meta.message.content || meta.message, // 优先使用content字段，兼容旧格式
    timestamp: meta.message.created_at || new Date().toISOString()
  };

  updateMessages(prev => [...prev, systemMessage]);
}
```

#### 重要修复说明

**问题**：变量停止自主行动中系统消息显示为空白

**原因**：前端错误地将整个 `meta.message` 对象赋值给 `content` 字段，而不是提取 `meta.message.content`

**修复**：
- 修复前：`content: meta.message` ❌
- 修复后：`content: meta.message.content || meta.message` ✅

**影响**：确保所有系统消息（开始、结束、停止条件满足等）都能正确显示

### 7. 工具调用消息 (ToolCallAction)

用于通知前端智能体发起了工具调用请求。

**注意**: 当前代码实现中，`format_tool_call`函数不包含`status`字段，但前端期望该字段存在。

```json
{
  "content": null,
  "meta": {
    "ToolCallAction": {
      "Function": "工具名称",
      "Arguments": "工具参数（JSON字符串）"
    },
    "toolCallId": "工具调用ID"
  }
}
```

#### 示例

```json
{
  "content": null,
  "meta": {
    "ToolCallAction": {
      "Function": "search_knowledge",
      "Arguments": "{\"query\":\"人工智能发展历史\",\"limit\":10}"
    },
    "toolCallId": "12345678-1234-1234-1234-123456789abc"
  }
}
```

#### 实现差异说明

**当前后端实现**:
- `format_tool_call`函数不包含`status`字段
- 工具调用ID使用标准UUID格式（如：`12345678-1234-1234-1234-123456789abc`）

**文档期望格式**:
- 包含`status: "pending"`字段
- 工具调用ID使用`tool-call-uuid-`前缀格式

**建议统一方案**:
1. 修改`format_tool_call`函数添加`status`字段
2. 或者更新前端代码以适应当前后端格式

### 8. 工具调用结果消息

用于返回工具调用的执行结果。系统支持两种格式：新的role:tool格式和旧的ToolCallResult格式（兼容性）。

#### 8.1 新格式 (role:tool) - 推荐使用

```json
{
  "content": null,
  "meta": {
    "type": "toolResult",
    "role": "tool",
    "content": "工具执行结果（可能是JSON字符串）",
    "tool_call_id": "工具调用ID",
    "tool_name": "工具名称",
    "tool_parameter": "工具调用参数（JSON字符串）",
    "status": "success"
  }
}
```

#### 8.2 旧格式 (ToolCallResult) - 兼容性支持

```json
{
  "content": null,
  "meta": {
    "ToolCallResult": "工具执行结果（可能是JSON字符串）",
    "toolName": "工具名称",
    "toolCallId": "工具调用ID",
    "toolParameter": "工具调用参数（JSON字符串）",
    "status": "success"
  }
}
```

#### 8.3 状态值说明

- `"success"`: 工具调用成功完成
- `"error"`: 工具调用执行失败
- `"warning"`: 工具调用完成但有警告
- `"pending"`: 工具调用正在执行中（仅用于ToolCallAction）

#### 8.4 错误处理示例

```json
{
  "content": null,
  "meta": {
    "type": "toolResult",
    "role": "tool",
    "content": "工具执行失败：参数格式错误",
    "tool_call_id": "tool-call-uuid-123",
    "tool_name": "search_tool",
    "tool_parameter": "{\"invalid_param\":\"value\"}",
    "status": "error"
  }
}
```

### 9. 虚拟消息 (VirtualMessage)

用于自动会话中传递虚拟人物或系统生成的模拟消息。

```json
{
  "content": "虚拟消息内容",
  "meta": {
    "type": "virtualMessage",
    "isVirtual": true,
    "virtualRole": "human",
    "timestamp": "2023-01-01T12:00:00Z",
    "message": {
      "id": "virtual-uuid",
      "content": "虚拟消息内容",
      "role": "human",
      "timestamp": "2023-01-01T12:00:00Z",
      "isVirtual": true
    }
  }
}
```

### 10. 监督者消息 (supervisor)

用于监督者智能体的消息处理，包括监督会话和干预消息。

#### 消息格式

监督者消息使用标准的文本内容格式，通过数据库字段区分：

```json
{
  "content": "监督者回复内容",
  "meta": null
}
```

#### 数据库存储

监督者消息在数据库中的特殊字段：

```python
# Message模型字段
{
  "role": "supervisor",  # 标识为监督者消息
  "source": "supervisorConversation",  # 监督会话
  "agent_id": 123,  # 监督者智能体ID
  "meta": {
    "type": "info"  # 干预消息标识（可选）
  }
}
```

#### 使用场景

**监督会话**：
- 用户向监督者询问或发送消息
- 监督者回复和建议
- `source = "supervisorConversation"`

**监督者干预**：
- 监督者直接参与任务会话
- 对任务进行指导或纠正
- `source = "taskConversation"` + `meta.type = "info"`

#### 前端处理逻辑

前端在 `ActionTaskSupervisor.js` 中处理监督者消息：

```javascript
// 监督者消息显示逻辑
const isHuman = message.role === 'human';
const isSupervisor = message.role === 'supervisor';
const isIntervention = message.meta && message.meta.type === 'info';

// 监督者消息样式
if (isSupervisor && message.agent_id) {
  const agent = supervisorAgents.find(a => a.id === message.agent_id);
  const interventionTag = isIntervention ? '[干预]' : '';
  senderName = `${agent.name}[${agent.role_name}][ID: ${agent.id}]${interventionTag}`;
}
```

#### 消息筛选

前端通过 `source` 字段筛选监督者相关消息：

```javascript
// 获取监督者相关消息
const supervisorMessages = allMessages.filter(msg =>
  msg.source === 'supervisorConversation'
);
```

### 11. 模型测试流 (model stream)

用于模型测试页面显示流式响应。

```json
{
  "choices": [{
    "delta": {
      "content": "模型生成的内容片段"
    }
  }]
}
```

或状态消息:

```json
{
  "status": "connected"
}
```

完成信号:

```
[DONE]
```

## 特殊处理情况

### 1. 前端解析逻辑

前端会按照以下规则解析SSE消息:

1. 如果解析为JSON对象，按以下优先级处理:
   - 如果存在 `content` 字段且不包含 `type` 和 `connectionStatus`: 视为内容消息
   - 如果是字符串类型: 作为纯文本内容处理
   - 如果包含 `connectionStatus` 字段: 作为连接状态消息处理
   - 如果包含 `type` 字段: 作为特殊事件消息处理
   - 其他情况: 作为普通内容处理

2. 如果JSON解析失败，将整个数据作为纯文本内容处理

### 2. 非标准格式兼容

某些API端点可能直接返回特定格式的数据，如模型流式测试API。前端代码已包含对这些格式的兼容逻辑。

## 前端处理流程

1. 前端通过EventSource或fetch API与后端建立SSE连接
2. 接收到每个消息后，解析JSON格式
3. 根据content和meta字段判断消息类型
4. 根据不同类型的消息执行相应的处理逻辑：
   - 文本内容消息：追加到会话界面中的当前响应
   - 智能体信息消息：更新当前响应的智能体信息
   - 连接状态消息：更新连接状态，处理响应完成事件
   - 系统消息：直接添加到消息列表，显示任务状态和通知
   - 监督者消息：在监督者界面显示，支持干预标识
   - 思考内容消息：显示智能体的思考过程
   - 工具调用消息：显示工具调用信息和结果
   - 虚拟消息：显示自动生成的模拟人类消息

## 消息流转过程

```
LLM API → 处理流式响应 → content_callback → sse_callback → result_queue → queue_to_sse → 前端解析 → UI展示
```

## 实现函数对应关系

| 消息类型 | 后端生成函数 | 前端处理函数 |
|---------|-------------|------------|
| 文本内容 | content_callback | onStreamCallback |
| 智能体信息 | sse_callback | onStreamCallback |
| 连接状态 | sse_callback | onStreamCallback |
| 系统消息 | format_system_message | handleStreamResponse |
| 监督者消息 | process_message_common | ActionTaskSupervisor |
| 思考内容 | sse_callback | onStreamCallback |
| 工具调用 | sse_callback | onStreamCallback |
| 虚拟消息 | sse_callback | onStreamCallback |

## 系统消息处理详解

### 后端生成

系统消息通过 `format_system_message` 函数生成：

```python
def format_system_message(message_id: str, content: str, created_at: str) -> Dict[str, Any]:
    return {
        "content": None,
        "meta": {
            "message": {
                "id": message_id,
                "content": content,
                "role": "system",
                "created_at": created_at
            }
        }
    }
```

### 前端处理

前端在 `ActionTaskConversation.js` 的 `handleStreamResponse` 函数中处理：

```javascript
// 检测系统消息
if (meta.message) {
    const systemMessage = {
        id: meta.message.id || `system-${Date.now()}`,
        role: 'system',
        content: meta.message.content || meta.message,
        timestamp: meta.message.created_at || new Date().toISOString()
    };
    updateMessages(prev => [...prev, systemMessage]);
}
```

### 常见问题与解决方案

**问题1：系统消息显示为空白**
- 原因：前端将整个 `meta.message` 对象赋值给 `content`
- 解决：使用 `meta.message.content` 提取实际内容

**问题2：消息ID重复**
- 原因：前端生成随机ID而不使用后端提供的ID
- 解决：优先使用 `meta.message.id`

**问题3：时间戳不一致**
- 原因：前端使用当前时间而不是消息创建时间
- 解决：使用 `meta.message.created_at`

### 测试验证

可以使用以下测试脚本验证系统消息处理：

```bash
python test_system_message_fix.py
```

测试覆盖：
- ✅ 格式化函数正确性
- ✅ 前端处理逻辑
- ✅ 各种消息场景
- ✅ 边缘情况处理

## 监督者消息处理详解

### 核心概念

监督者消息是一种特殊的消息类型，用于实现监督者智能体的功能：

1. **监督者智能体**：`Agent` 模型中 `is_observer=True` 的智能体
2. **消息角色标识**：`role='supervisor'` 标识监督者发送的消息
3. **消息来源区分**：通过 `source` 字段区分监督会话和任务会话
4. **干预标识**：通过 `meta.type='info'` 标识干预消息

### 后端处理

#### 消息创建

监督者消息通过 `process_message_common` 函数处理：

```python
# 监督者消息处理逻辑
def process_message_common(conversation_id, content, target_agent_id, send_target):
    # 检查目标智能体是否为监督者
    agent = Agent.query.get(target_agent_id)
    is_observer = hasattr(agent, 'is_observer') and agent.is_observer

    # 设置消息角色和来源
    if is_observer:
        role = 'supervisor'
        source = 'supervisorConversation' if send_target == 'supervisor' else 'taskConversation'
        meta = {'type': 'info'} if send_target == 'task_intervention' else {}
```

#### 智能体标识

在消息处理中，监督者智能体会被特殊标识：

```python
# 添加监督者特殊提示
if is_observer:
    system_prompt += """<observerDefinition>
## Supervisor Special Instructions
As a supervisor, your responsibility is to monitor and evaluate...
</observerDefinition>"""

# 消息展开时的角色标识
role_indicator = "Supervisor" if msg.role == "supervisor" else "Agent"
```

### 前端处理

#### 消息筛选

前端通过 `source` 字段筛选监督者相关消息：

```javascript
// API调用：获取监督者消息
const supervisorMessages = allMessages.filter(msg =>
  msg.source === 'supervisorConversation'
);
```

#### 显示逻辑

监督者消息的前端显示逻辑：

```javascript
// 消息类型判断
const isHuman = message.role === 'human';
const isSupervisor = message.role === 'supervisor';
const isIntervention = message.meta && message.meta.type === 'info';

// 发送者名称格式化
if (isSupervisor && message.agent_id) {
  const agent = supervisorAgents.find(a => a.id === message.agent_id);
  const interventionTag = isIntervention ? '[干预]' : '';
  senderName = `${agent.name}[${agent.role_name}][ID: ${agent.id}]${interventionTag}`;
}

// 样式设置
const backgroundColor = isIntervention
  ? (isHuman ? '#fff2f0' : '#fff1f0')  // 干预消息：红色系
  : (isHuman ? '#f0f8ff' : '#f6ffed'); // 普通消息：蓝/绿色系
```

#### 交互功能

监督者界面支持两种发送模式：

```javascript
// 发送目标选择
const sendTarget = 'supervisor';        // 发送到监督会话
const sendTarget = 'task_intervention'; // 发送到任务会话（干预）

// 消息数据构建
const messageData = {
  content: userMessage,
  target_agent_id: selectedSupervisor,
  send_target: sendTarget
};
```

### 消息流转

#### 监督会话流转

```
用户输入 → 监督者智能体 → 监督者回复
↓
数据库存储：role='supervisor', source='supervisorConversation'
↓
前端筛选：显示在监督者界面
```

#### 干预消息流转

```
用户输入（监督者界面） → 监督者智能体 → 干预回复
↓
数据库存储：role='supervisor', source='taskConversation', meta.type='info'
↓
前端显示：任务会话（带干预标识）+ 监督者界面
```

### 特殊处理

#### 干预消息标识

干预消息在前端有特殊的视觉标识：

- **标签**：显示 `[干预]` 标签
- **颜色**：使用红色系背景色
- **图标**：监督者头像使用红色背景
- **边框**：添加红色边框和阴影

#### 消息同步

监督者干预后需要同步更新：

```javascript
// 干预后重新加载监督者消息
setTimeout(async () => {
  await loadSupervisorMessages();
}, 1500); // 延迟确保数据库操作完成
```

### 测试验证

监督者消息功能的测试要点：

1. **消息角色正确**：`role='supervisor'`
2. **来源字段正确**：`source` 字段设置正确
3. **干预标识正确**：`meta.type='info'` 设置正确
4. **前端筛选正确**：监督者界面只显示相关消息
5. **样式显示正确**：干预消息有特殊标识

## 工具调用消息处理详解

### 核心概念

工具调用是智能体与外部系统交互的重要机制，包含以下关键组件：

1. **工具调用开始**：智能体发起工具调用请求
2. **工具执行**：后端执行具体的工具逻辑
3. **结果返回**：将执行结果返回给智能体和前端
4. **状态管理**：跟踪工具调用的执行状态

### 后端处理流程

#### 1. 工具调用检测

后端通过 `parse_tool_calls()` 函数检测LLM响应中的工具调用：

```python
# 支持多种格式的工具调用检测
def parse_tool_calls(content: str) -> List[Dict]:
    # 1. JSON格式检测（OpenAI格式）
    # 2. XML格式检测（<tool_call>标签）
    # 3. 不完整工具调用处理
```

#### 2. 工具调用消息发送

检测到工具调用后，发送ToolCallAction消息：

```python
tool_call_message = format_tool_call(
    function_name=tool_call['function']['name'],
    arguments=tool_call['function']['arguments'],
    tool_call_id=tool_call['id']
)
```

#### 3. 工具执行

通过 `_execute_tool_call()` 执行具体工具：

```python
def _execute_tool_call(tool_call):
    # 1. 解析工具名称和参数
    # 2. 查找对应的MCP服务器
    # 3. 调用MCP SDK执行工具
    # 4. 处理执行结果和错误
```

#### 4. 结果消息发送

执行完成后，发送工具调用结果消息：

```python
tool_result_message = format_tool_result_as_role(
    result=tool_result,
    tool_name=tool_call['function']['name'],
    tool_call_id=tool_call['id'],
    tool_parameter=tool_call['function']['arguments'],
    status=status  # success, error, warning
)
```

### 前端处理流程

#### 1. 消息解析

前端 `ConversationExtraction` 组件解析工具调用消息：

```javascript
// 解析工具调用开始
if (jsonObj.meta.ToolCallAction) {
  const toolCall = {
    type: 'toolCall',
    subtype: 'action',
    function: actionData.Function,
    arguments: actionData.Arguments,
    toolCallId: toolCallId,
    result: null
  };
}

// 解析工具调用结果（支持新旧两种格式）
if (jsonObj.meta.ToolCallResult ||
    (jsonObj.meta.type === 'toolResult' && jsonObj.meta.role === 'tool')) {
  // 处理结果数据
}
```

#### 2. 状态管理

前端跟踪工具调用的状态变化：

```javascript
// 状态标签渲染
let statusTag = <Tag color="processing">处理中...</Tag>;

if (hasResult) {
  const status = toolCall.result.status || 'success';
  if (status === 'error') {
    statusTag = <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>;
  } else if (status === 'warning') {
    statusTag = <Tag icon={<WarningOutlined />} color="warning">警告</Tag>;
  } else {
    statusTag = <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>;
  }
}
```

#### 3. 工具调用卡片渲染

前端将工具调用信息渲染为交互式卡片：

```javascript
<Card
  title={
    <Space>
      {getToolIcon(toolCall.function)}
      <Text strong>{toolCall.function}</Text>
      {statusTag}
    </Space>
  }
>
  <Collapse items={[
    {
      key: '1',
      label: '参数',
      children: <ReactJson src={parsedArguments} />
    },
    {
      key: '2',
      label: '结果',
      children: <MarkdownRenderer content={toolCall.result.content} />
    }
  ]} />
</Card>
```

### 错误处理机制

#### 1. 后端错误检测

后端通过多种方式检测工具调用错误：

```python
# HTTP错误检测
if result.get('error_type') == 'HTTPError' and '状态码: 200' not in str(result.get('error', '')):
    status = "error"

# 通用错误检测
elif result.get('is_error') or ('error' in result and result['error'] is not False):
    status = "error"

# 字符串错误检测
elif isinstance(tool_result, str) and ('错误' in tool_result or 'Error' in tool_result):
    status = "error"
```

#### 2. 前端错误显示

前端根据状态显示不同的错误信息：

```javascript
// 错误状态的特殊处理
if (status === 'error') {
  return (
    <Alert
      message="工具调用失败"
      description={toolCall.result.content}
      type="error"
      showIcon
    />
  );
}
```

### 变量刷新触发

工具调用完成后，系统会触发变量刷新：

```javascript
// 检测工具调用结果并触发刷新
if (content.includes('"type":"toolResult"') && content.includes('"role":"tool"')) {
  if (onUserMessageSent && !window._toolCallResultProcessed) {
    window._toolCallResultProcessed = true;
    setTimeout(() => {
      onUserMessageSent(); // 触发变量刷新
      setTimeout(() => {
        window._toolCallResultProcessed = false;
      }, 5000);
    }, 100);
  }
}
```