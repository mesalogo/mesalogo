import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Table, Space, Modal, Form, Input, Select,
  Typography, Tag, Switch, Radio, App, Tooltip, Popconfirm
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  ApiOutlined, LinkOutlined, ExperimentOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import imBotAPI, { IMBotConfig } from '../../services/api/imBot';
import { actionTaskAPI } from '../../services/api/actionTask';
import api from '../../services/api/axios';

const { Title, Text } = Typography;

const PLATFORMS = [
  { value: 'telegram', label: 'Telegram', available: true },
  { value: 'slack', label: 'Slack', available: true },
  { value: 'dingtalk', label: 'DingTalk', available: false },
  { value: 'wecom', label: 'WeCom', available: false },
  { value: 'feishu', label: 'Feishu', available: false },
];

const CREDENTIAL_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  telegram: [
    { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF...' },
  ],
  slack: [
    { key: 'bot_token', label: 'Bot Token (xoxb-...)', placeholder: 'xoxb-...' },
    { key: 'signing_secret', label: 'Signing Secret', placeholder: 'Your app signing secret' },
  ],
};

const IMIntegrationPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [bots, setBots] = useState<IMBotConfig[]>([]);
  const [actionTasks, setActionTasks] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBot, setEditingBot] = useState<IMBotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [selectedPlatform, setSelectedPlatform] = useState('telegram');

  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await imBotAPI.list();
      setBots(data.im_bots || []);
    } catch (error: any) {
      message.error(t('imBot.loadFailed', 'Failed to load bots'));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  const fetchAgents = useCallback(async () => {
    try {
      const tasks = await actionTaskAPI.getAll(true);
      setActionTasks(tasks);
    } catch (error) {
      console.error('Failed to fetch action tasks:', error);
    }
  }, []);

  const fetchTaskAgents = useCallback(async (taskId: string) => {
    try {
      const response = await api.get(`/action-tasks/${taskId}/agents`);
      setAgents(response.data.agents || []);
    } catch (error) {
      console.error('Failed to fetch task agents:', error);
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    fetchBots();
    fetchAgents();
  }, [fetchBots, fetchAgents]);

  const handleCreate = () => {
    setEditingBot(null);
    form.resetFields();
    form.setFieldsValue({
      platform: 'telegram',
      config: { trigger_mode: 'all' },
    });
    setSelectedPlatform('telegram');
    setSelectedTaskId(null);
    setAgents([]);
    setModalVisible(true);
  };

  const handleEdit = async (bot: IMBotConfig) => {
    try {
      const data = await imBotAPI.get(bot.id);
      setEditingBot(data);
      setSelectedPlatform(data.platform);

      // If bot has an agent_id, find which task it belongs to and load that task's agents
      let taskId: string | null = null;
      if (data.agent_id) {
        const task = actionTasks.find((t: any) =>
          t.agents?.some((a: any) => a.id === data.agent_id)
        );
        if (task) {
          taskId = task.id;
          setSelectedTaskId(task.id);
          await fetchTaskAgents(task.id);
        }
      } else {
        setSelectedTaskId(null);
        setAgents([]);
      }

      form.setFieldsValue({
        name: data.name,
        platform: data.platform,
        action_task_id: taskId,
        agent_id: data.agent_id,
        config: data.config || {},
        ...Object.fromEntries(
          Object.entries(data.credentials || {}).map(([k, v]) => [`cred_${k}`, v])
        ),
      });
      setModalVisible(true);
    } catch (error: any) {
      message.error(t('imBot.loadDetailFailed', 'Failed to load bot details'));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const platform = values.platform;
      const credFields = CREDENTIAL_FIELDS[platform] || [];
      const credentials: Record<string, string> = {};
      credFields.forEach(f => {
        if (values[`cred_${f.key}`]) {
          credentials[f.key] = values[`cred_${f.key}`];
        }
      });

      const payload = {
        name: values.name,
        platform,
        credentials,
        agent_id: values.agent_id || null,
        config: values.config || {},
      };

      if (editingBot) {
        await imBotAPI.update(editingBot.id, payload);
        message.success(t('imBot.updated', 'Bot updated'));
      } else {
        await imBotAPI.create(payload);
        message.success(t('imBot.created', 'Bot created'));
      }

      setModalVisible(false);
      fetchBots();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error?.response?.data?.error || t('imBot.saveFailed', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await imBotAPI.delete(id);
      message.success(t('imBot.deleted', 'Bot deleted'));
      fetchBots();
    } catch (error: any) {
      message.error(t('imBot.deleteFailed', 'Delete failed'));
    }
  };

  const handleToggleActive = async (bot: IMBotConfig) => {
    try {
      await imBotAPI.update(bot.id, { is_active: !bot.is_active });
      fetchBots();
    } catch (error: any) {
      message.error(t('imBot.updateFailed', 'Update failed'));
    }
  };

  const handleTest = async (bot: IMBotConfig) => {
    try {
      const data = await imBotAPI.test(bot.id);
      if (data.success) {
        message.success(data.message);
      } else {
        message.error(data.message);
      }
    } catch (error: any) {
      message.error(t('imBot.testFailed', 'Test failed'));
    }
  };

  const handleRegisterWebhook = async (bot: IMBotConfig) => {
    try {
      const data = await imBotAPI.registerWebhook(bot.id);
      if (data.success) {
        message.success(`${data.message} (${data.webhook_url})`);
        fetchBots();
      } else {
        message.error(data.message);
      }
    } catch (error: any) {
      message.error(t('imBot.webhookFailed', 'Webhook registration failed'));
    }
  };

  const columns = [
    {
      title: t('imBot.name', 'Name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('imBot.platform', 'Platform'),
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <Tag color="blue">{platform.charAt(0).toUpperCase() + platform.slice(1)}</Tag>
      ),
    },
    {
      title: t('imBot.agent', 'Agent'),
      dataIndex: 'agent_name',
      key: 'agent_name',
      render: (name: string) => name || <Text type="secondary">-</Text>,
    },
    {
      title: t('imBot.webhook', 'Webhook'),
      dataIndex: 'webhook_registered',
      key: 'webhook_registered',
      render: (registered: boolean) => registered
        ? <Tag icon={<CheckCircleOutlined />} color="success">{t('imBot.registered', 'Registered')}</Tag>
        : <Tag icon={<CloseCircleOutlined />} color="default">{t('imBot.notRegistered', 'Not Registered')}</Tag>,
    },
    {
      title: t('imBot.status', 'Status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean, record: IMBotConfig) => (
        <Switch checked={active} onChange={() => handleToggleActive(record)} size="small" />
      ),
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      render: (_: any, record: IMBotConfig) => (
        <Space size="small">
          <Tooltip title={t('imBot.test', 'Test Connection')}>
            <Button type="text" size="small" icon={<ExperimentOutlined />} onClick={() => handleTest(record)} />
          </Tooltip>
          <Tooltip title={t('imBot.registerWebhook', 'Register Webhook')}>
            <Button type="text" size="small" icon={<LinkOutlined />} onClick={() => handleRegisterWebhook(record)} />
          </Tooltip>
          <Tooltip title={t('edit', 'Edit')}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title={t('imBot.confirmDelete', 'Delete this bot?')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
              <Space>
                <ApiOutlined />
                {t('imBot.title')}
              </Space>
            </Title>
            <Text type="secondary">
              {t('imBot.subtitle')}
            </Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('imBot.addBot')}
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={bots}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: t('imBot.empty', 'No bots configured yet') }}
      />

      <Modal
        title={editingBot ? t('imBot.editBot', 'Edit Bot') : t('imBot.addBot', 'Add Bot')}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        confirmLoading={saving}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t('imBot.name', 'Name')} rules={[{ required: true }]}>
            <Input placeholder={t('imBot.namePlaceholder', 'e.g. Customer Support Bot')} />
          </Form.Item>

          <Form.Item name="platform" label={t('imBot.platform', 'Platform')} rules={[{ required: true }]}>
            <Radio.Group onChange={e => setSelectedPlatform(e.target.value)}>
              {PLATFORMS.map(p => (
                <Radio.Button key={p.value} value={p.value} disabled={!p.available}>
                  {p.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>

          {(CREDENTIAL_FIELDS[selectedPlatform] || []).map(field => (
            <React.Fragment key={field.key}>
              <Form.Item
                name={`cred_${field.key}`}
                label={field.label}
                rules={[{ required: true, message: t('imBot.fieldRequired', '{{field}} is required', { field: field.label }) }]}
              >
                <Input.Password placeholder={field.placeholder} />
              </Form.Item>
            </React.Fragment>
          ))}

          <Form.Item name="action_task_id" label={t('imBot.actionTask', 'Action Task')}>
            <Select
              allowClear
              placeholder={t('imBot.selectActionTask', 'Select an action task first')}
              options={actionTasks.filter((t: any) => !t.is_experiment_clone).map((t: any) => ({ value: t.id, label: t.title || t.name }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              onChange={(value: string | undefined) => {
                setSelectedTaskId(value || null);
                form.setFieldValue('agent_id', undefined);
                setAgents([]);
                if (value) {
                  fetchTaskAgents(value);
                }
              }}
            />
          </Form.Item>

          <Form.Item name="agent_id" label={t('imBot.agent', 'Agent')}>
            <Select
              allowClear
              disabled={!selectedTaskId}
              placeholder={selectedTaskId ? t('imBot.selectAgent', 'Select an agent') : t('imBot.selectTaskFirst', 'Please select an action task first')}
              options={agents.map(a => ({ value: a.id, label: a.name }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item name={['config', 'trigger_mode']} label={t('imBot.triggerMode', 'Trigger Mode')}>
            <Radio.Group>
              <Radio value="all">{t('imBot.triggerAll', 'All Messages')}</Radio>
              <Radio value="command">{t('imBot.triggerCommand', 'Commands Only (/ask)')}</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IMIntegrationPage;
