# 向量数据库与嵌入模型集成测试功能

## 功能概述

根据用户要求，我们已经将向量数据库连接测试升级为完整的向量操作测试，使用配置的嵌入模型进行真实的向量生成、存储和搜索测试。如果用户未配置默认嵌入模型，系统会提示需要先配置默认嵌入模型。

## 核心改进

### 1. 嵌入模型检查
所有向量数据库连接测试现在都会首先检查是否配置了默认嵌入模型：

```python
# 检查默认嵌入模型
default_model = embedding_service.get_default_embedding_model()
if not default_model:
    return False, "未配置默认嵌入模型，请先在模型配置中设置默认嵌入模型", {
        'provider': provider,
        'status': 'no_embedding_model',
        'note': '需要配置默认嵌入模型才能进行向量测试'
    }
```

### 2. 完整的向量操作测试

#### TiDB向量测试流程
1. ✅ **基础连接测试** - 验证数据库连接
2. ✅ **向量生成测试** - 使用默认嵌入模型生成测试向量
3. ✅ **表创建测试** - 创建临时向量表
4. ✅ **向量插入测试** - 插入测试向量数据
5. ✅ **向量搜索测试** - 执行语义搜索
6. ✅ **资源清理** - 自动删除测试表

#### Milvus向量测试流程
1. ✅ **基础连接测试** - 验证Milvus服务器连接
2. ✅ **向量生成测试** - 使用默认嵌入模型生成测试向量
3. ✅ **集合创建测试** - 创建临时向量集合
4. ✅ **索引创建测试** - 创建向量索引
5. ✅ **向量插入测试** - 插入测试向量数据
6. ✅ **向量搜索测试** - 执行相似度搜索
7. ✅ **资源清理** - 自动删除测试集合

### 3. 详细的测试结果

#### 成功测试结果示例
```json
{
  "success": true,
  "message": "TiDB向量数据库测试成功！使用模型: text-embedding-ada-002, 向量维度: 1536",
  "info": {
    "provider": "tidb",
    "status": "vector_test_passed",
    "database_info": {
      "version": "TiDB v7.5.2-serverless",
      "response_time": 1234.56
    },
    "embedding_model": {
      "id": 1,
      "name": "text-embedding-ada-002",
      "provider": "openai",
      "vector_dimension": 1536
    },
    "vector_test_results": {
      "embedding_time": 0.523,
      "insert_count": 1,
      "search_results_count": 1,
      "similarity_score": 0.999
    }
  }
}
```

#### 缺少嵌入模型的错误示例
```json
{
  "success": false,
  "message": "未配置默认嵌入模型，请先在模型配置中设置默认嵌入模型",
  "info": {
    "provider": "tidb",
    "status": "no_embedding_model",
    "note": "需要配置默认嵌入模型才能进行向量测试"
  }
}
```

## 技术实现

### 1. 嵌入模型服务集成

```python
from app.services.vector_db.embedding_service import embedding_service

# 获取默认嵌入模型
default_model = embedding_service.get_default_embedding_model()

# 生成测试向量
embed_success, embeddings, embed_info = embedding_service.generate_embeddings(
    [test_text], 
    default_model
)
```

### 2. TiDB向量操作集成

```python
from app.services.vector_db.vector_operations import vector_operations
from app.services.vector_db.table_manager import vector_table_manager

# 创建测试表
table_success, table_message = vector_table_manager.create_table(
    table_name=test_table_name,
    vector_dimension=vector_dimension,
    description="向量连接测试表"
)

# 插入测试向量
insert_success, insert_message, insert_info = vector_operations.batch_insert_with_embeddings(
    table_name=test_table_name,
    texts=[test_text],
    metadatas=[{"test": True, "timestamp": time.time()}],
    source="connection_test"
)

# 执行向量搜索
search_success, search_results, search_info = vector_operations.semantic_search(
    table_name=test_table_name,
    query_text=test_text,
    limit=1
)
```

### 3. Milvus向量操作集成

```python
from pymilvus import Collection, CollectionSchema, FieldSchema, DataType

# 创建集合schema
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=1000),
    FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=vector_dimension)
]
schema = CollectionSchema(fields, description="向量连接测试集合")
collection = Collection(test_collection_name, schema, using=conn_alias)

# 创建索引
index_params = {
    "metric_type": "COSINE",
    "index_type": "IVF_FLAT",
    "params": {"nlist": 128}
}
collection.create_index("vector", index_params)

# 插入数据并搜索
entities = [[test_text], [embeddings[0]]]
collection.insert(entities)
collection.flush()
collection.load()

# 执行搜索
search_params = {"metric_type": "COSINE", "params": {"nprobe": 10}}
results = collection.search(
    data=[embeddings[0]], 
    anns_field="vector", 
    param=search_params, 
    limit=1,
    output_fields=["text"]
)
```

## 用户体验

### 1. 配置默认嵌入模型

用户需要在模型配置页面：
1. 添加支持向量输出的模型（如OpenAI的text-embedding-ada-002）
2. 将其设置为默认嵌入模型
3. 确保模型配置正确且API密钥有效

### 2. 测试向量数据库连接

1. **选择向量数据库提供商**（如TiDB Cloud、Milvus等）
2. **配置连接参数**（连接字符串、端点等）
3. **点击"测试连接"按钮**
4. **查看详细测试结果**：
   - 基础连接状态
   - 使用的嵌入模型信息
   - 向量操作测试结果
   - 性能指标（响应时间、相似度分数等）

### 3. 错误处理和提示

#### 缺少嵌入模型
```
❌ 未配置默认嵌入模型，请先在模型配置中设置默认嵌入模型
💡 请在模型配置页面添加并设置默认嵌入模型
```

#### 向量生成失败
```
❌ 生成测试向量失败: API密钥无效
💡 请检查嵌入模型的API密钥配置
```

#### 向量操作失败
```
❌ 向量搜索测试失败: 表不存在
💡 请检查数据库权限和连接配置
```

## 测试验证

### 运行集成测试
```bash
python test_vector_embedding_integration.py
```

### 测试内容
1. ✅ **嵌入模型检查** - 验证默认嵌入模型配置
2. ✅ **向量生成测试** - 测试嵌入模型生成向量
3. ✅ **TiDB向量集成** - 完整的TiDB向量操作测试
4. ✅ **Milvus向量集成** - 完整的Milvus向量操作测试
5. ✅ **错误场景测试** - 验证缺少嵌入模型时的错误处理

### 预期结果
```
🎉 向量数据库与嵌入模型集成测试基本通过！

✅ 完成的功能:
   🔍 检查默认嵌入模型配置
   🧪 使用嵌入模型生成测试向量
   📊 执行完整的向量操作测试
   🚫 正确处理缺少嵌入模型的情况

🎯 当前默认嵌入模型:
   - 名称: text-embedding-ada-002
   - 提供商: openai
   - 模型ID: text-embedding-ada-002
```

## 支持的向量数据库

### 完整向量测试支持
- ✅ **TiDB Cloud** - 完整的向量操作测试
- ✅ **Milvus** - 完整的向量操作测试

### 嵌入模型检查支持
- ✅ **所有提供商** - 都会检查默认嵌入模型配置

### 待实现完整测试
- 🔄 **Pinecone** - 需要安装pinecone-client SDK
- 🔄 **Weaviate** - 需要安装weaviate-client SDK
- 🔄 **Qdrant** - 需要安装qdrant-client SDK
- 🔄 **其他提供商** - 需要相应的SDK和实现

## 性能指标

### 测试性能
- **向量生成时间**: 通常0.1-2秒（取决于模型和网络）
- **数据库操作时间**: 通常1-5秒（包含表创建、插入、搜索）
- **总测试时间**: 通常5-15秒（完整测试流程）

### 向量质量
- **相似度分数**: 自相似搜索通常>0.95
- **向量维度**: 根据嵌入模型确定（如1536维）
- **搜索准确性**: 测试文本应该能找到自己

## 总结

✅ **已完成的改进**:
1. **嵌入模型集成** - 所有连接测试都使用配置的嵌入模型
2. **完整向量测试** - 不仅测试连接，还测试完整的向量操作流程
3. **智能错误处理** - 明确提示缺少嵌入模型的情况
4. **详细测试结果** - 提供丰富的测试信息和性能指标
5. **资源自动清理** - 测试完成后自动清理临时资源

✅ **用户价值**:
- **真实测试** - 验证完整的向量数据库工作流程
- **配置验证** - 确保嵌入模型和数据库都正确配置
- **性能监控** - 了解向量操作的性能表现
- **问题诊断** - 详细的错误信息帮助快速定位问题

现在用户可以获得真正有意义的向量数据库连接测试，不仅验证连接，还验证完整的向量工作流程！🚀
