# UI 主题系统方案

## 概述

为应用添加暗色主题支持，允许用户在亮色和暗色主题之间切换，并持久化用户偏好设置。

## 当前实现状态

### 已完成的工作

#### 1. 核心基础设施 ✅
- `src/theme.ts` - 已扩展为 lightTheme 和 darkTheme
- `src/contexts/ThemeContext.tsx` - 主题状态管理（已创建）
- `src/components/ThemeSwitcher.tsx` - 主题切换组件（已创建）
- `src/App.tsx` - 已集成 ThemeProvider
- `src/App.css` - 已添加 CSS 变量定义

#### 2. CSS 变量定义 ✅
在 `App.css` 中定义了以下 CSS 变量：
```css
:root {
  --custom-bg: #ffffff;
  --custom-bg-layout: #f0f2f5;
  --custom-text: rgba(0, 0, 0, 0.85);
  --custom-text-secondary: rgba(0, 0, 0, 0.45);
  --custom-border: #f0f0f0;
  --custom-card-bg: #ffffff;
  --custom-header-bg: #f8fafd;
  --custom-card-cover-bg: #f5f7fa;
  --custom-hover-bg: #f1f5f9;
  --custom-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  --md-code-bg: #f6f8fa;
  --msg-human-bg: #e6f7ff;
  --tree-selected-bg: #e6f7ff;
  --tree-selected-border: #91d5ff;
  --tree-hover-bg: #f0f8ff;
  --tree-hover-border: #d9e8ff;
  --scrollbar-track: #f1f1f1;
  --scrollbar-thumb: #c1c1c1;
  --scrollbar-thumb-hover: #a8a8a8;
  --overlay-bg: rgba(255, 255, 255, 0.7);
}

:root[data-theme='dark'] {
  --custom-bg: #141414;
  --custom-bg-layout: #0a0a0a;
  --custom-text: rgba(255, 255, 255, 0.85);
  --custom-text-secondary: rgba(255, 255, 255, 0.45);
  --custom-border: #303030;
  --custom-card-bg: #1f1f1f;
  --custom-header-bg: #1f1f1f;
  --custom-card-cover-bg: #2a2a2a;
  --custom-hover-bg: #2a2a2a;
  --custom-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  --md-code-bg: #2d2d2d;
  --msg-human-bg: #111d2c;
  --tree-selected-bg: #111d2c;
  --tree-selected-border: #153450;
  --tree-hover-bg: #1a1a2e;
  --tree-hover-border: #303050;
  --scrollbar-track: #2a2a2a;
  --scrollbar-thumb: #4a4a4a;
  --scrollbar-thumb-hover: #5a5a5a;
  --overlay-bg: rgba(0, 0, 0, 0.7);
}
```

#### 3. 已适配的组件和页面 ✅

**布局组件 (ModernLayout):**
- `ShortcutColumn.tsx` - 快捷入口列
- `MenuColumn.tsx` - 菜单列
- `GlobalMenuDrawer.tsx` - 全局菜单抽屉
- `ContextualSidebar.tsx` - 上下文侧边栏
- `index.tsx` - 主布局
- `styles.css` - 布局样式

**ActionTask 页面:**
- `ActionTaskDetail/index.tsx` - 任务详情页
- `ActionTaskDetail/components/LoadingSkeleton.tsx` - 加载骨架屏
- `ActionTaskDetail/components/tabs/MonitorTab.tsx` - 监控标签页
- `ActionTaskOverview.tsx` - 任务概览页
- `components/MessageItem.tsx` - 消息项
- `components/ActionTaskConversation/ActionTaskConversation.tsx` - 对话组件（聊天背景）
- `components/ActionTaskConversation/ConversationHeader.tsx` - 对话头部
- `components/ActionTaskConversation/MessageInput.tsx` - 消息输入
- `components/ActionTaskConversation/MessageList.tsx` - 消息列表
- `components/ActionTaskConversation/Planner/PlannerPanel.tsx` - 计划面板
- `components/ActionTaskWorkspace.tsx` - 工作空间
- `components/ActionTaskSupervisor.tsx` - 监督者交互
- `components/AutonomousTaskCard.tsx` - 自主任务卡片
- `components/AutonomousTaskModal.tsx` - 自主任务配置
- `components/ImageUploadModal.tsx` - 图片上传
- `components/ConversationExtraction.tsx` - 对话内容渲染
- `components/ActionTaskRules.tsx` - 规则组件
- `components/TaskAppTools.tsx` - 应用工具
- `parallellab/ExperimentDesign.tsx` - 实验设计
- `parallellab/TimelineTrackView.tsx` - 时间线视图
- `parallellab/ExperimentListPage.tsx` - 实验列表
- `css/conversation.css` - 对话样式
- `css/markdown-renderer.css` - Markdown 渲染样式

**Workspace 页面:**
- `WorkspaceTemplateTab.tsx`
- `ConversationHistoryTab.tsx`
- `PartitionWorkspaceTab.tsx`
- `WorkspaceEditor.tsx`
- `WorkspaceManagement.tsx`
- `components/WorkspaceFileViewer.tsx`
- `components/WorkspaceNavigator.tsx`
- `components/TaskSelector.tsx`
- `WorkspaceManagement.css`

**Knowledgebase 页面:**
- `DocumentManager.tsx`
- `external/ExternalKnowledges.tsx`
- `components/RetrievalSettings.tsx`
- `components/TestSearchModal.tsx`
- `components/ChunkSettings.tsx`

**ActionSpace 页面:**
- `ActionSpaceDetail.tsx`
- `ActionSpaceOverview/index.tsx`
- `ActionSpaceOverview/ActionSpaceCard.tsx`
- `AgentMonitoring.tsx`
- `AutonomousTaskMonitoring.tsx`
- `ObserverManagement.tsx`
- `AppMarket/MarketPage.tsx`
- `AppMarket/NextRPATab.tsx`
- `AppMarket/GISApp.tsx`
- `Variable/ExternalEnvironmentVariables.tsx`
- `ActionRules/RuleEditModal.tsx`
- `orchestration/OrchestrationTab.tsx`
- `orchestration/NodePalette.tsx`
- `orchestration/NodeConfigPanel.tsx`
- `orchestration/nodes/ApiNode.tsx`
- `orchestration/nodes/AgentNode.tsx`
- `orchestration/nodes/TaskNode.tsx`
- `orchestration/nodes/ConditionNode.tsx`
- `orchestration/nodes/KnowledgeNode.tsx`
- `orchestration/nodes/EndNode.tsx`

**Settings 页面:**
- `LogsPage.tsx`
- `MCPServersPage.tsx`
- `AboutPage.tsx`
- `ModelConfigsPage/ModelTestSection.tsx`
- `ModelConfigsPage/DefaultModelModal.tsx`
- `ModelConfigsPage/ModelListView.tsx`
- `ModelConfigsPage/ModelFormModal.tsx`
- `GeneralSettingsPage/GeneralSettingsPage.t `GeneralSettingsPage/VectorDBConfigModal.tsx`
- `GeneralSettingsPage/VectorDBTestModal.tsx`
- `GeneralSettingsPage/tabs/BasicSettings.tsx`
- `GeneralSettingsPage/tabs/ConversationSettings.tsx`
- `GeneralSettingsPage/tabs/DebugSettings.tsx`
- `GeneralSettingsPage/tabs/VectorDBSettings.tsx`
- `GeneralSettingsPage/tabs/AssistantSettings.tsx`
- `GeneralSettingsPage/tabs/TimeoutSettings.tsx`
- `GeneralSettingsPage/tabs/DocumentParsersSettings.tsx`
- `GraphEnhancementSettingsPage/GraphitiTab.tsx`
- `components/UserPermissions.tsx`
- `components/PasswordResetModal.tsx`

**Roles 页面:**
- `ExternalRoleModal.t- `InternalRoleModal.tsx`
- `RoleTable.tsx`
- `ToolManagement.tsx`

**Memory 页面:**
- `components/GraphVisualizationTab.tsx`

**其他页面:**
- `Home.tsx` - 首页仪表盘
- `Agents.tsx` - 智能体管理
- `oauth/OAuthCallback.tsx` - OAuth回调

**公共组件:**
- `components/Jobs/JobProgressDrawer.tsx`
- `components/Jobs/JobCenterDrawer.tsx`
- `components/OneClickGeneration/OneClickModal.tsx`
- `components/BatchUploadDialog.tsx`
- `components/MetricGauge.tsx`

**工具类:**
- `utils/fileUtils.tsx`
- `utils/workspaceUtils.tsx`

**登录和公共页面:**
- `pages/login/Login.css` - 已使用 CSS 变量
- `pages/public/PublicTaskView.css` - 已使用 CSS 变量
- `pages/public/EmbedTaskView.css` - 已使用 CSS 变量

### 最新修复 (2025-12-31 第五批)

#### 布局组件背景色统一使用CSS变量
- `MainLayout.tsx` - Header和Sider背景色从 `isDark ? '#141414' : '#fff'` 改为 `var(--custom-card-bg)` (2处)
- `ModernLayout/index.tsx` - Header背景色从 `isDark ? '#141414' : '#fff'` 改为 `var(--custom-card-bg)`
- `MenuColumn.tsx` - 搜索高亮背景色从 `#fff566` 改为 `#fadb14`（提高暗色模式下对比度）

---

### 修复记录 (2025-12-31 第四批)

#### 新增 CSS 变量
- `--custom-card-cover-bg` - 卡片封面/图标区域背景色
  - 亮色：`#f5f7fa`（比卡片背景稍深）
  - 暗色：`#2a2a2a`（比卡片背景 `#1f1f1f` 稍亮）

#### 应用市场卡片适配
- `MarketPage.tsx` - 卡片 cover 区域背景从 `var(--custom-header-bg)` 改为 `var(--custom-card-cover-bg)`
  - 修复暗色模式下卡片上下部分无颜色区分的问题

---

### 修复记录 (2025-12-31 第三批)

#### 列表选中状态背景色适配
将 `#e6f7ff` 替换为 `var(--tree-selected-bg)`：
- `TaskSelector.tsx` - 任务选择器选中项
- `WorkspaceNavigator.tsx` - 工作区导航选中项、根目录选中项
- `RoleKnowledgeBinding.tsx` - 角色列表选中项
- `ExternalIntegration.tsx` - 外部集成卡片选中项

#### hover 背景色适配
将 `#f0f8ff` 替换为 `var(--tree-hover-bg)`：
- `ActionTaskSupervisor.tsx` - 监督者消息背景（人类消息）
- `ExternalRoleModal.tsx` - 测试连接等待区域

#### 旧版蓝色 #1890ff 统一为 #1677ff
- `ConversationHeader.tsx` - 信息图标、同步图标
- `MessageItem.tsx` - 会话总结边框和文字
- `TestSearchModal.tsx` - 相似度分数文字
- `PlannerPanel.tsx` - 进行中任务边框
- `PublicTaskView.tsx` - 锁定图标
- `OnlyOfficeApp.tsx` - 信息图标
- `VSCodeApp.tsx` - 信息图标
- `JobCenterDrawer.tsx` - 进行中状态文字
- `GISApp.tsx` - 环境图标
- `MarketPage.tsx` - 数据分析分类颜色
- `TaskAppTools.tsx` - 数据分析分类颜色

#### 链接颜色适配
- `markdown-renderer.css` - `#0366d6` → `#1677ff`

#### 文字颜色适配
- `MainLayout.tsx` - `#000000d9` → `var(--custom-text)`

---

### 修复记录 (2025-12-31 第二批)

#### 背景色适配
将硬编码背景色替换为 CSS 变量：
- `TimelineTrackView.tsx` - `#f6f8fa` → `var(--md-code-bg)` (2处)
- `PublicTaskView.tsx` - `#f0f2f5` → `var(--custom-bg-layout)`
- `ExportModal.tsx` - `#f6f8fa` → `var(--md-code-bg)`
- `ConversationExtraction.tsx` - `#f9f9f9` → `var(--custom-hover-bg)`

#### 文字色适配
- `TimelineTrackView.tsx` - `#bbb` → `var(--custom-text-secondary)`
- `TimelineTrackView.tsx` - `#91d5ff` → `#1677ff`, `#434343` → `var(--custom-border)`
- `ExperimentListPage.tsx` - `#888` → `var(--custom-text-secondary)`

#### Badge 背景色适配
- `ModelListView.tsx` - `#fff` → `var(--custom-card-bg)` (2处筛选器徽章)

#### boxShadow 统一使用 CSS 变量
将 `boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'` 替换为 `var(--custom-shadow)`：
- `ModelListView.tsx` - 模型列表卡片
- `ModelTestSection.tsx` - 模型测试区域
- `ActionTaskOverview.tsx` - 任务概览卡片
- `LogsPage.tsx` - 日志页面卡片
- `KnowledgeBaseMain.tsx` - 知识库主页 (4处)
- `RoleBindings.tsx` - 角色绑定卡片
- `RagasEvaluationWrapper.tsx` - RAGAS 评估卡片
- `ToolManagement.tsx` - 工具管理卡片
- `InternalKnowledge.tsx` - 内部知识库卡片
- `ExternalKnowledge.tsx` - 外部知识库卡片
- `MonitoringCenter.tsx` - 监控中心卡片
- `AgentMonitoring.tsx` - 智能体监控卡片

---

### 修复记录 (2025-12-31 第一批)

#### 行动任务卡片按钮彩色样式
`ActionTaskOverview.tsx` 中的卡片操作按钮已添加彩色样式：
- 查看详情：蓝色 `#1677ff`
- 发布：绿色 `#52c41a`
- 归档：橙色 `#faad14`
- 删除：红色 `#ff4d4f`

#### Logo 暗色主题适配
以下页面的 Logo 已适配暗色主题，使用 `isDark ? "/logo-white.png" : "/logo.png"`：
- `components/layout/ModernLayout/index.tsx`
- `components/layout/MainLayout.tsx`
- `pages/login/Login.tsx`
- `pages/settings/AboutPage.tsx`

#### 硬编码颜色适配
将硬编码颜色替换为 CSS 变量：
- `ModelListView.tsx` - 边框 `#d9d9d9` → `var(--custom-border)`
- `TimelineTrackView.tsx` - 背景 `#d9d9d9` → `var(--custom-border)`
- `PartitionWorkspaceTab.tsx` - 文字 `#262626` → `var(--custom-text)`
- `InternalRoleModal.tsx` - 图标 `#d9d9d9` → `var(--custom-border)`
- `ObserverManagement.tsx` - 文字 `#d9d9d9` → `var(--custom-text-secondary)`
- `WorkspaceTemplateTab.tsx` - 图标 `#d9d9d9` → `var(--custom-border)`
- `PublicTaskView.tsx` - 图标 `#8c8c8c` → `var(--custom-text-secondary)`
- `KnowledgeBaseSelector.tsx` - 图标 `#d9d9d9` → `var(--custom-border)`
- `GraphVisualizationTab.tsx` - 背景 `#f0f0f0` → `var(--custom-hover-bg)`，图标 `#d9d9d9` → `var(--custom-border)`

#### 布局组件边框和背景适配
将布局组件中的硬编码颜色替换为 CSS 变量：
- `ModernLayout/index.tsx` - Header 边框 → `var(--custom-border)`
- `ModernLayout/ContextualSidebar.tsx` - 侧边栏背景 → `var(--custom-header-bg)`，边框 → `var(--custom-border)`
- `ModernLayout/GlobalMenuDrawer.tsx` - 搜索栏背景 → `var(--custom-header-bg)`，边框 → `var(--custom-border)`，hover 背景 → `var(--custom-card-bg)`
- `MainLayout.tsx` - Header 和侧边栏边框 → `var(--custom-border)`

#### 骨架屏卡片边框适配
以下页面的骨架屏卡片边框已从硬编码颜色改为 CSS 变量：
- `ActionTaskOverview.tsx` - 行动任务列表
- `ActionSpaceOverview/index.tsx` - 行动空间列表
- `AppMarket/MarketPage.tsx` - 应用市场
- `ModelListView.tsx` - 模型配置列表

#### 边框颜色适配
将 `#d9d9d9`、`#e8e8e8`、`#f0f0f0` 替换为 `var(--custom-border)`：
- `TimelineTrackView.tsx` - 并行实验时间线
- `NodePalette.tsx` - 编排节点面板
- `OrchestrationTab.tsx` - 编排标签页
- `DocumentManager.tsx` - 文档管理
- `TestSearchModal.tsx` - 搜索测试
- `ChunkSettings.tsx` - 分块设置
- `WorkspaceFileViewer.tsx` - 工作区文件查看
- `ConversationHistoryTab.tsx` - 对话历史
- `WorkspaceEditor.tsx` - 工作区编辑器
- `RuleEditModal.tsx` - 规则编辑
- `ActionSpaceDetail.tsx` - 行动空间详情
- `MCPServersPage.tsx` - MCP服务器配置
- `ToolManagement.tsx` - 工具管理
- `ModelTestSection.tsx` - 模型测试
- `DocumentParsersSettings.tsx` - 文档解析设置
- `GraphVisualizationTab.tsx` - 图谱可视化
- `TagManagementModal.tsx` - 标签管理
- `ActionTaskRules.tsx` - 行动任务规则
- `ExternalRoleModal.tsx` - 外部角色
- `PublicTaskView.tsx` - 公开任务视图
- `OneClickModal.tsx` - 一键创建
- `ConversationExtraction.tsx` - 对话提取
- `LoginDemo.tsx` - 登录演示

#### 背景颜色适配
将 `#fff`、`#ffffff` 替换为 `var(--custom-card-bg)`：
- `TimelineTrackView.tsx` - 时间线轨道标签背景
- `ConversationHistoryTab.tsx` - 对话消息背景
- `ChunkSettings.tsx` - 分块方法选择背景
- `LoginDemo.tsx` - 侧边栏背景
- 编排节点组件 (`AgentNode`, `ApiNode`, `ConditionNode`, `TaskNode`, `KnowledgeNode`)

#### 文字颜色适配
将 `#333`、`#666`、`#999` 替换为 CSS 变量：
- `DocumentManager.tsx` - 分段内容文字
- `TestSearchModal.tsx` - 搜索结果文字
- `AgentNode.tsx`, `KnowledgeNode.tsx` - 节点描述文字
- `WorkspaceNavigator.tsx` - 导航项文字
- `CreateSpaceModal.tsx` - 禁用状态文字
- `ExternalUserSystems.tsx` - 图标颜色
- `Login.tsx` - 第三方登录提示文字
- `ExternalRoleModal.tsx` - 响应内容文字

### 待完成的工作

#### 1. 保留不变的颜色（功能性/语义化颜色）
- 节点主题色（如 `#1677ff`, `#722ed1`, `#fa8c16` 等）- 用于区分不同类型节点
- 状态颜色（如 `#52c41a` 成功, `#ff4d4f` 错误, `#faad14` 警告）- 语义化颜色
- 特殊背景色（如 `#fff2f0` 错误背景, `#f6ffed` 成功背景）- 状态指示
- 代码高亮颜色（如 `#282c34` 代码块背景, `#abb2bf` 代码文字）- 语法高亮

#### 2. 第三方组件
- Mermaid 图表 - 内嵌 HTML，使用固定颜色
- vis-network 图谱 - 使用固定配置颜色

#### 3. 不需要适配的页面
- `LoginDemo.tsx` - 登录演示页面，使用独立主题配置

## 适配方法说明

### 颜色替换规则
将硬编码颜色替换为 CSS 变量：

| 原始颜色 | CSS 变量 | 用途 |
|---------|---------|------|
| `#f5f7fa` | `var(--custom-card-cover-bg)` | 卡片封面/图标区域背景 |
| `#ffffff`, `#fff` | `var(--custom-card-bg)` | 卡片/容器背景 |
| `#f5f5f5`, `#f0f0f0` | `var(--custom-hover-bg)` | hover 背景 |
| `#fafafa`, `#f8fafd` | `var(--custom-header-bg)` | 头部/次要背景 |
| `#f0f2f5` | `var(--custom-bg-layout)` | 布局背景 |
| `#8c8c8c`, `#999` | `var(--custom-text-secondary)` | 次要文字 |
| `#595959`, `#666` | `var(--custom-text-secondary)` | 次要文字 |
| `#262626`, `#333` | `var(--custom-text)` | 主要文字 |
| `#f0f0f0`, `#e8e8e8`, `#d9d9d9` | `var(--custom-border)` | 边框 |
| `#f6f8fa` | `var(--md-code-bg)` | 代码块背景 |
| `#e6f7ff` | `var(--msg-human-bg)` | 用户消息背景 |

### 移除 JS hover 事件
将 `onMouseEnter`/`onMouseLeave` 中的颜色设置改为 CSS class：
```css
.shortcut-item:hover {
  background: var(--custom-hover-bg) !important;
  color: #1677ff !important;
}
```

## 测试要点

- [x] 主题切换功能正常
- [x] 刷新页面后主题保持
- [x] 跟随系统主题功能正常
- [x] TypeScript 编译通过
- [ ] 所有页面在暗色主题下显示正常（需人工验证）
- [ ] 表单、表格、弹窗等组件样式正确（需人工验证）
- [ ] 登录页在两种主题下显示正常（需人工验证）

## 后续优化建议

1. **统一颜色管理** - 考虑创建一个颜色常量文件，集中管理所有颜色值
2. **主题预览** - 在设置页面添加主题预览功能
3. **自定义主题** - 允许用户自定义主题色
4. **过渡动画** - 主题切换时添加平滑过渡效果
