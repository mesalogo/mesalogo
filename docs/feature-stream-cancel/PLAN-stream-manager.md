# LLM流式响应管理器设计方案

## 背景与问题

在现有的流式响应实现中，我们发现以下问题：

1. 当用户点击"停止"按钮时，虽然前端和后端API都响应了取消命令，但实际上LLM仍然继续生成内容
2. 无法真正中断底层LLM请求，导致资源浪费和用户体验问题
3. 在多智能体对话中，无法平滑切换到下一个智能体的响应流

现有实现中，我们只在应用层面做了标记，没有真正终止LLM的生成过程。

## 设计目标

1. 实现真正的LLM流式响应取消功能
2. 支持多层级的流管理（行动任务、会话、智能体、流）
3. 精确控制单个流或批量取消多个流
4. 优化用户体验，确保"停止"按钮点击后立即生效
5. 确保系统资源高效利用，避免不必要的计算

## 架构设计

将所有流管理逻辑集中在`stream_handler.py`模块中，实现完整的流生命周期管理。流管理器与模型客户端协同工作，负责创建、监控和终止LLM的流式响应。

```
┌─────────────┐     ┌────────────────┐     ┌─────────────┐
│   前端      │◄────┤  API路由层     │◄────┤  流管理器   │
│  控制界面   │     │(conversations.py)    │(stream_handler.py)
└─────────────┘     └────────────────┘     └──────┬──────┘
                                                  │
                                                  ▼
                                           ┌─────────────┐
                                           │  模型客户端 │
                                           │(model_client.py)
                                           └─────────────┘
```

## 数据结构

### 流任务管理字典

```python
_active_llm_stream_tasks = {
    # 主键结构: f"{task_id}:{conversation_id}:{agent_id}:{stream_id}"
    "task_key": {
        'stream_id': "uuid-string",         # 流的唯一标识
        'task_id': task_id,                 # 行动任务ID
        'conversation_id': conversation_id, # 会话ID
        'agent_id': agent_id,               # 智能体ID
        'response_queue': queue_obj,        # 响应队列
        'request_canceller': canceller_obj, # 请求取消器
        'start_time': timestamp,            # 开始时间
        'status': "running"                 # 状态: running, cancelled, completed
    }
}
```

### 请求取消器接口

```python
class LLMRequestCanceller:
    def __init__(self, model_name, request_id=None):
        self.model_name = model_name
        self.request_id = request_id or str(uuid.uuid4())
        self.is_cancelled = False
    
    def abort_generation(self):
        """中断LLM生成过程"""
        # 模型特定的取消逻辑
```

## 核心功能与接口

### 1. 注册流任务

```python
def register_llm_stream_task(task_id, conversation_id, agent_id, response_queue, llm_request_canceller=None):
    """注册LLM流式响应任务
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        agent_id: 智能体ID
        response_queue: 响应内容队列
        llm_request_canceller: LLM请求取消器
        
    Returns:
        str: 生成的流ID
    """
```

### 2. 取消特定流

```python
def cancel_specific_llm_stream(stream_id):
    """取消特定的LLM流式响应
    
    Args:
        stream_id: 流ID
        
    Returns:
        bool: 是否成功取消
    """
```

### 3. 取消会话的所有流

```python
def cancel_conversation_llm_streams(task_id, conversation_id):
    """取消会话的所有LLM流式响应
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        
    Returns:
        int: 取消的流数量
    """
```

### 4. 取消智能体的流

```python
def cancel_agent_llm_streams(task_id, conversation_id, agent_id):
    """取消特定智能体的所有LLM流式响应
    
    Args:
        task_id: 行动任务ID
        conversation_id: 会话ID
        agent_id: 智能体ID
        
    Returns:
        int: 取消的流数量
    """
```

### 5. 内部取消流的实现

```python
def _cancel_stream_by_key(task_key):
    """内部函数：通过task_key取消特定流
    
    Args:
        task_key: 任务键
        
    Returns:
        bool: 是否成功取消
    """
```

## 响应队列内容

响应队列是流式处理的核心通信机制，包含以下类型的内容：

### 1. 文本内容片段

```python
# 纯文本内容
response_queue.put("这是模型生成的文本片段")
```

### 2. 结构化消息对象

```python
# 智能体信息
response_queue.put({
    "type": "agentInfo",
    "agentId": "123",
    "agentName": "助手",
    "turnPrompt": "轮到智能体发言",
    "responseOrder": 1,
    "totalAgents": 3
})

# 连接状态
response_queue.put({
    "connectionStatus": "connected",  # connecting, connected, error, done
    "message": "连接已建立"
})

# 取消信号
response_queue.put({
    "type": "stream_cancelled",
    "message": "用户取消了LLM流式响应"
})
```

### 3. 特殊控制信号

```python
# 结束信号
response_queue.put(None)

# 分隔符
response_queue.put("<!-- LLM开始处理工具调用结果 -->")
```

## 前端交互流程

1. 前端点击"停止"按钮时，调用`cancelStreamingResponse` API
2. API执行前端取消（中断fetch请求）和后端取消（调用cancel-stream接口）
3. 后端cancel-stream接口调用`cancel_conversation_llm_streams`
4. 流管理器终止LLM请求并发送取消通知到响应队列
5. 前端接收取消通知，更新UI状态

## 实现计划

1. 增强`stream_handler.py`中的流管理功能
2. 在`model_client.py`中实现请求取消机制
3. 修改`conversation_service.py`中的流处理函数，使用新的流管理器
4. 更新API路由处理流取消请求
5. 确保前端正确处理取消信号

## 预期效果

1. 点击"停止"按钮后立即停止LLM的生成过程
2. 在顺序对话中取消当前智能体后，能平滑切换到下一个智能体
3. 降低系统资源消耗，提高响应效率
4. 改善用户体验，使停止操作更加可靠和即时 