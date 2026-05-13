# 向量数据库前端API结构重构

## 概述

根据用户建议，我们将向量数据库相关的前端API代码重新组织到更合理的目录结构中，以支持多个向量数据库提供商。

## 新的目录结构

```
frontend/src/services/api/
├── vectorDbProviders/           # 向量数据库提供商目录
│   ├── index.js                # 提供商管理入口
│   ├── tidb.js                 # TiDB向量数据库API
│   ├── milvus.js               # Milvus向量数据库API
│   ├── pinecone.js             # Pinecone向量数据库API
│   ├── weaviate.js             # Weaviate向量数据库API
│   ├── qdrant.js               # Qdrant向量数据库API
│   └── chroma.js               # Chroma向量数据库API
├── vectorDatabase.js           # 通用向量数据库API
└── tidbVector.js               # 原TiDB API（保留兼容性）
```

## 核心功能

### 1. 提供商管理 (`vectorDbProviders/index.js`)

```javascript
import vectorDbProviders from './vectorDbProviders';

// 获取指定提供商的API服务
const tidbAPI = vectorDbProviders.getProviderAPI('tidb');
const milvusAPI = vectorDbProviders.getProviderAPI('milvus');

// 获取支持的提供商列表
const providers = vectorDbProviders.supportedProviders;

// 检查提供商是否支持
const isSupported = vectorDbProviders.isProviderSupported('tidb');
```

### 2. 支持的提供商

| 提供商 | ID | 状态 | 描述 |
|--------|----|----- |------|
| TiDB Cloud | `tidb` | ✅ Stable | TiDB向量数据库服务 |
| Milvus | `milvus` | ✅ Stable | 开源向量数据库 |
| Pinecone | `pinecone` | 🔄 Beta | 托管向量数据库服务 |
| Weaviate | `weaviate` | 🔄 Beta | 开源向量搜索引擎 |
| Qdrant | `qdrant` | 🔄 Beta | 向量相似度搜索引擎 |
| Chroma | `chroma` | 🔄 Beta | AI原生开源嵌入数据库 |

### 3. 统一的API接口

每个提供商都实现了标准的API接口：

```javascript
// 基础操作
- testConnection(config)        // 测试连接
- validateConfig(config)        // 验证配置

// 集合/表管理
- listCollections(config)       // 列出集合
- createCollection(config, name, schema)  // 创建集合
- deleteCollection(config, name)          // 删除集合
- getCollectionInfo(config, name)         // 获取集合信息

// 向量操作
- vectorSearch(config, name, params)      // 向量搜索
- insertVectors(config, name, data)       // 插入向量
- deleteVectors(config, name, ids)        // 删除向量
```

## 使用示例

### 1. 基础使用

```javascript
import { vectorDbProviders } from '@/services/api';

// 获取TiDB API
const tidbAPI = vectorDbProviders.getProviderAPI('tidb');

// 测试连接
const result = await tidbAPI.testConnection({
  connectionString: 'mysql://user:pass@host:port/db'
});

// 创建表
await tidbAPI.createTable('my_vectors', {
  dimension: 1536,
  distance_metric: 'COSINE'
});
```

### 2. 多提供商支持

```javascript
import { vectorDbProviders } from '@/services/api';

// 遍历所有支持的提供商
for (const provider of vectorDbProviders.supportedProviders) {
  if (provider.status === 'stable') {
    const api = vectorDbProviders.getProviderAPI(provider.id);
    console.log(`${provider.name} API已加载`);
  }
}
```

### 3. 动态提供商选择

```javascript
import { vectorDbProviders } from '@/services/api';

const VectorDbManager = {
  async testProvider(providerId, config) {
    try {
      const api = vectorDbProviders.getProviderAPI(providerId);
      const result = await api.testConnection(config);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async searchVectors(providerId, config, collectionName, searchParams) {
    const api = vectorDbProviders.getProviderAPI(providerId);
    return await api.vectorSearch(config, collectionName, searchParams);
  }
};
```

## 迁移指南

### 从旧API迁移

**旧方式:**
```javascript
import { tidbVectorAPI } from '@/services/api/tidbVector';
await tidbVectorAPI.testConnection(connectionString);
```

**新方式:**
```javascript
import { vectorDbProviders } from '@/services/api';
const tidbAPI = vectorDbProviders.getProviderAPI('tidb');
await tidbAPI.testConnection({ connectionString });
```

### 兼容性

- 原有的 `tidbVector.js` 文件保留，确保向后兼容
- 新代码建议使用 `vectorDbProviders` 结构
- 逐步迁移现有代码到新结构

## 扩展新提供商

### 1. 创建提供商API文件

```javascript
// frontend/src/services/api/vectorDbProviders/newProvider.js
import api from '../axios';

const newProviderAPI = {
  testConnection: async (config) => {
    // 实现连接测试
  },
  
  validateConfig: async (config) => {
    // 实现配置验证
  },
  
  // 其他API方法...
};

export default newProviderAPI;
```

### 2. 注册到提供商列表

```javascript
// frontend/src/services/api/vectorDbProviders/index.js
import newProviderAPI from './newProvider';

export const vectorDbProviders = {
  // 现有提供商...
  newProvider: newProviderAPI
};

export const supportedProviders = [
  // 现有提供商...
  {
    id: 'newProvider',
    name: 'New Provider',
    description: '新的向量数据库提供商',
    icon: 'database',
    status: 'beta'
  }
];
```

## 优势

### 1. **模块化设计**
- 每个提供商独立的API文件
- 清晰的职责分离
- 易于维护和扩展

### 2. **统一接口**
- 标准化的API方法
- 一致的错误处理
- 简化的使用方式

### 3. **可扩展性**
- 轻松添加新的向量数据库提供商
- 支持不同的配置格式
- 灵活的功能实现

### 4. **向后兼容**
- 保留原有API文件
- 渐进式迁移
- 不影响现有功能

## 总结

新的目录结构提供了：

✅ **更好的组织结构** - 按提供商分类的清晰目录
✅ **统一的API接口** - 标准化的方法和参数
✅ **易于扩展** - 简单的新提供商添加流程
✅ **向后兼容** - 保持现有代码正常工作
✅ **类型安全** - 清晰的接口定义和文档

这个结构为未来支持更多向量数据库提供商奠定了坚实的基础！🚀
