import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Spin,
  Empty
} from 'antd';
import {
  GoogleOutlined,
  WindowsOutlined,
  AppleOutlined,
  CloudOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { oauthAPI, OAuthProvider } from '../../../services/api/oauth';

const { Text } = Typography;

const ExternalUserSystems: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    const fetchProviders = async () => {
      setLoading(true);
      try {
        const data = await oauthAPI.getProviders();
        setProviders(data);
      } catch (error) {
        console.error('Failed to fetch OAuth providers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, []);

  const getProviderIcon = (providerId: string) => {
    const iconStyle = { fontSize: 32 };
    switch (providerId) {
      case 'google':
        return <GoogleOutlined style={{ ...iconStyle, color: '#4285F4' }} />;
      case 'microsoft':
        return <WindowsOutlined style={{ ...iconStyle, color: '#00A4EF' }} />;
      case 'apple':
        return <AppleOutlined style={{ ...iconStyle, color: '#000000' }} />;
      case 'aws_cognito':
        return <CloudOutlined style={{ ...iconStyle, color: '#FF9900' }} />;
      case 'oidc':
        return <SafetyCertificateOutlined style={{ ...iconStyle, color: '#52c41a' }} />;
      case 'oauth2':
        return <ApiOutlined style={{ ...iconStyle, color: '#fa8c16' }} />;
      default:
        return <CloudOutlined style={{ ...iconStyle, color: 'var(--custom-text-secondary)' }} />;
    }
  };

  const getProviderDescription = (providerId: string) => {
    switch (providerId) {
      case 'google':
        return t('externalUserSystems.googleDesc', 'Google 账号登录');
      case 'microsoft':
        return t('externalUserSystems.microsoftDesc', 'Microsoft 账号登录');
      case 'apple':
        return t('externalUserSystems.appleDesc', 'Apple ID 登录');
      case 'aws_cognito':
        return t('externalUserSystems.cognitoDesc', 'AWS Cognito 企业 SSO');
      case 'oidc':
        return t('externalUserSystems.oidcDesc', 'OpenID Connect 标准协议');
      case 'oauth2':
        return t('externalUserSystems.oauth2Desc', 'OAuth 2.0 自定义服务');
      default:
        return t('externalUserSystems.customDesc', '自定义登录');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <Empty
        description={t('externalUserSystems.noProviders', '暂无配置外部登录')}
        style={{ padding: 48 }}
      />
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {providers.map((provider) => (
        <Col xs={24} sm={12} md={8} lg={6} key={provider.id}>
          <Card hoverable style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {getProviderIcon(provider.id)}
              <div>
                <Text strong style={{ fontSize: 16 }}>{provider.name}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {getProviderDescription(provider.id)}
                </Text>
              </div>
              <Tag
                color={provider.enabled ? 'green' : 'default'}
                icon={provider.enabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              >
                {provider.enabled ? t('status.enabled') : t('status.disabled')}
              </Tag>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default ExternalUserSystems;
