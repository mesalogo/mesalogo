import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Progress,
  Tag,
  Typography,
  Space,
  Skeleton,
  Row,
  Col,
  Statistic,
  Divider,
  Alert,
  Button,
  App,
  Modal,
  Radio
} from 'antd';
import {
  CrownOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  RobotOutlined,
  DatabaseOutlined,
  BookOutlined,
  CloudOutlined,
  MessageOutlined,
  DollarOutlined,
  ReloadOutlined,
  CreditCardOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { subscriptionAPI, SubscriptionPlan, UserSubscription, UsageItem } from '../../services/api/subscription';

const { Title, Text } = Typography;

const resourceIcons: Record<string, React.ReactNode> = {
  tasks: <AppstoreOutlined />,
  agents: <RobotOutlined />,
  spaces: <DatabaseOutlined />,
  knowledge_bases: <BookOutlined />,
  storage_mb: <CloudOutlined />,
  daily_conversations: <MessageOutlined />,
  monthly_tokens: <DollarOutlined />
};

const SubscriptionPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, usageRes, plansRes] = await Promise.all([
        subscriptionAPI.getCurrentSubscription(),
        subscriptionAPI.getUsage(),
        subscriptionAPI.getAvailablePlans()
      ]);

      if (subRes.success && subRes.data) {
        setSubscription(subRes.data.subscription);
        setPlan(subRes.data.plan);
      }
      if (usageRes.success && usageRes.data) {
        setUsage(usageRes.data.usage || []);
      }
      if (plansRes.success && plansRes.data) {
        setAvailablePlans(plansRes.data.plans || []);
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
      message.error(t('error.networkError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 处理支付回调
  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    
    if (payment === 'success' && sessionId) {
      // 支付成功，检查状态并更新
      const checkPaymentStatus = async () => {
        try {
          const res = await subscriptionAPI.getCheckoutStatus(sessionId);
          if (res.success && res.data?.status === 'paid') {
            message.success(t('subscription.paymentSuccess'));
            fetchData(); // 刷新数据
          }
        } catch (error) {
          console.error('Check payment status error:', error);
        }
      };
      checkPaymentStatus();
    } else if (payment === 'cancelled') {
      message.info(t('subscription.paymentCancelled'));
    }
  }, [searchParams, fetchData, t, message]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'expired': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return t('subscription.statusActive');
      case 'expired': return t('subscription.statusExpired');
      case 'cancelled': return t('subscription.statusCancelled');
      default: return status;
    }
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return t('subscription.neverExpires');
    return new Date(expiresAt).toLocaleDateString();
  };

  const getProgressStatus = (percentage: number): 'success' | 'normal' | 'exception' | 'active' => {
    if (percentage >= 90) return 'exception';
    if (percentage >= 70) return 'normal';
    return 'success';
  };

  const handleSelectPlan = (p: SubscriptionPlan) => {
    if (p.price_monthly === 0) {
      message.info(t('subscription.freeplanNoPayment'));
      return;
    }
    setSelectedPlan(p);
    setBillingPeriod('monthly');
    setUpgradeModalVisible(true);
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    
    setCheckoutLoading(true);
    try {
      const res = await subscriptionAPI.createCheckoutSession(selectedPlan.id, billingPeriod);
      if (res.success && res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        message.error(res.message || t('subscription.checkoutFailed'));
      }
    } catch (error) {
      console.error('Checkout error:', error);
      message.error(t('error.networkError'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton active paragraph={{ rows: 1 }} style={{ marginBottom: 24 }} />
        <Card style={{ marginBottom: 24 }}>
          <Skeleton active paragraph={{ rows: 2 }} />
        </Card>
        <Card style={{ marginBottom: 24 }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
            <Space>
              <CrownOutlined />
              {t('subscription.title')}
            </Space>
          </Title>
          <Text type="secondary">
            {t('subscription.subtitle')}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          {t('refresh')}
        </Button>
      </div>

      {/* 当前计划卡片 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle">
          <Col span={16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Space>
                <Text type="secondary">{t('subscription.currentPlan')}:</Text>
                {plan ? (
                  <Tag color={plan.badge_color} style={{ fontSize: 16, padding: '4px 12px' }}>
                    {plan.display_name}
                  </Tag>
                ) : (
                  <Tag>{t('subscription.noSubscription')}</Tag>
                )}
                {subscription && (
                  <Tag color={getStatusColor(subscription.status)}>
                    {getStatusText(subscription.status)}
                  </Tag>
                )}
              </Space>
              {plan?.description && (
                <Text type="secondary">{plan.description}</Text>
              )}
              {subscription && (
                <Text type="secondary">
                  {t('subscription.expiresAt')}: {formatExpiry(subscription.expires_at)}
                </Text>
              )}
            </div>
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            {plan && plan.price_monthly > 0 && (
              <Statistic
                title={t('subscription.monthly')}
                value={plan.price_monthly}
                prefix={plan.currency === 'CNY' ? '¥' : '$'}
                suffix={t('subscription.perMonth')}
              />
            )}
          </Col>
        </Row>
      </Card>

      {/* 用量统计 */}
      <Card title={<><ThunderboltOutlined /> {t('subscription.usageTitle')}</>} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {usage.map((item) => (
            <Col xs={24} sm={12} md={8} key={item.resource_type}>
              <Card size="small" variant="borderless" style={{ background: isDark ? '#1f1f1f' : '#fafafa' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Space>
                    {resourceIcons[item.resource_type]}
                    <Text strong>{item.display_name}</Text>
                  </Space>
                  <Progress
                    percent={item.percentage}
                    status={getProgressStatus(item.percentage)}
                    size="small"
                  />
                  <Text type="secondary">
                    {item.usage} / {item.limit !== null && item.limit !== -1 ? item.limit : t('subscription.unlimited')}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 可用计划列表 */}
      <Card title={t('subscription.availablePlans')}>
        <Row gutter={[16, 16]}>
          {availablePlans.map((p) => (
            <Col xs={24} sm={12} md={8} key={p.id}>
              <Card
                hoverable
                style={{
                  borderColor: plan?.id === p.id ? p.badge_color : undefined,
                  borderWidth: plan?.id === p.id ? 2 : 1,
                  background: plan?.id === p.id ? (isDark ? 'rgba(24, 144, 255, 0.1)' : 'rgba(24, 144, 255, 0.05)') : undefined
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Space>
                    <Tag color={p.badge_color}>{p.display_name}</Tag>
                    {plan?.id === p.id && (
                      <Tag color="blue">{t('subscription.currentPlanBadge')}</Tag>
                    )}
                    {p.is_default && (
                      <Tag>{t('subscription.defaultPlanBadge')}</Tag>
                    )}
                  </Space>
                  
                  <Text type="secondary">{p.description}</Text>
                  
                  <Divider style={{ margin: '12px 0' }} />
                  
                  <div>
                    <Text strong>{t('subscription.limits')}:</Text>
                    <div style={{ marginTop: 8 }}>
                      {Object.entries(p.limits || {}).map(([key, value]) => (
                        <div key={key} style={{ padding: '4px 0' }}>
                          <Text type="secondary">
                            {t(`subscription.resources.${key.replace('max_', '')}`, key)}: {value === -1 ? t('subscription.unlimited') : value}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Divider style={{ margin: '12px 0' }} />
                  
                  <div style={{ textAlign: 'center' }}>
                    {p.price_monthly === 0 ? (
                      <Text strong style={{ fontSize: 24 }}>{t('subscription.free')}</Text>
                    ) : (
                      <Text strong style={{ fontSize: 24 }}>
                        {p.currency === 'CNY' ? '¥' : '$'}{p.price_monthly}
                        <Text type="secondary" style={{ fontSize: 14 }}>{t('subscription.perMonth')}</Text>
                      </Text>
                    )}
                  </div>
                  
                  {plan?.id !== p.id && p.sort_order > (plan?.sort_order || 0) && (
                    <Button
                      type="primary"
                      block
                      style={{ marginTop: 8 }}
                      icon={<CreditCardOutlined />}
                      onClick={() => handleSelectPlan(p)}
                    >
                      {t('subscription.upgrade')}
                    </Button>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        
        {availablePlans.length === 0 && (
          <Alert
            title={t('subscription.noSubscription')}
            description={t('subscription.noSubscriptionDesc')}
            type="info"
            showIcon
          />
        )}
      </Card>

      {/* 升级弹窗 */}
      <Modal
        title={
          <Space>
            <CreditCardOutlined />
            {t('subscription.upgradeTitle')}
          </Space>
        }
        open={upgradeModalVisible}
        onCancel={() => setUpgradeModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setUpgradeModalVisible(false)}>
            {t('cancel')}
          </Button>,
          <Button
            key="pay"
            type="primary"
            loading={checkoutLoading}
            onClick={handleCheckout}
            icon={<CreditCardOutlined />}
          >
            {t('subscription.proceedToPayment')}
          </Button>
        ]}
      >
        {selectedPlan && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text>{t('subscription.selectedPlan')}: </Text>
              <Tag color={selectedPlan.badge_color}>{selectedPlan.display_name}</Tag>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <Text>{t('subscription.billingPeriod')}: </Text>
              <Radio.Group
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value)}
                style={{ marginLeft: 8 }}
              >
                <Radio.Button value="monthly">
                  {t('subscription.monthly')} ({selectedPlan.currency === 'CNY' ? '¥' : '$'}{selectedPlan.price_monthly})
                </Radio.Button>
                <Radio.Button value="yearly">
                  {t('subscription.yearly')} ({selectedPlan.currency === 'CNY' ? '¥' : '$'}{selectedPlan.price_yearly})
                </Radio.Button>
              </Radio.Group>
            </div>
            
            <Alert
              title={t('subscription.paymentNote')}
              description={t('subscription.paymentNoteDesc')}
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SubscriptionPage;
