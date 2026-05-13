# 知识库混合检索（BM25 + 向量检索）实现方案

## 1. 背景与目标

### 1.1 现状
当前知识库仅支持向量检索（Milvus COSINE相似度搜索），存在以下局限：
- **语义漂移**：对于精确关键词查询可能匹配不准确
- **专有名词**：技术术语、人名、产品名等精确匹配效果差
- **短查询**：短关键词查询时向量表示信息不足

### 1.2 目标
实现BM25关键字检索与向量检索的混合模式，提升检索准确性：
- 支持三种检索模式：向量检索、BM25检索、混合检索
- 使用RRF（Reciprocal Rank Fusion）算法融合多路检索结果
- 前端可配置检索模式和参数
- 最小化数据库改动，查询时实时分词

---

## 2. 技术架构

### 2.1 BM25算法原理

**公式：**
```
Score(D, Q) = Σ IDF(qi) × (f(qi, D) × (k1 + 1)) / (f(qi, D) + k1 × (1 - b + b × |D| / avgdl))
```

**关键因素：**
1. **词频 (TF)**：词在文档中出现次数（非线性增长）
2. **逆文档频率 (IDF)**：区分常见词和稀有词
3. **长度归一化**：避免长文档得分虚高

**参数：**
- `k1` (1.2-2.0)：控制词频饱和度
- `b` (0.75)：控制长度惩罚强度

### 2.2 RRF融合算法

**公式：**
```
RRF_score = Σ 1 / (k + rank_i)
```

其中 `k` 通常取60，`rank_i` 是文档在第i个检索列表中的排名。

**优势：**
- 无需归一化不同检索器的分数
- 对排名靠前的文档给予更高权重
- 鲁棒性强，适合异构检索系统

### 2.3 系统架构

```
┌─────────────────┐
│   前端设置界面   │ ← 配置检索模式、参数
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      知识库查询服务                      │
│   (knowledge_query_service.py)          │
└────────┬───────────────────────────────┘
         │
         ├──────────────┬──────────────┐
         ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ 向量检索  │  │BM25检索  │  │ RRF融合  │
  │ (Milvus) │  │ (内存)   │  │ (算法)   │
  └──────────┘  └──────────┘  └──────────┘
         │              │              │
         └──────────────┴──────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  融合后结果   │
                 └──────────────┘
```

---

## 3. 实现方案

### 3.1 后端修改

#### 3.1.1 创建BM25检索服务

**文件：** `backend/app/services/knowledge_base/bm25_search_service.py`

**核心功能：**
```python
class BM25SearchService:
    @staticmethod
    def search_knowledge(knowledge_id, query_text, top_k=5, score_threshold=0.0):
        """
        实现步骤：
        1. 从 KnowledgeFileChunk 表加载文档块
        2. 使用 jieba 进行中文分词
        3. 构建 BM25Okapi 索引
        4. 计算查询分数并返回 top_k 结果
        """
```

**依赖库：**
- `rank-bm25==0.2.2`：BM25算法实现
- `jieba==0.42.1`：中文分词

#### 3.1.2 修改知识库查询服务

**文件：** `backend/app/services/knowledge_base/knowledge_query_service.py`

**修改点：**
```python
@staticmethod
def _search_single_knowledge(knowledge, query_text, top_k, score_threshold, vector_db_service):
    # 获取检索模式配置
    search_mode = SystemSetting.get('knowledge_search_mode', 'vector')
    
    results_list = []
    
    # 1. 向量检索
    if search_mode in ['vector', 'hybrid']:
        vector_results = vector_db_service.search(...)
        results_list.append(vector_results)
    
    # 2. BM25检索
    if search_mode in ['bm25', 'hybrid']:
        bm25_results = BM25SearchService.search_knowledge(...)
        results_list.append(bm25_results)
    
    # 3. 结果融合
    if search_mode == 'hybrid':
        return reciprocal_rank_fusion(results_list)
    else:
        return results_list[0]
```

#### 3.1.3 RRF融合算法

**函数：** `reciprocal_rank_fusion(results_list, k=60)`

**逻辑：**
```python
for results in results_list:
    for rank, result in enumerate(results, start=1):
        rrf_score += 1.0 / (k + rank)

sorted_by_rrf_score()
```

#### 3.1.4 系统设置

**文件：** `backend/app/seed_data/seed_data_system_settings.json`

**新增配置项：**
```json
{
  "key": "knowledge_search_mode",
  "value": "hybrid",
  "value_type": "string",
  "description": "知识库检索模式（vector/bm25/hybrid）",
  "category": "knowledge_search"
},
{
  "key": "knowledge_search_bm25_k1",
  "value": "1.5",
  "value_type": "number",
  "description": "BM25算法参数k1（词频饱和度）",
  "category": "knowledge_search"
},
{
  "key": "knowledge_search_bm25_b",
  "value": "0.75",
  "value_type": "number",
  "description": "BM25算法参数b（长度归一化）",
  "category": "knowledge_search"
},
{
  "key": "knowledge_search_rrf_k",
  "value": "60",
  "value_type": "number",
  "description": "RRF融合算法常数k",
  "category": "knowledge_search"
}
```

### 3.2 前端修改

#### 3.2.1 创建知识库检索设置页面

**文件：** `frontend/src/pages/settings/GeneralSettingsPage/tabs/KnowledgeSearchSettings.js`

**UI组件：**
```jsx
<Form.Item name="knowledge_search_mode" label="检索模式">
  <Radio.Group>
    <Radio value="vector">向量检索</Radio>
    <Radio value="bm25">关键字检索 (BM25)</Radio>
    <Radio value="hybrid">混合检索</Radio>
  </Radio.Group>
</Form.Item>

<Form.Item name="knowledge_search_bm25_k1" label="BM25 k1参数">
  <InputNumber min={1.0} max={3.0} step={0.1} />
  <Tooltip>控制词频饱和度，通常1.2-2.0</Tooltip>
</Form.Item>

<Form.Item name="knowledge_search_bm25_b" label="BM25 b参数">
  <InputNumber min={0} max={1} step={0.05} />
  <Tooltip>控制长度归一化，通常0.75</Tooltip>
</Form.Item>

<Form.Item name="knowledge_search_rrf_k" label="RRF融合常数k">
  <InputNumber min={10} max={100} step={10} />
  <Tooltip>RRF算法常数，通常60</Tooltip>
</Form.Item>
```

#### 3.2.2 多语言支持

**文件：** `frontend/src/locales/zh-CN.js` 和 `en-US.js`

**新增翻译：**
```javascript
knowledgeSearch: {
  title: '知识库检索设置',
  mode: '检索模式',
  vectorMode: '向量检索',
  bm25Mode: '关键字检索 (BM25)',
  hybridMode: '混合检索',
  bm25K1: 'BM25 k1参数',
  bm25B: 'BM25 b参数',
  rrfK: 'RRF融合常数',
  tooltips: {
    mode: '选择知识库检索方式',
    k1: '控制词频饱和度，值越大词频影响越小',
    b: '控制文档长度归一化，0表示不归一化，1表示完全归一化',
    rrf: 'RRF算法用于融合多路检索结果，通常设为60'
  }
}
```

#### 3.2.3 集成到设置页面

**文件：** `frontend/src/pages/settings/GeneralSettingsPage/index.js`

**添加标签页：**
```jsx
<Tabs>
  <TabPane tab="基本设置" key="basic">
    <BasicSettings />
  </TabPane>
  <TabPane tab="文档解析器" key="parsers">
    <DocumentParsersSettings />
  </TabPane>
  <TabPane tab="知识库检索" key="knowledge-search">
    <KnowledgeSearchSettings />
  </TabPane>
</Tabs>
```

---

## 4. 数据库设计

### 4.1 不修改现有表结构

**原因：**
- `KnowledgeFileChunk.content` 字段已存储原始文本
- 查询时实时分词，无需额外存储分词结果
- 适合中小规模知识库（10万条以内）

**表结构（现有）：**
```sql
CREATE TABLE knowledge_file_chunks (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    knowledge_id VARCHAR(36) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,  -- BM25直接使用此字段
    chunk_metadata JSON,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_knowledge_file (knowledge_id, file_path),
    INDEX idx_document_id (document_id)
);
```

### 4.2 大规模优化方案（可选）

如果知识库文档量超过10万条，可考虑添加分词缓存表：

```sql
CREATE TABLE knowledge_chunk_tokens (
    chunk_id VARCHAR(36) PRIMARY KEY,
    tokens JSON,  -- ["词1", "词2", ...]
    token_count INTEGER,
    created_at DATETIME,
    FOREIGN KEY (chunk_id) REFERENCES knowledge_file_chunks(id)
);
```

---

## 5. 性能优化

### 5.1 查询时优化

**当前方案（实时分词）：**
- 优点：无需维护索引，存储成本低
- 缺点：每次查询需要加载全部chunk并分词
- 适用场景：知识库<10万条，查询频率中等

**优化策略：**
```python
# 1. 使用LRU缓存已分词的corpus
from functools import lru_cache

@lru_cache(maxsize=100)
def get_tokenized_corpus(knowledge_id):
    # 缓存分词结果，有效期10分钟
    pass

# 2. 限制加载的chunk数量
chunks = KnowledgeFileChunk.query.filter_by(
    knowledge_id=knowledge_id
).limit(5000).all()  # 限制5000条
```

### 5.2 检索结果优化

**策略：**
1. **分页加载**：单次只返回top_k=20，前端滚动加载更多
2. **异步预加载**：用户输入时预先计算BM25索引
3. **缓存热点查询**：Redis缓存高频查询结果（5分钟）

### 5.3 大规模方案

**超过10万条文档：**
- 引入Elasticsearch存储全文索引
- Milvus负责向量检索
- ES负责关键字检索
- 应用层融合结果

---

## 6. 测试计划

### 6.1 单元测试

**文件：** `backend/tests/test_bm25_search.py`

**测试用例：**
```python
def test_bm25_search_chinese():
    # 测试中文分词和检索
    assert len(results) > 0
    assert results[0]['score'] > 0

def test_bm25_search_english():
    # 测试英文检索

def test_bm25_empty_query():
    # 测试空查询

def test_rrf_fusion():
    # 测试RRF融合算法
```

### 6.2 集成测试

**场景：**
1. **纯向量检索**：验证现有功能不受影响
2. **纯BM25检索**：验证关键字精确匹配
3. **混合检索**：验证RRF融合结果排序正确
4. **参数调优**：测试不同k1、b、rrf_k参数效果

### 6.3 性能测试

**指标：**
- 1000条文档：检索响应时间 < 500ms
- 10000条文档：检索响应时间 < 2s
- 并发10个查询：平均响应时间 < 3s

---

## 7. 实施步骤

### 阶段1：后端核心功能（2天）
- [ ] 安装依赖：`rank-bm25`, `jieba`
- [ ] 实现 `bm25_search_service.py`
- [ ] 实现 RRF融合算法
- [ ] 修改 `knowledge_query_service.py`
- [ ] 编写单元测试

### 阶段2：系统配置（0.5天）
- [ ] 添加系统设置种子数据
- [ ] 更新数据库初始化脚本
- [ ] 创建配置API接口（如无需新建）

### 阶段3：前端界面（1.5天）
- [ ] 创建 `KnowledgeSearchSettings.js` 组件
- [ ] 添加多语言翻译
- [ ] 集成到设置页面
- [ ] UI测试

### 阶段4：集成测试与优化（1天）
- [ ] 端到端测试
- [ ] 性能测试与调优
- [ ] 文档更新

---

## 8. 风险与应对

### 8.1 性能风险

**风险：** 大规模知识库（>10万条）实时分词性能差

**应对：**
1. 添加LRU缓存分词结果
2. 限制单次查询的chunk数量上限
3. 异步预加载索引
4. 长期方案：引入Elasticsearch

### 8.2 分词准确性

**风险：** jieba默认词典对专业术语分词不准确

**应对：**
1. 支持用户自定义词典
2. 添加领域词典配置（医疗、法律、金融等）
3. 提供分词结果预览功能

### 8.3 多语言支持

**风险：** BM25对英文、中英混合文本的处理

**应对：**
1. 检测语言类型，中文用jieba，英文用split
2. 使用 `jieba` 的搜索引擎模式（`jieba.cut_for_search`）
3. 支持配置不同语言的分词器

---

## 9. 后续优化方向

### 9.1 短期（1-2个月）
1. **动态权重调整**：根据查询类型自动调整向量/BM25权重
2. **查询日志分析**：统计检索效果，优化参数
3. **高级分词**：支持同义词扩展、词性标注

### 9.2 长期（3-6个月）
1. **引入Elasticsearch**：大规模文档全文检索
2. **学习排序（LTR）**：使用机器学习优化融合策略
3. **图检索**：结合知识图谱的路径检索
4. **多模态检索**：支持图片、表格的混合检索

---

## 10. 参考文献

1. **BM25算法**：Robertson, S. & Zaragoza, H. (2009). "The Probabilistic Relevance Framework: BM25 and Beyond"
2. **RRF融合**：Cormack, G. V., Clarke, C. L., & Buettcher, S. (2009). "Reciprocal rank fusion outperforms condorcet and individual rank learning methods"
3. **rank-bm25库**：https://github.com/dorianbrown/rank_bm25
4. **jieba中文分词**：https://github.com/fxsjy/jieba

---

## 附录

### A. 配置示例

**推荐配置（中文文档为主）：**
```json
{
  "knowledge_search_mode": "hybrid",
  "knowledge_search_bm25_k1": 1.5,
  "knowledge_search_bm25_b": 0.75,
  "knowledge_search_rrf_k": 60
}
```

**推荐配置（英文文档为主）：**
```json
{
  "knowledge_search_mode": "hybrid",
  "knowledge_search_bm25_k1": 1.2,
  "knowledge_search_bm25_b": 0.8,
  "knowledge_search_rrf_k": 60
}
```

### B. 调试命令

```bash
# 测试BM25检索
curl -X POST http://localhost:8080/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"knowledge_id": "xxx", "query": "苹果手机", "mode": "bm25"}'

# 测试混合检索
curl -X POST http://localhost:8080/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"knowledge_id": "xxx", "query": "苹果手机", "mode": "hybrid"}'
```

---

**文档版本：** v1.0  
**创建日期：** 2025-11-22  
**作者：** Droid  
**状态：** 待审核
