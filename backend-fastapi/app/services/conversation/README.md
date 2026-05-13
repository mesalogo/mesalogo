# 会话服务模块

本目录包含会话服务的核心组件，采用工作流模式组织代码，并集成了监督者模式用于事件通知和监控。

## 目录结构

```
app/services/conversation/
├── README.md                 # 本文档
├── base_workflow.py          # 工作流基类
├── message_processor.py      # 消息处理器
├── tool_handler.py           # 工具调用处理器
├── stream_handler.py         # 流式处理器
├── model_client.py           # 模型客户端
├── observer.py               # 监督者模式组件
├── event_types.py            # 事件类型定义
└── observers/                # 具体监督者实现
    ├── logging_observer.py   # 日志监督者
    └── metrics_observer.py   # 指标监督者
```

## 主要组件

### 1. 基础组件

#### `base_workflow.py`
- 定义工作流基类和接口
- 提供共享方法和事件发送功能
- 所有具体工作流都继承自此基类

#### `message_processor.py`
- 处理消息的共享核心逻辑
- 提供提示词构建功能
- 处理消息格式化和转换

#### `tool_handler.py`
- 解析智能体回复中的工具调用
- 执行工具调用并处理结果
- 支持多种工具调用格式

#### `stream_handler.py`
- 处理流式响应相关功能
- 创建SSE响应
- 将队列内容转换为SSE事件流
- 包装流式回调函数

#### `model_client.py`
- 处理模型API调用
- 发送流式模型请求
- 处理模型响应

### 2. 监督者模式组件

#### `observer.py`
- 定义监督者接口和主题基类
- 提供事件管理器（单例）
- 管理监督者注册和事件通知

#### `event_types.py`
- 定义系统中的所有事件类型常量
- 包括会话、消息、智能体、工具调用、自动讨论和流式处理相关事件

#### `observers/`
- 包含具体的监督者实现
- `logging_observer.py`: 将事件记录到日志系统
- `metrics_observer.py`: 收集系统性能和使用指标

## 工作流

工作流组件位于上层目录 `app/services/` 中：

### `conversation_workflow.py`
- 继承自 `BaseWorkflow`
- 处理普通会话相关功能
- 包括创建会话、获取会话列表、获取会话消息、添加消息等功能

### `auto_conversation_workflow.py`
- 继承自 `BaseWorkflow`
- 处理自动讨论相关功能
- 包括启动自动讨论、处理讨论轮次、生成总结等功能

## 服务入口

服务入口点位于 `app/services/conversation_service.py`：

### `conversation_service.py`
- 作为服务入口点
- 调用相应的工作流处理请求

## 事件流

系统中的事件流如下：

1. 客户端发送请求到服务入口 `conversation_service.py`
2. 服务入口调用相应的工作流处理请求
3. 工作流在关键点发出事件通知
4. 事件管理器将事件通知分发给已注册的监督者
5. 监督者处理事件（记录日志、收集指标等）
6. 工作流完成处理并返回结果
7. 服务入口将结果返回给客户端

## 使用示例

### 发出事件通知

```python
# 在工作流中发出事件通知
def process_message(self, conversation_id, content):
    # 发出消息接收事件
    self.emit_event(MESSAGE_RECEIVED, {
        'conversation_id': conversation_id,
        'content': content
    })
    
    # 处理消息...
    
    # 发出消息处理完成事件
    self.emit_event(MESSAGE_PROCESSED, {
        'conversation_id': conversation_id,
        'message_id': message.id
    })
```

### 注册监督者

```python
# 注册监督者到事件管理器
from app.services.conversation.observer import EventManager
from app.services.conversation.observers.logging_observer import LoggingObserver
from app.services.conversation.event_types import MESSAGE_RECEIVED

event_manager = EventManager()
logging_observer = LoggingObserver()
event_manager.attach(MESSAGE_RECEIVED, logging_observer)
```

### 使用工作流

```python
# 使用会话工作流
from app.services.conversation_workflow import ConversationWorkflow

workflow = ConversationWorkflow()
result = workflow.add_message_to_conversation(
    conversation_id=123,
    message_data={
        'content': '你好，智能助手',
        'target_agent_id': 456
    }
)
```

## 扩展指南

### 添加新的监督者

1. 在 `observers/` 目录下创建新的监督者类
2. 继承 `Observer` 基类并实现 `update` 方法
3. 在应用初始化时注册监督者到事件管理器

### 添加新的事件类型

1. 在 `event_types.py` 中添加新的事件类型常量
2. 在相应的工作流中使用 `emit_event` 方法发出新事件

### 添加新的工作流

1. 创建新的工作流类，继承 `BaseWorkflow`
2. 实现 `execute` 和 `validate` 方法
3. 在关键点使用 `emit_event` 方法发出事件通知
4. 在 `conversation_service.py` 中添加相应的方法调用新工作流

## 模块概述

### message_formater.py

**消息格式化模块**，提供统一的SSE消息格式化工具，用于标准化后端到前端的所有消息格式。主要函数：

- `format_text_content` - 格式化纯文本内容
- `format_agent_info` - 格式化智能体信息
- `format_connection_status` - 格式化连接状态
- `format_thinking` - 格式化思考内容
- `format_tool_call` - 格式化工具调用
- `format_tool_result_as_role` - 格式化工具调用结果为role:tool格式
- `format_virtual_message` - 格式化虚拟消息
- `format_round_info` - 格式化轮次信息
- `format_system_message` - 格式化系统消息
- `serialize_message` - 将消息对象序列化为JSON字符串

使用此模块可以确保所有SSE消息使用统一的格式，便于前端解析和处理。

### message_formater_example.py

**消息格式化示例模块**，展示如何在实际代码中使用message_formater模块。
