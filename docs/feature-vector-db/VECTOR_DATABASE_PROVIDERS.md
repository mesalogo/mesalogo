# 向量数据库提供商配置指南

本文档介绍了系统支持的各种向量数据库提供商及其配置参数。

## 支持的提供商

### 1. 阿里云 DashVector
- **提供商代码**: `aliyun`
- **所需参数**:
  - `apiKey`: DashVector API Key
  - `endpoint`: Cluster Endpoint (例如: https://your-cluster.dashvector.cn-hangzhou.aliyuncs.com)
- **获取方式**: 阿里云控制台 > 向量检索服务 DashVector

### 2. TiDB Cloud
- **提供商代码**: `tidb`
- **所需参数**:
  - `connectionString`: MySQL连接字符串（包含所有连接信息）
- **获取方式**: TiDB Cloud控制台 > Clusters > Connect
- **连接字符串格式**:
  ```
  mysql://3WYw82L9THMvuY5.root:PgCWHjef8kmYJ17V@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/test
  ```
- **配置步骤**:
  1. 登录TiDB Cloud控制台
  2. 选择您的集群，点击"Connect"
  3. 直接复制提供的连接字符串即可

### 3. AWS OpenSearch
- **提供商代码**: `aws-opensearch`
- **所需参数**:
  - `accessKeyId`: AWS Access Key ID
  - `secretAccessKey`: AWS Secret Access Key
  - `region`: AWS Region (例如: us-east-1)
  - `endpoint`: OpenSearch域名端点 (例如: https://search-domain.us-east-1.es.amazonaws.com)
- **获取方式**: AWS控制台 > OpenSearch Service

### 4. AWS Bedrock Knowledge Base
- **提供商代码**: `aws-bedrock`
- **所需参数**:
  - `accessKeyId`: AWS Access Key ID
  - `secretAccessKey`: AWS Secret Access Key
  - `region`: AWS Region (例如: us-east-1)
  - `knowledgeBaseId`: Bedrock Knowledge Base ID
- **获取方式**: AWS控制台 > Amazon Bedrock > Knowledge bases

### 5. Azure Cognitive Search
- **提供商代码**: `azure-cognitive-search`
- **所需参数**:
  - `endpoint`: Search Service端点 (例如: https://your-service.search.windows.net)
  - `apiKey`: Admin API Key
  - `indexName`: 搜索索引名称
- **获取方式**: Azure门户 > Azure Cognitive Search

### 6. Azure Cosmos DB
- **提供商代码**: `azure-cosmos-db`
- **所需参数**:
  - `endpoint`: Cosmos DB端点 (例如: https://your-account.documents.azure.com:443/)
  - `key`: Primary Key
  - `databaseName`: 数据库名称
  - `containerName`: 容器名称
- **获取方式**: Azure门户 > Azure Cosmos DB

### 7. Google Cloud Vertex AI Vector Search
- **提供商代码**: `gcp-vertex-ai`
- **所需参数**:
  - `projectId`: Google Cloud Project ID
  - `location`: 区域 (例如: us-central1)
  - `indexEndpoint`: Vertex AI Vector Search Index Endpoint
  - `serviceAccountKey`: Service Account Key (JSON格式)
- **获取方式**: Google Cloud Console > Vertex AI > Vector Search

### 8. Google Cloud Firestore
- **提供商代码**: `gcp-firestore`
- **所需参数**:
  - `projectId`: Google Cloud Project ID
  - `databaseId`: Firestore Database ID (可选，默认为"(default)")
  - `collectionName`: Firestore集合名称
  - `serviceAccountKey`: Service Account Key (JSON格式)
- **获取方式**: Google Cloud Console > Firestore

### 9. Pinecone
- **提供商代码**: `pinecone`
- **所需参数**:
  - `apiKey`: Pinecone API Key
  - `environment`: Environment (例如: us-west1-gcp)
  - `indexName`: Pinecone索引名称
- **获取方式**: Pinecone控制台

### 10. Weaviate
- **提供商代码**: `weaviate`
- **所需参数**:
  - `endpoint`: Weaviate服务端点
  - `apiKey`: API Key (如果需要)
- **获取方式**: Weaviate Cloud或自托管实例

### 11. Qdrant
- **提供商代码**: `qdrant`
- **所需参数**:
  - `endpoint`: Qdrant服务端点
  - `apiKey`: API Key (如果需要)
- **获取方式**: Qdrant Cloud或自托管实例

### 12. Chroma
- **提供商代码**: `chroma`
- **所需参数**:
  - `endpoint`: Chroma服务端点
  - `apiKey`: API Key (如果需要)
- **获取方式**: 自托管Chroma实例

### 13. Milvus
- **提供商代码**: `milvus`
- **所需参数**:
  - `endpoint`: Milvus端点 (例如: localhost:19530)
  - `username`: 用户名 (如果需要认证)
  - `password`: 密码 (如果需要认证)
  - `collectionName`: Milvus集合名称
- **获取方式**: Zilliz Cloud或自托管Milvus实例

### 14. Elasticsearch
- **提供商代码**: `elasticsearch`
- **所需参数**:
  - `endpoint`: Elasticsearch端点 (例如: https://localhost:9200)
  - `username`: 用户名 (如果需要认证)
  - `password`: 密码 (如果需要认证)
  - `indexName`: Elasticsearch索引名称
- **获取方式**: Elastic Cloud或自托管Elasticsearch实例

### 15. 自定义
- **提供商代码**: `custom`
- **所需参数**:
  - `endpoint`: 服务端点
  - `apiKey`: 认证密钥 (可选)
  - `username`: 用户名 (可选)
  - `password`: 密码 (可选)
- **用途**: 支持其他自定义的向量数据库服务

## 配置说明

1. **内置向量数据库**: 当启用"使用内置向量数据库"时，系统将使用内置的Milvus实例，无需额外配置。

2. **外部向量数据库**: 当禁用内置选项时，需要选择外部提供商并配置相应的连接参数。

3. **安全性**: 所有敏感信息（如API Key、密码等）都会被安全存储，不会在日志中显示。

4. **测试连接**: 配置完成后，建议先测试连接以确保参数正确。

## 注意事项

- 不同提供商的向量维度和距离度量方式可能不同，请确保与您的嵌入模型兼容。
- 某些云服务提供商可能需要额外的网络配置或防火墙规则。
- 建议为生产环境使用专用的服务账户和最小权限原则。
