# 监督者工作流程 API 和数据库设计文档（极简版）

## 概述

本文档描述了监督者会话功能的极简实现方案。遵循**最小化修改，最大化复用**的原则，避免过度设计，通过最少的修改实现完整的监督者功能。

## 核心设计理念

- **监督者就是特殊的智能体**：`is_observer=True` 的 Agent
- **监督者会话是前端UI概念**：后端统一存储，前端分离显示
- **复用现有API**：不新增API端点，通过参数区分功能
- **极简数据库修改**：只修改一个字段

## 数据库设计

### 唯一必要的修改

```sql
-- 唯一必要的数据库修改
ALTER TABLE messages MODIFY COLUMN role ENUM('human', 'agent', 'system', 'tool', 'supervisor') NOT NULL;

-- 可选：添加索引优化查询性能
CREATE INDEX idx_messages_supervisor ON messages(role, agent_id) WHERE role = 'supervisor';
```

### 现有模型复用

- **Agent 模型**：`is_observer=True` 标识监督者智能体
- **ActionSpaceObserver 模型**：存储监督者配置
- **Message 模型**：通过 `role='supervisor'` 标识监督者消息

## API 接口设计

### 核心原则：复用现有API

#### 1. 发送消息给监督者
```http
# 复用现有会话消息API
POST /api/action-tasks/{task_id}/conversations/{conversation_id}/messages
{
  "content": "用户向监督者发送的消息",
  "target_agent_id": 123  // 监督者智能体ID（现有参数）
}

Response:
{
  "human_message": {...},
  "response": {
    "role": "supervisor",  // 新增的角色类型
    "agent_id": 123,
    "content": "监督者的回复内容"
  }
}
```

#### 2. 监督者发送到任务会话
```http
# 同样的API，通过消息内容前缀区分
POST /api/action-tasks/{task_id}/conversations/{conversation_id}/messages
{
  "content": "[监督者干预] 建议大家注意讨论的礼貌性",
  "target_agent_id": 123
}

// 前端在发送前添加前缀，监督者响应直接出现在任务会话中
```

#### 3. 获取会话消息
```http
# 复用现有API
GET /api/action-tasks/{task_id}/conversations/{conversation_id}/messages

// 前端通过筛选逻辑分离显示监督者相关消息
```

#### 4. 获取监督者列表
```http
# 复用现有智能体API
GET /api/action-tasks/{task_id}/agents?is_observer=true
```

#### 5. 流式响应
```http
# 复用现有流式API
POST /api/action-tasks/{task_id}/conversations/{conversation_id}/messages?stream=1
{
  "content": "用户向监督者发送的消息",
  "target_agent_id": 123
}

// 通过SSE接收监督者的实时响应
```

## 前端实现

### 核心逻辑：消息筛选和UI分离

#### 1. 监督者智能体识别
```javascript
const getSupervisorAgents = (agents) => {
  return agents.filter(agent => agent.is_observer);
};
```

#### 2. 消息筛选逻辑
```javascript
// 筛选监督者相关消息
const filterSupervisorMessages = (messages, supervisorAgentIds) => {
  return messages.filter(message =>
    message.role === 'supervisor' ||
    (message.role === 'human' && supervisorAgentIds.includes(message.agent_id))
  );
};

// 筛选任务会话消息（排除纯监督者交互）
const filterTaskMessages = (messages, supervisorAgentIds) => {
  return messages.filter(message => {
    if (message.role !== 'human') return true;
    if (!supervisorAgentIds.includes(message.agent_id)) return true;
    if (message.content.startsWith('[监督者干预]')) return true;
    return false;
  });
};
```

#### 3. 发送目标控制
```javascript
const sendToSupervisor = async (content, supervisorId, sendToTask = false) => {
  const finalContent = sendToTask
    ? `[监督者干预] ${content}`
    : content;

  const response = await fetch(`/api/action-tasks/${taskId}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: finalContent,
      target_agent_id: supervisorId
    })
  });

  await refreshMessages();
  return response.json();
};
```

## 规则检查集成

### 在监督者消息处理中集成规则检查

```python
def process_supervisor_message(content, supervisor_agent, conversation):
    """处理监督者消息，集成规则检查"""

    # 1. 获取行动空间的规则集
    action_space = conversation.action_task.action_space
    rule_sets = get_action_space_rule_sets(action_space.id)

    # 2. 构建检查上下文
    recent_messages = get_recent_messages(conversation.id, limit=10)
    context = build_rule_check_context(recent_messages, content)

    # 3. 执行规则检查（复用现有API）
    rule_results = []
    for rule_set in rule_sets:
        result = check_rules_with_context(rule_set.rules, context, supervisor_agent.role_id)
        rule_results.extend(result)

    # 4. 将规则检查结果融入监督者响应
    supervisor_prompt = build_supervisor_prompt(supervisor_agent, context, rule_results, content)

    # 5. 生成监督者响应
    response = generate_agent_response(supervisor_agent, supervisor_prompt)

    return response
```

## 实现检查清单

### 数据库修改
- [ ] 修改 `messages.role` 字段支持 `supervisor`
- [ ] 添加索引优化查询性能
- [ ] 验证现有数据不受影响

### 后端修改
- [ ] 修改消息处理逻辑，支持 `role='supervisor'`
- [ ] 集成规则检查到监督者消息处理
- [ ] 确保现有API兼容性

### 前端修改
- [ ] 实现消息筛选逻辑
- [ ] 更新 `ActionTaskSupervisor.js` 组件
- [ ] 实现发送目标控制
- [ ] 测试流式响应

### 测试验证
- [ ] 监督者消息正常发送和接收
- [ ] 消息筛选逻辑正确
- [ ] 发送到任务会话功能正常
- [ ] 现有功能不受影响

## 成功标志

实现成功的标志是：
- 数据库只有一个字段修改
- API没有新增端点
- 前端通过筛选逻辑实现功能分离
- 监督者功能完全基于现有智能体机制
- 用户可以自然地与监督者交互，并控制干预方式

这个极简设计确保了监督者功能的完整实现，同时保持了系统的简洁性和可维护性。