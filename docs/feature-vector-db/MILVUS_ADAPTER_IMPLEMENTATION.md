# Milvus 向量数据库适配器实现文档

## 实现概述

已完成 `BuiltinVectorAdapter` (Milvus) 的完整实现，按照 `PLAN-KB-INTERNAL.md` 文档定义的结构进行存储。

**实现日期**: 2025-11-04  
**实现文件**: `backend/app/services/vector_db_service.py`  
**实现状态**: ✅ 完成

---

## Milvus Collection Schema

### 字段定义

按照文档规范，Collection 包含以下字段：

```python
fields = [
    # 主键 - chunk ID
    FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=36, is_primary=True),
    
    # 向量字段
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=dimension),
    
    # 内容字段（用于返回结果）
    FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
    
    # 文档 ID（用于过滤）
    FieldSchema(name="document_id", dtype=DataType.VARCHAR, max_length=36),
]
```

### 索引配置

使用 HNSW 索引，适合高精度搜索：

```python
index_params = {
    "metric_type": "COSINE",      # 余弦相似度
    "index_type": "HNSW",         # HNSW 算法
    "params": {
        "M": 16,                  # 每个节点的最大连接数
        "efConstruction": 200     # 构建索引时的搜索深度
    }
}
```

### Collection 命名规则

```python
collection_name = f"knowledge_{knowledge_id}"
# 例如: knowledge_8fd40cdc-ce3c-4d04-9789-7170db9951a3
```

---

## 已实现的方法

### 1. `create_knowledge_base()`

**功能**: 创建 Milvus Collection

**参数**:
- `name`: Collection 名称（knowledge_{id}）
- `dimension`: 向量维度（默认 1024）

**返回**:
```python
(success, message, info)
info = {
    'name': 'knowledge_xxx',
    'dimension': 1024,
    'index_type': 'HNSW',
    'metric_type': 'COSINE',
    'uri': 'http://localhost:19530'
}
```

**特性**:
- ✅ 自动检查 Collection 是否已存在
- ✅ 按照文档定义的 Schema 创建
- ✅ 自动创建 HNSW 索引

---

### 2. `add_documents()`

**功能**: 将向量数据保存到 Milvus

**参数**:
- `knowledge_base`: Collection 名称
- `documents`: 文档文本列表
- `metadatas`: 元数据列表，必须包含：
  - `chunk_id`: chunk UUID（作为主键）
  - `file_path`: 文件路径（作为 document_id）
  - `knowledge_id`: 知识库 ID
  - `chunk_index`: chunk 索引

**返回**:
```python
(success, message, info)
info = {
    'count': 24,
    'vector_dimension': 4096,
    'embedding_model': 'bge-m3',
    'processing_time': 25.3,
    'uri': 'http://localhost:19530'
}
```

**流程**:
1. ✅ 连接 Milvus
2. ✅ 获取 Collection
3. ✅ 使用 `embedding_service` 生成向量
4. ✅ 准备数据（按照 Schema 格式）
5. ✅ 批量插入向量
6. ✅ Flush 确保持久化

**存储的数据结构**:
```python
{
    "id": "chunk-uuid",                  # 主键
    "embedding": [0.1, 0.2, ...],       # 向量（4096维）
    "content": "文本内容...",            # 原文（最多65535字符）
    "document_id": "file.pdf"           # 文件路径
}
```

---

### 3. `search()`

**功能**: 向量相似度搜索

**参数**:
- `knowledge_base`: Collection 名称
- `query`: 查询文本
- `top_k`: 返回结果数量（默认 5）
- `filters`: 过滤条件，例如 `{'document_id': 'file.pdf'}`

**返回**:
```python
(success, results, info)
results = [
    {
        'id': 'chunk-uuid',
        'content': '文本内容...',
        'document_id': 'file.pdf',
        'score': 0.95,      # 相似度分数
        'distance': 0.05    # 向量距离
    },
    ...
]
```

**流程**:
1. ✅ 连接 Milvus
2. ✅ 加载 Collection 到内存
3. ✅ 使用 `embedding_service` 为查询生成向量
4. ✅ 构建搜索参数（COSINE + HNSW）
5. ✅ 应用过滤条件（可选）
6. ✅ 执行向量搜索
7. ✅ 返回格式化结果

**搜索参数**:
```python
search_params = {
    "metric_type": "COSINE",
    "params": {"ef": 200}  # HNSW 搜索深度
}
```

---

### 4. `delete_documents()`

**功能**: 根据 chunk ID 删除向量

**参数**:
- `knowledge_base`: Collection 名称
- `document_ids`: chunk ID 列表（主键）

**返回**:
```python
(success, message, info)
info = {
    'deleted_count': 24,
    'uri': 'http://localhost:19530'
}
```

**删除表达式示例**:
```python
delete_expr = 'id in ["chunk-id-1", "chunk-id-2", ...]'
```

---

### 5. `delete_by_metadata()`

**功能**: 根据元数据删除向量

**参数**:
- `knowledge_base`: Collection 名称
- `metadata_filter`: 元数据过滤条件
  - `{'file_path': 'doc.pdf'}` - 删除指定文件的所有 chunks
  - `{'document_id': 'doc.pdf'}` - 同上

**返回**:
```python
(success, message, info)
info = {
    'metadata_filter': {'file_path': 'doc.pdf'},
    'delete_expr': 'document_id == "doc.pdf"',
    'uri': 'http://localhost:19530'
}
```

**删除表达式示例**:
```python
delete_expr = 'document_id == "file.pdf"'
```

**注意**:
- ⚠️ `knowledge_id` 不在 Milvus Schema 中，无法按 knowledge_id 过滤
- 💡 如需按 knowledge_id 删除，应删除整个 Collection

---

## 连接管理

### 连接方法

```python
def _connect(self) -> bool:
    """建立 Milvus 连接"""
    from pymilvus import connections
    
    connections.connect(
        alias=self._connection_alias,
        host=self.host,  # 默认: localhost
        port=self.port   # 默认: 19530
    )
```

### 配置来源

从系统设置中读取：
```python
config = {
    'host': SystemSetting.get('builtin_vector_db_host', 'localhost'),
    'port': SystemSetting.get('builtin_vector_db_port', 19530)
}
```

---

## 数据流程

```
1. 文档上传
   ↓
2. 转换为 Markdown (MinerU)
   ↓
3. 文档分段 (Chonkie)
   ↓ 存储到 knowledge_file_chunks 表
4. MySQL 存储分段
   {
       id: chunk_id,
       content: "文本内容",
       knowledge_id: "xxx",
       file_path: "file.pdf",
       chunk_index: 0
   }
   ↓
5. 向量化服务读取分段
   ↓
6. 生成向量 (embedding_service)
   embedding_service.generate_embeddings(texts)
   ↓
7. 保存到 Milvus
   vector_db_service.add_documents(
       knowledge_base="knowledge_xxx",
       documents=texts,
       metadatas=[{
           'chunk_id': chunk.id,
           'file_path': chunk.file_path,
           'knowledge_id': chunk.knowledge_id,
           'chunk_index': chunk.chunk_index
       }]
   )
   ↓
8. Milvus 存储
   {
       id: chunk_id,
       embedding: [向量],
       content: "文本内容",
       document_id: "file.pdf"
   }
```

---

## 与 TiDB Vector 的对比

| 特性 | Milvus (Builtin) | TiDB Vector |
|------|-----------------|-------------|
| **部署** | 独立服务 | 统一数据库 |
| **性能** | 极高（百万级） | 中等（十万级） |
| **Schema** | 简化（4字段） | 复杂（多表关联） |
| **索引** | HNSW | IVF / HNSW |
| **维护** | 需要单独维护 | 与MySQL统一 |
| **适用场景** | 大规模、高性能 | 中小规模、统一管理 |

---

## 使用示例

### 1. 创建知识库

```python
from app.services.vector_db_service import get_vector_db_service

vector_db_service = get_vector_db_service()

success, message, info = vector_db_service.create_knowledge_base(
    name="knowledge_xxx",
    dimension=4096
)
```

### 2. 添加文档

```python
texts = ["文本1", "文本2", ...]
metadatas = [
    {
        'chunk_id': 'uuid-1',
        'file_path': 'doc.pdf',
        'knowledge_id': 'xxx',
        'chunk_index': 0
    },
    ...
]

success, message, info = vector_db_service.add_documents(
    knowledge_base="knowledge_xxx",
    documents=texts,
    metadatas=metadatas
)
```

### 3. 搜索

```python
success, results, info = vector_db_service.search(
    knowledge_base="knowledge_xxx",
    query="查询文本",
    top_k=5,
    filters={'document_id': 'doc.pdf'}
)

for result in results:
    print(f"相似度: {result['score']}")
    print(f"内容: {result['content']}")
```

### 4. 删除

```python
# 按 chunk ID 删除
success, message, info = vector_db_service.delete_documents(
    knowledge_base="knowledge_xxx",
    document_ids=['chunk-id-1', 'chunk-id-2']
)

# 按文件路径删除
success, message, info = vector_db_service.delete_by_metadata(
    knowledge_base="knowledge_xxx",
    metadata_filter={'file_path': 'doc.pdf'}
)
```

---

## 依赖要求

### Python 包

```bash
pip install pymilvus>=2.4.0
```

### Milvus 服务

默认连接配置：
- **Host**: localhost
- **Port**: 19530

---

## 错误处理

### 常见错误

1. **pymilvus 库未安装**
   ```
   错误: pymilvus 库未安装，请运行: pip install pymilvus
   解决: pip install pymilvus
   ```

2. **无法连接到 Milvus**
   ```
   错误: Milvus 连接失败
   解决: 检查 Milvus 服务是否启动，确认 host 和 port 配置正确
   ```

3. **Collection 不存在**
   ```
   错误: Collection not found
   解决: 先调用 create_knowledge_base() 创建 Collection
   ```

4. **向量维度不匹配**
   ```
   错误: Dimension mismatch
   解决: 确保嵌入模型的向量维度与 Collection 创建时指定的维度一致
   ```

---

## 性能优化

### 批量插入

- ✅ 已实现批量插入（一次插入多个向量）
- 建议批次大小：100-1000 条

### 索引优化

HNSW 参数调优：
- `M`: 连接数（默认 16）
  - 更大 = 更高精度，更多内存
- `efConstruction`: 构建深度（默认 200）
  - 更大 = 更高精度，更慢构建
- `ef`: 搜索深度（默认 200）
  - 更大 = 更高召回率，更慢搜索

### 内存管理

- ✅ Collection 自动加载到内存
- ✅ 搜索前自动 `collection.load()`
- 💡 可选：搜索后 `collection.release()` 释放内存（未实现）

---

## 测试清单

### 功能测试

- [ ] 创建 Collection
- [ ] 插入向量数据
- [ ] 向量搜索
- [ ] 按 ID 删除
- [ ] 按元数据删除

### 集成测试

- [ ] 完整向量化流程：上传 → 转换 → 分段 → 向量化 → 保存
- [ ] 搜索准确性验证
- [ ] 删除级联测试

### 性能测试

- [ ] 批量插入性能（1000条）
- [ ] 搜索响应时间（< 50ms）
- [ ] 并发搜索测试（10 QPS）

---

## 后续优化

### 短期优化

- [ ] 添加连接池管理
- [ ] 实现 Collection 预加载
- [ ] 添加批量操作限流

### 长期优化

- [ ] 支持混合搜索（向量 + 关键词）
- [ ] 实现 Reranking
- [ ] 添加向量压缩（PQ/SQ）
- [ ] 支持多副本和高可用

---

## 总结

✅ **已完成**:
1. ✅ 按照文档定义实现了完整的 Milvus 适配器
2. ✅ 支持创建、插入、搜索、删除操作
3. ✅ 使用 HNSW 索引，适合高精度搜索
4. ✅ 集成 embedding_service，自动生成向量
5. ✅ 完善的错误处理和日志记录

✅ **优势**:
- 高性能：HNSW 索引，适合百万级数据
- 简单：4字段 Schema，易于理解和维护
- 灵活：支持按 ID 和元数据删除
- 统一：通过 VectorDBService 统一接口调用

✅ **适用场景**:
- 大规模知识库（>10万 chunks）
- 高并发搜索（>10 QPS）
- 追求极致性能和召回率

---

**文档版本**: v1.0  
**创建日期**: 2025-11-04  
**最后更新**: 2025-11-04  
**负责人**: ABM-LLM Team
