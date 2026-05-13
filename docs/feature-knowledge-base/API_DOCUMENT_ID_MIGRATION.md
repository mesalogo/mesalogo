# API 从 file_path 迁移到 document_id

## 🎯 改进目标

将所有使用 `file_path` 作为查询参数的 API 改为使用 `document_id` 作为路径参数。

---

## ❌ 之前的设计问题

**使用 file_path 作为查询参数**:

```
POST /api/knowledges/{knowledge_id}/files/convert?file_path=红帽大模型解决方案.pdf
GET  /api/knowledges/{knowledge_id}/files/markdown?file_path=红帽大模型解决方案.pdf
POST /api/knowledges/{knowledge_id}/files/vectorize?file_path=红帽大模型解决方案.pdf
```

**问题**:
1. **URL 编码问题** - 中文、空格、特殊字符需要编码
2. **不符合 RESTful 规范** - 资源标识应该在路径中
3. **安全性** - 暴露了实际文件名
4. **易错** - 文件名变化会导致 API 调用失败

---

## ✅ 改进后的设计

**使用 document_id 作为路径参数**:

```
POST /api/knowledges/{knowledge_id}/documents/{document_id}/convert
GET  /api/knowledges/{knowledge_id}/documents/{document_id}/markdown
POST /api/knowledges/{knowledge_id}/documents/{document_id}/vectorize
```

**优势**:
1. **标准 RESTful 设计** - 资源用 UUID 标识
2. **避免编码问题** - UUID 只包含字母和数字
3. **更安全** - 不暴露实际文件名
4. **更稳定** - document_id 不变，即使文件名改变

---

## 📋 需要迁移的 API

| 旧 API | 新 API | 说明 |
|--------|--------|------|
| `POST /files/convert?file_path=xxx` | `POST /documents/{document_id}/convert` | 转换文档 |
| `GET /files/conversion-status?file_path=xxx` | `GET /documents/{document_id}/conversion-status` | 转换状态 |
| `GET /files/markdown?file_path=xxx` | `GET /documents/{document_id}/markdown` | 查看 markdown |
| `POST /files/chunk?file_path=xxx` | `POST /documents/{document_id}/chunk` | 分段 |
| `GET /files/chunking-status?file_path=xxx` | `GET /documents/{document_id}/chunking-status` | 分段状态 |
| `GET /files/chunks?file_path=xxx` | `GET /documents/{document_id}/chunks` | 查看 chunks |
| `POST /files/embed?file_path=xxx` | `POST /documents/{document_id}/embed` | 嵌入（旧） |
| `GET /files/embedding-status?file_path=xxx` | `GET /documents/{document_id}/embedding-status` | 嵌入状态 |
| `POST /files/process?file_path=xxx` | `POST /documents/{document_id}/process` | 一键处理 |
| `POST /files/vectorize?file_path=xxx` | `POST /documents/{document_id}/vectorize` | 向量化（新） |

---

## 🔧 实现方式

### 后端修改

**1. 修改路由定义**:

```python
# 之前
@knowledge_bp.route('/knowledges/<string:knowledge_id>/files/convert', methods=['POST'])
def convert_file(knowledge_id):
    file_path = request.args.get('file_path')
    # ...

# 之后
@knowledge_bp.route('/knowledges/<string:knowledge_id>/documents/<string:document_id>/convert', methods=['POST'])
def convert_file(knowledge_id, document_id):
    # 通过 document_id 查询 document
    document = KnowledgeDocument.query.get(document_id)
    if not document:
        return jsonify({'success': False, 'message': '文档不存在'}), 404
    
    file_path = document.file_path
    # ...
```

**2. 添加辅助函数**:

```python
def get_document_or_404(knowledge_id: str, document_id: str):
    """获取文档，不存在则返回 404"""
    document = KnowledgeDocument.query.filter_by(
        id=document_id,
        knowledge_id=knowledge_id
    ).first()
    
    if not document:
        return None, jsonify({
            'success': False,
            'message': '文档不存在'
        }), 404
    
    return document, None, None
```

---

## 🔄 迁移步骤

### 阶段 1: 添加新 API（保留旧 API）

1. 创建新的路由，使用 `document_id`
2. 旧 API 保持不变
3. 前端逐步切换到新 API
4. 测试新 API 是否正常工作

### 阶段 2: 前端迁移

1. 修改前端 API 调用
2. 从列表中获取 `document_id`
3. 使用新的 URL 格式

### 阶段 3: 废弃旧 API

1. 在旧 API 中添加 deprecated 警告
2. 几个版本后删除旧 API

---

## 📝 前端修改示例

**之前**:

```javascript
// 获取文件名
const fileName = "红帽大模型解决方案.pdf";

// 需要 URL 编码
const encodedFileName = encodeURIComponent(fileName);

// 调用 API
await axios.post(
  `/api/knowledges/${knowledgeId}/files/convert?file_path=${encodedFileName}`
);
```

**之后**:

```javascript
// 从列表中获取 document_id
const documentId = document.id;  // UUID

// 直接调用，无需编码
await axios.post(
  `/api/knowledges/${knowledgeId}/documents/${documentId}/convert`
);
```

---

## 🎯 优先级

### 高优先级（立即修改）

- ✅ `POST /documents/{document_id}/vectorize` - 向量化
- `POST /documents/{document_id}/convert` - 转换
- `POST /documents/{document_id}/chunk` - 分段

### 中优先级

- `GET /documents/{document_id}/conversion-status` - 转换状态
- `GET /documents/{document_id}/chunking-status` - 分段状态
- `GET /documents/{document_id}/embedding-status` - 嵌入状态

### 低优先级

- `GET /documents/{document_id}/markdown` - 查看 markdown
- `GET /documents/{document_id}/chunks` - 查看 chunks
- `POST /documents/{document_id}/process` - 一键处理

---

## ✅ 验证方法

1. **API 测试**:
   ```bash
   # 获取 document_id
   curl http://localhost:8080/api/knowledges/{knowledge_id}/files
   
   # 使用 document_id 调用新 API
   curl -X POST http://localhost:8080/api/knowledges/{knowledge_id}/documents/{document_id}/convert
   ```

2. **前端测试**:
   - 上传文件
   - 点击转换、分段、嵌入
   - 查看状态和结果

3. **日志检查**:
   ```bash
   grep "document_id" logs/app.log
   ```

---

## 📊 迁移进度

- [ ] 向量化 API
- [ ] 转换 API
- [ ] 分段 API
- [ ] 状态查询 API
- [ ] 内容查看 API
- [ ] 前端迁移
- [ ] 删除旧 API

---

## 🔗 相关文档

- `PLAN-KB-INTERNAL.md` - 知识库内部设计
- `API_MODIFICATION_SUMMARY.md` - API 修改总结
- `DOCUMENT_TABLE_MIGRATION_GUIDE.md` - 文档表迁移指南
