import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Popover, App } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../services/api/settings';

/**
 * Vector DB configuration modal.
 * Supports 15 cloud providers.
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

  // initialize form when modal opens
  useEffect(() => {
    if (visible && settings) {
      const currentProvider = settings?.vector_db_provider || 'aliyun';
      const currentConfig = currentVectorDBConfig[currentProvider] || {};

      console.log('open vector DB config modal:', {
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

  // save handler
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const { provider, ...config } = values;

      // update current config
      const newConfig = {
        ...currentVectorDBConfig,
        [provider]: config
      };

      // persist to backend
      await settingsAPI.updateSettings({
        vector_db_config: newConfig
      });

      message.success(t('vectorDB.config.saveSuccess'));

      // notify parent
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

  // clear other fields on provider switch
  const handleProviderChange = (value) => {
    form.setFieldsValue({
      provider: value,
      // common fields
      apiKey: '',
      endpoint: '',
      region: '',
      // TiDB fields
      connectionString: '',
      // AWS fields
      accessKeyId: '',
      secretAccessKey: '',
      knowledgeBaseId: '',
      // Azure fields
      key: '',
      indexName: '',
      databaseName: '',
      containerName: '',
      // GCP fields
      projectId: '',
      location: '',
      indexEndpoint: '',
      serviceAccountKey: '',
      databaseId: '',
      collectionName: '',
      // other fields
      environment: '',
      username: '',
      password: ''
    });
  };

  // dynamic form fields
  const renderProviderFields = (provider) => {
    if (provider === 'aliyun') {
      return (
        <>
          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: t('vectorDB.req.apiKey') }]}
          >
            <Input.Password placeholder={t('vectorDB.ph.aliyunKey')} />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="Cluster Endpoint"
            rules={[{ required: true, message: t('vectorDB.req.clusterEndpoint') }]}
          >
            <Input placeholder={t('vectorDB.ph.aliyunEndpoint')} />
          </Form.Item>
        </>
      );
    }

    if (provider === 'tidb') {
      return (
        <Form.Item
          name="connectionString"
          label="Connection String"
          rules={[{ required: true, message: t('vectorDB.req.connectionString') }]}
        >
          <Input.TextArea
            placeholder={t('vectorDB.ph.tidbConnString')}
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
            rules={[{ required: true, message: t('vectorDB.req.accessKeyId') }]}
          >
            <Input placeholder={t('vectorDB.ph.awsAccessKey')} />
          </Form.Item>
          <Form.Item
            name="secretAccessKey"
            label="Secret Access Key"
            rules={[{ required: true, message: t('vectorDB.req.secretAccessKey') }]}
          >
            <Input.Password placeholder={t('vectorDB.ph.awsSecretKey')} />
          </Form.Item>
          <Form.Item
            name="region"
            label="AWS Region"
            rules={[{ required: true, message: t('vectorDB.req.awsRegion') }]}
          >
            <Input placeholder="us-east-1" />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="OpenSearch Endpoint"
            rules={[{ required: true, message: t('vectorDB.req.opensearchEndpoint') }]}
          >
            <Input placeholder="https://search-domain.us-east-1.es.amazonaws.com" />
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
            rules={[{ required: true, message: t('vectorDB.req.accessKeyId') }]}
          >
            <Input placeholder={t('vectorDB.ph.awsAccessKey')} />
          </Form.Item>
          <Form.Item
            name="secretAccessKey"
            label="Secret Access Key"
            rules={[{ required: true, message: t('vectorDB.req.secretAccessKey') }]}
          >
            <Input.Password placeholder={t('vectorDB.ph.awsSecretKey')} />
          </Form.Item>
          <Form.Item
            name="region"
            label="AWS Region"
            rules={[{ required: true, message: t('vectorDB.req.awsRegion') }]}
          >
            <Input placeholder="us-east-1" />
          </Form.Item>
          <Form.Item
            name="knowledgeBaseId"
            label="Knowledge Base ID"
            rules={[{ required: true, message: t('vectorDB.req.kbId') }]}
          >
            <Input placeholder={t('vectorDB.ph.bedrockKbId')} />
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
            rules={[{ required: true, message: t('vectorDB.req.searchEndpoint') }]}
          >
            <Input placeholder="https://your-service.search.windows.net" />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="Admin API Key"
            rules={[{ required: true, message: t('vectorDB.req.adminApiKey') }]}
          >
            <Input.Password placeholder={t('vectorDB.ph.azureSearchKey')} />
          </Form.Item>
          <Form.Item
            name="indexName"
            label="Index Name"
            rules={[{ required: true, message: t('vectorDB.req.indexName') }]}
          >
            <Input placeholder={t('vectorDB.ph.indexName')} />
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
            rules={[{ required: true, message: t('vectorDB.req.cosmosEndpoint') }]}
          >
            <Input placeholder="https://your-account.documents.azure.com:443/" />
          </Form.Item>
          <Form.Item
            name="key"
            label="Primary Key"
            rules={[{ required: true, message: t('vectorDB.req.primaryKey') }]}
          >
            <Input.Password placeholder={t('vectorDB.ph.cosmosKey')} />
          </Form.Item>
          <Form.Item
            name="databaseName"
            label="Database Name"
            rules={[{ required: true, message: t('vectorDB.req.databaseName') }]}
          >
            <Input placeholder={t('vectorDB.ph.databaseName')} />
          </Form.Item>
          <Form.Item
            name="containerName"
            label="Container Name"
            rules={[{ required: true, message: t('vectorDB.req.containerName') }]}
          >
            <Input placeholder={t('vectorDB.ph.containerName')} />
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
            rules={[{ required: true, message: t('vectorDB.req.projectId') }]}
          >
            <Input placeholder={t('vectorDB.ph.gcpProjectId')} />
          </Form.Item>
          <Form.Item
            name="location"
            label="Location"
            rules={[{ required: true, message: t('vectorDB.req.location') }]}
          >
            <Input placeholder="us-central1" />
          </Form.Item>
          <Form.Item
            name="indexEndpoint"
            label="Index Endpoint"
            rules={[{ required: true, message: t('vectorDB.req.indexEndpoint') }]}
          >
            <Input placeholder={t('vectorDB.ph.vertexIndexEndpoint')} />
          </Form.Item>
          <Form.Item
            name="serviceAccountKey"
            label="Service Account Key (JSON)"
            rules={[{ required: true, message: t('vectorDB.req.serviceAccountKey') }]}
          >
            <Input.TextArea
              placeholder={t('vectorDB.ph.serviceAccountKey')}
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
            rules={[{ required: true, message: t('vectorDB.req.projectId') }]}
          >
            <Input placeholder={t('vectorDB.ph.gcpProjectId')} />
          </Form.Item>
          <Form.Item
            name="databaseId"
            label="Database ID"
          >
            <Input placeholder={t('vectorDB.ph.firestoreDbId')} />
          </Form.Item>
          <Form.Item
            name="collectionName"
            label="Collection Name"
            rules={[{ required: true, message: t('vectorDB.req.collectionName') }]}
          >
            <Input placeholder={t('vectorDB.ph.firestoreCollection')} />
          </Form.Item>
          <Form.Item
            name="serviceAccountKey"
            label="Service Account Key (JSON)"
            rules={[{ required: true, message: t('vectorDB.req.serviceAccountKey') }]}
          >
            <Input.TextArea
              placeholder={t('vectorDB.ph.serviceAccountKey')}
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
            rules={[{ required: true, message: t('vectorDB.req.apiKey') }]}
          >
            <Input.Password placeholder={t('vectorDB.ph.pineconeKey')} />
          </Form.Item>
          <Form.Item
            name="environment"
            label="Environment"
            rules={[{ required: true, message: t('vectorDB.req.environment') }]}
          >
            <Input placeholder="us-west1-gcp" />
          </Form.Item>
          <Form.Item
            name="indexName"
            label="Index Name"
            rules={[{ required: true, message: t('vectorDB.req.indexName') }]}
          >
            <Input placeholder={t('vectorDB.ph.pineconeIndex')} />
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
            rules={[{ required: true, message: t('vectorDB.req.milvusEndpoint') }]}
          >
            <Input placeholder="localhost:19530" />
          </Form.Item>
          <Form.Item
            name="username"
            label="Username"
          >
            <Input placeholder={t('vectorDB.ph.usernameOptional')} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
          >
            <Input.Password placeholder={t('vectorDB.ph.passwordOptional')} />
          </Form.Item>
          <Form.Item
            name="collectionName"
            label="Collection Name"
            rules={[{ required: true, message: t('vectorDB.req.collectionName') }]}
          >
            <Input placeholder={t('vectorDB.ph.milvusCollection')} />
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
            rules={[{ required: true, message: t('vectorDB.req.esEndpoint') }]}
          >
            <Input placeholder="https://localhost:9200" />
          </Form.Item>
          <Form.Item
            name="username"
            label="Username"
          >
            <Input placeholder={t('vectorDB.ph.usernameOptional')} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
          >
            <Input.Password placeholder={t('vectorDB.ph.passwordOptional')} />
          </Form.Item>
          <Form.Item
            name="indexName"
            label="Index Name"
            rules={[{ required: true, message: t('vectorDB.req.indexName') }]}
          >
            <Input placeholder={t('vectorDB.ph.esIndex')} />
          </Form.Item>
        </>
      );
    }

    if (provider === 'custom') {
      return (
        <>
          <Form.Item
            name="endpoint"
            label={t('vectorDB.field.serviceEndpoint')}
            rules={[{ required: true, message: t('vectorDB.req.serviceEndpoint') }]}
          >
            <Input placeholder={t('vectorDB.ph.customEndpoint')} />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label={t('vectorDB.field.authKey')}
          >
            <Input.Password placeholder={t('vectorDB.ph.authKeyOptional')} />
          </Form.Item>
          <Form.Item
            name="username"
            label={t('vectorDB.field.username')}
          >
            <Input placeholder={t('vectorDB.ph.usernameIfNeeded')} />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('vectorDB.field.password')}
          >
            <Input.Password placeholder={t('vectorDB.ph.passwordIfNeeded')} />
          </Form.Item>
        </>
      );
    }

    // generic fallback for other providers
    return (
      <>
        <Form.Item
          name="endpoint"
          label={t('vectorDB.field.serviceEndpoint')}
          rules={[{ required: true, message: t('vectorDB.req.serviceEndpoint') }]}
        >
          <Input placeholder={t('vectorDB.ph.genericEndpoint')} />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label="API Key"
        >
          <Input.Password placeholder={t('vectorDB.ph.apiKeyOptional')} />
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
              {t('vectorDB.field.provider')}
              <Popover
                title={t('vectorDB.help.title')}
                content={
                  <div style={{ maxWidth: '400px', fontSize: '12px', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '8px' }}><strong>{t('vectorDB.provider.aliyun')}:</strong> {t('vectorDB.help.aliyun')}</p>
                    <p style={{ marginBottom: '8px' }}><strong>TiDB Cloud:</strong> {t('vectorDB.help.tidb')}</p>
                    <p style={{ marginBottom: '8px' }}><strong>AWS OpenSearch:</strong> {t('vectorDB.help.awsOpensearch')}</p>
                    <p style={{ marginBottom: '8px' }}><strong>AWS Bedrock:</strong> {t('vectorDB.help.awsBedrock')}</p>
                    <p style={{ marginBottom: '8px' }}><strong>Azure Cognitive Search:</strong> {t('vectorDB.help.azureSearch')}</p>
                    <p style={{ marginBottom: '8px' }}><strong>Azure Cosmos DB:</strong> {t('vectorDB.help.azureCosmos')}</p>
                    <p style={{ marginBottom: '8px' }}><strong>Google Cloud Vertex AI:</strong> {t('vectorDB.help.vertexAi')}</p>
                    <p style={{ marginBottom: '8px' }}><strong>Google Cloud Firestore:</strong> {t('vectorDB.help.firestore')}</p>
                    <p style={{ marginBottom: '8px' }}><strong>Pinecone:</strong> {t('vectorDB.help.pinecone')}</p>
                    <p style={{ marginBottom: '0' }}><strong>{t('vectorDB.help.othersTitle')}:</strong> {t('vectorDB.help.others')}</p>
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
          rules={[{ required: true, message: t('vectorDB.req.provider') }]}
        >
          <Select
            placeholder={t('vectorDB.ph.provider')}
            onChange={handleProviderChange}
          >
            <Select.Option value="aliyun">{t('vectorDB.provider.aliyun')}</Select.Option>
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
            <Select.Option value="custom">{t('vectorDB.provider.custom')}</Select.Option>
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
