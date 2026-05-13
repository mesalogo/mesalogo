import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Popover, App } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../services/api/settings';

/**
 * 向量数据库配置Modal
 * 支持15个云服务商的配置
 */
export const VectorDBConfigModal = ({
  visible,
  onClose,
  settings,
  currentVectorDBConfig,
  onConfigUpdate
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 当Modal打开时，初始化表单值
  useEffect(() => {
    if (visible && settings) {
      const currentProvider = settings?.vector_db_provider || 'aliyun';
      const currentConfig = currentVectorDBConfig[currentProvider] || {};

      console.log('打开向量数据库配置Modal:', {
        currentProvider,
        currentConfig,
        allConfig: currentVectorDBConfig
      });

      form.setFieldsValue({
        provider: currentProvider,
        ...currentConfig
      });
    }
  }, [visible, settings, currentVectorDBConfig, form]);

  // 处理保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const { provider, ...config } = values;

      // 更新当前配置
      const newConfig = {
        ...currentVectorDBConfig,
        [provider]: config
      };

      // 保存配置到后端
      await settingsAPI.updateSettings({
        vector_db_config: newConfig
      });

      message.success(t('vectorDB.config.saveSuccess'));
      
      // 通知父组件配置已更新
      if (onConfigUpdate) {
        onConfigUpdate(newConfig);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save vector database configuration:', error);
      message.error(t('vectorDB.config.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 切换提供商时清空其他字段
  const handleProviderChange = (value) => {
    form.setFieldsValue({
      provider: value,
      // 通用字段
      apiKey: '',
      endpoint: '',
      region: '',
      // TiDB字段
      connectionString: '',
      // AWS字段
      accessKeyId: '',
      secretAccessKey: '',
      knowledgeBaseId: '',
      // Azure字段
      key: '',
      indexName: '',
      databaseName: '',
      containerName: '',
      // GCP字段
      projectId: '',
      location: '',
      indexEndpoint: '',
      serviceAccountKey: '',
      databaseId: '',
      collectionName: '',
      // 其他字段
      environment: '',
      username: '',
      password: ''
    });
  };

  // 渲染动态表单字段
  const renderProviderFields = (provider) => {
    if (provider === 'aliyun') {
      return (
        <>
          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入API Key' }]}
          >
            <Input.Password placeholder="请输入阿里云DashVector的API Key" />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="Cluster Endpoint"
            rules={[{ required: true, message: '请输入Cluster Endpoint' }]}
          >
            <Input placeholder="例如: https://your-cluster.dashvector.cn-hangzhou.aliyuncs.com" />
          </Form.Item>
        </>
      );
    }

    if (provider === 'tidb') {
      return (
        <Form.Item
          name="connectionString"
          label="Connection String"
          rules={[{ required: true, message: '请输入Connection String' }]}
        >
          <Input.TextArea
            placeholder="例如: mysql://3WYw82L9THMvuY5.root:PgCWHjef8kmYJ17V@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/test"
            rows={2}
          />
        </Form.Item>
      );
    }

    if (provider === 'aws-opensearch') {
      return (
        <>
          <Form.Item
            name="accessKeyId"
            label="Access Key ID"
            rules={[{ required: true, message: '请输入Access Key ID' }]}
          >
            <Input placeholder="请输入AWS Access Key ID" />
          </Form.Item>
          <Form.Item
            name="secretAccessKey"
            label="Secret Access Key"
            rules={[{ required: true, message: '请输入Secret Access Key' }]}
          >
            <Input.Password placeholder="请输入AWS Secret Access Key" />
          </Form.Item>
          <Form.Item
            name="region"
            label="AWS Region"
            rules={[{ required: true, message: '请输入AWS Region' }]}
          >
            <Input placeholder="例如: us-east-1" />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="OpenSearch Endpoint"
            rules={[{ required: true, message: '请输入OpenSearch Endpoint' }]}
          >
            <Input placeholder="例如: https://search-domain.us-east-1.es.amazonaws.com" />
          </Form.Item>
        </>
      );
    }

    if (provider === 'aws-bedrock') {
      return (
        <>
          <Form.Item
            name="accessKeyId"
            label="Access Key ID"
            rules={[{ required: true, message: '请输入Access Key ID' }]}
          >
            <Input placeholder="请输入AWS Access Key ID" />
          </Form.Item>
          <Form.Item
            name="secretAccessKey"
            label="Secret Access Key"
            rules={[{ required: true, message: '请输入Secret Access Key' }]}
          >
            <Input.Password placeholder="请输入AWS Secret Access Key" />
          </Form.Item>
          <Form.Item
            name="region"
            label="AWS Region"
            rules={[{ required: true, message: '请输入AWS Region' }]}
          >
            <Input placeholder="例如: us-east-1" />
          </Form.Item>
          <Form.Item
            name="knowledgeBaseId"
            label="Knowledge Base ID"
            rules={[{ required: true, message: '请输入Knowledge Base ID' }]}
          >
            <Input placeholder="请输入Bedrock Knowledge Base ID" />
          </Form.Item>
        </>
      );
    }

    if (provider === 'azure-cognitive-search') {
      return (
        <>
          <Form.Item
            name="endpoint"
            label="Search Service Endpoint"
            rules={[{ required: true, message: '请输入Search Service Endpoint' }]}
          >
            <Input placeholder="例如: https://your-service.search.windows.net" />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="Admin API Key"
            rules={[{ required: true, message: '请输入Admin API Key' }]}
          >
            <Input.Password placeholder="请输入Azure Cognitive Search的Admin API Key" />
          </Form.Item>
          <Form.Item
            name="indexName"
            label="Index Name"
            rules={[{ required: true, message: '请输入Index Name' }]}
          >
            <Input placeholder="请输入搜索索引名称" />
          </Form.Item>
        </>
      );
    }

    if (provider === 'azure-cosmos-db') {
      return (
        <>
          <Form.Item
            name="endpoint"
            label="Cosmos DB Endpoint"
            rules={[{ required: true, message: '请输入Cosmos DB Endpoint' }]}
          >
            <Input placeholder="例如: https://your-account.documents.azure.com:443/" />
          </Form.Item>
          <Form.Item
            name="key"
            label="Primary Key"
            rules={[{ required: true, message: '请输入Primary Key' }]}
          >
            <Input.Password placeholder="请输入Azure Cosmos DB的Primary Key" />
          </Form.Item>
          <Form.Item
            name="databaseName"
            label="Database Name"
            rules={[{ required: true, message: '请输入Database Name' }]}
          >
            <Input placeholder="请输入数据库名称" />
          </Form.Item>
          <Form.Item
            name="containerName"
            label="Container Name"
            rules={[{ required: true, message: '请输入Container Name' }]}
          >
            <Input placeholder="请输入容器名称" />
          </Form.Item>
        </>
      );
    }

    if (provider === 'gcp-vertex-ai') {
      return (
        <>
          <Form.Item
            name="projectId"
            label="Project ID"
            rules={[{ required: true, message: '请输入Project ID' }]}
          >
            <Input placeholder="请输入Google Cloud Project ID" />
          </Form.Item>
          <Form.Item
            name="location"
            label="Location"
            rules={[{ required: true, message: '请输入Location' }]}
          >
            <Input placeholder="例如: us-central1" />
          </Form.Item>
          <Form.Item
            name="indexEndpoint"
            label="Index Endpoint"
            rules={[{ required: true, message: '请输入Index Endpoint' }]}
          >
            <Input placeholder="请输入Vertex AI Vector Search Index Endpoint" />
          </Form.Item>
          <Form.Item
            name="serviceAccountKey"
            label="Service Account Key (JSON)"
            rules={[{ required: true, message: '请输入Service Account Key' }]}
          >
            <Input.TextArea
              placeholder="请粘贴Service Account Key的JSON内容"
              rows={4}
            />
          </Form.Item>
        </>
      );
    }

    if (provider === 'gcp-firestore') {
      return (
        <>
          <Form.Item
            name="projectId"
            label="Project ID"
            rules={[{ required: true, message: '请输入Project ID' }]}
          >
            <Input placeholder="请输入Google Cloud Project ID" />
          </Form.Item>
          <Form.Item
            name="databaseId"
            label="Database ID"
          >
            <Input placeholder="请输入Firestore Database ID（默认为(default)）" />
          </Form.Item>
          <Form.Item
            name="collectionName"
            label="Collection Name"
            rules={[{ required: true, message: '请输入Collection Name' }]}
          >
            <Input placeholder="请输入Firestore集合名称" />
          </Form.Item>
          <Form.Item
            name="serviceAccountKey"
            label="Service Account Key (JSON)"
            rules={[{ required: true, message: '请输入Service Account Key' }]}
          >
            <Input.TextArea
              placeholder="请粘贴Service Account Key的JSON内容"
              rows={4}
            />
          </Form.Item>
        </>
      );
    }

    if (provider === 'pinecone') {
      return (
        <>
          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入API Key' }]}
          >
            <Input.Password placeholder="请输入Pinecone的API Key" />
          </Form.Item>
          <Form.Item
            name="environment"
            label="Environment"
            rules={[{ required: true, message: '请输入Environment' }]}
          >
            <Input placeholder="例如: us-west1-gcp" />
          </Form.Item>
          <Form.Item
            name="indexName"
            label="Index Name"
            rules={[{ required: true, message: '请输入Index Name' }]}
          >
            <Input placeholder="请输入Pinecone索引名称" />
          </Form.Item>
        </>
      );
    }

    if (provider === 'milvus') {
      return (
        <>
          <Form.Item
            name="endpoint"
            label="Milvus Endpoint"
            rules={[{ required: true, message: '请输入Milvus Endpoint' }]}
          >
            <Input placeholder="例如: localhost:19530" />
          </Form.Item>
          <Form.Item
            name="username"
            label="Username"
          >
            <Input placeholder="请输入用户名（如果需要认证）" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
          >
            <Input.Password placeholder="请输入密码（如果需要认证）" />
          </Form.Item>
          <Form.Item
            name="collectionName"
            label="Collection Name"
            rules={[{ required: true, message: '请输入Collection Name' }]}
          >
            <Input placeholder="请输入Milvus集合名称" />
          </Form.Item>
        </>
      );
    }

    if (provider === 'elasticsearch') {
      return (
        <>
          <Form.Item
            name="endpoint"
            label="Elasticsearch Endpoint"
            rules={[{ required: true, message: '请输入Elasticsearch Endpoint' }]}
          >
            <Input placeholder="例如: https://localhost:9200" />
          </Form.Item>
          <Form.Item
            name="username"
            label="Username"
          >
            <Input placeholder="请输入用户名（如果需要认证）" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
          >
            <Input.Password placeholder="请输入密码（如果需要认证）" />
          </Form.Item>
          <Form.Item
            name="indexName"
            label="Index Name"
            rules={[{ required: true, message: '请输入Index Name' }]}
          >
            <Input placeholder="请输入Elasticsearch索引名称" />
          </Form.Item>
        </>
      );
    }

    if (provider === 'custom') {
      return (
        <>
          <Form.Item
            name="endpoint"
            label="服务端点"
            rules={[{ required: true, message: '请输入服务端点' }]}
          >
            <Input placeholder="请输入自定义向量数据库的服务端点" />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="认证密钥"
          >
            <Input.Password placeholder="请输入认证密钥（如果需要）" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
          >
            <Input placeholder="请输入用户名（如果需要）" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
          >
            <Input.Password placeholder="请输入密码（如果需要）" />
          </Form.Item>
        </>
      );
    }

    // 其他提供商的通用配置
    return (
      <>
        <Form.Item
          name="endpoint"
          label="服务端点"
          rules={[{ required: true, message: '请输入服务端点' }]}
        >
          <Input placeholder="请输入向量数据库的服务端点" />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label="API Key"
        >
          <Input.Password placeholder="请输入API Key（如果需要）" />
        </Form.Item>
      </>
    );
  };

  return (
    <Modal
      title={t('settings.configureVectorDB')}
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      confirmLoading={loading}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="provider"
          label={
            <span>
              向量数据库提供商
              <Popover
                title="配置说明"
                content={
                  <div style={{ maxWidth: '400px', fontSize: '12px', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '8px' }}><strong>阿里云 DashVector:</strong> 需要API Key和Cluster Endpoint，可在阿里云控制台获取</p>
                    <p style={{ marginBottom: '8px' }}><strong>TiDB Cloud:</strong> 只需要Connection String，可在TiDB Cloud控制台的Connect页面直接复制</p>
                    <p style={{ marginBottom: '8px' }}><strong>AWS OpenSearch:</strong> 需要Access Key、Secret Key、Region和OpenSearch域名端点</p>
                    <p style={{ marginBottom: '8px' }}><strong>AWS Bedrock:</strong> 需要Access Key、Secret Key、Region和Knowledge Base ID</p>
                    <p style={{ marginBottom: '8px' }}><strong>Azure Cognitive Search:</strong> 需要Search Service端点、Admin API Key和索引名称</p>
                    <p style={{ marginBottom: '8px' }}><strong>Azure Cosmos DB:</strong> 需要Cosmos DB端点、Primary Key、数据库名和容器名</p>
                    <p style={{ marginBottom: '8px' }}><strong>Google Cloud Vertex AI:</strong> 需要Project ID、Location、Index Endpoint和Service Account Key</p>
                    <p style={{ marginBottom: '8px' }}><strong>Google Cloud Firestore:</strong> 需要Project ID、Collection Name和Service Account Key</p>
                    <p style={{ marginBottom: '8px' }}><strong>Pinecone:</strong> 需要API Key、Environment和Index Name</p>
                    <p style={{ marginBottom: '0' }}><strong>其他提供商:</strong> 请根据相应文档配置连接参数</p>
                  </div>
                }
                trigger="hover"
                placement="rightTop"
              >
                <InfoCircleOutlined
                  style={{
                    marginLeft: '6px',
                    color: 'var(--custom-text-secondary)',
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                />
              </Popover>
            </span>
          }
          rules={[{ required: true, message: '请选择向量数据库提供商' }]}
        >
          <Select
            placeholder="选择向量数据库提供商"
            onChange={handleProviderChange}
          >
            <Select.Option value="aliyun">阿里云 DashVector</Select.Option>
            <Select.Option value="tidb">TiDB Cloud</Select.Option>
            <Select.Option value="aws-opensearch">AWS OpenSearch</Select.Option>
            <Select.Option value="aws-bedrock">AWS Bedrock Knowledge Base</Select.Option>
            <Select.Option value="azure-cognitive-search">Azure Cognitive Search</Select.Option>
            <Select.Option value="azure-cosmos-db">Azure Cosmos DB</Select.Option>
            <Select.Option value="gcp-vertex-ai">Google Cloud Vertex AI Vector Search</Select.Option>
            <Select.Option value="gcp-firestore">Google Cloud Firestore</Select.Option>
            <Select.Option value="pinecone">Pinecone</Select.Option>
            <Select.Option value="weaviate">Weaviate</Select.Option>
            <Select.Option value="qdrant">Qdrant</Select.Option>
            <Select.Option value="chroma">Chroma</Select.Option>
            <Select.Option value="milvus">Milvus</Select.Option>
            <Select.Option value="elasticsearch">Elasticsearch</Select.Option>
            <Select.Option value="custom">自定义</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item dependencies={['provider']} noStyle>
          {({ getFieldValue }) => {
            const provider = getFieldValue('provider');
            return renderProviderFields(provider);
          }}
        </Form.Item>
      </Form>
    </Modal>
  );
};
