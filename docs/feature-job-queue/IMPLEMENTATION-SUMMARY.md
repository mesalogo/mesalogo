# 知识库任务队列实现总结（KISS 版本）

## 已完成的后端实现

### 1. 数据库模型（`app/models.py`）
```python
class Task(BaseMixin, db.Model):
    task_type = Column(String(50), index=True)  # 任务类型
    status = Column(String(20), index=True)      # 状态
    user_id = Column(String(36), ForeignKey('users.id'), index=True)
    data = Column(JSON)  # JSON 字段，包含所有其他数据
```

### 2. TaskManager（`app/services/task_queue/task_manager.py`）
- ✅ 线程池执行（无需 Worker 进程）
- ✅ 提交任务：`submit_task()`
- ✅ 查询状态：`get_task_status()`
- ✅ 更新进度：`update_progress()`
- ✅ 取消任务：`cancel_task()`
- ✅ 任务列表：`list_tasks()`

### 3. 知识库任务处理器（`app/services/task_queue/handlers/knowledge_handlers.py`）
- ✅ `handle_vectorize_file`：单文件向量化
- ✅ `handle_batch_vectorize`：批量向量化

### 4. API 路由（`app/api/routes/tasks.py`）
- ✅ `POST /api/tasks` - 提交任务
- ✅ `GET /api/tasks/{task_id}` - 查询任务状态
- ✅ `GET /api/tasks` - 任务列表
- ✅ `POST /api/tasks/{task_id}/cancel` - 取消任务
- ✅ `GET /api/tasks/stats` - 任务统计

---

## 部署步骤

### 1. 创建数据库表
```bash
cd backend
python create_task_table.py
```

### 2. 启动应用
```bash
python run_app.py
```

TaskManager 会自动初始化并注册处理器。

---

## API 使用示例

### 1. 提交向量化任务
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

# 返回
{
  "task_id": "task_abc123",
  "status": "pending",
  "message": "任务已提交"
}
```

### 2. 查询任务进度
```bash
curl http://localhost:5000/api/tasks/task_abc123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 返回
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
  "result": null,
  "logs": [
    {"time": "2024-11-07T10:00:05", "level": "INFO", "message": "开始执行"},
    {"time": "2024-11-07T10:00:10", "level": "INFO", "message": "读取分段完成"}
  ]
}
```

### 3. 取消任务
```bash
curl -X POST http://localhost:5000/api/tasks/task_abc123/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"

# 返回
{
  "success": true
}
```

---

## 前端集成（简化版）

### 1. API 封装（`frontend/src/services/api/tasks.js`）
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

  // 查询任务状态
  getTaskStatus: async (taskId) => {
    const res = await axios.get(`/api/tasks/${taskId}`);
    return res.data;
  },

  // 取消任务
  cancelTask: async (taskId) => {
    const res = await axios.post(`/api/tasks/${taskId}/cancel`);
    return res.data;
  }
};
```

### 2. 在知识库页面使用
```javascript
// 提交任务
const handleVectorize = async (document) => {
  try {
    const result = await tasksAPI.submitTask(
      'kb:vectorize_file',
      {
        knowledge_id: knowledgeId,
        file_path: document.file_path
      },
      'high'
    );
    
    const taskId = result.task_id;
    
    // 轮询进度
    const interval = setInterval(async () => {
      const status = await tasksAPI.getTaskStatus(taskId);
      
      // 更新进度条
      setProgress(status.progress);
      setMessage(status.message);
      
      // 检查是否完成
      if (status.status === 'completed') {
        clearInterval(interval);
        message.success('向量化完成！');
      } else if (status.status === 'failed') {
        clearInterval(interval);
        message.error('向量化失败：' + status.error);
      }
    }, 2000);  // 每 2 秒查询一次
    
  } catch (error) {
    message.error('提交任务失败');
  }
};
```

### 3. 简单的进度显示（Ant Design）
```jsx
import { Progress, Tag, Space } from 'antd';

const TaskProgress = ({ taskId }) => {
  const [task, setTask] = useState(null);
  
  useEffect(() => {
    if (!taskId) return;
    
    const fetchStatus = async () => {
      const status = await tasksAPI.getTaskStatus(taskId);
      setTask(status);
      
      // 如果任务结束，停止轮询
      if (status.status === 'completed' || status.status === 'failed') {
        clearInterval(interval);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    
    return () => clearInterval(interval);
  }, [taskId]);
  
  if (!task) return <div>加载中...</div>;
  
  return (
    <div>
      <Space>
        <Tag color={task.status === 'completed' ? 'success' : 'processing'}>
          {task.status}
        </Tag>
        <span>{task.message}</span>
      </Space>
      
      <Progress 
        percent={task.progress} 
        status={task.status === 'completed' ? 'success' : 'active'}
      />
      
      {task.status === 'failed' && (
        <div style={{ color: 'red' }}>{task.error}</div>
      )}
    </div>
  );
};
```

---

## 改造现有知识库 API（示例）

### 修改 `/api/knowledges/{kb_id}/documents/{doc_id}/vectorize` 为异步

```python
# backend/app/api/routes/knowledge.py

from app.services.task_queue import task_manager

@knowledge_bp.route('/knowledges/<knowledge_id>/documents/<document_id>/vectorize', methods=['POST'])
@login_required
def vectorize_file_async(current_user, knowledge_id, document_id):
    """
    异步向量化文件
    
    返回 202 Accepted 和 task_id
    """
    try:
        # 验证知识库和文档
        knowledge = Knowledge.query.get(knowledge_id)
        if not knowledge:
            return jsonify({"error": "知识库不存在"}), 404
        
        document = KnowledgeDocument.query.get(document_id)
        if not document or document.knowledge_id != knowledge_id:
            return jsonify({"error": "文档不存在"}), 404
        
        # 提交任务
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
            'message': '向量化任务已提交，请通过 /api/tasks/{task_id} 查询进度'
        }), 202  # 202 Accepted
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

---

## 核心优势

✅ **部署简单**：只需启动 Flask，无需 Worker 进程  
✅ **代码简洁**：500 行核心代码，易于维护  
✅ **数据库驱动**：所有状态持久化，重启不丢失  
✅ **JSON 灵活**：扩展无需改表结构  
✅ **线程并发**：支持 10 个并发任务  

---

## 后续扩展（可选）

1. **前端完整组件**：进度弹窗、任务中心页面、全局通知
2. **更多任务类型**：变量同步、图增强、导入导出
3. **任务优先级队列**：高优先级任务优先执行
4. **任务依赖**：任务 B 依赖任务 A 完成
5. **定时清理**：自动清理 30 天前的已完成任务

---

## 测试清单

- [ ] 创建数据库表
- [ ] 启动应用，验证 TaskManager 初始化
- [ ] 提交向量化任务
- [ ] 查询任务进度
- [ ] 取消运行中的任务
- [ ] 查看任务日志
- [ ] 查看任务统计

---

**实现完成！** 🎉

下一步：
1. 运行 `python create_task_table.py` 创建表
2. 启动应用测试 API
3. 前端集成（可以先用 Postman 测试）
