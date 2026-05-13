# stream_handler.py 重构计划

> **原则：KISS (Keep It Simple, Stupid)**
> 不创建新文件夹，不过度抽象，只做必要的简化。

---

## 一、接口兼容性要求（不可变更）

### 1.1 导出的公共函数（被15+处引用）

| 函数 | 签名 | 调用方 |
|------|------|--------|
| `create_sse_response` | `(generator_function) -> Response` | routes/*.py |
| `queue_to_sse` | `(result_queue) -> Generator` | routes/*.py |
| `wrap_stream_callback` | `(result_queue) -> Callable` | conversation_service.py, *_conversation.py |
| `handle_streaming_response` | `(response, callback, original_messages=None, api_config=None) -> str` | model_client.py, base_workflow.py |
| `register_streaming_task` | `(task_id, conversation_id, result_queue, agent_id=None) -> None` | model_client.py, conversation_service.py |
| `cancel_streaming_task` | `(task_id, conversation_id, agent_id=None) -> bool` | routes/stream.py |
| `handle_streaming_response_with_adapter` | `(adapter, response, callback, api_config=None) -> str` | external_model_client.py |
| `StreamCancelledException` | 异常类 | conversation_service.py |

### 1.2 SSE消息格式（前端依赖）

前端 `useStreamingHandler.tsx` 和 `conversation.ts` 期望的格式：

```javascript
// 纯文本内容
{"content": "...", "meta": null}

// 连接状态
{"content": null, "meta": {"connectionStatus": "connected|done|error|agentDone", ...}}

// 工具调用结果
{"content": null, "meta": {"type": "toolResult", "role": "tool", "content": "...", ...}}

// 智能体信息
{"content": null, "meta": {"type": "agentInfo", "agentId": "...", ...}}

// 虚拟消息
{"content": "...", "meta": {"type": "virtualMessage", "isVirtual": true, ...}}
```

**结论：message_formater.py 保持不变**

### 1.3 流式系统全景图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React)                              │
│  useStreamingHandler.tsx ← conversation.ts (fetch + SSE解析)    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ SSE (text/event-stream)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     routes/stream.py                             │
│            create_sse_response + queue_to_sse                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ result_queue
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              conversation_service.py / auto_conversation.py      │
│                    wrap_stream_callback                          │
│                 register_streaming_task                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ callback
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      model_client.py                             │
│              send_request(is_stream=True)                        │
│         connection_manager.register_connection()                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ response (requests.Response)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    stream_handler.py  ← 重构目标                 │
│              handle_streaming_response()                         │
│         response.iter_lines() → 解析 → callback()               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
│ tool_handler │     │ call_llm_with_   │     │ adapters/*.py  │
│ execute_tool │     │ tool_results()   │     │ (外部平台)      │
└──────────────┘     └──────────────────┘     └────────────────┘
```

**取消流程**：
```
用户点击停止
  → routes/stream.py: cancel_streaming_task()
  → stream_handler.py: 查找queue，发送cancel信号
  → connection_manager.py: force_close_connection()
  → socket关闭 → iter_lines()抛出异常
```

### 1.4 依赖 stream_handler 的模块（需确保兼容）

| 模块 | 使用的函数 | 用途 |
|------|-----------|------|
| `auto_conversation.py` | `wrap_stream_callback` | 自主讨论 |
| `variable_stop_conversation.py` | `wrap_stream_callback` | 变量停止模式 |
| `variable_trigger_conversation.py` | `wrap_stream_callback` | 变量触发模式 |
| `time_trigger_conversation.py` | `wrap_stream_callback` | 时间触发模式 |
| `autonomous_scheduling_conversation.py` | `wrap_stream_callback` | 自主调度 |
| `model_client.py` | `handle_streaming_response`, `register_streaming_task` | LLM调用 |
| `external_model_client.py` | `handle_streaming_response_with_adapter` | 外部平台 |
| `callback_utils.py` | 配合 `result_queue` 使用 | 统一回调 |

---

## 二、当前问题（按优先级）

| 优先级 | 问题 | 影响 |
|--------|------|------|
| P0 | 全局字典无锁保护 | 多线程竞态风险 |
| P1 | `handle_streaming_response` 500+行 | 难维护 |
| P1 | 工具调用处理重复3次 | DRY违反 |
| P1 | 取消检测逻辑过度复杂 | 见下文分析 |
| P2 | `cancel_streaming_task` 总返回True | 错误隐藏 |
| P3 | 私有API访问 `response.raw._connection` | 兼容性风险 |

### 2.1 取消机制分析

**正确的取消流程（已有）**：
```
用户点击停止 
  → cancel_streaming_task() 
  → connection_manager.force_close_connection() 
  → 关闭底层socket 
  → response.iter_lines() 抛出异常 
  → handle_streaming_response 捕获异常并返回
```

**问题：当前在流循环里做了过多"主动检测"**：
```python
# 当前代码在每行数据后都检查（约50行检测代码）
for line in response.iter_lines():
    if check_for_cancel_signal():  # 检查3个地方：连接管理器、队列、中断标志
        break
```

**简化方案**：
- 关闭socket后，`iter_lines()` 会自然抛出 `ConnectionError` 或类似异常
- 只需在异常处理中统一处理，**无需每行主动检测**
- 保留 `StreamCancelledException` 用于语义清晰，但不需要主动检查并抛出

---

## 三、重构方案（KISS版）

### 3.1 不创建新文件，仅在现有文件内重构

```
stream_handler.py  (保持单文件，内部重组织)
├── # 全局任务管理（加锁）
├── # SSE工具函数（不变）
├── # 工具调用执行（抽取为内部函数）
├── # 取消检测（抽取为内部函数）
└── # 主处理函数（拆分为子函数）
```

### 3.2 具体修改

#### 修改1：加锁保护全局字典

```python
import threading

_tasks_lock = threading.RLock()
_active_streaming_tasks = {}
_agent_streaming_tasks = {}

def register_streaming_task(task_id, conversation_id, result_queue, agent_id=None):
    with _tasks_lock:
        task_key = f"{task_id}:{conversation_id}"
        _active_streaming_tasks[task_key] = result_queue
        if agent_id:
            agent_key = f"{task_key}:{agent_id}"
            _agent_streaming_tasks[agent_key] = result_queue
```

#### 修改2：抽取工具调用执行为单一函数

```python
def _execute_and_format_tool_call(tool_call, callback):
    """执行工具调用并格式化结果（消除重复代码）"""
    # 确保有ID
    if not tool_call.get("id"):
        tool_call["id"] = str(uuid.uuid4())
    
    # 执行
    result = execute_tool_call(tool_call)
    
    # 检测状态（统一逻辑）
    status = _detect_tool_status(result)
    
    # 格式化并发送
    msg = format_tool_result_as_role(
        result=result,
        tool_name=tool_call["function"]["name"],
        tool_call_id=tool_call["id"],
        tool_parameter=tool_call["function"]["arguments"],
        status=status
    )
    callback(serialize_message(msg))
    
    return {"tool_call_id": tool_call["id"], "tool_name": tool_call["function"]["name"], "result": result}

def _detect_tool_status(result):
    """统一的工具状态检测"""
    try:
        obj = json.loads(result) if isinstance(result, str) else result
        if isinstance(obj, dict):
            if obj.get("isError") or obj.get("is_error"):
                if obj.get("error") is not False:
                    return "error"
            if obj.get("error") and obj["error"] is not False:
                return "error"
    except:
        if any(kw in str(result) for kw in ["错误", "Error", "失败"]) and "error=False" not in str(result):
            return "error"
    return "success"
```

#### 修改3：简化取消机制 + 拆分handle_streaming_response

**核心思想**：依赖socket关闭后的自然异常，删除主动检测代码

```python
def handle_streaming_response(response, callback, original_messages=None, api_config=None):
    """处理流式响应（重构后）"""
    
    parser_state = _ParserState()
    is_cancelled = False
    
    try:
        # 1. 解析流 - 不再每行检测取消
        for line in response.iter_lines():
            if not line:
                continue
            chunk = _parse_sse_line(line)
            if chunk:
                _process_chunk(chunk, parser_state, callback)
                
    except (ConnectionError, requests.exceptions.ChunkedEncodingError, 
            requests.exceptions.ConnectionError) as e:
        # socket被关闭时会抛出这些异常 - 这就是取消的信号
        logger.info(f"流式连接被关闭: {e}")
        is_cancelled = True
        
    except Exception as e:
        # 其他异常 - 记录但继续处理已有内容
        logger.error(f"流式处理异常: {e}")
    
    # 2. 如果被取消，直接返回已处理内容
    if is_cancelled:
        return parser_state.full_content
    
    # 3. 处理工具调用
    tool_results = []
    for tc in parser_state.all_tool_calls:
        try:
            tr = _execute_and_format_tool_call(tc, callback)
            tool_results.append(tr)
        except (ConnectionError, requests.exceptions.ConnectionError):
            # 工具调用期间被取消
            break
    
    # 4. 二次LLM调用
    if tool_results and original_messages and api_config:
        second_response = call_llm_with_tool_results(
            original_messages, parser_state.all_tool_calls, 
            tool_results, api_config, callback
        )
        parser_state.full_content += second_response
    
    return parser_state.full_content

class _ParserState:
    """内部类：解析状态"""
    def __init__(self):
        self.full_content = ""
        self.has_reasoning = False
        self.openai_tool_calls = []
        self.xml_tool_calls = []
    
    @property
    def all_tool_calls(self):
        return self.xml_tool_calls + self.openai_tool_calls
```

**删除的代码**：
- `check_for_cancel_signal()` 函数（约50行）
- `_CancelChecker` 类
- `set_socket_timeout()` 函数
- 每行数据后的取消检测
- `StreamCancelledException` 的主动抛出逻辑（保留异常类定义供外部使用）

#### 修改4：移除私有API访问

```python
# 删除 set_socket_timeout 函数
# 改用 response.iter_lines(decode_unicode=True) 的超时参数
# 或在发起请求时设置 timeout 参数
```

---

## 四、实施步骤

| 步骤 | 任务 | 工时 |
|------|------|------|
| 1 | 添加线程锁保护全局字典 | 0.5h |
| 2 | 抽取 `_execute_and_format_tool_call` 和 `_detect_tool_status` | 1h |
| 3 | 删除 `check_for_cancel_signal` 和 `set_socket_timeout`，简化异常处理 | 1h |
| 4 | 创建 `_ParserState`，拆分 `handle_streaming_response` | 1.5h |
| 5 | 测试验证（流式对话、取消、工具调用） | 1h |

**总计：约 5 小时**

### 4.1 取消机制验证测试

```bash
# 测试用例：
1. 发送消息，等待流式响应开始，点击停止 → 连接应立即断开
2. 发送消息，等待工具调用执行中，点击停止 → 应中断工具调用
3. 发送消息，完整响应 → 功能正常
```

---

## 五、验收标准

- [ ] 所有公共接口签名不变
- [ ] SSE消息格式不变
- [ ] `handle_streaming_response` 主体 < 100行
- [ ] 工具调用处理逻辑只有1份
- [ ] 全局字典访问有锁保护
- [ ] 现有功能正常（手动测试流式对话、取消、工具调用）

---

## 六、不做的事情

- ❌ 不创建 stream_handler/ 文件夹
- ❌ 不引入新的依赖
- ❌ 不修改 message_formater.py
- ❌ 不修改公共接口签名
- ❌ 不引入复杂的状态机模式
- ❌ 不修改 connection_manager.py（取消机制核心，已稳定）
- ❌ 不修改 callback_utils.py（统一回调，已稳定）
- ❌ 不修改各 adapters/*.py（外部平台适配器）

---

## 七、关键风险点

### 7.1 取消时机问题

**场景**：用户在以下时机点击停止
1. 流式响应进行中 → socket关闭，`iter_lines()` 抛异常 ✓
2. 工具调用执行中 → 工具可能已执行，无法回滚 ⚠️
3. 二次LLM调用中 → 需要同样能中断 ✓

**工具调用的特殊处理**：
- 工具调用是同步的，无法真正"取消"
- 只能在工具调用之间检查取消状态
- 保留工具调用循环中的取消检查（简化版）

### 7.2 自主任务的执行模型与取消

**执行模型（非线程，同步执行 + 状态检查）**：

```
前端请求 → 后端请求线程 → 自主任务循环
                              │
                              ├─ for round in rounds:
                              │     for agent in agents:
                              │         if task_key not in _active_auto_discussions:  ← 检查点
                              │             return "stopped"
                              │         process_message(agent)  ← 这里会流式输出
                              │
                              └─ 循环结束或被停止
```

**关键机制**：
- `_active_auto_discussions` 字典跟踪活动任务
- `stop_auto_discussion()` 从字典删除 → 循环在下次检查时退出
- 不是独立线程，是在请求线程中同步执行

**两个停止操作的区别**：

| 操作 | 做什么 | 效果 |
|------|--------|------|
| 停止当前Agent | `connection_manager.force_close_connection()` | socket关闭，流式中断，循环继续下一个Agent |
| 停止自主任务 | `stop_auto_discussion()` 从字典删除 | 循环在检查点退出，整个任务结束 |

**前端调用**：

| 按钮位置 | 后端API | 预期行为 |
|---------|---------|---------|
| 会话框停止 | `/cancel-stream?agent_id=xxx` | 只停当前Agent |
| 顶部停止按钮 | `/cancel-stream` (无agent_id) | 停整个自主任务 |
| 自主任务卡片 | `/autonomous-tasks/{id}/stop` | 停整个自主任务 |

**🐛 当前代码问题**：

```python
# stream_handler.py 第370-385行
def cancel_streaming_task(task_id, conversation_id, agent_id=None):
    ...
    # 无论是否有agent_id，都调用stop_auto_discussion
    # 这导致：会话框停止按钮(带agent_id)也会停止整个自主任务
    auto_discussion_stopped = stop_auto_discussion(task_id, conversation_id)
```

**修复方案**：
```python
# 只有不带agent_id时，才停止自主任务调度
if not agent_id:
    stop_auto_discussion(task_id, conversation_id)
```

**代码位置**：
- `cancel_streaming_task()` 在 `stream_handler.py` 第199-396行
- `stop_auto_discussion()` 在 `auto_conversation.py` 第704行
- `_active_auto_discussions` 在 `auto_conversation.py` 第701行

### 7.3 外部平台的停止

外部平台（Dify、Coze等）有自己的停止API：
- `adapter.stop_streaming()` 调用外部平台停止接口
- `external_model_client.stop_external_streaming()` 已在 `cancel_streaming_task` 中调用

**结论**：这些调用逻辑保持不变，只简化 stream_handler.py 内部
