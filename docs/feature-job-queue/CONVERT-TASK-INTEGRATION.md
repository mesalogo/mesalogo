# 文件转换任务集成完成

## 改动总结

### 问题
用户点击"转换"按钮后，任务没有显示在任务中心。

### 原因
`/convert` 接口使用的是旧的 `convert_file_async()` 异步方式（threading），没有集成到任务队列系统。

### 解决方案
将文件转换接口改造成使用任务队列系统。

---

## 具体修改

### 1. 创建转换任务处理器

**文件**: `backend/app/services/task_queue/handlers/knowledge_handlers.py`

新增 `handle_convert_file()` 函数：

```python
def handle_convert_file(task_id, params, manager):
    """
    文件转换处理器
    
    将文件转换为 Markdown 格式
    """
    knowledge_id = params.get('knowledge_id')
    file_path = params.get('file_path')
    
    # 1. 查找文档记录
    # 2. 创建/更新转换记录
    # 3. 调用转换逻辑
    # 4. 更新进度
    # 5. 返回结果
```

### 2. 注册任务处理器

**文件**: `backend/app/__init__.py`

```python
task_manager.register_handler('kb:convert_file', knowledge_handlers.handle_convert_file)
```

### 3. 改造 convert 接口

**文件**: `backend/app/api/routes/knowledge.py`

**改造前**:
```python
@knowledge_bp.route('/knowledges/<string:knowledge_id>/documents/<string:document_id>/convert', methods=['POST'])
def convert_file(knowledge_id, document_id):
    # ... 创建 conversion 记录
    
    # 使用旧的异步方式
    from app.services.knowledge_base.document_converter import convert_file_async
    convert_file_async(conversion.id)
    
    return jsonify({
        'conversion_id': conversion.id,
        'status': 'processing'
    })
```

**改造后**:
```python
@knowledge_bp.route('/knowledges/<string:knowledge_id>/documents/<string:document_id>/convert', methods=['POST'])
@login_required
def convert_file(knowledge_id, document_id):
    # ... 清理旧数据
    
    # 使用新的任务队列系统
    from app.services.task_queue import task_manager
    
    task_id = task_manager.submit_task(
        task_type='kb:convert_file',
        params={
            'knowledge_id': knowledge_id,
            'file_path': file_path
        },
        user_id=current_user.id,
        priority='high'
    )
    
    return jsonify({
        'task_id': task_id,
        'status': 'pending'
    }), 202  # 202 Accepted
```

### 4. 更新前端任务类型映射

**文件**: `frontend/src/components/Tasks/TaskCenterModal.js`

```javascript
const TASK_TYPE_NAMES = {
  'kb:convert_file': '文件转换',        // 新增
  'kb:vectorize_file': '文件向量化',
  'kb:vectorize_batch': '批量向量化',
  // ...
};
```

同时在过滤器下拉框中添加：
```javascript
<Option value="kb:convert_file">文件转换</Option>
```

---

## 功能变化

### 改造前
```
用户点击"转换"
    ↓
调用 POST /api/knowledges/{kb_id}/documents/{doc_id}/convert
    ↓
创建 conversion 记录
    ↓
调用 convert_file_async() (threading)
    ↓
返回 conversion_id
    ↓
❌ 任务中心看不到
```

### 改造后
```
用户点击"转换"
    ↓
调用 POST /api/knowledges/{kb_id}/documents/{doc_id}/convert
    ↓
清理旧数据
    ↓
task_manager.submit_task('kb:convert_file', ...)
    ↓
创建 Task 记录
    ↓
返回 task_id (202 Accepted)
    ↓
✅ 任务中心显示"文件转换"任务
    ↓
实时显示进度（0% → 20% → 100%）
    ↓
任务完成
```

---

## 测试步骤

### 1. 重启后端
```bash
cd backend
# Ctrl+C 停止
python run_app.py
```

查看日志，应该看到：
```
[INFO] 任务管理器已初始化
[INFO] 注册任务处理器: kb:convert_file
[INFO] 注册任务处理器: kb:vectorize_file
[INFO] 注册任务处理器: kb:vectorize_batch
```

### 2. 测试转换任务

1. **打开知识库页面**
   - 进入 `/roles/knowledges`

2. **点击文档的"转换"按钮**
   - 应提示"转换任务已提交"
   - 右上角任务中心徽章数字 +1

3. **打开任务中心**
   - 点击右上角任务中心按钮
   - 应看到"文件转换"任务
   - 任务类型：文件转换
   - 状态：等待中 → 运行中
   - 进度：0% → 10% → 20% → 100%

4. **观察任务执行**
   - 进度实时更新
   - 日志显示转换过程
   - 完成后状态变为"已完成"
   - 徽章数字 -1

### 3. 测试过滤器

1. 打开任务中心
2. 选择任务类型 → "文件转换"
3. 列表只显示转换任务

---

## API 变化

### 旧 API
```
POST /api/knowledges/{kb_id}/documents/{doc_id}/convert
→ 200 OK
{
  "success": true,
  "message": "转换任务已创建",
  "data": {
    "conversion_id": "conv_abc123",
    "status": "processing"
  }
}
```

### 新 API
```
POST /api/knowledges/{kb_id}/documents/{doc_id}/convert
→ 202 Accepted
{
  "success": true,
  "message": "转换任务已提交",
  "data": {
    "task_id": "task_abc123",
    "status": "pending"
  }
}
```

**查询进度**:
```
GET /api/tasks/task_abc123
→ 200 OK
{
  "task_id": "task_abc123",
  "task_type": "kb:convert_file",
  "status": "running",
  "progress": 20,
  "message": "转换文件: xxx.pdf",
  "params": {
    "knowledge_id": "kb_123",
    "file_path": "xxx.pdf"
  }
}
```

---

## 数据库记录

**Task 表**:
```sql
SELECT * FROM tasks WHERE task_type = 'kb:convert_file';

+---------------+------------------+---------+---------+----------+
| task_id       | task_type        | status  | progress| message  |
+---------------+------------------+---------+---------+----------+
| task_abc123   | kb:convert_file  | running | 20      | 转换中.. |
+---------------+------------------+---------+---------+----------+
```

**KnowledgeFileConversion 表** (仍然存在):
```sql
SELECT * FROM knowledge_file_conversion WHERE document_id = 'doc_123';

+---------------+-------------+-----------+---------+
| id            | document_id | status    | ...     |
+---------------+-------------+-----------+---------+
| conv_abc123   | doc_123     | completed | ...     |
+---------------+-------------+-----------+---------+
```

---

## 其他改进

### 移除重复检查
改造前接口会检查：
```python
if conversion.status == 'processing':
    return jsonify({'message': '文件正在转换中'}), 400
```

改造后由任务队列系统管理，用户可以：
- 在任务中心查看所有转换任务
- 取消正在运行的任务
- 查看详细日志

### 添加权限控制
```python
@login_required  # 新增
def convert_file(knowledge_id, document_id):
    current_user = get_current_user_from_token()
    # ...
```

---

## 完成状态

✅ 文件转换任务处理器  
✅ 注册处理器  
✅ 改造 convert 接口  
✅ 前端任务类型映射  
✅ 文档更新  

---

## 下一步

可以继续集成其他接口：

1. **文件分段接口** `/chunk`
   - 创建 `handle_chunk_file()` 处理器
   - 改造分段接口使用任务队列

2. **批量转换接口**
   - 创建 `handle_batch_convert()` 处理器
   - 支持一次转换多个文件

3. **变量同步接口**
   - 创建 `handle_sync_variables()` 处理器
   - 集成到任务中心

---

**文件转换任务集成完成！** 🎉

现在用户可以在任务中心查看所有文件转换任务的实时进度了。
