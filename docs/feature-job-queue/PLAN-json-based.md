# 极简 JSON 化任务系统设计

## 一、核心思想

### 1.1 设计原则

**最小字段 + JSON 存储**
- 只保留必须索引查询的字段（5个）
- 其他所有数据都放在一个 `data` JSON 字段
- 表结构干净，扩展不需要改表

### 1.2 架构

```
数据库表（极简）
├── id               # 主键
├── task_type        # 任务类型（索引）
├── status           # 状态（索引）
├── user_id          # 用户（索引 + 外键）
├── created_at       # 创建时间（索引）
└── data             # JSON 字段（所有其他数据）
```

---

## 二、数据库表设计

### 2.1 任务表（Task）

```python
# backend/app/models.py (追加)

class Task(BaseMixin, db.Model):
    """异步任务表（JSON 化）"""
    __tablename__ = 'tasks'
    
    # === 必须的索引字段（用于查询） ===
    task_type = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default='pending', index=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    
    # === JSON 数据字段（包含所有其他信息） ===
    data = Column(JSON, nullable=False, default=dict)
    
    # === 关系 ===
    user = relationship("User", backref="tasks")
    
    # === 索引 ===
    __table_args__ = (
        db.Index('idx_task_user_status', 'user_id', 'status'),
        db.Index('idx_task_type_status', 'task_type', 'status'),
        db.Index('idx_task_created_at', 'created_at'),
    )
    
    def to_dict(self):
        """转换为字典"""
        result = {
            'task_id': self.id,
            'task_type': self.task_type,
            'status': self.status,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        # 合并 data 字段
        result.update(self.data or {})
        return result
    
    @property
    def progress(self):
        """便捷属性：进度"""
        return self.data.get('progress', 0)
    
    @property
    def message(self):
        """便捷属性：消息"""
        return self.data.get('message', '')
    
    @property
    def params(self):
        """便捷属性：参数"""
        return self.data.get('params', {})
    
    @property
    def result(self):
        """便捷属性：结果"""
        return self.data.get('result')
    
    @property
    def error(self):
        """便捷属性：错误"""
        return self.data.get('error')
```

### 2.2 data 字段结构（标准格式）

```json
{
  // === 进度信息 ===
  "progress": 45,
  "message": "向量化进度 25/50",
  
  // === 优先级 ===
  "priority": "high",
  
  // === 时间信息 ===
  "started_at": "2024-11-07T10:00:00Z",
  "completed_at": null,
  
  // === 重试信息 ===
  "retry_count": 0,
  "max_retries": 3,
  
  // === 错误信息 ===
  "error": null,
  
  // === 任务参数（根据 task_type 不同而不同） ===
  "params": {
    "knowledge_id": "kb_123",
    "file_path": "docs/manual.pdf",
    "embedding_model_id": 5
  },
  
  // === 任务结果 ===
  "result": {
    "success": true,
    "total_chunks": 50,
    "vector_dimension": 768
  },
  
  // === 资源关联（可选，用于前端跳转） ===
  "resources": {
    "knowledge_id": "kb_123",
    "action_space_id": null,
    "conversation_id": null
  },
  
  // === 日志（可选，最近几条） ===
  "logs": [
    {"time": "2024-11-07T10:00:05", "level": "INFO", "message": "开始执行"},
    {"time": "2024-11-07T10:00:10", "level": "INFO", "message": "读取分段完成"}
  ],
  
  // === 其他元数据 ===
  "metadata": {
    "source": "api",
    "tags": ["urgent", "knowledge_base"]
  }
}
```

### 2.3 不同任务类型的 data.params 示例

#### 知识库向量化
```json
{
  "params": {
    "knowledge_id": "kb_123",
    "file_path": "docs/manual.pdf",
    "embedding_model_id": 5,
    "chunk_method": "chonkie"
  }
}
```

#### 批量向量化
```json
{
  "params": {
    "knowledge_id": "kb_123",
    "file_paths": ["doc1.pdf", "doc2.txt"],
    "embedding_model_id": 5
  }
}
```

#### 变量同步
```json
{
  "params": {
    "variable_id": "var_789",
    "variable_name": "weather_data",
    "sync_url": "https://api.weather.com/current"
  }
}
```

#### 导出行动空间
```json
{
  "params": {
    "action_space_id": "space_001",
    "export_format": "json",
    "include_conversations": true
  }
}
```

---

## 三、核心代码实现

### 3.1 任务管理器（JSON 版）

```python
# backend/app/services/task_queue/task_manager.py

import logging
from typing import Dict, Any, Optional, Callable, List
from concurrent.futures import ThreadPoolExecutor
from flask import current_app

from app.models import Task, db
from app.utils.datetime_utils import get_current_time_with_timezone

logger = logging.getLogger(__name__)


class TaskManager:
    """极简 JSON 化任务管理器"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self._executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="task")
        self._handlers = {}
        self._running_tasks = {}
    
    def init_app(self, app):
        self.app = app
    
    def register_handler(self, task_type: str, handler_func: Callable):
        """注册任务处理器"""
        self._handlers[task_type] = handler_func
        logger.info(f"注册任务处理器: {task_type}")
    
    def submit_task(
        self,
        task_type: str,
        params: Dict[str, Any],
        user_id: str,
        priority: str = "medium",
        max_retries: int = 3,
        resources: Dict[str, str] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        提交任务
        
        Args:
            task_type: 任务类型，如 "kb:vectorize_file"
            params: 任务参数（根据类型不同而不同）
            user_id: 用户ID
            priority: 优先级 high|medium|low
            max_retries: 最大重试次数
            resources: 资源关联 {"knowledge_id": "...", "action_space_id": "..."}
            metadata: 额外元数据
        
        Returns:
            task_id: 任务ID
        """
        # 构建 data 字段
        data = {
            "priority": priority,
            "progress": 0,
            "message": "等待执行",
            "started_at": None,
            "completed_at": None,
            "retry_count": 0,
            "max_retries": max_retries,
            "error": None,
            "params": params,
            "result": None,
            "resources": resources or {},
            "logs": [],
            "metadata": metadata or {}
        }
        
        # 创建任务
        task = Task(
            task_type=task_type,
            status='pending',
            user_id=user_id,
            data=data
        )
        
        db.session.add(task)
        db.session.commit()
        
        task_id = task.id
        
        # 记录日志
        self._add_log(task_id, "INFO", "任务已提交")
        
        # 提交到线程池
        future = self._executor.submit(
            self._execute_task_wrapper,
            task_id
        )
        self._running_tasks[task_id] = future
        
        logger.info(f"任务已提交: {task_id} ({task_type})")
        return task_id
    
    def _execute_task_wrapper(self, task_id: str):
        """任务执行包装器（在线程中运行）"""
        with self.app.app_context():
            try:
                task = Task.query.get(task_id)
                if not task:
                    logger.error(f"任务不存在: {task_id}")
                    return
                
                # 检查是否已取消
                if task.status == 'cancelled':
                    logger.info(f"任务已取消: {task_id}")
                    return
                
                # 更新状态为 running
                task.status = 'running'
                task.data['started_at'] = get_current_time_with_timezone().isoformat()
                task.data['progress'] = 0
                task.data['message'] = '开始执行'
                db.session.commit()
                
                self._add_log(task_id, "INFO", "开始执行任务")
                
                # 获取处理器
                handler = self._handlers.get(task.task_type)
                if not handler:
                    raise ValueError(f"未注册的任务类型: {task.task_type}")
                
                # 执行任务
                context = {
                    "task_id": task_id,
                    "user_id": task.user_id,
                    "manager": self
                }
                
                result = handler(task_id, task.data['params'], context)
                
                # 标记完成
                task = Task.query.get(task_id)
                task.status = 'completed'
                task.data['progress'] = 100
                task.data['message'] = '任务完成'
                task.data['result'] = result
                task.data['completed_at'] = get_current_time_with_timezone().isoformat()
                db.session.commit()
                
                self._add_log(task_id, "INFO", "任务执行成功")
                logger.info(f"任务完成: {task_id}")
                
            except Exception as e:
                logger.exception(f"任务执行失败: {task_id}")
                self._handle_task_error(task_id, str(e))
            
            finally:
                self._running_tasks.pop(task_id, None)
    
    def _handle_task_error(self, task_id: str, error_msg: str):
        """处理任务错误"""
        task = Task.query.get(task_id)
        if not task:
            return
        
        retry_count = task.data.get('retry_count', 0)
        max_retries = task.data.get('max_retries', 3)
        
        if retry_count < max_retries:
            # 重试
            task.data['retry_count'] = retry_count + 1
            task.status = 'retrying'
            task.data['progress'] = 0
            task.data['message'] = f'重试 {retry_count + 1}/{max_retries}'
            task.data['error'] = error_msg
            db.session.commit()
            
            self._add_log(task_id, "WARNING", f"任务失败，准备重试: {error_msg}")
            
            # 重新提交
            future = self._executor.submit(self._execute_task_wrapper, task_id)
            self._running_tasks[task_id] = future
        else:
            # 放弃
            task.status = 'failed'
            task.data['progress'] = 0
            task.data['message'] = '达到最大重试次数'
            task.data['error'] = error_msg
            task.data['completed_at'] = get_current_time_with_timezone().isoformat()
            db.session.commit()
            
            self._add_log(task_id, "ERROR", f"任务最终失败: {error_msg}")
    
    def update_progress(self, task_id: str, progress: int, message: str = ""):
        """更新任务进度（供任务处理器调用）"""
        task = Task.query.get(task_id)
        if task:
            task.data['progress'] = progress
            if message:
                task.data['message'] = message
            db.session.commit()
            
            if message:
                self._add_log(task_id, "INFO", message)
    
    def _add_log(self, task_id: str, level: str, message: str):
        """添加日志到 data.logs（保留最近 20 条）"""
        task = Task.query.get(task_id)
        if not task:
            return
        
        log_entry = {
            "time": get_current_time_with_timezone().isoformat(),
            "level": level,
            "message": message
        }
        
        logs = task.data.get('logs', [])
        logs.insert(0, log_entry)  # 新日志在前
        task.data['logs'] = logs[:20]  # 只保留最近 20 条
        
        db.session.commit()
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """查询任务状态"""
        task = Task.query.get(task_id)
        if not task:
            return None
        return task.to_dict()
    
    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = Task.query.get(task_id)
        if not task or task.status in ['completed', 'failed']:
            return False
        
        task.status = 'cancelled'
        task.data['message'] = '用户取消'
        task.data['completed_at'] = get_current_time_with_timezone().isoformat()
        db.session.commit()
        
        self._add_log(task_id, "WARNING", "任务已取消")
        
        # 尝试取消 Future
        future = self._running_tasks.get(task_id)
        if future:
            future.cancel()
        
        return True
    
    def list_tasks(
        self,
        user_id: str = None,
        task_type: str = None,
        status: str = None,
        offset: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """查询任务列表"""
        query = Task.query
        
        if user_id:
            query = query.filter_by(user_id=user_id)
        if task_type:
            query = query.filter_by(task_type=task_type)
        if status:
            query = query.filter_by(status=status)
        
        total = query.count()
        tasks = query.order_by(Task.created_at.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        return {
            'tasks': [task.to_dict() for task in tasks],
            'total': total,
            'offset': offset,
            'limit': limit
        }
    
    def get_stats(self, user_id: str = None) -> Dict[str, Any]:
        """获取任务统计"""
        query = Task.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        return {
            'total': query.count(),
            'pending': query.filter_by(status='pending').count(),
            'running': query.filter_by(status='running').count(),
            'completed': query.filter_by(status='completed').count(),
            'failed': query.filter_by(status='failed').count(),
        }
    
    def shutdown(self):
        """关闭线程池"""
        logger.info("正在关闭任务管理器...")
        self._executor.shutdown(wait=True)
        logger.info("任务管理器已关闭")


# 全局单例
task_manager = TaskManager()
```

### 3.2 PostgreSQL JSON 查询示例（高级用法）

```python
# 如果使用 PostgreSQL，可以直接查询 JSON 字段

# 查询特定知识库的任务
from sqlalchemy import func

tasks = Task.query.filter(
    func.json_extract_path_text(Task.data, 'resources', 'knowledge_id') == 'kb_123'
).all()

# 查询高优先级任务
tasks = Task.query.filter(
    func.json_extract_path_text(Task.data, 'priority') == 'high'
).all()

# 查询进度大于 50% 的任务
tasks = Task.query.filter(
    func.cast(
        func.json_extract_path_text(Task.data, 'progress'),
        db.Integer
    ) > 50
).all()
```

### 3.3 API 路由（简化）

```python
# backend/app/api/routes/tasks.py

from flask import Blueprint, request, jsonify
from app.services.task_queue import task_manager
from app.api.decorators import login_required

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/tasks', methods=['POST'])
@login_required
def submit_task(current_user):
    """提交任务"""
    data = request.get_json()
    
    task_id = task_manager.submit_task(
        task_type=data['task_type'],
        params=data.get('params', {}),
        user_id=current_user.id,
        priority=data.get('priority', 'medium'),
        resources=data.get('resources'),
        metadata=data.get('metadata')
    )
    
    return jsonify({"task_id": task_id}), 201


@tasks_bp.route('/tasks/<task_id>', methods=['GET'])
@login_required
def get_task(current_user, task_id):
    """查询任务"""
    status = task_manager.get_task_status(task_id)
    if not status:
        return jsonify({"error": "任务不存在"}), 404
    
    if status["user_id"] != current_user.id:
        return jsonify({"error": "无权访问"}), 403
    
    return jsonify(status)


@tasks_bp.route('/tasks', methods=['GET'])
@login_required
def list_tasks(current_user):
    """查询任务列表"""
    result = task_manager.list_tasks(
        user_id=current_user.id,
        task_type=request.args.get('task_type'),
        status=request.args.get('status'),
        offset=int(request.args.get('offset', 0)),
        limit=int(request.args.get('limit', 20))
    )
    return jsonify(result)


@tasks_bp.route('/tasks/<task_id>/cancel', methods=['POST'])
@login_required
def cancel_task(current_user, task_id):
    """取消任务"""
    status = task_manager.get_task_status(task_id)
    if not status or status["user_id"] != current_user.id:
        return jsonify({"error": "无权操作"}), 403
    
    success = task_manager.cancel_task(task_id)
    return jsonify({"success": success})
```

---

## 四、使用示例

### 4.1 提交任务（后端）

```python
# 知识库向量化
task_id = task_manager.submit_task(
    task_type="kb:vectorize_file",
    params={
        "knowledge_id": "kb_123",
        "file_path": "docs/manual.pdf",
        "embedding_model_id": 5
    },
    user_id=current_user.id,
    priority="high",
    resources={
        "knowledge_id": "kb_123"
    },
    metadata={
        "source": "api",
        "tags": ["urgent"]
    }
)
```

### 4.2 查询任务（前端）

```javascript
// 查询任务状态
const response = await api.get(`/api/tasks/${taskId}`);
console.log(response.data);

// 返回数据示例：
{
  "task_id": "task_abc123",
  "task_type": "kb:vectorize_file",
  "status": "running",
  "user_id": "user_xyz",
  "created_at": "2024-11-07T10:00:00Z",
  
  // data 字段的内容会自动展开
  "priority": "high",
  "progress": 45,
  "message": "向量化进度 25/50",
  "started_at": "2024-11-07T10:00:05Z",
  "completed_at": null,
  "retry_count": 0,
  "max_retries": 3,
  "error": null,
  
  "params": {
    "knowledge_id": "kb_123",
    "file_path": "docs/manual.pdf",
    "embedding_model_id": 5
  },
  
  "result": null,
  
  "resources": {
    "knowledge_id": "kb_123"
  },
  
  "logs": [
    {"time": "2024-11-07T10:00:05", "level": "INFO", "message": "开始执行"},
    {"time": "2024-11-07T10:00:10", "level": "INFO", "message": "读取分段完成"}
  ],
  
  "metadata": {
    "source": "api",
    "tags": ["urgent"]
  }
}
```

---

## 五、对比总结

### 5.1 字段数量对比

| 方案 | 表字段数 | JSON 灵活性 |
|------|---------|-----------|
| 复杂版 | 20+ 个字段 | ❌ 不灵活 |
| **JSON 版** | **5 个字段** | ✅ **非常灵活** |

### 5.2 扩展性对比

**复杂版（需要改表）：**
```sql
-- 添加新字段需要改表结构
ALTER TABLE tasks ADD COLUMN estimated_duration INT;
ALTER TABLE tasks ADD COLUMN worker_id VARCHAR(50);
```

**JSON 版（不需要改表）：**
```python
# 直接在 data 中添加新字段
task.data['estimated_duration'] = 120
task.data['worker_id'] = 'worker-01'
db.session.commit()
```

### 5.3 表结构清晰度

**复杂版（20+ 字段）：**
```
tasks
├── id
├── task_type
├── status
├── progress
├── message
├── priority
├── created_at
├── started_at
├── completed_at
├── retry_count
├── max_retries
├── error
├── user_id
├── knowledge_id
├── action_space_id
├── conversation_id
├── params (JSON)
├── result (JSON)
├── metadata (JSON)
└── ... (还有更多)
```

**JSON 版（5 字段）：**
```
tasks
├── id
├── task_type
├── status
├── user_id
├── created_at
└── data (JSON - 包含所有其他数据)
```

---

## 六、优势总结

✅ **表结构极简**：只有 5 个字段  
✅ **扩展无需改表**：新字段直接加到 JSON  
✅ **代码更清晰**：少了一堆 getter/setter  
✅ **查询仍然高效**：索引字段（task_type, status, user_id）都保留了  
✅ **JSON 原生支持**：PostgreSQL/MySQL 都支持 JSON 查询和索引  

**这就是你想要的极简设计！** 🎉

要不要开始实施？
