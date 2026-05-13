import { Card, Tabs, Typography, Space } from 'antd';
import { CrownOutlined, HistoryOutlined, CreditCardOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import PlansTab from './PlansTab';
import PaymentsTab from './PaymentsTab';
import StripeConfigTab from './StripeConfigTab';

const { Title, Text } = Typography;

const SubscriptionManagementPage = () => {
  const { t } = useTranslation();

  const tabItems = [
    {
      key: 'plans',
      label: (
        <span>
          <CrownOutlined />
          {t('subscription.admin.tabs.plans')}
        </span>
      ),
      children: <PlansTab />
    },
    {
      key: 'payments',
      label: (
        <span>
          <HistoryOutlined />
          {t('subscription.admin.tabs.payments')}
        </span>
      ),
      children: <PaymentsTab />
    },
    {
      key: 'stripe',
      label: (
        <span>
          <CreditCardOutlined />
          {t('subscription.admin.tabs.stripe')}
        </span>
      ),
      children: <StripeConfigTab />
    }
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
          <Space>
            <CrownOutlined />
            {t('subscription.admin.title')}
          </Space>
        </Title>
        <Text type="secondary">
          {t('subscription.admin.subtitle')}
        </Text>
      </div>

      <Card>
        <Tabs defaultActiveKey="plans" items={tabItems} />
      </Card>
    </div>
  );
};

export default SubscriptionManagementPage;
