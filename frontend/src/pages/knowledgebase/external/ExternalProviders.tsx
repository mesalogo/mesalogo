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

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 支持的提供商类型
const providerTypes = [
  {
    key: 'dify',
    name: 'Dify',
    description: 'Dify.AI是一个强大的LLM应用开发平台',
    icon: <ApiOutlined style={{ color: '#1677ff' }} />,
    fields: [
      { name: 'base_url', label: '服务器地址', required: true, placeholder: '例如: https://api.dify.ai' },
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入Dify API密钥' }
    ]
  },
  {
    key: 'ragflow',
    name: 'RAGFlow',
    description: 'RAGFlow是一个开源的检索增强生成平台',
    icon: <ApiOutlined style={{ color: '#52c41a' }} />,
    fields: [
      { name: 'base_url', label: '服务器地址', required: true, placeholder: '例如: https://api.ragflow.ai' },
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入RAGFlow API密钥' }
    ]
  },
  {
    key: 'fastgpt',
    name: 'FastGPT',
    description: 'FastGPT是一个基于LLM的知识库问答系统',
    icon: <ApiOutlined style={{ color: '#fa8c16' }} />,
    fields: [
      { name: 'base_url', label: '服务器地址', required: true, placeholder: '例如: https://fastgpt.run' },
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入FastGPT API密钥' }
    ]
  },
  {
    key: 'custom',
    name: '自定义API',
    description: '连接到自定义知识库API',
    icon: <ApiOutlined style={{ color: '#f5222d' }} />,
    fields: [
      { name: 'base_url', label: 'API地址', required: true, placeholder: '例如: https://your-api-server.com' },
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入API密钥' }
    ]
  }
];

const ExternalProviders = forwardRef(({ hideCreateButton = false }: { hideCreateButton?: boolean }, ref) => {
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
          message.error('获取提供商详情失败');
          return;
        }
      } catch (error) {
        message.error('获取提供商详情失败');
        console.error('获取提供商详情失败:', error);
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
        message.error(response.message || '获取提供商列表失败');
      }
    } catch (error) {
      message.error('获取提供商列表失败');
      console.error('获取提供商列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理表单提交
  const handleSubmit = async (values) => {
    try {
      if (editingProvider) {
        // 更新提供商
        const response = await externalKnowledgeAPI.updateProvider(editingProvider.id, values);
        if (response.success) {
          message.success('提供商更新成功');
          fetchProviders();
          setModalVisible(false);
        } else {
          message.error(response.message || '更新失败');
        }
      } else {
        // 创建提供商
        const response = await externalKnowledgeAPI.createProvider(values);
        if (response.success) {
          message.success('提供商创建成功');
          fetchProviders();
          setModalVisible(false);
        } else {
          message.error(response.message || '创建失败');
        }
      }
    } catch (error) {
      message.error(editingProvider ? '更新失败' : '创建失败');
      console.error('提交失败:', error);
    }
  };

  // 测试连接
  const handleTestConnection = async (providerId) => {
    setTestingProvider(providerId);
    try {
      const response = await externalKnowledgeAPI.testProviderConnection(providerId);
      if (response.success) {
        message.success(`连接测试成功 (响应时间: ${response.data.response_time}ms)`);
      } else {
        message.error(response.message || '连接测试失败');
      }
    } catch (error) {
      message.error('连接测试失败');
      console.error('连接测试失败:', error);
    } finally {
      setTestingProvider(null);
    }
  };

  // 删除提供商
  const handleDelete = async (providerId) => {
    try {
      const response = await externalKnowledgeAPI.deleteProvider(providerId);
      if (response.success) {
        message.success('提供商删除成功');
        fetchProviders();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
      console.error('删除失败:', error);
    }
  };

  // 获取提供商类型信息
  const getProviderTypeInfo = (type) => {
    return providerTypes.find(p => p.key === type) || providerTypes[0];
  };

  const columns = [
    {
      title: '名称',
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color="blue">{getProviderTypeInfo(type).name}</Tag>
      ),
    },
    {
      title: '服务器地址',
      dataIndex: 'base_url',
      key: 'base_url',
      ellipsis: true,
    },
    {
      title: '知识库数量',
      dataIndex: 'knowledge_count',
      key: 'knowledge_count',
      render: (count) => <Badge count={count} showZero color="blue" />,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={<SyncOutlined />}
              onClick={() => handleTestConnection(record.id)}
              loading={testingProvider === record.id}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showModal(record)}
              style={{ color: '#1677ff' }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个提供商吗？"
            description="删除后将无法恢复，且会影响相关的外部知识库。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
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
            添加提供商
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
            showTotal: (total) => `共 ${total} 个提供商`,
          }}
        />
      )}

      <Modal
        title={editingProvider ? '编辑提供商' : '添加提供商'}
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
            label="提供商名称"
            rules={[{ required: true, message: '请输入提供商名称' }]}
          >
            <Input placeholder="请输入提供商名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="提供商类型"
            rules={[{ required: true, message: '请选择提供商类型' }]}
          >
            <Select placeholder="请选择提供商类型">
              {providerTypes.map(type => (
                <Option key={type.key} value={type.key}>
                  <Space>
                    {type.icon}
                    <span>{type.name}</span>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {type.description}
                    </Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="base_url"
            label="服务器地址"
            rules={[
              { required: true, message: '请输入服务器地址' },
              { type: 'url', message: '请输入有效的URL地址' }
            ]}
          >
            <Input placeholder="例如: https://api.dify.ai" />
          </Form.Item>

          <Form.Item
            name="api_key"
            label="API密钥"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input.Password
              placeholder="请输入API密钥"
              visibilityToggle={true}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingProvider ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
});

export default ExternalProviders;
