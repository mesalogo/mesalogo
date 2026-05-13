# OpenAI 兼容接口对外暴露方案

## 概述

对外暴露三个 OpenAI 兼容的 Chat Completions 接口，分别从行动任务、智能体、角色三个维度进入对话，使外部 IM 和第三方客户端能以标准协议调用 ABM-LLM 平台能力。

## 三个接口总览

```
外部 IM / 第三方客户端
    │
    ├── POST /api/openai-export/action-tasks/v1/chat/completions
    │        在指定行动任务的上下文中对话（任务级变量、多Agent协作）
    │
    ├── POST /api/openai-export/agents/v1/chat/completions
    │        直接跟某个智能体实例对话（已绑定角色+任务）
    │
    └── POST /api/openai-export/roles/v1/chat/completions
             用角色模板发起对话（自动创建临时会话）
    │
    ↓ API Key 认证
ABM-LLM Backend (:5000)
    ↓
现有 ConversationService / AgentService / RoleService
```

---

## 接口一：行动任务维度

通过行动任务上下文对话，可访问任务级环境变量、关联的多个 Agent、知识库等。

### 端点

```
POST /api/openai-export/action-tasks/v1/chat/completions
Authorization: Bearer <api_key>
Content-Type: application/json
```

### base_url

```
http://host:5000/api/openai-export/action-tasks/v1
```

### 请求体

```json
{
  "model": "<action_task_id>",
  "messages": [
    {"role": "user", "content": "当前任务进展如何？"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 2048,

  "extra_body": {
    "agent_id": "可选，指定任务中的某个Agent回复，不指定则用默认Agent",
    "conversation_id": "可选，继续已有会话",
    "enable_tools": true,
    "enable_knowledge": true
  }
}
```

### 响应（非流式）

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "<action_task_id>",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "当前任务已完成3个子目标..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 120,
    "total_tokens": 170
  },
  "extra": {
    "action_task_id": "task-xxx",
    "action_task_name": "Q1市场调研",
    "agent_id": "agent-xxx",
    "agent_name": "市场分析师",
    "conversation_id": "conv-xxx",
    "tool_calls": []
  }
}
```

### 响应（流式 SSE）

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<action_task_id>","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<action_task_id>","choices":[{"index":0,"delta":{"content":"当前任务"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<action_task_id>","choices":[{"index":0,"delta":{"content":"已完成3个"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<action_task_id>","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### 适用场景

- 外部系统对接某个正在运行的任务
- 需要任务级上下文（环境变量、多Agent协作结果）
- 监控/管理类 IM Bot（如"查看任务进度"）

---

## 接口二：智能体维度

直接跟某个已存在的 Agent 实例对话，Agent 已绑定角色和所属任务。

### 端点

```
POST /api/openai-export/agents/v1/chat/completions
Authorization: Bearer <api_key>
Content-Type: application/json
```

### base_url

```
http://host:5000/api/openai-export/agents/v1
```

### 请求体

```json
{
  "model": "<agent_id>",
  "messages": [
    {"role": "user", "content": "分析一下亚太区的市场数据"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 2048,

  "extra_body": {
    "conversation_id": "可选，继续已有会话",
    "enable_tools": true,
    "enable_knowledge": true
  }
}
```

### 响应（非流式）

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "<agent_id>",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "根据最新数据，亚太区Q4增长..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 200,
    "total_tokens": 245
  },
  "extra": {
    "agent_id": "agent-xxx",
    "agent_name": "市场分析师",
    "role_id": "role-xxx",
    "action_task_id": "task-xxx",
    "conversation_id": "conv-xxx",
    "tool_calls": []
  }
}
```

### 响应（流式 SSE）

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<agent_id>","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<agent_id>","choices":[{"index":0,"delta":{"content":"根据最新"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<agent_id>","choices":[{"index":0,"delta":{"content":"数据"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<agent_id>","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### 适用场景

- IM Bot 绑定到某个特定智能体（如"客服小助手"）
- 需要 Agent 级别的记忆和变量隔离
- 长期运行的专属助手

---

## 接口三：角色维度

用角色模板发起对话，平台自动创建临时会话，无需预先创建任务或 Agent。最轻量的接入方式。

### 端点

```
POST /api/openai-export/roles/v1/chat/completions
Authorization: Bearer <api_key>
Content-Type: application/json
```

### base_url

```
http://host:5000/api/openai-export/roles/v1
```

### 请求体

```json
{
  "model": "<role_id>",
  "messages": [
    {"role": "user", "content": "你好，介绍一下你自己"}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 2048,

  "extra_body": {
    "conversation_id": "可选，继续已有会话（实现多轮对话）",
    "session_id": "可选，外部会话标识（IM 侧的 chat_id，自动映射到内部 conversation）",
    "enable_tools": true,
    "enable_knowledge": true
  }
}
```

### 响应（非流式）

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "<role_id>",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！我是客服助手，擅长回答产品相关问题..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 30,
    "completion_tokens": 80,
    "total_tokens": 110
  },
  "extra": {
    "role_id": "role-xxx",
    "role_name": "客服助手",
    "conversation_id": "conv-xxx",
    "session_id": "feishu-chat-12345"
  }
}
```

### 响应（流式 SSE）

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<role_id>","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<role_id>","choices":[{"index":0,"delta":{"content":"你好！"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<role_id>","choices":[{"index":0,"delta":{"content":"我是客服助手"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1700000000,"model":"<role_id>","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### 适用场景

- 最简单的接入方式，IM Bot 只需知道 role_id 即可
- 无状态/轻状态场景（通过 session_id 维持多轮）
- 角色市场试用、快速体验

---

## 三个接口对比

| 维度 | action-tasks | agents | roles |
|------|-------------|--------|-------|
| model 字段 | action_task_id | agent_id | role_id |
| 前置条件 | 需已创建行动任务 | 需已创建 Agent（在某个任务中） | 只需角色存在 |
| 上下文范围 | 任务级（环境变量、多Agent） | Agent级（角色+任务绑定） | 角色级（自动创建临时会话） |
| 多轮对话 | conversation_id | conversation_id | conversation_id 或 session_id |
| 工具/知识库 | 任务关联的全部 | Agent 角色绑定的 | 角色绑定的 |
| 典型用途 | 任务监控、多Agent协作入口 | 专属助手、长期对话 | 轻量接入、角色试用 |
| 接入复杂度 | 高（需了解任务体系） | 中（需知道 Agent ID） | 低（只需 Role ID） |

---

## 认证方案

### API Key

三个接口共用同一套 API Key 认证，Key 绑定用户，权限继承用户本身的权限（无需额外配置权限范围）：

```
Authorization: Bearer sk-abm-xxxxxxxxxxxx
```

### API Key 数据模型

```python
class APIKey(BaseMixin, db.Model):
    __tablename__ = 'api_keys'

    name = Column(String(128), nullable=False)        # 用途备注，如"飞书Bot"
    key_hash = Column(String(256), nullable=False)     # Key 的 hash（不存明文）
    key_prefix = Column(String(16), nullable=False)    # 前缀用于列表展示，如"sk-abm-xxxx..."
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User")
```

### API Key 管理接口

```
POST   /api/api-keys              # 创建 Key（返回完整 Key，仅此一次）
GET    /api/api-keys              # 列出当前用户的 Key（只显示前缀）
DELETE /api/api-keys/:id          # 删除 Key
```

### 认证流程

```
请求 Header: Authorization: Bearer sk-abm-xxxxxxxxxxxx
    ↓
api_key_middleware 拦截 /api/openai-export/* 路径
    ↓
hash(key) 查表 → 找到关联 user_id
    ↓
注入 user context（后续权限检查复用现有用户权限体系）
    ↓
路由到 handler
```

### 前端：用户个人页面 API Keys 彩蛋入口

在现有 `ProfilePage`（`pages/account/ProfilePage.tsx`）底部增加一个折叠区域，默认收起，不干扰普通用户：

```
ProfilePage
├── 个人信息（现有）
├── ...
└── 底部折叠区域："开发者选项" 或 "API 接入"（默认收起，点击展开）
         ├── [创建 Key] 按钮 → 输入名称 → 生成并展示完整 Key（提示仅显示一次）
         ├── Key 列表：名称 | 前缀(sk-abm-xxxx...) | 创建时间 | 最后使用 | [删除]
         └── 简短说明：base_url 示例 + 用法提示
```

---

## 错误响应（OpenAI 兼容格式）

```json
{
  "error": {
    "message": "Action task 'task-xxx' not found",
    "type": "invalid_request_error",
    "param": "model",
    "code": "model_not_found"
  }
}
```

### 错误码

| HTTP 状态码 | code | 说明 |
|------------|------|------|
| 401 | `invalid_api_key` | API Key 无效或缺失 |
| 403 | `permission_denied` | 无权访问该资源 |
| 404 | `model_not_found` | action_task/agent/role 不存在 |
| 429 | `rate_limit_exceeded` | 超出速率限制 |
| 500 | `internal_error` | 服务端错误 |

---

## 实现架构

### 新增文件

```
backend/app/api/routes/
├── openai_export/
│   ├── __init__.py                  # Blueprint: openai_export_bp
│   ├── action_tasks_chat.py         # POST .../action-tasks/v1/chat/completions
│   ├── agents_chat.py               # POST .../agents/v1/chat/completions
│   └── roles_chat.py                # POST .../roles/v1/chat/completions

backend/app/services/
├── openai_export/
│   ├── __init__.py
│   ├── chat_service.py              # 统一对话处理（路由到 ConversationService）
│   ├── response_formatter.py        # 内部响应 → OpenAI 格式
│   └── stream_adapter.py            # SSE 流式适配（复用现有 stream_handler）

backend/app/middleware/
├── api_key_middleware.py             # API Key 认证中间件
```

### Blueprint 注册

```python
# routes/__init__.py 新增
from app.api.routes.openai_export import openai_export_bp

# register_api_blueprints() 新增
app.register_blueprint(openai_export_bp, url_prefix='/api/openai-export')
```

### 核心调用链（三个接口共用）

```
POST /api/openai-export/<resource>/v1/chat/completions
    ↓
api_key_middleware 验证
    ↓
解析 resource 类型 (action-tasks / agents / roles)
    ↓
chat_service.py
    ├── action-tasks → 查 ActionTask → 获取默认/指定 Agent → 获取/创建 Conversation
    ├── agents       → 查 Agent → 获取所属 ActionTask → 获取/创建 Conversation
    └── roles        → 查 Role → 创建临时 Conversation（或通过 session_id 复用）
    ↓
调用现有 ConversationService.process_message()
    ↓
response_formatter.py → OpenAI 格式响应
    ↓
stream=true ? stream_adapter (SSE) : JSON 响应
```

---

## 实现步骤

### Phase 1: 基础框架 ✅ 已完成

- [x] 新增 `APIKey` 模型 + 数据库迁移 (`models.py` + `migrations/20260207_add_api_keys.sql`)
- [x] 实现 `api_key_middleware.py` (Bearer Token 认证，sk-abm- 前缀)
- [x] 创建 `openai_export` Blueprint 骨架 (`__init__.py` 注册子蓝图)
- [x] 统一 `chat_service.py` 处理三个维度的请求转发和响应格式化（未拆分 response_formatter / stream_adapter，直接内联实现）

### Phase 2: 角色维度接口 ✅ 已完成

- [x] 实现 `roles_chat.py`
- [x] 实现 `chat_service.py` 中 role 路由逻辑（自动创建 ActionTask + Agent + Conversation）
- [x] session_id → conversation_id 映射
- [x] 流式 + 非流式测试通过

### Phase 3: 智能体维度接口 ✅ 已完成

- [x] 实现 `agents_chat.py`
- [x] 实现 `chat_service.py` 中 agent 路由逻辑（查找已有 ActionTask + Conversation）
- [x] Agent 级会话管理
- [x] 流式 + 非流式测试通过

### Phase 4: 行动任务维度接口 ✅ 已完成

- [x] 实现 `action_tasks_chat.py`
- [x] 实现 `chat_service.py` 中 action_task 路由逻辑（默认/指定 Agent）
- [x] 流式 + 非流式测试通过

### Phase 5: API Key 管理 + 前端 ✅ 已完成

- [x] API Key CRUD 接口 (`POST/GET/DELETE /api/openai-export/api-keys`)
- [x] 前端 ProfilePage API Key 管理（创建/列表/删除 + i18n 中英文）
- [x] `api_keys` 表已在 MariaDB 中创建并验证

### Phase 6: IM 集成 🔲 待开始

- [ ] 飞书 Bot 集成（Webhook 接收消息 → 调用 roles/v1 接口 → 回复）
- [ ] 钉钉 Bot 集成
- [ ] 微信公众号/企业微信集成
- [ ] OpenAI Python SDK 兼容性验证
- [ ] ChatBox / NextChat 等第三方客户端实测

### 当前状态

**Phase 1-5 全部完成**，OpenAI 兼容接口已可用。下一步是 Phase 6：对接具体 IM 平台。

---

## 兼容性验证

```python
from openai import OpenAI

# 通过角色对话（最常用）
client = OpenAI(
    api_key="sk-abm-xxxxxxxxxxxx",
    base_url="http://host:5000/api/openai-export/roles/v1"
)
response = client.chat.completions.create(
    model="<role_id>",
    messages=[{"role": "user", "content": "你好"}],
    stream=True
)
for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")

# 通过智能体对话
client_agent = OpenAI(
    api_key="sk-abm-xxxxxxxxxxxx",
    base_url="http://host:5000/api/openai-export/agents/v1"
)
response = client_agent.chat.completions.create(
    model="<agent_id>",
    messages=[{"role": "user", "content": "分析一下数据"}]
)

# 通过行动任务对话
client_task = OpenAI(
    api_key="sk-abm-xxxxxxxxxxxx",
    base_url="http://host:5000/api/openai-export/action-tasks/v1"
)
response = client_task.chat.completions.create(
    model="<action_task_id>",
    messages=[{"role": "user", "content": "任务进展如何？"}]
)
```
