# Reranker集成方案

## 1. 业界调研总结

### 1.1 主流产品实践

| 产品 | Reranker方案 | 配置复杂度 |
|------|-------------|-----------|
| **Dify** | Cohere Rerank API | 简单（API key + TopN） |
| **Weaviate** | 内置支持多种reranker | 中等（选择模型 + 配置） |
| **RAGFlow** | 支持本地/API模型 | 中等 |
| **LlamaIndex** | 支持BGE/Cohere/Jina等 | 灵活配置 |

**关键发现**：
- 所有主流RAG产品都集成了Reranker
- Reranker通常作为可选功能，默认关闭
- 配置保持简单：开关 + TopN参数

---

## 2. Reranker模型对比

### 2.1 综合对比表

| 模型 | 参数量 | nDCG@10 | 延迟 | 成本 | 中文支持 | 部署方式 |
|------|--------|---------|------|------|---------|---------|
| **BGE-reranker-v2-m3** | 568M | 0.686 | 1891ms | 免费（本地）<br>$0.020（API） | ✅ 优秀 | 本地/API |
| **Cohere Rerank 3.5** | - | 0.689 | 492ms | $0.050/百万tokens | ⚠️ 一般 | API |
| **Jina Reranker V3** | 600M | 0.619 | - | 免费（本地） | ✅ 良好 | 本地/API |
| **BGE-reranker-large** | 560M | 0.69+ | 较慢 | 免费（本地） | ✅ 优秀 | 本地 |
| **BGE-reranker-base** | 278M | 0.67+ | 较快 | 免费（本地） | ✅ 优秀 | 本地 |

### 2.2 详细分析

#### BGE Reranker系列（BAAI - 推荐）
**优势**：
- ✅ 开源免费，无API依赖
- ✅ 中英文双语支持优秀
- ✅ 多个版本满足不同需求
- ✅ 与现有BGE embedding同源，兼容性好
- ✅ 活跃维护，生态成熟

**劣势**：
- ⚠️ 本地部署需要GPU资源（可选CPU，但慢）
- ⚠️ 首次加载模型需要时间

**模型选择建议**：
- `bge-reranker-v2-m3`：轻量级，多语言，推荐用于生产
- `bge-reranker-large`：准确度最高，适合对质量要求极高的场景
- `bge-reranker-base`：最快速度，适合资源受限环境

#### Cohere Rerank 3.5
**优势**：
- ✅ API服务，零部署成本
- ✅ 速度最快（492ms）
- ✅ 集成简单，开箱即用
- ✅ nDCG@10最高（0.689）

**劣势**：
- ❌ 付费服务，长期成本高
- ❌ 依赖外部API，需要网络
- ⚠️ 中文支持不如BGE

#### Jina Reranker V3
**优势**：
- ✅ 最新架构，创新设计
- ✅ 多语言支持（15种）
- ✅ 参数高效（0.6B）

**劣势**：
- ⚠️ 相对较新，生态不如BGE成熟
- ⚠️ 社区资源较少

---

## 3. 推荐方案

### 3.1 技术选型：BGE-reranker-v2-m3

**选择理由**：
1. **开源免费**：无API成本，适合长期使用
2. **中文优先**：BAAI专门优化中文，完美匹配我们的场景
3. **轻量高效**：568M参数，平衡性能和资源消耗
4. **生态兼容**：与现有BGE embedding同源，技术栈统一
5. **KISS原则**：一个模型解决问题，无需多模型管理

### 3.2 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        查询流程                              │
└─────────────────────────────────────────────────────────────┘

用户查询 "知识图谱增强的RAG系统"
    │
    ├──→ BM25检索 ─────────→ 20个候选文档
    │                          (score: 0.0-100)
    │
    ├──→ 向量检索 ─────────→ 20个候选文档
    │                          (score: 0.0-100)
    │
    ▼
  加权融合 (weighted)
    │
    ├──→ 去重 + 归一化 ────→ 最多40个候选文档
    │                         (fusion_score: 0-100)
    │
    ▼
  [可选] Reranker重排序
    │
    ├──→ 使用bge-reranker-v2-m3
    │    计算query-doc相关性
    │    (rerank_score: 原始logits)
    │
    ├──→ 按rerank_score降序排序
    │
    ├──→ 取TopN（用户配置，默认5）
    │
    ▼
  返回最终结果
    │
    └──→ 每个文档包含：
         - content: 文档内容
         - similarity: fusion_score（原始分数保留）
         - rerank_score: reranker分数
         - search_method: "混合检索+Reranker"
```

### 3.3 配置设计（利用现有模型管理系统）

#### 知识库search_config字段（前端暴露）

```json
{
  // 现有配置
  "mode": "hybrid",
  "top_k": 10,
  "similarity_threshold": 0.5,
  "bm25_weight": 0.5,
  "vector_weight": 0.5,
  "enable_graph_enhancement": false,
  
  // 新增Reranker配置
  "enable_reranker": false,           // Reranker开关（默认关闭）
  "reranker_model_id": null,          // Reranker模型ID（从ModelConfig表选择）
  "reranker_top_n": 5                 // Reranker输出数量（范围1-10）
}
```

**参数说明**：
- `enable_reranker`：是否启用Reranker（默认false，避免增加延迟）
- `reranker_model_id`：选择哪个Reranker模型（从系统模型配置中选择）
- `reranker_top_n`：Reranker最终返回多少个结果（默认5）
- 候选文档倍数：固定为2（隐藏参数）

#### 模型配置（ModelConfig表）

利用现有的模型管理系统，通过`modalities`字段标识：

```json
{
  "name": "bge-reranker-v2-m3",
  "provider": "Local",  // 或 "OpenAI", "Cohere" 等
  "model_id": "BAAI/bge-reranker-v2-m3",
  "modalities": ["rerank_input", "rerank_output"],
  "additional_params": {
    "max_documents": 100,
    "score_threshold": 0.0,
    "use_fp16": true,
    "batch_size": 32
  }
}
```

**优势**：
- ✅ 复用现有模型管理基础设施
- ✅ 用户可以在"模型配置"页面添加/管理多个reranker
- ✅ 支持本地模型（BGE/Jina）和API服务（Cohere）
- ✅ 每个知识库可以选择不同的reranker模型

---

## 4. 实施计划

### 4.1 后端实现

#### Step 1: 添加依赖
```bash
# 在backend/requirements.txt中添加
FlagEmbedding>=1.2.0  # BGE reranker支持
sentence-transformers>=2.0.0  # 通用CrossEncoder支持
```

#### Step 2: 创建Reranker服务（支持多模型）
```python
# backend/app/services/knowledge_base/reranker_service.py

from typing import List, Dict, Optional
import logging
from app.models import ModelConfig, db

logger = logging.getLogger(__name__)

class RerankerService:
    """
    Reranker服务 - 支持多种reranker模型
    通过ModelConfig动态加载模型
    """
    
    _model_cache = {}  # 模型缓存 {model_id: reranker_instance}
    
    @classmethod
    def get_reranker(cls, model_config: ModelConfig):
        """
        根据ModelConfig获取或创建reranker实例（带缓存）
        
        Args:
            model_config: 模型配置对象
            
        Returns:
            Reranker实例
        """
        model_id = model_config.id
        
        # 检查缓存
        if model_id in cls._model_cache:
            logger.info(f"Using cached reranker: {model_config.name}")
            return cls._model_cache[model_id]
        
        # 创建新实例
        provider = model_config.provider.lower()
        model_name = model_config.model_id
        additional_params = model_config.additional_params or {}
        
        logger.info(f"Loading reranker: {model_config.name} (provider={provider}, model={model_name})")
        
        try:
            if provider in ['local', 'baai', 'huggingface']:
                # 本地模型（BGE/Jina等）
                from FlagEmbedding import FlagReranker
                reranker = FlagReranker(
                    model_name,
                    use_fp16=additional_params.get('use_fp16', True),
                    cache_dir='./models',
                    batch_size=additional_params.get('batch_size', 32)
                )
            elif provider == 'cohere':
                # Cohere API
                from app.services.knowledge_base.rerankers.cohere_reranker import CohereReranker
                reranker = CohereReranker(
                    api_key=model_config.api_key,
                    model_name=model_name
                )
            elif provider == 'openai':
                # OpenAI API（如果支持rerank）
                from app.services.knowledge_base.rerankers.openai_reranker import OpenAIReranker
                reranker = OpenAIReranker(
                    api_key=model_config.api_key,
                    base_url=model_config.base_url,
                    model_name=model_name
                )
            else:
                raise ValueError(f"Unsupported reranker provider: {provider}")
            
            # 缓存
            cls._model_cache[model_id] = reranker
            logger.info(f"Reranker loaded successfully: {model_config.name}")
            return reranker
            
        except Exception as e:
            logger.error(f"Failed to load reranker {model_config.name}: {str(e)}")
            raise
    
    @classmethod
    def rerank(cls, query: str, documents: List[Dict], model_id: str, top_n: int = 5) -> List[Dict]:
        """
        对文档进行重排序
        
        Args:
            query: 查询文本
            documents: 候选文档列表 [{content, similarity, ...}]
            model_id: Reranker模型ID（从ModelConfig表）
            top_n: 返回前N个结果
            
        Returns:
            重排序后的文档列表（包含rerank_score字段）
        """
        if not documents:
            return []
        
        # 获取模型配置
        model_config = ModelConfig.query.get(model_id)
        if not model_config:
            logger.error(f"Reranker model not found: {model_id}")
            return documents[:top_n]  # 降级处理
        
        # 检查模型是否支持rerank
        if 'rerank_output' not in (model_config.modalities or []):
            logger.error(f"Model {model_config.name} does not support reranking")
            return documents[:top_n]  # 降级处理
        
        try:
            # 获取reranker实例
            reranker = cls.get_reranker(model_config)
            
            # 准备query-doc pairs
            pairs = [[query, doc['content']] for doc in documents]
            
            # 计算rerank分数
            scores = reranker.compute_score(pairs, normalize=True)
            
            # 将分数添加到文档中
            for doc, score in zip(documents, scores):
                doc['rerank_score'] = float(score)
            
            # 按rerank_score降序排序
            reranked_docs = sorted(documents, key=lambda x: x['rerank_score'], reverse=True)
            
            # 返回TopN
            return reranked_docs[:top_n]
            
        except Exception as e:
            logger.error(f"Reranker error: {str(e)}")
            # 降级处理：返回原始排序的TopN
            return documents[:top_n]
```

#### Step 3: 集成到查询服务
```python
# 修改 backend/app/services/knowledge_base/knowledge_query_service.py

from .reranker_service import RerankerService

def query(self, knowledge_id: int, query_text: str) -> List[Dict]:
    """知识库查询（支持Reranker）"""
    
    # ... 原有的检索逻辑（BM25、向量、混合）...
    
    # 获取search_config
    search_config = knowledge.search_config or {}
    enable_reranker = search_config.get('enable_reranker', False)
    reranker_top_n = search_config.get('reranker_top_n', 5)
    
    # 如果启用Reranker
    if enable_reranker and results:
        try:
            # 获取候选文档数量（2倍）
            candidate_multiplier = 2
            candidates = results[:reranker_top_n * candidate_multiplier]
            
            # 使用Reranker重排序
            reranker = RerankerService.get_instance()
            reranked_results = reranker.rerank(
                query=query_text,
                documents=candidates,
                top_n=reranker_top_n
            )
            
            # 更新search_method标签
            for doc in reranked_results:
                doc['search_method'] = f"{doc.get('search_method', '混合检索')}+Reranker"
            
            return reranked_results
            
        except Exception as e:
            logger.error(f"Reranker failed, fallback to original results: {str(e)}")
            return results[:top_k]  # 降级处理
    
    return results[:top_k]
```

### 4.2 前端实现

#### Step 1: 更新多语言翻译
```javascript
// frontend/src/locales/zh-CN.js
knowledgebase: {
  retrievalSettings: {
    enableReranker: 'Reranker重排序',
    enableRerankerTooltip: '使用Reranker模型对检索结果进行二次排序，提升准确度（会增加0.5-2秒延迟）',
    rerankerTopN: 'Reranker输出数量',
    rerankerTopNTooltip: 'Reranker最终返回的文档数量（默认5个）',
  }
}

// frontend/src/locales/en-US.js
knowledgebase: {
  retrievalSettings: {
    enableReranker: 'Enable Reranker',
    enableRerankerTooltip: 'Use Reranker model for second-stage ranking to improve accuracy (adds 0.5-2s latency)',
    rerankerTopN: 'Reranker Top N',
    rerankerTopNTooltip: 'Number of documents returned by Reranker (default 5)',
  }
}
```

#### Step 2: 修改RetrievalSettings组件
```jsx
// frontend/src/pages/knowledgebase/components/RetrievalSettings.js

// 在"高级功能"分组中添加Reranker配置
<Divider orientation="left" style={{ fontSize: 14, marginTop: 24 }}>
  {intl.formatMessage({ id: 'knowledgebase.retrievalSettings.advancedFeatures' })}
</Divider>

{/* Reranker重排序 */}
<Form.Item
  name={['search_config', 'enable_reranker']}
  valuePropName="checked"
  tooltip={intl.formatMessage({ id: 'knowledgebase.retrievalSettings.enableRerankerTooltip' })}
>
  <Checkbox>
    {intl.formatMessage({ id: 'knowledgebase.retrievalSettings.enableReranker' })}
  </Checkbox>
</Form.Item>

{/* Reranker TopN - 仅在启用时显示 */}
{form.getFieldValue(['search_config', 'enable_reranker']) && (
  <Form.Item
    label={intl.formatMessage({ id: 'knowledgebase.retrievalSettings.rerankerTopN' })}
    name={['search_config', 'reranker_top_n']}
    tooltip={intl.formatMessage({ id: 'knowledgebase.retrievalSettings.rerankerTopNTooltip' })}
    rules={[
      { type: 'number', min: 1, max: 10, message: '范围: 1-10' }
    ]}
  >
    <InputNumber min={1} max={10} style={{ width: 120 }} />
  </Form.Item>
)}

{/* 知识图谱增强 - 保持原有位置 */}
<Form.Item name={['search_config', 'enable_graph_enhancement']} valuePropName="checked">
  <Checkbox>
    {intl.formatMessage({ id: 'knowledgebase.retrievalSettings.enableGraphEnhancement' })}
  </Checkbox>
</Form.Item>
```

#### Step 3: 更新TestSearchModal显示
```jsx
// frontend/src/pages/knowledgebase/components/TestSearchModal.js

// 显示Reranker分数（如果存在）
{item.rerank_score !== undefined && (
  <span style={{ marginLeft: 8, color: '#52c41a' }}>
    Rerank: {(item.rerank_score * 100).toFixed(1)}%
  </span>
)}
```

### 4.3 数据库Migration

```python
# 不需要新增字段，使用现有的search_config JSON字段
# search_config结构更新：
{
  "mode": "hybrid",
  "top_k": 10,
  "similarity_threshold": 0.5,
  "bm25_weight": 0.5,
  "vector_weight": 0.5,
  "enable_graph_enhancement": false,
  "enable_reranker": false,          # 新增
  "reranker_top_n": 5                # 新增
}
```

---

## 5. 性能预估

### 5.1 延迟分析

| 阶段 | 延迟 | 说明 |
|------|------|------|
| BM25检索 | ~50ms | 内存计算 |
| 向量检索 | ~100ms | Milvus查询 |
| 加权融合 | ~10ms | Python计算 |
| **Reranker** | **500-1500ms** | **GPU: 500ms, CPU: 1500ms** |
| **总延迟** | **660-1660ms** | **启用Reranker后** |
| 不启用Reranker | ~160ms | 基准延迟 |

**关键发现**：
- Reranker会显著增加延迟（3-10倍）
- GPU环境下可控（+500ms）
- CPU环境下影响较大（+1500ms）

### 5.2 准确度提升

根据业界Benchmark（BEIR数据集）：
- 仅向量检索：nDCG@10 ≈ 0.52
- 混合检索：nDCG@10 ≈ 0.61（+17%)
- 混合检索+Reranker：nDCG@10 ≈ 0.69（+33%）

**预期效果**：
- Reranker可在混合检索基础上再提升10-15%准确度
- 对于复杂查询效果更明显

### 5.3 资源消耗

| 资源 | 无Reranker | 有Reranker（GPU） | 有Reranker（CPU） |
|------|-----------|------------------|------------------|
| 内存 | ~2GB | ~4GB | ~3GB |
| GPU显存 | 0GB | ~2GB | 0GB |
| CPU | 中 | 低 | 高 |

---

## 6. 优化策略

### 6.1 Lazy Loading（已实现）
- 首次使用时才加载模型
- 避免启动时的资源消耗

### 6.2 候选文档限制
- 固定候选文档数 = `reranker_top_n * 2`
- 避免对过多文档进行rerank

### 6.3 降级处理
- Reranker失败时自动降级到原始排序
- 保证服务可用性

### 6.4 缓存机制（可选，后续优化）
```python
# 对相同query的rerank结果缓存5分钟
from functools import lru_cache

@lru_cache(maxsize=100)
def rerank_cached(query: str, doc_ids: Tuple[int]) -> List[float]:
    # ...
```

---

## 7. 测试验证

### 7.1 功能测试
- [ ] Reranker开关测试（开/关）
- [ ] TopN参数测试（1/3/5/10）
- [ ] 降级处理测试（模型加载失败）
- [ ] 并发查询测试（10个并发）

### 7.2 准确度测试
- [ ] 创建测试查询集（20个查询）
- [ ] 对比混合检索 vs 混合检索+Reranker
- [ ] 记录nDCG@5和nDCG@10指标

### 7.3 性能测试
- [ ] 延迟测试（GPU/CPU环境）
- [ ] 内存消耗测试
- [ ] 吞吐量测试（QPS）

---

## 8. 对标业界：KISS原则检查

### 8.1 配置复杂度对比

| 产品 | 暴露参数数量 | 我们的方案 |
|------|------------|----------|
| Dify | 2个（开关 + TopN） | ✅ 2个 |
| Weaviate | 3-4个 | ✅ 2个更简单 |
| RAGFlow | 4-5个 | ✅ 2个更简单 |

**结论**：✅ 符合KISS原则，配置最简化

### 8.2 技术栈复杂度

| 方案 | 依赖 | 部署复杂度 | 运维成本 |
|------|------|-----------|---------|
| Cohere API | 外部API | 低 | 中（付费） |
| 本地BGE | FlagEmbedding库 | 中 | 低（免费） |

**我们的选择**：本地BGE
- ✅ 无外部依赖
- ✅ 无API成本
- ✅ 数据隐私安全

---

## 9. 风险与对策

### 9.1 风险清单

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| Reranker延迟过高 | 用户体验下降 | 中 | 1. 默认关闭<br>2. 提示预期延迟<br>3. GPU加速 |
| 模型加载失败 | 功能不可用 | 低 | 降级处理，返回原始排序 |
| 内存/显存不足 | 服务崩溃 | 中 | 1. Lazy loading<br>2. 候选文档限制 |
| 中文效果不佳 | 准确度提升有限 | 低 | BGE专门优化中文 |

### 9.2 回滚计划

如果Reranker效果不理想：
1. **Phase 1**：默认关闭（已实现）
2. **Phase 2**：收集用户反馈
3. **Phase 3**：如效果差，移除相关代码

---

## 10. 后续优化方向

### 10.1 短期优化（1-2周）
- [ ] 添加Reranker分数可视化
- [ ] 性能监控和日志
- [ ] A/B测试框架

### 10.2 中期优化（1-2月）
- [ ] 结果缓存机制
- [ ] 模型量化（INT8）加速
- [ ] 批处理优化

### 10.3 长期优化（3-6月）
- [ ] 支持更多Reranker模型
- [ ] Fine-tune专属领域模型
- [ ] 多级Reranker（快速+精确）

---

## 11. 总结

### 11.1 核心价值
- ✅ 提升10-15%检索准确度
- ✅ 保持KISS原则（仅2个配置）
- ✅ 对标业界最佳实践
- ✅ 开源免费，无API成本
- ✅ 中文优先，完美匹配场景

### 11.2 实施建议
1. **先验证，后推广**：先在测试环境验证效果
2. **性能优先**：GPU环境下优先使用
3. **默认关闭**：由用户根据需要开启
4. **持续优化**：根据用户反馈迭代

### 11.3 预期效果
- 延迟增加：+500ms（GPU）或 +1500ms（CPU）
- 准确度提升：+10-15% nDCG@10
- 用户满意度：显著提升（特别是复杂查询）

---

## 12. 参考资源

- [Dify Rerank文档](https://docs.dify.ai/learn-more/extended-reading/retrieval-augment/rerank)
- [BGE Reranker GitHub](https://github.com/FlagOpen/FlagEmbedding)
- [BGE Reranker HuggingFace](https://huggingface.co/BAAI/bge-reranker-v2-m3)
- [Reranker Benchmark](https://medium.com/@bhagyarana80/top-8-rerankers-quality-vs-cost-4e9e63b73de8)
- [BEIR Benchmark](https://github.com/beir-cellar/beir)
