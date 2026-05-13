import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Typography,
  Popconfirm,
  ColorPicker,
  Select,
  App
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { subscriptionAPI, SubscriptionPlan } from '../../../services/api/subscription';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PlansTab = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [form] = Form.useForm();

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await subscriptionAPI.adminGetPlans();
      if (res.success && res.data) {
        setPlans(res.data.plans || []);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreate = () => {
    setEditingPlan(null);
    setModalVisible(true);
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    form.setFieldsValue({
      ...plan,
      badge_color: plan.badge_color
    });
    setModalVisible(true);
  };

  const handleDelete = async (planId: string) => {
    try {
      const res = await subscriptionAPI.adminDeletePlan(planId);
      if (res.success) {
        message.success(t('subscription.admin.deleteSuccess'));
        fetchPlans();
      } else {
        message.error(res.message);
      }
    } catch (error) {
      message.error(t('error.unknown'));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (typeof values.badge_color === 'object') {
        values.badge_color = values.badge_color.toHexString();
      }

      let res;
      if (editingPlan) {
        res = await subscriptionAPI.adminUpdatePlan(editingPlan.id, values);
      } else {
        res = await subscriptionAPI.adminCreatePlan(values);
      }

      if (res.success) {
        message.success(editingPlan ? t('subscription.admin.updateSuccess') : t('subscription.admin.createSuccess'));
        setModalVisible(false);
        fetchPlans();
      } else {
        message.error(res.message);
      }
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const columns = [
    {
      title: t('subscription.admin.form.displayName'),
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text: string, record: SubscriptionPlan) => (
        <Space>
          <Tag color={record.badge_color}>{text}</Tag>
          {record.is_default && <Tag color="blue">{t('subscription.defaultPlanBadge')}</Tag>}
        </Space>
      )
    },
    {
      title: t('subscription.admin.form.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string) => <Text code>{text}</Text>
    },
    {
      title: t('subscription.admin.form.priceMonthly'),
      dataIndex: 'price_monthly',
      key: 'price_monthly',
      render: (price: number, record: SubscriptionPlan) => (
        `${record.currency === 'CNY' ? '¥' : '$'}${price}`
      )
    },
    {
      title: t('subscription.limits'),
      key: 'limits',
      render: (_: any, record: SubscriptionPlan) => (
        <Space size="small" wrap>
          <Tag>{t('subscription.resources.tasks')}: {record.limits?.max_tasks ?? '-'}</Tag>
          <Tag>{t('subscription.resources.agents')}: {record.limits?.max_agents ?? '-'}</Tag>
          <Tag>{t('subscription.resources.spaces')}: {record.limits?.max_spaces ?? '-'}</Tag>
        </Space>
      )
    },
    {
      title: t('subscription.admin.form.sortOrder'),
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80
    },
    {
      title: t('subscription.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? t('enabled') : t('disabled')}
        </Tag>
      )
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: SubscriptionPlan) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title={t('subscription.admin.confirmDelete')}
            description={t('subscription.admin.deleteWarning')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('confirm')}
            cancelText={t('cancel')}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchPlans} loading={loading}>
            {t('refresh')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('subscription.admin.createPlan')}
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={plans}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingPlan ? t('subscription.admin.editPlan') : t('subscription.admin.createPlan')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
        destroyOnHidden={false}
        afterOpenChange={(open) => {
          if (open && !editingPlan) {
            form.resetFields();
            form.setFieldsValue({
              badge_color: '#666666',
              price_monthly: 0,
              price_yearly: 0,
              currency: 'CNY',
              sort_order: 0,
              is_active: true,
              is_default: false,
              limits: {
                max_tasks: 10,
                max_agents: 5,
                max_spaces: 3,
                max_knowledge_bases: 2,
                max_storage_mb: 100,
                max_daily_conversations: 50,
                max_monthly_tokens: 100000
              }
            });
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('subscription.admin.form.name')}
            rules={[{ required: true }]}
          >
            <Input
              placeholder={t('subscription.admin.form.namePlaceholder')}
              disabled={!!editingPlan}
            />
          </Form.Item>

          <Form.Item
            name="display_name"
            label={t('subscription.admin.form.displayName')}
            rules={[{ required: true }]}
          >
            <Input placeholder={t('subscription.admin.form.displayNamePlaceholder')} />
          </Form.Item>

          <Form.Item name="description" label={t('subscription.admin.form.description')}>
            <TextArea rows={2} />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="badge_color" label={t('subscription.admin.form.badgeColor')}>
              <ColorPicker />
            </Form.Item>

            <Form.Item name="currency" label={t('subscription.admin.form.currency')}>
              <Select style={{ width: 100 }}>
                <Select.Option value="CNY">CNY (¥)</Select.Option>
                <Select.Option value="USD">USD ($)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="price_monthly" label={t('subscription.admin.form.priceMonthly')}>
              <InputNumber min={0} precision={2} />
            </Form.Item>

            <Form.Item name="price_yearly" label={t('subscription.admin.form.priceYearly')}>
              <InputNumber min={0} precision={2} />
            </Form.Item>
          </Space>

          <Title level={5}>{t('subscription.limits')}</Title>
          <Space wrap style={{ width: '100%' }}>
            <Form.Item name={['limits', 'max_tasks']} label={t('subscription.resources.tasks')}>
              <InputNumber min={-1} />
            </Form.Item>
            <Form.Item name={['limits', 'max_agents']} label={t('subscription.resources.agents')}>
              <InputNumber min={-1} />
            </Form.Item>
            <Form.Item name={['limits', 'max_spaces']} label={t('subscription.resources.spaces')}>
              <InputNumber min={-1} />
            </Form.Item>
            <Form.Item name={['limits', 'max_knowledge_bases']} label={t('subscription.resources.knowledge_bases')}>
              <InputNumber min={-1} />
            </Form.Item>
            <Form.Item name={['limits', 'max_storage_mb']} label={t('subscription.resources.storage_mb')}>
              <InputNumber min={-1} />
            </Form.Item>
            <Form.Item name={['limits', 'max_daily_conversations']} label={t('subscription.resources.daily_conversations')}>
              <InputNumber min={-1} />
            </Form.Item>
            <Form.Item name={['limits', 'max_monthly_tokens']} label={t('subscription.resources.monthly_tokens')}>
              <InputNumber min={-1} />
            </Form.Item>
          </Space>
          <Text type="secondary">{t('subscription.admin.unlimitedHint')}</Text>

          <Space style={{ width: '100%', marginTop: 16 }} size="large">
            <Form.Item name="sort_order" label={t('subscription.admin.form.sortOrder')}>
              <InputNumber min={0} />
            </Form.Item>

            <Form.Item name="is_active" label={t('subscription.admin.form.isActive')} valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="is_default" label={t('subscription.admin.form.isDefault')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
};

export default PlansTab;
