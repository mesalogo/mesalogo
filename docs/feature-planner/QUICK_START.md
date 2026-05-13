# PLANNER 功能快速开始指南

## 概述

PLANNER 是智能体的核心能力，允许智能体在执行任务时创建结构化的执行计划，并通过 MCP 工具实时更新计划进度。

## 智能体如何使用

### 1. 创建计划

当智能体需要制定执行计划时，调用 `create_plan` 工具：

```
我将为这个项目制定一个详细的执行计划：

<tool_use>
<tool_name>create_plan</tool_name>
<parameters>
{
  "conversation_id": 123,
  "task_id": 456,
  "title": "产品开发执行计划",
  "description": "完整的产品开发流程，从需求到上线",
  "items": [
    {
      "title": "需求分析",
      "description": "收集和分析客户需求，明确产品功能"
    },
    {
      "title": "技术方案设计",
      "description": "制定技术架构和实施方案"
    },
    {
      "title": "数据库设计",
      "description": "设计数据库表结构和关系"
    },
    {
      "title": "后端开发",
      "description": "实现API接口和业务逻辑"
    },
    {
      "title": "前端开发",
      "description": "开发用户界面"
    },
    {
      "title": "测试验证",
      "description": "功能测试和性能测试"
    },
    {
      "title": "部署上线",
      "description": "部署到生产环境"
    }
  ],
  "creator_agent_id": 789
}
</parameters>
</tool_use>
```

**系统返回**：
```json
{
  "success": true,
  "plan": {
    "id": 1,
    "title": "产品开发执行计划",
    "status": "active",
    "items": [
      {"id": 1, "title": "需求分析", "status": "pending"},
      {"id": 2, "title": "技术方案设计", "status": "pending"},
      ...
    ]
  },
  "message": "执行计划 '产品开发执行计划' 创建成功，包含 7 个任务项"
}
```

### 2. 更新任务进度

当智能体完成一个任务时，调用 `complete_plan_item` 工具：

```
我已经完成了需求分析，现在更新计划：

<tool_use>
<tool_name>complete_plan_item</tool_name>
<parameters>
{
  "conversation_id": 123,
  "plan_id": 1,
  "item_id": 1,
  "agent_id": 789
}
</parameters>
</tool_use>
```

**系统返回**：
```json
{
  "success": true,
  "message": "计划项 '需求分析' 状态已更新: pending -> completed",
  "item": {
    "id": 1,
    "title": "需求分析",
    "status": "completed",
    "completed_at": "2025-12-05T10:30:00Z"
  },
  "plan_status": "active"
}
```

### 3. 开始新任务

标记下一个任务为"进行中"：

```
<tool_use>
<tool_name>update_plan_item</tool_name>
<parameters>
{
  "conversation_id": 123,
  "plan_id": 1,
  "item_id": 2,
  "status": "in_progress",
  "agent_id": 789
}
</parameters>
</tool_use>
```

### 4. 查询计划状态

随时查看当前计划进度：

```
<tool_use>
<tool_name>get_plan</tool_name>
<parameters>
{
  "conversation_id": 123
}
</parameters>
</tool_use>
```

**系统返回**：
```json
{
  "success": true,
  "plan": {
    "id": 1,
    "title": "产品开发执行计划",
    "status": "active",
    "progress": {
      "total": 7,
      "completed": 1,
      "in_progress": 1,
      "pending": 5,
      "percentage": 14
    },
    "items": [...]
  }
}
```

### 5. 动态添加任务

如果需要追加新任务：

```
我发现需要增加一个安全审计步骤：

<tool_use>
<tool_name>add_plan_item</tool_name>
<parameters>
{
  "conversation_id": 123,
  "plan_id": 1,
  "title": "安全审计",
  "description": "进行安全漏洞扫描和修复",
  "agent_id": 789
}
</parameters>
</tool_use>
```

## 用户视角

### 界面展示

**折叠状态**（不干扰对话）：
```
┌──────────────────────────────────────────────────────────┐
│  📋 产品开发执行计划  [1/7 已完成 14%]  ▓▓░░░░░░░░  ⏱️ 进行中  [展开▶] │
└──────────────────────────────────────────────────────────┘
```

**展开状态**（查看详情）：
```
┌──────────────────────────────────────────────────────────┐
│  📋 产品开发执行计划 (1/7 已完成 14%)             [折叠▼] │
├──────────────────────────────────────────────────────────┤
│  ✅ 1. 需求分析 - 已完成 (智能体A, 2小时前)              │
│  🔄 2. 技术方案设计 - 进行中 (智能体B)                   │
│  ⬜ 3. 数据库设计 - 待办                                  │
│  ⬜ 4. 后端开发 - 待办                                    │
│  ⬜ 5. 前端开发 - 待办                                    │
│  ⬜ 6. 测试验证 - 待办                                    │
│  ⬜ 7. 部署上线 - 待办                                    │
├──────────────────────────────────────────────────────────┤
│  最后更新：智能体B，5分钟前                               │
└──────────────────────────────────────────────────────────┘
```

### 消息流记录

计划创建时，在消息流中显示卡片：

```
┌─────────────────────────────────────┐
│ 智能体A [计划者]                     │
│ ╔═══════════════════════════════╗  │
│ ║ 📋 已创建执行计划               ║  │
│ ║ 产品开发执行计划                ║  │
│ ║ 共7个任务项                     ║  │
│ ║ [查看详情▶]                    ║  │
│ ╚═══════════════════════════════╝  │
│ 10分钟前                            │
└─────────────────────────────────────┘
```

## 典型使用场景

### 场景 1：自主任务启动时自动创建计划

当用户启动自主任务时，如果启用了计划功能：

1. 系统在启动前引导智能体制定计划
2. 智能体调用 `create_plan` 创建计划
3. 前端收到 SSE 事件，展示计划面板
4. 智能体按照计划逐步执行
5. 每完成一项，调用 `complete_plan_item` 更新状态

### 场景 2：多智能体协作计划

```
智能体A（项目经理）：
  → 调用 create_plan 创建总体计划
  → 为每个任务分配 assigned_agent_id

智能体B（前端开发）：
  → 查看计划，找到分配给自己的任务
  → 完成后调用 complete_plan_item

智能体C（后端开发）：
  → 同样查看和更新自己的任务

智能体A（项目经理）：
  → 定期调用 get_plan 检查整体进度
  → 根据进度调整计划
```

### 场景 3：动态调整计划

```
智能体在执行过程中发现新问题：
  → 调用 add_plan_item 添加新任务
  → 调用 update_plan_item 调整优先级

用户要求改变方向：
  → 智能体调用 update_plan_item 取消某些任务
  → 添加新的任务项
```

## MCP 工具完整清单

| 工具名称 | 功能 | 主要参数 |
|---------|------|---------|
| `create_plan` | 创建新计划 | conversation_id, task_id, title, items |
| `update_plan_item` | 更新任务状态 | plan_id, item_id, status |
| `get_plan` | 查询计划 | conversation_id, plan_id (可选) |
| `add_plan_item` | 添加任务 | plan_id, title, description |
| `list_plans` | 列出所有计划 | conversation_id, status (可选) |
| `complete_plan_item` | 完成任务（快捷） | plan_id, item_id |
| `reopen_plan_item` | 重新打开任务 | plan_id, item_id |

## 任务状态说明

| 状态 | 图标 | 含义 |
|-----|------|------|
| `pending` | ⬜ | 待办，尚未开始 |
| `in_progress` | 🔄 | 进行中，正在执行 |
| `completed` | ✅ | 已完成 |
| `cancelled` | ❌ | 已取消 |

## 自动化特性

### 1. 自动同步计划状态
当所有任务项都完成时，系统自动将计划标记为 `completed`。

### 2. 自动记录完成信息
完成任务时，自动记录：
- 完成时间 (`completed_at`)
- 完成人 (`completed_by_agent_id`)

### 3. 自动进度计算
系统实时计算：
- 总任务数
- 已完成/进行中/待办数量
- 完成百分比

### 4. 自动排序
新添加的任务项自动排在末尾，保持顺序。

## 最佳实践

### 智能体侧

1. **计划要具体**
   - ✅ "实现用户登录功能"
   - ❌ "做一些开发工作"

2. **任务粒度适中**
   - 每个任务 1-4 小时完成
   - 避免过大的任务（"开发整个系统"）
   - 避免过小的任务（"写一行代码"）

3. **及时更新状态**
   - 开始任务时标记为 `in_progress`
   - 完成后立即调用 `complete_plan_item`
   - 发现问题时可以 `reopen_plan_item`

4. **描述清晰**
   - 每个任务项都应有描述
   - 说明具体要做什么、达到什么目标

### 用户侧

1. **启用计划功能**
   - 在自主任务配置中勾选"制定计划"
   - 选择合适的计划智能体

2. **实时监控**
   - 保持 Planner 面板展开（可选）
   - 折叠时也能看到进度摘要

3. **干预调整**
   - 未来版本支持用户手动修改计划
   - 当前版本智能体完全控制计划

## 故障排查

### 问题 1：create_plan 失败

**原因**：
- conversation_id 或 task_id 不存在
- creator_agent_id 无效

**解决**：
检查参数是否正确，确认会话和智能体存在。

### 问题 2：update_plan_item 无效

**原因**：
- plan_id 或 item_id 不匹配
- conversation_id 与 plan 不对应

**解决**：
先调用 `get_plan` 确认 ID，再更新。

### 问题 3：计划未自动完成

**原因**：
- 存在 `cancelled` 状态的任务项
- 还有 `pending` 或 `in_progress` 的项

**解决**：
只有当**所有项都是 completed** 时，计划才自动标记为完成。

## 示例对话

```
用户: 帮我开发一个博客系统

智能体A（项目经理）:
好的，我先为这个项目制定一个详细的执行计划。

[调用 create_plan 工具]

我已经创建了包含以下阶段的开发计划：
1. 需求分析 ✓
2. 数据库设计
3. 后端API开发
4. 前端界面开发
5. 测试与优化
6. 部署上线

现在我来完成第一步：需求分析。

[执行需求分析工作]

需求分析已完成。我了解到你需要：
- 用户注册/登录
- 文章发布/编辑
- 评论功能
- 标签分类

[调用 complete_plan_item，标记任务1完成]

接下来我将开始数据库设计...

[调用 update_plan_item，标记任务2为进行中]
```

---

**文档版本**: 1.0  
**最后更新**: 2025-12-05  
**适用于**: PLANNER 功能 Phase 2 及以后
