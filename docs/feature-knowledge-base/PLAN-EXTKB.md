# 外部知识库集成功能 PRD

## 1. 产品概述

### 1.1 功能定位
外部知识库集成功能旨在为ABM-LLM系统提供连接和使用第三方知识库的能力，使智能体能够访问外部知识源，提升回答质量和专业性。

### 1.2 核心价值
- **知识扩展**：突破本地知识库限制，接入丰富的外部知识源
- **实时更新**：保持知识的时效性和准确性
- **专业领域**：接入专业知识库，提升特定领域的回答能力
- **成本优化**：避免重复建设，复用现有知识资产

## 2. 功能架构

### 2.1 整体架构
```
前端界面层
├── 内部知识库管理 (待实现)
└── 外部知识库管理
    ├── 提供商管理
    ├── 知识库配置
    └── 使用统计

后端服务层
├── 知识库提供商服务
├── 外部知识库API适配器
├── 知识库查询服务
└── 能力集成服务

数据存储层
├── 提供商配置表
├── 外部知识库配置表
└── 查询日志表
```

### 2.2 支持的提供商
- **Dify**：提供父子块知识库功能，支持结构化知识管理
- **RagFlow**：提供知识图谱功能，支持复杂知识关系查询
- **FastGPT**：提供多模态识别分析功能，处理图像、文本等多种模态数据
- **自定义API**：支持标准REST API接口的知识库系统

## 3. 详细功能设计

### 3.1 提供商管理

#### 3.1.1 提供商添加
**功能描述**：用户可以添加外部知识库提供商的连接信息

**输入参数**：
- 提供商名称（必填）
- 提供商类型（Dify/RagFlow/FastGPT/自定义）
- Base URL（必填）
- API Key（必填）
- 其他认证信息（可选，如Team ID等）

**验证规则**：
- URL格式验证
- API Key有效性验证
- 连接测试

#### 3.1.2 提供商管理
**功能描述**：管理已添加的提供商信息

**操作功能**：
- 查看提供商列表
- 编辑提供商信息
- 测试连接状态
- 删除提供商（需确认无关联知识库）

### 3.2 外部知识库配置

#### 3.2.1 知识库添加
**功能描述**：在已配置的提供商下添加具体的知识库

**输入参数**：
- 知识库名称（必填）
- 知识库描述（可选）
- 选择提供商（必填）
- 知识库ID（必填，提供商系统中的知识库标识）
- 额外参数（可选，JSON格式，如检索数量、相似度阈值等查询参数）

#### 3.2.2 知识库管理
**功能描述**：管理已配置的外部知识库

**操作功能**：
- 查看知识库列表
- 编辑知识库配置
- 测试知识库查询
- 启用/禁用知识库
- 删除知识库

### 3.3 能力集成

#### 3.3.1 知识库查询能力
**能力名称**：`external_knowledge_query`

**能力描述**：允许智能体查询外部知识库获取相关信息

**参数配置**：
```json
{
  "knowledge_base_ids": ["kb_001", "kb_002"],
  "query_strategy": "parallel|sequential",
  "max_results": 5,
  "similarity_threshold": 0.7,
  "timeout": 10
}
```

**响应格式**：
```json
{
  "results": [
    {
      "knowledge_base_id": "kb_001",
      "content": "查询到的知识内容",
      "score": 0.85,
      "source": "文档来源",
      "metadata": {}
    }
  ],
  "total_count": 3,
  "query_time": 1.2
}
```

#### 3.3.2 能力配置到角色
**功能描述**：将外部知识库查询能力配置到特定角色

**配置方式**：
1. 在角色编辑界面选择"外部知识库查询"能力
2. 配置该角色可访问的知识库列表
3. 设置查询参数和策略

## 4. 数据库设计

### 4.1 外部知识库提供商表 (external_kb_providers)
```sql
CREATE TABLE external_kb_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- dify, ragflow, fastgpt, custom
    base_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    config JSON, -- 其他配置信息
    status VARCHAR(20) DEFAULT 'active', -- active, inactive
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 外部知识库表 (external_knowledges)
```sql
CREATE TABLE external_knowledges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    provider_id INTEGER NOT NULL,
    external_kb_id VARCHAR(100) NOT NULL, -- 外部系统中的知识库ID
    query_config JSON, -- 查询配置
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES external_kb_providers(id)
);
```

### 4.3 角色外部知识库关联表 (role_external_knowledges)
```sql
CREATE TABLE role_external_knowledges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    external_knowledge_id INTEGER NOT NULL,
    config JSON, -- 角色特定的查询配置
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (external_knowledge_id) REFERENCES external_knowledges(id),
    UNIQUE(role_id, external_knowledge_id)
);
```

### 4.4 外部知识库查询日志表 (external_kb_query_logs)
```sql
CREATE TABLE external_kb_query_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_knowledge_id INTEGER NOT NULL,
    role_id INTEGER,
    query_text TEXT NOT NULL,
    response_data JSON,
    query_time REAL, -- 查询耗时(秒)
    status VARCHAR(20), -- success, error, timeout
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (external_knowledge_id) REFERENCES external_knowledges(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

## 5. API接口设计

### 5.1 提供商管理接口

#### 5.1.1 获取提供商列表
- **路径**: `GET /api/external-kb/providers`
- **响应**: 提供商列表

#### 5.1.2 创建提供商
- **路径**: `POST /api/external-kb/providers`
- **请求体**: 提供商信息
- **响应**: 创建的提供商

#### 5.1.3 测试提供商连接
- **路径**: `POST /api/external-kb/providers/{id}/test`
- **响应**: 连接测试结果

### 5.2 外部知识库管理接口

#### 5.2.1 获取外部知识库列表
- **路径**: `GET /api/external-kb/knowledges`
- **响应**: 外部知识库列表

#### 5.2.2 创建外部知识库
- **路径**: `POST /api/external-kb/knowledges`
- **请求体**: 知识库信息
- **响应**: 创建的知识库

#### 5.2.3 查询外部知识库
- **路径**: `POST /api/external-kb/knowledges/{id}/query`
- **请求体**: 查询参数
- **响应**: 查询结果

### 5.3 角色知识库关联接口

#### 5.3.1 为角色绑定外部知识库
- **路径**: `POST /api/roles/{roleId}/external-knowledges/{knowledgeId}`
- **响应**: 绑定关系

#### 5.3.2 获取角色的外部知识库
- **路径**: `GET /api/roles/{roleId}/external-knowledges`
- **响应**: 外部知识库列表

## 6. 前端界面设计

### 6.1 菜单结构
```
知识库管理
├── 内部知识库 (待实现)
└── 外部知识库
    ├── 提供商管理
    ├── 知识库列表
    ├── 角色关联管理
    └── 使用统计
```

### 6.2 页面组件
- **ExternalProviders.js**: 提供商管理页面
- **ExternalKnowledges.js**: 外部知识库管理页面
- **RoleKnowledgeBinding.js**: 角色知识库关联管理页面
- **ExternalKnowledgeStats.js**: 使用统计页面

### 6.3 角色关联管理界面设计

#### 6.3.1 功能描述
**页面名称**：角色知识库关联管理
**功能目标**：管理角色与外部知识库的绑定关系，配置角色的知识库访问权限

#### 6.3.2 界面布局
**左侧面板**：角色列表
- 显示所有可用角色
- 支持搜索和筛选
- 显示每个角色已绑定的知识库数量

**右侧面板**：知识库绑定管理
- 显示选中角色的已绑定知识库列表
- 提供添加/移除知识库绑定功能
- 配置每个知识库的查询参数

#### 6.3.3 主要功能
1. **查看角色绑定**
   - 选择角色后显示其已绑定的外部知识库
   - 显示绑定时间、查询配置等信息

2. **添加知识库绑定**
   - 弹窗选择可用的外部知识库
   - 配置该角色对知识库的查询参数
   - 设置优先级和权重

3. **编辑绑定配置**
   - 修改查询参数（如检索数量、相似度阈值）
   - 调整知识库优先级
   - 启用/禁用特定绑定

4. **批量操作**
   - 批量为多个角色绑定同一知识库
   - 批量修改绑定配置
   - 批量解除绑定

#### 6.3.4 界面交互流程
1. **选择角色** → 显示该角色的知识库绑定列表
2. **点击"添加绑定"** → 弹出知识库选择对话框
3. **选择知识库** → 配置查询参数 → 确认绑定
4. **编辑绑定** → 修改配置 → 保存更改
5. **解除绑定** → 确认操作 → 更新列表

## 7. 实现计划

### 7.1 第一阶段：基础架构
- [x] 数据库表结构设计和创建
- [x] 后端API接口开发
- [x] 前端基础页面框架
- [x] 角色关联管理界面开发

### 7.2 第二阶段：提供商集成
- [ ] Dify API适配器开发
- [x] RagFlow API适配器开发
- [ ] FastGPT API适配器开发
- [ ] 自定义API适配器开发

### 7.3 第三阶段：能力集成
- [ ] 外部知识库查询能力开发
- [ ] 能力配置到seed_data
- [ ] 角色能力绑定功能
- [ ] 角色知识库关联管理功能

### 7.4 第四阶段：优化完善
- [ ] 查询性能优化
- [ ] 错误处理和重试机制
- [ ] 使用统计和监控
- [ ] 角色绑定关系的批量管理
- [ ] 文档和测试完善

## 8. 文档处理技术细节

### 8.1 文档分段处理 (Document Chunking)

#### 8.1.1 分段策略
**固定长度分段**：
- 按字符数分段（如1000字符/段）
- 按Token数分段（如512 tokens/段）
- 支持重叠设置（如100字符重叠）

**语义分段**：
- 按段落自然分割
- 按句子边界分割
- 基于语义相似度的智能分段

**混合分段**：
- 优先按语义分段
- 超长段落按固定长度切分
- 保持上下文连贯性

#### 8.1.2 分段配置参数
```json
{
  "chunking_strategy": "semantic|fixed|hybrid",
  "chunk_size": 1000,
  "chunk_overlap": 100,
  "max_chunk_size": 2000,
  "min_chunk_size": 100,
  "preserve_structure": true,
  "separator_priority": ["\n\n", "\n", "。", ".", " "]
}
```

#### 8.1.3 分段元数据
每个分段包含以下元数据：
- 原文档ID和名称
- 分段在原文档中的位置
- 分段序号和总数
- 分段类型（标题、正文、表格等）
- 创建时间和版本信息

### 8.2 文本预处理

#### 8.2.1 文档格式处理
**支持格式**：
- PDF文档（文本提取、OCR识别）
- Word文档（.doc, .docx）
- HTML/网页内容
- Markdown文档
- 纯文本文件
- Excel表格（结构化数据提取）

**处理流程**：
1. 格式识别和验证
2. 内容提取和转换
3. 结构信息保留
4. 元数据提取

#### 8.2.2 文本清洗
**清洗规则**：
- 移除多余空白字符
- 统一换行符格式
- 处理特殊字符和符号
- 修正编码问题
- 过滤无意义内容

#### 8.2.3 内容增强
**结构化信息提取**：
- 标题层级识别
- 列表和表格结构
- 图片和图表描述
- 链接和引用信息

### 8.3 向量化处理

#### 8.3.1 嵌入模型配置
**支持的嵌入模型**：
- OpenAI text-embedding-3-small/large
- 本地部署的开源模型
- 多语言嵌入模型
- 领域特定嵌入模型

**模型配置参数**：
```json
{
  "embedding_model": "text-embedding-3-small",
  "embedding_dimension": 1536,
  "batch_size": 100,
  "max_tokens_per_request": 8000,
  "normalize_embeddings": true
}
```

#### 8.3.2 向量生成策略
**批量处理**：
- 分批生成向量避免API限制
- 失败重试机制
- 进度跟踪和恢复

**质量控制**：
- 向量维度验证
- 异常向量检测
- 相似度分布分析

### 8.4 检索优化

#### 8.4.1 检索策略
**语义检索**：
- 基于向量相似度的检索
- 支持多种相似度计算方法（余弦、点积、欧氏距离）
- 动态相似度阈值调整

**混合检索**：
- 关键词检索 + 语义检索
- 结果融合和重排序
- 权重配置和调优

**上下文感知检索**：
- 考虑查询历史
- 用户偏好学习
- 领域知识增强

#### 8.4.2 结果处理
**去重机制**：
- 基于内容相似度去重
- 基于来源文档去重
- 智能合并相似结果

**重排序算法**：
- 基于相关性得分
- 考虑文档权威性
- 时效性权重调整

## 9. 技术考虑

### 9.1 性能优化
- 查询结果缓存机制
- 并发查询控制
- 超时处理机制
- 向量索引优化
- 分段预处理缓存

### 9.2 安全考虑
- API Key加密存储
- 查询权限控制
- 敏感信息过滤
- 文档访问权限
- 数据传输加密

### 9.3 可扩展性
- 插件化的提供商适配器
- 标准化的查询接口
- 灵活的配置机制
- 水平扩展支持
- 多租户架构

## 10. 提供商适配器技术规范

### 10.1 标准适配器接口
所有外部知识库提供商适配器需要实现以下标准接口：

```python
class ExternalKnowledgeAdapter:
    def __init__(self, config: Dict[str, Any]):
        """初始化适配器"""
        pass

    def test_connection(self) -> Tuple[bool, str]:
        """测试连接"""
        pass

    def get_knowledge_list(self) -> List[Dict[str, Any]]:
        """获取知识库列表"""
        pass

    def get_knowledge_info(self, kb_id: str) -> Dict[str, Any]:
        """获取知识库详细信息"""
        pass

    def query_knowledge(self, config: Dict[str, Any], query: str) -> Dict[str, Any]:
        """查询知识库"""
        pass

    def upload_document(self, kb_id: str, document: Any) -> Dict[str, Any]:
        """上传文档（可选）"""
        pass
```

### 10.2 Dify适配器规范
**API端点映射**：
- 知识库列表：`GET /v1/datasets`
- 知识库查询：`POST /v1/datasets/{dataset_id}/hit-testing`
- 文档上传：`POST /v1/datasets/{dataset_id}/documents`

**查询参数映射**：
```json
{
  "query": "用户查询文本",
  "retrieval_model": {
    "search_method": "semantic_search",
    "reranking_enable": true,
    "reranking_model": {
      "reranking_provider_name": "cohere",
      "reranking_model_name": "rerank-english-v2.0"
    },
    "top_k": 5,
    "score_threshold": 0.7
  }
}
```

### 10.3 RagFlow适配器规范
**API端点映射**：
- 知识库列表：`GET /api/v1/kb`
- 知识库查询：`POST /api/v1/retrieval`
- 文档管理：`POST /api/v1/kb/{kb_id}/doc`

**查询参数映射**：
```json
{
  "question": "用户查询文本",
  "kb_ids": ["kb_id_1", "kb_id_2"],
  "top_k": 5,
  "similarity_threshold": 0.7,
  "vector_similarity_weight": 0.3,
  "keywords_similarity_weight": 0.7
}
```

### 10.4 FastGPT适配器规范
**API端点映射**：
- 知识库列表：`GET /api/core/dataset/list`
- 知识库查询：`POST /api/core/dataset/searchTest`
- 多模态处理：`POST /api/core/dataset/collection/create/text`

**多模态支持**：
- 图像识别和描述
- 表格结构化提取
- 音频转文本处理

## 11. 验收标准

### 11.1 功能验收
- [ ] 能够成功添加和管理外部知识库提供商
- [ ] 能够配置和管理外部知识库
- [ ] 能够管理角色与知识库的绑定关系
- [ ] 智能体能够成功查询外部知识库
- [ ] 查询结果能够正确集成到对话中
- [ ] 文档分段处理功能正常
- [ ] 向量化处理准确有效
- [ ] 检索结果相关性满足要求

### 11.2 性能验收
- [ ] 单次查询响应时间 < 5秒
- [ ] 支持并发查询数量 >= 10
- [ ] 系统稳定性 >= 99%
- [ ] 文档处理速度 >= 100KB/s
- [ ] 向量生成效率 >= 1000条/分钟

### 11.3 用户体验验收
- [ ] 界面操作直观易用
- [ ] 错误提示清晰明确
- [ ] 配置流程简单高效
- [ ] 文档上传和处理进度可视化
- [ ] 检索结果展示清晰

### 11.4 技术验收
- [ ] 支持多种文档格式处理
- [ ] 分段策略可配置且有效
- [ ] 向量化质量达到预期
- [ ] 检索准确率 >= 85%
- [ ] 系统可扩展性良好

## 12. 监控和运维

### 12.1 关键指标监控
**性能指标**：
- 查询响应时间分布
- 并发查询处理能力
- 文档处理吞吐量
- 向量生成速度

**质量指标**：
- 检索准确率和召回率
- 用户满意度评分
- 错误率和失败率
- 结果相关性评分

**资源指标**：
- CPU和内存使用率
- 存储空间占用
- 网络带宽消耗
- API调用频率和成本

### 12.2 日志和审计
**操作日志**：
- 用户操作记录
- 系统配置变更
- 文档上传和处理
- 查询请求和响应

**错误日志**：
- 系统异常和错误
- API调用失败
- 数据处理异常
- 性能瓶颈记录

### 12.3 告警机制
**实时告警**：
- 系统服务异常
- 查询响应超时
- 错误率超过阈值
- 资源使用率过高

**定期报告**：
- 系统运行状况周报
- 使用统计月报
- 性能优化建议
- 容量规划建议

## 13. 内外部知识库统计界面统一方案

### 13.1 现状分析
目前的内外部知识库统计界面存在以下问题：
1. **界面分离**：内部知识库统计（`UsageAnalytics.js`）和外部知识库统计（`ExternalKnowledgeStats.js`）是两个独立的组件
2. **数据结构不一致**：两个界面的数据结构和展示方式差异较大
3. **用户体验割裂**：用户需要在两个标签页之间切换查看不同类型的知识库统计

### 13.2 统一方案设计

#### 13.2.1 创建统一的知识库统计组件
**方案概述**：
- 创建一个新的 `UnifiedKnowledgeStats.js` 组件
- 支持内外部知识库数据的统一展示和对比
- 提供灵活的筛选和切换功能

**核心功能**：
1. **统一概览面板**：显示内外部知识库的总体统计对比
2. **类型切换器**：支持查看"全部"、"内部"、"外部"知识库统计
3. **统一数据表格**：内外部知识库在同一表格中展示，用标签区分类型
4. **对比分析**：提供内外部知识库使用情况的对比图表

#### 13.2.2 界面设计结构
```
┌─────────────────────────────────────────────────────────────┐
│ 知识库统计总览                                                │
├─────────────────────────────────────────────────────────────┤
│ [全部] [内部] [外部]  📅日期范围  🔍筛选条件                    │
├─────────────────────────────────────────────────────────────┤
│ 📊 统计卡片区域                                              │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                              │
│ │总数量│ │查询数│ │成功率│ │响应时│                              │
│ └─────┘ └─────┘ └─────┘ └─────┘                              │
├─────────────────────────────────────────────────────────────┤
│ 📈 趋势图表（内外部对比）                                      │
├─────────────────────────────────────────────────────────────┤
│ 📋 统一数据表格                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 名称 | 类型标签 | 查询次数 | 成功率 | 响应时间 | 最后使用  │ │
│ │ KB1  | [内部]   | 1,234   | 95%   | 0.5s    | 2小时前   │ │
│ │ KB2  | [外部]   | 856     | 92%   | 1.2s    | 1小时前   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 13.2.3 技术实现要点

**前端组件设计**：
- 使用 Ant Design 的 `Segmented` 组件实现类型切换
- 统一的数据表格，用 `Tag` 组件区分内外部类型
- 响应式布局，支持移动端查看

**数据整合**：
- 后端提供统一的 API 接口 `/api/knowledge/unified-stats`
- 前端统一处理内外部数据的格式化和展示
- 支持实时数据刷新和缓存优化

**交互优化**：
- 支持按类型、时间范围、使用频率等多维度筛选
- 提供数据导出功能
- 支持详情页面的快速跳转

### 13.3 数据结构统一

#### 13.3.1 统一的统计数据格式
```json
{
  "overview": {
    "total": {
      "knowledges": 25,
      "queries": 5420,
      "success_rate": 94.2,
      "avg_response_time": 0.8
    },
    "internal": {
      "knowledges": 15,
      "queries": 3200,
      "success_rate": 96.1,
      "avg_response_time": 0.5
    },
    "external": {
      "knowledges": 10,
      "queries": 2220,
      "success_rate": 91.8,
      "avg_response_time": 1.2
    }
  },
  "knowledge_list": [
    {
      "id": "kb_001",
      "name": "客户服务知识库",
      "type": "internal",
      "queries": 1234,
      "success_rate": 95.2,
      "avg_response_time": 0.5,
      "last_used": "2023-12-07T14:30:00Z",
      "status": "active"
    },
    {
      "id": "ext_kb_001",
      "name": "Dify产品知识库",
      "type": "external",
      "provider": "dify",
      "queries": 856,
      "success_rate": 92.1,
      "avg_response_time": 1.2,
      "last_used": "2023-12-07T13:15:00Z",
      "status": "active"
    }
  ],
  "trends": {
    "daily_stats": [
      {
        "date": "2023-12-01",
        "internal_queries": 145,
        "external_queries": 98,
        "total_queries": 243
      }
    ]
  }
}
```

#### 13.3.2 后端API接口设计
```python
@statistics_bp.route('/statistics/knowledge/unified', methods=['GET'])
def get_unified_knowledge_stats():
    """
    获取统一的知识库统计数据

    Query Parameters:
        - type: all|internal|external (默认: all)
        - start_date: 开始日期
        - end_date: 结束日期
        - role_id: 角色ID (可选)
    """
    pass
```

### 13.4 实施计划

#### 13.4.1 第一阶段：后端统一接口开发
- [ ] 创建统一知识库统计服务 `UnifiedKnowledgeStatisticsService`
- [ ] 实现统一数据格式转换
- [ ] 添加统一统计API接口
- [ ] 完善现有统计数据的兼容性

#### 13.4.2 第二阶段：前端统一组件开发
- [ ] 创建 `UnifiedKnowledgeStats.js` 组件
- [ ] 实现类型切换和筛选功能
- [ ] 开发统一数据表格和图表
- [ ] 集成到知识库管理主页面

#### 13.4.3 第三阶段：功能完善和优化
- [ ] 添加对比分析功能
- [ ] 实现数据导出功能
- [ ] 优化移动端显示效果
- [ ] 添加实时数据刷新

#### 13.4.4 第四阶段：用户体验优化
- [ ] 收集用户反馈
- [ ] 优化界面交互
- [ ] 性能优化和缓存
- [ ] 文档和帮助完善

### 13.5 实施建议
1. **渐进式改造**：先保留现有的分离界面，新增统一界面作为默认视图
2. **数据兼容**：确保新接口向下兼容现有的统计数据结构
3. **用户反馈**：上线后收集用户反馈，持续优化界面体验
4. **A/B测试**：对比新旧界面的用户使用情况，验证改进效果

### 13.6 预期效果
1. **提升用户体验**：一个界面查看所有知识库统计，减少操作步骤
2. **增强数据洞察**：通过对比分析，更好地了解内外部知识库的使用情况
3. **简化维护成本**：统一的组件和数据结构，降低开发和维护复杂度
4. **支持决策制定**：全面的统计数据帮助用户优化知识库配置和使用策略
