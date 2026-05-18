import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Card, Button, Space, Table, Tag, Typography, Modal, Form, Input, Select,
  message, Steps, Radio, Divider, Tooltip, Badge, Progress, Popconfirm, Skeleton
} from 'antd';
import { 
  ApiOutlined, PlusOutlined, SyncOutlined, DeleteOutlined, EditOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SettingOutlined 
} from '@ant-design/icons';
import { externalKnowledgeAPI } from '../../../services/api';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Provider type definitions (labels are translated in render via t())
const providerTypes = [
  {
    key: 'dify',
    name: 'Dify',
    descKey: 'extProvider.type.dify.desc',
    icon: <ApiOutlined style={{ color: '#1677ff' }} />,
  },
  {
    key: 'ragflow',
    name: 'RAGFlow',
    descKey: 'extProvider.type.ragflow.desc',
    icon: <ApiOutlined style={{ color: '#52c41a' }} />,
  },
  {
    key: 'fastgpt',
    name: 'FastGPT',
    descKey: 'extProvider.type.fastgpt.desc',
    icon: <ApiOutlined style={{ color: '#fa8c16' }} />,
  },
  {
    key: 'custom',
    nameKey: 'extProvider.type.custom.name',
    descKey: 'extProvider.type.custom.desc',
    icon: <ApiOutlined style={{ color: '#f5222d' }} />,
  }
];

const ExternalProviders = forwardRef(({ hideCreateButton = false }: { hideCreateButton?: boolean }, ref) => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [testingProvider, setTestingProvider] = useState(null);
  const [form] = Form.useForm();

  // 显示创建/编辑模态框
  const showModal = async (provider = null) => {
    setEditingProvider(provider);
    if (provider) {
      try {
        // 获取提供商详细信息（包含API Key）
        const response = await externalKnowledgeAPI.getProviderDetail(provider.id);
        if (response.success) {
          const providerDetail = response.data;
          form.setFieldsValue({
            name: providerDetail.name,
            type: providerDetail.type,
            base_url: providerDetail.base_url,
            api_key: providerDetail.api_key
          });
        } else {
          message.error(t('extProvider.msg.fetchDetailFailed'));
          return;
        }
      } catch (error) {
        message.error(t('extProvider.msg.fetchDetailFailed'));
        console.error('fetch provider detail failed:', error);
        return;
      }
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    showModal
  }));

  // 获取提供商列表
  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await externalKnowledgeAPI.getProviders();
      if (response.success) {
        setProviders(response.data);
      } else {
        message.error(response.message || t('extProvider.msg.fetchListFailed'));
      }
    } catch (error) {
      message.error(t('extProvider.msg.fetchListFailed'));
      console.error('fetch providers failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理表单提交
  const handleSubmit = async (values) => {
    try {
      if (editingProvider) {
        const response = await externalKnowledgeAPI.updateProvider(editingProvider.id, values);
        if (response.success) {
          message.success(t('extProvider.msg.updateSuccess'));
          fetchProviders();
          setModalVisible(false);
        } else {
          message.error(response.message || t('extProvider.msg.updateFailed'));
        }
      } else {
        const response = await externalKnowledgeAPI.createProvider(values);
        if (response.success) {
          message.success(t('extProvider.msg.createSuccess'));
          fetchProviders();
          setModalVisible(false);
        } else {
          message.error(response.message || t('extProvider.msg.createFailed'));
        }
      }
    } catch (error) {
      message.error(editingProvider ? t('extProvider.msg.updateFailed') : t('extProvider.msg.createFailed'));
      console.error('submit failed:', error);
    }
  };

  // 测试连接
  const handleTestConnection = async (providerId) => {
    setTestingProvider(providerId);
    try {
      const response = await externalKnowledgeAPI.testProviderConnection(providerId);
      if (response.success) {
        message.success(t('extProvider.msg.testSuccess', { ms: response.data.response_time }));
      } else {
        message.error(response.message || t('extProvider.msg.testFailed'));
      }
    } catch (error) {
      message.error(t('extProvider.msg.testFailed'));
      console.error('test connection failed:', error);
    } finally {
      setTestingProvider(null);
    }
  };

  // 删除提供商
  const handleDelete = async (providerId) => {
    try {
      const response = await externalKnowledgeAPI.deleteProvider(providerId);
      if (response.success) {
        message.success(t('extProvider.msg.deleteSuccess'));
        fetchProviders();
      } else {
        message.error(response.message || t('extProvider.msg.deleteFailed'));
      }
    } catch (error) {
      message.error(t('extProvider.msg.deleteFailed'));
      console.error('delete failed:', error);
    }
  };

  const getProviderTypeInfo = (type) => {
    return providerTypes.find(p => p.key === type) || providerTypes[0];
  };
  const providerLabel = (p) => p.nameKey ? t(p.nameKey) : p.name;

  const columns = [
    {
      title: t('extProvider.col.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {getProviderTypeInfo(record.type).icon}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: t('extProvider.col.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color="blue">{providerLabel(getProviderTypeInfo(type))}</Tag>
      ),
    },
    {
      title: t('extProvider.col.baseUrl'),
      dataIndex: 'base_url',
      key: 'base_url',
      ellipsis: true,
    },
    {
      title: t('extProvider.col.kbCount'),
      dataIndex: 'knowledge_count',
      key: 'knowledge_count',
      render: (count) => <Badge count={count} showZero color="blue" />,
    },
    {
      title: t('extProvider.col.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: t('extProvider.col.action'),
      key: 'action',
      render: (_, record) => (
        <Space>
          <Tooltip title={t('extProvider.action.test')}>
            <Button
              type="text"
              icon={<SyncOutlined />}
              onClick={() => handleTestConnection(record.id)}
              loading={testingProvider === record.id}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title={t('extProvider.action.edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Popconfirm
            title={t('extProvider.confirm.deleteTitle')}
            description={t('extProvider.confirm.deleteDesc')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('extProvider.confirm.ok')}
            cancelText={t('extProvider.confirm.cancel')}
          >
            <Tooltip title={t('extProvider.action.delete')}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {!hideCreateButton && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
          >
            {t('extProvider.add')}
          </Button>
        </div>
      )}

      {loading ? (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {[1, 2, 3, 4].map(item => (
            <Card key={item}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          ))}
        </Space>
      ) : (
        <Table
          columns={columns}
          dataSource={providers}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('extProvider.paginationTotal', { total }),
          }}
        />
      )}

      <Modal
        title={editingProvider ? t('extProvider.edit') : t('extProvider.add')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label={t('extProvider.form.name')}
            rules={[{ required: true, message: t('extProvider.form.nameReq') }]}
          >
            <Input placeholder={t('extProvider.form.namePh')} />
          </Form.Item>

          <Form.Item
            name="type"
            label={t('extProvider.form.type')}
            rules={[{ required: true, message: t('extProvider.form.typeReq') }]}
          >
            <Select placeholder={t('extProvider.form.typePh')}>
              {providerTypes.map(type => (
                <Option key={type.key} value={type.key}>
                  <Space>
                    {type.icon}
                    <span>{providerLabel(type)}</span>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {t(type.descKey)}
                    </Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="base_url"
            label={t('extProvider.form.baseUrl')}
            rules={[
              { required: true, message: t('extProvider.form.baseUrlReq') },
              { type: 'url', message: t('extProvider.form.baseUrlInvalid') }
            ]}
          >
            <Input placeholder={t('extProvider.form.baseUrlPh')} />
          </Form.Item>

          <Form.Item
            name="api_key"
            label={t('extProvider.form.apiKey')}
            rules={[{ required: true, message: t('extProvider.form.apiKeyReq') }]}
          >
            <Input.Password
              placeholder={t('extProvider.form.apiKeyPh')}
              visibilityToggle={true}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                {t('extProvider.confirm.cancel')}
              </Button>
              <Button type="primary" htmlType="submit">
                {editingProvider ? t('extProvider.update') : t('extProvider.createBtn')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
});

export default ExternalProviders;
