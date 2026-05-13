# 按钮与卡片样式规范

## 按钮尺寸规范

### 规则

页面右上角操作按钮统一使用**默认尺寸**，不使用 `size="large"`。

### 例外场景

以下场景可以使用 `size="large"`：

1. **登录页面** - 登录表单中的输入框和按钮
2. **公开访问页面** - 公开任务的密码输入和提交按钮
3. **关于页面** - 许可证激活相关的输入和按钮
4. **Spin 加载组件** - 页面级加载状态
5. **Space 布局组件** - 表单项间距控制

### 已修改的页面

| 页面 | 文件路径 | 修改内容 |
|------|----------|----------|
| 行动任务管理 | `actiontask/ActionTaskOverview.tsx` | 移除搜索框和创建按钮的 size="large" |
| 智能体管理 | `Agents.tsx` | 移除创建按钮的 size="large" |
| 角色管理 | `roles/RoleManagement.tsx` | 移除导入和创建按钮的 size="large" |
| 工具管理 | `roles/ToolManagement.tsx` | 移除新建能力按钮的 size="large" |
| 模型配置 | `settings/ModelConfigsPage/ModelConfigsPage.tsx` | 移除设置默认和添加模型按钮的 size="large" |
| MCP服务器 | `settings/MCPServersPage.tsx` | 移除添加服务器、编辑配置、刷新按钮的 size="large" |
| 智能体监控 | `actionspace/AgentMonitoring.tsx` | 移除刷新状态按钮的 size="large" |
| 实验设计 | `actiontask/parallellab/ExperimentDesign.tsx` | 移除保存配置和启动实验按钮的 size="large" |
| 首页 | `Home.tsx` | 移除快捷操作区所有按钮的 size="large" |

---

## 卡片样式规范

### 规则

1. **页面外层不使用 Card 包裹**，内容区直接展示
2. **骨架屏不使用 Card 包裹**，保持与实际内容一致的简洁布局
3. **Modal 内部的分组 Card 可以保留**，用于视觉分区

### 已修改的页面

| 页面 | 文件路径 | 修改内容 |
|------|----------|----------|
| 实验设计页面 | `actiontask/parallellab/ExperimentDesignPage.tsx` | 移除骨架屏 Card 包裹 |
| 执行监控页面 | `actiontask/parallellab/ExecutionMonitoringPage.tsx` | 移除骨架屏和实验选择器 Card 包裹 |
| 并行实验室主页 | `actiontask/parallellab/ParallelLab.tsx` | 移除骨架屏 Card 包裹 |
| 分析报告页面 | `actiontask/parallellab/AnalysisReportPage.tsx` | 移除骨架屏 Card 包裹 |
| 实验列表页面 | `actiontask/parallellab/ExperimentListPage.tsx` | 移除骨架屏搜索栏 Card 包裹 |
| 工作空间管理 | `workspace/WorkspaceManagement.tsx` | 移除 Tab 内容 Card 包裹 |
| RAGAS评测包装器 | `knowledgebase/RagasEvaluationWrapper.tsx` | 移除外层 Card 包裹 |
| 观察者管理 | `actionspace/ObserverManagement.tsx` | 移除外层 Card 包裹，改为标题+描述布局 |

---

## 代码示例

### 正确的按钮写法

```tsx
// 页面右上角操作按钮 - 使用默认尺寸
<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
  创建
</Button>

// 搜索框 - 使用默认尺寸
<Input
  placeholder="搜索..."
  prefix={<SearchOutlined />}
  style={{ width: 250 }}
/>
```

### 错误的按钮写法

```tsx
// 不要在页面操作按钮上使用 size="large"
<Button type="primary" icon={<PlusOutlined />} size="large" onClick={handleCreate}>
  创建
</Button>
```
