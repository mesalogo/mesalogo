# 图谱增强服务模块（Graphiti 记忆系统）

这个模块提供 Graphiti 记忆系统的服务实现。

> **注意**: LightRAG 知识库系统已独立到 `app/services/lightrag/` 模块，
> 使用独立的 `/api/lightrag/*` API 路由。

## 目录结构

```
graph_enhancement/
├── __init__.py              # 模块入口，导出主服务类
├── base.py                  # 基础接口和抽象类定义
├── main.py                  # 主服务类，整合 Graphiti 框架
├── graphiti_service.py      # Graphiti框架服务实现
├── graphrag_service.py      # GraphRAG框架服务实现（待完善）
└── README.md               # 本文档
```

## 支持的框架

### 1. Graphiti（主要）
- **描述**: 基于Neo4j的图谱记忆框架
- **存储**: Neo4j图数据库
- **特点**: 支持复杂的图谱查询和可视化
- **用途**: 智能体长期记忆系统
- **状态**: ✅ 已实现

### 2. GraphRAG
- **描述**: Microsoft的图谱RAG框架
- **存储**: 多种后端支持
- **特点**: 企业级功能
- **状态**: 🚧 部分实现（模拟）

### LightRAG（已独立）
- **位置**: `app/services/lightrag/`
- **API**: `/api/lightrag/*`
- **用途**: 知识库系统（与记忆系统分离）
- **详见**: `docs/feature-knowledge-base/lightrag-PLAN.md`

## 使用方式

### 基本使用

```python
from app.services.graph_enhancement import GraphEnhancementService

# 创建服务实例
service = GraphEnhancementService()

# 初始化框架
success, message = service.initialize(config)

# 执行查询
success, result = service.query(config, "查询内容", params)

# 获取可视化数据
success, data = service.get_visualization_data(config, group_id)
```

### 直接使用特定框架

```python
from app.services.graph_enhancement.graphiti_service import GraphitiService

# 创建Graphiti服务
graphiti = GraphitiService(config)
success, message = graphiti.initialize()
```

## 接口说明

所有框架服务都继承自 `BaseGraphEnhancementFramework`，实现以下接口：

- `initialize()` - 初始化框架
- `get_status()` - 获取框架状态
- `query()` - 执行基础查询
- `query_advanced()` - 执行高级查询
- `insert_documents()` - 插入文档
- `rebuild_index()` - 重建索引
- `clear_data()` - 清空数据
- `get_visualization_data()` - 获取可视化数据
- `get_database_info()` - 获取数据库信息

## 分区策略

支持多种分区策略：

- `by_space` - 按行动空间分区
- `by_task` - 按行动任务分区
- `by_role` - 按角色分区
- `by_agent` - 按智能体分区
- `global` - 全局分区

## 可视化支持

每个框架都支持图谱可视化数据获取，返回标准格式：

```json
{
  "nodes": [
    {
      "id": "节点ID",
      "label": "节点标签",
      "title": "节点描述",
      "group": "分组ID"
    }
  ],
  "edges": [
    {
      "id": "边ID",
      "from": "源节点ID",
      "to": "目标节点ID",
      "label": "关系标签",
      "title": "关系描述"
    }
  ],
  "stats": {
    "entity_count": 100,
    "relationship_count": 200,
    "group_id": "分组ID"
  }
}
```

## 配置说明

### Graphiti配置

```json
{
  "framework_config": {
    "service_url": "http://localhost:8000",
    "neo4j_uri": "bolt://localhost:7687",
    "neo4j_user": "neo4j",
    "neo4j_password": "password",
    "database_type": "neo4j"
  }
}
```

### GraphRAG配置

```json
{
  "framework_config": {
    "working_dir": "./graph_storage/graphrag",
    "config_file": "settings.yaml"
  }
}
```

## 扩展新框架

要添加新的图谱增强框架：

1. 在 `graph_enhancement/` 目录下创建新的服务文件
2. 继承 `BaseGraphEnhancementFramework` 类
3. 实现所有抽象方法
4. 在 `main.py` 中注册新框架
5. 更新 `supported_frameworks` 列表

## 注意事项

- 所有服务都支持异步操作
- 错误处理统一通过返回元组 `(success: bool, result: Any)` 的方式
- 日志记录使用 Flask 的 `current_app.logger`
- 配置信息通过 `framework_config` 字段传递
