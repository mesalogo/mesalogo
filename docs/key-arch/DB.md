# 数据库结构文档

本文档描述了ABM-LLM-v2系统的完整数据库结构，包括所有表、字段、关系和约束。

## 概述

系统使用SQLite数据库，通过SQLAlchemy ORM进行管理。数据库包含以下主要功能模块：
- 用户管理和认证
- 行动空间和任务管理
- 智能体和角色管理
- 会话和消息管理
- 规则和能力管理
- 模型配置和工具管理
- 环境变量和外部集成
- 日志和统计信息

## 1. BaseMixin
所有模型的基类，提供共有字段

| 字段名         | 类型          | 描述                       |
|---------------|--------------|----------------------------|
| id            | Integer      | 主键                        |
| created_at    | DateTime     | 创建时间，使用时区感知的时间戳 |
| updated_at    | DateTime     | 更新时间，自动更新           |

## 2. User 表 (users)
用户信息表

| 字段名         | 类型          | 描述                       |
|---------------|--------------|----------------------------|
| id            | Integer      | 主键                        |
| username      | String(64)   | 用户名，唯一，不可为空         |
| password_hash | String(128)  | 密码哈希                    |
| email         | String(120)  | 电子邮件，唯一                |
| is_active     | Boolean      | 是否激活，默认为True          |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- action_tasks: 用户创建的行动任务列表 (one-to-many)

## 3. ActionSpace 表 (action_spaces)
行动空间表

| 字段名         | 类型          | 描述                       |
|---------------|--------------|----------------------------|
| id            | Integer      | 主键                        |
| name          | String(100)  | 行动空间名称，不可为空         |
| description   | Text         | 描述                        |
| settings      | JSON         | 设置                        |
| created_at    | DateTime     | 创建时间                     |
| updated_at    | DateTime     | 更新时间                     |

**关联关系**:
- rule_sets: 规则集列表 (one-to-many)
- action_tasks: 行动任务列表 (one-to-many)
- tags: 标签列表 (many-to-many)
- roles: 角色列表 (many-to-many)
- environment_variables: 环境变量列表 (one-to-many)

## 4. Rule 表 (rules)
规则表

| 字段名         | 类型          | 描述                       |
|---------------|--------------|----------------------------|
| id            | Integer      | 主键                        |
| name          | String(100)  | 规则名称，不可为空            |
| description   | Text         | 描述                        |
| content       | Text         | 规则内容，不可为空            |
| category      | String(50)   | 规则类别，如：interaction, evaluation, constraint |
| type          | String(20)   | 规则类型，默认为'llm'（自然语言规则）或 logic（逻辑规则）|
| is_active     | Boolean      | 是否激活，默认为True          |
| settings      | JSON         | 设置                        |
| created_at    | DateTime     | 创建时间                     |
| updated_at    | DateTime     | 更新时间                     |

**关联关系**:
- rule_sets: 规则所属的规则集 (many-to-many)

## 5. RuleSetRule 表 (rule_set_rules)
规则集与规则的多对多关联表

| 字段名         | 类型          | 描述                       |
|---------------|--------------|----------------------------|
| id            | Integer      | 主键                        |
| rule_set_id   | Integer      | 规则集ID，外键，不可为空       |
| rule_id       | Integer      | 规则ID，外键不可为空         |
| priority      | Integer      | 规则优先级，默认为0            |
| created_at    | DateTime     | 创建时间                     |
| updated_at    | DateTime     | 更新时间                     |

**关联关系**:
- rule_set: 所属规则集 (many-to-one)
- rule: 关联的规则 (many-to-one)

## 6. RuleSet 表 (rule_sets)
规则集表

| 字段名            | 类型          | 描述                       |
|------------------|--------------|----------------------------|
| id               | Integer      | 主键                        |
| name             | String(100)  | 规则集名称，不可为空           |
| description      | Text         | 描述                        |
| rules            | JSON         | 规则列表（兼容性字段）          |
| conditions       | JSON         | 条件列表                     |
| actions          | JSON         | 动作列表                     |
| settings         | JSON         | 设置                        |
| action_space_id  | Integer      | 行动空间ID，外键，不可为空      |
| created_at       | DateTime     | 创建时间                     |
| updated_at       | DateTime     | 更新时间                     |

**关联关系**:
- action_space: 所属行动空间 (many-to-one)
- rules_relation: 规则集与规则的关联关系 (one-to-many)

## 7. Role 表 (roles)
角色表

| 字段名             | 类型          | 描述                      |
|------------------|--------------|---------------------------|
| id               | Integer      | 主键                       |
| name             | String(100)  | 角色名称，不可为空           |
| description      | Text         | 描述                       |
| system_prompt    | Text         | 系统提示词                  |
| avatar           | String(255)  | 头像URL                    |
| settings         | JSON         | 设置                       |
| is_predefined    | Boolean      | 是否为预定义角色，默认为False |
| model            | Integer      | 关联的模型配置ID，可为空      |
| is_observer_role | Boolean      | 是否为监督者角色，默认为False |
| source           | String(20)   | 角色来源：internal(内部)或external(外部)，默认为internal |
| temperature      | Float        | 温度参数，控制随机性，默认0.7  |
| top_p            | Float        | Top-P采样参数，默认1.0       |
| frequency_penalty| Float        | 频率惩罚，默认0.0            |
| presence_penalty | Float        | 存在惩罚，默认0.0            |
| stop_sequences   | JSON         | 停止序列，默认空列表          |
| created_at       | DateTime     | 创建时间                    |
| updated_at       | DateTime     | 更新时间                    |

**关联关系**:
- knowledge_bases: 知识库关联 (many-to-many)
- tools: 工具关联 (many-to-many)
- memories: 记忆关联 (many-to-many)
- capabilities: 能力关联 (many-to-many)
- agents: 基于该角色的智能体 (one-to-many)
- action_spaces: 角色关联的行动空间 (many-to-many)
- variables: 角色变量 (one-to-many)

## 8. Knowledge 表 (knowledges)
知识库表

| 字段名         | 类型          | 描述                      |
|---------------|--------------|---------------------------|
| id            | Integer      | 主键                       |
| name          | String(100)  | 知识库名称，不可为空         |
| description   | Text         | 描述                       |
| type          | String(50)   | 类型（text, vector, structured）|
| content       | Text         | 内容                       |
| settings      | JSON         | 设置                       |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- roles: 关联的角色列表 (many-to-many)

## 9. Tool 表 (tools)
工具表

| 字段名         | 类型          | 描述                      |
|---------------|--------------|---------------------------|
| id            | Integer      | 主键                       |
| name          | String(100)  | 工具名称，不可为空           |
| description   | Text         | 描述                       |
| type          | String(50)   | 工具类型                    |
| config        | JSON         | 配置                       |
| settings      | JSON         | 设置                       |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- roles: 关联的角色列表 (many-to-many)

## 10. Capability 表 (capabilities)
能力表

| 字段名           | 类型          | 描述                      |
|----------------|--------------|---------------------------|
| id              | Integer      | 主键                       |
| name            | String(100)  | 能力名称，不可为空           |
| description     | Text         | 描述                       |
| type            | String(50)   | 能力类型（text, vision, code等）|
| provider        | String(50)   | 提供商                     |
| parameters      | JSON         | 输入参数定义                |
| response_format | JSON         | 响应格式定义                |
| examples        | JSON         | 示例                       |
| settings        | JSON         | 设置                       |
| tools           | JSON         | 存储能力与工具/MCP服务器的关联关系 |
| security_level  | Integer      | 安全级别：1=低风险, 2=中风险, 3=高风险，默认为1 |
| default_enabled | Boolean      | 是否默认启用，默认为False    |
| icon            | String(50)   | 图标名称                   |
| created_at      | DateTime     | 创建时间                    |
| updated_at      | DateTime     | 更新时间                    |

**关联关系**:
- roles: 关联的角色列表 (many-to-many)

## 11. RoleCapability 表 (role_capabilities)
角色-能力关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| role_id         | Integer      | 角色ID，外键，不可为空        |
| capability_id   | Integer      | 能力ID，外键，不可为空        |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- role: 关联的角色 (many-to-one)
- capability: 关联的能力 (many-to-one)

## 12. Memory 表 (memories)
记忆表

| 字段名         | 类型          | 描述                      |
|---------------|--------------|---------------------------|
| id            | Integer      | 主键                       |
| name          | String(100)  | 记忆名称，不可为空           |
| description   | Text         | 描述                       |
| type          | String(50)   | 类型（short_term, long_term, emotional）|
| content       | Text         | 内容                       |
| settings      | JSON         | 设置                       |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- roles: 关联的角色列表 (many-to-many)

## 13. RoleKnowledge 表 (role_knowledges)
角色-知识库关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| role_id         | Integer      | 角色ID，外键，不可为空        |
| knowledge_id    | Integer      | 知识库ID，外键，不可为空       |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- role: 关联的角色 (many-to-one)
- knowledge: 关联的知识库 (many-to-one)

## 14. RoleTool 表 (role_tools)
角色-工具关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| role_id         | Integer      | 角色ID，外键，不可为空        |
| tool_id         | Integer      | 工具ID，外键，不可为空        |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- role: 关联的角色 (many-to-one)
- tool: 关联的工具 (many-to-one)

## 15. RoleMemory 表 (role_memories)
角色-记忆关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| role_id         | Integer      | 角色ID，外键，不可为空        |
| memory_id       | Integer      | 记忆ID，外键，不可为空        |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- role: 关联的角色 (many-to-one)
- memory: 关联的记忆 (many-to-one)

## 16. Agent 表 (agents)
智能体表

| 字段名         | 类型          | 描述                      |
|---------------|--------------|---------------------------|
| id            | Integer      | 主键                       |
| name          | String(100)  | 智能体名称，不可为空         |
| description   | Text         | 描述                       |
| avatar        | String(255)  | 头像URL                    |
| settings      | JSON         | 设置                       |
| status        | String(20)   | 状态，默认为'active'        |
| action_task_id| Integer      | 行动任务ID，外键            |
| role_id       | Integer      | 角色ID，外键，不可为空       |
| type          | String(20)   | 类型，默认为'agent'         |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- role: 关联的角色 (many-to-one)
- action_task: 直接关联的行动任务 (many-to-one)
- action_task_agents: 行动任务-智能体关联 (one-to-many)
- messages: 消息列表 (one-to-many)
- conversation_agents: 会话-智能体关联 (one-to-many)
- variables: 智能体变量 (one-to-many)

## 17. AgentVariable 表 (agent_variables)
智能体变量表

| 字段名         | 类型          | 描述                      |
|---------------|--------------|---------------------------|
| id            | Integer      | 主键                       |
| name          | String(100)  | 变量名称，不可为空           |
| value         | Text         | 变量值                      |
| type          | String(20)   | 类型，默认为'text'          |
| history       | JSON         | 历史记录，默认为空列表        |
| is_public     | Boolean      | 是否公开，默认为True         |
| agent_id      | Integer      | 智能体ID，外键，不可为空      |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- agent: 所属智能体 (many-to-one)

## 18. ActionTaskEnvironmentVariable 表 (action_task_environment_variables)
行动任务环境变量表

| 字段名         | 类型          | 描述                      |
|---------------|--------------|---------------------------|
| id            | Integer      | 主键                       |
| name          | String(100)  | 变量名称，不可为空           |
| label         | String(100)  | 显示标签                    |
| value         | Text         | 变量值                      |
| type          | String(50)   | 变量类型（text, number, boolean等）|
| unit          | String(50)   | 单位（可选）                 |
| history       | JSON         | 历史记录                    |
| action_task_id| Integer      | 关联的行动任务ID，外键，不可为空 |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- action_task: 关联的行动任务 (many-to-one)

## 19. ActionTask 表 (action_tasks)
行动任务表

| 字段名         | 类型          | 描述                      |
|---------------|--------------|---------------------------|
| id            | Integer      | 主键                       |
| title         | String(100)  | 任务标题，不可为空           |
| description   | Text         | 描述                       |
| status        | String(20)   | 状态（active, terminated, completed）|
| mode          | String(20)   | 模式（sequential, parallel） |
| rule_set_id   | Integer      | 规则集ID，外键              |
| action_space_id| Integer      | 行动空间ID，外键            |
| user_id       | Integer      | 用户ID，外键                |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- user: 创建任务的用户 (many-to-one)
- action_space: 关联的行动空间 (many-to-one)
- rule_set: 关联的规则集 (many-to-one)
- agents: 关联的智能体列表 (many-to-many)
- environment_variables: 环境变量列表 (one-to-many，关联ActionTaskEnvironmentVariable表)
- conversations: 会话列表 (one-to-many)

## 20. Conversation 表 (conversations)
会话表

| 字段名         | 类型          | 描述                       |
|---------------|--------------|----------------------------|
| id            | Integer      | 主键                        |
| title         | String(100)  | 会话标题，不可为空           |
| description   | Text         | 描述                        |
| status        | String(20)   | 状态，默认为'active'         |
| mode          | String(20)   | 对话模式，默认为'sequential'  |
| action_task_id | Integer     | 行动任务ID，外键，不可为空     |
| created_at    | DateTime     | 创建时间                     |
| updated_at    | DateTime     | 更新时间                     |

**关联关系**:
- action_task: 所属行动任务 (many-to-one)
- agents: 通过关联表关联的智能体 (many-to-many)
- messages: 消息列表 (one-to-many)

## 21. ConversationAgent 表 (conversation_agents)
会话-智能体关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| conversation_id | Integer      | 会话ID，外键，不可为空        |
| agent_id        | Integer      | 智能体ID，外键，不可为空      |
| is_default      | Boolean      | 是否为默认智能体，默认为False  |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- conversation: 关联的会话 (many-to-one)
- agent: 关联的智能体 (many-to-one)

## 22. ActionTaskAgent 表 (action_task_agents)
行动任务-智能体关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| action_task_id  | Integer      | 行动任务ID，外键，不可为空     |
| agent_id        | Integer      | 智能体ID，外键，不可为空       |
| is_default      | Boolean      | 是否为默认智能体，默认为False  |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- action_task: 关联的行动任务 (many-to-one)
- agent: 关联的智能体 (many-to-one)

## 23. Message 表 (messages)
消息表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| content         | Text         | 消息内容，存储所有消息内容，包括思考标签，不可为空 |
| thinking        | Text         | 思考过程（已弃用，保留兼容性）   |
| raw_message     | Text         | 存储消息的原始内容，包含思考过程等完整内容 |
| role            | String(20)   | 角色：human, agent, system, tool, supervisor，不可为空 |
| source          | String(50)   | 消息来源：taskConversation, supervisorConversation，默认为taskConversation |
| meta            | JSON         | 元数据字段，用于存储额外信息如目标会话类型等，默认为空字典 |
| action_task_id  | Integer      | 行动任务ID，外键，不可为空      |
| conversation_id | Integer      | 会话ID，外键                  |
| agent_id        | Integer      | 智能体ID，外键                |
| user_id         | Integer      | 用户ID，外键                  |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- action_task: 所属行动任务 (many-to-one)
- conversation: 所属会话 (many-to-one)
- agent: 发送消息的智能体 (many-to-one)

## 24. AutonomousTask 表 (autonomous_tasks)
自主任务表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| conversation_id | Integer      | 会话ID，外键，不可为空        |
| type            | String(20)   | 任务类型：discussion, conditional_stop, variable_trigger, time_trigger，不可为空 |
| status          | String(20)   | 状态：active, completed, stopped，默认为active |
| config          | JSON         | 存储不同类型任务的配置参数，不可为空 |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- conversation: 所属会话 (many-to-one)
- executions: 任务执行记录 (one-to-many)

## 25. AutonomousTaskExecution 表 (autonomous_task_executions)
自主任务执行记录表

| 字段名               | 类型          | 描述                       |
|--------------------|--------------|----------------------------|
| id                 | Integer      | 主键                        |
| autonomous_task_id | Integer      | 自主任务ID，外键，不可为空     |
| status             | String(20)   | 执行状态：running, completed, failed，不可为空 |
| result             | JSON         | 执行结果                    |
| error_message      | Text         | 错误信息                    |
| started_at         | DateTime     | 开始时间                    |
| completed_at       | DateTime     | 完成时间                    |
| created_at         | DateTime     | 创建时间                    |
| updated_at         | DateTime     | 更新时间                    |

**关联关系**:
- autonomous_task: 所属自主任务 (many-to-one)

## 26. ModelConfig 表 (model_configs)
模型配置表

| 字段名             | 类型          | 描述                        |
|-------------------|--------------|----------------------------|
| id                | Integer      | 主键                         |
| name              | String(100)  | 模型名称，不可为空             |
| provider          | String(50)   | 提供商，不可为空               |
| model_id          | String(100)  | 模型ID，不可为空               |
| base_url          | String(255)  | API基础URL                   |
| api_key           | String(255)  | API密钥                      |
| context_window    | Integer      | 上下文窗口大小，默认65536       |
| max_output_tokens | Integer      | 最大输出token数，默认2000      |
| request_timeout   | Integer      | 请求超时时间(秒)，默认60        |
| is_default        | Boolean      | 是否为默认模型，默认为False      |
| capabilities      | JSON         | 模型能力标签，如text, vision等  |
| additional_params | JSON         | 额外参数                      |
| created_at        | DateTime     | 创建时间                      |
| updated_at        | DateTime     | 更新时间                      |

## 27. Tag 表 (tags)
标签表

| 字段名         | 类型          | 描述                      |
|---------------|--------------|---------------------------|
| id            | Integer      | 主键                       |
| name          | String(100)  | 标签名称，不可为空           |
| type          | String(50)   | 标签类型(industry, scenario)|
| description   | Text         | 描述                       |
| color         | String(20)   | 颜色代码                    |
| created_at    | DateTime     | 创建时间                    |
| updated_at    | DateTime     | 更新时间                    |

**关联关系**:
- action_spaces: 关联的行动空间 (many-to-many)

## 28. ActionSpaceTag 表 (action_space_tags)
行动空间-标签关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| action_space_id | Integer      | 行动空间ID，外键，不可为空     |
| tag_id          | Integer      | 标签ID，外键，不可为空        |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- action_space: 关联的行动空间 (many-to-one)
- tag: 关联的标签 (many-to-one)

## 29. SystemSetting 表 (system_settings)
系统设置表

| 字段名        | 类型          | 描述                       |
|--------------|--------------|----------------------------|
| id           | Integer      | 主键                        |
| key          | String(100)  | 键名，唯一，不可为空          |
| value        | Text         | 配置值                      |
| value_type   | String(20)   | 值类型，默认为'string'        |
| description  | Text         | 配置描述                     |
| category     | String(50)   | 配置分类，默认为'general'      |
| is_secret    | Boolean      | 是否为敏感信息，默认为False     |
| created_at   | DateTime     | 创建时间                     |
| updated_at   | DateTime     | 更新时间                     |

## 30. ActionSpaceRole 表 (action_space_roles)
行动空间-角色关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| action_space_id | Integer      | 行动空间ID，外键，不可为空     |
| role_id         | Integer      | 角色ID，外键，不可为空        |
| quantity        | Integer      | 角色数量，默认为1             |
| settings        | JSON         | 角色在该行动空间中的特定设置   |
| additional_prompt| Text         | 额外提示词，用于指导角色行为，默认为空 |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- action_space: 关联的行动空间 (many-to-one)
- role: 关联的角色 (many-to-one)

## 31. ActionSpaceEnvironmentVariable 表 (action_space_environment_variables)
行动空间环境变量表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| action_space_id | Integer      | 行动空间ID，外键，不可为空     |
| name            | String(100)  | 变量名称，不可为空            |
| label           | String(100)  | 变量标签，不可为空            |
| type            | String(20)   | 变量类型，默认为text，不可为空 |
| default_value   | String(500)  | 默认值，不可为空              |
| description     | Text         | 描述                        |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- action_space: 关联的行动空间 (many-to-one)

## 32. RoleVariable 表 (role_variables)
角色变量表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| role_id         | Integer      | 角色ID，外键，不可为空        |
| action_space_id | Integer      | 行动空间ID，外键，不可为空     |
| name            | String(100)  | 变量名称，不可为空            |
| label           | String(100)  | 变量标签，不可为空            |
| type            | String(20)   | 变量类型，默认为text，不可为空 |
| default_value   | String(500)  | 默认值，不可为空              |
| description     | Text         | 描述                        |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- role: 关联的角色 (many-to-one)
- action_space: 关联的行动空间 (many-to-one)

## 33. ModelConfig 表 (model_configs)
模型配置表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| name            | String(100)  | 模型配置名称，不可为空        |
| provider        | String(50)   | 提供商（openai, anthropic等）|
| model_name      | String(100)  | 模型名称，不可为空            |
| api_key         | String(255)  | API密钥                     |
| base_url        | String(255)  | API基础URL                  |
| max_tokens      | Integer      | 最大令牌数，默认4096         |
| temperature     | Float        | 温度参数，默认0.7            |
| top_p           | Float        | Top-P采样参数，默认1.0       |
| frequency_penalty| Float       | 频率惩罚，默认0.0            |
| presence_penalty | Float       | 存在惩罚，默认0.0            |
| stop_sequences  | JSON         | 停止序列，默认空列表          |
| is_default      | Boolean      | 是否为默认配置，默认False     |
| is_active       | Boolean      | 是否激活，默认True           |
| settings        | JSON         | 其他设置                     |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- roles: 使用该配置的角色 (one-to-many)

## 34. ExternalEnvironmentVariable 表 (external_environment_variables)
外部环境变量表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| name            | String(100)  | 变量名称，唯一，不可为空       |
| label           | String(200)  | 显示标签，不可为空            |
| api_url         | String(500)  | API地址，不可为空             |
| api_method      | String(10)   | API方法，默认为GET，不可为空   |
| sync_interval   | Integer      | 同步间隔（秒），默认为300，不可为空 |
| sync_enabled    | Boolean      | 是否启用同步，默认为True，不可为空 |
| current_value   | Text         | 当前值                      |
| last_sync       | DateTime     | 最后同步时间                 |
| last_error      | Text         | 最后错误信息                 |
| status          | String(20)   | 状态：active, error, inactive，默认为inactive，不可为空 |
| settings        | JSON         | 扩展配置：api_headers, data_path, data_type, timeout, description等 |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

## 35. ExternalKnowledgeConnection 表 (external_knowledge_connections)
外部知识库连接表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| name            | String(100)  | 连接名称，不可为空            |
| type            | String(50)   | 连接类型（api, database等）   |
| config          | JSON         | 连接配置                     |
| status          | String(20)   | 连接状态，默认为'inactive'    |
| last_sync       | DateTime     | 最后同步时间                 |
| document_count  | Integer      | 文档数量，默认为0             |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

## 36. VectorDatabase 表 (vector_databases)
向量数据库表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| name            | String(100)  | 数据库名称，不可为空          |
| provider        | String(50)   | 提供商（chroma, pinecone等） |
| config          | JSON         | 数据库配置                   |
| status          | String(20)   | 状态，默认为'inactive'       |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

## 37. ActionSpaceRuleSet 表 (action_space_rule_sets)
行动空间与规则集的多对多关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| action_space_id | Integer      | 行动空间ID，外键，不可为空     |
| rule_set_id     | Integer      | 规则集ID，外键，不可为空       |
| settings        | JSON         | 关联特定设置，默认为空字典     |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- action_space: 关联的行动空间 (many-to-one)
- rule_set: 关联的规则集 (many-to-one)

## 38. ActionSpaceObserver 表 (action_space_observers)
行动空间与监督者角色的多对多关联表

| 字段名           | 类型          | 描述                       |
|-----------------|--------------|----------------------------|
| id              | Integer      | 主键                        |
| action_space_id | Integer      | 行动空间ID，外键，不可为空     |
| role_id         | Integer      | 角色ID，外键，不可为空        |
| settings        | JSON         | 监督者在该行动空间中的特定设置，默认为空字典 |
| additional_prompt| Text         | 额外提示词，用于指导监督者行为，默认为空 |
| created_at      | DateTime     | 创建时间                     |
| updated_at      | DateTime     | 更新时间                     |

**关联关系**:
- action_space: 关联的行动空间 (many-to-one)
- role: 关联的角色 (many-to-one)

## 数据库关系总览

### 核心实体关系
- **User** → **ActionTask** (一对多)
- **ActionSpace** ↔ **ActionTask** (一对多)
- **ActionSpace** ↔ **Role** (多对多，通过ActionSpaceRole)
- **ActionSpace** ↔ **RuleSet** (多对多，通过ActionSpaceRuleSet)
- **ActionSpace** ↔ **Observer** (多对多，通过ActionSpaceObserver)
- **Role** → **Agent** (一对多)
- **ActionTask** ↔ **Agent** (多对多，通过ActionTaskAgent)
- **ActionTask** → **Conversation** (一对多)
- **Conversation** ↔ **Agent** (多对多，通过ConversationAgent)
- **Conversation** → **Message** (一对多)
- **Conversation** → **AutonomousTask** (一对多)

### 配置和设置关系
- **Role** ↔ **Knowledge** (多对多，通过RoleKnowledge)
- **Role** ↔ **Tool** (多对多，通过RoleTool)
- **Role** ↔ **Memory** (多对多，通过RoleMemory)
- **Role** ↔ **Capability** (多对多，通过RoleCapability)
- **ActionSpace** ↔ **Tag** (多对多，通过ActionSpaceTag)

### 变量管理关系
- **Agent** → **AgentVariable** (一对多)
- **ActionTask** → **ActionTaskEnvironmentVariable** (一对多)
- **ActionSpace** → **ActionSpaceEnvironmentVariable** (一对多)
- **Role** → **RoleVariable** (一对多)

### 模型和外部集成关系
- **ModelConfig** → **Role** (一对多)
- **ExternalKnowledgeConnection** (独立实体)
- **VectorDatabase** (独立实体)
- **ExternalEnvironmentVariable** (独立实体)

## 数据库更新日志

### 最新更新 (2024-12-19)

#### 新增表
1. **AutonomousTask** - 自主任务管理
2. **AutonomousTaskExecution** - 自主任务执行记录
3. **ActionSpaceRuleSet** - 行动空间与规则集关联
4. **ActionSpaceObserver** - 行动空间与监督者关联
5. **RoleVariable** - 角色变量配置
6. **ExternalEnvironmentVariable** - 外部环境变量同步
7. **ModelConfig** - 模型配置管理
8. **ExternalKnowledgeConnection** - 外部知识库连接
9. **VectorDatabase** - 向量数据库管理

#### 字段更新
1. **Role表**:
   - 新增 `is_observer_role` - 监督者角色标识
   - 新增 `source` - 角色来源标识
   - 移除 `max_tokens` 字段（已迁移到模型配置）

2. **Message表**:
   - 新增 `source` - 消息来源标识
   - 新增 `meta` - 元数据字段
   - 新增 `raw_message` - 原始消息内容
   - 弃用 `thinking` 字段（保留兼容性）

3. **Capability表**:
   - 新增 `tools` - 工具关联配置
   - 新增 `security_level` - 安全级别
   - 新增 `default_enabled` - 默认启用状态
   - 新增 `icon` - 图标名称

4. **ActionSpaceRole表**:
   - 新增 `additional_prompt` - 额外提示词

#### 关系优化
- 完善了行动空间与规则集的多对多关系
- 添加了监督者角色的独立管理
- 优化了变量管理的层次结构
- 增强了自主任务的执行追踪

### 数据库设计原则

1. **数据一致性**: 所有表都继承BaseMixin，确保统一的时间戳管理
2. **关系完整性**: 使用外键约束确保数据关系的完整性
3. **扩展性**: 使用JSON字段存储灵活配置，支持功能扩展
4. **性能优化**: 合理设计索引，优化查询性能
5. **兼容性**: 保留已弃用字段，确保向后兼容

### 维护建议

1. **定期备份**: 建议每日备份数据库
2. **索引优化**: 根据查询模式优化索引
3. **数据清理**: 定期清理过期的执行记录和日志
4. **监控**: 监控数据库性能和存储使用情况
5. **版本控制**: 使用数据库迁移脚本管理结构变更

---

**文档版本**: v2.0
**最后更新**: 2024-12-19
**维护者**: 开发团队