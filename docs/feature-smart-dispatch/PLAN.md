# 智能分发功能计划 (Smart Dispatch)

> **版本**: v1.0  
> **创建日期**: 2025-01-13  
> **状态**: 规划中

## 1. 功能概述

### 1.1 需求描述

在行动任务详情的消息输入区域，增加"智能分发"模式开关。开启后，当用户发送消息时，系统会根据上下文会话内容自动选择最合适的智能体进行回答，而不是发送给所有智能体。

### 1.2 功能命名

| 中文名 | 英文名 | 说明 |
|--------|--------|------|
| **智能分发** | Smart Dispatch | 推荐，强调智能选择+多角色分发 |

备选：
- 角色路由 (Role Routing)
- 智能派单 (Smart Assignment)
- 自动匹配 (Auto Match)

### 1.3 核心价值

- 提升多智能体协作效率，避免所有智能体都响应同一问题
- 根据问题内容自动匹配最专业的角色
- 减少冗余回复，节省 Token 消耗

---

## 2. UI 设计

### 2.1 开关位置

在智能体下拉选择器**左侧**添加开关：

```
┌─────────────────────────────────────────────────────────────────┐
│  [智能分发开关] [智能体下拉选择器（开启时禁用）]                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 输入消息，使用 @ 提及智能体...                            │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│  [隔离模式] [自动滚动] | 状态提示                                │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 交互逻辑

| 状态 | 智能分发开关 | 智能体选择器 | 用户 @ 提及 | 实际发送目标 |
|------|-------------|-------------|------------|-------------|
| 1 | 关闭 | 未选择 | 无 | 全部智能体 |
| 2 | 关闭 | 已选择 A, B | 无 | A, B |
| 3 | 关闭 | 未选择 | @C | C |
| 4 | **开启** | **禁用** | 无 | **系统自动选择** |
| 5 | **开启** | **禁用** | @C | **C（用户优先）** |
| 6 | **开启** | **禁用** | @C @D | **C, D（用户优先）** |

### 2.3 冲突解决策略：用户优先

当智能分发开启时：
1. **无 @ 提及**：系统根据消息内容自动选择最佳智能体
2. **有 @ 提及**：尊重用户意图，只发送给 @ 的智能体（智能分发不生效）
3. 开关保持开启状态，显示提示："已检测到 @ 提及，将发送给指定智能体"

### 2.4 UI 状态提示

| 场景 | 底部状态栏提示 |
|------|---------------|
| 智能分发开启，无 @ | "系统将自动选择最佳智能体响应" |
| 智能分发开启，有 @ | "已检测到 @ 提及，将发送给指定智能体" |
| 智能分发关闭 | 保持现有逻辑 |

---

## 3. 技术方案

### 3.1 前端改动

**文件**: `frontend/src/pages/actiontask/components/ActionTaskConversation/MessageInput.tsx`

1. 新增 props：
   - `smartDispatchEnabled: boolean` - 智能分发开关状态
   - `setSmartDispatchEnabled: (enabled: boolean) => void` - 设置函数

2. 新增 UI 元素：
   - 在智能体选择器左侧添加 Switch 开关
   - 开关开启时，Select 组件设置 `disabled={true}`
   - 添加 Tooltip 说明功能

3. 发送逻辑修改：
   - 检测是否有 @ 提及
   - 如果智能分发开启且无 @ 提及，设置特殊标记 `smartDispatch: true`

### 3.2 后端改动

**文件**: `backend/app/api/routes/action_tasks/messages.py`

1. 接收新参数：`smart_dispatch: bool`

2. 智能体选择逻辑：
```python
if smart_dispatch and not target_agent_ids:
    # 调用智能分发服务选择最佳智能体
    best_agent_id = smart_dispatch_service.select_best_agent(
        task_id=task_id,
        message_content=content,
        conversation_history=history,
        available_agents=agents
    )
    target_agent_ids = [best_agent_id]
```

**新增文件**: `backend/app/services/smart_dispatch_service.py`

```python
class SmartDispatchService:
    def select_best_agent(
        self,
        task_id: int,
        message_content: str,
        conversation_history: List[Message],
        available_agents: List[Agent]
    ) -> int:
        """
        根据消息内容和上下文选择最佳智能体
        
        选择策略：
        1. 分析消息内容的主题/领域
        2. 匹配智能体的角色定义和专长
        3. 考虑最近对话中哪个智能体更相关
        4. 返回最佳匹配的智能体 ID
        """
        pass
```

### 3.3 智能选择算法

#### 方案 A：基于 LLM 的选择（推荐）

使用 LLM 分析消息内容，结合智能体角色描述进行选择：

```python
prompt = f"""
你是一个智能分发系统，需要根据用户消息选择最合适的智能体来回答。

用户消息：{message_content}

可用智能体：
{agent_descriptions}

最近对话摘要：
{recent_context}

请选择最适合回答此问题的智能体，只返回智能体ID。
选择依据：
1. 智能体的角色定义和专长是否匹配问题领域
2. 最近对话中该智能体是否参与了相关讨论
3. 问题的专业性和复杂度
"""
```

#### 方案 B：基于关键词/向量匹配

1. 提取消息关键词
2. 与智能体角色描述进行向量相似度匹配
3. 选择相似度最高的智能体

#### 方案 C：混合策略

1. 先用向量匹配快速筛选 Top 3
2. 再用 LLM 从 Top 3 中精选

**推荐方案 A**：简单直接，利用 LLM 的理解能力，准确度高。

### 3.4 数据流

```
用户输入消息
    ↓
前端检查：智能分发开启 && 无 @ 提及？
    ↓ 是
发送请求：{ content, smart_dispatch: true }
    ↓
后端接收
    ↓
调用 SmartDispatchService.select_best_agent()
    ↓
LLM 分析 → 返回最佳智能体 ID
    ↓
只让该智能体响应
    ↓
返回响应给前端
```

---

## 4. 实现步骤

### Phase 1：前端 UI（0.5 天）

- [ ] 在 MessageInput 组件添加智能分发开关
- [ ] 实现开关与智能体选择器的联动（开启时禁用选择器）
- [ ] 添加状态提示文案
- [ ] 添加国际化文案（zh-CN, en-US）

### Phase 2：后端 API（0.5 天）

- [ ] 修改消息发送 API，接收 `smart_dispatch` 参数
- [ ] 创建 `SmartDispatchService` 服务类
- [ ] 实现基于 LLM 的智能体选择逻辑

### Phase 3：集成测试（0.5 天）

- [ ] 测试智能分发开关 UI 交互
- [ ] 测试 @ 提及与智能分发的冲突处理
- [ ] 测试智能体选择准确性
- [ ] 测试边界情况（单智能体、无智能体等）

### Phase 4：优化（可选）

- [ ] 添加选择结果的可视化反馈（显示"已自动选择 XXX 智能体"）
- [ ] 添加用户反馈机制（选择是否准确）
- [ ] 基于反馈优化选择算法

---

## 5. 配置项

### 5.1 系统设置

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable_smart_dispatch` | bool | true | 是否启用智能分发功能 |
| `smart_dispatch_model` | string | 系统默认模型 | 用于智能分发的 LLM 模型 |

### 5.2 任务级设置（可选）

可以在任务创建时设置默认是否开启智能分发。

---

## 6. 国际化文案

### zh-CN

```javascript
{
  "conversation.smartDispatch": "智能分发",
  "conversation.smartDispatchTooltip": "开启后，系统将根据消息内容自动选择最合适的智能体响应",
  "conversation.smartDispatchActive": "系统将自动选择最佳智能体响应",
  "conversation.smartDispatchOverridden": "已检测到 @ 提及，将发送给指定智能体",
  "conversation.smartDispatchSelected": "已自动选择 {agentName} 响应"
}
```

### en-US

```javascript
{
  "conversation.smartDispatch": "Smart Dispatch",
  "conversation.smartDispatchTooltip": "When enabled, the system will automatically select the most suitable agent to respond based on message content",
  "conversation.smartDispatchActive": "System will auto-select the best agent to respond",
  "conversation.smartDispatchOverridden": "@ mention detected, will send to specified agent(s)",
  "conversation.smartDispatchSelected": "Auto-selected {agentName} to respond"
}
```

---

## 7. 风险与注意事项

### 7.1 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 选择不准确 | 用户体验差 | 允许用户通过 @ 覆盖；添加反馈机制 |
| 增加 LLM 调用成本 | Token 消耗增加 | 使用轻量模型；缓存相似问题的选择结果 |
| 单智能体任务无意义 | 功能冗余 | 单智能体时自动隐藏开关 |

### 7.2 边界情况

| 场景 | 处理方式 |
|------|---------|
| 任务只有 1 个智能体 | 隐藏智能分发开关，或显示但禁用 |
| 所有智能体都是观察者 | 禁用智能分发 |
| LLM 选择失败 | 降级为发送给所有智能体 |
| 消息内容为空（仅图片） | 基于图片描述或发送给所有智能体 |

---

## 8. 后续扩展

1. **多智能体协作分发**：根据问题复杂度，可能选择多个智能体协作回答
2. **学习用户偏好**：记录用户的 @ 选择，优化自动选择算法
3. **领域专家标签**：为智能体添加专长标签，提升匹配准确度
4. **分发策略配置**：允许用户自定义分发规则

---

## 9. 参考

- `MessageInput.tsx` - 现有消息输入组件
- `autonomous_task_utils.py` - 自主任务工具函数
- `PLAN-autotask-simplify.md` - 自主任务重构计划

---

**文档维护者**: AI Assistant  
**最后更新**: 2025-01-13
