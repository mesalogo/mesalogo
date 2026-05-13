# 重新嵌入时自动清理旧数据

## 🎯 功能说明

当用户重新嵌入一个文件时，系统会自动删除 Milvus Collection 中该文档的旧向量数据，然后插入新的向量。

---

## ❌ 之前的问题

**没有清理旧数据**:
1. 重新嵌入后，旧向量和新向量同时存在
2. 搜索时返回重复的结果
3. Collection 中积累大量过期数据
4. 用户不知道哪些是最新的向量

**示例**:
```
第1次嵌入 → Milvus 中有 25 个向量
修改文档后重新嵌入 → Milvus 中有 50 个向量 (25旧 + 25新) ❌
再次修改后重新嵌入 → Milvus 中有 75 个向量 (25旧 + 25旧 + 25新) ❌
```

---

## ✅ 修复后的流程

**新的嵌入流程**:

```
1. 用户点击"嵌入"
    ↓
2. API 创建 embedding 记录 (status=processing)
    ↓
3. 后台任务启动
    ↓
4. 读取文档的所有 chunks
    ↓
5. 生成向量 (25秒)
    ↓
6. ⭐ 先删除该 document_id 的旧向量
    ↓
7. 插入新的向量到 Milvus
    ↓
8. 更新 embedding 记录 (status=completed)
```

**示例**:
```
第1次嵌入 → Milvus 中有 25 个向量
修改文档后重新嵌入:
  - 删除旧的 25 个向量
  - 插入新的 25 个向量
  → Milvus 中有 25 个向量 ✅

再次修改后重新嵌入:
  - 删除旧的 25 个向量
  - 插入新的 25 个向量
  → Milvus 中有 25 个向量 ✅
```

---

## 🔧 技术实现

### 1. 向量化服务

**`backend/app/services/knowledge_base/knowledge_vectorizer_simple.py`**

```python
# 重新嵌入时，先删除该文档的旧向量数据
logger.info(f"清理文档 {document.id} 的旧向量数据...")
delete_success, delete_message, _ = vector_db_service.delete_by_metadata(
    knowledge_base=kb_name,
    metadata_filter={'document_id': document.id}
)

if delete_success:
    logger.info(f"已删除旧向量数据: {delete_message}")
else:
    # 如果是 Collection 不存在，不算错误
    if "不存在" not in delete_message and "not exist" not in delete_message.lower():
        logger.warning(f"删除旧向量数据失败（可能是首次嵌入）: {delete_message}")

# 插入新的向量
success, message, db_info = vector_db_service.insert_vectors(
    knowledge_base=kb_name,
    embeddings=embeddings,
    metadatas=metadatas
)
```

### 2. 删除方法增强

**`backend/app/services/vector_db_service.py`**

```python
def delete_by_metadata(self, knowledge_base: str, metadata_filter: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """按元数据删除文档"""
    try:
        from pymilvus import Collection, utility
        
        if not self._connect():
            return False, "无法连接到 Milvus", {}
        
        # 检查 Collection 是否存在
        if not utility.has_collection(knowledge_base, using=self._connection_alias):
            self.logger.info(f"Collection {knowledge_base} 不存在，无需删除")
            return True, "Collection 不存在，无需删除", {}
        
        collection = Collection(knowledge_base, using=self._connection_alias)
        
        # 构建删除表达式
        if 'document_id' in metadata_filter:
            # 按 document_id 删除
            document_id = metadata_filter['document_id']
            expr = f'document_id == "{document_id}"'
            collection.delete(expr)
            collection.flush()
            
            self.logger.info(f"已删除 document_id={document_id} 的向量")
            return True, f"已删除文档 {document_id} 的向量", {}
        
        # ... 其他过滤条件
```

---

## 📊 删除逻辑

### Milvus Delete 表达式

```python
# 使用 document_id 过滤删除
expr = f'document_id == "{document_id}"'
collection.delete(expr)
collection.flush()
```

### 支持的过滤条件

| 过滤条件 | 说明 | 示例 |
|---------|------|------|
| document_id | 按文档ID删除 | `{'document_id': 'abc-123-...'}` |
| file_path | 按文件路径删除（兼容） | `{'file_path': 'test.pdf'}` |

---

## 🧪 测试日志

**首次嵌入**:
```log
[INFO] 清理文档 7f311cb4-... 的旧向量数据...
[INFO] Collection knowledge_xxx 不存在，无需删除
[INFO] 准备插入 25 个向量到 knowledge_xxx
[INFO] 成功插入 25 条向量数据
```

**重新嵌入**:
```log
[INFO] 清理文档 7f311cb4-... 的旧向量数据...
[INFO] 已删除 document_id=7f311cb4-... 的向量
[INFO] 准备插入 25 个向量到 knowledge_xxx
[INFO] 成功插入 25 条向量数据
```

---

## 🎯 好处

1. **数据一致性** - 每个文档只保留最新的向量
2. **避免重复** - 搜索时不会返回重复结果
3. **节省空间** - 不会积累过期的向量数据
4. **用户友好** - 自动处理，用户无需手动清理

---

## 🔍 验证方法

### 1. 查看向量数量

```python
from pymilvus import Collection

collection = Collection("knowledge_xxx")
count = collection.num_entities
print(f"Collection 中有 {count} 个向量")
```

### 2. 按 document_id 查询

```python
results = collection.query(
    expr=f'document_id == "{document_id}"',
    output_fields=["id", "document_id"]
)
print(f"文档 {document_id} 有 {len(results)} 个向量")
```

### 3. 日志检查

查看后端日志，确认删除和插入操作：

```bash
grep "清理文档" logs/app.log
grep "已删除旧向量数据" logs/app.log
grep "成功插入.*条向量数据" logs/app.log
```

---

## 📁 相关文件

1. **向量化服务**
   - `backend/app/services/knowledge_base/knowledge_vectorizer_simple.py`

2. **向量数据库服务**
   - `backend/app/services/vector_db_service.py`

3. **API 路由**
   - `backend/app/api/routes/knowledge.py`

---

## ⚠️ 注意事项

1. **首次嵌入**: Collection 不存在时，删除操作会返回成功（无需删除）
2. **幂等性**: 多次重新嵌入同一文件，结果一致
3. **原子性**: 删除和插入在同一个向量化任务中完成
4. **并发**: 通过 embedding 记录的 processing 状态防止并发嵌入

---

## 🔄 完整流程示例

**场景**: 用户上传一个 PDF，嵌入后发现内容有误，重新上传并嵌入

```
1. 首次上传 "报告.pdf"
   - 转换 → 25 个 chunks
   - 嵌入 → 生成 25 个向量
   - Milvus: 25 个向量 ✅

2. 发现内容有误，重新上传 "报告.pdf"
   - 覆盖原文件
   - 转换 → 30 个 chunks (内容增加)
   - 点击"嵌入"
   
3. 系统自动处理:
   - ⭐ 删除旧的 25 个向量
   - 生成 30 个新向量
   - 插入 30 个新向量
   - Milvus: 30 个向量 ✅ (不是 55 个！)

4. 搜索时只返回最新版本的内容 ✅
```

---

## 📈 改进对比

| 指标 | 之前 | 现在 |
|------|------|------|
| 重新嵌入3次后的向量数 | 75个 (25×3) | 25个 |
| 搜索结果重复 | 是 | 否 |
| 用户需要手动清理 | 是 | 否 |
| Collection 大小 | 持续增长 | 保持合理 |
