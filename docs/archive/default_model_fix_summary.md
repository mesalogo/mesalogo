# 默认模型选择修复总结

## 问题描述

在辅助生成功能中，系统错误地使用了旧的 `is_default` 字段来选择默认模型，而不是使用新的分类默认模型字段（`is_default_text` 和 `is_default_embedding`）。这导致系统可能选择了错误的模型类型，比如选择了嵌入模型来进行文本生成。

## 修复内容

### 1. 后端服务修复

#### 1.1 图谱增强服务 (`backend/app/services/graph_enhancement_service.py`)
- **问题**: 硬编码使用 `gpt_4o_mini_complete` 和 `openai_embed`，没有使用系统默认模型配置
- **修复**: 
  - 添加 `_get_default_text_model_func()` 方法，优先使用 `is_default_text=True` 的模型
  - 添加 `_get_default_embedding_func()` 方法，优先使用 `is_default_embedding=True` 的模型
  - 移除对旧 `is_default` 字段的依赖

#### 1.2 监督规则检查器 (`backend/app/services/supervisor_rule_checker.py`)
- **问题**: 只使用 `is_default=True` 查询默认模型
- **修复**: 优先使用 `is_default_text=True`，回退到支持文本输出的模型

#### 1.3 角色服务 (`backend/app/services/role_service.py`)
- **问题**: 回退逻辑中使用了 `is_default=True`
- **修复**: 移除对 `is_default` 的依赖，改为查找支持文本输出的模型

#### 1.4 智能体服务 (`backend/app/services/agent_service.py`)
- **问题**: 两个方法中都使用了 `is_default=True` 作为回退
- **修复**: 
  - `format_agent_for_api()` 方法
  - `create_agent_from_role()` 方法
  - 都改为优先使用 `is_default_text=True`，回退到支持文本输出的模型

#### 1.5 消息处理器 (`backend/app/services/conversation/message_processor.py`)
- **问题**: 使用 `is_default=True` 作为回退
- **修复**: 改为查找支持文本输出的模型

#### 1.6 模型配置API (`backend/app/api/routes/model_configs.py`)
- **问题**: `get_default_models()` 中使用 `is_default=True` 作为回退
- **修复**: 改为查找支持文本输出的模型

### 2. 前端修复

#### 2.1 角色管理页面 (`frontend/src/pages/roles/RoleManagement.js`)
- **修复位置**: 
  - 辅助生成系统提示词功能
  - 角色测试功能中的模型选择
- **修复内容**: 移除对 `m.is_default` 的依赖，改为查找支持文本输出的模型

#### 2.2 行动空间页面 (`frontend/src/pages/actionspace/ActionSpaceOverview.js`)
- **修复位置**:
  - 辅助生成背景设定功能
  - 辅助生成基本规则功能
- **修复内容**: 移除对 `m.is_default` 的依赖

#### 2.3 行动任务页面 (`frontend/src/pages/actiontask/ActionTaskOverview.js`)
- **修复位置**: 辅助生成任务描述功能
- **修复内容**: 移除对 `m.is_default` 的依赖

## 新的默认模型选择逻辑

### 文本生成模型选择优先级：
1. `is_default_text=True` 的模型
2. 第一个 `modalities` 包含 `'text_output'` 的模型
3. 第一个可用模型（作为最后回退）

### 嵌入模型选择优先级：
1. `is_default_embedding=True` 的模型
2. 第一个 `modalities` 包含 `'vector_output'` 的模型
3. 无可用模型时返回 null 或使用默认配置

## 测试验证

创建了测试脚本 `backend/test_default_model_fix.py` 来验证修复效果，包括：
- 检查当前模型配置状态
- 测试默认文本生成模型选择逻辑
- 测试默认嵌入模型选择逻辑
- 验证各个服务的模型选择功能

## 影响范围

此修复影响以下功能：
- 角色系统提示词辅助生成
- 行动空间背景设定和规则辅助生成
- 行动任务描述辅助生成
- 图谱增强功能的模型选择
- 监督规则检查功能
- 角色测试功能
- 智能体创建和格式化

## 注意事项

1. **向后兼容性**: 虽然移除了对 `is_default` 字段的依赖，但该字段仍保留在数据库模型中以保持向后兼容
2. **模型配置要求**: 建议管理员在系统设置中明确设置默认文本生成模型和默认嵌入模型
3. **回退机制**: 所有修复都包含了完整的回退机制，确保在没有明确默认设置时仍能找到可用模型

## 后续建议

1. 在系统初始化时检查并提示管理员设置默认模型
2. 在模型配置界面增加模型类型的清晰标识
3. 考虑在未来版本中完全移除 `is_default` 字段
