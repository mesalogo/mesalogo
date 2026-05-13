import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Table, Tag, Typography, Modal, Form, Input, Select, message, Steps, Radio, Divider, Tooltip, Badge, Progress } from 'antd';
import { ApiOutlined, PlusOutlined, SyncOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, CloudSyncOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 第三方知识库源类型
const externalSourceTypes = [
  {
    key: 'dify',
    name: 'Dify知识库',
    description: 'Dify.AI是一个强大的LLM应用开发平台',
    icon: <ApiOutlined style={{ color: '#1677ff' }} />,
    fields: [
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入Dify API密钥' },
      { name: 'server_url', label: '服务器地址', required: true, placeholder: '例如: https://api.dify.ai' },
      { name: 'kb_id', label: '知识库ID', required: true, placeholder: '请输入知识库ID' }
    ]
  },
  {
    key: 'ragflow',
    name: 'RAGFlow知识库',
    description: 'RAGFlow是一个开源的检索增强生成平台',
    icon: <ApiOutlined style={{ color: '#52c41a' }} />,
    fields: [
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入RAGFlow API密钥' },
      { name: 'server_url', label: '服务器地址', required: true, placeholder: '例如: https://api.ragflow.ai' },
      { name: 'project_id', label: '项目ID', required: true, placeholder: '请输入项目ID' }
    ]
  },
  {
    key: 'langchain',
    name: 'LangChain',
    description: 'LangChain是一个用于构建LLM应用的框架',
    icon: <ApiOutlined style={{ color: '#eb2f96' }} />,
    fields: [
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入LangChain API密钥' },
      { name: 'server_url', label: '服务器地址', required: true, placeholder: '例如: https://api.langchain.com' },
      { name: 'index_id', label: '索引ID', required: true, placeholder: '请输入索引ID' }
    ]
  },
  {
    key: 'fastgpt',
    name: 'FastGPT知识库',
    description: 'FastGPT是一个基于LLM的知识库问答系统',
    icon: <ApiOutlined style={{ color: '#fa8c16' }} />,
    fields: [
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入FastGPT API密钥' },
      { name: 'team_id', label: '团队ID', required: false, placeholder: '请输入团队ID(可选)' },
      { name: 'kb_id', label: '知识库ID', required: true, placeholder: '请输入知识库ID' }
    ]
  },
  {
    key: 'custom',
    name: '自定义API',
    description: '连接到自定义知识库API',
    icon: <ApiOutlined style={{ color: '#f5222d' }} />,
    fields: [
      { name: 'api_url', label: 'API地址', required: true, placeholder: '例如: https://your-api-server.com/knowledge' },
      { name: 'api_key', label: 'API密钥', required: true, placeholder: '请输入API密钥' },
      { name: 'headers', label: '请求头(JSON)', required: false, placeholder: '{"Content-Type": "application/json"}' },
      { name: 'custom_params', label: '自定义参数(JSON)', required: false, placeholder: '{"version": "1.0"}' }
    ]
  }
];

// 模拟已连接的第三方知识库
const mockConnections = [
  {
    id: 1,
    name: 'Dify产品文档库',
    source_type: 'dify',
    description: '从Dify导入的产品文档知识库',
    status: 'connected',
    sync_mode: 'link',
    last_sync: '2023-09-15T10:30:00Z',
    document_count: 45,
    created_at: '2023-08-10T08:00:00Z'
  },
  {
    id: 2,
    name: 'RAGFlow演示知识库',
    source_type: 'ragflow',
    description: '从RAGFlow导入的演示知识库',
    status: 'syncing',
    sync_mode: 'copy',
    last_sync: '2023-09-20T14:45:00Z',
    document_count: 32,
    created_at: '2023-07-20T09:15:00Z',
    sync_progress: 65
  },
  {
    id: 3,
    name: 'FastGPT客户服务库',
    source_type: 'fastgpt',
    description: '从FastGPT导入的客户服务知识库',
    status: 'error',
    sync_mode: 'link',
    last_sync: '2023-09-18T11:20:00Z',
    document_count: 28,
    created_at: '2023-06-05T15:30:00Z',
    error_message: '连接超时，请检查API密钥是否有效'
  }
];

const ExternalIntegration = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState(0);
  const [selectedSource, setSelectedSource] = useState(null);
  const [testConnectionStatus, setTestConnectionStatus] = useState(null);
  const [importMode, setImportMode] = useState('copy');
  const [importForm] = Form.useForm();

  // 获取连接列表
  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = () => {
    setLoading(true);
    // 模拟API调用
    setTimeout(() => {
      setConnections(mockConnections);
      setLoading(false);
    }, 500);
  };

  // 打开导入模态框
  const showImportModal = () => {
    setImportStep(0);
    setSelectedSource(null);
    setTestConnectionStatus(null);
    setImportMode('copy');
    importForm.resetFields();
    setImportModalVisible(true);
  };

  // 下一步
  const handleImportNext = async () => {
    if (importStep === 0) {
      // 验证选择了有效的源
      if (!selectedSource) {
        message.error('请选择一个知识库源');
        return;
      }
      setImportStep(1);
    } else if (importStep === 1) {
      // 验证连接参数
      try {
        await importForm.validateFields();
        setImportStep(2);
      } catch (error) {
        // 表单验证失败
        return;
      }
    }
  };

  // 上一步
  const handleImportPrev = () => {
    setImportStep(importStep - 1);
  };

  // 测试连接
  const handleTestConnection = async () => {
    try {
      await importForm.validateFields();
      const values = importForm.getFieldsValue();

      // 显示测试中状态
      setTestConnectionStatus('testing');

      // 模拟API调用
      setTimeout(() => {
        // 90%概率连接成功
        if (Math.random() < 0.9) {
          setTestConnectionStatus('success');
          message.success('连接成功');
        } else {
          setTestConnectionStatus('failed');
          message.error('连接失败，请检查参数');
        }
      }, 1500);
    } catch (error) {
      message.error('请先完成所有必填字段');
    }
  };

  // 完成导入
  const handleFinishImport = async () => {
    try {
      // 获取表单数据
      const connectionValues = importForm.getFieldsValue();

      // 构建导入数据
      const importData = {
        name: connectionValues.name,
        description: connectionValues.description || `从${selectedSource.name}导入的知识库`,
        source_type: selectedSource.key,
        sync_mode: importMode,
        // 去除name和description，保留连接参数
        external_config: Object.keys(connectionValues)
          .filter(key => key !== 'name' && key !== 'description')
          .reduce((obj, key) => {
            obj[key] = connectionValues[key];
            return obj;
          }, {})
      };

      // 模拟导入API调用
      message.loading('正在导入知识库...', 2.5)
        .then(() => {
          // 添加新连接到列表
          const newConnection = {
            id: Date.now(),
            name: importData.name,
            description: importData.description,
            source_type: importData.source_type,
            status: 'connected',
            sync_mode: importData.sync_mode,
            last_sync: new Date().toISOString(),
            document_count: Math.floor(Math.random() * 50) + 10,
            created_at: new Date().toISOString()
          };

          setConnections([newConnection, ...connections]);

          // 关闭模态框并重置状态
          setImportModalVisible(false);
          setImportStep(0);
          setSelectedSource(null);
          setTestConnectionStatus(null);
          importForm.resetFields();

          message.success('知识库导入成功');
        });
    } catch (error) {
      message.error('导入失败: ' + (error.message || '未知错误'));
    }
  };

  // 处理同步
  const handleSync = (id) => {
    // 更新状态为同步中
    setConnections(connections.map(conn =>
      conn.id === id ? { ...conn, status: 'syncing', sync_progress: 0 } : conn
    ));

    // 模拟同步进度
    let progress = 0;
    const timer = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
        clearInterval(timer);
        setConnections(connections.map(conn =>
          conn.id === id ? {
            ...conn,
            status: 'connected',
            last_sync: new Date().toISOString(),
            document_count: conn.document_count + Math.floor(Math.random() * 5)
          } : conn
        ));
        message.success('同步完成');
      } else {
        setConnections(connections.map(conn =>
          conn.id === id ? { ...conn, sync_progress: progress } : conn
        ));
      }
    }, 500);
  };

  // 处理删除连接
  const handleDelete = (id) => {
    setConnections(connections.filter(conn => conn.id !== id));
    message.success('连接已删除');
  };

  // 渲染步骤1: 选择知识库源
  const renderSourceSelection = () => {
    return (
      <div>
        <Paragraph>
          请选择要导入的第三方知识库平台。导入后，您可以将它们绑定到角色并用于智能体交互。
        </Paragraph>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '20px' }}>
          {externalSourceTypes.map(source => (
            <Card
              key={source.key}
              hoverable
              style={{
                width: 220,
                borderColor: selectedSource?.key === source.key ? '#1677ff' : undefined,
                backgroundColor: selectedSource?.key === source.key ? 'var(--tree-selected-bg)' : undefined
              }}
              onClick={() => setSelectedSource(source)}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                {source.icon}
                <Title level={5} style={{ marginLeft: '8px', marginBottom: 0 }}>{source.name}</Title>
              </div>
              <Text type="secondary">{source.description}</Text>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // 渲染步骤2: 配置连接参数
  const renderConnectionConfig = () => {
    if (!selectedSource) return null;

    return (
      <div>
        <Paragraph>
          请配置连接到 <Text strong>{selectedSource.name}</Text> 所需的参数。
        </Paragraph>

        <Form
          form={importForm}
          layout="vertical"
          style={{ marginTop: '20px' }}
        >
          <Form.Item
            name="name"
            label="知识库名称"
            rules={[{ required: true, message: '请输入导入后的知识库名称' }]}
          >
            <Input placeholder="请输入导入后的知识库名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea
              rows={2}
              placeholder={`从${selectedSource.name}导入的知识库`}
            />
          </Form.Item>

          <Divider />

          {selectedSource.fields.map(field => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
            >
              <Input.Password
                placeholder={field.placeholder}
                visibilityToggle={true}
              />
            </Form.Item>
          ))}

          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <Button
              onClick={handleTestConnection}
              loading={testConnectionStatus === 'testing'}
            >
              测试连接
            </Button>

            {testConnectionStatus === 'success' && (
              <Text type="success" style={{ marginLeft: '8px' }}>
                <CheckCircleOutlined /> 连接成功
              </Text>
            )}

            {testConnectionStatus === 'failed' && (
              <Text type="danger" style={{ marginLeft: '8px' }}>
                <CloseCircleOutlined /> 连接失败
              </Text>
            )}
          </div>
        </Form>
      </div>
    );
  };

  // 渲染步骤3: 导入选项
  const renderImportOptions = () => {
    return (
      <div>
        <Paragraph>
          请选择知识库导入方式和同步设置。
        </Paragraph>

        <div style={{ marginTop: '20px' }}>
          <Title level={5}>导入方式</Title>
          <Radio.Group
            value={importMode}
            onChange={e => setImportMode(e.target.value)}
            style={{ marginTop: '8px' }}
          >
            <Space orientation="vertical">
              <Radio value="copy">
                <div>
                  <Text strong>复制内容 (推荐)</Text>
                  <div><Text type="secondary">将内容复制到本地知识库中，不依赖外部系统</Text></div>
                </div>
              </Radio>
              <Radio value="link">
                <div>
                  <Text strong>保持连接</Text>
                  <div><Text type="secondary">实时连接到外部知识库，保持数据同步但依赖外部系统</Text></div>
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        <div style={{ marginTop: '24px' }}>
          <Title level={5}>同步设置</Title>
          <Form.Item>
            <Radio.Group defaultValue="manual">
              <Space orientation="vertical">
                <Radio value="manual">
                  <div>
                    <Text strong>手动同步</Text>
                    <div><Text type="secondary">需要手动触发同步操作</Text></div>
                  </div>
                </Radio>
                <Radio value="daily">
                  <div>
                    <Text strong>每日自动同步</Text>
                    <div><Text type="secondary">每天自动同步一次</Text></div>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </div>
      </div>
    );
  };

  // 导入模态框
  const renderImportModal = () => {
    const steps = [
      { title: '选择来源', content: renderSourceSelection() },
      { title: '配置连接', content: renderConnectionConfig() },
      { title: '导入选项', content: renderImportOptions() }
    ];

    return (
      <Modal
        title="导入第三方知识库"
        open={importModalVisible}
        width={720}
        onCancel={() => setImportModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setImportModalVisible(false)}>
            取消
          </Button>,
          importStep > 0 && (
            <Button key="back" onClick={handleImportPrev}>
              上一步
            </Button>
          ),
          importStep < steps.length - 1 ? (
            <Button key="next" type="primary" onClick={handleImportNext}>
              下一步
            </Button>
          ) : (
            <Button key="finish" type="primary" onClick={handleFinishImport}>
              完成导入
            </Button>
          )
        ]}
      >
        <Steps 
          current={importStep} 
          style={{ marginBottom: '24px' }}
          items={steps.map((item: any) => ({
            key: item.title,
            title: item.title
          }))}
        />

        <div>
          {steps[importStep].content}
        </div>
      </Modal>
    );
  };

  // 获取源类型图标
  const getSourceIcon = (type) => {
    const source = externalSourceTypes.find(s => s.key === type);
    return source ? source.icon : <ApiOutlined />;
  };

  // 获取源类型名称
  const getSourceName = (type) => {
    const source = externalSourceTypes.find(s => s.key === type);
    return source ? source.name : type;
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {getSourceIcon(record.source_type)}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source_type',
      key: 'source_type',
      render: (type) => getSourceName(type),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '同步模式',
      dataIndex: 'sync_mode',
      key: 'sync_mode',
      render: (mode) => (
        <Tag color={mode === 'copy' ? 'blue' : 'green'}>
          {mode === 'copy' ? '复制内容' : '保持连接'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        if (status === 'connected') {
          return <Badge status="success" text="已连接" />;
        } else if (status === 'syncing') {
          return (
            <div>
              <Badge status="processing" text="同步中" />
              <div style={{ width: 80, marginTop: 5 }}>
                <Progress percent={record.sync_progress} />
              </div>
            </div>
          );
        } else if (status === 'error') {
          return (
            <Tooltip title={record.error_message}>
              <Badge status="error" text="错误" />
            </Tooltip>
          );
        }
        return <Badge status="default" text="未知" />;
      },
    },
    {
      title: '文档数',
      dataIndex: 'document_count',
      key: 'document_count',
    },
    {
      title: '最后同步',
      dataIndex: 'last_sync',
      key: 'last_sync',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<SyncOutlined />}
            onClick={() => handleSync(record.id)}
            disabled={record.status === 'syncing'}
            style={{ color: '#1677ff' }}
          >
            同步
          </Button>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => message.info('设置功能开发中')}
            style={{ color: '#1677ff' }}
          >
            设置
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <Title level={5}>第三方知识库集成</Title>
          <Text type="secondary">管理与外部知识库系统的连接，支持多种知识库平台</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={showImportModal}
        >
          添加连接
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={connections}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个连接`,
        }}
      />

      {renderImportModal()}
    </div>
  );
};

export default ExternalIntegration;
