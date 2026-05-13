# 在已有行动任务中添加新智能体

## 1. 需求描述

在已有的行动任务中，基于角色创建新的智能体实例，该智能体应具备与任务创建时生成的智能体相同的地位，包括：
- 智能体独立工作空间（如果系统设置开启了 `create_agent_workspace`）
- 环境变量继承
- 参与任务对话

## 2. 现有架构分析

### 2.1 相关数据模型

```
ActionTask (行动任务)
    ├── action_space_id → ActionSpace (行动空间模板)
    ├── ActionTaskAgent (关联表)
    │   └── agent_id → Agent (智能体实例)
    └── ActionTaskEnvironmentVariable (任务环境变量)

Agent (智能体)
    ├── role_id → Role (角色模板)
    ├── action_task_id → ActionTask
    └── AgentVariable (智能体变量)

Workspace 文件结构:
    agent-workspace/
    └── ActionTask-{task_id}/
        ├── ProjectIndex.md
        ├── ProjectSummary.md
        └── Agent-{agent_id}/        # 如果开启 create_agent_workspace
            └── AgentWorkspace.md
```

### 2.2 现有 API

| API | 功能 | 缺失 |
|-----|------|------|
| `POST /action-tasks/<task_id>/agents` | 添加已存在的智能体 | 不创建新智能体 |
| `POST /action-tasks/<task_id>/direct-agents` | 基于角色创建新智能体 | **不创建工作空间** |

### 2.3 可复用的现有方法

- `workspace_service._create_agent_workspace_file()` - 创建智能体工作空间文件
- `workspace_service.update_project_index_if_needed()` - 更新 ProjectIndex.md

## 3. 实现方案 (KISS)

### 3.1 方案概述

直接在 `add_direct_agent_to_task` 函数中内联添加工作空间创建逻辑，完全复用现有方法，**不新增任何方法**。

### 3.2 修改 agents.py

在 `backend/app/api/routes/action_tasks/agents.py` 的 `add_direct_agent_to_task` 函数中，在 `db.session.commit()` 之后添加约 15 行代码：

```python
db.session.add(task_agent)
db.session.commit()

# === 新增：为新智能体创建工作空间 ===
from app.models import SystemSetting
if SystemSetting.get('create_agent_workspace', False):
    try:
        from app.services.workspace_service import workspace_service
        import os
        
        task_dir = os.path.join(workspace_service.workspace_dir, f'ActionTask-{task_id}')
        if os.path.exists(task_dir):
            # 创建智能体目录和工作空间文件
            agent_dir = os.path.join(task_dir, f'Agent-{agent.id}')
            os.makedirs(agent_dir, exist_ok=True)
            
            agent_display = f"{agent.name}[{role.name}][ID: {agent.id}]"
            workspace_service._create_agent_workspace_file(
                os.path.join(agent_dir, 'AgentWorkspace.md'),
                task_id, agent.id, task.title, agent_display
            )
            # 更新索引
            workspace_service.update_project_index_if_needed(task_id)
            logger.info(f"已为智能体 {agent.id} 创建工作空间")
    except Exception as e:
        logger.error(f"创建智能体工作空间失败: {e}")
# === 新增结束 ===

return jsonify({
    'success': True,
    ...
})
```

## 4. 实现步骤

| 步骤 | 任务 | 文件 | 预计时间 |
|------|------|------|----------|
| 1 | 修改 `add_direct_agent_to_task` 添加工作空间创建逻辑 | `agents.py` | 10min |
| 2 | 测试验证 | - | 10min |

**总计**: 约 20 分钟

## 5. 测试用例

### 5.1 开启工作空间设置时

1. 创建行动任务（包含智能体 A）
2. 验证 `Agent-{A.id}/` 目录和 `AgentWorkspace.md` 存在
3. 调用 `POST /action-tasks/{task_id}/direct-agents` 添加智能体 B
4. 验证 `Agent-{B.id}/` 目录和 `AgentWorkspace.md` 被创建
5. 验证 `ProjectIndex.md` 包含智能体 B 的信息

### 5.2 关闭工作空间设置时

1. 系统设置 `create_agent_workspace = false`
2. 调用 `POST /action-tasks/{task_id}/direct-agents` 添加智能体
3. 验证智能体创建成功
4. 验证不创建 `Agent-{id}/` 目录

## 6. 前端实现

### 6.1 按钮位置

在任务详情页的"参与智能体"卡片头部右侧添加"添加智能体"按钮。

### 6.2 交互流程

1. 点击"添加智能体"按钮
2. 弹出角色选择对话框（从行动空间的角色列表中选择）
3. 选择角色后调用 `POST /action-tasks/{task_id}/direct-agents`
4. 刷新智能体列表

## 7. 注意事项

1. **向后兼容**: 工作空间创建失败不影响智能体添加的主流程
2. **幂等性**: `os.makedirs(exist_ok=True)` 保证目录已存在时不报错
3. **完全复用**: 使用现有的 `_create_agent_workspace_file` 和 `update_project_index_if_needed`，无需新增方法
