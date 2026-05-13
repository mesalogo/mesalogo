# 使用官方SDK重构消息格式解析（简化版）

## 背景

当前代码在 `stream_handler.py`、`tool_handler.py`、`model_client.py` 等模块中手动解析流式响应和工具调用格式，代码复杂且容易出错。

## 当前实现状态

**已完成的工作：**

| 模块 | 状态 | 说明 |
|------|------|------|
| `openai_provider.py` | ✅ 完成 | 使用 OpenAI SDK，支持 stream_chat/chat |
| `anthropic_provider.py` | ✅ 完成 | 使用 Anthropic SDK，支持 stream_chat/chat |
| `custom_provider.py` | ✅ 完成 | httpx 手动解析，支持 reasoning_content |
| `base_provider.py` | ✅ 完成 | 抽象基类，定义 stream_chat/chat 接口 |
| `model_client.py` | ✅ 完成 | 新增 `send_request_with_provider()` 方法 |
| `tool_format_converter.py` | ✅ 完成 | 删除 `get_tool_provider()`，保留纯格式转换 |
| 格式兼容性配置 | ✅ 完成 | 数据库字段 + API + 前端 UI |
| 数据库迁移 | ✅ 完成 | `format_compatibility` 字段 |
| 集成测试 | ✅ 完成 | OpenAI Provider 测试通过（阿里云 Qwen），工具调用正常 |

**待完成的工作：**

| 任务 | 状态 | 说明 |
|------|------|------|
| 调用方迁移 | ⏸️ 暂停 | 已撤销迁移，保留原有 `send_request()` 调用方式 |

**说明：** 调用方迁移工作已撤销，目前仅保留新增的模型格式兼容性选项（`format_compatibility` 字段）。Provider 实现和 `send_request_with_provider()` 方法已就绪，后续可按需逐步迁移。

## 调用方迁移计划

**迁移范围评估 (2025-01-05)**

共 13 处调用需要迁移：

| 文件 | 调用次数 | 优先级 | 说明 |
|------|----------|--------|------|
| `model_client.py` 内部 | 3 | P0 | 内部递归调用，先统一内部逻辑 |
| `conversation_service.py` | 3 | P1 | 核心对话服务，优先验证 |
| `stream_handler.py` | 1 | P1 | 流式处理 |
| `summary_service.py` | 2 | P2 | 摘要生成 |
| `one_click_generation_service.py` | 1 | P2 | 一键生成 |
| `supervisor_rule_checker.py` | 1 | P3 | 规则检查 |
| `rules/validation.py` | 1 | P3 | 规则验证 |
| `rules.py` | 1 | P3 | 规则路由 |

**建议迁移顺序：**
1. `model_client.py` 内部调用（3处）- 先统一内部逻辑
2. `conversation_service.py`（3处）- 核心路径，优先验证
3. `stream_handler.py`（1处）- 流式处理
4. 其他服务逐步迁移

## 集成测试结果 (2025-01-05)

测试脚本：`backend/tests/test_provider_integration.py`

| 模型 | 格式 | 流式 | 非流式 | 工具调用 | 备注 |
|------|------|------|--------|----------|------|
| qwen-plus-latest | openai | ✓ | ✓ | ✓ | 阿里云通义千问 |
| deepseek-chat | openai | ✗ | ✗ | ✗ | 账户余额不足 (HTTP 402) |

**验证结论：**
- `OpenAIToolProvider` 使用 SDK 实现正确
- 流式对话、非流式对话、工具调用均正常工作
- 工具调用成功触发 `get_weather` 并正确解析参数 `{'city': '北京'}`
- Anthropic/Custom Provider 待配置模型后测试

## 设计原则

**KISS (Keep It Simple, Stupid)**
- 3个Provider足够覆盖所有场景
- SDK封装直接放在Provider里，不单独建目录
- 格式转换函数保留为公共工具（`tool_format_converter.py`）
- XML解析保留在 `tool_handler.py`（用于不支持原生function calling的模型）

## 目标文件结构

```
app/services/conversation/
├── providers/
│   ├── __init__.py
│   ├── base_provider.py          # 抽象基类（保留）
│   ├── openai_provider.py        # OpenAI SDK（重构）
│   ├── anthropic_provider.py     # Anthropic SDK（重构）
│   └── custom_provider.py        # httpx + 手动解析（新增，降级方案）
│
├── model_client.py               # 统一入口，根据provider选择
├── stream_handler.py             # 流式处理（简化）
├── tool_handler.py               # 工具执行 + XML解析（保留）
├── tool_call_executor.py         # 工具调用执行（保留）
├── tool_format_converter.py      # 格式转换工具函数（精简保留）
└── message_formater.py           # 消息格式化（保留，前端依赖）
```

## 文件变更说明

### 精简保留: tool_format_converter.py

保留纯格式转换函数（无状态，公共工具）：
- `to_provider_tools(tools, provider)` - 工具定义格式转换
- `to_provider_tool_result(result, provider)` - 工具结果消息格式转换
- `to_provider_assistant_message(content, tool_calls, provider)` - assistant消息格式转换
- `format_tool_choice(tool_choice, provider)` - tool_choice参数格式转换

删除：
- `get_tool_provider()` - 移到 model_client.py
- 流式解析相关代码 - 移到各Provider

### 可删除的文件

- ~~`tool_definition_builder.py` - 合并到 `message_processor.py`~~ **保留**：该文件负责与MCP服务器交互获取工具定义，不属于流式解析范畴

## Provider职责划分

| Provider | 覆盖场景 | 实现方式 |
|----------|----------|----------|
| `openai_provider.py` | OpenAI、阿里云、火山、DeepSeek、Kimi、Ollama、GPUStack | OpenAI SDK + base_url |
| `anthropic_provider.py` | Claude | Anthropic SDK |
| `custom_provider.py` | 不兼容SDK的服务、XML格式工具调用、reasoning_content | httpx + 手动解析 |

## 格式兼容性配置 ✅ 已实现

### 实现状态

- [x] 数据库字段添加
- [x] 后端 API 支持
- [x] 前端 Modal UI
- [x] 智能默认值（前端）
- [x] 数据库迁移脚本

### 设计思路

在模型设置 Modal 中增加显式的"格式兼容性"选择，替代原有的 URL 自动推断逻辑。这样更可靠、更透明。

### 数据库变更

`ModelConfig` 表新增字段：

```python
# app/models.py - ModelConfig 类
format_compatibility = Column(String(20), default='openai')  # openai, anthropic, custom
```

可选值：
- `openai` - OpenAI 兼容格式（默认，覆盖大多数服务）
- `anthropic` - Anthropic 兼容格式
- `custom` - 自定义格式（手动解析，支持 reasoning_content 等特殊字段）

### 后端 API 变更

```python
# app/api/routes/model_configs.py

# GET /model-configs 返回新增字段
result.append({
    ...
    'format_compatibility': config.format_compatibility or 'openai',
})

# POST 创建时支持新字段
new_config = ModelConfig(
    ...
    format_compatibility=data.get('format_compatibility', 'openai'),
)

# PUT 更新时自动处理（通过 setattr 循环）
```

### 前端 Modal 变更

```tsx
// frontend/src/pages/settings/ModelConfigsPage/ModelFormModal.tsx

// 在附加参数上方添加格式兼容性选择
<Row gutter={24}>
  <Col span={24}>
    <Form.Item
      name="formatCompatibility"
      label={t('modelConfig.form.formatCompatibility')}
      tooltip={t('modelConfig.form.formatCompatibilityTooltip')}
      initialValue="openai"
    >
      <Select>
        <Option value="openai">
          <Tag color="blue">OpenAI</Tag>
          {t('modelConfig.formatCompatibility.openai')}
        </Option>
        <Option value="anthropic">
          <Tag color="purple">Anthropic</Tag>
          {t('modelConfig.formatCompatibility.anthropic')}
        </Option>
        <Option value="custom">
          <Tag color="orange">Custom</Tag>
          {t('modelConfig.formatCompatibility.custom')}
        </Option>
      </Select>
    </Form.Item>
  </Col>
</Row>
```

### 国际化文案

```typescript
// zh-CN.ts
'modelConfig.form.formatCompatibility': '格式兼容性',
'modelConfig.form.formatCompatibilityTooltip': '选择API响应格式的兼容模式，影响流式响应和工具调用的解析方式',
'modelConfig.formatCompatibility.openai': 'OpenAI 兼容（适用于大多数服务）',
'modelConfig.formatCompatibility.anthropic': 'Anthropic 兼容（Claude 系列）',
'modelConfig.formatCompatibility.custom': '自定义格式（支持 reasoning_content 等特殊字段）',

// en-US.ts
'modelConfig.form.formatCompatibility': 'Format Compatibility',
'modelConfig.form.formatCompatibilityTooltip': 'Select API response format compatibility mode, affects streaming response and tool call parsing',
'modelConfig.formatCompatibility.openai': 'OpenAI Compatible (works with most services)',
'modelConfig.formatCompatibility.anthropic': 'Anthropic Compatible (Claude series)',
'modelConfig.formatCompatibility.custom': 'Custom Format (supports reasoning_content etc.)',
```

### Provider 选择逻辑（待实现）

```py app/services/conversation/model_client.py

def _get_provider(self, config: ModelConfig):
    """根据模型配置获取 Provider"""
    format_type = config.format_compatibility or 'openai'
    
    if format_type == 'anthropic':
        return AnthropicToolProvider(config.api_key, config.base_url)
    elif format_type == 'custom':
        return CustomToolProvider(config.api_key, config.base_url)
    else:  # openai (default)
        return OpenAIToolProvider(config.api_key, config.base_url)
```

### 智能默认值（纯前端）

在前端 `handleProviderChange` 回调中根据 provider 自动设置默认格式：

```typescript
// frontend/src/pages/settings/ModelConfigsPage/ModelConfigsPage.tsx

const FORMAT_DEFAULTS: Record<string, string> = {
  'anthropic': 'anthropic',
  'openai': 'openai',
  'ollama': 'openai',
  'gpustack': 'openai',
  'deepseek': 'openai',
  'aliyun': 'openai',
  'volcengine': 'openai',
  'azure': 'openai',
  'google': 'openai',
  'xai': 'openai',
  'custom': 'custom',
};

const handleProviderChange = (provider) => {
  setCurrentProvider(provider);
  dataHook.clearAllProviderModels();
  
  modelForm.setFieldsValue({
    model_id: '',
    name: '',
    formatCompatibility: FORMAT_DEFAULTS[provider] || 'openai'
  });
};
```

后端只负责存储和读取 `format_compatibility` 字段，不做任何推断逻辑。

### 数据库迁移

迁移脚本：`backend/scripts/migrate_add_format_compatibility.py`

```bash
cd backend && python scripts/migrate_add_format_compatibility.py
```

迁移逻辑：
- 添加 `format_compatibility` 字段（VARCHAR(20)，默认 'openai'）
- 根据现有 provider 设置默认值：anthropic provider 设为 'anthropic'，其他设为 'openai'

## 重构方案

### Phase 1: 添加SDK依赖

```txt
# requirements.txt
openai>=1.0.0
anthropic>=0.18.0
```

### Phase 2: 重构 openai_provider.py

```python
"""OpenAI Provider - 使用官方SDK"""
from openai import OpenAI
from typing import Generator, List, Dict
from .base_provider import BaseToolProvider

class OpenAIToolProvider(BaseToolProvider):
    """OpenAI及兼容服务的Provider"""
    
    def __init__(self, api_key: str, base_url: str = None):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
    
    def stream_chat(self, messages: List[Dict], model: str, 
                    tools: List[Dict] = None, **kwargs) -> Generator[Dict, None, None]:
        """流式对话，SDK自动解析工具调用"""
        stream = self.client.chat.completions.create(
            model=model, messages=messages,
            tools=tools, stream=True, **kwargs
        )
        
        tool_calls_acc = {}
        for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if not choice:
                continue
            delta = choice.delta
            
            if delta.content:
                yield {"type": "content", "content": delta.content}
            
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_acc:
                        tool_calls_acc[idx] = {"id": "", "name": "", "arguments": ""}
                    if tc.id:
                        tool_calls_acc[idx]["id"] = tc.id
                    if tc.function.name:
                        tool_calls_acc[idx]["name"] = tc.function.name
                    if tc.function.arguments:
                        tool_calls_acc[idx]["arguments"] += tc.function.arguments
            
            if choice.finish_reason == "tool_calls":
                yield {"type": "tool_calls", "tool_calls": list(tool_calls_acc.values())}
            elif choice.finish_reason == "stop":
                yield {"type": "done"}
```

### Phase 3: 重构 anthropic_provider.py

```python
"""Anthropic Provider - 使用官方SDK"""
from anthropic import Anthropic
from typing import Generator, List, Dict
from .base_provider import BaseToolProvider

class AnthropicToolProvider(BaseToolProvider):
    """Claude的Provider"""
    
    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)
    
    def stream_chat(self, messages: List[Dict], model: str,
                    system: str = None, tools: List[Dict] = None, 
                    **kwargs) -> Generator[Dict, None, None]:
        """流式对话，SDK自动解析工具调用"""
        anthropic_tools = self._convert_tools(tools) if tools else None
        
        with self.client.messages.stream(
            model=model, messages=messages,
            system=system, tools=anthropic_tools,
            max_tokens=kwargs.get("max_tokens", 4096)
        ) as stream:
            current_tool = None
            for event in stream:
                if event.type == "content_block_start":
                    if event.content_block.type == "tool_use":
                        current_tool = {"id": event.content_block.id, 
                             "name": event.content_block.name, "arguments": ""}
                elif event.type == "content_block_delta":
                    if hasattr(event.delta, "text"):
                        yield {"type": "content", "content": event.delta.text}
                    elif hasattr(event.delta, "partial_json") and current_tool:
                        current_tool["arguments"] += event.delta.partial_json
                elif event.type == "content_block_stop":
                    if current_tool:
                        yield {"type": "tool_call", "tool_call": current_tool}
                        current_tool = None
                elif event.type == "message_delta":
                    if event.delta.stop_reason:
                        yield {"type": "done", "stop_reason": event.delta.stop_reason}
    
    def _convert_tools(self, openai_tools: List[Dict]) -> List[Dict]:
        """OpenAI格式转Anthropic格式"""
        return [{"name": t["function"]["name"],
                 "description": t["function"]["description"],
                 "input_schema": t["function"]["parameters"]}
                for t in openai_tools if t.get("type") == "function"]
```

### Phase 4: 新增 custom_provider.py

```python
"""Custom Provider - httpx手动解析，用于降级和特殊格式"""
import httpx
import json
from typing import Generator, List, Dict
from .base_provider import BaseToolProvider

class CustomToolProvider(BaseToolProvider):
    """自定义Provider，处理不兼容SDK的服务"""
    
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
    
    def stream_chat(self, messages: List[Dict], model: str,
                    tools: List[Dict] = None, **kwargs) -> Generator[Dict, None, None]:
        """流式对话，手动解析SSE"""
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "messages": messages, "stream": True}
        if tools:
            payload["tools"] = tools
        
        with httpx.stream("POST", f"{self.base_url}/chat/completions",
                         headers=headers, json=payload, timeout=60) as response:
            tool_calls_acc = {}
            for line in response.iter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    yield {"type": "done"}
                    break
                
                chunk = json.loads(data)
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                
                # 文本内容
                if delta.get("content"):
                    yield {"type": "content", "content": delta["content"]}
                
                # reasoning_content (Qwen3等)
                if delta.get("reasoning_content"):
                    yield {"type": "reasoning", "content": delta["reasoning_content"]}
                
                # 工具调用
                if delta.get("tool_calls"):
                    for tc in delta["tool_calls"]:
                        idx = tc.get("index", 0)
                        if idx not in tool_calls_acc:
                            tool_calls_acc[idx] = {"id": "", "name": "", "arguments": ""}
                        if tc.get("id"):
                            tool_calls_acc[idx]["id"] = tc["id"]
                        if tc.get("function", {}).get("name"):
                            tool_calls_acc[idx]["name"] = tc["function"]["name"]
                        if tc.get("function", {}).get("arguments"):
                            tool_calls_acc[idx]["arguments"] += tc["function"]["arguments"]
                
                finish = chunk.get("choices", [{}])[0].get("finish_reason")
                if finish == "tool_calls":
                    yield {"type": "tool_calls", "tool_calls": list(tool_calls_acc.values())}
```

### Phase 5: 简化 stream_handler.py

```python
"""简化后的流式处理"""
def handle_streaming_response(provider, messages, model, callback, **kwargs):
    """统一的流式响应处理"""
    full_content = ""
    tool_calls = []
    has_reasoning = False
    
    for chunk in provider.stream_chat(messages, model, **kwargs):
        chunk_type = chunk.get("type")
        
        if chunk_type == "content":
            content = chunk["content"]
            full_content += content
            callback(content)
        
        elif chunk_type == "reasoning":
            # Qwen3 reasoning_content
            if not has_reasoning:
                callback("<thinking>\n")
                has_reasoning = True
            callback(chunk["content"])
        
        elif chunk_type == "tool_call":
            tool_calls.append(chunk["tool_call"])
        
        elif chunk_type == "tool_calls":
            tool_calls.extend(chunk["tool_calls"])
        
        elif chunk_type == "done":
            if has_reasoning:
                callback("\n</thinking>\n")
            break
    
    return full_content, tool_calls
```

### Phase 6: 更新 model_client.py

```python
"""统一模型客户端"""
from .providers.openai_provider import OpenAIToolProvider
from .providers.anthropic_provider import AnthropicToolProvider
from .providers.custom_provider import CustomToolProvider

class ModelClient:
    def __init__(self):
        self._providers = {}
    
    def _get_provider(self, provider_type: str, api_key: str, base_url: str = None):
        """获取或创建Provider"""
        cache_key = f"{provider_type}:{base_url or 'default'}"
        if cache_key not in self._providers:
            if provider_type == "anthropic":
                self._providers[cache_key] = AnthropicToolProvider(api_key)
            elif provider_type == "custom":
                self._providers[cache_key] = CustomToolProvider(api_key, base_url)
            else:
                self._providers[cache_key] = OpenAIToolProvider(api_key, base_url)
        return self._providers[cache_key]
    
    def _detect_provider(self, api_url: str, provider_hint: str = None) -> str:
        """检测Provider类型"""
        if provider_hint:
            return provider_hint
        if "anthropic" in api_url:
            return "anthropic"
        # 需要手动解析的服务
        if any(x in api_url for x in ["qwen", "dashscope"]):
            return "custom"  # Qwen3 reasoning_content
        return "openai"  # 默认使用OpenAI SDK
```

## 实施步骤

1. [x] 添加SDK依赖到 requirements.txt
2. [x] 新增 `custom_provider.py`
3. [x] 重构 `openai_provider.py` 使用SDK（添加 stream_chat 和 chat 方法）
4. [x] 重构 `anthropic_provider.py` 使用SDK（添加 stream_chat 和 chat 方法）
5. [x] 更新 `base_provider.py` 添加 stream_chat 和 chat 抽象方法
6. [x] 格式兼容性配置（数据库+API+前端）
7. [x] 更新 `model_client.py` - 新增 `send_request_with_provider()` 方法
8. [x] 精简 `tool_format_converter.py`（删除 get_tool_provider，保留纯格式转换函数）
9. [x] 保留 `tool_definition_builder.py`（与MCP服务器交互，不属于流式解析）
10. [x] 集成测试各提供商（OpenAI Provider 已验证通过）
11. [ ] 逐步迁移调用方从 `send_request()` 到 `send_request_with_provider()`

## 新增方法说明

### model_client.py 新增方法

```python
# 新版Provider方法（与旧方法并存，渐进式迁移）

def send_request_with_provider(
    self,
    api_url: str,
    api_key: str,
    messages: List[Dict],
    model: str,
    is_stream: bool = False,
    callback: Optional[Callable] = None,
    agent_info: Optional[Dict] = None,
    **kwargs
) -> str:
    """
    使用Provider发送模型请求（新版，使用SDK）
    
    根据 format_compatibility 配置选择对应的 Provider：
    - openai: OpenAIToolProvider (使用 OpenAI SDK)
    - anthropic: AnthropicToolProvider (使用 Anthropic SDK)
    - custom: CustomToolProvider (httpx 手动解析)
    """

def _handle_stream_with_provider(self, provider, messages, model, ...) -> str:
    """使用Provider处理流式响应"""

def _execute_tool_calls_and_continue(self, messages, full_content, tool_calls, ...) -> str:
    """执行工具调用并继续对话"""

def _get_format_compatibility(self, config=None, model_id=None) -> str:
    """获取格式兼容性设置"""

def _get_provider_instance(self, format_compatibility, api_key, base_url) -> BaseToolProvider:
    """根据格式兼容性获取Provider实例"""
```

### Provider 统一接口

所有 Provider 实现以下方法：

```python
def stream_chat(self, messages, model, tools=None, **kwargs) -> Generator[Dict, None, None]:
    """
    流式对话
    
    Yields:
        {"type": "content", "content": str}      # 文本内容
        {"type": "reasoning", "content": str}    # 推理内容 (custom only)
        {"type": "tool_call", "tool_call": Dict} # 单个工具调用 (anthropic)
        {"type": "tool_calls", "tool_calls": List[Dict]} # 多个工具调用 (openai)
        {"type": "done", "stop_reason": str}     # 完成
        {"type": "error", "error": str}          # 错误
    """

def chat(self, messages, model, tools=None, **kwargs) -> Dict:
    """
    非流式对话
    
    Returns:
        {"content": str, "tool_calls": List[Dict]}  # 成功
        {"error": str}  # 失败
""
```

## 保留不变的文件

- `tool_handler.py` - XML解析 + MCP工具执行
- `tool_call_executor.py` - 工具调用执行
- `message_formater.py` - 前端消息格式（**不能改，前端依赖**）
- `message_processor.py` - 消息处理逻辑
- `base_provider.py` - 抽象基类

## 风险控制

1. **降级方案**: `custom_provider.py` 保留完能力
2. **渐进式**: 先实现custom_provider，确保现有功能不受影响
3. **特殊字段**: reasoning_content等由custom_provider处理

## 预期收益

- 删除 ~300行 手动JSON解析代码
- SDK自动处理格式变更
- 代码更易维护
