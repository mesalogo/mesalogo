import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Result, Button, Card, Typography } from 'antd';
import { AppleOutlined, CloudOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { oauthAPI } from '../../services/api/oauth';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ParticlesBackground from '../../components/ParticlesBackground';

const { Title, Text } = Typography;

// 彩色 Google 图标
const GoogleColorIcon = () => (
  <svg viewBox="0 0 24 24" width="48" height="48">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// 彩色 Microsoft 图标
const MicrosoftColorIcon = () => (
  <svg viewBox="0 0 24 24" width="48" height="48">
    <path fill="#F25022" d="M1 1h10v10H1z"/>
    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
    <path fill="#FFB900" d="M13 13h10v10H13z"/>
  </svg>
);

// 获取 OAuth 提供商图标
const getProviderIcon = (providerId: string) => {
  switch (providerId) {
    case 'google':
      return <GoogleColorIcon />;
    case 'microsoft':
      return <MicrosoftColorIcon />;
    case 'apple':
      return <AppleOutlined style={{ fontSize: 48 }} />;
    case 'aws_cognito':
      return <CloudOutlined style={{ fontSize: 48 }} />;
    default:
      return null;
  }
};

const OAuthCallback: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { isDark } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      const storedProvider = localStorage.getItem('oauth_provider') || 'google';
      setProvider(storedProvider);
      localStorage.removeItem('oauth_provider');

      if (errorParam) {
        setError(errorParam);
        return;
      }

      if (!code || !state) {
        setError(t('oauth.missingCode'));
        return;
      }

      try {
        const result = await oauthAPI.handleCallback(storedProvider, code, state);

        if (result.status === 'success') {
          localStorage.setItem('authToken', result.token);
          
          if (refreshUser) {
            await refreshUser();
          }

          navigate('/home', { replace: true });
        } else {
          setError(result.message || t('oauth.authFailed'));
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(t('oauth.authFailed'));
      }
    };

    handleCallback();
  }, []);

  const cardStyle: React.CSSProperties = isDark ? {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
  } : {
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  };

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <ParticlesBackground isDark={isDark} />
        <Card style={{ ...cardStyle, maxWidth: 420, width: '100%', margin: 20, position: 'relative', zIndex: 1 }}>
          <Result
            icon={provider ? getProviderIcon(provider) : undefined}
            status={provider ? undefined : "error"}
            title={t('oauth.loginFailed')}
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => navigate('/login')}>
                {t('oauth.backToLogin')}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <ParticlesBackground isDark={isDark} />
      <Card style={{ ...cardStyle, maxWidth: 420, width: '100%', margin: 20, position: 'relative', zIndex: 1, textAlign: 'center', padding: '40px 20px' }}>
        {provider && (
          <div style={{ marginBottom: 24 }}>
            {getProviderIcon(provider)}
          </div>
        )}
        <Title level={4} style={{ marginBottom: 8 }}>
          {t('oauth.processing')}
        </Title>
        {provider && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            {t(`login.oauth.${provider}`)}
          </Text>
        )}
        <Spin size="large" />
      </Card>
    </div>
  );
};

export default OAuthCallback;
