# 自主调度模式使用指南

## 概述

自主调度模式是ABM-LLM系统的一种新的智能体协作模式，允许智能体通过更新特定变量来自主决定下一个发言者和任务，实现更灵活的协作流程。

## 核心机制

### 控制变量
- **nextAgent**: 指定下一个要发言的智能体名称或UUID
- **nextAgentTODO**: 指定下一个智能体要执行的任务描述

### 工作流程
1. 系统启动自主调度任务，使用计划智能体或第一个智能体开始
2. 首个智能体直接执行任务（无需变量检测），并更新 `nextAgent` 和 `nextAgentTODO` 变量
3. 系统监控变量变化，自动调度下一个智能体
4. 重复步骤2-3，直到 `nextAgent` 为空或达到安全限制
5. 任务自动结束

## 配置参数

### 前端配置
```javascript
{
  topic: "任务主题",                    // 可选，默认为通用协作主题
  plannerAgentId: "agent-uuid",        // 可选，计划智能体ID，不指定则使用第一个智能体
  maxRounds: 50,                       // 可选，最大轮数，默认50
  timeoutMinutes: 60                   // 可选，超时时间（分钟），默认60
}
```

### 后端配置
```python
{
    'topic': '任务主题',
    'planner_agent_id': 'agent-uuid',   # 可选，计划智能体ID
    'max_rounds': 50,                   # 最大轮数限制
    'timeout_minutes': 60               # 超时时间限制
}
```

## API接口

### 启动自主调度
```
POST /api/action-tasks/{task_id}/conversations/{conversation_id}/autonomous-scheduling
```

**请求体:**
```json
{
  "topic": "请基于各自角色和知识，进行自主调度协作",
  "plannerAgentId": "agent-uuid-optional",
  "maxRounds": 50,
  "timeoutMinutes": 60,
  "stream": true
}
```

**响应:** 流式SSE响应（默认且推荐使用流式模式）

### 停止自主调度
使用现有的停止自主任务接口：
```
POST /api/action-tasks/{task_id}/conversations/{conversation_id}/autonomous-tasks/{autonomous_task_id}/stop
```

## 前端使用

### 1. 配置界面
在自主任务模态框中选择"自主调度"类型，配置相关参数。

### 2. 启动任务
```javascript
import { conversationAPI } from '../services/api/conversation';

const config = {
  topic: '市场分析协作',
  plannerAgentId: 'analyst-agent-id',
  maxRounds: 30,
  timeoutMinutes: 45
};

await conversationAPI.startAutonomousScheduling(
  taskId,
  conversationId,
  config,
  (content, meta) => {
    // 处理流式响应
    console.log('收到内容:', content);
    console.log('元数据:', meta);
  }
);
```

## 智能体实现指南

### 变量更新示例
智能体在执行任务时，需要更新控制变量：

```python
# 在智能体的响应中更新变量
agent_variable_service.set_variable(
    agent_id, 
    'nextAgent', 
    '数据分析师'  # 下一个智能体的名称或UUID
)

agent_variable_service.set_variable(
    agent_id, 
    'nextAgentTODO', 
    '请分析刚才收集的市场数据，重点关注趋势变化'
)
```

### 结束任务
当任务完成时，将 `nextAgent` 设置为空字符串：
```python
agent_variable_service.set_variable(agent_id, 'nextAgent', '')
```

## 安全机制

### 防无限循环
- **最大轮数限制**: 默认50轮，可配置
- **超时机制**: 默认60分钟，可配置
- **错误处理**: 智能体不存在或变量格式错误时自动停止

### 监控和日志
- 实时状态监控
- 详细的执行日志
- 错误追踪和报告

## 故障排除

### 常见问题

1. **智能体未找到**
   - 检查 `nextAgent` 变量值是否正确
   - 确认智能体名称或UUID存在于当前会话中

2. **任务意外停止**
   - 检查是否达到最大轮数限制
   - 检查是否超时
   - 查看错误日志

3. **变量更新失败**
   - 确认智能体有权限更新变量
   - 检查变量名称是否正确（nextAgent, nextAgentTODO）

### 调试技巧
- 启用详细日志记录
- 监控变量变化历史
- 使用流式响应查看实时状态

## 最佳实践

1. **合理设置限制**: 根据任务复杂度设置合适的最大轮数和超时时间
2. **清晰的任务描述**: 在 `nextAgentTODO` 中提供明确的任务指令
3. **错误处理**: 智能体应该处理异常情况并适当结束任务
4. **状态监控**: 定期检查任务执行状态和进度

## 扩展功能

### 未来计划
- 支持条件分支调度
- 智能体能力匹配
- 动态负载均衡
- 任务优先级管理

---

**注意**: 自主调度模式需要智能体具备一定的协作意识和变量管理能力。建议在使用前对智能体进行相应的提示词配置和测试。
