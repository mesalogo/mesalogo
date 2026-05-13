# KnowledgeDocument 表迁移指南

## 概述

已实现 `knowledge_documents` 主表来统一管理文件元数据。本文档说明如何修改业务代码以使用新表。

---

## 已完成的工作

### 1. 数据模型
- ✅ `KnowledgeDocument` - 主表（文件元数据）
- ✅ 所有子表添加 `document_id` 外键
  - `KnowledgeFileConversion.document_id`
  - `KnowledgeFileChunk.document_id`
  - `KnowledgeFileEmbedding.document_id`

### 2. 数据库迁移
- ✅ SQL 迁移文件：`migrations/add_knowledge_documents_table.sql`

### 3. 文档管理服务
- ✅ `services/knowledge_base/document_manager.py`
  - `create_document_record()` - 创建文档记录
  - `get_document_with_status()` - 获取文档和状态
  - `list_knowledge_documents()` - 列出文档
  - `delete_document()` - 删除文档及相关数据

---

## 需要修改的业务代码

### 文件 1: `app/api/routes/knowledge.py`

#### 1.1 添加导入

```python
# 在文件开头添加
from app.services.knowledge_base.document_manager import (
    create_document_record,
    get_document_with_status,
    list_knowledge_documents,
    delete_document
)
```

#### 1.2 修改文件列表 API（Line ~600）

**当前实现**：扫描文件系统  
**需要改为**：从 `knowledge_documents` 表查询

```python
@knowledge_bp.route('/knowledges/<string:knowledge_id>/files', methods=['GET'])
def get_knowledge_files(knowledge_id):
    """获取知识库中的文件列表"""
    try:
        knowledge = Knowledge.query.get_or_404(knowledge_id)
        
        # 使用新的文档管理服务
        files = list_knowledge_documents(knowledge_id)
        
        return jsonify({
            'success': True,
            'data': files
        })
        
    except Exception as e:
        current_app.logger.error(f"获取文件列表失败: {e}")
        return jsonify({
            'success': False,
            'message': f'获取文件列表失败: {str(e)}'
        }), 500
```

#### 1.3 修改文件上传 API（Line ~690）

**需要添加**：创建 `KnowledgeDocument` 记录

```python
@knowledge_bp.route('/knowledges/<string:knowledge_id>/files', methods=['POST'])
@login_required
def upload_knowledge_file(knowledge_id):
    """上传文件到知识库"""
    try:
        # ... 现有的权限检查和文件保存逻辑 ...
        
        # 保存文件
        file_path = os.path.join(files_path, filename)
        file.save(file_path)
        
        # ⭐ 新增：创建 document 记录
        success, document, message = create_document_record(
            knowledge_id=knowledge_id,
            file_name=filename,
            file_path=filename,  # 相对路径
            physical_path=file_path  # 物理路径
        )
        
        if not success:
            # 如果创建记录失败，删除已上传的文件
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
        # 返回文档信息
        return jsonify({
            'success': True,
            'message': '文件上传成功',
            'data': get_document_with_status(document.id)
        })
        
    except Exception as e:
        current_app.logger.error(f"文件上传失败: {e}")
        return jsonify({
            'success': False,
            'message': f'文件上传失败: {str(e)}'
        }), 500
```

#### 1.4 修改文件删除 API（Line ~860）

**当前实现**：`_delete_file_related_data()` 函数  
**需要改为**：使用 `delete_document()`

```python
@knowledge_bp.route('/knowledges/<string:knowledge_id>/files/<filename>', methods=['DELETE'])
@login_required
def delete_knowledge_file(knowledge_id, filename):
    """删除知识库中的文件及其所有相关数据"""
    try:
        # 获取当前用户
        current_user = get_current_user_from_token()
        
        knowledge = Knowledge.query.get_or_404(knowledge_id)
        
        # 检查编辑权限
        if not UserPermissionService.can_edit_resource(current_user, knowledge):
            return jsonify({
                'success': False,
                'message': '无权限删除此文件'
            }), 403
        
        # 修复 URL 编码问题
        filename = fix_url_encoding(filename)
        
        # 查找 document 记录
        document = KnowledgeDocument.query.filter_by(
            knowledge_id=knowledge_id,
            file_path=filename
        ).first()
        
        if not document:
            return jsonify({
                'success': False,
                'message': '文件不存在'
            }), 404
        
        # ⭐ 使用新的删除函数
        success, message, info = delete_document(document.id)
        
        if success:
            return jsonify({
                'success': True,
                'message': message,
                'data': info
            })
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 500
            
    except Exception as e:
        current_app.logger.error(f"删除文件失败: {e}")
        return jsonify({
            'success': False,
            'message': f'删除文件失败: {str(e)}'
        }), 500
```

#### 1.5 修改转换/分块/嵌入 API

**所有创建子记录的地方**，都需要添加 `document_id`：

```python
# 示例：创建转换记录时
conversion = KnowledgeFileConversion(
    id=str(uuid.uuid4()),
    document_id=document.id,  # ⭐ 添加 document_id
    knowledge_id=knowledge_id,
    file_path=file_path,
    file_name=os.path.basename(file_path),
    status='pending'
)
```

---

## 修改清单

### 必须修改（核心功能）

- [ ] 1. 添加 `document_manager` 导入
- [ ] 2. 修改 `get_knowledge_files()` - 文件列表
- [ ] 3. 修改 `upload_knowledge_file()` - 文件上传
- [ ] 4. 修改 `delete_knowledge_file()` - 文件删除
- [ ] 5. 删除旧的 `_delete_file_related_data()` 函数

### 需要更新（子表创建）

- [ ] 6. `convert_file()` - 创建转换记录时添加 `document_id`
- [ ] 7. `chunk_file()` - 创建分块记录时添加 `document_id`
- [ ] 8. `vectorize_file()` - 创建嵌入记录时添加 `document_id`

### 需要更新（状态查询）

- [ ] 9. `get_conversion_status()` - 可选：使用 `get_document_with_status()`
- [ ] 10. `get_embedding_status()` - 可选：使用 `get_document_with_status()`

---

## 数据迁移步骤

### 步骤1: 执行 SQL 迁移

```bash
cd /Volumes/NVME_1T_ORI/my_git/abm-llm-v2/backend

# 连接数据库
mysql -u root -p your_database

# 执行迁移
source migrations/add_knowledge_documents_table.sql
```

### 步骤2: 清空现有数据（推荐）

由于是新功能，建议清空现有数据重新开始：

```sql
-- 清空所有知识库文件相关数据
TRUNCATE TABLE knowledge_file_embeddings;
TRUNCATE TABLE knowledge_file_chunks;
TRUNCATE TABLE knowledge_file_conversions;

-- 清空文件目录（手动）
# 删除 knowledgebase/*/files/* 下的所有文件
```

### 步骤3: 重启后端

```bash
# 重启后端服务，加载新模型
```

---

## 新架构的优势

### 之前的问题
- ❌ 文件元数据分散
- ❌ 没有去重机制
- ❌ 状态追踪不统一
- ❌ 删除操作复杂

### 现在的改进
- ✅ **统一文件管理** - documents 作为主表
- ✅ **文件去重** - 通过 file_hash 检测重复
- ✅ **关联清晰** - 所有子表通过 document_id 关联
- ✅ **级联删除** - 删除 document 自动删除所有相关数据
- ✅ **状态聚合** - 一次查询获取所有状态

---

## 测试清单

### 文件上传测试
- [ ] 上传新文件 → 创建 document 记录
- [ ] 上传重复文件（相同路径） → 拒绝
- [ ] 上传相同内容文件（相同hash） → 拒绝

### 文件列表测试
- [ ] 获取文件列表 → 从 documents 表查询
- [ ] 显示转换状态 → 正确关联
- [ ] 显示分块状态 → 正确关联
- [ ] 显示嵌入状态 → 正确关联

### 文件删除测试
- [ ] 删除文件 → 删除 document 记录
- [ ] 级联删除 → 转换/分块/嵌入记录都被删除
- [ ] 物理文件删除 → 文件被删除
- [ ] 向量数据删除 → Milvus 数据被删除

### 工作流测试
- [ ] 上传 → 转换 → 分块 → 嵌入 → 完整流程
- [ ] 每个步骤创建对应的记录
- [ ] 所有记录都有正确的 document_id

---

## 注意事项

### 1. document_id 必须填写
所有创建子记录（conversion/chunk/embedding）的地方，都必须提供 `document_id`。

### 2. 先创建 document
在创建任何子记录之前，必须先有 document 记录。

### 3. 兼容性考虑
如果有现有数据：
- 可以运行迁移脚本创建 document 记录
- 或者清空数据重新开始（推荐）

### 4. 文件路径
- `file_path` 是相对于 `knowledgebase/{knowledge_id}/files/` 的相对路径
- 通常就是文件名（如果文件在根目录）
- 如果有子目录，则包含子目录（如 `subdir/file.pdf`）

---

## 相关文件

- 模型定义：`app/models.py`
- 文档管理服务：`app/services/knowledge_base/document_manager.py`
- API 路由：`app/api/routes/knowledge.py`
- SQL 迁移：`migrations/add_knowledge_documents_table.sql`
- 迁移脚本：`migrate_existing_documents.py`（可选）

---

**文档版本**: v1.0  
**创建日期**: 2025-11-04  
**最后更新**: 2025-11-04  
**负责人**: ABM-LLM Team
