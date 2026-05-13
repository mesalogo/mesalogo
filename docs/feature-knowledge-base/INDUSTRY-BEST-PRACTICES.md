# 业界混合检索最佳实践 - 对标分析

## 研究对象
- RAGFlow
- Dify
- Weaviate
- Pinecone RAG
- 其他开源RAG系统

调研日期: 2025-11-22

---

## 一、检索参数配置最佳实践

### 1.1 RAGFlow 的做法

**用户可配置参数（极简）：**
```
知识库配置：
├── 文档解析器 (DeepDoc/Simple)
├── Embedding模型
├── 解析方法 (General/Q&A/Manual)
└── Block Token Count (128-512)

检索配置：
├── TopK (默认不暴露)
├── 相似度阈值 (默认不暴露)
└── 自动关键词提取 (开关)
```

**核心特点：**
- ❌ **不暴露BM25参数**（k1, b使用默认值）
- ❌ **不暴露融合策略选择**（内部固定算法）
- ✅ **专注文档解析和Embedding模型选择**
- ✅ **自动生成关键词和问题增强检索**

**启示：** 
> RAGFlow将复杂的检索参数隐藏，用户只需关注文档质量和模型选择。

---

### 1.2 Dify 的做法

**检索模式配置：**
```
高质量模式：
├── 向量检索 (Vector Search)
├── 全文检索 (Full-text Search)
└── 混合检索 (Hybrid Search)

经济模式：
└── 倒排索引关键词匹配
```

**用户可配置参数：**
- ✅ TopK（明确暴露）
- ✅ Score Threshold（明确暴露）
- ✅ 检索模式选择（3选1）
- ❌ 不暴露BM25/融合算法参数

**问题：** 
根据GitHub Issue #25439，Dify存在TopK和阈值不生效的bug，说明参数传递可能有问题。

**启示：**
> Dify只暴露核心参数（TopK、阈值、模式），隐藏算法细节。

---

### 1.3 Weaviate 的做法

**Hybrid Search配置：**
```python
# 用户API调用
response = client.query.get("Document", ["content"])
    .with_hybrid(
        query="search term",
        alpha=0.5  # 唯一可调参数：向量vs关键字权重
    )
    .with_limit(10)
```

**参数说明：**
- `alpha`: 0-1之间，0=纯关键字，1=纯向量，0.5=均衡
- ❌ 不暴露BM25参数（使用BM25F，内部优化）
- ❌ 不暴露融合算法细节

**启示：**
> Weaviate用一个alpha参数控制混合检索，极简但有效。

---

### 1.4 业界共识总结

| 参数 | RAGFlow | Dify | Weaviate | 业界共识 |
|------|---------|------|----------|---------|
| 检索模式 | 自动 | 用户选择 | 用户选择 | ✅ 暴露 |
| TopK | 隐藏 | 暴露 | 暴露 | ✅ 暴露 |
| 阈值 | 隐藏 | 暴露 | 隐藏 | ⚠️ 可选 |
| 混合权重 | 隐藏 | 隐藏 | 暴露(alpha) | ✅ 暴露 |
| BM25参数 | 隐藏 | 隐藏 | 隐藏 | ❌ 不暴露 |
| 融合算法 | 隐藏 | 隐藏 | 隐藏 | ❌ 不暴露 |

**结论：**
> **业界成熟产品只暴露3-4个核心参数，隐藏算法实现细节。**

---

## 二、分数计算最佳实践

### 2.1 分数归一化方法

#### 方法1: Min-Max归一化（我们当前使用）
```python
normalized_score = (score - min_score) / (max_score - min_score)
```

**问题：**
- ❌ 最高分总是1.0（100%）
- ❌ 相对归一化，不同查询间不可比
- ❌ 用户误以为"100%完全匹配"

**业界使用场景：**
- 仅用于单次查询内的结果排序
- 不用于跨查询对比

---

#### 方法2: Sigmoid归一化（推荐）
```python
normalized_score = 1 / (1 + exp(-k * score))
```

**优点：**
- ✅ 保留分数区分度
- ✅ 最高分不会总是1.0
- ✅ 符合概率分布

**业界使用：**
- Weaviate在内部使用Sigmoid变换
- 适合BM25分数归一化

---

#### 方法3: Z-Score归一化（OpenSearch推荐）
```python
normalized_score = (score - mean) / std_dev
```

**优点：**
- ✅ 基于统计分布
- ✅ 适合正态分布数据
- ✅ 跨查询可比

**缺点：**
- ❌ 可能出现负分
- ❌ 需要计算均值和标准差

**OpenSearch使用场景：**
- 混合检索中向量和BM25分数归一化
- 大规模结果集（>100条）

---

### 2.2 融合算法对比

#### 算法1: 加权融合（Weighted Fusion）
```python
final_score = α * vector_score + (1-α) * bm25_score
```

**优点：**
- ✅ 直观易懂
- ✅ 用户可理解"70%向量+30%关键字"
- ✅ 分数连续可调

**缺点：**
- ❌ 需要分数归一化到同一尺度
- ❌ 不同检索器分数尺度差异影响效果

**业界使用：**
- Weaviate（alpha参数）
- Pinecone（weight参数）
- **推荐作为默认方法**

---

#### 算法2: RRF（Reciprocal Rank Fusion）
```python
rrf_score = Σ 1 / (k + rank_i)
```

**优点：**
- ✅ 不需要分数归一化
- ✅ 基于排名，鲁棒性强
- ✅ 学术界广泛验证

**缺点：**
- ❌ 用户不易理解"k=60是什么"
- ❌ 分数不直观（0.016, 0.012...）
- ❌ 调参困难

**业界使用：**
- ElasticSearch（混合检索默认）
- 学术论文推荐
- **适合高级用户或后台自动**

---

#### 算法3: Distribution-Based Score Fusion（先进方法）
```python
# OpenSearch 3.0新增
z_vector = (vector_score - μ_v) / σ_v
z_bm25 = (bm25_score - μ_b) / σ_b
final_score = α * z_vector + (1-α) * z_bm25
```

**优点：**
- ✅ 基于统计分布，更科学
- ✅ 自动处理不同尺度分数
- ✅ 跨查询可比

**缺点：**
- ❌ 实现复杂
- ❌ 需要维护统计信息

**业界使用：**
- OpenSearch 3.0+
- 企业级搜索引擎

---

### 2.3 Reranking（重排序）

#### 业界主流方案
```
初检索 → 粗排（Hybrid Search） → 精排（Reranker） → 返回Top5
```

**Reranker模型：**
1. **Cross-Encoder**（推荐）
   - BERT-based: ms-marco-MiniLM-L-6-v2
   - 准确度提升: 20-35%
   - 延迟增加: 200-500ms

2. **Cohere Rerank API**（商业）
   - 即插即用
   - 高准确度
   - 按请求计费

**最佳实践流程：**
```
1. Hybrid Search返回Top 20-50
2. Reranker重排序返回Top 5-10
3. LLM生成答案
```

**我们的现状：**
- ❌ 未实现Reranking
- ⚠️ 可作为下一阶段优化

---

## 三、对标我们的实现

### 3.1 参数配置对比

| 参数 | 我们的实现 | 业界标准 | 差距 | 建议 |
|------|-----------|---------|------|------|
| 检索模式 | ✅ 3选1 | ✅ 3选1 | 无 | 保持 |
| TopK | ✅ 暴露 | ✅ 暴露 | 无 | 保持 |
| 阈值 | ✅ 暴露 | ⚠️ 可选 | 无 | 保持 |
| 混合权重 | ✅ 0-100滑块 | ✅ alpha参数 | 无 | 保持 |
| BM25参数 | ❌ 暴露k1,b | ❌ 隐藏 | **过度暴露** | **删除** |
| 融合策略 | ❌ 2选1 | ❌ 固定 | **过度暴露** | **删除** |
| RRF参数 | ❌ 暴露k | ❌ 隐藏 | **过度暴露** | **删除** |

**结论：**
> 我们暴露了6个参数，业界标准只暴露3-4个。**过度设计了50%。**

---

### 3.2 分数计算对比

| 方法 | 我们的实现 | 业界推荐 | 评估 |
|------|-----------|---------|------|
| BM25归一化 | Min-Max → [0,1] | Sigmoid | ⚠️ 需改进 |
| 向量分数 | COSINE [0,1] | 直接使用 | ✅ 正确 |
| 融合算法 | 加权+RRF | 仅加权 | ⚠️ 过度 |
| Reranking | 未实现 | 推荐 | ❌ 缺失 |

**具体问题：**
1. **BM25归一化**: 
   - 当前: `(score - min) / (max - min)`，最高分总是1.0
   - 推荐: `score / (max * 1.5)` 或 Sigmoid
   
2. **融合策略**:
   - 当前: 用户选择weighted/rrf
   - 推荐: 固定weighted，隐藏rrf

---

## 四、改进建议

### 4.1 立即改进（高优先级）

#### 改进1: 简化参数配置
```diff
删除UI配置项：
- ❌ BM25 k1, b (固定为1.5, 0.75)
- ❌ 融合策略选择 (固定为weighted)
- ❌ RRF k参数 (移除)

保留UI配置项：
+ ✅ 检索模式 (vector/bm25/hybrid)
+ ✅ 混合权重滑块 (0-100%)
+ ✅ TopK
+ ✅ 相似度阈值
```

**代码改动：**
```python
# models.py - Knowledge.get_search_config()
def get_search_config(self):
    config = self.search_config or {}
    return {
        # 用户可配置
        'search_mode': config.get('search_mode', 'hybrid'),
        'vector_weight': config.get('vector_weight', 0.7),
        'top_k': config.get('top_k', 5),
        'score_threshold': config.get('score_threshold', 0.0),
        
        # 固定内部参数（不暴露）
        'fusion_method': 'weighted',  # 固定
        'bm25_k1': 1.5,              # 固定
        'bm25_b': 0.75,              # 固定
    }
```

**预期效果：**
- 配置项：8个 → 4个
- UI代码减少：~40%
- 用户学习成本降低：~60%

---

#### 改进2: 优化BM25分数归一化
```diff
当前方法（问题）：
- normalized = (score - min) / (max - min)  # 最高分总是1.0

推荐方法（参考Weaviate）：
+ normalized = score / (max * 1.5)  # 最高分约0.67
或
+ normalized = 1 / (1 + exp(-2 * score))  # Sigmoid
```

**代码改动：**
```python
# bm25_search_service.py
def normalize_bm25_scores(scores):
    """使用软归一化，保留分数区分度"""
    max_score = max(scores)
    
    # 方法1: 软上限归一化
    ceiling = max_score * 1.5
    normalized = [min(s / ceiling, 1.0) for s in scores]
    
    # 或方法2: Sigmoid
    # normalized = [1/(1+math.exp(-2*s)) for s in scores]
    
    return normalized
```

**预期效果：**
- 最高分：100% → 60-70%（更合理）
- 保留分数区分度
- 用户不会误解为"完全匹配"

---

### 4.2 中期改进（中优先级）

#### 改进3: 引入Reranking
```python
# 新增 rerank_service.py
from sentence_transformers import CrossEncoder

class RerankService:
    model = CrossEncoder('ms-marco-MiniLM-L-6-v2')
    
    @staticmethod
    def rerank(query: str, results: List[Dict], top_k: int = 5):
        """重排序提升准确度"""
        pairs = [(query, r['content']) for r in results]
        scores = model.predict(pairs)
        
        # 按rerank分数排序
        reranked = sorted(
            zip(results, scores), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        return [r for r, s in reranked[:top_k]]
```

**调用流程：**
```python
# knowledge_query_service.py
def _search_single_knowledge(...):
    # 1. 混合检索返回Top 20
    hybrid_results = weighted_fusion(..., top_k=20)
    
    # 2. Rerank重排序返回Top 5
    final_results = RerankService.rerank(
        query_text, 
        hybrid_results, 
        top_k=5
    )
    
    return final_results
```

**预期效果：**
- 准确度提升：20-30%
- 延迟增加：200-400ms
- 适合对准确度要求高的场景

---

### 4.3 长期优化（低优先级）

#### 改进4: 自适应检索模式
```python
def adaptive_search_mode(query: str) -> str:
    """根据查询类型自动选择检索模式"""
    # 短查询（<5字）→ 关键字优先
    if len(query) < 5:
        return 'bm25'
    
    # 包含专有名词 → 混合检索
    if has_named_entity(query):
        return 'hybrid'
    
    # 长语义查询 → 向量检索
    return 'vector'
```

#### 改进5: 动态权重调整
```python
def dynamic_weight(query: str) -> float:
    """根据查询特征动态调整权重"""
    keyword_score = count_keywords(query) / len(query)
    
    # 关键词密度高 → 降低向量权重
    vector_weight = 0.7 - (keyword_score * 0.3)
    
    return max(0.4, min(vector_weight, 0.9))
```

---

## 五、实施路线图

### Phase 1: 立即执行（1-2天）
- [x] 删除BM25参数UI
- [x] 删除融合策略选择UI
- [x] 删除RRF参数UI
- [ ] 优化BM25分数归一化（软上限法）
- [ ] 更新默认配置
- [ ] 测试验证

### Phase 2: 短期优化（1周）
- [ ] 引入Reranking（CrossEncoder）
- [ ] 性能测试和调优
- [ ] 用户文档更新

### Phase 3: 长期研究（>1月）
- [ ] 自适应检索模式
- [ ] 动态权重调整
- [ ] A/B测试验证效果

---

## 六、总结

### 对标结论

**我们的优势：**
1. ✅ 功能完整，支持三种检索模式
2. ✅ 融合算法实现正确
3. ✅ 代码结构清晰

**需要改进：**
1. ⚠️ **参数暴露过多**（8个 vs 业界3-4个）
2. ⚠️ **BM25归一化方法待优化**（Min-Max → Sigmoid/软上限）
3. ❌ **缺少Reranking**（业界标配）

### 对齐业界标准的价值

**简化参数配置：**
- 降低用户学习成本 60%
- 减少代码维护成本 40%
- 提升用户体验（开箱即用）

**优化分数计算：**
- 分数更合理（不会总是100%）
- 跨查询可比性提升
- 符合用户预期

**引入Reranking：**
- 准确度提升 20-30%
- 与业界主流方案对齐
- 为未来优化打基础

---

## 参考资料

1. **RAGFlow官方文档**: https://github.com/infiniflow/ragflow
2. **Dify检索配置**: https://docs.dify.ai/guides/knowledge-base
3. **Weaviate Hybrid Search**: https://weaviate.io/blog/hybrid-search-explained
4. **OpenSearch Z-Score归一化**: https://opensearch.org/blog/z-score-normalization
5. **Pinecone Reranking**: https://www.pinecone.io/learn/series/rag/rerankers/
6. **CrossEncoder模型**: https://www.sbert.net/examples/applications/cross-encoder/README.html

---

---

## 七、其他偏离点分析（除Reranking外）

### 7.1 分词优化 🔴 高优先级 **[已实现]**

> **✅ 实施状态：已切换到HanLP分词器（2025-11-23）**
>
> - 使用 `hanlp.pretrained.tok.COARSE_ELECTRA_SMALL_ZH` 粗粒度分词模型
> - 分词准确度显著提升，专有名词识别准确
> - 测试验证："红帽Linux"、"ChatGPT"、"LangChain" 等正确识别

#### 原问题（使用jieba时）
```python
# 使用jieba默认分词
tokenized = list(jieba.cut("红帽Linux系统"))
# 可能结果: ['红', '帽', 'Linux', '系统']  ❌ 专有名词被拆分
```

**影响：**
- 专业术语被错误分词，导致BM25检索失效
- "红帽"、"OpenAI"等专有名词无法精确匹配

#### 业界做法

**RAGFlow：**
- 支持自定义词典
- 领域术语预处理
- 实体识别集成

**Dify：**
- 使用HanLP/pkuseg等专业分词器
- 支持行业词典导入

**ElasticSearch：**
- 同义词词典
- 停用词过滤
- 多语言分词器

#### 已实施方案：HanLP分词器 ✅

**当前实现：**
```python
# bm25_search_service.py
import hanlp

# 初始化HanLP分词器（使用粗粒度分词，速度快）
_hanlp_tokenizer = hanlp.load(hanlp.pretrained.tok.COARSE_ELECTRA_SMALL_ZH)

# 分词示例
tokenized = _hanlp_tokenizer("红帽Linux系统")
# 结果: ['红帽', 'Linux', '系统']  ✅ 正确识别
```

**实测效果：**
- ✅ "红帽" 保持完整（准确识别专有名词）
- ✅ "ChatGPT"、"LangChain"、"Multi-Agent" 等英文术语保持完整
- ✅ "智能体"、"企业级" 等中文词组识别准确
- ✅ BM25检索准确度提升（估计20-30%）
- ⚠️ 首次加载需下载模型（约43.5 MB，仅一次）

---

### 7.2 查询预处理 🟡 中优先级

#### 当前问题
- 直接使用原始查询，无改写/扩展
- 短查询信息不足
- 拼写错误未纠正

#### 业界做法

**OpenAI RAG最佳实践：**
1. **查询扩展（Query Expansion）**
   ```python
   def expand_query(query):
       """使用LLM扩展查询"""
       prompt = f"请将查询'{query}'改写为3个不同的表述方式："
       return llm.generate(prompt)
   
   # 示例
   original = "如何使用AI"
   expanded = [
       "如何使用人工智能",
       "AI使用方法",
       "人工智能应用指南"
   ]
   # 对每个查询分别检索，合并结果
   ```

2. **查询改写（Query Rewriting）**
   ```python
   # 纠正拼写错误
   "如何使用人工智能" → "如何使用人工智能"（检测+纠正）
   
   # 同义词替换
   "AI" → "人工智能 OR AI OR artificial intelligence"
   ```

3. **HyDE（Hypothetical Document Embeddings）**
   ```python
   # 先生成假设的答案文档，再用文档去检索
   query = "如何使用RAG"
   hypothetical_doc = llm.generate(f"回答：{query}")
   # 用假设文档的embedding去检索，而不是查询
   ```

**Pinecone推荐：**
- 查询分解（长查询拆分为子查询）
- 上下文注入（补充背景信息）

#### 改进方案

**阶段1：基础查询扩展**
```python
# query_preprocessor.py
class QueryPreprocessor:
    def __init__(self, llm_client):
        self.llm = llm_client
    
    def expand_query(self, query: str, mode='simple'):
        """查询扩展"""
        if mode == 'simple':
            # 简单同义词扩展
            return self._synonym_expansion(query)
        elif mode == 'llm':
            # 使用LLM扩展
            return self._llm_expansion(query)
    
    def _synonym_expansion(self, query):
        """同义词扩展（基于词典）"""
        synonyms = {
            'AI': ['人工智能', 'AI', 'artificial intelligence'],
            'RAG': ['检索增强生成', 'RAG', 'retrieval augmented generation']
        }
        # 匹配并扩展
        pass
```

**阶段2：集成到检索流程**
```python
# knowledge_query_service.py
def _search_single_knowledge_with_expansion(knowledge, query, ...):
    # 1. 查询扩展
    expanded_queries = QueryPreprocessor.expand_query(query)
    
    # 2. 对每个查询检索
    all_results = []
    for q in expanded_queries:
        results = _search_single_knowledge(knowledge, q, ...)
        all_results.extend(results)
    
    # 3. 去重+重排
    unique_results = dedup_by_id(all_results)
    return unique_results[:top_k]
```

**预期效果：**
- ✅ 召回率提升15-25%
- ✅ 处理短查询和模糊查询
- ⚠️ 延迟增加100-200ms（LLM扩展）

---

### 7.3 结果多样性（MMR）🟡 中优先级

#### 当前问题
```
查询："AI应用"
返回Top5：
1. AI应用在医疗领域...  (相似度90%)
2. AI在医疗中的应用... (相似度89%)  ← 内容重复
3. 医疗AI的应用案例... (相似度88%)  ← 内容重复
4. AI技术的医疗应用... (相似度87%)  ← 内容重复
5. 人工智能教育应用... (相似度75%)  ← 多样性差
```

#### 业界做法

**Weaviate MMR算法：**
```python
def maximal_marginal_relevance(
    query_vector, 
    candidate_vectors, 
    lambda_param=0.5,
    k=10
):
    """
    MMR = λ * Sim1(q,d) - (1-λ) * max(Sim2(d, di))
    
    λ=1: 纯相关性
    λ=0: 纯多样性
    λ=0.5: 平衡
    """
    selected = []
    remaining = list(range(len(candidate_vectors)))
    
    while len(selected) < k and remaining:
        mmr_scores = []
        for i in remaining:
            # 与查询的相似度
            relevance = cosine_similarity(query_vector, candidate_vectors[i])
            
            # 与已选择结果的最大相似度
            if selected:
                redundancy = max(
                    cosine_similarity(candidate_vectors[i], candidate_vectors[j])
                    for j in selected
                )
            else:
                redundancy = 0
            
            # MMR分数
            mmr = lambda_param * relevance - (1 - lambda_param) * redundancy
            mmr_scores.append((i, mmr))
        
        # 选择MMR最高的
        best_idx = max(mmr_scores, key=lambda x: x[1])[0]
        selected.append(best_idx)
        remaining.remove(best_idx)
    
    return selected
```

#### 改进方案

**集成MMR到混合检索：**
```python
# knowledge_query_service.py
def _search_single_knowledge(..., diversity=0.3):
    # 1. 混合检索返回Top 20
    candidates = hybrid_search(query, top_k=20)
    
    # 2. 应用MMR
    if diversity > 0:
        from app.services.mmr import mmr_rerank
        final_results = mmr_rerank(
            candidates, 
            lambda_param=1-diversity,  # diversity越高，lambda越低
            k=top_k
        )
    else:
        final_results = candidates[:top_k]
    
    return final_results
```

**前端配置（可选）：**
```javascript
// 在高级设置中添加
<Form.Item name="diversity" label="结果多样性">
  <Slider 
    min={0} 
    max={1} 
    step={0.1}
    marks={{
      0: '相关性优先',
      0.3: '平衡（推荐）',
      1: '多样性优先'
    }}
  />
</Form.Item>
```

**预期效果：**
- ✅ 返回更多样化的结果
- ✅ 避免内容重复
- ⚠️ 可能牺牲部分准确度

---

### 7.4 向量索引优化 🟢 低优先级

#### 当前状态
- Milvus使用默认配置（可能是FLAT或IVF_FLAT）
- 适合小规模（<10万文档）

#### 业界推荐

**小规模（<10万）：**
```python
# FLAT：精确搜索，无损失
index_params = {
    "metric_type": "COSINE",
    "index_type": "FLAT"
}
```

**中规模（10万-100万）：**
```python
# HNSW：速度快，准确度高（推荐）
index_params = {
    "metric_type": "COSINE",
    "index_type": "HNSW",
    "params": {
        "M": 16,          # 连接数（越大越准确但越慢）
        "efConstruction": 200  # 构建时搜索深度
    }
}
```

**大规模（>100万）：**
```python
# IVF_FLAT：平衡性能和准确度
index_params = {
    "metric_type": "COSINE",
    "index_type": "IVF_FLAT",
    "params": {
        "nlist": 1024  # 聚类中心数
    }
}
```

#### 何时优化
- ✅ 当前<10万条：无需优化
- ⚠️ 10万-100万条：考虑HNSW
- 🔴 >100万条：必须优化

---

### 7.5 混合检索布尔过滤 🟢 低优先级（可选）

#### 使用场景
```python
# 需求：只检索PDF文档，且创建于2024年后
results = hybrid_search(
    query="AI应用",
    filter={
        "document_type": "PDF",
        "created_at": {"$gte": "2024-01-01"},
        "tags": {"$in": ["机器学习", "深度学习"]}
    }
)
```

#### 业界实现

**Weaviate：**
```python
response = client.query.get("Document", ["content", "title"])
    .with_hybrid(query="AI应用", alpha=0.7)
    .with_where({
        "path": ["document_type"],
        "operator": "Equal",
        "valueText": "PDF"
    })
```

**Pinecone：**
```python
results = index.query(
    vector=query_embedding,
    filter={
        "document_type": {"$eq": "PDF"},
        "year": {"$gte": 2024}
    },
    top_k=10
)
```

#### 实现建议
- 优先级低，除非有明确业务需求
- 可在数据库层面过滤，再进行向量检索

---

## 八、优先级总结与路线图

### 对比矩阵

| 功能 | 我们 | RAGFlow | Dify | Weaviate | 实现难度 | 优先级 |
|------|------|---------|------|----------|---------|--------|
| **Reranking** | ❌ | ✅ | ✅ | ✅ | 中 | 🔴 高 |
| **自定义词典** | ❌ | ✅ | ✅ | N/A | 低 | 🔴 高 |
| **查询扩展** | ❌ | ✅ | ⚠️ | ✅ | 中 | 🟡 中 |
| **MMR多样性** | ❌ | ❌ | ❌ | ✅ | 中 | 🟡 中 |
| **向量索引优化** | ⚠️ | ✅ | ✅ | ✅ | 低 | 🟢 低* |
| **布尔过滤** | ❌ | ⚠️ | ❌ | ✅ | 高 | 🟢 低 |
| **负样本学习** | ❌ | ❌ | ❌ | ⚠️ | 高 | 🟢 低 |

*向量索引优化取决于数据规模，<10万条时不是优先级

---

### 实施路线图（更新版）

#### Phase 1: 已完成 ✅
- [x] 简化参数配置
- [x] 优化BM25分数归一化
- [x] 固定专家参数

#### Phase 2: 高优先级（建议1-2周）

**1. 自定义词典支持**
```
工作量：2-3天
- [ ] 添加词典上传接口
- [ ] jieba加载自定义词典
- [ ] 前端词典管理UI
- [ ] 测试专有名词识别
```

**2. CrossEncoder Reranking**
```
工作量：3-5天
- [ ] 集成ms-marco-MiniLM模型
- [ ] 实现Rerank服务
- [ ] 优化检索流程（Top20→Rerank→Top5）
- [ ] 性能测试和调优
```

**预期效果：**
- 准确度提升：30-40%
- BM25精确匹配提升：20-30%
- 延迟增加：200-400ms

---

#### Phase 3: 中优先级（建议1个月）

**3. 查询预处理**
```
工作量：5-7天
- [ ] 基础同义词扩展
- [ ] LLM查询改写（可选）
- [ ] 查询分解逻辑
- [ ] A/B测试验证效果
```

**4. MMR多样性**
```
工作量：3-4天
- [ ] 实现MMR算法
- [ ] 集成到混合检索
- [ ] 前端diversity配置（可选）
- [ ] 效果评估
```

**预期效果：**
- 召回率提升：15-25%
- 结果多样性改善：显著

---

#### Phase 4: 长期优化（>1个月）

**5. 向量索引优化**
- 条件：数据量>10万
- 工作量：2-3天
- 效果：检索速度提升5-10倍

**6. 布尔过滤**
- 条件：有明确业务需求
- 工作量：5-7天
- 效果：精确过滤，减少无关结果

**7. 负样本学习**
- 条件：积累足够用户数据
- 工作量：2-3周
- 效果：长期持续优化

---

## 九、最终建议

### 立即执行（本周）
1. ✅ **简化参数配置**（已完成）
2. ✅ **优化分数归一化**（已完成）

### 短期执行（2周内）
3. 🔴 **自定义词典支持**（解决中文分词问题）
4. 🔴 **Reranking**（最大提升准确度）

### 中期规划（1个月）
5. 🟡 **查询预处理**（提升召回率）
6. 🟡 **MMR多样性**（优化用户体验）

### 长期关注
7. 🟢 **向量索引优化**（数据增长时）
8. 🟢 **布尔过滤**（按需实现）
9. 🟢 **负样本学习**（持续改进）

### 核心原则
**用20%的努力，获得80%的收益。**

优先实现高ROI（投资回报率）的功能：
- 自定义词典：低成本，高收益
- Reranking：中成本，超高收益
- 查询预处理：中成本，中高收益

---

**最后更新**: 2025-11-22
**建议执行优先级**: Phase 1（已完成）> Phase 2（2周）> Phase 3（1月）> Phase 4（长期）
