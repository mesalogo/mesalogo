# Planner 功能实现计划

## 功能概述

为智能体自主任务添加结构化的计划管理功能（PLANNER），让智能体可以通过 MCP 工具创建、更新和管理待办计划，用户可以实时查看智能体的计划执行进度。

## 核心特性

- ✅ 智能体可以通过 MCP 工具创建和管理计划
- ✅ 计划以可勾选的待办事项形式展示
- ✅ 用户可以在会话界面中实时查看计划进度
- ✅ 支持折叠/展开，折叠时显示进度摘要
- ✅ 计划既在顶部面板展示，也作为消息记录保存

## UI 设计

### 展示位置：混合方案

#### 1. 顶部固定面板（主要展示位置）
位于 `ConversationHeader` 和 `MessageList` 之间

```
┌─────────────────────────────────────┐
│  ConversationHeader (会话选择器)     │
├─────────────────────────────────────┤
│  📋 执行计划 [3/5 已完成]  [折叠▼]  │  ← 折叠状态：显示进度摘要
├─────────────────────────────────────┤
│  MessageList (消息列表)             │
│  ...                                │
└─────────────────────────────────────┘
```

**展开状态**：
```
┌──────────────────────────────────────────┐
│  📋 执行计划 (3/5 已完成 60%)  [折叠▼]   │
├──────────────────────────────────────────┤
│  ✅ 1. 分析用户需求 - 已完成              │
│  ✅ 2. 设计系统架构 - 已完成              │
│  ✅ 3. 创建数据库模型 - 已完成            │
│  🔄 4. 实现后端API - 进行中               │
│  ⬜ 5. 开发前端界面 - 待办                │
├──────────────────────────────────────────┤
│  最后更新：智能体A，2分钟前               │
└──────────────────────────────────────────┘
```

**折叠状态**：
```
┌──────────────────────────────────────────┐
│  📋 执行计划  [3/5 已完成 60%] ⏱️ 进行中  │  [展开▶]
│  ▓▓▓▓▓▓░░░░ 60%                          │
└──────────────────────────────────────────┘
```

**折叠状态展示内容**：
- 📋 图标 + 标题
- 进度统计：已完成数量/总数量
- 百分比进度条
- 状态标签：未开始/进行中/已完成/已暂停
- 展开/折叠按钮

#### 2. 消息流中的计划卡片（历史记录）
当智能体创建或更新计划时，在消息流中展示为特殊的消息卡片

```
┌─────────────────────────────────────┐
│ 智能体A [计划者]                     │
│ ╔═══════════════════════════════╗  │
│ ║ 📋 已创建执行计划               ║  │
│ ║ 共5个任务项                    ║  │
│ ║ [查看详情▶]                    ║  │
│ ╚═══════════════════════════════╝  │
│ 2分钟前                             │
└─────────────────────────────────────┘
```

点击"查看详情"后，同步滚动到顶部面板并自动展开。

## 数据结构设计

### 数据库表设计

#### ConversationPlan 表（会话计划）- KISS 精简版
```sql
CREATE TABLE conversation_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    creator_agent_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversation(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_agent_id) REFERENCES agent(id)
);
```

**字段说明**：
- `id`: 主键
- `conversation_id`: 所属会话ID
- `title`: 计划标题
- `description`: 计划描述（可选）
- `creator_agent_id`: 创建计划的智能体ID
- `created_at`: 创建时间
- `updated_at`: 最后更新时间

**精简理念**：
- ❌ 移除 `task_id`（从 conversation 关联获取）
- ❌ 移除 `status`（实时计算：所有项完成 = 计划完成）
- ❌ 移除 `completed_at`（实时计算：最后一项的完成时间）

#### ConversationPlanItem 表（计划项）- KISS 精简版
```sql
CREATE TABLE conversation_plan_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES conversation_plan(id) ON DELETE CASCADE
);
```

**字段说明**：
- `id`: 主键
- `plan_id`: 所属计划ID
- `title`: 任务标题
- `description`: 任务描述（可选）
- `status`: 任务状态（pending/in_progress/completed/cancelled）
- `order_index`: 排序顺序
- `created_at`: 创建时间
- `updated_at`: 最后更新时间

**精简理念**：
- ❌ 移除 `parent_item_id`（v1 不需要子任务，避免过度设计）
- ❌ 移除 `assigned_agent_id`（v1 不需要分配功能）
- ❌ 移除 `completed_at`（从 updated_at + status='completed' 推导）
- ❌ 移除 `completed_by_agent_id`（从消息历史可追溯）

**精简成果**：
- ConversationPlan: 10字段 → 7字段 ⬇️30%
- ConversationPlanItem: 12字段 → 8字段 ⬇️33%
- 外键: 7个 → 2个 ⬇️71%
- 总体简化 41%，更易维护

## 后端实现

### 1. API 接口设计

#### 计划管理 API
```python
# GET /api/conversations/{conversation_id}/plans
# 获取会话的所有计划

# GET /api/conversations/{conversation_id}/plans/{plan_id}
# 获取特定计划详情（包含所有计划项）

# POST /api/conversations/{conversation_id}/plans
# 创建新计划
{
    "title": "执行计划",
    "description": "详细描述",
    "creator_agent_id": 123,
    "items": [
        {
            "title": "任务1",
            "description": "描述",
            "order_index": 1
        }
    ]
}

# PUT /api/conversations/{conversation_id}/plans/{plan_id}
# 更新计划信息

# DELETE /api/conversations/{conversation_id}/plans/{plan_id}
# 删除计划
```

#### 计划项管理 API
```python
# POST /api/conversations/{conversation_id}/plans/{plan_id}/items
# 添加计划项

# PUT /api/conversations/{conversation_id}/plans/{plan_id}/items/{item_id}
# 更新计划项
{
    "title": "更新标题",
    "status": "completed",
    "completed_by_agent_id": 123
}

# DELETE /api/conversations/{conversation_id}/plans/{plan_id}/items/{item_id}
# 删除计划项

# POST /api/conversations/{conversation_id}/plans/{plan_id}/items/{item_id}/complete
# 标记计划项为完成

# POST /api/conversations/{conversation_id}/plans/{plan_id}/items/{item_id}/reopen
# 重新打开计划项
```

### 2. MCP 工具定义

为智能体提供以下 MCP 工具：

#### create_plan
```json
{
    "name": "create_plan",
    "description": "创建新的执行计划，包含多个待办任务项",
    "inputSchema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "计划标题"
            },
            "description": {
                "type": "string",
                "description": "计划描述"
            },
            "items": {
                "type": "array",
                "description": "任务项列表",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "assigned_agent_id": {"type": "integer"}
                    }
                }
            }
        },
        "required": ["title", "items"]
    }
}
```

#### update_plan_item
```json
{
    "name": "update_plan_item",
    "description": "更新计划项状态（完成、进行中等）",
    "inputSchema": {
        "type": "object",
        "properties": {
            "plan_id": {"type": "integer"},
            "item_id": {"type": "integer"},
            "status": {
                "type": "string",
                "enum": ["pending", "in_progress", "completed", "cancelled"]
            },
            "description": {"type": "string"}
        },
        "required": ["plan_id", "item_id", "status"]
    }
}
```

#### get_plan
```json
{
    "name": "get_plan",
    "description": "获取当前会话的活跃计划",
    "inputSchema": {
        "type": "object",
        "properties": {
            "plan_id": {
                "type": "integer",
                "description": "计划ID，不提供则返回最新的活跃计划"
            }
        }
    }
}
```

#### add_plan_item
```json
{
    "name": "add_plan_item",
    "description": "向现有计划添加新的任务项",
    "inputSchema": {
        "type": "object",
        "properties": {
            "plan_id": {"type": "integer"},
            "title": {"type": "string"},
            "description": {"type": "string"},
            "assigned_agent_id": {"type": "integer"}
        },
        "required": ["plan_id", "title"]
    }
}
```

### 3. 集成到自主任务流程

#### 修改 autonomous_task_utils.py
在 `execute_planning_phase` 函数中，当启用计划功能时：

1. 在调用智能体生成计划前，在系统提示词中明确说明：
```python
planning_prompt = (
    f"请为即将开始的{mode_description}制定详细计划。"
    f"请使用 create_plan 工具创建结构化的执行计划，包含具体的任务项。"
    f"每个任务项应该明确、可执行、可验证。\n"
    f"任务主题：{topic}"
)
```

2. 监听智能体的 MCP 工具调用，捕获 `create_plan` 调用
3. 将创建的计划同时：
   - 写入数据库
   - 写入工作区（兼容现有逻辑）
   - 发送 SSE 事件通知前端

#### SSE 事件定义
```json
{
    "type": "planCreated",
    "planId": 123,
    "plan": {
        "id": 123,
        "title": "执行计划",
        "items": [...]
    }
}

{
    "type": "planItemUpdated",
    "planId": 123,
    "itemId": 456,
    "status": "completed"
}
```

## 前端实现

### 1. 组件结构

```
frontend/src/pages/actiontask/components/
├── Planner/
│   ├── index.js                  # 主组件入口
│   ├── PlannerPanel.js           # 顶部面板组件
│   ├── PlannerCard.js            # 消息流中的卡片组件
│   ├── PlanItem.js               # 单个计划项组件
│   └── PlannerProgress.js        # 进度条组件
```

### 2. PlannerPanel 组件设计

**Props**:
```javascript
{
    conversationId: number,
    plan: {
        id: number,
        title: string,
        status: string,
        items: Array<PlanItem>,
        createdAt: string,
        creatorAgent: {id, name, role_name}
    },
    onItemClick: (itemId) => void,
    collapsed: boolean,
    onToggleCollapse: () => void
}
```

**展开状态特性**：
- 显示所有计划项
- 每项显示：状态图标、标题、分配的智能体、完成时间
- 支持点击项查看详情
- 显示最后更新信息

**折叠状态特性**：
- 只显示一行
- 显示进度条（已完成/总数）
- 显示当前状态标签
- 进度条使用渐变色：
  - 未开始：灰色
  - 进行中：蓝色
  - 已完成：绿色

### 3. 状态管理

在 `ActionTaskConversation.js` 中添加：

```javascript
const [activePlan, setActivePlan] = useState(null);
const [planCollapsed, setPlanCollapsed] = useState(false);

// 监听 SSE 事件
useEffect(() => {
    // 处理 planCreated 事件
    // 处理 planItemUpdated 事件
}, []);
```

### 4. API Service

创建 `frontend/src/services/api/planner.js`:

```javascript
export const plannerAPI = {
    // 获取会话的计划
    getConversationPlans: (conversationId) => {},
    
    // 获取计划详情
    getPlanDetail: (conversationId, planId) => {},
    
    // 创建计划（一般由智能体调用）
    createPlan: (conversationId, data) => {},
    
    // 更新计划项
    updatePlanItem: (conversationId, planId, itemId, data) => {},
    
    // 完成计划项
    completePlanItem: (conversationId, planId, itemId) => {},
    
    // 重新打开计划项
    reopenPlanItem: (conversationId, planId, itemId) => {}
};
```

### 5. 样式设计

```css
/* 折叠状态 */
.planner-collapsed {
    background: linear-gradient(to right, #f0f2f5, #ffffff);
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.3s;
}

.planner-collapsed:hover {
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
}

/* 展开状态 */
.planner-expanded {
    background: #ffffff;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    margin-bottom: 16px;
}

.planner-header {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.planner-items {
    padding: 8px 16px;
    max-height: 300px;
    overflow-y: auto;
}

.plan-item {
    padding: 8px 12px;
    border-radius: 4px;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.2s;
}

.plan-item:hover {
    background: #f5f5f5;
}

/* 状态图标 */
.plan-item-status-pending { color: #8c8c8c; }
.plan-item-status-in-progress { color: #1890ff; }
.plan-item-status-completed { color: #52c41a; }
.plan-item-status-cancelled { color: #ff4d4f; }

/* 进度条 */
.planner-progress {
    flex: 1;
    height: 8px;
    background: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
}

.planner-progress-bar {
    height: 100%;
    background: linear-gradient(to right, #1890ff, #52c41a);
    transition: width 0.3s ease;
}
```

## 实现步骤

### Phase 1: 后端基础（优先级：高）
- [ ] 创建数据库迁移文件
- [ ] 实现 ConversationPlan 和 ConversationPlanItem 模型
- [ ] 实现计划管理 API 接口
- [ ] 实现计划项管理 API 接口

### Phase 2: MCP 工具集成（优先级：高）
- [x] 定义 MCP 工具 schema
- [x] 实现 create_plan 工具
- [x] 实现 update_plan_item 工具
- [x] 实现 get_plan 工具
- [x] 实现 add_plan_item 工具
- [x] 实现 complete_plan_item 快捷工具
- [x] 实现 reopen_plan_item 快捷工具
- [x] 实现 list_plans 工具
- [x] 创建 planner_server.py MCP 服务器
- [x] 添加 planner_management 能力到 seed_data_capabilities.json
- [x] 添加能力与工具映射到 seed_data_capabilities_tools.json
- [ ] 注册 planner-server 到 MCP 管理器配置

### Phase 3: 自主任务集成（优先级：高）
- [ ] 修改 execute_planning_phase 函数
- [ ] 添加计划创建监听逻辑
- [ ] 实现 SSE 事件推送
- [ ] 测试自主任务中的计划功能

### Phase 4: 前端基础（优先级：高）
- [ ] 创建 Planner 组件目录和文件
- [ ] 实现 PlannerPanel 组件（展开/折叠状态）
- [ ] 实现 PlanItem 组件
- [ ] 实现 PlannerProgress 进度条组件
- [ ] 创建 plannerAPI service

### Phase 5: 前端集成（优先级：中）
- [ ] 在 ActionTaskConversation 中集成 PlannerPanel
- [ ] 实现 SSE 事件监听和状态更新
- [ ] 实现 PlannerCard 消息卡片组件
- [ ] 在 MessageList 中支持 plan 类型消息
- [ ] 添加折叠状态的本地存储

### Phase 6: 样式优化（优先级：中）
- [ ] 实现折叠/展开动画
- [ ] 实现进度条渐变效果
- [ ] 添加响应式设计
- [ ] 适配暗色模式（如果需要）

### Phase 7: 测试与优化（优先级：中）
- [ ] 单元测试：后端 API
- [ ] 单元测试：MCP 工具
- [ ] 集成测试：完整流程
- [ ] 性能优化：大量计划项的渲染
- [ ] 用户体验优化

### Phase 8: 文档与国际化（优先级：低）
- [ ] 添加中文文案
- [ ] 添加英文翻译
- [ ] 编写用户文档
- [ ] 编写开发者文档

## 技术要点

### 1. 折叠状态的进度计算
```javascript
const calculateProgress = (items) => {
    const total = items.length;
    const completed = items.filter(item => item.status === 'completed').length;
    const inProgress = items.filter(item => item.status === 'in_progress').length;
    
    return {
        total,
        completed,
        inProgress,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        status: completed === total ? 'completed' : 
                inProgress > 0 ? 'in_progress' : 'pending'
    };
};
```

### 2. SSE 事件处理
```javascript
// 在 useStreamingHandler 中添加
const handlePlanEvent = (data) => {
    if (data.type === 'planCreated') {
        setActivePlan(data.plan);
    } else if (data.type === 'planItemUpdated') {
        setActivePlan(prev => ({
            ...prev,
            items: prev.items.map(item => 
                item.id === data.itemId 
                    ? { ...item, status: data.status }
                    : item
            )
        }));
    }
};
```

### 3. 工作区兼容性
为保持向后兼容，当智能体创建计划时：
1. 调用 create_plan MCP 工具 → 写入数据库
2. 同时将计划内容写入工作区 markdown 文件
3. 这样即使前端不支持 Planner，也能在工作区看到计划

### 4. 权限控制
- 只有智能体可以创建/更新计划
- 用户只能查看计划
- 未来可扩展：用户可以手动创建计划

## 未来扩展

### v2.0 功能
- [ ] 支持子任务（嵌套计划项）
- [ ] 计划模板（常用计划可保存为模板）
- [ ] 计划导出（导出为 Markdown/JSON）
- [ ] 计划统计（执行效率分析）
- [ ] 多个计划并行（一个会话可以有多个活跃计划）

### v3.0 功能
- [ ] 用户手动创建计划
- [ ] 拖拽排序计划项
- [ ] 计划项依赖关系（A 完成后才能做 B）
- [ ] 甘特图视图
- [ ] 计划协作（多个智能体协同更新计划）

## 注意事项

1. **性能考虑**：
   - 计划项超过 50 项时，考虑虚拟滚动
   - SSE 事件去重，避免重复渲染

2. **用户体验**：
   - 折叠状态默认值可配置（用户偏好）
   - 计划更新时有动画提示
   - 支持键盘快捷键（Space 展开/折叠）

3. **数据一致性**：
   - 计划状态与计划项状态保持同步
   - 所有项完成时，自动标记计划为 completed

4. **错误处理**：
   - MCP 工具调用失败时的降级方案
   - 前端展示计划失败时的兜底 UI

## 时间估算

- Phase 1-3（后端）：3-4 天
- Phase 4-5（前端）：3-4 天
- Phase 6-8（优化）：2-3 天

**总计**：8-11 天（根据开发人员经验调整）

---

*创建日期：2025-12-05*
*最后更新：2025-12-05*
