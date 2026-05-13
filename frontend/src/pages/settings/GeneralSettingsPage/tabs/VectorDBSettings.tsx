import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Switch, Button, Space, Tooltip, Divider, App } from 'antd';
import {
  DatabaseOutlined,
  ApiOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../../services/api/settings';

const VectorDBSettings = ({
  color,
  useBuiltinVectorDB,
  setUseBuiltinVectorDB,
  handleOpenVectorDBConfigModal,
  handleTestVectorDBConnectionWithSteps,
  testConnectionLoading,
  initialValues
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [builtinTestLoading, setBuiltinTestLoading] = useState(false);

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        use_builtin_vector_db: initialValues.use_builtin_vector_db !== undefined ? initialValues.use_builtin_vector_db : true,
        vector_db_provider: initialValues.vector_db_provider || 'aliyun',
        builtin_vector_db_host: initialValues.builtin_vector_db_host || 'localhost',
        builtin_vector_db_port: initialValues.builtin_vector_db_port || 19530
      });
    }
  }, [initialValues, form]);

  const renderLabel = (icon, label, tooltip) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ color, marginRight: '8px', fontSize: '14px' }}>
        {icon}
      </span>
      <span style={{ fontSize: '14px', fontWeight: '500' }}>
        {label}
      </span>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined
          style={{
            marginLeft: '6px',
            color: 'var(--custom-text-secondary)',
            fontSize: '12px'
          }}
        />
      </Tooltip>
    </div>
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 只保存向量数据库相关的字段
      await settingsAPI.updateSettings({
        use_builtin_vector_db: values.use_builtin_vector_db,
        vector_db_provider: values.vector_db_provider,
        builtin_vector_db_host: values.builtin_vector_db_host,
        builtin_vector_db_port: values.builtin_vector_db_port
      });

      message.success(t('settings.saveSuccess'));
      setLoading(false);
    } catch (error) {
      console.error('Save vector DB settings failed:', error);
      if (error.errorFields) {
        message.error(t('message.validationFailed'));
      } else {
        message.error(t('message.operationFailed') + ': ' + (error.message || t('message.unknownError')));
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (initialValues) {
      form.setFieldsValue({
        use_builtin_vector_db: initialValues.use_builtin_vector_db !== undefined ? initialValues.use_builtin_vector_db : true,
        vector_db_provider: initialValues.vector_db_provider || 'aliyun',
        builtin_vector_db_host: initialValues.builtin_vector_db_host || 'localhost',
        builtin_vector_db_port: initialValues.builtin_vector_db_port || 19530
      });
      message.success(t('settings.resetSuccess'));
    }
  };

  const handleTestBuiltinConnection = async () => {
    try {
      const values = await form.validateFields(['builtin_vector_db_host', 'builtin_vector_db_port']);
      
      setBuiltinTestLoading(true);
      
      // 构建Milvus配置
      const milvusConfig = {
        endpoint: `${values.builtin_vector_db_host}:${values.builtin_vector_db_port}`
      };
      
      // 调用通用的向量数据库测试API
      const { vectorDatabaseAPI } = await import('../../../../services/api/vectorDatabase');
      const result = await vectorDatabaseAPI.testConnection('milvus', milvusConfig);
      
      if (result.success) {
        message.success(`内置数据库连接测试成功！${result.message}`);
      } else {
        message.error(`内置数据库连接测试失败: ${result.message}`);
      }
    } catch (error) {
      console.error('测试内置数据库连接失败:', error);
      if (error.errorFields) {
        message.error('请先填写完整的连接信息');
      } else {
        message.error(`测试失败: ${error.message || '未知错误'}`);
      }
    } finally {
      setBuiltinTestLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Form.Item
          name="use_builtin_vector_db"
          label={renderLabel(
            <DatabaseOutlined />,
            t('settings.useBuiltinVectorDB'),
            '使用内置向量数据库（Milvus），默认连接 localhost:19530。⚠️ 建议不要修改内置数据库的地址和端口配置，除非你知道自己在做什么。'
          )}
          valuePropName="checked"
          style={{ marginBottom: '16px' }}
        >
          <Switch onChange={setUseBuiltinVectorDB} />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.use_builtin_vector_db !== currentValues.use_builtin_vector_db
          }
        >
          {() => {
            const useBuiltin = form.getFieldValue('use_builtin_vector_db');
            if (!useBuiltin) return null;
            
            return (
              <>
                <Form.Item
                  name="builtin_vector_db_host"
                  label={renderLabel(
                    <ApiOutlined />,
                    '内置数据库地址',
                    'Milvus向量数据库地址'
                  )}
                  style={{ marginBottom: '16px' }}
                >
                  <Input
                    placeholder="localhost"
          
                  />
                </Form.Item>

                <Form.Item
                  name="builtin_vector_db_port"
                  label={renderLabel(
                    <ApiOutlined />,
                    '内置数据库端口',
                    'Milvus向量数据库端口'
                  )}
                  style={{ marginBottom: '16px' }}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </>
            );
          }}
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.use_builtin_vector_db !== currentValues.use_builtin_vector_db
          }
        >
          {() => {
            const useBuiltin = form.getFieldValue('use_builtin_vector_db');
            if (useBuiltin) return null;
            
            return (
              <Form.Item
                name="vector_db_provider"
                label={renderLabel(
                  <ApiOutlined />,
                  t('settings.vectorDBProvider'),
                  t('settings.vectorDBProvider.tooltip')
                )}
                style={{ marginBottom: '16px' }}
              >
                <Select
                  placeholder="选择向量数据库提供商"
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input: any, option: any) =>
                    String(option.label).toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
        
                  disabled={useBuiltinVectorDB}
                >
                  <Select.Option value="aliyun" label="阿里云 DashVector">
                    阿里云 DashVector
                  </Select.Option>
                  <Select.Option value="tidb" label="TiDB Cloud">
                    TiDB Cloud
                  </Select.Option>
                  <Select.Option value="aws-opensearch" label="AWS OpenSearch">
                    AWS OpenSearch
                  </Select.Option>
                  <Select.Option value="aws-bedrock" label="AWS Bedrock Knowledge Base">
                    AWS Bedrock Knowledge Base
                  </Select.Option>
                  <Select.Option value="azure-cognitive-search" label="Azure Cognitive Search">
                    Azure Cognitive Search
                  </Select.Option>
                  <Select.Option value="azure-cosmos-db" label="Azure Cosmos DB">
                    Azure Cosmos DB
                  </Select.Option>
                  <Select.Option value="gcp-vertex-ai" label="Google Cloud Vertex AI Vector Search">
                    Google Cloud Vertex AI Vector Search
                  </Select.Option>
                  <Select.Option value="gcp-firestore" label="Google Cloud Firestore">
                    Google Cloud Firestore
                  </Select.Option>
                  <Select.Option value="pinecone" label="Pinecone">
                    Pinecone
                  </Select.Option>
                  <Select.Option value="weaviate" label="Weaviate">
                    Weaviate
                  </Select.Option>
                  <Select.Option value="qdrant" label="Qdrant">
                    Qdrant
                  </Select.Option>
                  <Select.Option value="chroma" label="Chroma">
                    Chroma
                  </Select.Option>
                  <Select.Option value="milvus" label="Milvus">
                    Milvus
                  </Select.Option>
                  <Select.Option value="elasticsearch" label="Elasticsearch">
                    Elasticsearch
                  </Select.Option>
                  <Select.Option value="custom" label="自定义">
                    自定义
                  </Select.Option>
                </Select>
              </Form.Item>
            );
          }}
        </Form.Item>
      </Space>

      <Divider />

      {/* 配置和测试按钮区域 */}
      <div style={{ marginBottom: '24px' }}>
        <Space>
          {useBuiltinVectorDB ? (
            // 内置数据库：显示测试连接按钮
            <Button
              type="default"
              icon={<ApiOutlined />}
              onClick={handleTestBuiltinConnection}
              loading={builtinTestLoading}
            >
              {builtinTestLoading ? t('settings.testing') : '测试连接'}
            </Button>
          ) : (
            // 外部数据库：显示配置和测试按钮
            <>
              <Button
                type="default"
                icon={<SettingOutlined />}
                onClick={handleOpenVectorDBConfigModal}
              >
                {t('settings.configureVectorDB')}
              </Button>

              <Button
                type="default"
                icon={<ApiOutlined />}
                onClick={handleTestVectorDBConnectionWithSteps}
                loading={testConnectionLoading}
              >
                {testConnectionLoading ? t('settings.testing') : t('settings.testConnection')}
              </Button>
            </>
          )}
        </Space>
      </div>

      <Divider />

      {/* 保存和重置按钮区域 */}
      <Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={loading}

        >
          {t('settings.save')}
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleReset}

        >
          {t('settings.reset')}
        </Button>
      </Space>
    </Form>
  );
};

export default VectorDBSettings;

