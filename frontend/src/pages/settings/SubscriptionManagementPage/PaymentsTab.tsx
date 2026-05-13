import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Card,
  Statistic,
  Row,
  Col,
  Modal,
  Descriptions,
  App
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { subscriptionAPI, PaymentRecord, PaymentStats } from '../../../services/api/subscription';

const PaymentsTab = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    search: ''
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await subscriptionAPI.adminGetPayments({
        page,
        per_page: perPage,
        status: filters.status || undefined,
        type: filters.type || undefined,
        search: filters.search || undefined
      });
      if (res.success && res.data) {
        setPayments(res.data.payments || []);
        setTotal(res.data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filters]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await subscriptionAPI.adminGetPaymentStats();
      if (res.success && res.data) {
        setStats(res.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, [fetchPayments, fetchStats]);

  const handleViewDetail = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setDetailVisible(true);
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      succeeded: { color: 'success', text: t('subscription.payment.status.succeeded') },
      failed: { color: 'error', text: t('subscription.payment.status.failed') },
      pending: { color: 'processing', text: t('subscription.payment.status.pending') },
      refunded: { color: 'warning', text: t('subscription.payment.status.refunded') },
      timeout: { color: 'default', text: t('subscription.payment.status.timeout') }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      subscription: t('subscription.payment.type.subscription'),
      upgrade: t('subscription.payment.type.upgrade'),
      renewal: t('subscription.payment.type.renewal'),
      refund: t('subscription.payment.type.refund')
    };
    return typeMap[type] || type;
  };

  const formatAmount = (amount: number, currency: string) => {
    const symbol = currency === 'CNY' ? '¥' : '$';
    const formatted = Math.abs(amount).toFixed(2);
    return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  };

  const columns = [
    {
      title: t('subscription.payment.time'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: t('subscription.payment.user'),
      dataIndex: 'user',
      key: 'user',
      render: (user: PaymentRecord['user']) => user ? (user.username || user.email) : '-'
    },
    {
      title: t('subscription.payment.type.label'),
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => getTypeText(type)
    },
    {
      title: t('subscription.payment.amount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number, record: PaymentRecord) => (
        <span style={{ color: amount < 0 ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>
          {formatAmount(amount, record.currency)}
        </span>
      )
    },
    {
      title: t('subscription.payment.status.label'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 80,
      render: (_: any, record: PaymentRecord) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        />
      )
    }
  ];

  return (
    <>
      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('subscription.payment.stats.totalIncome')}
                value={stats.total_income}
                precision={2}
                prefix="¥"
                styles={{ content: { color: '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('subscription.payment.stats.successCount')}
                value={stats.success_count}
                suffix={t('subscription.payment.stats.orders')}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('subscription.payment.stats.failedCount')}
                value={stats.failed_count}
                suffix={t('subscription.payment.stats.orders')}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={t('subscription.payment.stats.refundAmount')}
                value={stats.refund_amount}
                precision={2}
                prefix="¥"
                styles={{ content: { color: '#faad14' } }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 120 }}
            placeholder={t('subscription.payment.status.label')}
            allowClear
            value={filters.status || undefined}
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
          >
            <Select.Option value="succeeded">{t('subscription.payment.status.succeeded')}</Select.Option>
            <Select.Option value="failed">{t('subscription.payment.status.failed')}</Select.Option>
            <Select.Option value="pending">{t('subscription.payment.status.pending')}</Select.Option>
            <Select.Option value="refunded">{t('subscription.payment.status.refunded')}</Select.Option>
          </Select>
          <Select
            style={{ width: 120 }}
            placeholder={t('subscription.payment.type.label')}
            allowClear
            value={filters.type || undefined}
            onChange={(value) => setFilters({ ...filters, type: value || '' })}
          >
            <Select.Option value="subscription">{t('subscription.payment.type.subscription')}</Select.Option>
            <Select.Option value="upgrade">{t('subscription.payment.type.upgrade')}</Select.Option>
            <Select.Option value="renewal">{t('subscription.payment.type.renewal')}</Select.Option>
            <Select.Option value="refund">{t('subscription.payment.type.refund')}</Select.Option>
          </Select>
          <Input
            style={{ width: 200 }}
            placeholder={t('subscription.payment.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onPressEnter={() => fetchPayments()}
          />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchPayments(); fetchStats(); }} loading={loading}>
            {t('refresh')}
          </Button>
          <Button icon={<DownloadOutlined />} disabled>
            {t('subscription.payment.export')}
          </Button>
        </Space>
      </div>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={payments}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: perPage,
          total,
          onChange: (p) => setPage(p),
          showTotal: (total) => t('subscription.payment.totalRecords', { total })
        }}
      />

      {/* 详情弹窗 */}
      <Modal
        title={t('subscription.payment.detail')}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={500}
      >
        {selectedPayment && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('subscription.payment.orderId')}>
              {selectedPayment.id}
            </Descriptions.Item>
            <Descriptions.Item label={t('subscription.payment.time')}>
              {new Date(selectedPayment.created_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label={t('subscription.payment.user')}>
              {selectedPayment.user?.username || selectedPayment.user?.email || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('subscription.payment.type.label')}>
              {getTypeText(selectedPayment.type)}
            </Descriptions.Item>
            <Descriptions.Item label={t('subscription.payment.amount')}>
              <span style={{ color: selectedPayment.amount < 0 ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>
                {formatAmount(selectedPayment.amount, selectedPayment.currency)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label={t('subscription.payment.status.label')}>
              {getStatusTag(selectedPayment.status)}
            </Descriptions.Item>
            {selectedPayment.plan && (
              <Descriptions.Item label={t('subscription.payment.plan')}>
                <Tag color={selectedPayment.plan.badge_color}>{selectedPayment.plan.display_name}</Tag>
              </Descriptions.Item>
            )}
            {selectedPayment.stripe_payment_intent_id && (
              <Descriptions.Item label="Stripe Payment ID">
                {selectedPayment.stripe_payment_intent_id}
              </Descriptions.Item>
            )}
            {selectedPayment.failure_reason && (
              <Descriptions.Item label={t('subscription.payment.failureReason')}>
                <span style={{ color: '#ff4d4f' }}>{selectedPayment.failure_reason}</span>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </>
  );
};

export default PaymentsTab;
