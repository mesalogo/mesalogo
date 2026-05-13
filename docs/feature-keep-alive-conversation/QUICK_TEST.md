# TaskWindowManager 快速测试指南

## ✅ 已完成实施

### 修改的文件

1. **新建**：
   - `frontend/src/components/TaskWindowManager/TaskWindowManager.js` (220行)
   - `frontend/src/components/TaskWindowManager/index.js` (1行)
   - `frontend/src/components/KeepAlive/ConversationKeepAlive.js` (140行)

2. **修改**：
   - `frontend/src/App.js` - 集成 TaskWindowManager
   - `frontend/src/pages/actiontask/ActionTaskDetail/index.js` - 支持 taskIdProp

**总代码量**：~380行

---

## 🚀 启动测试

```bash
cd frontend
npm start
```

浏览器打开 http://localhost:3000

---

## 📋 核心测试场景

### 场景 A：任务后台运行（关键！）

**步骤**：
1. 登录系统
2. 进入"行动任务"列表
3. 点击任务 A，进入详情页
4. 打开会话，发送消息："给我讲个长故事，至少 500 字"
5. 看到 Agent 开始流式输出
6. 等待 3 秒
7. **点击左上角返回按钮，回到任务列表**
8. 等待 30 秒（让流式输出完成）
9. **再次点击任务 A**

**预期结果**：
- ✅ 任务 A 的详情页立即显示
- ✅ 会话中的消息已全部接收完毕
- ✅ 流式输出完整显示
- ✅ 无需等待、无需刷新

**控制台日志**：
```
[TaskWindowManager] 打开任务窗口: task-A
[TaskWindowManager] 创建新窗口实例: task-A
... (返回列表)
[TaskWindowManager] 切换到任务列表，隐藏所有窗口
... (后台继续运行 30 秒)
... (再次进入任务 A)
[TaskWindowManager] 检测到任务详情路由: task-A
(窗口已存在，直接显示，无需创建)
```

---

### 场景 B：多任务并行（核心！）

**步骤**：
1. 打开任务 A，发送消息（流式输出开始）
2. 返回列表
3. 打开任务 B，发送消息（流式输出开始）
4. 返回列表
5. 打开任务 C，发送消息（流式输出开始）
6. 返回列表
7. 等待 20 秒
8. 依次进入任务 A、B、C

**预期结果**：
- ✅ 任务 A、B、C 的消息都已接收完毕
- ✅ 就像三个浏览器标签同时运行

**右下角状态**（开发环境）：
```
┌──────────────────┐
│ TaskWindows: 3/5 │
│ 1. dc0345ba ⚫   │ ← 当前显示
│ 2. abc12345 ⚪   │ ← 后台运行
│ 3. def67890 ⚪   │ ← 后台运行
└──────────────────┘
```

---

### 场景 C：会话切换（嵌套 KeepAlive）

**步骤**：
1. 打开任务 A
2. 打开会话 A1，发送消息（流式输出）
3. 切换到会话 A2，发送消息（流式输出）
4. 返回任务列表
5. 等待 20 秒
6. 再次进入任务 A
7. 查看会话 A1 和 A2

**预期结果**：
- ✅ 会话 A1 的消息完整
- ✅ 会话 A2 的消息完整
- ✅ 双层 KeepAlive 正常工作

---

## 🐛 问题排查

### 问题：页面卡在加载

**症状**：
```
[TaskWindowManager] 窗口状态: {total: 1, active: 'xxx', ...}
AppTabManager: 行动空间ID不存在，等待任务数据加载...
```

**原因**：
- ✅ 已修复：ActionTaskDetail 现在支持 `taskIdProp`

### 问题：内存占用高（405 MB）

**可能原因**：
- 其他页面或应用占用
- 正常的初始加载内存

**验证**：
1. 打开 Chrome Task Manager（Shift+Esc）
2. 查看具体的标签页内存
3. 打开多个任务后观察内存增长

**预期**：
- 每个任务窗口 ~10-20 MB
- 5 个任务约 50-100 MB

---

## ✅ 验证清单

### 功能验证

- [ ] 打开任务 → 返回列表 → 再次打开 → 流式消息完整
- [ ] 打开 3 个任务 → 所有流式输出都在后台完成
- [ ] 会话切换 → 返回列表 → 再次进入 → 会话状态保持
- [ ] 浏览器前进/后退按钮正常工作

### 性能验证

- [ ] 5 个任务窗口，内存增长 < 100 MB
- [ ] 隐藏的窗口 CPU < 1%
- [ ] 页面切换无卡顿

### UI 验证

- [ ] 右下角显示窗口状态（开发环境）
- [ ] 控制台日志清晰
- [ ] 无错误或警告

---

## 🔧 调试命令

打开控制台（F12）：

```javascript
// 查看 DOM 中的任务窗口
document.querySelectorAll('[data-task-window]').forEach(el => {
  console.log(el.dataset.taskWindow, el.dataset.active);
});

// 查看内存
if (performance.memory) {
  console.log('内存:', (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2), 'MB');
}
```

---

## 📊 效果演示

### 传统方案 vs TaskWindowManager

| 操作 | 传统方案 | TaskWindowManager |
|------|---------|-------------------|
| 打开任务 A | 加载数据（2s） | 加载数据（2s） |
| 返回列表 | 组件卸载 | 组件隐藏（继续运行） |
| 再次打开 A | 重新加载（2s） | **立即显示（0s）** ✅ |
| 流式数据 | 丢失 ❌ | 完整 ✅ |

---

## 🎉 预期效果

打开多个任务后，系统就像同时打开了多个浏览器标签：
- ✅ 每个任务独立运行
- ✅ 切换时立即显示
- ✅ 后台任务继续接收数据
- ✅ 内存和性能可控

---

**立即测试！** 按照场景 A 的步骤验证核心功能。
