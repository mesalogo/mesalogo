# 工具调用数据包协议文档

本文档详细描述了智能体系统中工具调用的完整数据包协议，包括消息格式、状态管理、错误处理等。

## 协议概述

工具调用协议基于SSE (Server-Sent Events) 消息传输，采用JSON格式进行数据交换。协议包含以下阶段：

1. **工具调用开始** - 智能体发起工具调用请求
2. **工具执行** - 后端执行工具逻辑
3. **结果返回** - 返回执行结果给智能体和前端
4. **状态更新** - 更新工具调用状态

## 消息格式规范

### 1. 工具调用开始消息 (ToolCallAction)

**用途**: 通知前端智能体发起了工具调用请求

**格式**:
```json
{
  "content": null,
  "meta": {
    "ToolCallAction": {
      "Function": "工具名称",
      "Arguments": "工具参数（JSON字符串）"
    },
    "toolCallId": "工具调用唯一标识符",
    "status": "pending"
  }
}
```

**字段说明**:
- `Function`: 要调用的工具名称
- `Arguments`: 工具参数，必须是有效的JSON字符串
- `toolCallId`: 工具调用的唯一标识符，用于关联调用和结果

**注意**: 当前后端实现中不包含`status`字段，但协议规范建议包含该字段。

**示例**:
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

**实现差异**:
- 当前后端`format_tool_call`函数不包含`status`字段
- 工具调用ID使用标准UUID格式，不使用`tool-call-uuid-`前缀

### 2. 工具调用结果消息 (新格式 - role:tool)

**用途**: 返回工具调用的执行结果

**格式**:
```json
{
  "content": null,
  "meta": {
    "type": "toolResult",
    "role": "tool",
    "content": "工具执行结果",
    "tool_call_id": "工具调用唯一标识符",
    "tool_name": "工具名称",
    "tool_parameter": "工具调用参数（JSON字符串）",
    "status": "执行状态"
  }
}
```

**字段说明**:
- `type`: 固定为 "toolResult"
- `role`: 固定为 "tool"
- `content`: 工具执行结果，可以是字符串或JSON字符串
- `tool_call_id`: 与ToolCallAction中的toolCallId对应
- `tool_name`: 工具名称
- `tool_parameter`: 工具调用时使用的参数
- `status`: 执行状态，见状态值规范

### 3. 工具调用结果消息 (旧格式 - 兼容性)

**用途**: 兼容旧版本的工具调用结果格式

**格式**:
```json
{
  "content": null,
  "meta": {
    "ToolCallResult": "工具执行结果",
    "toolName": "工具名称",
    "toolCallId": "工具调用唯一标识符",
    "toolParameter": "工具调用参数（JSON字符串）",
    "status": "执行状态"
  }
}
```

## 状态值规范

工具调用支持以下状态值：

| 状态值 | 含义 | 使用场景 |
|--------|------|----------|
| `pending` | 处理中 | 工具调用开始时 |
| `success` | 成功 | 工具执行成功完成 |
| `error` | 失败 | 工具执行失败 |
| `warning` | 警告 | 工具执行完成但有警告 |

### 状态判断逻辑

后端通过以下逻辑判断工具调用状态：

1. **HTTP错误检测**:
   ```python
   if result.get('error_type') == 'HTTPError' and '状态码: 200' not in str(result.get('error', '')):
       status = "error"
   ```

2. **通用错误检测**:
   ```python
   elif result.get('is_error') or ('error' in result and result['error'] is not False):
       status = "error"
   ```

3. **字符串错误检测**:
   ```python
   elif isinstance(tool_result, str) and ('错误' in tool_result or 'Error' in tool_result):
       status = "error"
   ```

4. **默认成功状态**:
   ```python
   else:
       status = "success"
   ```

## 工具调用ID规范

### ID生成规则

**当前实现**:
- 使用标准UUID v4格式生成唯一标识符
- 格式: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- 示例: `12345678-1234-1234-1234-123456789abc`
- 生成位置: `tool_handler.py`中的`_execute_tool_call`函数和`parse_tool_calls`函数

**代码实现**:
```python
# 在tool_handler.py中
if 'id' not in tool_call or not tool_call['id']:
    tool_call['id'] = str(uuid.uuid4())

# 在parse_tool_calls中
tool_call = {
    'id': str(uuid.uuid4()),  # 生成唯一ID
    'type': 'function',
    'function': {
        'name': function_name,
        'arguments': json.dumps(arguments, ensure_ascii=False)
    }
}
```

### ID关联机制

1. **后端生成**: 在解析工具调用时生成唯一ID
2. **消息关联**: ToolCallAction和ToolCallResult使用相同ID
3. **前端匹配**: 前端通过ID将调用和结果进行关联

```javascript
// 前端ID映射示例
const toolCallIdMap = {};
if (toolCallId) {
  toolCallIdMap[toolCallId] = index;
}
```

## 错误处理协议

### 错误消息格式

当工具调用失败时，返回错误状态的结果消息：

```json
{
  "content": null,
  "meta": {
    "type": "toolResult",
    "role": "tool",
    "content": "工具执行失败：具体错误信息",
    "tool_call_id": "tool-call-uuid-abc123",
    "tool_name": "search_knowledge",
    "tool_parameter": "{\"query\":\"invalid\"}",
    "status": "error"
  }
}
```

### 常见错误类型

1. **参数错误**:
   ```json
   {
     "content": "工具执行失败：参数格式错误，无法解析JSON字符串",
     "status": "error"
   }
   ```

2. **HTTP错误**:
   ```json
   {
     "content": "工具执行失败：HTTP请求失败，状态码: 404",
     "status": "error"
   }
   ```

3. **MCP服务器错误**:
   ```json
   {
     "content": "MCP SDK调用失败：连接超时",
     "status": "error"
   }
   ```

## 前端处理协议

### 消息解析优先级

前端按以下优先级解析工具调用消息：

1. **新格式检测**:
   ```javascript
   if (jsonObj.meta.type === 'toolResult' && jsonObj.meta.role === 'tool')
   ```

2. **旧格式检测**:
   ```javascript
   if (jsonObj.meta.ToolCallResult)
   ```

3. **工具调用开始检测**:
   ```javascript
   if (jsonObj.meta.ToolCallAction)
   ```

### 状态显示规范

前端根据状态值显示对应的UI元素：

```javascript
// 状态标签映射
const statusConfig = {
  pending: { color: 'processing', icon: <LoadingOutlined />, text: '处理中...' },
  success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
  error: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
  warning: { color: 'warning', icon: <WarningOutlined />, text: '警告' }
};
```

## 变量刷新触发协议

工具调用完成后，系统会触发变量刷新机制：

### 触发条件

检测到工具调用结果消息时触发：

```javascript
if (content.includes('"type":"toolResult"') && content.includes('"role":"tool"')) {
  // 触发变量刷新
}
```

### 防重复机制

使用全局标志防止重复触发：

```javascript
if (onUserMessageSent && !window._toolCallResultProcessed) {
  window._toolCallResultProcessed = true;
  setTimeout(() => {
    onUserMessageSent();
    setTimeout(() => {
      window._toolCallResultProcessed = false;
    }, 5000);
  }, 100);
}
```

## 协议版本兼容性

### 向后兼容

系统同时支持新旧两种格式，确保向后兼容：

- **新格式**: `meta.type = "toolResult"` + `meta.role = "tool"`
- **旧格式**: `meta.ToolCallResult`

### 迁移建议

建议新开发的工具使用新格式（role:tool），旧工具可以继续使用旧格式。

## 调试和监控

### 日志记录

后端记录详细的工具调用日志：

```python
logger.info(f"[MCP请求] 调用工具: {tool_name}, 参数: {arguments}")
logger.debug(f"[LLM流式响应] 工具 {tool_name} 调用结果: {tool_result[:200]}")
```

### 前端调试

前端提供调试信息：

```javascript
console.log('检测到工具调用结果内容:', content.substring(0, 100));
console.log('工具调用状态:', status);
```

## 前端工具图标映射

前端`ConversationExtraction`组件中的`getToolIcon`函数定义了工具名称到图标的映射：

```javascript
const getToolIcon = (toolName) => {
  const toolIcons = {
    'sequentialthinking': <ThunderboltOutlined />,
    'search_web': <SearchOutlined />,
    'web_search': <SearchOutlined />,
    'web_fetch': <GlobalOutlined />,
    'get_agent_var': <DatabaseOutlined />,
    'set_agent_var': <DatabaseOutlined />,
    'code': <CodeOutlined />,
    'api': <ApiOutlined />,
    'default': <ToolOutlined />
  };

  return toolIcons[toolName] || toolIcons.default;
};
```

### 工具图标对应关系

| 工具名称 | 图标组件 | 用途 |
|---------|---------|------|
| `sequentialthinking` | `ThunderboltOutlined` | 序列思考工具 |
| `search_web` | `SearchOutlined` | 网络搜索工具 |
| `web_search` | `SearchOutlined` | 网络搜索工具（别名） |
| `web_fetch` | `GlobalOutlined` | 网页获取工具 |
| `get_agent_var` | `DatabaseOutlined` | 获取智能体变量 |
| `set_agent_var` | `DatabaseOutlined` | 设置智能体变量 |
| `code` | `CodeOutlined` | 代码执行工具 |
| `api` | `ApiOutlined` | API调用工具 |
| 其他工具 | `ToolOutlined` | 默认工具图标 |

## 最佳实践

1. **ID唯一性**: 确保每个工具调用都有唯一的ID
2. **状态一致性**: 后端和前端状态判断逻辑保持一致
3. **错误处理**: 提供详细的错误信息帮助调试
4. **性能优化**: 避免频繁的状态更新和重复触发
5. **兼容性**: 支持新旧格式的平滑过渡
6. **图标扩展**: 为新工具添加对应的图标映射
