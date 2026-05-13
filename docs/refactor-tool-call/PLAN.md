# 工具调用统一兼容方案

## 背景

当前系统主要支持 OpenAI 格式的工具调用，对 Claude/Anthropic 的原生工具调用支持不完整。需要从工具定义、请求、响应解析全链路进行兼容。

---

## 一、业界实现参考

### 1. LangChain 方案

LangChain 采用**抽象层 + 格式转换**的方式：

**核心接口：**
```python
# 统一的工具调用结构
class ToolCall(TypedDict):
    name: str
    args: Dict[str, Any]
    id: Optional[str]

# 统一的绑定方法
ChatModel.bind_tools([tool1, tool2, ...])

# 统一的响应属性
AIMessage.tool_calls: List[ToolCall]
```

**特点：**
- 接受多种输入格式（Pydantic类、函数、OpenAI格式dict）
- 内部自动转换为各提供商的请求格式
- 响应统一转换为 `ToolCall` 结构

**参考链接：**
- https://blog.langchain.com/tool-calling-with-langchain/
- https://python.langchain.com/docs/modules/model_io/chat/function_calling/

### 2. Dify 方案

Dify 为每个模型提供商实现独立的 Provider：

```
api/core/model_runtime/model_providers/
├── anthropic/
│   └── llm/llm.py          # Claude 专用实现
├── openai/
│   └── llm/llm.py          # OpenAI 专用实现
└── openai_api_compatible/  # OpenAI 兼容格式
```

**特点：**
- 每个 Provider 独立处理工具格式转换
- 通过统一的基类接口对外暴露
- 支持插件化扩展新的模型提供商

---

## 二、OpenAI vs Claude 格式对比

### 工具定义格式

**OpenAI 格式：**
```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "获取天气信息",
    "parameters": {
      "type": "object",
      "properties": {
        "location": {"type": "string", "description": "城市名称"}
      },
      "required": ["location"]
    }
  }
}
```

**Claude 格式：**
```json
{
  "name": "get_weather",
  "description": "获取天气信息",
  "input_schema": {
    "type": "object",
    "properties": {
      "location": {"type": "string", "description": "城市名称"}
    },
    "required": ["location"]
  }
}
```

### 请求格式

**OpenAI：**
```json
{
  "model": "gpt-4",
  "messages": [...],
  "tools": [/* OpenAI格式工具定义 */],
  "tool_choice": "auto"
}
```

**Claude：**
```json
{
  "model": "claude-3-opus",
  "system": "...",
  "messages": [...],
  "tools": [/* Claude格式工具定义 */],
  "tool_choice": {"type": "auto"}
}
```

### 响应格式 - 工具调用

**OpenAI 响应：**
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"location\": \"北京\"}"
        }
      }]
    }
  }]
}
```

**Claude 响应：**
```json
{
  "content": [
    {"type": "text", "text": "让我查询天气"},
    {
      "type": "tool_use",
      "id": "toolu_01abc",
      "name": "get_weather",
      "input": {"location": "北京"}
    }
  ],
  "stop_reason": "tool_use"
}
```

### 工具结果传回

**OpenAI：**
```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "北京今天晴，25度"
}
```

**Claude：**
```json
{
  "role": "user",
  "content": [{
    "type": "tool_result",
    "tool_use_id": "toolu_01abc",
    "content": "北京今天晴，25度"
  }]
}
```

### 流式响应格式

**OpenAI 流式：**
```
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_xxx","function":{"name":"get_weather"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"loc"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ation\":"}}]}}]}
...
data: {"choices":[{"finish_reason":"tool_calls"}]}
```

**Claude 流式：**
```
event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_xxx","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"loc"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"ation\":"}}
...

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}
```

---

## 三、当前系统现状

### 现有文件结构
```
backend/app/services/conversation/
├── model_client.py         # 模型请求客户端
├── stream_handler.py       # 流式响应处理
├── tool_handler.py         # 工具调用解析和执行
├── message_processor.py    # 消息处理和提示词构建
├── message_formater.py     # SSE消息格式化（前端通信）
└── adapters/
    ├── base_adapter.py
    ├── openai_adapter.py
    ├── dify_adapter.py
    └── ...
```

### 当前工具调用完整数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           工具调用完整路径                                    │
│                     定义 → 解析 → 执行 → 封装回传前端                          │
└─────────────────────────────────────────────────────────────────────────────┘

1. 定义阶段 (message_processor.py)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ 从角色能力(RoleCapability)获取工具 → 从MCP服务器获取工具Schema            │
   │ → 构建 OpenAI 格式工具定义 → 存入 agent_info['tools']                    │
   └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
2. 请求阶段 (model_client.py)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ 构建 payload，添加 tools 参数 → 发送到 LLM API                           │
   │ ⚠️ 当前问题：对 Anthropic 不传递 tools 参数                              │
   └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
3. 解析阶段 (stream_handler.py + tool_handler.py)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ stream_handler.py:                                                      │
   │   - 流式接收 LLM 响应                                                    │
   │   - 检测 OpenAI 格式: delta.tool_calls                                  │
   │   - 累积工具调用信息 (id, name, arguments)                               │
   │   ⚠️ 当前问题：不支持 Claude 的 content_block_start/delta 事件           │
   │                                                                         │
   │ tool_handler.py - parse_tool_calls():                                   │
   │   - 解析 JSON 格式工具调用                                               │
   │   - 解析 XML 格式: <tool_call name="xxx">...</tool_call>                │
   │   - 作为文本解析的后备方案                                                │
   └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
4. 执行阶段 (tool_handler.py + stream_handler.py)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ stream_handler.py - _execute_and_format_tool_call():                    │
   │   - 调用 tool_handler.execute_tool_call()                               │
   │   - 通过 MCP Manager 执行工具                                            │
   │   - 获取工具执行结果                                                   │
   │                                                                         │
   │ tool_handler.py - execute_tool_call():                                  │
   │   - 查找工具所属的 MCP 服务器                                            │
   │   - 调用 mcp_manager.call_tool(server_id, tool_name, arguments)         │
   │   - 返回执行结果                                                         │
   └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
5. 封装回传前端阶段 (message_formater.py + stream_handler.py)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ message_formater.py 提供格式化函数:                                      │
   │   - format_tool_call(): 格式化工具调用信息                               │
   │     → {"meta": {"ToolCallAction": {"Function", "Arguments"}}}           │
   │                                                                         │
   │   - format_tool_result_as_role(): 格式化工具执行结果                      │
   │     → {"meta": {"type": "toolResult", "role": "tool",                   │
   │                 "content", "tool_call_id", "tool_name", "status"}}      │
   │                                                                         │
   │   - serialize_message(): 序列化为 JSON 字符串                            │
   │                                                                         │
   │ stream_handler.py:                                                      │
   │   - 调用 callback(tool_result_str) 发送到 SSE 队列                       │
   │   - 前端通过 SSE 接收并渲染工具调用状态                                   │
   └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
6. 二次调用阶段 (stream_handler.py)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ call_llm_with_tool_results():                                           │
   │   - 将工具结果添加到消息历史                                              │
   │   - 使用 OpenAI 格式: {"role": "tool", "tool_call_id", "content"}       │
   │   - 再次调用 LLM 获取最终回复                                            │
   │   ⚠️ 当前问题：Claude 需要不同格式传回工具结果                            │
   └───────────────────────────────────────────────────────────────────────┘
```

### 前端 SSE 消息格式（当前实现）

```typescript
// 工具调用开始
{
  "content": null,
  "meta": {
    "ToolCallAction": {
      "Function": "get_weather",
      "Arguments": "{\"location\": \"北京\"}"
    },
    "toolCallId": "call_abc123"
  }
}

// 工具执行结果
{
  "content": null,
  "meta": {
    "type": "toolResult",
    "role": "tool",
    "content": "北京今天晴，25度",
    "tool_call_id": "call_abc123",
    "tool_name": "get_weather",
    "tool_parameter": "{\"location\": \"北京\"}",
    "status": "success"  // 或 "error"
  }
}
```

### 当前问题

1. **工具定义只支持 OpenAI 格式**
   - `message_processor.py` 中构建的工具定义是 OpenAI 格式
   - 对 Anthropic 不传递 tools 参数（`model_client.py` 第280行左右）

2. **流式响应解析只支持 OpenAI 格式**
   - `stream_handler.py` 只解析 `delta.tool_calls` 格式
   - 不支持 Claude 的 `content_block_start/delta` 事件

3. **工具结果传回只支持 OpenAI 格式**
   - `call_llm_with_tool_results()` 使用 `role: tool` 格式
   - Claude 需要 `role: user` + `type: tool_result` 格式

---

## 四、现有文件拆分建议

### 当前文件规模

| 文件 | 行数 | 职责 | 问题 |
|------|------|------|------|
| `message_processor.py` | 1541 | 消息处理、提示词构建、工具定义构建 | 职责过多，需拆分 |
| `stream_handler.py` | 1141 | 流式响应处理、工具调用执行、二次LLM调用 | 职责过多，需拆分 |
| `model_client.py` | 1085 | 模型请求、提供商适配、测试方法 | 可接受，但适配逻辑可抽离 |
| `tool_handler.py` | 473 | 工具解析、工具执行 | 可接受 |
| `message_formater.py` | 466 | SSE消息格式化 | 合理 |

### 建议拆分方案

#### Phase 0: 文件拆分（在功能改造前进行）

```
backend/app/services/conversation/
├── model_client.py              # 保留：核心请求逻辑
├── stream_handler.py            # 保留：流式响应处理（精简后）
├── tool_handler.py              # 保留：工具执行
├── message_processor.py         # 保留：消息处理（精简后）
├── message_formater.py          # 保留：SSE格式化
│
├── tool_format_converter.py     # 新增：工具格式转换（OpenAI/Claude）
├── tool_call_executor.py        # 新增：从stream_handler抽离工具执行逻辑
├── prompt_builder.py            # 新增：从message_processor抽离提示词构建
├── tool_definition_builder.py   # 新增：从message_processor抽离工具定义构建
│
└── providers/                   # 新增：提供商适配器目录
    ├── __init__.py
    ├── base_provider.py         # 基类：定义统一接口
    ├── openai_provider.py       # OpenAI 格式处理
    └── anthropic_provider.py    # Anthropic 格式处理
```

#### 拆分详情

**1. 从 `message_processor.py` 拆分：**

| 新文件 | 抽离内容 | 预计行数 |
|--------|---------|---------|
| `prompt_builder.py` | `build_system_prompt()` 及相关辅助函数 | ~400 |
| `tool_definition_builder.py` | 工具定义构建、压缩逻辑 | ~200 |
| `message_processor.py` | 保留 `process_message_common()`、`format_messages()` | ~900 |

**2. 从 `stream_handler.py` 拆分：**

| 新文件 | 抽离内容 | 预计行数 |
|--------|---------|---------|
| `tool_call_executor.py` | `_execute_and_format_tool_call()`、工具执行循环 | ~200 |
| `tool_format_converter.py` | 工具格式转换（新功能） | ~150 |
| `stream_handler.py` | 保留流式解析、SSE队列处理 | ~700 |

**3. 新增 `providers/` 目录：**

将提供商特定的格式处理逻辑集中管理：

```python
# providers/base_provider.py
class BaseToolProvider:
    """工具调用提供商基类"""
    
    @abstractmethod
    def format_tools_for_request(self, tools: List[Dict]) -> List[Dict]:
        """将统一格式工具定义转换为提供商格式"""
        pass
    
    @abstractmethod
    def parse_tool_calls_from_response(self, response: Dict) -> List[Dict]:
        """从响应中解析工具调用"""
        pass
    
    @abstractmethod
    def format_tool_result_message(self, tool_call_id: str, content: str) -> Dict:
        """格式化工具结果消息"""
        pass
    
    @abstractmethod
    def parse_streaming_tool_call(self, chunk: Dict) -> Optional[Dict]:
        """解析流式响应中的工具调用"""
        pass
```

### 拆分原则

1. **单一职责**：每个文件只负责一个明确的功能领域
2. **最小改动**：保持现有函数签名不变，只是移动位置
3. **向后兼容**：在原文件中保留导入，避免破坏现有调用
4. **渐进式**：先拆分，验证无问题后再进行功能改造

### 拆分顺序

```
1. 创建 providers/ 目录和基类
2. 创建 tool_format_converter.py（新功能核心）
3. 从 stream_handler.py 抽离 tool_call_executor.py
4. 从 message_processor.py 抽离 prompt_builder.py
5. 从 message_processor.py 抽离 tool_definition_builder.py
6. 验证所有现有功能正常
7. 开始 Claude 工具调用支持改造
```

---

## 五、重构方案

### 方案概述

采用**适配器模式**，在现有架构基础上增加格式转换层：

```
┌─────────────────────────────────────────────────────────────┐
│                    统一内部格式                              │
│  ToolDefinition, ToolCall, ToolResult                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    格式转换层                                │
│  ToolFormatConverter                                        │
│  - to_openai_tools() / from_openai_response()              │
│  - to_anthropic_tools() / from_anthropic_response()        │
└─────────────────────────────────────────────────────────────┘
                     │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   OpenAI API            │     │   Anthropic API         │
└─────────────────────────┘     └─────────────────────────┘
```

### 新增文件

```
backend/app/services/conversation/
├── tool_format_converter.py   # 新增：工具格式转换器
└── ...
```

### 核心数据结构

```python
# tool_format_converter.py

from typing import TypedDict, List, Dict, Any, Optional

class UnifiedToolDefinition(TypedDict):
    义格式"""
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema

class UnifiedToolCall(TypedDict):
    """统一的工具调用格式"""
    id: str
    name: str
    arguments: Dict[str, Any]  # 已解析的参数字典

class UnifiedToolResult(TypedDict):
    """统一的工具结果格式"""
    tool_call_id: str
    content: str
    status: str  # "success" | "error"
```

### 格式转换器实现

```python
class ToolFormatConverter:
    """工具格式转换器"""
    
    @staticmethod
    def to_provider_tools(tools: List[UnifiedToolDefinition], provider: str) -> List[Dict]:
        """将统一格式转换为提供商格式"""
        if provider == 'anthropic':
            return [
                {
                    "name": ol["name"],
                    "description": tool["description"],
                    "input_schema": tool["parameters"]
                }
                for tool in tools
            ]
        else:  # openai 及兼容格式
            return [
                {
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool["description"],
                        "parameters": tool["parameters"]
                    }
                }
                for tool in tools
            ]
    
    @staticmethod
    def from_openai_tool_calls(tool_calls: List[Dict]) -> List[UnifiedToolCall]:
        """从 OpenAI 响应解析工具调用"""
        result = []
        for tc in tool_calls:
            result.append({
                "id": tc.get("id", str(uuid.uuid4())),
                "name": tc["function"]["name"],
                "arguments": json.loads(tc["function"]["arguments"])
            })
        return result
    
    @staticmethod
    def from_anthropic_content(content: List[Dict]) -> List[UnifiedToolCall]:
        """从 Claude 响应解析工具调用"""
        result = []
        for block in content:
            if block.get("type") == "tool_use":
                result.append({
                    "id": block["id"],
                    "name": block["name"],
                    "arguments": block["input"]
                })
        return result
    
    @staticmethod
    def to_provider_tool_result(result: UnifiedToolResult, provider: str) -> Dict:
        """将工具结果转换为提供商格式"""
        if provider == 'anthropic':
            return {
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": result["tool_call_id"],
                    "content": result["content"]
                }]
            }
        else:  # openai
            return {
                "role": "tool",
                "tool_call_id": result["tool_call_id"],
                "content": result["content"]
            }
```

### 改动点

#### 1. model_client.py

```python
# 在 send_request 方法中

# 转换工具定义格式
if agent_info and 'tools' in agent_info and agent_info['tools']:
    from .tool_format_converter import ToolFormatConverter
    
    # 将 OpenAI 格式转换为统一格式，再转换为目标提供商格式
    unified_tools = ToolFormatConverter.from_openai_tools(agent_info['tools'])
    provider_tools = ToolFormatConverter.to_provider_tools(unified_tools, detected_provider)
    
    payload['tools'] = provider_tools
    
    if detected_provider == 'anthropic':
        payload['tool_choice'] = {"type": "auto"}
    else:
        payload['tool_choice'] = "auto"
```

#### 2. stream_handler.py

```python
# 在 handle_streaming_response 中添加 Claude 流式解析

# Claude 流式事件类型
if 'event:' in line_text:
    event_type = line_text.split('event:')[1].strip()
    # content_block_start, content_block_delta, content_block_stop, message_delta
    
if ype == 'content_block_start':
    # 检查是否是 tool_use 类型
    if data.get('content_block', {}).get('type') == 'tool_use':
        # 开始收集工具调用
        current_tool_call = {
            'id': data['content_block']['id'],
            'name': data['content_block']['name'],
            'input_json': ''
        }

elif event_type == 'content_block_delta':
    if data.get('delta', {}).get('type') == 'input_json_delta':
        # 累积 JSON 片段
        current_tool_call['input_json'] += data['delta']['partial_json']

elif event_type == 'content_block_stop':
    # 工具调用完成，解析 JSON
    if current_tool_call:
        tool_call = {
            'id': current_tool_call['id'],
            'name': current_tool_call['name'],
            'arguments': json.loads(current_tool_call['input_json'])
        }
        anthropic_tool_calls.append(tool_call)
```

#### 3. call_llm_with_tool_results

```python
# 根据提供商格式化工具结果消息
provider = api_config.get('provider', 'openai')

for tool_result in tool_results:
    result_message = ToolFormatConverter.to_provider_tool_result(
        {
            "tool_call_id": tool_result["tool_call_id"],
            "content": tool_result["result"],
            "status": "success"
        },
        provider
    )
    messages.append(result_``

---

## 五、实施步骤

### Phase 1: 基础设施（预计 2 天）

1. [ ] 创建 `tool_format_converter.py`
2. [ ] 定义统一数据结构
3. [ ] 实现 OpenAI <-> 统一格式 转换
4. [ ] 实现 Anthropic <-> 统一格式 转换
5. [ ] 编写单元测试

### Phase 2: 请求端改造（预计 1 天）

1. [ ] 修改 `model_client.py`，为 Anthropic 传递工具定义
2. [ ] 修改 `message_processor.py`，使用统一格式构建工具定义
3. [ ] 测试 Claude 工具调用请求

### Phase 3: 响应端改造（预计 2 天）

1. [ ] 修改 `stream_handler.py`，添加 Claude 流式响应解析
2. [ ] 修改 `tool_handler.py`，统一工具调用解析入口
3. [ ] 修改 `call_llm_with_tool_results`，支持 Claude 格式
4. [ ] 端到端测试

### Phase 4: 测试与优化（预计 1 天）

1. [ ] OpenAI 模型工具调用测试
2. [ ] Claude 模型工具调用测试
3. [ ] 混合场景测试
4. [ ] 性能优化

---

## 六、影响评估

### 后端影响范围

| 文件 | 改动类型 | 影响程度 | 说明 |
|------|---------|---------|------|
| `model_client.py` | 修改 | 🔴 高 | 添加工具格式转换，为 Anthropic 传递 tools 参数 |
| `stream_handler.py` | 修改 | 🔴 高 | 添加 Claude 流式响应解析，修改 `call_llm_with_tool_results()` |
| `tool_handler.py` | 修改 | 🟡 中 | 统一工具调用解析入口，可能需要调整 `parse_tool_calls()` |
| `message_processor.py` | 修改 | 🟡 中 | 工具定义构建可能需要使用统一格式 |
| `message_formater.py` | 无改动 | 🟢 低 | 前端 SSE 格式保持不变，无需修改 |
| `adapters/openai_adapter.py` | 可能修改 | 🟡 中 | 如果统一工具格式，需要同步调整 |
| `base_workflow.py` | 检查 | 🟢 低 | 使用 `call_llm_with_tool_results`，需验证兼容性 |
| `conversation_service.py` | 检查 | 🟢 低 | 使用工具相关函数，需验证兼容性 |

### 前端影响范围

| 文件 | 改动类型 | 影响程度 | 说明 |
|------|---------|---------|------|
| `useStreamingHandler.tsx` | 无改动 | 🟢 低 | 已支持 `toolResult` 类型，格式不变 |
| `useConversationData.tsx` | 无改动 | 🟢 低 | 已有多种工具结果检测逻辑，兼容性好 |
| `ConversationExtraction.tsx` | 检查 | 🟢 低 | 需验证工具调用显示是否正常 |
| `MonitorTab.tsx` | 检查 | 🟢 低 | 需验证监控页面工具调用显示 |
| `conversation.ts` | 无改动 | 🟢 低 | API 层无需修改 |

### 关键兼容性考虑

#### 1. 前端 SSE 消息格式（保持不变）

当前前端已支持的格式，**重构后必须保持兼容**：

```typescript
// 前端检测工具结果的逻辑 (useConversationData.tsx)
const isToolCallResult = (content) => {
  return content.includes('"meta":{"ToolCallResult"') ||
         (content.includes('"toolName"') && content.includes('"toolCallId"')) ||
         (content.includes('"type":"toolResult"') && content.includes('"role":"tool"')) ||
         (content.includes('tool_call_id') && content.includes('name') && content.includes('content'));
};

const isToolCallResultMeta = (meta) => {
  return meta.type === 'toolCallResult' ||
         (meta.ToolCallResult && meta.toolCallId) ||
         (meta.toolName && meta.toolCallId) ||
         (meta.type === 'toolResult' && meta.role === 'tool');
};
```

**结论**：`message_formater.py` 的输出格式不需要改变，前端无需修改。

#### 2. 工具执行流程（保持不变）

```
工具调用解析 → execute_tool_call() → MCP Manager → 返回结果
```

这个流程不受提供商格式影响，`tool_handler.py` 的 `execute_tool_call()` 函数无需修改。

#### 3. 二次 LLM 调用（需要修改）

`call_llm_with_tool_results()` 当前使用 OpenAI 格式传回工具结果：

```python
# 当前实现
tool_result_message = {
    "role": "tool",
    "tool_call_id": tool_call_id,
    "content": result_content
}
```

**需要修改为**：根据 provider 选择不同格式。

### 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| OpenAI 模型工具调用回归 | 🟡 中 | 🔴 高 | 充分的单元测试和集成测试 |
| 流式响应解析错误 | 🟡 中 | 🔴 高 | 添加详细日志，分阶段上线 |
| 前端显示异常 | 🟢 低 | 🟡 中 | 保持 SSE 格式不变 |
| 性能下降 | 🟢 低 | 🟢 低 | 格式转换开销很小 |
| M🟢 低 | 🟢 低 | 执行层不受影响 |

### 测试策略

#### 单元测试
- [ ] `ToolFormatConverter` 各转换方法
- [ ] OpenAI 格式工具定义转换
- [ ] Anthropic 格式工具定义转换
- [ ] 工具调用响应解析

#### 集成测试
- [ ] OpenAI 模型完整工具调用流程
- [ ] Claude 模型完整工具调用流程
- [ ] 多轮工具调用场景
- [ ] 工具执行失败场景

#### 回归测试
- [ ] 现有 OpenAI 模型功能不受影响
- [ ] 前端工具调用显示正常
- [ ] 自动会话中的工具调用正常

---

## 七、未来方向

### 1. 更多提供商支持

- Google Gemini（格式类似 OpenAI）
- Mistral（格式类似 OpenAI）
- 本地模型（Ollama、vLLM）

### 2. 工具调用能力检测

```python
class ModelCapabilities:
    supports_tool_calling: bool
    supports_parallel_tool_calls: bool
    supports_streaming_tool_calls: bool
    tool_call_format: str  # "openai" | "anthropic" | "text"
```

### 3. 降级策略

当模型不支持原生工具调用时，自动降级为文本格式：
- 在 system prompt 中描述工具
- 解析模型输出的 XML/JSON 格式工具调用
- 这是当前系统的后备方案

### 4. 工具调用缓存

- 缓存工具定义的格式转换结果
- 减少重复转换开销

### 5. 可观测性

- 工具调用指标统计
- 格式转换错误监控
- 工具执行耗时追踪
--

## 七、参考资料

- [LangChain Tool Calling](https://blog.langchain.com/tool-calling-with-langchain/)
- [Anthropic Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Claude API Reference](https://docs.anthropic.com/en/api/messages)
