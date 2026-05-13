# 知识库分段设置功能设计方案

> **版本**: v2.0 (Chonkie Edition)  
> **创建日期**: 2025-10-03  
> **更新日期**: 2025-10-03  
> **核心技术**: Chonkie - 专为RAG优化的轻量级分段库  
> **设计原则**: 灵活配置 + 开箱即用 + 高性能

---

## 1. 功能概述

### 1.1 背景
基于 `PLAN-KB-INTERNAL.md` 的知识库架构，需要为每个知识库提供灵活的分段配置功能。不同类型的文档（技术文档、学术论文、代码文档等）需要不同的分段策略以优化检索效果。

经过技术选型对比，我们选择 **Chonkie** 作为核心分段引擎：
- ✅ 专为 RAG 应用设计
- ✅ 超轻量（21MB vs LangChain 171MB）
- ✅ 超高性能（33x faster token chunking）
- ✅ 支持多种分段策略
- ✅ 与现有 sentence-transformers 无缝集成
- ✅ 活跃社区（3000+ GitHub stars）

### 1.2 核心目标
- ✅ **灵活配置**: 每个知识库可独立配置分段策略
- ✅ **多种方法**: 支持 Chonkie 提供的多种分段方法
- ✅ **合理默认**: 提供开箱即用的默认配置
- ✅ **参数可调**: 允许用户精细调整参数
- ✅ **向后兼容**: 已有知识库自动使用默认配置
- ✅ **高性能**: 利用 Chonkie 的性能优势

### 1.3 功能入口
- **位置**: 知识库内部页面（`/knowledgebase/[id]/settings`）
- **名称**: "分段设置"（原"索引设置"更名）
- **权限**: 知识库所有者和管理员可修改

---

## 2. 技术选型：Chonkie

### 2.1 为什么选择 Chonkie？

**与主流方案对比**：

| 特性 | Chonkie | LangChain | LlamaIndex | RAGFlow |
|------|---------|-----------|------------|---------|
| **包大小** | 21MB | 171MB | 80MB | 需部署 |
| **Token分块速度** | **33x faster** | 1x | - | - |
| **RAG优化** | ✅ 专门设计 | ✅ 通用 | ✅ 通用 | ✅ 专门 |
| **多策略支持** | ✅ 6种+ | ✅ 多种 | ✅ 多种 | ✅ 8种模板 |
| **语义分段** | ✅ | ✅ | ✅ | ✅ (CV模型) |
| **代码分段** | ✅ 专门 | ❌ | ❌ | ❌ |
| **无外部依赖** | ✅ 基础功能 | ❌ | ❌ | ❌ |
| **易集成** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

### 2.2 Chonkie 核心特性

```python
# 1. 轻量快速
import chonkie  # 仅 21MB，无额外依赖

# 2. 多策略支持
from chonkie import (
    RecursiveChunker,      # 递归分割（推荐）
    SemanticChunker,       # 语义分割
    SentenceChunker,       # 句子分割
    TokenChunker,          # Token分割
    CodeChunker,           # 代码专用
    SDPMChunker            # 语义双池化
)

# 3. 统一接口
chunks = chunker.chunk(text)  # 简单一致

# 4. 性能优化
# - 多线程 tokenization
# - 主动缓存
# - 运行时均值池化
```

---

## 3. 支持的分段方法

### 3.1 完整方法列表

| 方法名称 | Chonkie实现 | 适用场景 | 性能 | 需要模型 | 优先级 |
|---------|------------|---------|------|----------|----------|
| **递归分割** | RecursiveChunker | 通用文档、技术文档、Markdown | ⚡⚡⚡ 极快 | ❌ | Phase 1 ✅ |
| **Token分割** | TokenChunker | 精确token控制 | ⚡⚡⚡ 极快 | ❌ | Phase 1 ✅ |
| **句子分割** | SentenceChunker | 短文本、对话、问答 | ⚡⚡⚡ 极快 | ❌ | Phase 1 ✅ |
| **Late分割** | LateChunker | RAG应用（核心场景） | ⚡⚡ 快 | ✅ sentence-transformers | Phase 2 🔥 |
| **表格分割** | TableChunker | 包含Markdown表格的文档 | ⚡⚡⚡ 极快 | ❌ | Phase 2 ⭐ |
| **语义分割** | SemanticChunker | 学术论文、长文章、主题切换频繁 | ⚡⚡ 快 | ✅ sentence-transformers | Phase 2 ✅ |
| **代码分割** | CodeChunker | 代码文档、API文档 | ⚡⚡⚡ 极快 | ❌ | Phase 2 ✅ |
| **神经网络分割** | NeuralChunker | 最高语义准确度 | ⚡⚡ 快 | ✅ BERT模型 | Phase 3 🔄 |
| **LLM分割** | SlumberChunker | 极高质量要求 | ⚡ 慢 | ✅ LLM API | Phase 3 🔄 |

### 3.2 完整配置方案（一次性纳入，分阶段启用）

**设计原则**：所有 9 种 Chonkie 方法一次性纳入配置，数据库和 UI 支持全部方法，按阶段解锁功能。

#### **Phase 1: 核心方法（已完成）**

1. ✅ **RecursiveChunker**（默认推荐）
   - 适用场景：90%的文档，通用场景
   - 特点：智能识别段落、句子边界
   - 安装：Default（无需额外依赖）
   - 性能：⚡⚡⚡ 极快

2. ✅ **TokenChunker**
   - 适用场景：需要精确token控制
   - 特点：与embedding模型token限制完美匹配
   - 安装：Default（无需额外依赖）
   - 性能：⚡⚡⚡ 极快

3. ✅ **SentenceChunker**
   - 适用场景：短文本、对话、问答
   - 特点：保持句子完整性
   - 安装：Default（无需额外依赖）
   - 性能：⚡⚡⚡ 极快

#### **Phase 2: 高级方法（配置已就位，待解锁）**

4. 🔥 **LateChunker**（优先级最高）
   - 适用场景：RAG应用（我们的核心场景）
   - 特点：专为RAG设计，Late Chunking算法，显著提升检索召回率
   - 安装：chonkie[embeddings]
   - 依赖：sentence-transformers（项目已有）
   - 性能：⚡⚡ 快

5. ⭐ **TableChunker**（强烈推荐）
   - 适用场景：包含Markdown表格的文档
   - 特点：按行分割表格，保留表头结构
   - 安装：Default（无需额外依赖）
   - 性能：⚡⚡⚡ 极快

6. ✅ **SemanticChunker**
   - 适用场景：检索精度要求高的场景
   - 特点：基于语义相似度分割，检索准确率+30-50%
   - 安装：chonkie[embeddings]
   - 依赖：sentence-transformers
   - 性能：⚡⚡ 快
   - 提示：首次使用需加载模型（~200MB）

7. ✅ **CodeChunker**
   - 适用场景：代码库文档、API文档
   - 特点：基于AST理解代码结构
   - 安装：chonkie[all]
   - 性能：⚡⚡⚡ 极快

#### **Phase 3: 专业方法（配置已就位，未来启用）**

8. 🔄 **NeuralChunker**
   - 适用场景：需要最高语义准确度
   - 特点：使用fine-tuned BERT模型检测语义变化
   - 安装：chonkie[all]
   - 依赖：BERT模型（~400MB）
   - 性能：⚡⚡ 快

9. 🔄 **SlumberChunker**
   - 适用场景：极高质量要求的场景
   - 特点：使用LLM进行代理式分块（Agentic Chunking），S-tier质量
   - 安装：chonkie[all]
   - 依赖：LLM API（OpenAI/Anthropic等）
   - 性能：⚡ 慢（成本高，质量最优）
   - 备注：适合作为高级付费功能

#### **分阶段启用策略**

```
数据库/UI层（一次性完成）：
├─ 配置支持全部 9 种方法（JSON存储）
├─ UI 展示全部 9 种方法
└─ 未启用方法显示"即将推出"

功能层（分阶段解锁）：
├─ Phase 1: 3种基础方法 ✅
├─ Phase 2: 4种高级方法（解锁 LateChunker 等）
└─ Phase 3: 2种专业方法（解锁 NeuralChunker 等）
```

---

## 4. 配置参数设计

### 4.1 通用参数

所有 Chonkie 分段方法共享的参数：

| 参数名 | 类型 | 默认值 | 说明 | 限制 |
|--------|------|--------|------|------|
| `chunk_size` | int | 512 | 目标分块大小（token或字符数） | 100-2048 |
| `chunk_overlap` | int | 128 | 重叠大小（token或字符数） | 0-512 |

### 4.2 方法特定参数

#### 4.2.1 RecursiveChunker（递归分割）

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `chunk_size` | int | 512 | 目标块大小 |
| `chunk_overlap` | int | 128 | 重叠大小 |
| `separators` | list | `["\n\n", "\n", ". ", "。", " "]` | 分隔符优先级 |

**示例配置**：
```json
{
  "method": "recursive",
  "config": {
    "chunk_size": 512,
    "chunk_overlap": 128,
    "separators": ["\n\n", "\n", ". ", "。", " "]
  }
}
```

#### 4.2.2 SemanticChunker（语义分割）⚡

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `embedding_model` | str | `all-MiniLM-L6-v2` | Sentence Transformer模型 |
| `similarity_threshold` | float | 0.5 | 语义相似度阈值（0-1） |
| `similarity_percentile` | float | null | 百分位阈值（替代固定阈值） |

**示例配置**：
```json
{
  "method": "semantic",
  "config": {
    "embedding_model": "all-MiniLM-L6-v2",
    "similarity_threshold": 0.5
  }
}
```

**注意**：需要用户确认使用语义分段（会加载~200MB模型）

#### 4.2.3 SentenceChunker（句子分割）

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `min_sentences_per_chunk` | int | 1 | 每个块最少句子数 |
| `max_sentences_per_chunk` | int | 10 | 每个块最多句子数 |

**示例配置**：
```json
{
  "method": "sentence",
  "config": {
    "min_sentences_per_chunk": 2,
    "max_sentences_per_chunk": 8
  }
}
```

#### 4.2.4 TokenChunker（Token分割）

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `chunk_size` | int | 512 | 目标token数量 |
| `chunk_overlap` | int | 128 | 重叠token数量 |
| `tokenizer` | str | `gpt2` | Tokenizer类型 |

**示例配置**：
```json
{
  "method": "token",
  "config": {
    "chunk_size": 512,
    "chunk_overlap": 128,
    "tokenizer": "gpt2"
  }
}
```

#### 4.2.5 CodeChunker（代码分割）

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `language` | str | `auto` | 代码语言（python, java, js等） |
| `chunk_size` | int | 512 | 目标大小 |

**示例配置**：
```json
{
  "method": "code",
  "config": {
    "language": "python",
    "chunk_size": 512
  }
}
```

#### 4.2.6 LateChunker（Late Chunking）🔥

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `embedding_model` | str | `all-MiniLM-L6-v2` | Sentence Transformer模型 |
| `chunk_size` | int | 512 | 目标块大小 |
| `chunk_overlap` | int | 128 | 重叠大小 |

**示例配置**：
```json
{
  "method": "late",
  "config": {
    "embedding_model": "all-MiniLM-L6-v2",
    "chunk_size": 512,
    "chunk_overlap": 128
  }
}
```

**注意**：Late Chunking 专为 RAG 设计，提升检索召回率

#### 4.2.7 TableChunker（表格分割）⭐

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `max_rows_per_chunk` | int | 50 | 每个块最多行数 |
| `preserve_header` | bool | true | 是否在每个块保留表头 |

**示例配置**：
```json
{
  "method": "table",
  "config": {
    "max_rows_per_chunk": 50,
    "preserve_header": true
  }
}
```

**注意**：仅适用于 Markdown 表格格式

#### 4.2.8 NeuralChunker（神经网络分割）

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `model_name` | str | `bert-base-uncased` | BERT模型名称 |
| `threshold` | float | 0.6 | 语义变化阈值（0-1） |
| `min_chunk_size` | int | 100 | 最小块大小 |

**示例配置**：
```json
{
  "method": "neural",
  "config": {
    "model_name": "bert-base-uncased",
    "threshold": 0.6,
    "min_chunk_size": 100
  }
}
```

**注意**：需要下载fine-tuned BERT模型（~400MB）

#### 4.2.9 SlumberChunker（LLM分割）

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `llm_provider` | str | `openai` | LLM提供商（openai/anthropic/cohere等） |
| `model_name` | str | `gpt-4` | 模型名称 |
| `api_key` | str | - | API密钥 |
| `max_chunk_size` | int | 1000 | 最大块大小 |
| `instruction` | str | - | 自定义分块指令（可选） |

**示例配置**：
```json
{
  "method": "slumber",
  "config": {
    "llm_provider": "openai",
    "model_name": "gpt-4",
    "api_key": "sk-...",
    "max_chunk_size": 1000
  }
}
```

**注意**：
- 需要有效的 LLM API 密钥
- 成本较高，建议仅用于高质量要求场景
- 速度较慢，不适合大批量处理

### 4.3 默认配置汇总

```python
DEFAULT_CONFIGS = {
    # Phase 1: 基础方法
    "recursive": {
        "tokenizer": "gpt2",
        "chunk_size": 512,
        "chunk_overlap": 0
    },
    "token": {
        "tokenizer": "gpt2",
        "chunk_size": 512,
        "chunk_overlap": 0
    },
    "sentence": {
        "tokenizer": "gpt2",
        "chunk_size": 512,
        "min_sentences_per_chunk": 1,
        "max_sentences_per_chunk": 10
    },
    
    # Phase 2: 高级方法
    "late": {
        "embedding_model": "all-MiniLM-L6-v2",
        "chunk_size": 512,
        "chunk_overlap": 128
    },
    "table": {
        "max_rows_per_chunk": 50,
        "preserve_header": True
    },
    "semantic": {
        "embedding_model": "all-MiniLM-L6-v2",
        "similarity_threshold": 0.5
    },
    "code": {
        "language": "python",
        "chunk_size": 512
    },
    
    # Phase 3: 专业方法
    "neural": {
        "model_name": "bert-base-uncased",
        "threshold": 0.6,
        "min_chunk_size": 100
    },
    "slumber": {
        "llm_provider": "openai",
        "model_name": "gpt-4",
        "max_chunk_size": 1000
    }
}
```

---

## 4. 数据库设计

### 4.1 设计原则

- ✅ **表独立**: 配置独立成表，数据结构清晰
- ✅ **1对1关系**: 每个知识库有且仅有一个配置
- ✅ **便于管理**: 配置独立查询和统计
- ✅ **JSON灵活**: 配置参数使用JSON，支持任意扩展
- ✅ **向后兼容**: 新增方法无需修改表结构
- ✅ **可扩展**: 将来其他功能需要分段配置时可复用

### 4.2 新建 `chunk_configs` 表

```sql
-- 分段配置表（与知识库1对1关系）
CREATE TABLE IF NOT EXISTS chunk_configs (
    id VARCHAR(36) PRIMARY KEY COMMENT '配置ID（与knowledge_id相同）',
    knowledge_id VARCHAR(36) UNIQUE NOT NULL COMMENT '关联的知识库ID',
    method VARCHAR(50) NOT NULL DEFAULT 'recursive' COMMENT '分段方法: recursive, semantic, sentence, token, code',
    config JSON NOT NULL COMMENT '方法特定参数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (knowledge_id) REFERENCES knowledges(id) ON DELETE CASCADE,
    INDEX idx_method (method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分段配置表';
```

**说明**：
- ✅ `id` 与 `knowledge_id` 相同，简化关联
- ✅ `UNIQUE` 约束确保1对1关系
- ✅ `ON DELETE CASCADE` 删除知识库时自动删除配置
- ✅ 不需要 knowledges 表添加外键字段（通过knowledge_id关联）

### 4.3 初始化现有知识库的配置

```sql
-- 为所有现有知识库创建默认配置
INSERT INTO chunk_configs (id, knowledge_id, method, config)
SELECT 
    id,  -- 配置ID与知识库ID相同
    id,  -- 知识库ID
    'recursive',  -- 默认方法
    '{"chunk_size": 512, "chunk_overlap": 128, "separators": ["\\n\\n", "\\n", ". ", "。", " "]}'
FROM knowledges
WHERE id NOT IN (SELECT knowledge_id FROM chunk_configs);
```

### 4.3 JSON 结构设计

**统一格式**：
```json
{
  "method": "方法名",
  "config": {
    // 方法特定参数，每种方法不同
  }
}
```

### 4.4 各方法的完整示例

#### 4.4.1 Recursive（递归分割）
```json
{
  "method": "recursive",
  "config": {
    "chunk_size": 512,
    "chunk_overlap": 128,
    "separators": ["\n\n", "\n", ". ", "。", " "]
  }
}
```

#### 4.4.2 Semantic（语义分割）
```json
{
  "method": "semantic",
  "config": {
    "embedding_model": "all-MiniLM-L6-v2",
    "similarity_threshold": 0.5
  }
}
```

#### 4.4.3 Sentence（句子分割）
```json
{
  "method": "sentence",
  "config": {
    "min_sentences_per_chunk": 2,
    "max_sentences_per_chunk": 8
  }
}
```

#### 4.4.4 Token（Token分割）
```json
{
  "method": "token",
  "config": {
    "chunk_size": 512,
    "chunk_overlap": 128,
    "tokenizer": "gpt2"
  }
}
```

#### 4.4.5 Code（代码分割）
```json
{
  "method": "code",
  "config": {
    "language": "python",
    "chunk_size": 512
  }
}
```

### 4.5 数据模型定义

```python
# backend/app/models/chunk_config.py

from sqlalchemy import Column, String, JSON, TIMESTAMP, ForeignKey
from app.models import db

class ChunkConfig(db.Model):
    __tablename__ = 'chunk_configs'
    
    id = Column(String(36), primary_key=True)
    knowledge_id = Column(String(36), ForeignKey('knowledges.id', ondelete='CASCADE'), 
                         unique=True, nullable=False)
    method = Column(String(50), nullable=False, default='recursive')
    config = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP, server_default=db.func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=db.func.current_timestamp(), 
                       onupdate=db.func.current_timestamp())
    
    def to_dict(self):
        return {
            'id': self.id,
            'knowledge_id': self.knowledge_id,
            'method': self.method,
            'config': self.config,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
```

### 4.6 获取/创建配置的辅助函数

```python
# backend/app/services/chunking/config.py

DEFAULT_CHUNK_CONFIG = {
    'chunk_size': 512,
    'chunk_overlap': 128,
    'separators': ["\n\n", "\n", ". ", "。", " "]
}

def get_or_create_chunk_config(knowledge_id):
    """
    获取或创建知识库的分段配置
    
    Args:
        knowledge_id: 知识库ID
        
    Returns:
        ChunkConfig 实例
    """
    config = ChunkConfig.query.filter_by(knowledge_id=knowledge_id).first()
    
    if not config:
        # 创建默认配置
        config = ChunkConfig(
            id=knowledge_id,  # 配置ID与知识库ID相同
            knowledge_id=knowledge_id,
            method='recursive',
            config=DEFAULT_CHUNK_CONFIG
        )
        db.session.add(config)
        db.session.commit()
    
    return config

def update_chunk_config(knowledge_id, method, config_data):
    """
    更新知识库的分段配置
    
    Args:
        knowledge_id: 知识库ID
        method: 分段方法
        config_data: 配置参数
    """
    config = get_or_create_chunk_config(knowledge_id)
    config.method = method
    config.config = config_data
    db.session.commit()
    return config
```

### 4.6 配置验证

```python
# 后端需要验证JSON结构的合法性
def validate_chunk_config(config: dict) -> Optional[str]:
    """
    验证分段配置
    
    Returns:
        错误信息，如果合法返回None
    """
    # 必须包含 method 和 config
    if 'method' not in config or 'config' not in config:
        return "配置必须包含 method 和 config 字段"
    
    method = config['method']
    method_config = config['config']
    
    # 调用具体方法的验证逻辑
    return ChonkieWrapper.validate_config(method, method_config)
```

### 4.7 配置统计和查询

**便于管理和分析**：

1. **统计各方法使用情况**
```sql
SELECT method, COUNT(*) as count
FROM chunk_configs
GROUP BY method;

-- 结果示例：
-- recursive: 45
-- semantic: 12
-- sentence: 8
```

2. **查询特定方法的知识库**
```sql
SELECT k.id, k.name, cc.method, cc.config
FROM knowledges k
JOIN chunk_configs cc ON cc.knowledge_id = k.id
WHERE cc.method = 'semantic';
```

3. **批量更新配置（如调整默认参数）**
```sql
-- 将所有使用递归分割的chunk_size统一调整
UPDATE chunk_configs
SET config = JSON_SET(config, '$.chunk_size', 1024)
WHERE method = 'recursive' 
  AND JSON_EXTRACT(config, '$.chunk_size') = 512;
```

### 4.8 扩展性

**未来添加新方法时**：

1. 在 `ChonkieWrapper` 添加新方法的处理逻辑
2. 在前端添加新方法的UI选项
3. 用户切换到新方法时，自动更新对应知识库的配置

**数据库结构完全不需要改动** ✅（JSON字段天然支持扩展）

**将来其他功能需要分段配置时**：
```python
# 例如：文档搜索服务也需要知道分段策略
def search_documents(knowledge_id, query):
    config = get_or_create_chunk_config(knowledge_id)
    # 根据配置的method和config进行搜索优化
    if config.method == 'semantic':
        # 使用语义搜索
        pass
    elif config.method == 'token':
        # 使用token精确匹配
        pass
```

---

## 5. UI 设计

### 5.1 设计原则

- ✅ **完整展示**: 一次性展示所有5种分段方法
- ✅ **分阶段启用**: 未实现的方法灰显+提示"即将推出"
- ✅ **清晰标注**: 语义/代码方法标注"需要额外资源"
- ✅ **避免重构**: UI结构一次到位，后续只需解除禁用

### 5.2 页面布局（完整版）

```
┌──────────────────────────────────────────────────────────────────────┐
│  知识库: 技术文档库                                  [分段设置 标签]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  分段方法 *                                                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ● 递归分割 (Recursive) ⭐ 推荐                             │    │
│  │   适用于大多数文档类型，智能识别段落、句子边界             │    │
│  │   性能：⚡⚡⚡ 极快  |  模型：无需                          │    │
│  │                                                              │    │
│  │ ○ 语义分割 (Semantic) 🔥 高精度                           │    │
│  │   基于语义相似度分割，检索准确率+30-50%                    │    │
│  │   性能：⚡⚡ 快  |  模型：需加载 (~200MB)                  │    │
│  │   ⚠️ 首次使用需下载模型，约需5-10秒                        │    │
│  │                                                              │    │
│  │ ○ 句子分割 (Sentence)                                      │    │
│  │   按句子边界分割，保持语义完整性                           │    │
│  │   性能：⚡⚡⚡ 极快  |  模型：无需                          │    │
│  │                                                              │    │
│  │ ○ Token分割 (Token)                                        │    │
│  │   精确控制token数量，匹配模型限制                          │    │
│  │   性能：⚡⚡⚡ 极快  |  模型：无需                          │    │
│  │                                                              │    │
│  │ ○ 代码分割 (Code) 💻                                       │    │
│  │   专为代码文档优化，理解代码结构                           │    │
│  │   性能：⚡⚡⚡ 极快  |  模型：无需                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                 │
│  基本参数                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  分块大小 (字符数) *                                     │  │
│  │  ┌─────────────────┐                                     │  │
│  │  │ 512            │  [滑块: 100 ───●─── 4096]           │  │
│  │  └─────────────────┘                                     │  │
│  │  推荐: 256-1024                                          │  │
│  │                                                           │  │
│  │  重叠大小 (字符数)                                       │  │
│  │  ┌─────────────────┐                                     │  │
│  │  │ 50             │  [滑块: 0 ─●────── 500]             │  │
│  │  └─────────────────┘                                     │  │
│  │  约占分块大小的 10%，用于保持上下文连续性                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  高级参数  [展开 ▼]                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  最小分块大小 (字符数)                                   │  │
│  │  ┌─────────────────┐                                     │  │
│  │  │ 50             │                                      │  │
│  │  └─────────────────┘                                     │  │
│  │                                                           │  │
│  │  分隔符优先级 (递归字符分割)                             │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ \n\n (段落)  [×]                                 │    │  │
│  │  │ \n (换行)    [×]                                 │    │  │
│  │  │ . (句号)     [×]                                 │    │  │
│  │  │ 空格         [×]                                 │    │  │
│  │  │              [+ 添加]                            │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  效果预览                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  当前配置预计将文档分为:                                 │  │
│  │                                                           │  │
│  │  📄 平均每1000字 → 约 2 个分块                          │  │
│  │  📚 10000字文档 → 约 20 个分块                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [恢复默认]                                    [取消] [保存]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 交互说明

1. **分段方法选择**
   - 单选按钮，每个选项带说明文字
   - 切换方法时，参数区动态更新

2. **参数输入**
   - 数字输入框 + 滑块组合
   - 实时验证，超出范围显示错误提示
   - 显示推荐值和说明文字

3. **高级参数**
   - 默认折叠，点击展开
   - 普通用户使用默认值即可

4. **效果预览**
   - 实时计算预估分块数量
   - 帮助用户理解配置效果

5. **操作按钮**
   - **恢复默认**: 重置为系统推荐配置
   - **保存**: 保存配置（已有分块不受影响）
   - **取消**: 取消修改

---

## 6. API 设计

### 6.1 获取分段配置

```
GET /api/knowledges/{id}/chunk-config
```

**响应**：
```json
{
  "success": true,
  "data": {
    "method": "recursive",
    "config": {
      "chunk_size": 512,
      "chunk_overlap": 50,
      "min_chunk_size": 50,
      "separators": ["\n\n", "\n", ". ", " ", ""],
      "keep_separator": false
    }
  }
}
```

### 6.2 更新分段配置

```
PUT /api/knowledges/{id}/chunk-config
```

**请求体**：
```json
{
  "method": "recursive",
  "config": {
    "chunk_size": 1024,
    "chunk_overlap": 100,
    "min_chunk_size": 50,
    "separators": ["\n\n", "\n", ". ", " ", ""],
    "keep_separator": false
  }
}
```

**响应**：
```json
{
  "success": true,
  "message": "分段配置已更新",
  "data": {
    "method": "recursive",
    "config": {
      "chunk_size": 1024,
      "chunk_overlap": 100,
      "min_chunk_size": 50,
      "separators": ["\n\n", "\n", ". ", " ", ""],
      "keep_separator": false
    }
  }
}
```

### 6.3 获取默认配置

```
GET /api/knowledges/chunk-config/defaults
```

**响应**：
```json
{
  "success": true,
  "data": {
    "methods": [
      {
        "name": "recursive",
        "display_name": "递归字符分割",
        "description": "适用于大多数文档类型，智能识别段落、句子边界",
        "performance": "fast",
        "default_config": {
          "chunk_size": 512,
          "chunk_overlap": 50,
          "min_chunk_size": 50,
          "separators": ["\n\n", "\n", ". ", " ", ""],
          "keep_separator": false
        }
      },
      {
        "name": "fixed",
        "display_name": "固定大小分割",
        "description": "按固定字符数分割，简单快速",
        "performance": "fastest",
        "default_config": {
          "chunk_size": 512,
          "chunk_overlap": 50,
          "min_chunk_size": 50,
          "boundary_chars": "。\n."
        }
      }
    ],
    "recommended": "recursive"
  }
}
```

### 6.4 验证配置

```
POST /api/knowledges/chunk-config/validate
```

**请求体**：
```json
{
  "method": "recursive",
  "config": {
    "chunk_size": 5000,  // 超出限制
    "chunk_overlap": 50
  }
}
```

**响应**：
```json
{
  "success": false,
  "errors": [
    {
      "field": "config.chunk_size",
      "message": "分块大小必须在 100-4096 之间"
    }
  ]
}
```

---

## 7. 后端实现

### 7.1 安装 Chonkie

```bash
# 基础安装（支持 Recursive, Sentence, Token, Code）
pip install chonkie

# 完整安装（支持 Semantic, SDPM）
pip install chonkie[all]

# 或者只安装语义分段依赖
pip install chonkie[semantic]
```

### 7.2 目录结构

```
backend/app/services/
└── chunking/
    ├── __init__.py
    ├── chonkie_wrapper.py      # Chonkie 包装器
    ├── chunker_factory.py      # 分块器工厂
    └── config.py               # 配置管理
```

### 7.3 Chonkie 包装器实现

```python
# backend/app/services/chunking/chonkie_wrapper.py

from typing import List, Dict, Any, Optional
from chonkie import (
    RecursiveChunker,
    SemanticChunker,
    SentenceChunker,
    TokenChunker,
    CodeChunker
)

class ChonkieWrapper:
    """
    Chonkie 统一包装器
    提供统一接口，简化不同 chunker 的使用
    """

    def __init__(self, method: str, config: Dict[str, Any]):
        """
        初始化分块器

        Args:
            method: 分块方法名称
            config: 配置参数
        """
        self.method = method
        self.config = config
        self.chunker = self._create_chunker()

    def _create_chunker(self):
        """根据配置创建对应的 Chunker"""
        if self.method == 'recursive':
            return RecursiveChunker(
                chunk_size=self.config.get('chunk_size', 512),
                chunk_overlap=self.config.get('chunk_overlap', 128),
                separators=self.config.get('separators', ["\n\n", "\n", ". ", "。", " "])
            )

        elif self.method == 'semantic':
            # 需要用户确认，因为会加载模型
            return SemanticChunker(
                embedding_model=self.config.get('embedding_model', 'all-MiniLM-L6-v2'),
                similarity_threshold=self.config.get('similarity_threshold', 0.5)
            )

        elif self.method == 'sentence':
            return SentenceChunker(
                min_sentences_per_chunk=self.config.get('min_sentences_per_chunk', 2),
                max_sentences_per_chunk=self.config.get('max_sentences_per_chunk', 8)
            )

        elif self.method == 'token':
            return TokenChunker(
                chunk_size=self.config.get('chunk_size', 512),
                chunk_overlap=self.config.get('chunk_overlap', 128),
                tokenizer=self.config.get('tokenizer', 'gpt2')
            )

        elif self.method == 'code':
            return CodeChunker(
                language=self.config.get('language', 'auto'),
                chunk_size=self.config.get('chunk_size', 512)
            )

        else:
            raise ValueError(f"Unknown chunking method: {self.method}")

    def chunk(self, text: str) -> List[str]:
        """
        分块文本

        Args:
            text: 输入文本

        Returns:
            分块列表
        """
        try:
            chunks = self.chunker.chunk(text)
            # Chonkie 返回的是 Chunk 对象列表，提取文本
            return [chunk.text if hasattr(chunk, 'text') else str(chunk) for chunk in chunks]
        except Exception as e:
            raise RuntimeError(f"Chunking failed: {str(e)}")

    def get_estimated_chunks(self, text_length: int) -> int:
        """
        估算分块数量

        Args:
            text_length: 文本长度

        Returns:
            预估分块数量
        """
        chunk_size = self.config.get('chunk_size', 512)
        overlap = self.config.get('chunk_overlap', 128)
        effective_size = chunk_size - overlap

        if effective_size <= 0:
            return 0

        return max(1, (text_length + effective_size - 1) // effective_size)

    @staticmethod
    def validate_config(method: str, config: Dict[str, Any]) -> Optional[str]:
        """
        验证配置

        Returns:
            错误信息，如果验证通过则返回 None
        """
        # 通用验证
        chunk_size = config.get('chunk_size', 512)
        if not (100 <= chunk_size <= 2048):
            return "chunk_size must be between 100 and 2048"

        chunk_overlap = config.get('chunk_overlap', 128)
        if not (0 <= chunk_overlap <= 512):
            return "chunk_overlap must be between 0 and 512"

        if chunk_overlap >= chunk_size:
            return "chunk_overlap must be less than chunk_size"

        # 方法特定验证
        if method == 'semantic':
            threshold = config.get('similarity_threshold', 0.5)
            if not (0 <= threshold <= 1):
                return "similarity_threshold must be between 0 and 1"

        return None
```

### 7.4 分块器工厂

```python
# backend/app/services/chunking/chunker_factory.py

from typing import Dict, Any
from .chonkie_wrapper import ChonkieWrapper

class ChunkerFactory:
    """分块器工厂类"""

    # 默认配置
        """验证配置"""
        chunk_size = self.config.get('chunk_size', 512)
        chunk_overlap = self.config.get('chunk_overlap', 50)
        min_chunk_size = self.config.get('min_chunk_size', 50)

        if not (100 <= chunk_size <= 4096):
            raise ValueError("chunk_size must be between 100 and 4096")

        if not (0 <= chunk_overlap <= 500):
            raise ValueError("chunk_overlap must be between 0 and 500")

        if not (10 <= min_chunk_size <= 200):
            raise ValueError("min_chunk_size must be between 10 and 200")

        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size")

    def chunk(self, text: str) -> List[str]:
        """
        递归分块实现

        1. 按分隔符优先级递归分割
        2. 保持分块大小在目标范围内
        3. 添加重叠保持上下文
        """
        if not text:
            return []

        chunk_size = self.config.get('chunk_size', 512)
        chunk_overlap = self.config.get('chunk_overlap', 50)
        min_chunk_size = self.config.get('min_chunk_size', 50)
        separators = self.config.get('separators', ["\n\n", "\n", ". ", " ", ""])
        keep_separator = self.config.get('keep_separator', False)

        chunks = []
        current_chunk = []
        current_length = 0

        # 递归分割逻辑
        splits = self._split_text_recursive(text, separators, keep_separator)

        for split in splits:
            split_length = len(split)

            # 如果当前块 + 新片段超过大小，保存当前块
            if current_length + split_length > chunk_size and current_chunk:
                chunk_text = ''.join(current_chunk).strip()
                if len(chunk_text) >= min_chunk_size:
                    chunks.append(chunk_text)

                # 保留重叠部分
                overlap_text = chunk_text[-chunk_overlap:] if chunk_overlap > 0 else ""
                current_chunk = [overlap_text, split] if overlap_text else [split]
                current_length = len(overlap_text) + split_length
            else:
                current_chunk.append(split)
                current_length += split_length

        # 保存最后一个块
        if current_chunk:
            chunk_text = ''.join(current_chunk).strip()
            if len(chunk_text) >= min_chunk_size:
                chunks.append(chunk_text)

        return chunks

    def _split_text_recursive(self, text: str, separators: List[str], keep_separator: bool) -> List[str]:
        """递归分割文本"""
        if not separators:
            return [text]

        separator = separators[0]
        remaining_separators = separators[1:]

        if separator:
            splits = text.split(separator)
            if keep_separator:
                splits = [s + separator for s in splits[:-1]] + [splits[-1]]
        else:
            splits = list(text)

        # 递归处理每个片段
        final_splits = []
        for split in splits:
            if len(split) > self.config.get('chunk_size', 512):
                final_splits.extend(self._split_text_recursive(split, remaining_separators, keep_separator))
            else:
                final_splits.append(split)

        return final_splits
```

### 7.4 分块器工厂

```python
# backend/app/services/chunking/chunker_factory.py

from typing import Dict, Any
from .base_chunker import BaseChunker
from .recursive_chunker import RecursiveChunker
from .fixed_chunker import FixedChunker

class ChunkerFactory:
    """分块器工厂"""

    _chunkers = {
        'recursive': RecursiveChunker,
        'fixed': FixedChunker,
    }

    @classmethod
    def create(cls, method: str, config: Dict[str, Any]) -> BaseChunker:
        """
        创建分块器

        Args:
            method: 分块方法名称
            config: 配置参数

        Returns:
            分块器实例
        """
        chunker_class = cls._chunkers.get(method)
        if not chunker_class:
            raise ValueError(f"Unknown chunking method: {method}")

        return chunker_class(config)

    @classmethod
    def get_default_config(cls, method: str) -> Dict[str, Any]:
        """获取默认配置"""
        defaults = {
            'recursive': {
                'chunk_size': 512,
                'chunk_overlap': 50,
                'min_chunk_size': 50,
                'separators': ["\n\n", "\n", ". ", " ", ""],
                'keep_separator': False
            },
            'fixed': {
                'chunk_size': 512,
                'chunk_overlap': 50,
                'min_chunk_size': 50,
                'boundary_chars': "。\n."
            }
        }
        return defaults.get(method, {})
```

### 7.5 API 路由实现

```python
# backend/app/api/routes/knowledge.py

from flask import Blueprint, jsonify, request
from app.services.chunking.chunker_factory import ChunkerFactory
from app.models.knowledge import Knowledge

@knowledge_bp.route('/<knowledge_id>/chunk-config', methods=['GET'])
def get_chunk_config(knowledge_id):
    """获取分段配置"""
    knowledge = Knowledge.query.get_or_404(knowledge_id)

    # 如果没有配置，返回默认配置
    chunk_config = knowledge.chunk_config or {
        "method": "recursive",
        "config": ChunkerFactory.get_default_config('recursive')
    }

    return jsonify({
        'success': True,
        'data': chunk_config
    })


@knowledge_bp.route('/<knowledge_id>/chunk-config', methods=['PUT'])
def update_chunk_config(knowledge_id):
    """更新分段配置"""
    knowledge = Knowledge.query.get_or_404(knowledge_id)
    data = request.get_json()

    method = data.get('method')
    config = data.get('config', {})

    # 验证配置
    try:
        chunker = ChunkerFactory.create(method, config)
    except ValueError as e:
        return jsonify({
            'success': False,
            'errors': [{'field': 'config', 'message': str(e)}]
        }), 400

    # 保存配置
    knowledge.chunk_config = {
        'method': method,
        'config': config
    }
    db.session.commit()

    return jsonify({
        'success': True,
        'message': '分段配置已更新',
        'data': knowledge.chunk_config
    })


@knowledge_bp.route('/chunk-config/defaults', methods=['GET'])
def get_default_configs():
    """获取所有默认配置"""
    methods = [
        {
            'name': 'recursive',
            'display_name': '递归字符分割',
            'description': '适用于大多数文档类型，智能识别段落、句子边界',
            'performance': 'fast',
            'default_config': ChunkerFactory.get_default_config('recursive')
        },
        {
            'name': 'fixed',
            'display_name': '固定大小分割',
            'description': '按固定字符数分割，简单快速',
            'performance': 'fastest',
            'default_config': ChunkerFactory.get_default_config('fixed')
        }
    ]

    return jsonify({
        'success': True,
        'data': {
            'methods': methods,
            'recommended': 'recursive'
        }
    })
```

---

## 8. 前端实现

### 8.1 组件结构

```
frontend/src/pages/knowledgebase/
├── settings/
│   ├── ChunkSettings.js          # 分段设置主组件
│   ├── ChunkMethodSelector.js    # 方法选择器
│   ├── ChunkConfigForm.js        # 配置表单
│   └── ChunkPreview.js           # 效果预览
```

### 8.2 主组件示例

```jsx
// frontend/src/pages/knowledgebase/settings/ChunkSettings.js

import React, { useState, useEffect } from 'react';
import { Card, Button, message, Spin } from 'antd';
import ChunkMethodSelector from './ChunkMethodSelector';
import ChunkConfigForm from './ChunkConfigForm';
import ChunkPreview from './ChunkPreview';
import { getChunkConfig, updateChunkConfig, getDefaultConfigs } from '@/services/api/knowledge';

const ChunkSettings = ({ knowledgeId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [defaults, setDefaults] = useState(null);

  useEffect(() => {
    loadData();
  }, [knowledgeId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configRes, defaultsRes] = await Promise.all([
        getChunkConfig(knowledgeId),
        getDefaultConfigs()
      ]);
      setConfig(configRes.data);
      setDefaults(defaultsRes.data);
    } catch (error) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateChunkConfig(knowledgeId, config);
      message.success('分段配置已保存');
    } catch (error) {
      message.error('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaultConfig = defaults.methods.find(m => m.name === defaults.recommended);
    setConfig({
      method: defaultConfig.name,
      config: defaultConfig.default_config
    });
  };

  if (loading) {
    return <Spin />;
  }

  return (
    <div className="chunk-settings">
      <Card title="分段设置">
        <ChunkMethodSelector
          value={config.method}
          methods={defaults.methods}
          onChange={(method) => {
            const methodDefault = defaults.methods.find(m => m.name === method);
            setConfig({
              method,
              config: methodDefault.default_config
            });
          }}
        />

        <ChunkConfigForm
          method={config.method}
          config={config.config}
          onChange={(newConfig) => setConfig({ ...config, config: newConfig })}
        />

        <ChunkPreview config={config} />

        <div className="actions">
          <Button onClick={handleReset}>恢复默认</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ChunkSettings;
```

---

## 9. 实施计划

### 9.1 总体策略

**核心思想**：UI和数据库一次到位，功能分阶段实现

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: 完整UI + 数据库 + 3种核心方法                  │
│  - 前端展示全部5种方法（未实现的灰显）                    │
│  - 数据库支持所有方法的JSON配置                          │
│  - 实现: Recursive, Sentence, Token                     │
│  - 时间: 2-3天                                           │
├─────────────────────────────────────────────────────────┤
│  Phase 2: 启用高级方法                                   │
│  - 解除Semantic和Code的禁用状态                         │
│  - 实现: Semantic, Code                                 │
│  - 时间: 1-2天                                           │
├─────────────────────────────────────────────────────────┤
│  Phase 3: 优化扩展                                       │
│  - 性能优化、配置模板、批量操作                          │
│  - 时间: 1-2天（可选）                                    │
└─────────────────────────────────────────────────────────┘
```

**优势**：
- ✅ 避免后期UI重构
- ✅ 数据库结构稳定，新方法零改动
- ✅ 用户体验连贯（看到完整功能路线图）
- ✅ 开发进度清晰可见

---

### 9.2 Phase 1: 完整UI + 数据库 + 核心功能

**目标**：
- 构建完整的UI框架（展示所有5种方法）
- 数据库支持所有方法的配置存储
- 实现 Recursive, Sentence, Token 三种方法

**任务清单**：

#### 环境准备
- [ ] 安装 Chonkie
  ```bash
  pip install chonkie
  ```
- [ ] 验证安装
  ```python
  from chonkie import RecursiveChunker
  print("Chonkie installed successfully!")
  ```

#### 数据库迁移
- [ ] 添加 `chunk_config` JSON 字段到 `knowledges` 表
  ```sql
  ALTER TABLE knowledges ADD COLUMN chunk_config JSON COMMENT '分段配置';
  ```

#### 后端实现
- [ ] 创建 `backend/app/services/chunking/` 目录
- [ ] 实现 `ChonkieWrapper` 类（封装 Chonkie）
  - [ ] `RecursiveChunker` 支持
  - [ ] `SentenceChunker` 支持
  - [ ] `TokenChunker` 支持
  - [ ] 统一的 `chunk()` 接口
  - [ ] 配置验证方法
- [ ] 实现 `ChunkerFactory` 工厂类
  - [ ] 根据方法名创建对应 chunker
  - [ ] 提供默认配置
- [ ] API 路由实现
  - [ ] `GET /api/knowledges/{id}/chunk-config` - 获取配置
  - [ ] `PUT /api/knowledges/{id}/chunk-config` - 更新配置
  - [ ] `GET /api/knowledges/chunk-config/defaults` - 获取默认配置

#### 前端实现（完整UI，分阶段启用）
- [ ] 创建分段设置页面 `ChunkSettings.js`
- [ ] 方法选择组件 `ChunkMethodSelector.js`
  - [ ] 显示 **所有5种方法**
    - ✅ Recursive (启用)
    - ✅ Sentence (启用)
    - ✅ Token (启用)
    - 🔒 Semantic (灰显 + "Phase 2 即将推出")
    - 🔒 Code (灰显 + "Phase 2 即将推出")
  - [ ] 每种方法带完整描述
  - [ ] 性能图标和模型需求标注
  - [ ] 未启用方法的tooltip提示
- [ ] 配置表单组件 `ChunkConfigForm.js`
  - [ ] 通用参数表单
    - [ ] chunk_size 滑块 (100-2048)
    - [ ] chunk_overlap 滑块 (0-512)
  - [ ] 方法特定参数表单（动态显示）
    - [ ] Recursive: separators 配置
    - [ ] Semantic: embedding_model + similarity_threshold
    - [ ] Sentence: min/max sentences
    - [ ] Token: tokenizer 选择
    - [ ] Code: language 选择
- [ ] 效果预览组件 `ChunkPreview.js`
  - [ ] 显示预估分块数量
  - [ ] 显示配置摘要
- [ ] API 服务层
  - [ ] `getChunkConfig()` - 支持所有5种方法
  - [ ] `updateChunkConfig()` - 支持所有5种方法
  - [ ] `getDefaultConfigs()` - 返回所有5种方法的配置

#### 测试
- [ ] 单元测试
  - [ ] `ChonkieWrapper.chunk()` 测试
  - [ ] 配置验证测试
- [ ] 集成测试
  - [ ] API 端到端测试
  - [ ] 实际分段效果测试

**Phase 1 交付物**：
- ✅ 完整的UI界面（所有5种方法可见）
- ✅ 可用的3种基础分段方法
- ✅ 支持所有方法的数据库结构
- ✅ 完整的API接口

**预计时间**: 2-3 天

---

### 9.3 Phase 2: 启用高级方法

**目标**：
- 解除 Semantic 和 Code 的灰显状态
- 实现这两种方法的后端逻辑
- 前端只需移除 disabled 属性

**任务清单**：

#### 环境准备
- [ ] 安装完整版 Chonkie
  ```bash
  pip install chonkie[semantic]
  ```
- [ ] 验证 sentence-transformers 可用（项目已有）

#### 后端扩展
- [ ] 扩展 `ChonkieWrapper`
  - [ ] `SemanticChunker` 支持
    - [ ] 添加模型加载提示
    - [ ] 支持相似度阈值配置
  - [ ] `CodeChunker` 支持
    - [ ] 支持多种编程语言
- [ ] 更新默认配置
  - [ ] Semantic 方法默认配置
  - [ ] Code 方法默认配置

#### 前端扩展（极简，UI已完成）
- [ ] 移除方法选择器中的 disabled 状态
  ```javascript
  // ChunkMethodSelector.js
  // Phase 1: disabled={method.name === 'semantic' || method.name === 'code'}
  // Phase 2: disabled={false}  // 只需改这一行
  ```
- [ ] 添加首次使用语义分段的确认对话框
  ```javascript
  if (method === 'semantic' && isFirstTime) {
    Modal.confirm({
      title: '启用语义分段',
      content: '将下载约200MB模型，首次需5-10秒。继续吗？',
      onOk: () => saveConfig()
    });
  }
  ```

#### 用户提示
- [ ] 语义分段首次使用提示
  ```
  "语义分段将下载约200MB的模型文件，
   首次使用需要等待5-10秒。继续吗？"
  ```

**Phase 2 交付物**：
- ✅ 5种方法全部可用
- ✅ 语义分段和代码分段完整功能

**工作量评估**：
- 后端：扩展 `ChonkieWrapper` 的 2 个方法 (~50行代码)
- 前端：移除 disabled + 添加确认对话框 (~20行代码)

**预计时间**: 1-2 天

---

### 9.4 Phase 3: 优化和扩展（可选）

**任务清单**：
- [ ] 性能优化
  - [ ] Chunker 实例缓存
  - [ ] 模型预加载策略
- [ ] 配置模板
  - [ ] 预设场景模板（技术文档、学术论文、API文档等）
  - [ ] 用户自定义模板保存
- [ ] 批量操作
  - [ ] 批量应用配置到多个知识库
  - [ ] 重新分段已有文档
- [ ] 监控和日志
  - [ ] 分段性能监控
  - [ ] 分段质量评估
- [ ] 文档和示例
  - [ ] 用户使用指南
  - [ ] 最佳实践文档

**预计时间**: 1-2 天

---

## 10. 设计总结

### 10.1 核心设计理念

本方案采用**"一次规划，分步实施"**的设计思路：

```
设计层面（一次到位）           实施层面（分步骤）
├─ 数据库：JSON存储             ├─ Phase 1: 基础3种
│  支持所有方法                 ├─ Phase 2: 高级2种  
├─ UI框架：展示5种方法          └─ Phase 3: 优化
│  未实现的灰显                     
└─ API接口：支持所有配置        
```

### 10.2 关键优势

| 方面 | 传统方案 | 本方案（基于Chonkie） |
|------|---------|---------------------|
| **数据库改动** | 每增加方法需修改schema | 零改动（JSON天然扩展） |
| **UI重构** | 每增加方法需修改布局 | 零重构（预留全部位置） |
| **代码量** | ~800行自实现 | ~150行封装 |
| **包大小** | LangChain 171MB | Chonkie 21MB |
| **性能** | 中等 | 极优（33x faster） |
| **维护成本** | 高（自己维护逻辑） | 低（社区维护） |
| **扩展性** | 困难 | 容易 |

### 10.3 实施节奏

```
Week 1: Phase 1 - 完整UI + 数据库 + 3种核心方法
  Day 1: 数据库设计 + 后端框架 + Chonkie集成
  Day 2: 前端完整UI（5种方法，2种灰显）
  Day 3: API + 测试 + 文档

Week 2: Phase 2 - 启用高级方法（如需要）
  Day 1: 后端扩展Semantic和Code
  Day 2: 前端解除灰显 + 测试

Week 3: Phase 3 - 优化（可选）
  根据实际使用情况决定
```

### 10.4 技术债务管理

**本方案避免的技术债**：
- ✅ 数据库结构变更（使用JSON）
- ✅ UI重复重构（一次展示全部）
- ✅ 代码维护负担（使用成熟库）
- ✅ 性能瓶颈（Chonkie已优化）

**可能的技术债**：
- 🔄 Chonkie API变化（概率低，社区稳定）
- 🔄 新增第6种方法时需扩展UI（预留扩展位置）

### 10.5 与主流方案对比

```
RAGFlow方案：
- 8种模板，基于DeepDoc视觉模型
- 优势：布局感知强
- 劣势：需部署CV模型，资源消耗大

本方案（Chonkie）：
- 5种方法，基于规则+语义
- 优势：轻量快速，易集成
- 劣势：无布局感知（但已满足95%场景）

选择理由：
✅ 性价比最高（21MB vs 需部署模型）
✅ 开发效率最高（集成库 vs 自实现）
✅ 满足业务需求（技术文档为主）
```

---

## 11. 注意事项

### 10.1 向后兼容
- 已有知识库的 `chunk_config` 为 NULL，自动使用默认配置
- 不影响已生成的分块数据

### 10.2 配置变更影响
- 修改配置**不会**自动重新分块
- 仅影响新上传的文档
- 需要明确提示用户

### 10.3 性能考虑
- 配置验证在保存时进行
- 分块操作在文档上传时进行
- 避免实时分块预览（文本较大时）

### 10.4 用户体验
- 提供合理的默认值
- 参数说明要清晰
- 效果预览要直观
- 保存前验证配置

---

## 11. 未来扩展

### 11.1 配置模板
- 预设多种场景模板（技术文档、学术论文等）
- 用户可保存自定义模板
- 跨知识库复用配置

### 11.2 智能推荐
- 根据文档类型自动推荐分段方法
- 根据文档长度自动调整参数
- 学习用户偏好

### 11.3 分块质量评估
- 分块后质量评分
- 检索效果对比
- 配置优化建议

---

**文档版本**: v2.0 (Chonkie Edition - Final)  
**创建日期**: 2025-10-03  
**更新日期**: 2025-10-03  
**核心技术**: Chonkie (3000+ GitHub stars, 专为RAG优化)  
**设计原则**: 一次规划，分步实施 | JSON存储，天然扩展  
**责任人**: ABM-LLM Team

---

## 快速开始

```bash
# 1. 安装Chonkie
pip install chonkie

# 2. 数据库迁移
# 创建配置表和初始化数据

# 3. 创建数据模型
# backend/app/models/chunk_config.py

# 4. 开始开发
# Phase 1: 实现Recursive, Sentence, Token (3种)
# Phase 2: 实现Semantic, Code (只需移除UI的disabled)
```
