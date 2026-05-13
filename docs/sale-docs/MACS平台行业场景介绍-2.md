## 4. 金融投资顾问服务

### 传统方案的问题
个人投资者面临信息过载、专业知识不足和情绪干扰等多重挑战，高质量投资顾问服务门槛高、覆盖面窄，导致投资决策失误频繁，普通投资者难以有效管理财富。传统投顾服务人均覆盖有限，建议往往标准化；机器投顾仅基于问卷和简单模型，缺乏深度市场洞察和投资教育；单一AI顾问无法呈现市场不同观点和辩证分析。市场上的智能投顾平台如Betterment和Wealthfront虽然提供了自动化投资服务，但缺乏深度个性化分析和多角度市场观点的辩证比较。

### MACS场景化方案与价值
MACS平台构建全方位投资分析系统，集成股票分析、债券评估、宏观经济研判、税务规划等专业功能模块。基于实时市场数据和客户风险偏好画像，系统通过多维度分析框架评估不同市场观点，对各类资产配置策略进行全面对比。平台以交互式对话方式解释复杂金融概念，根据投资者具体目标生成个性化投资计划，并随市场条件变化发出策略调整警报。系统特别开发了"反向分析引擎"，主动挑战主流市场观点，识别潜在风险盲点，帮助投资者避免从众心理陷阱。平台与主流交易系统和资产管理工具集成，实现投资建议到执行的无缝衔接。

### 终端用户价值
投资者享受专业级投资顾问服务，理解决策背后的逻辑和风险，培养理性投资习惯；金融机构能够提升客户服务覆盖面和满意度，同时降低人力成本，提高理财顾问工作效率。

### 投资价值
财富管理市场规模庞大，客户数字化渗透率持续提升。MACS可与金融机构合作分成模式，或直接面向高净值客户订阅服务，通过市场预测准确度建立品牌信任，拓展多元金融产品分发渠道。

### 场景配置

#### 环境变量
- `investor_profile`: 投资者资料，包括风险偏好、投资目标、财务状况
- `market_data`: 市场数据，包括股票、债券、商品、外汇等市场行情
- `economic_indicators`: 宏观经济指标
- `news_feed`: 财经新闻和事件流
- `analysis_timeframe`: 分析时间框架
- `portfolio_holdings`: 当前投资组合持仓
- `tax_regulations`: 税务法规数据库
- `market_sentiment`: 市场情绪指标
- `historical_performance`: 历史表现数据
- `investment_constraints`: 投资限制条件

#### 角色
1. **股票分析师**：分析股票市场和个股表现
2. **债券专家**：评估固定收益投资机会
3. **宏观经济学家**：解读经济数据和政策影响
4. **资产配置策略师**：设计投资组合结构
5. **风险管理专家**：评估投资风险和对冲策略
6. **税务规划师**：优化投资税务效益
7. **市场心理学家**：分析市场情绪和行为偏差
8. **投资教育专家**：解释投资概念和决策依据

#### 角色变量
1. **股票分析师**
   - `analysis_methodology`: 分析方法论（基本面/技术面/量化）
   - `sector_expertise`: 行业专长
   - `valuation_bias`: 估值偏好

2. **债券专家**
   - `interest_rate_sensitivity`: 利率敏感度
   - `credit_risk_approach`: 信用风险评估方法
   - `duration_preference`: 久期偏好

3. **宏观经济学家**
   - `economic_school`: 经济学派
   - `indicators_focus`: 关注指标
   - `forecast_horizon`: 预测时间范围

4. **资产配置策略师**
   - `diversification_emphasis`: 多元化强调程度
   - `rebalancing_frequency`: 再平衡频率
   - `allocation_framework`: 配置框架方法论

5. **风险管理专家**
   - `risk_metrics`: 风险度量标准
   - `hedging_strategies`: 对冲策略库
   - `tail_risk_awareness`: 尾部风险敏感度

6. **税务规划师**
   - `tax_efficiency_metrics`: 税收效率指标
   - `tax_law_specialty`: 税法专长领域
   - `harvesting_aggressiveness`: 税务筹划积极程度

7. **市场心理学家**
   - `sentiment_indicators`: 情绪指标集
   - `bias_detection`: 偏见识别敏感度
   - `contrarian_tendency`: 逆向思维倾向

8. **投资教育专家**
   - `explanation_complexity`: 解释复杂度
   - `educational_approach`: 教育方法
   - `concept_visualization`: 概念可视化能力

#### 规则集

##### 自然语言规则
1. a投资建议必须明确说明潜在收益与风险
2. 金融术语必须配有通俗解释，确保投资者理解
3. 提供的分析必须区分事实、预测和意见
4. 当市场观点分歧时，必须呈现多方论据而非单一结论
5. 避免使用情绪化语言影响投资者判断
6. 必须解释资产配置建议背后的理论依据
7. 所有建议必须考虑投资者的时间范围和流动性需求
8. 策略调整建议必须说明触发调整的具体条件和理由

##### 逻辑规则
```javascript
// 规则1: 投资者风险承受能力低时，波动性高的资产配置比例不得超过20%
function rule1(investor, portfolioAllocation) {
  if (investor.riskTolerance === "low") {
    const volatileAssetPercentage = portfolioAllocation.getVolatileAssetsPercentage();
    if (volatileAssetPercentage > 20) {
      portfolioAllocation.adjustVolatileAssets(20);
    }
    return true;
  }
  return false;
}

// 规则2: 市场出现大幅波动时，必须提供短期应对策略和长期影响分析
function rule2(marketVolatility) {
  if (marketVolatility > 2.5) { // 标准差2.5倍以上为大幅波动
    provideShortTermCopingStrategy();
    analyzeLongTermImpact();
    return true;
  }
  return false;
}

// 规则3: 投资组合与目标偏离超过10%时，触发再平衡建议
function rule3(portfolio, targetAllocation) {
  if (calculateDeviation(portfolio, targetAllocation) > 10) {
    recommendRebalancing(portfolio);
    return true;
  }
  return false;
}

// 规则4: 投资者接近退休年龄时，逐步增加稳定收益资产比例
function rule4(investor, portfolioAllocation) {
  if (investor.yearsToRetirement < 5) {
    portfolioAllocation.incrementStableIncomeAssets(investor.yearsToRetirement);
    return true;
  }
  return false;
}

// 规则5: 市场情绪极端乐观时，市场心理学家必须提供风险警示
function rule5(marketSentiment, psychologist) {
  if (marketSentiment > 85) { // 超过85分为极端乐观
    psychologist.provideRiskWarning("extreme_optimism");
    return true;
  }
  return false;
}

// 规则6: 税法变更影响投资者时，税务规划师必须提供调整方案
function rule6(taxLawChanges, investor, taxPlanner) {
  if (isTaxChangeRelevant(taxLawChanges, investor)) {
    taxPlanner.provideAdjustmentPlan(investor, taxLawChanges);
    return true;
  }
  return false;
}

// 规则7: 投资者持有过于集中头寸时，资产配置策略师必须提出分散化建议
function rule7(portfolio, allocationStrategist) {
  if (calculateConcentration(portfolio) > 30) { // 单一资产超过30%视为过于集中
    allocationStrategist.recommendDiversification(portfolio);
    return true;
  }
  return false;
}

// 规则8: 某资产类别表现持续偏离历史趋势时，必须深入分析结构性变化可能性
function rule8(assetClass, performance, historicalTrend) {
  if (Math.abs(performance - historicalTrend) > historicalTrend * 0.3) {
    analyzeStructuralChanges(assetClass);
    return true;
  }
  return false;
}
```

## 5. 供应链风险预警与管理

### 传统方案的问题
全球供应链面临自然灾害、地缘政治、疫情等多重风险，企业缺乏有效工具预测与评估潜在中断风险，被动应对导致生产停滞、成本激增和市场份额损失。传统供应链分析系统专注历史数据而非预测性分析；咨询服务反应滞后且价格昂贵；单点AI解决方案缺乏跨领域风险关联分析，无法评估多层级供应商连锁反应。市场上的供应链管理软件虽然提供了基础的风险监控功能，但缺乏预测性分析和多维度风险关联能力。

### MACS场景化方案与价值
MACS平台开发供应链风险智能分析系统，整合物流监测、地区风险评估、气象灾害预警、市场需求预测等专业分析模块。系统通过持续监控供应链数据、全球新闻事件和市场异常信号，建立多维风险评估框架，识别潜在中断威胁。当检测到风险信号时，平台自动启动分层分析流程，评估影响范围，测算不同应对策略的效果，形成多级应急预案。系统核心优势在于其复杂关联分析能力，能够发现表面无关事件间的潜在连锁效应，提前30-90天预警"黑天鹅"事件。平台与企业ERP、SCM系统无缝对接，确保风险分析与实际运营数据紧密结合。


企业供应链管理者获得提前30-90天的风险预警，有充足时间采取预防措施；应急响应时间缩短60%，决策质量显著提升；供应链韧性增强，中断事件恢复速度和成本控制明显优于竞争对手。实际应用中，IBM的供应链智能控制塔和埃森哥特的供应链弹性解决方案已经证明了多维度风险分析对提前预警供应链中断的重要性，MACS进一步整合了跨领域数据和连锁反应分析能力。

### 投资价值
供应链软件市场规模超过150亿美元，风险管理细分领域增速最快。MACS可通过企业级订阅+风险事件预警增值服务的双层定价策略，并拓展供应链金融、保险等配套服务，构建完整产业链解决方案。

### 场景配置

#### 环境变量
- `supply_chain_data`: 供应链数据，包括供应商网络、物流路线、库存水平
- `global_events`: 全球事件数据库，包含地缘政治、自然灾害、疫情等信息
- `risk_profiles`: 风险模型和评分标准
- `company_resources`: 企业可用资源与应对能力信息
- `monitoring_thresholds`: 监控预警阈值设置
- `response_protocols`: 应急响应协议库
- `historical_disruptions`: 历史中断事件数据
- `weather_forecast`: 全球气象预测数据
- `commodity_markets`: 大宗商品市场数据
- `logistics_capacity`: 全球物流能力数据

#### 角色
1. **物流分析师**：监测与评估供应链物流环节风险
2. **地缘政治专家**：分析政治风险和区域不稳定性影响
3. **天气与自然灾害专家**：评估自然因素对供应链的影响
4. **市场趋势分析师**：预测需求波动和市场变化
5. **供应商风险评估师**：识别供应商相关风险
6. **应急响应规划师**：制定应对方案和计划
7. **供应链网络设计师**：提供网络优化和替代路线建议
8. **连锁反应模型专家**：分析风险的系统性扩散路径

#### 角色变量
1. **物流分析师**
   - `transportation_modes`: 关注的运输模式
   - `bottleneck_sensitivity`: 瓶颈识别灵敏度
   - `route_alternatives`: 替代路线库

2. **地缘政治专家**
   - `regions_focus`: 关注区域
   - `political_risk_framework`: 政治风险评估框架
   - `regulatory_awareness`: 法规变化敏感度

3. **天气与自然灾害专家**
   - `disaster_types`: 专注的灾害类型
   - `prediction_models`: 使用的预测模型
   - `impact_assessment`: 影响评估方法

4. **市场趋势分析师**
   - `demand_signals`: 需求信号指标
   - `market_volatility_metrics`: 市场波动度量
   - `consumer_behavior_models`: 消费者行为模型

5. **供应商风险评估师**
   - `supplier_categories`: 供应商分类框架
   - `financial_health_metrics`: 财务健康指标
   - `dependency_measurement`: 依赖度量量表

6. **应急响应规划师**
   - `response_categories`: 应对策略分类
   - `resource_allocation_models`: 资源分配模型
   - `time_sensitivity`: 时间敏感度框架

7. **供应链网络设计师**
   - `network_visualization`: 网络可视化方法
   - `optimization_algorithms`: 优化算法
   - `resilience_metrics`: 韧性衡量指标

8. **连锁反应模型专家**
   - `cascade_patterns`: 级联模式库
   - `node_importance_ranking`: 节点重要性排名
   - `simulation_complexity`: 模拟复杂度水平

#### 规则集

##### 自然语言规则
1. 风险评估必须基于多领域数据整合，不得仅依赖单一信息源
2. 预警必须包含风险概率、潜在影响程度和时间窗口
3. 所有应对建议必须考虑企业实际资源约束和实施能力
4. 风险情景描述必须明确区分已确认事实和预测推断
5. 连锁反应分析必须追踪至少三级间接影响
6. 高优先级警报必须附带具体应对选项和成本效益分析
7. 替代方案建议必须包含实施时间估计和资源需求
8. 系统必须定期回顾历史预警准确度，调整预测模型

##### 逻辑规则
```javascript
// 规则1: 某区域地缘政治风险上升时，相关供应商必须进行再评估
function rule1(region, geopoliticalRisk, suppliers) {
  if (geopoliticalRisk[region].hasIncreased()) {
    suppliers.filter(s => s.region === region).forEach(supplier => {
      reevaluateSupplier(supplier);
    });
    return true;
  }
  return false;
}

// 规则2: 预测到极端天气事件时，必须评估所有受影响物流路线
function rule2(weatherForecast, logisticsRoutes) {
  if (weatherForecast.hasExtremeEvent()) {
    const affectedRoutes = identifyAffectedRoutes(weatherForecast, logisticsRoutes);
    evaluateRoutes(affectedRoutes);
    return true;
  }
  return false;
}

// 规则3: 供应商财务状况恶化时，必须启动替代供应源识别
function rule3(supplier, financialHealth) {
  if (financialHealth.rating < financialHealth.previousRating) {
    identifyAlternativeSuppliers(supplier.category);
    return true;
  }
  return false;
}

// 规则4: 多个风险因素影响同一供应环节时，风险等级必须提升
function rule4(supplyChainNode, riskFactors) {
  if (riskFactors.filter(factor => factor.affectsNode(supplyChainNode)).length > 1) {
    escalateRiskLevel(supplyChainNode);
    return true;
  }
  return false;
}

// 规则5: 响应资源有限时，必须按照价值链重要性和恢复时间排序
function rule5(resources, valueChainNodes) {
  if (resources.isLimited()) {
    prioritizeByValueAndRecoveryTime(valueChainNodes, resources);
    return true;
  }
  return false;
}

// 规则6: 发现一级供应商依赖同一二级供应商时，必须识别为单点失效风险
function rule6(tier1Suppliers, tier2Suppliers) {
  const commonTier2 = findCommonTier2Suppliers(tier1Suppliers, tier2Suppliers);
  if (commonTier2.length > 0) {
    identifySinglePointFailureRisks(commonTier2);
    return true;
  }
  return false;
}

// 规则7: 关键原材料价格异常波动时，必须联动分析供应与需求层面因素
function rule7(material, priceData) {
  if (isPriceVolatilityAbnormal(material, priceData)) {
    analyzeSupplyDemandFactors(material);
    return true;
  }
  return false;
}

// 规则8: 相似历史事件曾导致严重中断时，提高当前风险等级和关注优先级
function rule8(currentEvent, historicalEvents) {
  const similarEvents = findSimilarEvents(currentEvent, historicalEvents);
  if (similarEvents.some(event => event.disruptionSeverity === 'high')) {
    elevateRiskLevel(currentEvent);
    increasePriority(currentEvent);
    return true;
  }
  return false;
}
```

## 6. 产品研发创新协作

### 传统方案的问题
新产品开发需整合设计、工程、市场、成本等多领域专业知识，传统研发流程部门间沟通障碍导致协作低效，创意被过滤，研发周期延长，产品上市后问题频发。项目管理工具注重流程而非创意碰撞；头脑风暴会议难以保证各方深度参与；单一AI助手无法整合不同专业视角的辩证思考和技术可行性评估。市场上的协作工具如JIRA和Asana虽然提供了任务管理功能，但缺乏深度的跨专业知识整合和创意评估能力。

### MACS场景化方案与价值
MACS平台打造产品研发协同工作空间，集成产品设计、工程分析、市场调研、成本控制等专业功能模块。系统采用三阶段研发方法：首先通过结构化创意征集框架收集多元创新点子，突破传统思维限制；随后运用多维评估工具从不同专业角度分析方案可行性、市场潜力和生产复杂性；最后通过优先级排序算法整合各方观点，形成兼顾创新性与可执行性的最终方案。平台集成用户需求分析引擎，提前评估产品与目标用户匹配度，识别潜在使用问题。系统与现有PLM和项目管理工具兼容，确保创新成果能直接转化为具体开发任务与时间表。

研发团队突破思维局限，产生更多创新解决方案，同时显著提高跨部门协作效率；产品经理获得全面的可行性分析和风险预警，研发周期缩短30%，产品成功率提升40%。实际应用中，如阿里云云效等一站式DevOps平台已经证明了研发协作工具对提升创新效率的重要性，MACS进一步整合了多专业视角的辩证分析和创意评估能力，帮助企业在产品研发过程中实现更高效的跨部门协作。

### 投资价值
产品生命周期管理市场规模超过400亿美元，创新管理工具需求旺盛。MACS可面向制造、消费品、科技等多个行业提供SaaS服务，通过API集成扩展生态系统，并积累行业创新知识库形成数据护城河。

### 场景配置

#### 环境变量
- `project_brief`: 项目简介和目标
- `market_research`: 市场调研数据
- `user_personas`: 用户画像集
- `technology_assets`: 可用技术资产库
- `design_constraints`: 设计约束条件
- `innovation_phase`: 创新阶段标记
- `competitive_landscape`: 竞争格局数据
- `resource_limitations`: 资源限制参数
- `timeline_constraints`: 时间限制设置
- `regulatory_requirements`: 法规要求数据库

#### 角色
1. **用户体验设计师**：关注产品用户体验和交互设计
2. **工程技术专家**：评估技术可行性和实现方案
3. **市场洞察分析师**：提供市场趋势和消费者需求分析
4. **生产制造顾问**：评估生产可行性和成本结构
5. **创新催化师**：促进创造性思维和跨界思考
6. **质量与可靠性专家**：评估产品质量和可靠性风险
7. **商业模式分析师**：评估产品商业价值和盈利能力
8. **项目整合协调员**：综合各方观点，推动决策形成

#### 角色变量
1. **用户体验设计师**
   - `design_philosophy`: 设计理念
   - `user_research_methods`: 用户研究方法
   - `aesthetic_preference`: 美学偏好

2. **工程技术专家**
   - `technical_domains`: 技术领域专长
   - `innovation_vs_reliability`: 创新与可靠性平衡倾向
   - `complexity_tolerance`: 复杂度容忍度

3. **市场洞察分析师**
   - `market_research_methods`: 市场研究方法
   - `trend_extrapolation`: 趋势外推能力
   - `competitive_analysis_framework`: 竞争分析框架

4. **生产制造顾问**
   - `manufacturing_expertise`: 制造专长领域
   - `cost_sensitivity`: 成本敏感度
   - `scalability_focus`: 可扩展性关注点

5. **创新催化师**
   - `ideation_techniques`: 创意生成技术
   - `cognitive_bias_awareness`: 认知偏见意识
   - `cross_domain_knowledge`: 跨领域知识面

6. **质量与可靠性专家**
   - `testing_methodologies`: 测试方法论
   - `risk_assessment_framework`: 风险评估框架
   - `quality_standards`: 质量标准体系

7. **商业模式分析师**
   - `revenue_models`: 收入模式库
   - `market_sizing_methods`: 市场规模估算方法
   - `profitability_metrics`: 盈利能力指标

8. **项目整合协调员**
   - `facilitation_methods`: 引导方法
   - `decision_frameworks`: 决策框架
   - `conflict_resolution_approach`: 冲突解决方法

#### 规则集

##### 自然语言规则
1. 创意讨论阶段禁止过早否定，必须鼓励多样化思考
2. 技术可行性评估必须以具体数据和实验证据为基础
3. 用户需求必须在整个设计过程中保持核心地位
4. 跨部门讨论必须使用所有相关者能理解的语言
5. 方案评估必须基于明确定义的成功标准和可量化指标
6. 批评必须针对方案本身而非提出者，保持客观性
7. 最终方案必须平衡创新性、可行性和商业价值
8. 必须记录决策过程和被否决选项的理由，以供未来参考

##### 逻辑规则
1. IF 提出的解决方案违反核心用户需求 THEN 必须重新评估或修改
2. IF 技术实现风险高 THEN 必须制定技术验证计划和备选方案
3. IF 市场趋势与设计方向矛盾 THEN 市场分析师必须提供深入分析
4. IF 生产成本超出目标范围 THEN 必须重新评估设计或寻找替代材料/工艺
5. IF 创新程度低于竞品 THEN 创新催化师必须组织额外创意会议
6. IF 质量测试发现潜在问题 THEN 必须在最终方案中添加风险缓解措施
7. IF 各方对优先级存在显著分歧 THEN 协调员必须组织优先级排序工作坊
8. IF 最终方案整合度低 THEN 必须进行额外的系统级兼容性分析

## 7. 城市规划多方利益协调

### 传统方案的问题
城市规划涉及政府、开发商、居民、环保组织等多方利益相关者，传统协商流程漫长复杂，公众参与度低，决策往往无法兼顾各方需求，导致规划实施阻力大、社会满意度低。传统公听会形式走过场，真正沟通不足；调研问卷难以反映动态偏好；规划软件聚焦物理空间而非社会影响；单一智能系统无法同时整合多方利益诉求并达成实质性共识。目前的城市信息平台(CIM)虽然在多个城市进行试点，解决了数据融合及可视化等问题，但在多方利益协调和公众参与方面仍有不足。

### MACS场景化方案与价值
MACS平台打造城市规划协商数字中心，集成专业规划分析引擎和多方利益表达系统。系统基于规划数据和社区反馈进行多维度分析，每个分析模块代表特定利益群体观点，通过结构化讨论评估各规划方案在环境、经济、社会等方面的综合影响。平台使用直观可视化工具展示不同方案的权衡取舍，明确量化各方关切点，引导利益相关者理解彼此诉求，寻找最佳平衡方案。系统能够基于历史城市案例库，预测规划决策的长期社会经济影响，提供更科学的评估依据。

政府规划部门获得更全面的利益相关方观点，提前识别潜在冲突点；居民在规划早期获得参与感和发言权；开发商了解多方诉求，调整方案提高获批效率，降低后期修改成本。实际应用中，国内多个城市已开始探索城市信息平台(CIM)建设，构建形成政产学研用多方联动的大数据产业生态体系，MACS进一步提供了多方利益协调和共识形成的能力，帮助城市规划决策更好地平衡各方需求。

### 投资价值
智慧城市市场规模超过千亿美元，公共参与平台是重要组成部分。MACS可向政府部门、规划机构和大型开发商提供许可服务，同时通过数据积累形成城市规划知识库，扩展至智慧城市管理多个领域。

### 场景配置

#### 环境变量
- `urban_plan_data`: 城市规划方案数据
- `stakeholder_map`: 利益相关者映射
- `demographic_data`: 人口统计数据
- `environmental_factors`: 环境影响因素数据
- `economic_projections`: 经济预测数据
- `property_values`: 房产价值数据
- `transportation_analysis`: 交通流量和模式分析
- `historical_development`: 历史发展案例库
- `zoning_regulations`: 区划法规和政策
- `community_feedback`: 社区反馈收集数据

#### 角色
1. **城市规划专家**：提供专业规划知识和设计理念
2. **社区代表**：表达居民需求和关切
3. **环境评估师**：分析环境影响和可持续性
4. **经济发展顾问**：评估经济和就业影响
5. **交通系统专家**：分析交通流量和可达性
6. **基础设施工程师**：评估公共设施和基础设施需求
7. **房地产开发专家**：分析开发可行性和投资回报
8. **协商调解员**：促进多方对话和共识形成

#### 角色变量
1. **城市规划专家**
   - `planning_philosophy`: 规划理念
   - `design_priorities`: 设计优先事项
   - `spatial_modeling_tools`: 空间模型工具

2. **社区代表**
   - `community_segments`: 代表的社区群体
   - `key_concerns`: 核心关切事项
   - `participation_methods`: 参与方式偏好

3. **环境评估师**
   - `environmental_metrics`: 环境评估指标
   - `conservation_priorities`: 保护优先事项
   - `sustainability_framework`: 可持续发展框架

4. **经济发展顾问**
   - `economic_models`: 经济模型工具
   - `job_creation_focus`: 就业创造关注点
   - `tax_base_analysis`: 税收基础分析方法

5. **交通系统专家**
   - `mobility_priorities`: 交通流动性优先事项
   - `transit_modeling`: 公共交通建模方法
   - `future_technology_awareness`: 未来技术意识

6. **基础设施工程师**
   - `infrastructure_assessment`: 基础设施评估方法
   - `capacity_planning`: 容量规划模型
   - `maintenance_cost_projection`: 维护成本预测

7. **房地产开发专家**
   - `market_analysis_methods`: 市场分析方法
   - `feasibility_metrics`: 可行性衡量指标
   - `investor_perspective`: 投资者视角代表

8. **协商调解员**
   - `facilitation_framework`: 引导框架
   - `consensus_building_methods`: 共识构建方法
   - `visualization_tools`: 可视化工具使用

#### 规则集

##### 自然语言规则
1. 所有讨论必须平等关注短期收益和长期可持续性
2. 各方发言必须基于具体数据和案例，而非仅有情感表达
3. 在讨论不同方案时，必须明确量化影响指标而非笼统评价
4. 各利益相关方必须先表达关切，再进入解决方案讨论
5. 反对意见必须包含具体改进建议，而非单纯否定
6. 讨论必须尊重和考虑历史文化遗产和社区特色
7. 技术术语必须提供通俗解释，确保所有参与者理解
8. 最终方案必须明确说明对各方关切的回应措施

##### 逻辑规则
1. IF 环境影响评估为负面 THEN 必须提出明确的缓解措施
2. IF 社区反对声音强烈 THEN 协商调解员必须组织专题沟通会议
3. IF 方案经济可行性低 THEN 必须重新评估规模或分期开发
4. IF 基础设施承载能力不足 THEN 必须将基础设施升级纳入规划
5. IF 多方利益冲突严重 THEN 必须提供2-3个备选方案进行选择
6. IF 规划方案与现有社区特性差异大 THEN 必须进行渐进式过渡设计
7. IF 历史数据显示类似项目存在问题 THEN 必须特别说明改进措施
8. IF 交通流量预测超过阈值 THEN 必须重新评估密度或增加公共交通设施
