# 向量化功能实现说明

## 概述

本次实现了从 `knowledge_file_chunks` 表读取分段内容并进行向量化的完整流程，遵循KISS原则，直接实现新架构，不做兼容层。

## 实现的功能

### 1. 向量化服务 (`knowledge_vectorizer.py`)

**文件位置**: `app/services/knowledge_base/knowledge_vectorizer.py`

**核心功能**:
- 从 `knowledge_file_chunks` 表读取分段内容
- 调用 `embedding_service` 生成向量
- 调用 `vector_db_service` 存储向量到向量数据库
- 支持单文件向量化和批量向量化

**主要方法**:
```python
class KnowledgeVectorizer:
    def vectorize_file(knowledge_id, file_path)
        # 对单个文件的分段进行向量化
        
    def vectorize_knowledge_base(knowledge_id)
        # 对整个知识库的所有文件进行向量化
        
    def get_vectorization_status(knowledge_id, file_path=None)
        # 获取向量化状态
```

### 2. API Endpoints

**文件位置**: `app/api/routes/knowledge.py`

#### 2.1 对单个文件进行向量化
```http
POST /api/knowledges/{knowledge_id}/files/vectorize?file_path=xxx
```

**请求参数**:
- `knowledge_id` (路径参数): 知识库ID
- `file_path` (查询参数): 文件路径（相对于知识库目录）

**响应示例**:
```json
{
  "success": true,
  "message": "向量化成功",
  "data": {
    "knowledge_id": "xxx",
    "file_path": "test.pdf",
    "chunk_count": 10,
    "vector_dimension": 768,
    "embedding_model": "Ollama Embedding",
    "embedding_provider": "ollama",
    "processing_time": 1.5,
    "vector_db_info": {...}
  }
}
```

#### 2.2 对整个知识库进行向量化
```http
POST /api/knowledges/{knowledge_id}/vectorize-all
```

**响应示例**:
```json
{
  "success": true,
  "message": "向量化完成，成功 5 个文件",
  "data": {
    "knowledge_id": "xxx",
    "total_files": 5,
    "successful_count": 5,
    "failed_count": 0,
    "successful_files": [
      {
        "file_path": "doc1.pdf",
        "chunk_count": 10,
        "processing_time": 1.5
      }
    ],
    "failed_files": []
  }
}
```

#### 2.3 获取向量化状态
```http
GET /api/knowledges/{knowledge_id}/vectorization-status?file_path=xxx
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "has_chunks",
    "file_path": "test.pdf",
    "chunk_count": 10,
    "message": "已完成分段，可以进行向量化"
  }
}
```

## 完整流程

```
1. 用户上传文件
   ↓
2. 转换为 Markdown (MinerU)
   ↓
3. Chonkie 分段
   ↓
4. MySQL 存储分段 (knowledge_file_chunks 表)
   ↓ 【新实现从这里开始】
5. POST /api/knowledges/{id}/files/vectorize
   ↓
6. knowledge_vectorizer.vectorize_file()
   - 从 knowledge_file_chunks 读取分段
   - 调用 embedding_service.generate_embeddings()
   - 调用 vector_db_service.add_documents()
   ↓
7. 向量存储到向量数据库（TiDB Vector / Milvus）
   ↓
8. 完成！可以进行向量搜索
```

## 配置要求

### 1. 嵌入模型配置

在系统启动前需要配置嵌入模型（在模型配置页面或数据库中）:

```sql
-- 方案A: Ollama（推荐新产品）
INSERT INTO model_configs (
    id, name, provider, model_id, base_url,
    modalities, is_default_embedding
) VALUES (
    uuid(), 'Ollama Embedding', 'ollama', 'nomic-embed-text',
    'http://localhost:11434/api',
    '["vector_output"]', TRUE
);

-- 方案B: OpenAI
INSERT INTO model_configs (
    id, name, provider, model_id, base_url, api_key,
    modalities, is_default_embedding, additional_params
) VALUES (
    uuid(), 'OpenAI Embedding', 'openai', 'text-embedding-3-small',
    'https://api.openai.com/v1', 'sk-your-api-key',
    '["vector_output"]', TRUE, '{"dimensions": 1536}'
);
```

### 2. 向量数据库配置

在系统设置页面配置向量数据库:

```sql
-- 使用 TiDB Vector（推荐）
INSERT INTO system_settings (key, value, value_type) VALUES
('use_builtin_vector_db', 'false', 'boolean'),
('vector_db_provider', 'tidb', 'string');
```

## 测试

使用提供的测试脚本 `test_vectorization.py`:

1. 修改脚本中的配置：
   - `KNOWLEDGE_ID`: 实际的知识库ID
   - `FILE_PATH`: 已分段的文件路径
   - `TOKEN`: 认证token

2. 运行测试：
```bash
cd backend
python test_vectorization.py
```

## 注意事项

1. **必须先分段**: 向量化之前必须先对文件进行分段，否则会返回错误
2. **权限检查**: 向量化需要知识库的编辑权限
3. **嵌入模型**: 必须配置默认嵌入模型，否则向量化会失败
4. **向量数据库**: 必须配置并启动向量数据库服务

## KISS原则体现

1. **不做兼容层**: 直接实现新架构，不兼容旧的 `document_processor.py`
2. **简单直接**: 流程清晰，从 chunks 表读取 → 生成向量 → 存储
3. **最小依赖**: 复用已有的 `embedding_service` 和 `vector_db_service`
4. **统一接口**: 所有向量化操作通过 `knowledge_vectorizer` 统一管理

## 后续优化（可选）

以下功能暂未实现，保持简单：

- [ ] 向量化状态字段（vector_status, vector_id, vectorized_at）
- [ ] 异步向量化任务队列
- [ ] 向量化进度实时推送
- [ ] 向量更新和删除接口
- [ ] 批量向量化的并行处理

这些功能可以在后期根据实际需求逐步添加。

## 与旧实现的区别

| 特性 | 旧实现 (document_processor.py) | 新实现 (knowledge_vectorizer.py) |
|------|-------------------------------|----------------------------------|
| 数据来源 | 直接处理文件 | 从 knowledge_file_chunks 表读取 |
| 分段方法 | 简单分割 | 使用 Chonkie 9种专业方法 |
| 配置管理 | 硬编码 | 从系统设置读取（模型配置页面） |
| 向量数据库 | 固定 | 根据系统设置选择（TiDB/Milvus） |
| API | `/vectorize` | `/files/vectorize` |
| 架构 | 单体服务 | 分层服务（vectorizer → embedding → vector_db） |

## 结论

新的向量化实现完全基于新架构，流程清晰、易于维护和扩展。遵循KISS原则，保持了代码的简洁性，同时为未来的功能扩展预留了空间。
