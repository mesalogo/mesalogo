# API 修改完成总结

## ✅ 已完成的修改

### 1. 添加导入 ✅
```python
from app.services.knowledge_base.document_manager import (
    create_document_record,
    get_document_with_status,
    list_knowledge_documents,
    delete_document
)
```

### 2. 文件列表 API ✅
- **函数**: `get_knowledge_files()`
- **行号**: ~606
- **修改**: 从扫描文件系统改为查询 `knowledge_documents` 表
- **代码**: 使用 `list_knowledge_documents(knowledge_id)`

### 3. 文件上传 API ✅
- **函数**: `upload_knowledge_file()`
- **行号**: ~626
- **修改**: 上传后创建 `KnowledgeDocument` 记录
- **代码**: 使用 `create_document_record()`
- **优点**: 
  - 自动计算文件 hash（去重）
  - 自动计算文件大小
  - 失败时自动删除已上传文件

### 4. 文件删除 API ✅
- **函数**: `delete_knowledge_file()`
- **行号**: ~724
- **修改**: 删除 `_delete_file_related_data()` 函数，使用 `delete_document()`
- **优点**:
  - 级联删除所有相关数据
  - 自动删除转换记录、分块、嵌入、向量
  - 自动删除物理文件和 markdown 文件

---

## ⚠️ 还需要修改的API

这些 API 在创建子记录时需要添加 `document_id` 字段。

### 1. 转换 API - `convert_file()`

**位置**: Line ~1289  
**需要修改**: 创建 `KnowledgeFileConversion` 记录时添加 `document_id`

**当前代码**:
```python
conversion = KnowledgeFileConversion(
    id=str(uuid.uuid4()),
    knowledge_id=knowledge_id,
    file_path=file_path,
    file_name=os.path.basename(file_path),
    status='pending'
)
```

**需要改为**:
```python
# 先查找 document 记录
document = KnowledgeDocument.query.filter_by(
    knowledge_id=knowledge_id,
    file_path=file_path
).first()

if not document:
    return jsonify({
        'success': False,
        'message': '文件记录不存在，请先上传文件'
    }), 404

conversion = KnowledgeFileConversion(
    id=str(uuid.uuid4()),
    document_id=document.id,  # ⭐ 添加
    knowledge_id=knowledge_id,
    file_path=file_path,
    file_name=os.path.basename(file_path),
    status='pending'
)
```

### 2. 分块 API - `chunk_file()`

**位置**: Line ~1547  
**需要修改**: 创建 `KnowledgeFileChunk` 记录时添加 `document_id`

**查找 document**:
```python
document = KnowledgeDocument.query.filter_by(
    knowledge_id=knowledge_id,
    file_path=file_path
).first()

if not document:
    return jsonify({
        'success': False,
        'message': '文件记录不存在'
    }), 404
```

**创建 chunk 时**:
```python
chunk = KnowledgeFileChunk(
    id=str(uuid.uuid4()),
    document_id=document.id,  # ⭐ 添加
    knowledge_id=knowledge_id,
    file_path=file_path,
    chunk_index=idx,
    content=chunk_text,
    chunk_metadata=metadata
)
```

### 3. 向量化 API - `vectorize_file_new()`

**位置**: Line ~1855  
**需要修改**: 如果创建 `KnowledgeFileEmbedding` 记录，需要添加 `document_id`

**注意**: 当前实现使用的是 `knowledge_vectorizer_simple.py`，该服务也需要更新。

---

## 📋 修改步骤建议

### 步骤1: 修改转换 API ⚙️

```bash
# 定位到 convert_file() 函数
# 在创建 conversion 记录前添加查找 document 的代码
# 添加 document_id 字段
```

### 步骤2: 修改分块服务 ⚙️

由于分块可能批量创建记录，建议在 `document_chunker.py` 服务中修改：

```python
def chunk_markdown(knowledge_id, file_path, markdown_content, chunker_config):
    # 查找 document
    document = KnowledgeDocument.query.filter_by(
        knowledge_id=knowledge_id,
        file_path=file_path
    ).first()
    
    if not document:
        raise ValueError(f"文件记录不存在: {file_path}")
    
    # ... chunking logic ...
    
    # 创建 chunks 时添加 document_id
    for idx, chunk in enumerate(chunks):
        db_chunk = KnowledgeFileChunk(
            id=str(uuid.uuid4()),
            document_id=document.id,  # ⭐
            knowledge_id=knowledge_id,
            file_path=file_path,
            chunk_index=idx,
            content=chunk['text'],
            chunk_metadata=chunk.get('metadata')
        )
        db.session.add(db_chunk)
```

### 步骤3: 修改向量化服务 ⚙️

在 `knowledge_vectorizer_simple.py` 中：

```python
def vectorize_file(knowledge_id: str, file_path: str):
    # 查找 document
    document = KnowledgeDocument.query.filter_by(
        knowledge_id=knowledge_id,
        file_path=file_path
    ).first()
    
    if not document:
        return False, {'error': f'文件记录不存在: {file_path}'}
    
    # 读取 chunks（使用 document_id）
    chunks = KnowledgeFileChunk.query.filter_by(
        document_id=document.id  # ⭐ 可选：使用 document_id 而不是 knowledge_id + file_path
    ).order_by(KnowledgeFileChunk.chunk_index).all()
    
    # ... rest of vectorization logic ...
```

---

## 🔧 数据库迁移

### 执行 SQL 迁移

```bash
cd /Volumes/NVME_1T_ORI/my_git/abm-llm-v2/backend

# 连接数据库
mysql -u root -p your_database

# 执行迁移
source migrations/add_knowledge_documents_table.sql

# 验证表创建
SHOW TABLES LIKE 'knowledge%';
DESC knowledge_documents;
```

### 清空现有数据（推荐）

```sql
-- 清空所有知识库文件相关数据
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE TABLE knowledge_file_embeddings;
TRUNCATE TABLE knowledge_file_chunks;
TRUNCATE TABLE knowledge_file_conversions;
TRUNCATE TABLE knowledge_documents;
SET FOREIGN_KEY_CHECKS=1;
```

### 手动清空文件

```bash
# 清空所有知识库文件
rm -rf /path/to/knowledgebase/*/files/*
rm -rf /path/to/knowledgebase/*-markdown/*
```

---

## ✅ 测试清单

### 文件上传测试
- [ ] 上传新文件 → 自动创建 document 记录
- [ ] 上传重复文件（相同路径） → 报错"文件已存在"
- [ ] 上传相同内容文件（相同hash） → 报错"文件内容重复"
- [ ] 上传后查看文件列表 → 显示正确

### 文件列表测试
- [ ] 获取文件列表 → 从 documents 表查询
- [ ] 显示所有状态 → conversion/chunking/embedding 状态正确

### 文件删除测试
- [ ] 删除文件 → 级联删除所有数据
- [ ] 删除后查看列表 → 文件已消失
- [ ] 验证数据库 → 所有相关记录已删除
- [ ] 验证文件系统 → 物理文件已删除

### 转换/分块/向量化测试（修改后）
- [ ] 转换文件 → 创建 conversion 记录（带 document_id）
- [ ] 分块文件 → 创建 chunk 记录（带 document_id）
- [ ] 向量化文件 → 创建 embedding 记录（带 document_id）
- [ ] 完整流程 → 上传→转换→分块→向量化 全部成功

---

## 📊 修改状态

| API 函数 | 状态 | document_id | 备注 |
|----------|------|-------------|------|
| `get_knowledge_files()` | ✅ 完成 | N/A | 从 documents 表查询 |
| `upload_knowledge_file()` | ✅ 完成 | 创建 | 使用 create_document_record() |
| `delete_knowledge_file()` | ✅ 完成 | 级联删除 | 使用 delete_document() |
| `convert_file()` | ⚠️ 待修改 | 需添加 | 创建 conversion 时 |
| `chunk_file()` | ⚠️ 待修改 | 需添加 | 创建 chunks 时 |
| `vectorize_file()` | ⚠️ 待修改 | 需添加 | 创建 embedding 时 |
| `document_chunker.py` | ⚠️ 待修改 | 需添加 | 服务层修改 |
| `knowledge_vectorizer_simple.py` | ⚠️ 待修改 | 需添加 | 服务层修改 |

---

## 🎯 建议顺序

1. **先执行数据库迁移**（SQL + 清空数据）
2. **重启后端**（加载新模型）
3. **测试文件上传/列表/删除**（已完成的功能）
4. **修改转换API**（添加 document_id）
5. **修改分块服务**（添加 document_id）
6. **修改向量化服务**（添加 document_id）
7. **端到端测试**（完整流程）

---

**文档版本**: v1.0  
**创建日期**: 2025-11-04  
**最后更新**: 2025-11-04  
**完成度**: 50% (3/6 主要API)
