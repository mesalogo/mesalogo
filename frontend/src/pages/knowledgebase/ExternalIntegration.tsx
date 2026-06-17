import React, { useState, useEffect } from 'react';
import { App, Card, Button, Space, Table, Tag, Typography, Modal, Form, Input, Select, Steps, Radio, Divider, Tooltip, Badge, Progress } from 'antd';
import { ApiOutlined, PlusOutlined, SyncOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, CloudSyncOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// helper to build externalSourceTypes with i18n; called per-render so t() is live
const buildExternalSourceTypes = (t) => [
  {
    key: 'dify',
    name: t('extIntegration.source.difyName'),
    description: t('extIntegration.source.difyDesc'),
    icon: <ApiOutlined style={{ color: '#1677ff' }} />,
    fields: [
      { name: 'api_key', label: t('extIntegration.field.apiKey'), required: true, placeholder: t('extIntegration.ph.difyKey') },
      { name: 'server_url', label: t('extIntegration.field.serverUrl'), required: true, placeholder: t('extIntegration.ph.difyServer') },
      { name: 'kb_id', label: t('extIntegration.field.kbId'), required: true, placeholder: t('extIntegration.ph.kbId') }
    ]
  },
  {
    key: 'ragflow',
    name: t('extIntegration.source.ragflowName'),
    description: t('extIntegration.source.ragflowDesc'),
    icon: <ApiOutlined style={{ color: '#52c41a' }} />,
    fields: [
      { name: 'api_key', label: t('extIntegration.field.apiKey'), required: true, placeholder: t('extIntegration.ph.ragflowKey') },
      { name: 'server_url', label: t('extIntegration.field.serverUrl'), required: true, placeholder: t('extIntegration.ph.ragflowServer') },
      { name: 'project_id', label: t('extIntegration.field.projectId'), required: true, placeholder: t('extIntegration.ph.projectId') }
    ]
  },
  {
    key: 'langchain',
    name: 'LangChain',
    description: t('extIntegration.source.langchainDesc'),
    icon: <ApiOutlined style={{ color: '#eb2f96' }} />,
    fields: [
      { name: 'api_key', label: t('extIntegration.field.apiKey'), required: true, placeholder: t('extIntegration.ph.langchainKey') },
      { name: 'server_url', label: t('extIntegration.field.serverUrl'), required: true, placeholder: t('extIntegration.ph.langchainServer') },
      { name: 'index_id', label: t('extIntegration.field.indexId'), required: true, placeholder: t('extIntegration.ph.indexId') }
    ]
  },
  {
    key: 'fastgpt',
    name: t('extIntegration.source.fastgptName'),
    description: t('extIntegration.source.fastgptDesc'),
    icon: <ApiOutlined style={{ color: '#fa8c16' }} />,
    fields: [
      { name: 'api_key', label: t('extIntegration.field.apiKey'), required: true, placeholder: t('extIntegration.ph.fastgptKey') },
      { name: 'team_id', label: t('extIntegration.field.teamId'), required: false, placeholder: t('extIntegration.ph.teamId') },
      { name: 'kb_id', label: t('extIntegration.field.kbId'), required: true, placeholder: t('extIntegration.ph.kbId') }
    ]
  },
  {
    key: 'custom',
    name: t('extIntegration.source.customName'),
    description: t('extIntegration.source.customDesc'),
    icon: <ApiOutlined style={{ color: '#f5222d' }} />,
    fields: [
      { name: 'api_url', label: t('extIntegration.field.apiUrl'), required: true, placeholder: t('extIntegration.ph.customUrl') },
      { name: 'api_key', label: t('extIntegration.field.apiKey'), required: true, placeholder: t('extIntegration.ph.customKey') },
      { name: 'headers', label: t('extIntegration.field.headers'), required: false, placeholder: '{"Content-Type": "application/json"}' },
      { name: 'custom_params', label: t('extIntegration.field.customParams'), required: false, placeholder: '{"version": "1.0"}' }
    ]
  }
];

// mock demo data — kept in English so it doesn't violate the no-hardcoded-CJK rule
const mockConnections = [
  {
    id: 1,
    name: 'Dify product docs',
    source_type: 'dify',
    description: 'Knowledge base imported from Dify (product docs)',
    status: 'connected',
    sync_mode: 'link',
    last_sync: '2023-09-15T10:30:00Z',
    document_count: 45,
    created_at: '2023-08-10T08:00:00Z'
  },
  {
    id: 2,
    name: 'RAGFlow demo KB',
    source_type: 'ragflow',
    description: 'Demo knowledge base imported from RAGFlow',
    status: 'syncing',
    sync_mode: 'copy',
    last_sync: '2023-09-20T14:45:00Z',
    document_count: 32,
    created_at: '2023-07-20T09:15:00Z',
    sync_progress: 65
  },
  {
    id: 3,
    name: 'FastGPT customer service',
    source_type: 'fastgpt',
    description: 'Customer-service knowledge base imported from FastGPT',
    status: 'error',
    sync_mode: 'link',
    last_sync: '2023-09-18T11:20:00Z',
    document_count: 28,
    created_at: '2023-06-05T15:30:00Z',
    error_message: 'Connection timed out — check whether the API key is valid'
  }
];

const ExternalIntegration = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const externalSourceTypes = buildExternalSourceTypes(t);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState(0);
  const [selectedSource, setSelectedSource] = useState(null);
  const [testConnectionStatus, setTestConnectionStatus] = useState(null);
  const [importMode, setImportMode] = useState('copy');
  const [importForm] = Form.useForm();

  // load connections on mount
  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = () => {
    setLoading(true);
    // mock API call
    setTimeout(() => {
      setConnections(mockConnections);
      setLoading(false);
    }, 500);
  };

  // open import modal
  const showImportModal = () => {
    setImportStep(0);
    setSelectedSource(null);
    setTestConnectionStatus(null);
    setImportMode('copy');
    importForm.resetFields();
    setImportModalVisible(true);
  };

  // next step
  const handleImportNext = async () => {
    if (importStep === 0) {
      if (!selectedSource) {
        message.error(t('extIntegration.msg.selectSource'));
        return;
      }
      setImportStep(1);
    } else if (importStep === 1) {
      try {
        await importForm.validateFields();
        setImportStep(2);
      } catch (error) {
        // form validation failed
        return;
      }
    }
  };

  // previous step
  const handleImportPrev = () => {
    setImportStep(importStep - 1);
  };

  // test connection
  const handleTestConnection = async () => {
    try {
      await importForm.validateFields();
      const values = importForm.getFieldsValue();

      setTestConnectionStatus('testing');

      // mock API call
      setTimeout(() => {
        // 90% success rate
        if (Math.random() < 0.9) {
          setTestConnectionStatus('success');
          message.success(t('extIntegration.msg.connectSuccess'));
        } else {
          setTestConnectionStatus('failed');
          message.error(t('extIntegration.msg.connectFailedCheck'));
        }
      }, 1500);
    } catch (error) {
      message.error(t('extIntegration.msg.fillRequired'));
    }
  };

  // finish import
  const handleFinishImport = async () => {
    try {
      const connectionValues = importForm.getFieldsValue();

      const importData = {
        name: connectionValues.name,
        description: connectionValues.description || t('extIntegration.defaultDesc', { source: selectedSource.name }),
        source_type: selectedSource.key,
        sync_mode: importMode,
        // strip name/description, keep connection params
        external_config: Object.keys(connectionValues)
          .filter(key => key !== 'name' && key !== 'description')
          .reduce((obj, key) => {
            obj[key] = connectionValues[key];
            return obj;
          }, {})
      };

      // mock import API call
      message.loading(t('extIntegration.msg.importing'), 2.5)
        .then(() => {
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

          setImportModalVisible(false);
          setImportStep(0);
          setSelectedSource(null);
          setTestConnectionStatus(null);
          importForm.resetFields();

          message.success(t('extIntegration.msg.importSuccess'));
        });
    } catch (error) {
      message.error(t('extIntegration.msg.importFailed') + ': ' + (error.message || t('extIntegration.msg.unknownError')));
    }
  };

  // sync handler
  const handleSync = (id) => {
    setConnections(connections.map(conn =>
      conn.id === id ? { ...conn, status: 'syncing', sync_progress: 0 } : conn
    ));

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
        message.success(t('extIntegration.msg.syncDone'));
      } else {
        setConnections(connections.map(conn =>
          conn.id === id ? { ...conn, sync_progress: progress } : conn
        ));
      }
    }, 500);
  };

  // delete connection
  const handleDelete = (id) => {
    setConnections(connections.filter(conn => conn.id !== id));
    message.success(t('extIntegration.msg.deleted'));
  };

  // step 1: choose source
  const renderSourceSelection = () => {
    return (
      <div>
        <Paragraph>
          {t('extIntegration.step1.intro')}
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

  // step 2: connection config
  const renderConnectionConfig = () => {
    if (!selectedSource) return null;

    return (
      <div>
        <Paragraph>
          {t('extIntegration.step2.introBefore')} <Text strong>{selectedSource.name}</Text> {t('extIntegration.step2.introAfter')}
        </Paragraph>

        <Form
          form={importForm}
          layout="vertical"
          style={{ marginTop: '20px' }}
        >
          <Form.Item
            name="name"
            label={t('extIntegration.field.kbName')}
            rules={[{ required: true, message: t('extIntegration.req.kbName') }]}
          >
            <Input placeholder={t('extIntegration.req.kbName')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('extIntegration.field.description')}
          >
            <TextArea
              rows={2}
              placeholder={t('extIntegration.defaultDesc', { source: selectedSource.name })}
            />
          </Form.Item>

          <Divider />

          {selectedSource.fields.map(field => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: t('extIntegration.req.generic', { label: field.label }) }] : []}
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
              {t('extIntegration.testConnection')}
            </Button>

            {testConnectionStatus === 'success' && (
              <Text type="success" style={{ marginLeft: '8px' }}>
                <CheckCircleOutlined /> {t('extIntegration.msg.connectSuccess')}
              </Text>
            )}

            {testConnectionStatus === 'failed' && (
              <Text type="danger" style={{ marginLeft: '8px' }}>
                <CloseCircleOutlined /> {t('extIntegration.msg.connectFailed')}
              </Text>
            )}
          </div>
        </Form>
      </div>
    );
  };

  // step 3: import options
  const renderImportOptions = () => {
    return (
      <div>
        <Paragraph>
          {t('extIntegration.step3.intro')}
        </Paragraph>

        <div style={{ marginTop: '20px' }}>
          <Title level={5}>{t('extIntegration.step3.importMode')}</Title>
          <Radio.Group
            value={importMode}
            onChange={e => setImportMode(e.target.value)}
            style={{ marginTop: '8px' }}
          >
            <Space orientation="vertical">
              <Radio value="copy">
                <div>
                  <Text strong>{t('extIntegration.mode.copyTitle')}</Text>
                  <div><Text type="secondary">{t('extIntegration.mode.copyDesc')}</Text></div>
                </div>
              </Radio>
              <Radio value="link">
                <div>
                  <Text strong>{t('extIntegration.mode.linkTitle')}</Text>
                  <div><Text type="secondary">{t('extIntegration.mode.linkDesc')}</Text></div>
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        <div style={{ marginTop: '24px' }}>
          <Title level={5}>{t('extIntegration.step3.syncSettings')}</Title>
          <Form.Item>
            <Radio.Group defaultValue="manual">
              <Space orientation="vertical">
                <Radio value="manual">
                  <div>
                    <Text strong>{t('extIntegration.sync.manualTitle')}</Text>
                    <div><Text type="secondary">{t('extIntegration.sync.manualDesc')}</Text></div>
                  </div>
                </Radio>
                <Radio value="daily">
                  <div>
                    <Text strong>{t('extIntegration.sync.dailyTitle')}</Text>
                    <div><Text type="secondary">{t('extIntegration.sync.dailyDesc')}</Text></div>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </div>
      </div>
    );
  };

  // import modal
  const renderImportModal = () => {
    const steps = [
      { title: t('extIntegration.step.chooseSource'), content: renderSourceSelection() },
      { title: t('extIntegration.step.configure'), content: renderConnectionConfig() },
      { title: t('extIntegration.step.options'), content: renderImportOptions() }
    ];

    return (
      <Modal
        title={t('extIntegration.modalTitle')}
        open={importModalVisible}
        width={720}
        onCancel={() => setImportModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setImportModalVisible(false)}>
            {t('extIntegration.cancel')}
          </Button>,
          importStep > 0 && (
            <Button key="back" onClick={handleImportPrev}>
              {t('extIntegration.prev')}
            </Button>
          ),
          importStep < steps.length - 1 ? (
            <Button key="next" type="primary" onClick={handleImportNext}>
              {t('extIntegration.next')}
            </Button>
          ) : (
            <Button key="finish" type="primary" onClick={handleFinishImport}>
              {t('extIntegration.finishImport')}
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

  const getSourceIcon = (type) => {
    const source = externalSourceTypes.find(s => s.key === type);
    return source ? source.icon : <ApiOutlined />;
  };

  const getSourceName = (type) => {
    const source = externalSourceTypes.find(s => s.key === type);
    return source ? source.name : type;
  };

  const columns = [
    {
      title: t('extIntegration.col.name'),
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
      title: t('extIntegration.col.source'),
      dataIndex: 'source_type',
      key: 'source_type',
      render: (type) => getSourceName(type),
    },
    {
      title: t('extIntegration.col.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('extIntegration.col.syncMode'),
      dataIndex: 'sync_mode',
      key: 'sync_mode',
      render: (mode) => (
        <Tag color={mode === 'copy' ? 'blue' : 'green'}>
          {mode === 'copy' ? t('extIntegration.mode.copyShort') : t('extIntegration.mode.linkShort')}
        </Tag>
      ),
    },
    {
      title: t('extIntegration.col.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        if (status === 'connected') {
          return <Badge status="success" text={t('extIntegration.status.connected')} />;
        } else if (status === 'syncing') {
          return (
            <div>
              <Badge status="processing" text={t('extIntegration.status.syncing')} />
              <div style={{ width: 80, marginTop: 5 }}>
                <Progress percent={record.sync_progress} />
              </div>
            </div>
          );
        } else if (status === 'error') {
          return (
            <Tooltip title={record.error_message}>
              <Badge status="error" text={t('extIntegration.status.error')} />
            </Tooltip>
          );
        }
        return <Badge status="default" text={t('extIntegration.status.unknown')} />;
      },
    },
    {
      title: t('extIntegration.col.docCount'),
      dataIndex: 'document_count',
      key: 'document_count',
    },
    {
      title: t('extIntegration.col.lastSync'),
      dataIndex: 'last_sync',
      key: 'last_sync',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: t('extIntegration.col.action'),
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
            {t('extIntegration.action.sync')}
          </Button>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => message.info(t('extIntegration.msg.settingsWip'))}
            style={{ color: '#1677ff' }}
          >
            {t('extIntegration.action.settings')}
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            {t('extIntegration.action.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <Title level={5}>{t('extIntegration.pageTitle')}</Title>
          <Text type="secondary">{t('extIntegration.pageSubtitle')}</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={showImportModal}
        >
          {t('extIntegration.addConnection')}
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
          showTotal: (total) => t('extIntegration.totalConnections', { total }),
        }}
      />

      {renderImportModal()}
    </div>
  );
};

export default ExternalIntegration;
