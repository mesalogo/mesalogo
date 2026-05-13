# 最简方案：纯数据库 + 线程池任务系统

## 一、为什么不需要 Redis？

### 1.1 数据库完全够用

**场景分析：**
- 任务提交频率：每分钟 10-100 个
- 任务状态查询：每秒 10-50 次
- 任务总量：每天几百到几千个

**数据库性能：**
- SQLite：每秒可处理 5万+ 读操作
- PostgreSQL：每秒可处理 10万+ 读操作
- 我们的需求：**远远低于数据库性能上限**

### 1.2 数据库的优势

| 特性 | Redis | 数据库 |
|------|-------|--------|
| 持久化 | 需要配置 AOF | ✅ 天然持久化 |
| 事务支持 | 有限 | ✅ 完整 ACID |
| 复杂查询 | 困难 | ✅ SQL 强大 |
| 数据一致性 | 需额外保证 | ✅ 外键约束 |
| 运维成本 | 需单独维护 | ✅ 已有数据库 |
| 数据统计 | 需编程实现 | ✅ SQL 聚合函数 |

### 1.3 最终架构

```
Flask API → TaskManager → SQLAlchemy → Database
           ↓
         ThreadPoolExecutor
         (在内存中执行任务)
```

**就这么简单！**

---

## 二、数据库表设计

### 2.1 任务表（Task）

```python
# backend/app/models.py (追加)

class Task(BaseMixin, db.Model):
    """异步任务表"""
    __tablename__ = 'tasks'
    
    # === 基础信息 ===
    task_type = Column(String(50), nullable=False, index=True)  # kb:vectorize_file
    status = Column(String(20), nullable=False, default='pending', index=True)
    # pending|running|completed|failed|cancelled|retrying
    
    # === 进度信息 ===
    progress = Column(Integer, default=0)  # 0-100
    message = Column(String(500))  # 当前状态描述
    
    # === 优先级 ===
    priority = Column(String(10), default='medium', index=True)  # high|medium|low
    
    # === 时间信息 ===
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # === 重试信息 ===
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # === 错误信息 ===
    error = Column(Text, nullable=True)  # 错误详情（JSON）
    
    # === 任务参数 ===
    params = Column(JSON, nullable=False)  # 任务参数
    
    # === 结果 ===
    result = Column(JSON, nullable=True)  # 任务结果
    
    # === 用户信息 ===
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    user = relationship("User", backref="tasks")
    
    # === 资源关联（可选，便于查询） ===
    knowledge_id = Column(String(36), ForeignKey('knowledges.id'), nullable=True, index=True)
    action_space_id = Column(String(36), ForeignKey('action_spaces.id'), nullable=True, index=True)
    conversation_id = Column(String(36), ForeignKey('conversations.id'), nullable=True, index=True)
    
    # === 索引 ===
    __table_args__ = (
        db.Index('idx_task_user_status', 'user_id', 'status'),
        db.Index('idx_task_type_status', 'task_type', 'status'),
        db.Index('idx_task_created_at', 'created_at'),
    )
    
    def to_dict(self):
        """转换为字典"""
        return {
            'task_id': self.id,
            'task_type': self.task_type,
            'status': self.status,
            'progress': self.progress,
            'message': self.message,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'error': self.error,
            'params': self.params,
            'result': self.result,
            'user_id': self.user_id,
        }
```

### 2.2 任务日志表（TaskLog）

```python
class TaskLog(BaseMixin, db.Model):
    """任务日志表（可选）"""
    __tablename__ = 'task_logs'
    
    task_id = Column(String(36), ForeignKey('tasks.id'), nullable=False, index=True)
    level = Column(String(10), nullable=False)  # INFO|WARNING|ERROR
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=get_current_time_with_timezone, index=True)
    
    task = relationship("Task", backref="logs")
    
    __table_args__ = (
        db.Index('idx_task_log_task_created', 'task_id', 'created_at'),
    )
```

### 2.3 数据库迁移

```bash
# 创建迁移
flask db migrate -m "添加任务表"

# 执行迁移
flask db upgrade
```

---

## 三、核心实现

### 3.1 任务管理器（数据库版）

```python
# backend/app/services/task_queue/task_manager.py

import logging
from typing import Dict, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from flask import current_app

from app.models import Task, TaskLog, db
from app.utils.datetime_utils import get_current_time_with_timezone

logger = logging.getLogger(__name__)


class TaskManager:
    """纯数据库版任务管理器"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self._executor = ThreadPoolExecutor(
            max_workers=10,
            thread_name_prefix="task_worker"
        )
        self._handlers = {}
        self._running_tasks = {}  # task_id -> Future
    
    def init_app(self, app):
        """初始化"""
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
        knowledge_id: str = None,
        action_space_id: str = None,
        conversation_id: str = None
    ) -> str:
        """
        提交任务
        
        Returns:
            task_id: 任务ID
        """
        # 1. 创建任务记录
        task = Task(
            task_type=task_type,
            status='pending',
            progress=0,
            message='等待执行',
            priority=priority,
            params=params,
            user_id=user_id,
            max_retries=max_retries,
            knowledge_id=knowledge_id,
            action_space_id=action_space_id,
            conversation_id=conversation_id
        )
        
        db.session.add(task)
        db.session.commit()
        
        task_id = task.id
        
        # 2. 记录日志
        self._log(task_id, "INFO", "任务已提交")
        
        # 3. 提交到线程池
        future = self._executor.submit(
            self._execute_task_wrapper,
            task_id,
            task_type,
            params,
            user_id
        )
        self._running_tasks[task_id] = future
        
        logger.info(f"任务已提交: {task_id} ({task_type})")
        return task_id
    
    def _execute_task_wrapper(self, task_id: str, task_type: str, params: Dict, user_id: str):
        """任务执行包装器（在线程中运行）"""
        with self.app.app_context():
            try:
                # 1. 更新状态为 running
                task = Task.query.get(task_id)
                if not task:
                    logger.error(f"任务不存在: {task_id}")
                    return
                
                # 检查是否已取消
                if task.status == 'cancelled':
                    logger.info(f"任务已取消: {task_id}")
                    return
                
                task.status = 'running'
                task.started_at = get_current_time_with_timezone()
                task.progress = 0
                task.message = '开始执行'
                db.session.commit()
                
                self._log(task_id, "INFO", "开始执行任务")
                
                # 2. 获取处理器
                handler = self._handlers.get(task_type)
                if not handler:
                    raise ValueError(f"未注册的任务类型: {task_type}")
                
                # 3. 执行任务
                context = {
                    "task_id": task_id,
                    "user_id": user_id,
                    "manager": self
                }
                
                result = handler(task_id, params, context)
                
                # 4. 标记完成
                task = Task.query.get(task_id)
                task.status = 'completed'
                task.progress = 100
                task.message = '任务完成'
                task.result = result
                task.completed_at = get_current_time_with_timezone()
                db.session.commit()
                
                self._log(task_id, "INFO", "任务执行成功")
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
        
        if task.retry_count < task.max_retries:
            # 重试
            task.retry_count += 1
            task.status = 'retrying'
            task.progress = 0
            task.message = f'重试 {task.retry_count}/{task.max_retries}'
            task.error = error_msg
            db.session.commit()
            
            self._log(task_id, "WARNING", f"任务失败，准备重试: {error_msg}")
            
            # 重新提交
            future = self._executor.submit(
                self._execute_task_wrapper,
                task_id,
                task.task_type,
                task.params,
                task.user_id
            )
            self._running_tasks[task_id] = future
        else:
            # 放弃
            task.status = 'failed'
            task.progress = 0
            task.message = '达到最大重试次数'
            task.error = error_msg
            task.completed_at = get_current_time_with_timezone()
            db.session.commit()
            
            self._log(task_id, "ERROR", f"任务最终失败: {error_msg}")
            logger.error(f"任务失败: {task_id} - {error_msg}")
    
    def update_progress(self, task_id: str, progress: int, message: str = ""):
        """更新任务进度（供任务处理器调用）"""
        task = Task.query.get(task_id)
        if task:
            task.progress = progress
            task.message = message
            db.session.commit()
            
            if message:
                self._log(task_id, "INFO", message)
    
    def _log(self, task_id: str, level: str, message: str):
        """记录任务日志"""
        log = TaskLog(
            task_id=task_id,
            level=level,
            message=message
        )
        db.session.add(log)
        db.session.commit()
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """查询任务状态"""
        task = Task.query.get(task_id)
        if not task:
            return None
        return task.to_dict()
    
    def get_task_logs(self, task_id: str, limit: int = 100) -> list:
        """获取任务日志"""
        logs = TaskLog.query.filter_by(task_id=task_id)\
            .order_by(TaskLog.created_at.desc())\
            .limit(limit)\
            .all()
        
        return [{
            'time': log.created_at.isoformat(),
            'level': log.level,
            'message': log.message
        } for log in logs]
    
    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = Task.query.get(task_id)
        if not task:
            return False
        
        if task.status in ['completed', 'failed']:
            return False
        
        task.status = 'cancelled'
        task.message = '用户取消'
        task.completed_at = get_current_time_with_timezone()
        db.session.commit()
        
        self._log(task_id, "WARNING", "任务已取消")
        
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
        knowledge_id: str = None,
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
        if knowledge_id:
            query = query.filter_by(knowledge_id=knowledge_id)
        
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

### 3.2 任务处理器（与之前相同）

```python
# backend/app/services/task_queue/handlers/knowledge_handlers.py

from app.models import KnowledgeFileChunk, db
from app.services.knowledge_base.knowledge_vectorizer import KnowledgeVectorizer

def handle_vectorize_file(task_id: str, params: dict, context: dict):
    """处理文件向量化任务"""
    manager = context["manager"]
    knowledge_id = params["knowledge_id"]
    file_path = params["file_path"]
    
    # 1. 读取分段
    manager.update_progress(task_id, 10, f"读取文件: {file_path}")
    
    chunks = KnowledgeFileChunk.query.filter_by(
        knowledge_id=knowledge_id,
        file_path=file_path
    ).all()
    
    if not chunks:
        raise ValueError(f"文件 {file_path} 没有分段数据")
    
    total = len(chunks)
    manager.update_progress(task_id, 20, f"共 {total} 个分段")
    
    # 2. 向量化（批量处理）
    vectorizer = KnowledgeVectorizer()
    batch_size = 10
    
    for i in range(0, total, batch_size):
        # 检查是否被取消
        from app.models import Task
        task = Task.query.get(task_id)
        if task.status == 'cancelled':
            raise Exception("任务已取消")
        
        batch = chunks[i:i+batch_size]
        texts = [chunk.content for chunk in batch]
        
        # 生成向量
        success, embeddings, meta_info = vectorizer.embedding_service.generate_embeddings(texts)
        if not success:
            raise Exception(f"向量生成失败: {embeddings}")
        
        # 存储到向量数据库
        # ... 存储逻辑 ...
        
        # 更新进度
        progress = 20 + int(70 * (i + batch_size) / total)
        manager.update_progress(task_id, progress, f"向量化进度 {min(i+batch_size, total)}/{total}")
    
    # 3. 完成
    manager.update_progress(task_id, 100, "向量化完成")
    
    return {
        "success": True,
        "total_chunks": total,
        "vector_dimension": meta_info.get("vector_dimension")
    }
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
        knowledge_id=data.get('knowledge_id'),
        action_space_id=data.get('action_space_id'),
        conversation_id=data.get('conversation_id')
    )
    
    return jsonify({"task_id": task_id}), 201


@tasks_bp.route('/tasks/<task_id>', methods=['GET'])
@login_required
def get_task(current_user, task_id):
    """查询任务"""
    status = task_manager.get_task_status(task_id)
    if not status:
        return jsonify({"error": "任务不存在"}), 404
    
    # 权限检查
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
        knowledge_id=request.args.get('knowledge_id'),
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


@tasks_bp.route('/tasks/stats', methods=['GET'])
@login_required
def get_stats(current_user):
    """获取任务统计"""
    stats = task_manager.get_stats(user_id=current_user.id)
    return jsonify(stats)
```

---

## 四、性能优化技巧

### 4.1 数据库索引（已在模型中定义）

```python
# 复合索引，加速常见查询
db.Index('idx_task_user_status', 'user_id', 'status')
db.Index('idx_task_type_status', 'task_type', 'status')
db.Index('idx_task_created_at', 'created_at')
```

### 4.2 定期清理旧任务（可选）

```python
# backend/app/services/task_queue/maintenance.py

from datetime import datetime, timedelta
from app.models import Task, TaskLog, db

def cleanup_old_tasks(days: int = 30):
    """清理 N 天前的已完成/失败任务"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # 删除旧任务
    old_tasks = Task.query.filter(
        Task.completed_at < cutoff_date,
        Task.status.in_(['completed', 'failed', 'cancelled'])
    ).all()
    
    for task in old_tasks:
        # 先删除日志
        TaskLog.query.filter_by(task_id=task.id).delete()
        db.session.delete(task)
    
    db.session.commit()
    return len(old_tasks)

# 可以通过定时任务或管理接口调用
```

---

## 五、完整对比

| 方案 | Worker版 | 简化版(Redis) | **纯数据库版** |
|------|----------|--------------|--------------|
| 部署复杂度 | 高 | 中 | ✅ **低** |
| 依赖服务 | Redis + Worker | Redis | ✅ **仅数据库** |
| 代码量 | 1500行 | 800行 | ✅ **500行** |
| 数据持久化 | 需配置 | 需配置 | ✅ **天然持久化** |
| 复杂查询 | 困难 | 困难 | ✅ **SQL轻松** |
| 运维成本 | 高 | 中 | ✅ **低** |
| 适用规模 | 大型 | 中型 | ✅ **中小型** |

---

## 六、实施步骤

### Phase 1: 数据库模型（0.5天）
- [ ] 创建 `Task` 和 `TaskLog` 模型
- [ ] 数据库迁移
- [ ] 基础 CRUD 测试

### Phase 2: TaskManager（0.5天）
- [ ] 实现 `TaskManager` 核心逻辑
- [ ] 注册机制
- [ ] 单元测试

### Phase 3: 知识库任务（1天）
- [ ] 实现文件向量化处理器
- [ ] 改造现有 API
- [ ] 前端集成

### Phase 4: 其他任务（按需）
- [ ] 变量同步任务
- [ ] 导入导出任务
- [ ] 维护任务

**总计：2-3天即可完成！**

---

## 七、总结

### 核心优势

1. **极简部署**
   ```bash
   # 只需要这一行
   python run_app.py
   ```

2. **零额外依赖**
   - 不需要 Redis
   - 不需要 Worker 进程
   - 不需要 Supervisor/systemd

3. **数据一致性**
   - 任务数据和业务数据在同一个数据库
   - 可以用外键关联
   - 可以用事务保证一致性

4. **查询方便**
   ```python
   # 查询某知识库的所有向量化任务
   Task.query.filter_by(
       knowledge_id='kb_123',
       task_type='kb:vectorize_file'
   ).all()
   
   # 统计今天完成的任务
   Task.query.filter(
       Task.completed_at >= today,
       Task.status == 'completed'
   ).count()
   ```

5. **开发友好**
   - SQLAlchemy ORM，类型提示
   - 可以用 Flask-Admin 直接管理
   - 断点调试无障碍

### 这就是你需要的最简方案！🎉

要不要开始实施？
