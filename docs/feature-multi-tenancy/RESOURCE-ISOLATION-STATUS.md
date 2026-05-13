# 资源隔离状态文档

> 最后更新: 2026-01-01

## 概述

本文档记录系统中所有资源的多租户隔离状态，确保 C 端产品的用户数据安全隔离。

## 隔离设计原则

根据 `PLAN-multi-tenancy.md`，资源分为三类：

| 资源类型 | created_by | is_shared | 可见性 | 编辑权限 |
|----------|------------|-----------|--------|----------|
| 系统资源 | NULL | True | 所有用户 | 仅管理员 |
| 用户共享资源 | user_id | True | 所有用户 | 仅创建者/管理员 |
| 私有资源 | user_id | False | 仅创建者/管理员 | 仅创建者/管理员 |

---

## 资源隔离状态总览

### ✅ 已实现隔离的资源（用户可创建）

| 模型 | 表名 | 隔离字段 | 说明 |
|------|------|----------|------|
| ActionSpace | action_spaces | `created_by` + `is_shared` | 行动空间 |
| Role | roles | `created_by` + `is_shared` | 智能体角色 |
| RuleSet | rule_sets | `created_by` + `is_shared` | 规则集 |
| Rule | rules | `created_by` + `is_shared` | 规则 |
| Knowledge | knowledges | `created_by` + `is_shared` | 知识库 |
| Capability | capabilities | `created_by` + `is_shared` | 能力 |
| ActionTask | action_tasks | `user_id` + `is_shared` | 行动任务 |
| ExternalKnowledgeProvider | external_kb_providers | `created_by` + `is_shared` | 外部知识库提供商 |
| ExternalEnvironmentVariable | external_environment_variables | `created_by` + `is_shared` | 外部环境变量 |
| Job | jobs | `user_id` | 后台任务 |
| PublishedTask | published_tasks | `user_id` | 发布的任务 |

### ✅ 系统级资源（仅管理员管理，全局共享）

| 模型 | 表名 | 说明 | 隔离必要性 |
|------|------|------|------------|
| ModelConfig | model_configs | 模型配置 | ❌ 系统级，无需隔离 |
| Tool | tools | 系统工具 | ❌ 系统级，无需隔离 |
| Tag | tags | 标签分类 | ❌ 系统级，无需隔离 |
| SystemSetting | system_settings | 系统设置 | ❌ 系统级，无需隔离 |
| MarketApp | market_apps | 应用市场 | ❌ 系统级，无需隔离 |
| GraphEnhancement | graph_enhancements | 图谱增强配置 | ❌ 系统级，无需隔离 |
| WorkspaceTemplate | workspace_templates | 工作区模板 | ❌ 系统预置模板 |
| UserRole | user_roles | 用户角色定义 | ❌ 系统级权限定义 |
| UserPermission | user_permissions | 权限定义 | ❌ 系统级权限定义 |

### ✅ 关联表（通过父资源间接隔离）

| 模型 | 表名 | 父资源 | 说明 |
|------|------|--------|------|
| Agent | agents | ActionTask | 通过 action_task.user_id 隔离 |
| AgentVariable | agent_variables | Agent | 通过 Agent → ActionTask 隔离 |
| Conversation | conversations | ActionTask | 通过 action_task_id 隔离 |
| ConversationAgent | conversation_agents | Conversation | 通过 Conversation 隔离 |
| ConversationPlan | conversation_plans | Conversation | 通过 Conversation 隔离 |
| ConversationPlanItem | conversation_plan_items | ConversationPlan | 通过 Plan 隔离 |
| Message | messages | ActionTask | 通过 action_task_id 隔离 |
| AutonomousTask | autonomous_tasks | Conversation | 通过 Conversation 隔离 |
| AutonomousTaskExecution | autonomous_task_executions | AutonomousTask | 通过 AutonomousTask 隔离 |
| ActionTaskAgent | action_task_agents | ActionTask | 关联表 |
| ActionTaskEnvironmentVariable | action_task_environment_variables | ActionTask | 通过 action_task_id 隔离 |
| RoleKnowledge | role_knowledges | Role | 关联表 |
| RoleTool | role_tools | Role | 关联表 |
| RoleCapability | role_capabilities | Role | 关联表 |
| RoleVariable | role_variables | Role + ActionSpace | 关联表 |
| RoleExternalKnowledge | role_external_knowledges | Role | 关联表 |
| RuleSetRule | rule_set_rules | RuleSet | 关联表 |
| RuleTriggerLog | rule_trigger_logs | ActionTask | 日志记录 |
| ActionSpaceRole | action_space_roles | ActionSpace | 关联表 |
| ActionSpaceRuleSet | action_space_rule_sets | ActionSpace | 关联表 |
| ActionSpaceTag | action_space_tags | ActionSpace | 关联表 |
| ActionSpaceObserver | action_space_observers | ActionSpace | 关联表 |
| ActionSpaceEnvironmentVariable | action_space_environment_variables | ActionSpace | 关联表 |
| ActionSpaceSharedVariable | action_space_shared_variables | ActionSpace | 关联表 |
| ActionSpaceApp | action_space_apps | ActionSpace | 关联表 |
| KnowledgeDocument | knowledge_documents | Knowledge | 通过 knowledge_id 隔离 |
| KnowledgeFileConversion | knowledge_file_conversions | Knowledge | 通过 knowledge_id 隔离 |
| KnowledgeFileChunking | knowledge_file_chunkings | Knowledge | 通过 knowledge_id 隔离 |
| KnowledgeFileEmbedding | knowledge_file_embeddings | Knowledge | 通过 knowledge_id 隔离 |
| KnowledgeFileChunk | knowledge_file_chunks | Knowledge | 通过 knowledge_id 隔离 |
| ChunkConfig | chunk_configs | Knowledge | 通过 knowledge_id 隔离 |
| ExternalKnowledge | external_knowledges | ExternalKnowledgeProvider | 通过 provider 隔离 |
| ExternalKnowledgeQueryLog | external_kb_query_logs | ExternalKnowledge | 日志记录 |
| ParallelExperiment | parallel_experiments | ActionSpace | 通过 source_action_space_id 隔离 |
| ExperimentStep | experiment_steps | ParallelExperiment | 通过 experiment_id 隔离 |

### ✅ 用户相关表（天然隔离）

| 模型 | 表名 | 说明 |
|------|------|------|
| User | users | 用户表本身 |
| OAuthAccount | oauth_accounts | 通过 user_id 绑定 |
| UserRoleAssignment | user_role_assignments | 通过 user_id 绑定 |

### ⚠️ 需要评估的资源

| 模型 | 表名 | 当前状态 | 建议 |
|------|------|----------|------|
| SharedEnvironmentVariable | shared_environment_variables | 全局共享 | ✅ 保持（设计为跨空间共享的系统变量） |

---

## API 权限过滤状态

### ✅ 已实现权限过滤的 API

| API 路由文件 | 资源 | 过滤方法 |
|-------------|------|----------|
| `rules/rules.py` | Rule | `filter_viewable_resources` + `can_edit_resource` |
| `rules/rule_sets.py` | RuleSet | `filter_viewable_resources` + `can_edit_resource` |
| `knowledge/base.py` | Knowledge | `filter_viewable_resources` + `can_edit_resource` |
| `capabilities.py` | Capability | `filter_viewable_resources` + `can_edit_resource` |
| `action_spaces/base.py` | ActionSpace | `filter_viewable_resources` + `can_edit_resource` |
| `action_tasks/base.py` | ActionTask | `filter_viewable_resources` + `can_edit_resource` |
| `external_variables.py` | ExternalEnvironmentVariable | `filter_viewable_resources` + `can_edit_resource` |
| `roles_ext.py` | Role | `filter_viewable_resources` + `can_edit_resource` |
| `external_knowledge.py` | ExternalKnowledgeProvider | `filter_viewable_resources` + `can_edit_resource` |
| `jobs.py` | Job | `user_id` 过滤 |

### ⚠️ 待完善权限过滤的 API

| API 路由文件 | 资源 | 状态 |
|-------------|------|------|
| - | - | 已全部完成 |

---

## 数据库迁移

新增的隔离字段需要执行数据库迁移：

```sql
-- Rule 表
ALTER TABLE rules ADD COLUMN created_by VARCHAR(36) REFERENCES users(id);
ALTER TABLE rules ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;

-- ExternalKnowledgeProvider 表
ALTER TABLE external_kb_providers ADD COLUMN created_by VARCHAR(36) REFERENCES users(id);
ALTER TABLE external_kb_providers ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;

-- ExternalEnvironmentVariable 表
ALTER TABLE external_environment_variables ADD COLUMN created_by VARCHAR(36) REFERENCES users(id);
ALTER TABLE external_environment_variables ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;
```

### 数据迁移策略

对于现有数据：
1. 系统预置数据：`created_by = NULL, is_shared = TRUE`
2. 用户创建数据：`created_by = admin_id, is_shared = FALSE`（或根据实际情况设置）

---

## 安全检查清单

### 后端安全

- [x] 所有用户可创建资源都有 `created_by` 或 `user_id` 字段
- [x] 所有列表 API 使用 `filter_viewable_resources()` 过滤
- [x] 所有编辑/删除 API 使用 `can_edit_resource()` / `can_delete_resource()` 检查
- [x] 敏感资源（含 API Key）已添加隔离字段
- [x] 所有 API 路由添加 `@login_required` 装饰器

### 前端安全

- [ ] 资源列表显示来源标识（系统/共享/我的）
- [ ] 非创建者查看时显示只读提示
- [ ] 创建资源时显示"共享"选项

---

## 更新日志

| 日期 | 更新内容 |
|------|----------|
| 2026-01-01 | 初始文档创建 |
| 2026-01-01 | 为 Rule、ExternalKnowledgeProvider、ExternalEnvironmentVariable 添加隔离字段 |
| 2026-01-01 | 更新 external_variables.py API 权限过滤 |
