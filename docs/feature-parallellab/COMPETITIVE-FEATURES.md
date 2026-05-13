# 竞品核心功能实现方案

> 分析 Stanford Generative Agents、AgentTorch 等竞品的核心能力，以及如何在现有架构上实现

---

## 一、Stanford Generative Agents 核心架构

### 1.1 三层认知架构

```
┌─────────────────────────────────────────────────────────┐
│                     Agent Architecture                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│  │   Memory    │   │ Reflection  │   │  Planning   │   │
│  │   Stream    │ → │   (反思)    │ → │   (规划)    │   │
│  │  (记忆流)   │   │             │   │             │   │
│  └─────────────┘   └─────────────┘   └─────────────┘   │
│        ↓                 ↓                 ↓            │
│  记录所有观察      从记忆中提取      生成行动计划        │
│  带时间戳+重要性    高层洞察          多时间尺度          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Memory Stream (记忆流)

**原理**：
- 记录 agent 的所有观察（observations）
- 每条记忆有：内容、时间戳、重要性分数
- 检索时综合考虑：时效性 × 重要性 × 相关性

**现有能力**：已有 `memory` capability 使用 Graphiti 知识图谱

**需要增强**：

```python
# 新增：MemoryStream 模型
class MemoryStream(BaseMixin, db.Model):
    """Agent 记忆流"""
    __tablename__ = 'memory_streams'
    
    agent_id = Column(String(36), ForeignKey('agents.id'))
    conversation_id = Column(String(36), ForeignKey('conversations.id'))
    
    content = Column(Text, nullable=False)           # 记忆内容
    memory_type = Column(String(50))                 # observation/reflection/plan
    importance = Column(Float, default=5.0)          # 重要性评分 1-10
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 检索辅助
    embedding = Column(Vector(1536))                 # 向量嵌入
    
    # 访问追踪
    last_accessed = Column(DateTime)
    access_count = Column(Integer, default=0)
```

**检索算法**：
```python
def retrieve_memories(agent_id, query, k=10):
    """综合检索最相关的记忆"""
    memories = MemoryStream.query.filter_by(agent_id=agent_id).all()
    
    scores = []
    for m in memories:
        # 时效性衰减 (指数衰减)
        hours_ago = (datetime.now() - m.created_at).total_seconds() / 3600
        recency = 0.99 ** hours_ago
        
        # 重要性 (归一化)
        importance = m.importance / 10.0
        
        # 相关性 (向量相似度)
        relevance = cosine_similarity(query_embedding, m.embedding)
        
        # 综合分数
        score = recency * importance * relevance
        scores.append((m, score))
    
    return sorted(scores, key=lambda x: -x[1])[:k]
```

### 1.3 Reflection (反思机制)

**原理**：
- 当记忆累积到一定数量时触发反思
- 从多条具体记忆中提取高层洞察
- 反思结果作为新记忆存入（高重要性）

**实现**：

```python
class ReflectionService:
    """反思服务"""
    
    REFLECTION_THRESHOLD = 100  # 每100条记忆触发一次反思
    
    def check_and_reflect(self, agent_id: str):
        """检查是否需要反思"""
        recent_count = MemoryStream.query.filter(
            MemoryStream.agent_id == agent_id,
            MemoryStream.memory_type == 'observation',
            MemoryStream.created_at > self.last_reflection_time(agent_id)
        ).count()
        
        if recent_count >= self.REFLECTION_THRESHOLD:
            self.generate_reflection(agent_id)
    
    def generate_reflection(self, agent_id: str):
        """生成反思"""
        # 1. 检索最近记忆中高重要性的
        recent_memories = self.get_recent_important_memories(agent_id, limit=100)
        
        # 2. 让 LLM 提取洞察
        prompt = f"""基于以下记忆，提取3-5个高层洞察：

{self.format_memories(recent_memories)}

请提取关于以下方面的洞察：
1. 我的核心目标是什么？
2. 我与他人的关系如何？
3. 我最近学到了什么？
4. 我需要改变什么行为？
"""
        reflections = llm.generate(prompt)
        
        # 3. 将反思存入记忆流（高重要性）
        for reflection in reflections:
            MemoryStream.create(
                agent_id=agent_id,
                content=reflection,
                memory_type='reflection',
                importance=9.0  # 反思具有高重要性
            )
```

### 1.4 Planning (多时间尺度规划)

**原理**：
- 日计划：每天开始时生成一天的大致安排
- 小时计划：将日计划细化为具体时段
- 反应式调整：遇到意外时实时调整计划

**实现**：

```python
class PlanningService:
    """多时间尺度规划服务"""
    
    def generate_daily_plan(self, agent_id: str, date: date):
        """生成日计划"""
        # 获取 agent 的角色设定
        agent = Agent.query.get(agent_id)
        
        # 检索相关记忆
        memories = retrieve_memories(agent_id, f"我的日常活动和目标")
        
        prompt = f"""你是 {agent.name}，{agent.description}

基于你的记忆：
{format_memories(memories)}

请生成今天的计划（从早到晚）：
"""
        daily_plan = llm.generate(prompt)
        
        # 存储计划
        return AgentPlan.create(
            agent_id=agent_id,
            plan_type='daily',
            date=date,
            content=daily_plan
        )
    
    def decompose_to_hourly(self, daily_plan_id: str, hour: int):
        """将日计划分解为小时级任务"""
        daily_plan = AgentPlan.query.get(daily_plan_id)
        
        prompt = f"""日计划：
{daily_plan.content}

现在是 {hour}:00，请详细描述这个小时要做什么（具体行动和目标）：
"""
        hourly_plan = llm.generate(prompt)
        return hourly_plan
```

---

## 二、AgentTorch LLM Archetypes (大规模支持)

### 2.1 核心思想

**问题**：模拟 100万 agents，每个都调用 LLM = 破产

**解决**：
- 将相似 agents 分组为 "Archetype"
- 同一 archetype 共享 LLM 调用结果
- 根据人口统计特征聚类

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Population                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   840万 agents → 分组 → 50-100 个 Archetypes            │
│                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │Archetype1│  │Archetype2│  │Archetype3│  ...        │
│   │年轻白领  │  │退休老人  │  │学生群体  │             │
│   │25-35岁   │  │60+岁     │  │18-22岁   │             │
│   │高收入    │  │固定收入  │  │低收入    │             │
│   │12万agents│  │8万agents │  │15万agents│             │
│   └──────────┘  └──────────┘  └──────────┘             │
│        ↓              ↓              ↓                  │
│   1次LLM调用     1次LLM调用     1次LLM调用              │
│   结果复用给     结果复用给     结果复用给              │
│   12万agents     8万agents      15万agents             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 实现方案

```python
# 数据模型
class AgentArchetype(BaseMixin, db.Model):
    """Agent 原型"""
    __tablename__ = 'agent_archetypes'
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # 人口统计特征
    demographics = Column(JSON)  # {"age_range": [25,35], "income": "high", ...}
    
    # 行为模式
    behavior_template = Column(Text)  # LLM prompt 模板
    
    # 决策缓存
    decision_cache = Column(JSON)  # 缓存最近的决策结果
    cache_valid_until = Column(DateTime)

class AgentArchetypeMapping(BaseMixin, db.Model):
    """Agent 到 Archetype 的映射"""
    __tablename__ = 'agent_archetype_mappings'
    
    agent_id = Column(String(36), ForeignKey('agents.id'))
    archetype_id = Column(String(36), ForeignKey('agent_archetypes.id'))
    similarity_score = Column(Float)  # 相似度


class ArchetypeService:
    """Archetype 服务"""
    
    def cluster_agents(self, agents: List[Agent], n_clusters: int = 50):
        """将 agents 聚类为 archetypes"""
        # 提取特征向量
        features = []
        for agent in agents:
            feature = self.extract_features(agent)
            features.append(feature)
        
        # K-Means 聚类
        kmeans = KMeans(n_clusters=n_clusters)
        labels = kmeans.fit_predict(features)
        
        # 创建 archetypes
        for i in range(n_clusters):
            cluster_agents = [a for a, l in zip(agents, labels) if l == i]
            archetype = self.create_archetype_from_cluster(cluster_agents)
            
            # 建立映射
            for agent in cluster_agents:
                AgentArchetypeMapping.create(
                    agent_id=agent.id,
                    archetype_id=archetype.id
                )
    
    def batch_decision(self, archetype_id: str, context: dict) -> str:
        """为 archetype 生成决策（所有成员共享）"""
        archetype = AgentArchetype.query.get(archetype_id)
        
        # 检查缓存
        if archetype.cache_valid_until and archetype.cache_valid_until > datetime.now():
            cache_key = hash(str(context))
            if cache_key in archetype.decision_cache:
                return archetype.decision_cache[cache_key]
        
        # 生成决策
        prompt = archetype.behavior_template.format(**context)
        decision = llm.generate(prompt)
        
        # 缓存
        archetype.decision_cache[hash(str(context))] = decision
        archetype.cache_valid_until = datetime.now() + timedelta(hours=1)
        db.session.commit()
        
        return decision
```

### 2.3 成本对比

| 方案 | 100万 agents | LLM 调用次数 | 成本 |
|------|-------------|-------------|------|
| 朴素方法 | 每个单独调用 | 100万次 | $150,000 |
| Archetype | 50个原型 | 50次 | $7.5 |

---

## 三、社交关系模拟

### 3.1 关系网络模型

```python
class AgentRelationship(BaseMixin, db.Model):
    """Agent 间关系"""
    __tablename__ = 'agent_relationships'
    
    agent_a_id = Column(String(36), ForeignKey('agents.id'))
    agent_b_id = Column(String(36), ForeignKey('agents.id'))
    
    # 关系类型
    relationship_type = Column(String(50))  # friend/colleague/family/stranger
    
    # 关系强度 (0-1)
    strength = Column(Float, default=0.5)
    
    # 关系属性
    attributes = Column(JSON)  # {"trust": 0.8, "frequency": "daily"}
    
    # 最近互动
    last_interaction = Column(DateTime)
    interaction_count = Column(Integer, default=0)


class SocialNetworkService:
    """社交网络服务"""
    
    def update_relationship(self, agent_a: str, agent_b: str, interaction_type: str):
        """根据互动更新关系"""
        rel = AgentRelationship.query.filter_by(
            agent_a_id=agent_a, agent_b_id=agent_b
        ).first()
        
        if not rel:
            rel = AgentRelationship.create(
                agent_a_id=agent_a,
                agent_b_id=agent_b,
                relationship_type='acquaintance',
                strength=0.1
            )
        
        # 更新关系强度
        if interaction_type == 'positive':
            rel.strength = min(1.0, rel.strength + 0.1)
        elif interaction_type == 'negative':
            rel.strength = max(0.0, rel.strength - 0.15)
        
        rel.last_interaction = datetime.now()
        rel.interaction_count += 1
        db.session.commit()
    
    def get_social_context(self, agent_id: str) -> str:
        """获取 agent 的社交上下文"""
        relationships = AgentRelationship.query.filter(
            (AgentRelationship.agent_a_id == agent_id) |
            (AgentRelationship.agent_b_id == agent_id)
        ).order_by(AgentRelationship.strength.desc()).limit(10).all()
        
        context = "你的社交关系：\n"
        for rel in relationships:
            other_id = rel.agent_b_id if rel.agent_a_id == agent_id else rel.agent_a_id
            other_agent = Agent.query.get(other_id)
            context += f"- {other_agent.name}: {rel.relationship_type}, 亲密度 {rel.strength:.1f}\n"
        
        return context
```

### 3.2 涌现行为检测

```python
class EmergentBehaviorDetector:
    """涌现行为检测器"""
    
    def detect_group_formation(self, conversation_id: str):
        """检测群体形成"""
        # 分析消息模式
        messages = Message.query.filter_by(conversation_id=conversation_id).all()
        
        # 构建互动图
        interaction_graph = defaultdict(lambda: defaultdict(int))
        for m in messages:
            if m.mentions:  # 假设有 @mention 功能
                for mentioned in m.mentions:
                    interaction_graph[m.agent_id][mentioned] += 1
        
        # 社区检测 (Louvain 算法)
        G = nx.Graph()
        for a, targets in interaction_graph.items():
            for b, weight in targets.items():
                G.add_edge(a, b, weight=weight)
        
        communities = community.louvain_communities(G)
        return communities
    
    def detect_information_cascade(self, variable_name: str, threshold: float = 0.7):
        """检测信息级联（如谣言传播）"""
        # 追踪变量在不同 agent 间的变化
        history = VariableHistory.query.filter_by(name=variable_name).order_by('created_at').all()
        
        # 检测传播模式
        spread_pattern = []
        for h in history:
            spread_pattern.append({
                'agent': h.agent_id,
                'value': h.value,
                'time': h.created_at
            })
        
        # 分析是否形成级联
        # ...
```

---

## 四、与 ParallelLab 的结合

### 4.1 集成方案

```
┌─────────────────────────────────────────────────────────┐
│                    ParallelLab                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   参数扫描                                              │
│      ↓                                                  │
│   ┌─────────────────────────────────────────────────┐  │
│   │ memory_depth: [5, 10, 20]                       │  │
│   │ reflection_threshold: [50, 100, 200]            │  │
│   │ archetype_count: [10, 50, 100]                  │  │
│   │ relationship_decay: [0.01, 0.05, 0.1]           │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
│   目标优化                                              │
│      ↓                                                  │
│   maximize: social_cohesion                            │
│   maximize: information_accuracy                        │
│   minimize: echo_chamber_formation                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 新增可扫描参数

| 参数 | 描述 | 适用场景 |
|------|------|----------|
| `memory_depth` | 记忆检索数量 | 调优 agent 上下文长度 |
| `reflection_threshold` | 触发反思的记忆数 | 平衡深度思考 vs 响应速度 |
| `importance_decay` | 记忆重要性衰减率 | 调整遗忘曲线 |
| `archetype_count` | Archetype 数量 | 平衡精度 vs 成本 |
| `relationship_update_rate` | 关系更新频率 | 社交动态敏感度 |

### 4.3 新增目标变量

| 变量 | 描述 | 测量方法 |
|------|------|----------|
| `social_cohesion` | 社会凝聚力 | 关系网络密度 |
| `information_entropy` | 信息多样性 | 观点分布熵 |
| `polarization_index` | 极化程度 | 观点聚类分离度 |
| `emergence_count` | 涌现行为数 | 检测到的新模式数量 |

---

## 五、实现优先级

| 优先级 | 功能 | 工作量 | 价值 |
|--------|------|--------|------|
| P0 | Memory Stream 基础 | 2天 | 高 - Stanford 核心 |
| P0 | 反思机制 | 1天 | 高 - 让 agent 更智能 |
| P1 | 多时间尺度规划 | 1天 | 中 - 增强自主性 |
| P1 | 社交关系网络 | 2天 | 高 - 社会模拟核心 |
| P2 | LLM Archetypes | 3天 | 高 - 大规模必需 |
| P2 | 涌现行为检测 | 2天 | 中 - 研究价值高 |
| P3 | 关系动态演化 | 2天 | 中 - 长期模拟 |

---

## 六、与现有能力对接

### 现有 Capabilities 扩展

```json
{
    "name": "memory_stream",
    "description": "增强的记忆流能力，支持时间衰减、重要性评分和反思生成",
    "type": "core",
    "extends": "memory",
    "parameters": {
        "retrieval_count": {"type": "integer", "default": 10},
        "recency_weight": {"type": "number", "default": 0.5},
        "importance_weight": {"type": "number", "default": 0.3},
        "relevance_weight": {"type": "number", "default": 0.2}
    }
}

{
    "name": "social_awareness",
    "description": "社交感知能力，让 agent 意识到与其他 agent 的关系",
    "type": "advanced",
    "parameters": {
        "relationship_depth": {"type": "integer", "default": 10},
        "include_history": {"type": "boolean", "default": true}
    }
}
```

---

## 七、参考实现

- [Stanford Generative Agents Code](https://github.com/joonspk-research/generative_agents)
- [AgentTorch Framework](https://github.com/AgentTorch/AgentTorch)
- [Mem^p: Procedural Memory](https://arxiv.org/abs/2508.06433)
