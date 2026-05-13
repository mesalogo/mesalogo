# 分段设置功能测试文档

## 1. 测试前准备

### 1.1 确保后端服务运行
```bash
cd backend
python3 run_app.py
# 或
./start.sh
```

### 1.2 确保前端服务运行
```bash
cd frontend
npm start
```

## 2. API 测试

### 2.1 测试获取默认配置
```bash
curl http://localhost:8080/api/knowledges/chunk-config/defaults
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "methods": [
      {
        "name": "recursive",
        "display_name": "递归分割",
        "enabled": true,
        "default_config": {...}
      },
      ...
    ],
    "recommended": "recursive",
    "availability": {
      "chonkie": true,
      "methods": {...}
    }
  }
}
```

### 2.2 测试获取知识库配置
```bash
# 替换 <knowledge-id> 为实际的知识库ID
curl http://localhost:8080/api/knowledges/<knowledge-id>/chunk-config \
  -H "Authorization: Bearer <your-token>"
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "id": "kb-xxx",
    "knowledge_id": "kb-xxx",
    "method": "recursive",
    "config": {
      "chunk_size": 512,
      "chunk_overlap": 128,
      "separators": ["\\n\\n", "\\n", ". ", "。", " "]
    },
    "created_at": "2024-10-22T...",
    "updated_at": "2024-10-22T..."
  }
}
```

### 2.3 测试更新配置
```bash
curl -X PUT http://localhost:8080/api/knowledges/<knowledge-id>/chunk-config \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "recursive",
    "config": {
      "chunk_size": 1024,
      "chunk_overlap": 256,
      "separators": ["\\n\\n", "\\n"]
    }
  }'
```

**预期响应**:
```json
{
  "success": true,
  "message": "分段配置已更新",
  "data": {...}
}
```

## 3. 前端 UI 测试

### 3.1 访问知识库设置页面
1. 打开浏览器访问 `http://localhost:3000`
2. 登录系统
3. 进入知识库列表页面
4. 点击某个知识库的"设置"按钮
5. 点击"分段设置"标签页

### 3.2 测试方法切换
- [x] 应该显示5个分段方法
- [x] "递归分割"、"句子分割"、"Token分割" 应该是可选的（enabled=true）
- [x] "语义分割"、"代码分割" 应该是禁用状态，显示"即将推出"标签
- [x] 切换方法时，配置表单应该自动更新为该方法的默认配置

### 3.3 测试配置表单

#### 递归分割配置
- [x] 分块大小滑块：100-2048
- [x] 重叠大小滑块：0-512
- [x] 输入框和滑块应该联动
- [x] 显示效果预览

#### Token分割配置
- [x] 分块大小滑块：100-2048
- [x] 重叠大小滑块：0-512
- [x] Tokenizer下拉选择：GPT-2 / BERT / RoBERTa

#### 句子分割配置
- [x] 最少句子数：1-20
- [x] 最多句子数：1-50
- [x] 最少值应 ≤ 最多值

#### 语义分割配置（Phase 2）
- [x] Embedding模型选择
- [x] 相似度阈值滑块：0-1

#### 代码分割配置（Phase 2）
- [x] 编程语言选择：自动检测/Python/JavaScript/Java/C++

### 3.4 测试保存功能
1. 修改配置参数
2. 点击"保存"按钮
3. 应该显示成功消息："分段配置已保存"
4. 刷新页面，配置应该保持修改后的值

### 3.5 测试重置功能
1. 修改配置参数
2. 点击"恢复默认"按钮
3. 应该显示提示："已恢复默认配置"
4. 表单值应该恢复为该方法的默认配置

## 4. 数据验证

### 4.1 数据库检查
```sql
-- 查看所有分段配置
SELECT * FROM chunk_configs;

-- 查看某个知识库的配置
SELECT * FROM chunk_configs WHERE knowledge_id = 'kb-xxx';

-- 统计各方法使用情况
SELECT method, COUNT(*) as count 
FROM chunk_configs 
GROUP BY method;
```

### 4.2 验证配置参数
```bash
# 使用Python测试ChonkieWrapper
cd backend
python3 << EOF
from app.services.chunking import ChonkieWrapper

# 测试递归分割
wrapper = ChonkieWrapper('recursive', {
    'chunk_size': 512,
    'chunk_overlap': 128,
    'separators': ['\n\n', '\n', '. ']
})

text = "这是一个测试文档。\n\n包含多个段落。\n每个段落有多句话。"
chunks = wrapper.chunk(text)
print(f"分块数量: {len(chunks)}")
for i, chunk in enumerate(chunks):
    print(f"分块 {i+1}: {chunk[:50]}...")
EOF
```

## 5. 常见问题

### 5.1 Chonkie未安装
**错误**: `ModuleNotFoundError: No module named 'chonkie'`

**解决**:
```bash
pip install chonkie
# 或安装完整版本（支持语义分割）
pip install chonkie[semantic]
```

### 5.2 数据库表不存在
**错误**: `Table 'chunk_configs' doesn't exist`

**解决**:
```bash
cd backend
python3 db_migrations/create_chunk_configs_table.py
# 或直接执行SQL
mysql -u root -p your_database < db_migrations/20251022_create_chunk_configs_table.sql
```

### 5.3 前端API调用失败
**检查**:
1. 后端服务是否正常运行
2. API路径是否正确：`/api/knowledges/{id}/chunk-config`
3. 浏览器控制台Network标签查看请求响应
4. 检查认证token是否有效

## 6. Phase 2 功能（待实施）

### 6.1 启用语义分割
1. 安装依赖：`pip install chonkie[semantic]`
2. 修改 `config.py` 中 `semantic` 方法的 `enabled: True`
3. 修改 `chonkie_wrapper.py` 中 `SEMANTIC_AVAILABLE` 检查逻辑

### 6.2 启用代码分割
1. 安装依赖：`pip install chonkie[all]`
2. 修改 `config.py` 中 `code` 方法的 `enabled: True`

## 7. 成功标志

当所有以下项都完成时，功能开发成功：

- ✅ 数据库表创建成功，有 `chunk_configs` 表
- ✅ 后端API三个端点都正常工作
- ✅ ChonkieWrapper能正确分块文本
- ✅ 前端UI显示所有5个方法
- ✅ 能够切换方法并保存配置
- ✅ 配置持久化到数据库
- ✅ 刷新页面后配置保持不变
- ✅ 效果预览显示正确

## 8. 下一步集成

完成分段设置后，需要将其集成到文档处理流程：

1. **文档上传时**：使用知识库的分段配置进行分块
2. **文档搜索时**：根据分段方法优化搜索策略
3. **嵌入向量时**：按照分块结果生成向量

参考代码位置：
- 文档处理：`app/services/document_processor.py`
- 向量嵌入：`app/services/vector_db/embedding_service.py`
