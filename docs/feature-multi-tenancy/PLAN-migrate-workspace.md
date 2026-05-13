# 智能体记忆系统迁移为项目空间计划

## 背景说明

现有的"智能体记忆"系统实际上是基于文件的工作空间，用户希望将其重新定位为"项目空间"，为未来基于向量数据库+RAG的真正智能体记忆系统让路。

## 核心改动原则

- 保持现有功能不变，只进行重命名和概念调整
- 尽可能减少结构性的大修改
- 主要调整名词、提示词、变量名、函数名等

## 重命名映射表

| 原名称 | 新名称 | 说明 |
|--------|--------|------|
| 智能体记忆 | 项目空间 | 整体概念重命名 |
| 记忆文件 | 项目文件 | 文件概念重命名 |
| 记忆管理 | 项目空间管理 | 管理界面重命名 |
| 任务记忆浏览器 | 工作空间浏览器 | 浏览器重命名 |
| AgentMemory.md | AgentWorkspace.md | 智能体工作文件 |
| TaskConclusion.md | ProjectSummary.md | 项目总结文件 |
| MemoryIndex.md | ProjectIndex.md | 项目索引文件 |
| agent-memory-sandbox | agent-workspace | 目录名重命名 |

## 前端菜单结构调整

### 当前结构
```
角色与智能体
├── 角色管理
├── 能力与工具  
├── 知识库管理
└── 分区记忆
    ├── 任务记忆浏览器 (PartitionMemoryTab)
    ├── 会话记忆
    ├── 记忆模板
    └── 专业知识记忆（知识库）
```

### 调整后结构
```
角色与智能体
├── 角色管理
├── 能力与工具  
├── 知识库管理
├── 工作空间浏览器 (独立菜单项)
└── 分区记忆管理 (重命名)
    ├── 会话记忆
    ├── 工作空间模板 (原记忆模板)
    └── 专业知识记忆（知识库）
```

## 实施步骤清单

### 第一阶段：后端核心服务重命名

#### 1. 文件重命名
- [ ] `backend/app/services/memory_service.py` → `workspace_service.py`
- [ ] `backend/app/api/routes/memory.py` → `workspace.py`

#### 2. 类和变量重命名
- [ ] `MemoryService` → `WorkspaceService`
- [ ] `memory_service` 实例 → `workspace_service`
- [ ] `memory_dir` → `workspace_dir`
- [ ] `agent-memory-sandbox` → `agent-workspace`

#### 3. 函数重命名
- [ ] `initialize_memory_for_action_task` → `initialize_workspace_for_action_task`
- [ ] `get_memory_files_for_task` → `get_workspace_files_for_task`
- [ ] `create_memory_file` → `create_workspace_file`
- [ ] `update_memory_file_content` → `update_workspace_file_content`
- [ ] `delete_memory_file` → `delete_workspace_file`
- [ ] `get_memory_file_content` → `get_workspace_file_content`

### 第二阶段：数据库模型调整

#### 4. 模型重命名
- [ ] `MemoryTemplate` → `WorkspaceTemplate`
- [ ] 表名 `memory_templates` → `workspace_templates`
- [ ] 相关字段注释和描述更新

### 第三阶段：API路由调整

#### 5. Blueprint重命名
- [ ] `memory_bp` → `workspace_bp`
- [ ] `memory_api` → `workspace_api`

#### 6. API端点重命名
- [ ] `/memory-management/` → `/workspace-management/`
- [ ] `/action-tasks/{id}/memory-files` → `/action-tasks/{id}/workspace-files`
- [ ] `/memory-management/memory-file/` → `/workspace-management/workspace-file/`
- [ ] `/memory-management/memory-template` → `/workspace-management/workspace-template`

### 第四阶段：导入语句更新

#### 7. 后端导入更新
- [ ] `backend/app/services/conversation/message_processor.py`
- [ ] `backend/app/api/routes/action_tasks.py`
- [ ] `backend/app/services/action_task_service.py`
- [ ] `backend/app/api/routes/__init__.py`

### 第五阶段：前端服务重命名

#### 8. 前端API服务
- [ ] `frontend/src/services/api/memory.js` → `workspace.js`
- [ ] `memoryAPI` → `workspaceAPI`
- [ ] 所有API方法名重命名（如 `getMemoryFiles` → `getWorkspaceFiles`）

#### 9. 前端组件目录和文件
- [ ] `frontend/src/pages/memory/` → `workspace/`
- [ ] `ActionTaskMemory.js` → `ActionTaskWorkspace.js`
- [ ] `PartitionMemoryTab.js` → `PartitionWorkspaceTab.js`
- [ ] `MemoryTemplateTab.js` → `WorkspaceTemplateTab.js`
- [ ] `MemoryManagement.js` → `WorkspaceManagement.js`
- [ ] `MemoryEditor.js` → `WorkspaceEditor.js`
- [ ] `MemoryTemplateModal.js` → `WorkspaceTemplateModal.js`
- [ ] `DeleteMemoryModal.js` → `DeleteWorkspaceModal.js`
- [ ] `ConversationMemoryTab.js` → `ConversationMemoryTab.js` (保持不变，这是真正的记忆)
- [ ] `SharedMemoryTab.js` → `SharedWorkspaceTab.js`
- [ ] `LongTermMemoryTab.js` → `LongTermWorkspaceTab.js`
- [ ] `components/MemoryViewer.js` → `components/WorkspaceViewer.js`
- [ ] `components/TaskAgentSelector.js` (保持不变，但更新内部引用)

### 第六阶段：前端菜单结构调整

#### 10. 菜单配置更新
- [ ] 在 `MainLayout.js` 中添加独立的"工作空间浏览器"菜单项
- [ ] 将原"分区记忆"重命名为"分区记忆管理"
- [ ] 从分区记忆管理中移除"任务记忆浏览器"标签页
- [ ] 更新路由配置，添加独立的工作空间浏览器路由

#### 11. 组件导入更新
- [ ] 更新所有组件的导入语句
- [ ] 更新 `App.js` 中的路由配置
- [ ] 更新相关组件的引用关系

### 第七阶段：文件模板和内容

#### 12. 默认文件名
- [ ] `AgentMemory.md` → `AgentWorkspace.md`
- [ ] `TaskConclusion.md` → `ProjectSummary.md`
- [ ] `MemoryIndex.md` → `ProjectIndex.md`

#### 13. 文件内容模板
- [ ] 更新所有文件创建模板中的标题和描述
- [ ] 更新提示词中的文件结构说明

### 第八阶段：智能体提示词

#### 14. 提示词更新
- [ ] `message_processor.py` 中的 `<agentMemory>` → `<agentWorkspace>`
- [ ] "Long-term Memory Capability" → "Project Workspace Capability"
- [ ] 所有相关描述文本更新

### 第九阶段：前端界面文本

#### 15. 显示文本更新
- [ ] "智能体记忆" → "项目空间"
- [ ] "记忆管理" → "项目空间管理"
- [ ] "任务记忆浏览器" → "工作空间浏览器"
- [ ] "共享记忆" → "共享工作区"
- [ ] "长期记忆" → "个人工作区"
- [ ] "记忆模板" → "工作空间模板"
- [ ] "分区记忆" → "分区记忆管理"
- [ ] "记忆文件" → "项目文件"
- [ ] "创建记忆" → "创建文件"
- [ ] "编辑记忆" → "编辑文件"
- [ ] "删除记忆" → "删除文件"
- [ ] 所有相关按钮、标签、提示文本、错误消息

### 第十阶段：路由注册

#### 16. 路由注册更新
- [ ] `backend/app/api/routes/__init__.py` 中的 blueprint 注册
- [ ] 前端路由配置更新

### 第十一阶段：CSS和样式文件

#### 17. 样式文件更新
- [ ] `frontend/src/pages/memory/MemoryManagement.css` → `WorkspaceManagement.css`
- [ ] 更新CSS类名中的memory相关命名
- [ ] 更新CSS注释中的描述文本
- [ ] 检查其他可能包含memory样式的CSS文件

### 第十二阶段：文档和配置文件

#### 18. 文档更新
- [ ] 更新 `docs/PLAN-memory.md` 或标记为过时
- [ ] 更新任何技术文档中的相关描述

#### 19. 配置和常量
- [ ] 检查是否有硬编码的memory相关路径或常量
- [ ] 更新任何配置文件中的相关设置

### 第十三阶段：测试和验证

#### 20. 功能验证
- [ ] 创建行动任务时的工作空间初始化
- [ ] 工作空间文件的读写操作
- [ ] 前端界面的正常显示和交互
- [ ] API端点的正确响应
- [ ] 菜单导航的正确跳转
- [ ] CSS样式的正确应用
- [ ] 所有文本显示的正确性

## 注意事项

1. **保持向后兼容**：在迁移过程中，可能需要保留一些旧的API端点以确保兼容性
2. **数据库迁移**：如果涉及表名修改，需要编写数据库迁移脚本
3. **测试覆盖**：每个阶段完成后都应该进行功能测试
4. **文档更新**：完成后需要更新相关的技术文档和用户文档

## 补充发现的缺失项

### 需要特别注意的文件和组件：
1. **CSS样式文件**：`MemoryManagement.css` 包含大量memory相关的类名和注释
2. **模态框组件**：`MemoryTemplateModal.js`、`DeleteMemoryModal.js` 等
3. **编辑器组件**：`MemoryEditor.js` 需要重命名
4. **文档文件**：`docs/PLAN-memory.md`、`docs/TODO.md` 中的相关内容
5. **错误消息和日志**：所有包含"记忆"、"memory"的错误消息和日志输出
6. **注释和文档字符串**：代码中的中文注释和文档字符串

### 可能被遗漏的地方：
1. **硬编码字符串**：代码中直接写死的中文文本
2. **API响应消息**：后端返回的错误消息和成功消息
3. **前端提示信息**：message.success、message.error 等提示文本
4. **表单标签**：表单字段的label和placeholder文本
5. **工具提示**：Tooltip组件中的提示文本

## 实施顺序

建议按照以下顺序执行：
1. 后端服务和API（第一至四阶段）
2. 前端服务和组件（第五至六阶段）
3. 内容和界面（第七至九阶段）
4. 路由和配置（第十阶段）
5. 样式和文档（第十一至十二阶段）
6. 测试验证（第十三阶段）

每个阶段完成后进行测试，确保功能正常再进入下一阶段。
