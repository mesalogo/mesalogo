# 简化版任务队列系统设计（无需 Worker）

## 一、核心思路：应用内线程池

### 1.1 架构对比

**复杂版（不推荐）：**
```
Flask API → Redis Queue → Worker进程 → 执行任务
(需要单独启动Worker，运维复杂)
```

**简化版（推荐）：**
```
Flask API → ThreadPoolExecutor → 执行任务
           ↓
         Redis (仅存储状态和进度)
```

### 1.2 优势
- ✅ **部署简单**：只需启动 Flask，无需管理 Worker 进程
- ✅ **代码简单**：所有逻辑在一个应用内，便于调试
- ✅ **资源高效**：线程复用，不需要多进程开销
- ✅ **足够用**：对于中小型项目（每天几百到几千个任务）完全够用

### 1.3 适用场景
- ✅ 单服务器部署
- ✅ 任务耗时：几秒到几分钟
- ✅ 并发任务：10-50个
- ❌ 不适合：超大规模（每秒数百任务）、超长任务（几小时）

---

## 二、简化设计

### 2.1 核心组件

```python
# 1. 任务管理器（单例）
TaskManager
├── submit_task()      # 提交任务
├── get_task_status()  # 查询状态
├── cancel_task()      # 取消任务
└── _executor          # ThreadPoolExecutor实例

# 2. 任务存储（Redis）
task:meta:{task_id}    # 任务元数据（Hash）
task:log:{task_id}     # 任务日志（List）

# 3. 任务处理器（注册式）
@task_handler("kb:vectorize_file")
def handle_vectorize_file(task_id, params, context):
    # 执行向量化逻辑
    pass
```

### 2.2 工作流程

```
1. 用户提交任务
   POST /api/tasks
   {
     "task_type": "kb:vectorize_file",
     "params": {...}
   }
   
2. TaskManager 处理
   - 生成 task_id
   - 存储到 Redis (status=pending)
   - 提交到线程池执行
   - 立即返回 task_id
   
3. 后台线程执行
   - 更新状态为 running
   - 执行任务逻辑
   - 定期更新进度
   - 完成后更新状态为 completed
   
4. 前端查询进度
   GET /api/tasks/{task_id}
   或
   SSE: /api/tasks/{task_id}/stream
```

---

## 三、核心代码实现

### 3.1 任务管理器（简化版）

```python
# backend/app/services/task_queue/task_manager.py

import uuid
import time
import json
import logging
from typing import Dict, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor, Future
from flask import current_app

logger = logging.getLogger(__name__)

class TaskManager:
    """简化版任务管理器（应用内线程池）"""
    
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
            max_workers=10,  # 最多10个并发任务
            thread_name_prefix="task_worker"
        )
        self._handlers = {}  # task_type -> handler_func
        self._running_tasks = {}  # task_id -> Future
        
        # Redis 客户端（从应用配置获取）
        self.redis = None
    
    def init_app(self, app):
        """初始化（在Flask应用启动时调用）"""
        self.app = app
        # 获取 Redis 客户端
        from app.services.task_queue.redis_client import get_redis
        self.redis = get_redis()
    
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
        metadata: Optional[Dict] = None
    ) -> str:
        """
        提交任务到线程池
        
        Returns:
            task_id: 任务ID
        """
        # 1. 生成任务ID
        task_id = f"task_{uuid.uuid4().hex}"
        
        # 2. 构建任务数据
        task_data = {
            "task_id": task_id,
            "task_type": task_type,
            "status": "pending",
            "progress": 0,
            "message": "等待执行",
            "priority": priority,
            "created_at": time.time(),
            "started_at": None,
            "completed_at": None,
            "retry_count": 0,
            "max_retries": max_retries,
            "error": None,
            "user_id": user_id,
            "result": None,
            "params": json.dumps(params),
            "metadata": json.dumps(metadata or {})
        }
        
        # 3. 存储到 Redis
        self.redis.hset(f"task:meta:{task_id}", mapping=task_data)
        
        # 4. 提交到线程池
        future = self._executor.submit(
            self._execute_task_wrapper,
            task_id,
            task_type,
            params,
            user_id
        )
        self._running_tasks[task_id] = future
        
        # 5. 记录日志
        self._log(task_id, "INFO", "任务已提交")
        
        logger.info(f"任务已提交: {task_id} ({task_type})")
        return task_id
    
    def _execute_task_wrapper(self, task_id: str, task_type: str, params: Dict, user_id: str):
        """任务执行包装器（在线程中运行）"""
        # 需要 Flask 应用上下文
        with self.app.app_context():
            try:
                # 更新状态为 running
                self._update_status(task_id, "running", 0, "开始执行")
                self._log(task_id, "INFO", "开始执行任务")
                
                # 获取处理器
                handler = self._handlers.get(task_type)
                if not handler:
                    raise ValueError(f"未注册的任务类型: {task_type}")
                
                # 准备上下文
                context = {
                    "task_id": task_id,
                    "user_id": user_id,
                    "manager": self  # 传递自己，便于更新进度
                }
                
                # 执行任务
                result = handler(task_id, params, context)
                
                # 标记完成
                self._update_status(task_id, "completed", 100, "任务完成")
                self.redis.hset(f"task:meta:{task_id}", "result", json.dumps(result))
                self.redis.hset(f"task:meta:{task_id}", "completed_at", time.time())
                self._log(task_id, "INFO", "任务执行成功")
                
            except Exception as e:
                logger.exception(f"任务执行失败: {task_id}")
                self._handle_task_error(task_id, str(e))
            
            finally:
                # 清理
                self._running_tasks.pop(task_id, None)
    
    def _handle_task_error(self, task_id: str, error_msg: str):
        """处理任务错误"""
        task_meta = self.redis.hgetall(f"task:meta:{task_id}")
        retry_count = int(task_meta.get(b"retry_count", 0))
        max_retries = int(task_meta.get(b"max_retries", 3))
        
        if retry_count < max_retries:
            # 重试
            self.redis.hincrby(f"task:meta:{task_id}", "retry_count", 1)
            self._update_status(task_id, "retrying", 0, f"重试 {retry_count + 1}/{max_retries}")
            self._log(task_id, "WARNING", f"任务失败，准备重试: {error_msg}")
            
            # 重新提交（简化：直接再次执行）
            task_type = task_meta[b"task_type"].decode()
            params = json.loads(task_meta[b"params"])
            user_id = task_meta[b"user_id"].decode()
            
            future = self._executor.submit(
                self._execute_task_wrapper,
                task_id, task_type, params, user_id
            )
            self._running_tasks[task_id] = future
        else:
            # 放弃
            self._update_status(task_id, "failed", 0, "达到最大重试次数")
            self.redis.hset(f"task:meta:{task_id}", "error", error_msg)
            self._log(task_id, "ERROR", f"任务最终失败: {error_msg}")
    
    def _update_status(self, task_id: str, status: str, progress: int, message: str):
        """更新任务状态"""
        updates = {
            "status": status,
            "progress": progress,
            "message": message
        }
        if status == "running" and not self.redis.hexists(f"task:meta:{task_id}", "started_at"):
            updates["started_at"] = time.time()
        
        self.redis.hset(f"task:meta:{task_id}", mapping=updates)
    
    def update_progress(self, task_id: str, progress: int, message: str = ""):
        """更新任务进度（供任务处理器调用）"""
        self._update_status(task_id, "running", progress, message)
        self._log(task_id, "INFO", message)
    
    def _log(self, task_id: str, level: str, message: str):
        """记录任务日志"""
        log_entry = f"{time.strftime('%Y-%m-%d %H:%M:%S')} | {level} | {message}"
        self.redis.lpush(f"task:log:{task_id}", log_entry)
        self.redis.ltrim(f"task:log:{task_id}", 0, 99)  # 只保留最近100条
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """查询任务状态"""
        data = self.redis.hgetall(f"task:meta:{task_id}")
        if not data:
            return None
        
        # 解码
        result = {}
        for key, value in data.items():
            key_str = key.decode() if isinstance(key, bytes) else key
            value_str = value.decode() if isinstance(value, bytes) else value
            
            # 解析 JSON 字段
            if key_str in ["params", "metadata", "result"]:
                try:
                    result[key_str] = json.loads(value_str) if value_str else None
                except:
                    result[key_str] = value_str
            elif key_str in ["progress", "retry_count", "max_retries"]:
                result[key_str] = int(value_str)
            elif key_str in ["created_at", "started_at", "completed_at"]:
                result[key_str] = float(value_str) if value_str and value_str != 'None' else None
            else:
                result[key_str] = value_str
        
        return result
    
    def get_task_logs(self, task_id: str, limit: int = 100) -> list:
        """获取任务日志"""
        logs = self.redis.lrange(f"task:log:{task_id}", 0, limit - 1)
        return [log.decode() for log in logs]
    
    def cancel_task(self, task_id: str) -> bool:
        """取消任务（尽力而为）"""
        # 检查任务是否存在
        if not self.redis.exists(f"task:meta:{task_id}"):
            return False
        
        # 更新状态
        self._update_status(task_id, "cancelled", 0, "用户取消")
        self._log(task_id, "WARNING", "任务已取消")
        
        # 尝试取消 Future（如果还在队列中）
        future = self._running_tasks.get(task_id)
        if future:
            future.cancel()
        
        return True
    
    def shutdown(self):
        """关闭线程池（应用关闭时调用）"""
        logger.info("正在关闭任务管理器...")
        self._executor.shutdown(wait=True)
        logger.info("任务管理器已关闭")


# 全局单例
task_manager = TaskManager()
```

### 3.2 任务处理器示例

```python
# backend/app/services/task_queue/handlers/knowledge_handlers.py

import time
from app.models import KnowledgeFileChunk, db
from app.services.knowledge_base.knowledge_vectorizer import KnowledgeVectorizer

def handle_vectorize_file(task_id: str, params: dict, context: dict):
    """
    处理文件向量化任务
    
    Args:
        task_id: 任务ID
        params: {
            "knowledge_id": "kb_123",
            "file_path": "docs/manual.pdf"
        }
        context: {
            "task_id": ...,
            "user_id": ...,
            "manager": TaskManager实例
        }
    """
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
    
    # 2. 向量化
    vectorizer = KnowledgeVectorizer()
    
    # 批量处理
    batch_size = 10
    for i in range(0, total, batch_size):
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
        manager.update_progress(task_id, progress, f"向量化进度 {i+batch_size}/{total}")
        
        time.sleep(0.1)  # 避免过快
    
    # 3. 完成
    manager.update_progress(task_id, 100, "向量化完成")
    
    return {
        "success": True,
        "total_chunks": total,
        "vector_dimension": meta_info.get("vector_dimension")
    }


def handle_batch_vectorize(task_id: str, params: dict, context: dict):
    """批量向量化多个文件"""
    manager = context["manager"]
    knowledge_id = params["knowledge_id"]
    file_paths = params["file_paths"]
    
    total_files = len(file_paths)
    
    for idx, file_path in enumerate(file_paths):
        manager.update_progress(
            task_id,
            int(100 * idx / total_files),
            f"处理文件 {idx+1}/{total_files}: {file_path}"
        )
        
        # 调用单文件向量化
        try:
            handle_vectorize_file(task_id, {
                "knowledge_id": knowledge_id,
                "file_path": file_path
            }, context)
        except Exception as e:
            manager._log(task_id, "ERROR", f"文件 {file_path} 处理失败: {e}")
            continue
    
    return {
        "success": True,
        "total_files": total_files,
        "completed_files": total_files  # 简化：不统计失败
    }
```

### 3.3 注册处理器

```python
# backend/app/services/task_queue/__init__.py

from .task_manager import task_manager
from .handlers import knowledge_handlers

def register_all_handlers():
    """注册所有任务处理器"""
    
    # 知识库相关
    task_manager.register_handler(
        "kb:vectorize_file",
        knowledge_handlers.handle_vectorize_file
    )
    task_manager.register_handler(
        "kb:vectorize_batch",
        knowledge_handlers.handle_batch_vectorize
    )
    
    # 未来可添加更多处理器
    # task_manager.register_handler("graph:add_episode", ...)
    # task_manager.register_handler("var:sync_external", ...)
```

### 3.4 Flask 集成

```python
# backend/app/__init__.py

from flask import Flask
from app.services.task_queue import task_manager, register_all_handlers

def create_app():
    app = Flask(__name__)
    
    # ... 其他初始化 ...
    
    # 初始化任务管理器
    task_manager.init_app(app)
    register_all_handlers()
    
    # 应用关闭时清理
    @app.teardown_appcontext
    def shutdown_task_manager(error=None):
        # 注意：仅在完全关闭时调用
        pass
    
    return app
```

### 3.5 API 路由

```python
# backend/app/api/routes/tasks.py

from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.services.task_queue import task_manager
from app.api.decorators import login_required
import time
import json

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/tasks', methods=['POST'])
@login_required
def submit_task(current_user):
    """提交任务"""
    data = request.get_json()
    
    task_type = data.get('task_type')
    params = data.get('params', {})
    priority = data.get('priority', 'medium')
    
    if not task_type:
        return jsonify({"error": "缺少 task_type"}), 400
    
    # 提交任务
    task_id = task_manager.submit_task(
        task_type=task_type,
        params=params,
        user_id=current_user.id,
        priority=priority
    )
    
    return jsonify({
        "task_id": task_id,
        "status": "pending",
        "message": "任务已提交"
    }), 201


@tasks_bp.route('/tasks/<task_id>', methods=['GET'])
@login_required
def get_task_status(current_user, task_id):
    """查询任务状态"""
    status = task_manager.get_task_status(task_id)
    
    if not status:
        return jsonify({"error": "任务不存在"}), 404
    
    # 权限检查
    if status["user_id"] != current_user.id:
        return jsonify({"error": "无权访问"}), 403
    
    return jsonify(status)


@tasks_bp.route('/tasks/<task_id>/logs', methods=['GET'])
@login_required
def get_task_logs(current_user, task_id):
    """获取任务日志"""
    status = task_manager.get_task_status(task_id)
    
    if not status:
        return jsonify({"error": "任务不存在"}), 404
    
    if status["user_id"] != current_user.id:
        return jsonify({"error": "无权访问"}), 403
    
    logs = task_manager.get_task_logs(task_id)
    return jsonify({"logs": logs})


@tasks_bp.route('/tasks/<task_id>/cancel', methods=['POST'])
@login_required
def cancel_task(current_user, task_id):
    """取消任务"""
    status = task_manager.get_task_status(task_id)
    
    if not status:
        return jsonify({"error": "任务不存在"}), 404
    
    if status["user_id"] != current_user.id:
        return jsonify({"error": "无权取消"}), 403
    
    success = task_manager.cancel_task(task_id)
    
    return jsonify({"success": success})


@tasks_bp.route('/tasks/<task_id>/stream', methods=['GET'])
@login_required
def stream_task_progress(current_user, task_id):
    """SSE 实时推送任务进度"""
    
    def generate():
        last_progress = -1
        while True:
            status = task_manager.get_task_status(task_id)
            if not status:
                yield f"data: {json.dumps({'error': '任务不存在'})}\n\n"
                break
            
            # 只在进度变化时推送
            current_progress = status["progress"]
            if current_progress != last_progress:
                yield f"data: {json.dumps(status)}\n\n"
                last_progress = current_progress
            
            # 任务结束
            if status["status"] in ["completed", "failed", "cancelled"]:
                break
            
            time.sleep(1)  # 每秒检查一次
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream'
    )
```

### 3.6 改造现有知识库 API

```python
# backend/app/api/routes/knowledge.py

from app.services.task_queue import task_manager

@knowledge_bp.route('/knowledges/<knowledge_id>/documents/<document_id>/vectorize', methods=['POST'])
@login_required
def vectorize_file(current_user, knowledge_id, document_id):
    """向量化文件（改为异步）"""
    
    # ... 验证知识库和文件 ...
    
    # 提交任务
    task_id = task_manager.submit_task(
        task_type="kb:vectorize_file",
        params={
            "knowledge_id": knowledge_id,
            "file_path": document.file_path  # 从数据库获取
        },
        user_id=current_user.id,
        priority="high"
    )
    
    return jsonify({
        "task_id": task_id,
        "message": "向量化任务已提交，请通过 /api/tasks/{task_id} 查询进度"
    }), 202  # 202 Accepted
```

---

## 四、前端集成

### 4.1 提交任务并监听进度

```javascript
// 提交任务
async function vectorizeFile(knowledgeId, documentId) {
    const response = await api.post(
        `/knowledges/${knowledgeId}/documents/${documentId}/vectorize`
    );
    const taskId = response.data.task_id;
    
    // 监听进度（SSE方式）
    const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);
    
    eventSource.onmessage = (event) => {
        const status = JSON.parse(event.data);
        
        // 更新进度条
        updateProgressBar(status.progress, status.message);
        
        // 任务完成
        if (status.status === 'completed') {
            eventSource.close();
            showSuccess('向量化完成！');
        } else if (status.status === 'failed') {
            eventSource.close();
            showError(`任务失败: ${status.error}`);
        }
    };
    
    eventSource.onerror = () => {
        eventSource.close();
        showError('连接中断');
    };
}

// 或使用轮询方式（更简单）
async function vectorizeFileWithPolling(knowledgeId, documentId) {
    const response = await api.post(
        `/knowledges/${knowledgeId}/documents/${documentId}/vectorize`
    );
    const taskId = response.data.task_id;
    
    // 轮询进度
    const interval = setInterval(async () => {
        const status = await api.get(`/api/tasks/${taskId}`);
        
        updateProgressBar(status.data.progress, status.data.message);
        
        if (status.data.status === 'completed') {
            clearInterval(interval);
            showSuccess('向量化完成！');
        } else if (status.data.status === 'failed') {
            clearInterval(interval);
            showError(`任务失败: ${status.data.error}`);
        }
    }, 2000);  // 每2秒查询一次
}
```

---

## 五、对比总结

| 特性 | 复杂版（Worker） | **简化版（线程池）** |
|------|----------------|-------------------|
| 部署复杂度 | 需要单独启动Worker | ✅ 只启动Flask |
| 代码复杂度 | 高 | ✅ 低 |
| 横向扩展 | 支持多服务器 | 单服务器 |
| 适用规模 | 大型项目 | ✅ 中小型项目 |
| 任务隔离 | 进程隔离 | 线程隔离 |
| 开发调试 | 困难 | ✅ 简单 |

---

## 六、实施步骤

### Phase 1: 基础框架（1天）
- [ ] `task_manager.py`：线程池版任务管理器
- [ ] `redis_client.py`：Redis 连接封装
- [ ] 基础 API：提交任务、查询状态

### Phase 2: 知识库任务（1天）
- [ ] `knowledge_handlers.py`：文件向量化处理器
- [ ] 改造现有知识库 API 为异步
- [ ] 前端集成进度条

### Phase 3: 其他任务（按需）
- [ ] 变量同步任务
- [ ] 图增强任务
- [ ] 导入导出任务

---

**这个方案如何？简单多了吧！** 🎉

核心优势：
1. **无需 Worker**：所有逻辑在 Flask 应用内
2. **部署简单**：不需要额外的进程管理
3. **代码清晰**：使用 Python 标准库 `ThreadPoolExecutor`
4. **够用**：对于你们的场景完全够用

需要我开始实现吗？
