# 前端任务队列集成指南

## 一、已创建的文件

### 1. API 封装
```
frontend/src/services/api/tasks.js
```

### 2. React Hook
```
frontend/src/hooks/useTaskPolling.js
```

### 3. React 组件
```
frontend/src/components/Tasks/
├── TaskProgressModal.js    # 进度弹窗
└── index.js                # 导出
```

### 4. 集成示例
```
frontend/src/pages/knowledgebase/KnowledgeTaskExample.js
```

---

## 二、快速使用

### 方式1：使用进度弹窗（推荐）

```javascript
import React, { useState } from 'react';
import { Button, message } from 'antd';
import tasksAPI from '@/services/api/tasks';
import { TaskProgressModal } from '@/components/Tasks';

const YourComponent = () => {
  const [taskId, setTaskId] = useState(null);
  const [visible, setVisible] = useState(false);

  const handleSubmit = async () => {
    try {
      // 1. 提交任务
      const result = await tasksAPI.submitTask(
        'kb:vectorize_file',
        {
          knowledge_id: 'kb_123',
          file_path: 'doc.pdf'
        },
        'high'
      );

      // 2. 显示进度弹窗
      setTaskId(result.task_id);
      setVisible(true);
      message.success('任务已提交');

    } catch (error) {
      message.error('提交失败');
    }
  };

  return (
    <div>
      <Button onClick={handleSubmit}>开始向量化</Button>

      <TaskProgressModal
        taskId={taskId}
        visible={visible}
        onClose={() => setVisible(false)}
        onCompleted={() => message.success('完成！')}
        onFailed={(task) => message.error('失败: ' + task.error)}
      />
    </div>
  );
};
```

### 方式2：使用 Hook 自定义 UI

```javascript
import React from 'react';
import { Progress, Tag } from 'antd';
import { useTaskPolling } from '@/hooks/useTaskPolling';

const CustomProgress = ({ taskId }) => {
  const { task, progress, status, message, isRunning } = useTaskPolling(taskId, {
    interval: 2000,  // 2秒轮询一次
    onCompleted: (task) => {
      console.log('任务完成', task);
    }
  });

  if (!task) return null;

  return (
    <div>
      <Tag color={isRunning ? 'processing' : 'success'}>
        {status}
      </Tag>
      <Progress percent={progress} status={isRunning ? 'active' : 'success'} />
      <div>{message}</div>
    </div>
  );
};
```

---

## 三、API 使用

### tasksAPI.submitTask()
提交任务

```javascript
const result = await tasksAPI.submitTask(
  taskType,    // 'kb:vectorize_file' | 'kb:vectorize_batch'
  params,      // 任务参数
  priority     // 'high' | 'medium' | 'low'
);

// 返回: { task_id: 'task_abc123', status: 'pending', message: '...' }
```

### tasksAPI.getTaskStatus()
查询任务状态

```javascript
const task = await tasksAPI.getTaskStatus(taskId);

// 返回完整任务信息
{
  task_id: 'task_abc123',
  task_type: 'kb:vectorize_file',
  status: 'running',
  progress: 45,
  message: '向量化进度 25/50',
  params: {...},
  result: null,
  logs: [...]
}
```

### tasksAPI.cancelTask()
取消任务

```javascript
const result = await tasksAPI.cancelTask(taskId);
// 返回: { success: true }
```

### tasksAPI.listTasks()
查询任务列表

```javascript
const result = await tasksAPI.listTasks({
  taskType: 'kb:vectorize_file',
  status: 'running',
  offset: 0,
  limit: 20
});

// 返回: { tasks: [...], total: 10 }
```

### tasksAPI.getStats()
获取统计

```javascript
const stats = await tasksAPI.getStats();
// 返回: { total: 100, pending: 2, running: 3, completed: 90, failed: 5 }
```

---

## 四、Hook 使用

### useTaskPolling 参数

```javascript
const {
  task,         // 完整任务对象
  loading,      // 是否加载中
  error,        // 错误对象
  refresh,      // 手动刷新函数
  // 便捷属性
  progress,     // 进度 0-100
  status,       // 状态字符串
  message,      // 消息
  isRunning,    // 是否运行中
  isCompleted,  // 是否完成
  isFailed,     // 是否失败
} = useTaskPolling(taskId, {
  interval: 2000,           // 轮询间隔（毫秒）
  enabled: true,            // 是否启用
  onCompleted: (task) => {}, // 完成回调
  onFailed: (task) => {},    // 失败回调
  onProgress: (task) => {},  // 进度更新回调
});
```

---

## 五、组件使用

### TaskProgressModal 参数

```javascript
<TaskProgressModal
  taskId="task_abc123"           // 必填：任务ID
  visible={true}                 // 必填：是否显示
  onClose={() => {}}             // 必填：关闭回调
  title="任务进度"               // 可选：标题
  onCompleted={(task) => {}}     // 可选：完成回调
  onFailed={(task) => {}}        // 可选：失败回调
/>
```

功能特性：
- ✅ 自动轮询进度
- ✅ 显示进度条和日志
- ✅ 支持取消任务
- ✅ 运行中不允许直接关闭（需确认）
- ✅ 完成后自动停止轮询

---

## 六、集成到现有页面

### 知识库文档列表页面

在现有的 `DocumentManager.js` 中集成：

```javascript
import { useState } from 'react';
import tasksAPI from '@/services/api/tasks';
import { TaskProgressModal } from '@/components/Tasks';

// 在组件中添加状态
const [currentTaskId, setCurrentTaskId] = useState(null);
const [progressVisible, setProgressVisible] = useState(false);

// 修改向量化按钮点击事件
const handleVectorize = async (document) => {
  try {
    // 提交任务（替换原来的同步调用）
    const result = await tasksAPI.submitTask(
      'kb:vectorize_file',
      {
        knowledge_id: knowledgeId,
        file_path: document.file_path
      },
      'high'
    );

    // 显示进度弹窗
    setCurrentTaskId(result.task_id);
    setProgressVisible(true);

  } catch (error) {
    message.error('提交失败');
  }
};

// 在 return 中添加进度弹窗
return (
  <div>
    {/* 原有的文档列表 */}
    <Table ... />

    {/* 新增：进度弹窗 */}
    <TaskProgressModal
      taskId={currentTaskId}
      visible={progressVisible}
      onClose={() => setProgressVisible(false)}
      onCompleted={() => {
        message.success('向量化完成！');
        fetchDocuments();  // 刷新列表
      }}
    />
  </div>
);
```

---

## 七、完整示例

参考 `frontend/src/pages/knowledgebase/KnowledgeTaskExample.js`

该示例包含：
- ✅ 单文件向量化
- ✅ 批量向量化
- ✅ 进度显示
- ✅ 完成/失败处理
- ✅ 列表刷新

---

## 八、样式定制

如果需要自定义样式，可以覆盖 Ant Design 的默认样式：

```css
/* 自定义进度条颜色 */
.ant-progress-bg {
  background: linear-gradient(to right, #108ee9, #87d068);
}

/* 自定义弹窗样式 */
.task-progress-modal .ant-modal-body {
  max-height: 600px;
  overflow-y: auto;
}
```

---

## 九、错误处理

### 常见错误

**1. 401 Unauthorized**
```javascript
// 解决：检查 token 是否过期
if (error.response?.status === 401) {
  // 跳转到登录页
  history.push('/login');
}
```

**2. 404 Not Found**
```javascript
// 任务不存在或已删除
if (error.response?.status === 404) {
  message.error('任务不存在');
}
```

**3. 500 Server Error**
```javascript
// 服务器错误
if (error.response?.status === 500) {
  message.error('服务器错误: ' + error.response.data.error);
}
```

---

## 十、性能优化

### 1. 避免重复轮询
```javascript
// 使用 enabled 参数控制轮询
const { task } = useTaskPolling(taskId, {
  enabled: visible && !!taskId  // 仅在弹窗可见且有 taskId 时轮询
});
```

### 2. 调整轮询间隔
```javascript
// 根据任务类型调整间隔
const interval = taskType === 'kb:vectorize_file' ? 2000 : 5000;
```

### 3. 及时清理
```javascript
useEffect(() => {
  return () => {
    // 组件卸载时清理
    setTaskId(null);
  };
}, []);
```

---

## 十一、测试清单

- [ ] 提交任务成功
- [ ] 进度实时更新
- [ ] 完成后显示结果
- [ ] 失败后显示错误
- [ ] 取消任务成功
- [ ] 关闭弹窗后后台继续运行
- [ ] 多个任务同时运行
- [ ] 刷新页面后任务仍在运行

---

**前端集成完成！** 🎉

下一步：
1. 在知识库页面集成
2. 测试完整流程
3. 根据需要添加更多功能
