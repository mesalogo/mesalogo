import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Descriptions,
  Empty,
  App
} from 'antd';
import {
  HistoryOutlined,
  ReloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { subscriptionAPI, PaymentRecord } from '../../services/api/subscription';

const { Title, Text } = Typography;

const PaymentsPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await subscriptionAPI.getPayments(page, perPage);
      if (res.success && res.data) {
        setPayments(res.data.payments || []);
        setTotal(res.data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleViewDetail = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setDetailVisible(true);
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      succeeded: { color: 'success', text: t('subscription.payment.status.succeeded') },
      failed: { color: 'error', text: t('subscription.payment.status.failed') },
      pending: { color: 'processing', text: t('subscription.payment.status.pending') },
      refunded: { color: 'warning', text: t('subscription.payment.status.refunded') }
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
      width: 180,
      render: (time: string) => new Date(time).toLocaleString()
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
        >
          {t('subscription.payment.detail')}
        </Button>
      )
    }
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
            <Space>
              <HistoryOutlined />
              {t('menu.paymentHistory')}
            </Space>
          </Title>
          <Text type="secondary">
            {t('account.payments.subtitle')}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchPayments} loading={loading}>
          {t('refresh')}
        </Button>
      </div>

      <Card>
        {payments.length === 0 && !loading ? (
          <Empty description={t('account.payments.noRecords')} />
        ) : (
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
        )}
      </Card>

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
    </div>
  );
};

export default PaymentsPage;
