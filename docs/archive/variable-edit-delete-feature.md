# 智能体变量编辑和删除功能

## 功能说明

在行动任务详情页面的右侧"任务监控"标签页中，现在可以对智能体变量进行编辑和删除操作。

## 使用方法

### 编辑变量

1. 将鼠标悬停在任意智能体变量的"当前值"列上
2. 会出现半透明的编辑按钮（铅笔图标）
3. 点击编辑按钮，值字段会变成可编辑的输入框
4. 修改值后，可以：
   - 点击绿色的勾选按钮保存
   - 按 Enter 键保存
   - 点击关闭按钮或按 Esc 键取消

### 删除变量

1. 将鼠标悬停在任意智能体变量的"当前值"列上
2. 会出现半透明的删除按钮（垃圾桶图标）
3. 点击删除按钮，会弹出确认对话框
4. 确认后，变量将被删除

## 技术实现

### 前端 API

在 `frontend/src/services/api/actionTask.ts` 中添加了两个新的 API 方法：

- `updateAgentVariable(agentId, variableName, value)`: 更新智能体变量
- `deleteAgentVariable(agentId, variableName)`: 删除智能体变量

### 组件修改

在 `frontend/src/pages/actiontask/ActionTaskDetail/components/tabs/MonitorTab.tsx` 中：

1. 添加了状态管理：
   - `editingVariable`: 当前正在编辑的变量
   - `editingValue`: 编辑中的值
   - `hoveredVariable`: 鼠标悬停的变量

2. 添加了处理函数：
   - `handleEditVariable`: 开始编辑变量
   - `handleSaveVariable`: 保存变量修改
   - `handleCancelEdit`: 取消编辑
   - `handleDeleteVariable`: 删除变量

3. 更新了表格渲染逻辑：
   - 鼠标悬停时显示编辑/删除按钮
   - 编辑状态下显示输入框和保存/取消按钮
   - 删除操作带确认对话框

### 后端 API

使用已有的后端 API：

- `PUT /agents/{agent_id}/variables/{name}`: 更新变量
- `DELETE /agents/{agent_id}/variables/{name}`: 删除变量

## 交互设计特点

1. **轻量级交互**: 鼠标悬停才显示操作按钮，保持界面简洁
2. **半透明按钮**: 操作按钮透明度为 0.7，不干扰阅读
3. **内联编辑**: 直接在表格中编辑，无需弹窗
4. **即时反馈**: 操作成功/失败都有消息提示
5. **安全确认**: 删除操作需要二次确认
6. **自动刷新**: 编辑或删除后自动刷新变量数据

## 注意事项

1. 变量编辑和删除操作会立即生效
2. 删除操作不可逆，请谨慎操作
3. 操作后会自动刷新变量列表以显示最新状态
