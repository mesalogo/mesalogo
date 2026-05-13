# 任务队列系统测试指南

## 🚀 完整测试流程

### 一、后端测试

#### 1. 创建数据库表
```bash
cd backend
python create_task_table.py
```

预期输出：
```
✓ Task 表创建成功
✓ 验证通过：tasks 表已存在
```

#### 2. 启动应用
```bash
python run_app.py
```

关键日志：
```
[INFO] TaskManager 已初始化，线程池大小: 10
[INFO] 注册任务处理器: kb:vectorize_file
[INFO] 注册任务处理器: kb:vectorize_batch
[INFO] Task API 已注册: /api/tasks
```

#### 3. 测试后端 API

**提交任务：**
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "kb:vectorize_file",
    "params": {
      "knowledge_id": "test_kb",
      "file_path": "test.pdf"
    },
    "priority": "high"
  }'
```

预期响应（201）：
```json
{
  "task_id": "task_abc123...",
  "status": "pending",
  "message": "任务已提交"
}
```

**查询任务状态：**
```bash
curl http://localhost:5000/api/tasks/task_abc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

预期响应（200）：
```json
{
  "task_id": "task_abc123",
  "task_type": "kb:vectorize_file",
  "status": "running",
  "progress": 45,
  "message": "向量化进度 25/50",
  "params": {...},
  "result": null,
  "logs": [...]
}
```

**查询任务列表：**
```bash
curl "http://localhost:5000/api/tasks?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**获取统计：**
```bash
curl http://localhost:5000/api/tasks/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

预期响应：
```json
{
  "total": 10,
  "pending": 1,
  "running": 2,
  "completed": 5,
  "failed": 1,
  "cancelled": 1
}
```

---

### 二、前端测试

#### 1. 启动前端
```bash
cd frontend
npm start
```

#### 2. 登录系统
打开浏览器访问 `http://localhost:3000`

#### 3. 检查任务中心按钮
在右上角，应该看到：
```
[语言切换] [任务中心图标🔔] [用户头像]
```

#### 4. 测试任务中心

**步骤 1：点击任务中心按钮**
- 应弹出任务中心 Modal
- 标题：任务中心
- 宽度：1000px

**步骤 2：检查统计栏**
应显示：
```
总任务: X  等待中: X  运行中: X  已完成: X  失败: X
```

**步骤 3：检查过滤器**
- 任务类型下拉框
- 状态下拉框
- 刷新按钮

**步骤 4：检查任务列表**
表格列：
- 任务类型
- 状态（带颜色标签）
- 进度（进度条）
- 消息
- 创建时间
- 操作（详情、取消）

**步骤 5：测试功能**
- [ ] 过滤器选择不同类型/状态，列表更新
- [ ] 点击"详情"按钮，弹出任务详情
- [ ] 点击"取消"按钮，任务状态变为 cancelled
- [ ] 点击刷新按钮，数据更新
- [ ] 等待 5 秒，自动刷新

#### 5. 测试任务提交（知识库页面）

**步骤 1：进入知识库页面**
导航到 `/roles/knowledges`

**步骤 2：选择文档**
点击某个文档的"向量化"按钮

**步骤 3：检查响应**
- 应提示"任务已提交"
- 右上角徽章数字 +1
- （如果页面有集成）弹出进度弹窗

**步骤 4：查看任务中心**
- 点击右上角任务中心按钮
- 应看到刚提交的任务
- 状态：pending 或 running
- 进度：0-100%

**步骤 5：等待完成**
- 任务状态变为 completed
- 进度 100%
- 右上角徽章数字 -1

---

### 三、集成测试

#### 场景1：单文件向量化

1. 提交单个文件的向量化任务
2. 打开任务中心，看到任务状态
3. 实时查看进度更新
4. 等待任务完成
5. 刷新知识库页面，文档状态更新

#### 场景2：批量任务

1. 批量提交 5 个文件的向量化任务
2. 任务中心显示 5 个任务
3. 右上角徽章显示 5
4. 观察任务逐个完成
5. 徽章数字递减

#### 场景3：取消任务

1. 提交一个长时间任务
2. 打开任务中心
3. 点击"取消"按钮
4. 确认对话框，点击确定
5. 任务状态变为 cancelled
6. 徽章数字 -1

#### 场景4：查看详情

1. 打开任务中心
2. 点击某个任务的"详情"按钮
3. 弹出任务详情 Modal
4. 查看进度条、日志、参数
5. 关闭详情弹窗

#### 场景5：过滤和搜索

1. 打开任务中心
2. 选择任务类型"文件向量化"
3. 列表只显示该类型任务
4. 选择状态"运行中"
5. 列表只显示运行中的文件向量化任务

---

### 四、性能测试

#### 1. 并发任务测试
```bash
# 提交 20 个任务
for i in {1..20}; do
  curl -X POST http://localhost:5000/api/tasks \
    -H "Authorization: Bearer TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"task_type\":\"kb:vectorize_file\",\"params\":{\"knowledge_id\":\"kb_$i\",\"file_path\":\"file_$i.pdf\"},\"priority\":\"medium\"}"
done
```

检查：
- 最多 10 个任务同时运行（线程池大小）
- 其余任务等待
- 任务中心正确显示所有任务

#### 2. 自动刷新测试
1. 打开任务中心 Modal
2. 提交新任务（不关闭 Modal）
3. 5 秒内，任务列表自动刷新
4. 新任务出现在列表中

#### 3. 徽章更新测试
1. 右上角徽章显示 0
2. 提交 3 个任务
3. 5 秒内，徽章显示 3
4. 等待任务完成
5. 徽章数字递减

---

### 五、错误测试

#### 1. 后端错误处理

**无效的 task_type：**
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_type":"invalid_type","params":{}}'
```

预期：400 Bad Request

**任务不存在：**
```bash
curl http://localhost:5000/api/tasks/nonexistent_id \
  -H "Authorization: Bearer TOKEN"
```

预期：404 Not Found

**取消已完成的任务：**
```bash
curl -X POST http://localhost:5000/api/tasks/completed_task_id/cancel \
  -H "Authorization: Bearer TOKEN"
```

预期：400 Bad Request，消息："任务已完成，无法取消"

#### 2. 前端错误处理

**网络错误：**
1. 停止后端服务
2. 打开任务中心
3. 应显示错误提示："获取任务列表失败"

**Token 过期：**
1. 使用过期 token
2. 提交任务
3. 应跳转到登录页

---

### 六、UI/UX 测试

#### 1. 响应式测试
- [ ] 任务中心 Modal 在小屏幕上正确显示
- [ ] 表格支持横向滚动
- [ ] 进度条在手机端正常显示

#### 2. 交互测试
- [ ] 按钮 hover 效果
- [ ] 点击操作有反馈
- [ ] 加载状态显示
- [ ] Modal 打开/关闭动画流畅

#### 3. 可访问性测试
- [ ] 键盘导航正常
- [ ] 按钮有合适的 aria-label
- [ ] 颜色对比度符合标准

---

### 七、浏览器兼容性测试

测试浏览器：
- [ ] Chrome（最新版）
- [ ] Firefox（最新版）
- [ ] Safari（最新版）
- [ ] Edge（最新版）

测试项目：
- [ ] 任务中心按钮显示
- [ ] Modal 正常打开/关闭
- [ ] 表格渲染正常
- [ ] 进度条动画流畅
- [ ] 过滤器下拉正常

---

## ✅ 测试清单总结

### 后端
- [ ] 数据库表创建成功
- [ ] 应用启动无错误
- [ ] API 返回正确响应
- [ ] 任务提交成功
- [ ] 任务执行正常
- [ ] 进度更新实时
- [ ] 取消功能正常
- [ ] 错误处理正确

### 前端
- [ ] 任务中心按钮显示
- [ ] 徽章数字正确
- [ ] Modal 打开正常
- [ ] 统计栏显示正确
- [ ] 任务列表渲染
- [ ] 过滤器工作正常
- [ ] 详情弹窗正常
- [ ] 取消功能正常
- [ ] 自动刷新正常

### 集成
- [ ] 知识库页面提交任务
- [ ] 任务中心显示任务
- [ ] 完整流程正常
- [ ] 多任务并发正常
- [ ] 错误处理友好

---

## 🐛 常见问题排查

### 问题1：任务中心按钮不显示
**检查：**
1. 浏览器控制台是否有错误
2. 导入路径是否正确
3. 组件是否正确导出

### 问题2：徽章数字不更新
**检查：**
1. API 是否正常调用
2. 网络请求是否成功
3. 浏览器控制台是否有错误

### 问题3：任务列表为空
**检查：**
1. 是否有提交任务
2. API 返回数据格式是否正确
3. 用户权限是否正确

### 问题4：任务一直 pending
**检查：**
1. 后端日志是否有错误
2. TaskManager 是否正常初始化
3. 处理器是否注册成功

---

**测试完成后，系统应该完全可用！** 🎉
