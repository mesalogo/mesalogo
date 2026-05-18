import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Form, Input, Modal, Select, Space, Empty, Tag, App, Switch, InputNumber, Alert, Tooltip, Collapse } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined, ApiOutlined, SettingOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ExternalEnvironmentVariables = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingVariable, setEditingVariable] = useState(null);
  const [form] = Form.useForm();

  // load external env variables
  useEffect(() => {
    fetchExternalVariables();
  }, []);

  const fetchExternalVariables = async () => {
    setLoading(true);
    try {
      const variables = await actionSpaceAPI.getAllExternalVariables();
      setVariables(variables);
    } catch (error) {
      console.error('fetch external variables failed:', error);
      message.error(t('extEnvVar.msg.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariable = () => {
    setEditingVariable(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditVariable = (variable) => {
    setEditingVariable(variable);
    form.setFieldsValue({
      name: variable.name,
      label: variable.label,
      description: variable.description,
      api_url: variable.api_url,
      api_method: variable.api_method,
      api_headers: variable.api_headers,
      data_path: variable.data_path,
      data_type: variable.data_type,
      timeout: variable.timeout,
      sync_interval: variable.sync_interval,
      sync_enabled: variable.sync_enabled
    });
    setIsModalVisible(true);
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingVariable(null);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();

      const variableData = {
        name: values.name,
        label: values.label,
        description: values.description,
        api_url: values.api_url,
        api_method: values.api_method,
        api_headers: values.api_headers,
        data_path: values.data_path,
        data_type: values.data_type,
        timeout: values.timeout,
        sync_interval: values.sync_interval,
        sync_enabled: values.sync_enabled
      };

      if (editingVariable) {
        await actionSpaceAPI.updateExternalVariable(editingVariable.id, variableData);
        message.success(t('extEnvVar.msg.updateSuccess'));
      } else {
        await actionSpaceAPI.createExternalVariable(variableData);
        message.success(t('extEnvVar.msg.createSuccess'));
      }

      setIsModalVisible(false);
      setEditingVariable(null);
      fetchExternalVariables();
    } catch (error) {
      console.error('external variable op failed:', error);
      message.error(t('extEnvVar.msg.opFailed'));
    }
  };

  const handleDeleteVariable = async (id) => {
    try {
      await actionSpaceAPI.deleteExternalVariable(id);
      message.success(t('extEnvVar.msg.deleteSuccess'));
      fetchExternalVariables();
    } catch (error) {
      console.error('delete external variable failed:', error);
      message.error(t('extEnvVar.msg.deleteFailed'));
    }
  };

  const handleToggleSync = async (id, enabled) => {
    try {
      const variable = variables.find(v => v.id === id);
      if (!variable) return;

      await actionSpaceAPI.updateExternalVariable(id, {
        ...variable,
        sync_enabled: enabled
      });

      message.success(enabled ? t('extEnvVar.msg.syncEnabled') : t('extEnvVar.msg.syncDisabled'));
      fetchExternalVariables();
    } catch (error) {
      console.error('toggle sync failed:', error);
      message.error(t('extEnvVar.msg.opFailed'));
    }
  };

  const handleManualSync = async (id) => {
    message.loading(t('extEnvVar.msg.syncing'), 0);

    try {
      const result = await actionSpaceAPI.syncExternalVariable(id);
      message.destroy();
      message.success(t('extEnvVar.msg.syncSuccess'));
      fetchExternalVariables();
    } catch (error) {
      message.destroy();
      console.error('manual sync failed:', error);
      message.error(t('extEnvVar.msg.syncFailed'));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'green';
      case 'error': return 'red';
      case 'inactive': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return t('extEnvVar.status.active');
      case 'error': return t('extEnvVar.status.error');
      case 'inactive': return t('extEnvVar.status.inactive');
      default: return t('extEnvVar.status.unknown');
    }
  };

  const formatInterval = (seconds) => {
    if (seconds < 60) return t('extEnvVar.interval.seconds', { n: seconds });
    if (seconds < 3600) return t('extEnvVar.interval.minutes', { n: Math.floor(seconds / 60) });
    return t('extEnvVar.interval.hours', { n: Math.floor(seconds / 3600) });
  };

  const columns = [
    {
      title: t('extEnvVar.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name) => <code>{name}</code>
    },
    {
      title: t('extEnvVar.col.label'),
      dataIndex: 'label',
      key: 'label',
      width: 100,
    },
    {
      title: t('extEnvVar.col.apiUrl'),
      dataIndex: 'api_url',
      key: 'api_url',
      width: 200,
      ellipsis: true,
      render: (url) => (
        <Tooltip title={url}>
          <Text type="secondary">{url}</Text>
        </Tooltip>
      )
    },
    {
      title: t('extEnvVar.col.syncInterval'),
      dataIndex: 'sync_interval',
      key: 'sync_interval',
      width: 80,
      render: (interval) => formatInterval(interval)
    },
    {
      title: t('extEnvVar.col.lastSync'),
      dataIndex: 'last_sync',
      key: 'last_sync',
      width: 120,
      render: (time) => time ? <Text type="secondary">{new Date(time).toLocaleDateString()}</Text> : '-'
    },
    {
      title: t('extEnvVar.col.value'),
      dataIndex: 'value',
      key: 'value',
      width: 120,
      ellipsis: true,
      render: (value) => value ? (
        <Tooltip title={value}>
          <Text>{value.length > 15 ? `${value.substring(0, 15)}...` : value}</Text>
        </Tooltip>
      ) : '-'
    },
    {
      title: t('extEnvVar.col.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: t('extEnvVar.col.sync'),
      dataIndex: 'sync_enabled',
      key: 'sync_enabled',
      width: 60,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleSync(record.id, checked)}

        />
      )
    },
    {
      title: t('extEnvVar.col.action'),
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<SyncOutlined />}
            onClick={() => handleManualSync(record.id)}
            disabled={!record.sync_enabled}

            title={t('extEnvVar.action.manualSync')}
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditVariable(record)}

            title={t('extEnvVar.action.edit')}
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteVariable(record.id)}

            title={t('extEnvVar.action.delete')}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('extEnvVar.pageSubtitle')}
        </Text>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong>{t('extEnvVar.totalCount', { count: variables.length })}</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateVariable}
        >
          {t('extEnvVar.addVariable')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={variables}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => t('extEnvVar.paginationTotal', { from: range[0], to: range[1], total })
        }}
      />

      {/* add/edit modal */}
      <Modal
        title={editingVariable ? t('extEnvVar.modal.editTitle') : t('extEnvVar.modal.addTitle')}
        open={isModalVisible}
        onCancel={handleModalCancel}
        onOk={handleModalSubmit}
        width={800}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={t('extEnvVar.field.name')}
            rules={[
              { required: true, message: t('extEnvVar.req.name') },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('extEnvVar.req.namePattern') }
            ]}
          >
            <Input placeholder={t('extEnvVar.ph.name')} />
          </Form.Item>

          <Form.Item
            name="label"
            label={t('extEnvVar.field.label')}
            rules={[{ required: true, message: t('extEnvVar.req.label') }]}
          >
            <Input placeholder={t('extEnvVar.ph.label')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('extEnvVar.field.description')}
            extra={t('extEnvVar.extra.description')}
          >
            <TextArea rows={2} placeholder={t('extEnvVar.ph.description')} />
          </Form.Item>

          <Form.Item
            name="api_url"
            label={t('extEnvVar.field.apiUrl')}
            rules={[
              { required: true, message: t('extEnvVar.req.apiUrl') },
              { type: 'url', message: t('extEnvVar.req.urlValid') }
            ]}
          >
            <Input placeholder="https://api.example.com/data" />
          </Form.Item>

          <Form.Item
            name="api_method"
            label={t('extEnvVar.field.apiMethod')}
            rules={[{ required: true, message: t('extEnvVar.req.apiMethod') }]}
            initialValue="GET"
          >
            <Select>
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="api_headers"
            label={t('extEnvVar.field.headers')}
            extra={t('extEnvVar.extra.headers')}
          >
            <TextArea
              rows={3}
              placeholder='{"Authorization": "Bearer your_token", "Content-Type": "application/json"}'
            />
          </Form.Item>

          <Form.Item
            name="data_path"
            label={t('extEnvVar.field.dataPath')}
            extra={t('extEnvVar.extra.dataPath')}
          >
            <Input placeholder={t('extEnvVar.ph.dataPath')} />
          </Form.Item>

          <Collapse
            ghost
            items={[
              {
                key: 'help',
                label: <Text type="secondary">{t('extEnvVar.help.title')}</Text>,
                style: { marginBottom: 16 },
                children: (
                  <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                    <p><strong>{t('extEnvVar.help.syntaxTitle')}</strong></p>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li><code>{t('extEnvVar.help.emptyCode')}</code> - {t('extEnvVar.help.emptyDesc')}</li>
                      <li><code>data.price</code> - {t('extEnvVar.help.dataPriceDesc')}</li>
                      <li><code>rates.USD_CNY</code> - {t('extEnvVar.help.ratesDesc')}</li>
                      <li><code>items[0].value</code> - {t('extEnvVar.help.itemsDesc')}</li>
                      <li><code>response.data.list[0].temperature</code> - {t('extEnvVar.help.nestedDesc')}</li>
                    </ul>
                    <p style={{ marginTop: 8 }}><strong>{t('extEnvVar.help.exampleTitle')}</strong></p>
                    <pre style={{ background: 'var(--custom-hover-bg)', padding: 8, fontSize: '11px', margin: 0 }}>
{`{
  "data": {
    "price": 1250.50,
    "currency": "USD"
  },
  "rates": {
    "USD_CNY": 7.2345
  },
  "items": [
    {"value": 100, "name": "item1"}
  ]
}`}
                    </pre>
                  </div>
                )
              }
            ]}
          />

          <Form.Item
            name="data_type"
            label={t('extEnvVar.field.dataType')}
            rules={[{ required: true, message: t('extEnvVar.req.dataType') }]}
            initialValue="string"
          >
            <Select>
              <Option value="string">{t('extEnvVar.type.string')}</Option>
              <Option value="number">{t('extEnvVar.type.number')}</Option>
              <Option value="boolean">{t('extEnvVar.type.boolean')}</Option>
              <Option value="object">{t('extEnvVar.type.object')}</Option>
              <Option value="array">{t('extEnvVar.type.array')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="timeout"
            label={t('extEnvVar.field.timeout')}
            rules={[
              { required: true, message: t('extEnvVar.req.timeout') },
              { type: 'number', min: 1, max: 300, message: t('extEnvVar.req.timeoutRange') }
            ]}
            initialValue={10}
            extra={t('extEnvVar.extra.timeout')}
          >
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber
                min={1}
                max={300}
                style={{ width: '100%' }}
                placeholder="10"
              />
              <Input style={{ width: 'auto', pointerEvents: 'none' }} disabled value={t('extEnvVar.unit.seconds')} />
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="sync_interval"
            label={t('extEnvVar.field.syncInterval')}
            rules={[
              { required: true, message: t('extEnvVar.req.syncInterval') },
              { type: 'number', min: 30, message: t('extEnvVar.req.syncIntervalMin') }
            ]}
            initialValue={300}
          >
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber
                min={30}
                max={86400}
                style={{ width: '100%' }}
                placeholder="300"
              />
              <Input style={{ width: 'auto', pointerEvents: 'none' }} disabled value={t('extEnvVar.unit.seconds')} />
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="sync_enabled"
            label={t('extEnvVar.field.syncEnabled')}
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren={t('extEnvVar.switch.on')} unCheckedChildren={t('extEnvVar.switch.off')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExternalEnvironmentVariables;
