# 平台核心资源关系

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   模板层                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐           │
│   │  ActionSpace │ 1:N     │     Role     │         │  Capability  │           │
│   │   行动空间   │────────→│     角色     │←────────│     能力     │           │
│   │  (场景模板)  │ roles   │  (智能体模板) │ N:M     │  (能力模板)   │           │
│   └──────────────┘         └──────────────┘         └──────────────┘           │
│         │                        │                                              │
│         │ rules                  │ knowledge/tools                              │
│         ↓                        ↓                                              │
│   ┌──────────────┐         ┌──────────────┐                                    │
│   │   RuleSet    │         │  Knowledge   │                                    │
│   │    规则集    │         │    知识库    │                                    │
│   └──────────────┘         └──────────────┘                                    │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                   实例层                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────┐                                                             │
│   │  ActionTask  │ ←─── 从 ActionSpace 创建                                    │
│   │   行动任务   │                                                             │
│   │  (场景实例)  │                                                             │
│   └──────────────┘                                                             │
│         │                                                                       │
│         │ 1:N                                                                   │
│         ├────────────────────────────┬────────────────────────┐                │
│         ↓                            ↓                        ↓                │
│   ┌──────────────┐            ┌──────────────┐        ┌──────────────────┐     │
│   │    Agent     │            │ Conversation │        │ EnvironmentVar   │     │
│   │    智能体    │            │     会话     │        │    环境变量      │     │
│   │  (角色实例)  │            │  (对话实例)  │        │  (任务级变量)    │     │
│   └──────────────┘            └──────────────┘        └──────────────────┘     │
│         │                            │                                          │
│         │ role_id                    │ 1:N                                      │
│         ↓                            ├─────────────────────┐                    │
│   ┌──────────────┐                   ↓                     ↓                   │
│   │     Role     │            ┌──────────────┐      ┌──────────────┐           │
│   │   (引用)     │            │   Message    │      │AutonomousTask│           │
│   └──────────────┘            │     消息     │      │   自主任务   │           │
│         │                     └──────────────┘      └──────────────┘           │
│         ↓                                                  │                    │
│   ┌──────────────┐                                         │ 1:N               │
│   │ AgentVariable│                                         ↓                   │
│   │  智能体变量  │                                  ┌──────────────┐           │
│   │ (角色级变量) │                                  │  Execution   │           │
│   └──────────────┘                                  │   执行记录   │           │
│                                                     └──────────────┘           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心资源说明

| 资源 | 中文名 | 层级 | 说明 |
|------|--------|------|------|
| **ActionSpace** | 行动空间 | 模板 | 场景模板，定义角色组合、规则和共享变量 |
| **Role** | 角色 | 模板 | 智能体模板，定义 system_prompt、能力、知识库 |
| **Capability** | 能力 | 模板 | 智能体能力定义（如 memory、planner、knowledge_access） |
| **RuleSet** | 规则集 | 模板 | 行为规则和约束条件 |
| **Knowledge** | 知识库 | 模板 | 角色可访问的知识文档 |
| **ActionTask** | 行动任务 | 实例 | 场景实例，用户实际运行的任务 |
| **Agent** | 智能体 | 实例 | 角色实例，任务中的具体智能体 |
| **Conversation** | 会话 | 实例 | 对话实例，一个任务可有多个会话 |
| **AutonomousTask** | 自主任务 | 实例 | 自动执行任务，控制 Agent 自动对话 |
| **Message** | 消息 | 实例 | 对话内容 |
| **EnvironmentVariable** | 环境变量 | 实例 | 任务级变量，所有 Agent 可见 |
| **AgentVariable** | 智能体变量 | 实例 | 智能体级变量，仅该 Agent 可见 |

---

## 关键关系

### 1. 模板 → 实例

```
ActionSpace  ──创建──→  ActionTask
Role         ──实例化→  Agent
```

### 2. 包含关系

```
ActionSpace
    ├── ActionSpaceRole (N:M → Role)
    ├── ActionSpaceRuleSet (N:M → RuleSet)
    └── ActionSpaceSharedVariable

ActionTask
    ├── Agent[] (通过 ActionTaskAgent)
    ├── Conversation[]
    └── EnvironmentVariable[]

Conversation
    ├── Message[]
    ├── ConversationAgent[] (参与的智能体)
    ├── AutonomousTask[]
    └── ConversationPlan[]

Role
    ├── RoleCapability[] (N:M → Capability)
    ├── RoleKnowledge[] (N:M → Knowledge)
    └── RoleTool[] (N:M → Tool)

Agent
    └── AgentVariable[]
```

### 3. 引用关系

```
Agent.role_id         → Role
ActionTask.action_space_id → ActionSpace
Conversation.action_task_id → ActionTask
Message.agent_id      → Agent
Message.conversation_id → Conversation
AutonomousTask.conversation_id → Conversation
```

---

## ParallelExperiment 融入方式

```
┌─────────────────────────────────────────────────────────────┐
│                    ParallelExperiment                        │
│                       并行实验                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  source_action_space_id  ───→  ActionSpace (场景模板)       │
│                                                             │
│  is_template: true/false (仅标记是否系统预置，不影响结构)    │
│                                                             │
│  启动时：从 ActionSpace 创建多个 ActionTask 克隆             │
│                                                             │
│  cloned_action_task_ids ───→  [ActionTask, ActionTask...]   │
│                               (克隆任务，每个独立变量)       │
│                                    │                        │
│                                    ↓                        │
│                              Conversation                   │
│                                    │                        │
│                                    ↓                        │
│                             AutonomousTask                  │
│                               (实际执行)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**设计原则**：
- **统一绑定 ActionSpace**：所有实验（无论是否模板）都绑定场景模板
- `is_template` 只是标记是否系统预置，不影响数据结构和工作流
- ParallelExperiment 不新建实体类型，复用现有 ActionTask 机制
- 每个并行实例 = 一个克隆的 ActionTask（变量隔离）
- 通过 `is_experiment_clone=True` 标记克隆任务，前端列表过滤
- 调度器 (TaskScheduler) 零侵入，直接复用 AutonomousTask

---

## 数据流示意

```
用户操作                 模板层                    实例层
─────────               ──────                   ──────

选择行动空间 ──→ ActionSpace
                    │
                    ↓ 创建任务
              ┌─────────────┐
              │ ActionTask  │ ←─ 复制角色、变量
              └─────────────┘
                    │
                    ↓ 自动创建
              ┌─────────────┐
              │ Conversation│ ←─ 默认会话
              └─────────────┘
                    │
启动自主任务 ──────→ ↓
              ┌─────────────┐
              │AutonomousTask│ ←─ 控制对话轮次
              └─────────────┘
                    │
                    ↓ 生成
              ┌─────────────┐
              │  Message[]  │ ←─ Agent 对话内容
              └─────────────┘
```
