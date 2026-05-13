# 任务队列快速开始指南

## 一、后端部署

### 1. 创建数据库表

```bash
cd backend
python create_task_table.py
```

输出示例：
```
✓ Task 表创建成功
✓ 验证通过：tasks 表已存在

表结构:
  - id: VARCHAR(36)
  - task_type: VARCHAR(50)
  - status: VARCHAR(20)
  - user_id: VARCHAR(36)
  - data: JSON
  - created_at: DATETIME
  - updated_at: DATETIME
```

### 2. 启动应用

```bash
python run_app.py
```

看到这些日志表示成功：
```
[INFO] 任务管理器已初始化
[INFO] 注册任务处理器: kb:vectorize_file
[INFO] 注册任务处理器: kb:vectorize_batch
```

---

## 二、API 测试

### 方法 1：使用 curl

#### 1) 提交任务
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "kb:vectorize_file",
    "params": {
      "knowledge_id": "kb_123",
      "file_path": "docs/manual.pdf"
    },
    "priority": "high"
  }'
```

响应：
```json
{
  "task_id": "task_abc123",
  "status": "pending",
  "message": "任务已提交"
}
```

#### 2) 查询进度
```bash
curl http://localhost:5000/api/tasks/task_abc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

响应：
```json
{
  "task_id": "task_abc123",
  "task_type": "kb:vectorize_file",
  "status": "running",
  "progress": 45,
  "message": "向量化进度 25/50",
  "params": {
    "knowledge_id": "kb_123",
    "file_path": "docs/manual.pdf"
  },
  "logs": [
    {"time": "2024-11-07T20:50:05", "level": "INFO", "message": "开始执行"},
    {"time": "2024-11-07T20:50:10", "level": "INFO", "message": "读取 50 个分段"}
  ]
}
```

### 方法 2：使用测试脚本

```bash
# 1. 编辑 test_task_queue.py，设置 TOKEN
vi test_task_queue.py
# 修改: TOKEN = "your_actual_token"

# 2. 运行测试
python test_task_queue.py
```

---

## 三、前端集成

### 1. API 封装

创建 `frontend/src/services/api/tasks.js`：

```javascript
import axios from './axios';

export const tasksAPI = {
  // 提交任务
  submitTask: async (taskType, params, priority = 'medium') => {
    const res = await axios.post('/api/tasks', {
      task_type: taskType,
      params,
      priority
    });
    return res.data;
  },

  // 查询状态
  getTaskStatus: async (taskId) => {
    const res = await axios.get(`/api/tasks/${taskId}`);
    return res.data;
  },

  // 取消任务
  cancelTask: async (taskId) => {
    const res = await axios.post(`/api/tasks/${taskId}/cancel`);
    return res.data;
  },

  // 任务列表
  listTasks: async (filters = {}) => {
    const res = await axios.get('/api/tasks', { params: filters });
    return res.data;
  },

  // 统计
  getStats: async () => {
    const res = await axios.get('/api/tasks/stats');
    return res.data;
  }
};
```

### 2. 在知识库页面使用

```javascript
import { message } from 'antd';
import { tasksAPI } from '@/services/api/tasks';

const KnowledgeDocumentList = () => {
  const [taskId, setTaskId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [taskStatus, setTaskStatus] = useState('');

  // 点击向量化按钮
  const handleVectorize = async (document) => {
    try {
      // 提交任务
      const result = await tasksAPI.submitTask(
        'kb:vectorize_file',
        {
          knowledge_id: knowledgeId,
          file_path: document.file_path
        },
        'high'
      );

      setTaskId(result.task_id);
      message.success('任务已提交');

      // 开始轮询
      startPolling(result.task_id);

    } catch (error) {
      message.error('提交失败: ' + error.message);
    }
  };

  // 轮询进度
  const startPolling = (id) => {
    const interval = setInterval(async () => {
      try {
        const status = await tasksAPI.getTaskStatus(id);

        setProgress(status.progress);
        setTaskStatus(status.status);

        // 任务结束，停止轮询
        if (status.status === 'completed') {
          clearInterval(interval);
          message.success('向量化完成！');
          // 刷新列表
          fetchDocuments();
        } else if (status.status === 'failed') {
          clearInterval(interval);
          message.error('向量化失败: ' + status.error);
        }

      } catch (error) {
        console.error('查询任务状态失败:', error);
      }
    }, 2000);  // 每 2 秒查询一次

    return () => clearInterval(interval);
  };

  return (
    <div>
      {/* 文档列表 */}
      <Table
        dataSource={documents}
        columns={[
          {
            title: '文件名',
            dataIndex: 'file_name'
          },
          {
            title: '操作',
            render: (record) => (
              <Button onClick={() => handleVectorize(record)}>
                向量化
              </Button>
            )
          }
        ]}
      />

      {/* 进度条（如果有任务在运行） */}
      {taskId && (
        <div style={{ marginTop: 16 }}>
          <Progress percent={progress} status="active" />
          <div>状态: {taskStatus}</div>
        </div>
      )}
    </div>
  );
};
```

---

## 四、改造现有 API 为异步

### 示例：改造向量化接口

修改 `backend/app/api/routes/knowledge.py`：

```python
from app.services.task_queue import task_manager

@knowledge_bp.route('/knowledges/<knowledge_id>/documents/<document_id>/vectorize', methods=['POST'])
@login_required
def vectorize_file_async(current_user, knowledge_id, document_id):
    """
    异步向量化文件（改造版）
    """
    try:
        # 验证文档存在
        document = KnowledgeDocument.query.get(document_id)
        if not document:
            return jsonify({"error": "文档不存在"}), 404

        # 提交任务（替换原来的同步调用）
        task_id = task_manager.submit_task(
            task_type='kb:vectorize_file',
            params={
                'knowledge_id': knowledge_id,
                'file_path': document.file_path
            },
            user_id=current_user.id,
            priority='high'
        )

        return jsonify({
            'task_id': task_id,
            'message': '向量化任务已提交'
        }), 202  # 202 Accepted

    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

前端调用（保持兼容）：

```javascript
// 旧代码
const response = await api.post(`/knowledges/${id}/documents/${docId}/vectorize`);

// 现在返回 task_id，开始轮询
const taskId = response.data.task_id;
pollTaskStatus(taskId);
```

---

## 五、常见问题

### Q1: 任务提交后没有执行？
**A:** 检查日志：
```bash
tail -f logs/app.log | grep task
```

确认 TaskManager 已初始化，处理器已注册。

### Q2: 任务一直处于 pending 状态？
**A:** 可能是处理器报错。查看任务详情：
```bash
curl http://localhost:5000/api/tasks/{task_id}
```

查看 `error` 和 `logs` 字段。

### Q3: 如何查看所有运行中的任务？
**A:**
```bash
curl "http://localhost:5000/api/tasks?status=running" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Q4: 任务卡住了怎么办？
**A:** 取消任务：
```bash
curl -X POST http://localhost:5000/api/tasks/{task_id}/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Q5: 如何清理历史任务？
**A:** 直接删除数据库记录（后续可添加自动清理）：
```sql
DELETE FROM tasks WHERE status IN ('completed', 'failed') AND created_at < DATE('now', '-30 days');
```

---

## 六、下一步

- [ ] 测试基础 API
- [ ] 前端集成进度条
- [ ] 改造现有知识库 API
- [ ] 添加更多任务类型（变量同步、导出等）
- [ ] 添加任务中心页面

---

**完成！开始使用吧！** 🚀
