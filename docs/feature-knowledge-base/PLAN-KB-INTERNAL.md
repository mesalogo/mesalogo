# ABM-LLM 内置知识库系统（KISS 版本）

> **设计原则**: Keep It Simple, Stupid - 先做最简单能工作的版本

## 目录

- [1. 快速开始](#1-快速开始)
- [2. 系统概述](#2-系统概述)
- [3. 核心功能](#3-核心功能)
- [4. API 接口](#4-api-接口)
- [5. 数据库设计](#5-数据库设计)
- [6. 技术架构](#6-技术架构)
- [7. 最近更新](#7-最近更新)

---

## 1. 快速开始

### 1.1 推荐配置（5分钟部署）

**方案A：Ollama + TiDB Vector**（免费，推荐）

```bash
# 1. 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull nomic-embed-text

# 2. 配置数据库
mysql -u root -p abm_llm << EOF
INSERT INTO model_configs (name, provider, model_id, modalities, is_default_embedding) 
VALUES ('Ollama Embedding', 'ollama', 'nomic-embed-text', '["vector_output"]', TRUE);

INSERT INTO system_settings (key, value, value_type) VALUES
('use_builtin_vector_db', 'false', 'boolean'),
('vector_db_provider', 'tidb', 'string');
EOF
```

**方案B：OpenAI + TiDB Vector**（质量最好）

```sql
-- 配置 OpenAI 嵌入模型
INSERT INTO model_configs (
    name, provider, model_id, api_key,
    modalities, is_default_embedding
) VALUES (
    'OpenAI Embedding', 'openai', 'text-embedding-3-small', 'sk-your-key',
    '["vector_output"]', TRUE
);

-- 配置向量数据库（同方案A）
INSERT INTO system_settings (key, value, value_type) VALUES
('use_builtin_vector_db', 'false', 'boolean'),
('vector_db_provider', 'tidb', 'string');
```

### 1.2 使用流程

```
1. 上传文档 → 2. 转换 → 3. 分段 → 4. 嵌入 → 5. 搜索
   (支持中文名)   (Markdown)  (Chonkie)  (向量化)   (RAG)
```

---

## 2. 系统概述

### 2.1 核心目标

- ✅ **简单可靠**：最少的代码，最少的依赖
- ✅ **快速上线**：开箱即用，5分钟配置完成
- ✅ **数据安全**：支持本地部署（Ollama）
- ✅ **高质量检索**：语义搜索 + 向量相似度

### 2.2 技术选型（KISS原则）

| 组件 | 推荐方案 | 备选方案 |
|------|---------|---------|
| **文档解析** | MinerU | - |
| **分段方法** | Chonkie Recursive | 其他8种方法 |
| **嵌入模型** | Ollama / OpenAI | Builtin模型 |
| **向量数据库** | TiDB Vector | Milvus |
| **元数据存储** | MySQL | - |

### 2.3 数据流程

```
文档上传 → 转换(MinerU) → 分段(Chonkie) → 嵌入(Ollama/OpenAI) → 向量存储(TiDB/Milvus)
   ↓           ↓              ↓                ↓                    ↓
 MySQL     Markdown文件   MySQL(chunks)    生成向量           向量数据库
```

---

## 3. 核心功能 ✅ 已全部实现

### 3.1 文档管理

- ✅ 文件上传（支持中文文件名）
- ✅ 文件列表查看
- ✅ 文件删除（级联删除所有关联数据）
- ✅ 文件去重（基于 SHA256 hash）

### 3.2 文档转换

- ✅ PDF/Word/Excel → Markdown
- ✅ 异步转换任务
- ✅ 转换状态跟踪（pending/processing/completed/failed）
- ✅ MinerU 解析器集成
- ✅ Markdown 预览功能

### 3.3 文档分段

- ✅ 9种分段方法（Chonkie库）
- ✅ 推荐方法：Recursive + Semantic策略
- ✅ 自定义分段配置（chunk_size, overlap等）
- ✅ 分段预览功能
- ✅ 分段状态跟踪

**支持的分段方法**：
- **recursive** ⭐ 推荐：智能识别段落、句子边界
- token：精确 token 控制
- sentence：句子级分割
- semantic：语义分割
- table：表格专用
- code：代码专用
- late：高级RAG
- neural：神经网络分割
- slumber：LLM分割

### 3.4 向量化

- ✅ 嵌入服务（统一接口）
- ✅ 支持 Ollama 模型
- ✅ 支持 OpenAI API
- ✅ 支持 Builtin 模型
- ✅ 批量并行生成向量
- ✅ 向量存储到数据库
- ✅ 自动选择向量数据库（TiDB/Milvus）

### 3.5 数据一致性 ⭐ 新增

- ✅ 级联清理机制（2025-11-05）
  - 重新转换：清理 chunks + embeddings + 向量
  - 重新分段：清理 embeddings + 向量
  - 重新嵌入：清理旧向量
- ✅ 状态自动同步
- ✅ 错误容忍处理

### 3.6 搜索功能

- ✅ 语义搜索（向量相似度）
- ✅ Top-K 结果返回
- ✅ 结果相似度评分
- ⚠️ 混合搜索（向量+关键词）- 待实现
- ⚠️ 搜索重排序（Reranking）- 待实现

---

## 4. API 接口 ✅ 已统一

### 4.1 文档管理

```http
# 上传文件
POST /api/knowledges/{kb_id}/files
Content-Type: multipart/form-data

# 获取文件列表
GET /api/knowledges/{kb_id}/files

# 删除文件
DELETE /api/knowledges/{kb_id}/files/{filename}
```

### 4.2 文档处理（统一使用 document_id）

```http
# 转换文档
POST /api/knowledges/{kb_id}/documents/{doc_id}/convert

# 查询转换状态
GET /api/knowledges/{kb_id}/documents/{doc_id}/conversion-status

# 查看 Markdown
GET /api/knowledges/{kb_id}/documents/{doc_id}/markdown

# 分段文档
POST /api/knowledges/{kb_id}/documents/{doc_id}/chunk

# 查询分段状态
GET /api/knowledges/{kb_id}/documents/{doc_id}/chunking-status

# 查看分段
GET /api/knowledges/{kb_id}/documents/{doc_id}/chunks

# 向量化文档
POST /api/knowledges/{kb_id}/documents/{doc_id}/vectorize

# 查询嵌入状态
GET /api/knowledges/{kb_id}/documents/{doc_id}/embedding-status
```

### 4.3 分段配置

```http
# 获取分段配置
GET /api/knowledges/{kb_id}/chunk-config

# 更新分段配置
PUT /api/knowledges/{kb_id}/chunk-config
Content-Type: application/json

{
  "method": "recursive",
  "config": {
    "tokenizer": "gpt2",
    "chunk_size": 512,
    "chunking_strategy": "semantic"
  }
}
```

### 4.4 搜索

```http
# 搜索知识库
POST /api/knowledges/{kb_id}/search
Content-Type: application/json

{
  "query": "人工智能的应用",
  "top_k": 5
}
```

---

## 5. 数据库设计

### 5.1 核心表结构

#### knowledges（知识库）
```sql
CREATE TABLE knowledges (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(50),  -- 'knowledge'
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    -- 多租户字段
    created_by VARCHAR(36),  -- NULL=系统资源
    is_shared BOOLEAN DEFAULT FALSE
);
```

#### knowledge_documents（文档）
```sql
CREATE TABLE knowledge_documents (
    id VARCHAR(36) PRIMARY KEY,
    knowledge_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,  -- 相对路径
    file_hash VARCHAR(64),  -- SHA256去重
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'uploaded',
    created_at TIMESTAMP,
    UNIQUE INDEX idx_knowledge_file (knowledge_id, file_path),
    FOREIGN KEY (knowledge_id) REFERENCES knowledges(id) ON DELETE CASCADE
);
```

#### knowledge_file_conversions（转换记录）
```sql
CREATE TABLE knowledge_file_conversions (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    knowledge_id VARCHAR(36) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending/processing/completed/failed
    parser_tool VARCHAR(50),  -- 'mineru'
    markdown_path VARCHAR(500),  -- 转换后的markdown路径
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);
```

#### knowledge_file_chunks（分段）
```sql
CREATE TABLE knowledge_file_chunks (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    knowledge_id VARCHAR(36) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    chunk_metadata JSON,  -- 分段方法、参数等
    created_at TIMESTAMP,
    INDEX idx_document (document_id),
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);
```

#### knowledge_file_embeddings（嵌入记录）
```sql
CREATE TABLE knowledge_file_embeddings (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    knowledge_id VARCHAR(36) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending/processing/completed/failed
    embedding_model VARCHAR(100),  -- 使用的模型
    vector_count INTEGER,  -- 向量数量
    vector_dimension INTEGER,  -- 向量维度
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    UNIQUE INDEX idx_document (document_id),
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);
```

#### chunk_configs（分段配置）
```sql
CREATE TABLE chunk_configs (
    id VARCHAR(36) PRIMARY KEY,
    knowledge_id VARCHAR(36) NOT NULL,
    method VARCHAR(50) NOT NULL DEFAULT 'recursive',
    config JSON NOT NULL,  -- 分段参数
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE INDEX idx_knowledge (knowledge_id),
    FOREIGN KEY (knowledge_id) REFERENCES knowledges(id) ON DELETE CASCADE
);
```

### 5.2 向量数据库

**Milvus Collection Schema**:
```python
fields = [
    FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=36, is_primary=True),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1024),
    FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
    FieldSchema(name="document_id", dtype=DataType.VARCHAR, max_length=36),
]
```

---

## 6. 技术架构

### 6.1 目录结构

```
backend/app/
├── api/routes/
│   └── knowledge.py                    # API路由 ✅
│
├── services/
│   ├── vector_db/
│   │   ├── embedding_service.py        # 嵌入服务 ✅
│   │   ├── tidb_vector_service.py      # TiDB适配器 ✅
│   │   ├── builtin_vector_adapter.py   # Milvus适配器 ✅
│   │   └── vector_operations.py        # 向量操作 ✅
│   │
│   ├── knowledge_base/
│   │   ├── chunking/
│   │   │   ├── chonkie_wrapper.py      # Chonkie包装器 ✅
│   │   │   └── config.py               # 分段配置 ✅
│   │   ├── document_chunker.py         # 文档分段 ✅
│   │   ├── document_converter.py       # 文档转换 ✅
│   │   ├── document_manager.py         # 文档管理 ✅
│   │   └── knowledge_vectorizer_simple.py  # 向量化 ✅
│   │
│   └── vector_db_service.py            # 向量DB统一接口 ✅
│
└── models.py                            # 数据模型 ✅

frontend/src/
├── pages/knowledgebase/
│   └── DocumentManager.js              # 文档管理UI ✅
│
└── services/api/
    └── knowledge.js                    # API调用 ✅
```

### 6.2 数据依赖关系

```
文档上传 (knowledge_documents)
    ↓
转换 (knowledge_file_conversions) → Markdown文件
    ↓
分段 (knowledge_file_chunks)
    ↓
嵌入 (knowledge_file_embeddings) → 向量数据库
```

**级联清理规则**：
- 重新转换 → 清理 chunks + embeddings + 向量
- 重新分段 → 清理 embeddings + 向量
- 重新嵌入 → 清理旧向量
- 删除文档 → 级联删除所有关联数据

### 6.3 状态管理

系统通过查询关联表来动态判断状态：

| 状态类型 | 判断依据 |
|---------|---------|
| **转换状态** | `KnowledgeFileConversion.status` |
| **分段状态** | `KnowledgeFileChunk` 记录数量 |
| **嵌入状态** | `KnowledgeFileEmbedding.status` |

---

## 7. 最近更新

### v3.3 (2025-11-05)

**✅ 数据依赖关系修复**
- 实现完整的级联清理机制
- 重新转换/分段/嵌入时自动清理下游失效数据
- 状态自动同步更新

**✅ API 路由统一**
- 删除旧的基于 `file_path` 的路由
- 统一使用 `document_id` 的 RESTful 路由
- 前端调用全面更新

**✅ 错误处理优化**
- Milvus "collection not loaded" 优雅处理
- 减少日志噪音
- 提高系统健壮性

### v3.2 (2025-10-28)

**✅ 文档分段功能**
- 集成 Chonkie 库，支持 9 种分段方法
- 实现分段配置管理
- 存储分段内容到数据库

**✅ 嵌入服务**
- 统一的嵌入服务接口
- 支持 Ollama/OpenAI/Builtin 模型
- 批量并行生成向量

**✅ 向量化功能**
- 读取 chunks 表进行向量化
- 自动选择向量数据库
- 异步向量化任务

### v3.1 (2025-10-01)

**✅ 基础功能**
- 文档上传和管理
- 文档转换（MinerU）
- Markdown 预览

---

## 8. 待优化功能（可选）

### 8.1 搜索增强

- [ ] 混合搜索（向量 + 关键词）
- [ ] 搜索重排序（Reranking）
- [ ] 搜索结果高亮

### 8.2 Milvus 完善

- [ ] 完善 Milvus 适配器
- [ ] 数据迁移工具（TiDB ↔ Milvus）
- [ ] 性能优化

### 8.3 高级功能

- [ ] 文档版本控制
- [ ] 增量更新
- [ ] 搜索缓存

---

## 9. 故障排查

### 9.1 常见问题

**Q: 向量化失败，提示"未找到默认嵌入模型"**

A: 检查 `model_configs` 表是否有 `is_default_embedding=TRUE` 的记录。

**Q: Milvus 报错 "collection not loaded"**

A: 已优化处理，系统会自动尝试加载 collection，无需手动处理。

**Q: 中文文件名上传失败**

A: 已修复，系统使用 `document_id` (UUID) 而不是文件名作为标识。

**Q: 重新分段后，嵌入状态没有重置**

A: 已修复级联清理机制（v3.3），重新分段会自动清理嵌入数据。

---

## 10. 参考资料

### 10.1 相关文档

- `/tmp/data_dependency_fix_summary.md` - 数据依赖关系修复详情
- `/tmp/api_routes_fix_summary.md` - API 路由迁移详情
- `/tmp/frontend_api_calls_fix_summary.md` - 前端调用修复详情
- `docs/VECTOR_DATABASE_PROVIDERS.md` - 向量数据库对比

### 10.2 技术文档

- [Chonkie 文档](https://github.com/bhavnicksm/chonkie)
- [Milvus 文档](https://milvus.io/docs)
- [Ollama 文档](https://ollama.com/docs)

---

**文档版本**: v4.0 (精简版)  
**创建日期**: 2025-10-03  
**最后更新**: 2025-11-05  
**设计原则**: Keep It Simple, Stupid  
**负责人**: ABM-LLM Team
