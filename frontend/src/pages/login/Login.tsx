import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, App, Divider, Space } from 'antd';
import { UserOutlined, LockOutlined, AppleOutlined, CloudOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { ThemeSwitch } from '../../components/ThemeSwitcher';
import ParticlesBackground from '../../components/ParticlesBackground';
import { oauthAPI, OAuthProvider } from '../../services/api/oauth';
import './Login.css';

const { Title, Text } = Typography;

// 彩色 Google 图标
const GoogleColorIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" style={{ verticalAlign: '-0.125em' }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// 彩色 Microsoft 图标
const MicrosoftColorIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" style={{ verticalAlign: '-0.125em' }}>
    <path fill="#F25022" d="M1 1h10v10H1z"/>
    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
    <path fill="#FFB900" d="M13 13h10v10H13z"/>
  </svg>
);

// 获取 OAuth 提供商图标
const getOAuthIcon = (providerId: string) => {
  switch (providerId) {
    case 'google':
      return <GoogleColorIcon />;
    case 'microsoft':
      return <MicrosoftColorIcon />;
    case 'apple':
      return <AppleOutlined />;
    case 'aws_cognito':
      return <CloudOutlined />;
    default:
      return null;
  }
};

/**
 * 登录页面组件
 * 提供管理员登录功能
 */
const Login = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { isDark } = useTheme();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading, login } = useAuth();

  // 从location中获取重定向路径
  const from = location.state?.from?.pathname || '/home';

  // 加载OAuth提供商列表
  useEffect(() => {
    const loadProviders = async () => {
      const providers = await oauthAPI.getProviders();
      setOauthProviders(providers);
    };
    loadProviders();
  }, []);

  // 桌面应用：监听 mesalogo:// 协议回调
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.onOAuthProtocolCallback) return;

    const handleOAuthCallback = async (data: { token?: string; error?: string; isNewUser?: boolean }) => {
      console.log('收到 OAuth 协议回调:', data);
      
      if (data.error) {
        message.error(t('message.oauthError') || 'OAuth登录失败');
        return;
      }
      
      if (data.token) {
        // 保存 token 并更新认证状态
        localStorage.setItem('authToken', data.token);
        message.success(t('message.loginSuccess'));
        // 刷新页面以更新认证状态
        window.location.href = from;
      }
    };

    electronAPI.onOAuthProtocolCallback(handleOAuthCallback);

    return () => {
      electronAPI.removeOAuthProtocolCallback?.();
    };
  }, [from, message, t]);

  // 检查是否已登录
  useEffect(() => {
    console.log('Login组件: 检查登录状态, 目标路径:', from, '认证状态:', isAuthenticated, '加载中:', authLoading);

    // 如果已认证且不在加载中，重定向到目标页面
    if (isAuthenticated && !authLoading) {
      console.log('Login组件: 已登录，重定向到:', from);
      // 已登录，重定向到首页或来源页面
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 100); // 添加短暂延迟，确保状态更新
    }
  }, [navigate, from, isAuthenticated, authLoading]);

  // 根据错误类型获取错误消息
  const getErrorMessage = (result) => {
    switch (result.errorType) {
      case 'timeout':
        return t('message.loginTimeout');
      case 'network':
        return t('message.loginNetworkError');
      case 'credentials':
        return result.message !== 'credentials' ? result.message : t('message.loginFailed');
      case 'server':
        return t('message.loginError');
      default:
        return result.message || t('message.loginFailed');
    }
  };

  // 处理OAuth登录
  const handleOAuthLogin = async (provider: string) => {
    setOauthLoading(provider);
    try {
      // 存储 provider 以便回调时使用
      localStorage.setItem('oauth_provider', provider);
      
      // 获取授权 URL
      const authUrl = await oauthAPI.getAuthorizationUrl(provider);
      if (authUrl) {
        // 桌面应用：使用系统浏览器打开认证页面
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.openExternal) {
          electronAPI.openExternal(authUrl);
        } else {
          // Web 应用：直接跳转
          window.location.href = authUrl;
        }
      } else {
        localStorage.removeItem('oauth_provider');
        message.error(t('message.oauthError') || 'OAuth登录失败');
      }
    } catch (error) {
      console.error('OAuth登录错误:', error);
      localStorage.removeItem('oauth_provider');
      message.error(t('message.oauthError') || 'OAuth登录失败');
    } finally {
      setOauthLoading(null);
    }
  };

  // 处理登录表单提交
  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      const { username, password } = values;
      const result = await login(username, password);

      if (result.success) {
        message.success(t('message.loginSuccess'));
        console.log('Login组件: 登录成功，将自动重定向到:', from);
        // 不需要手动重定向，useEffect会处理
      } else {
        // 登录失败，显示错误通知
        message.error(getErrorMessage(result));
      }
    } catch (error) {
      console.error('登录失败:', error);
      message.error(t('message.loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`login-container ${isDark ? 'dark' : ''}`}>
      <ParticlesBackground isDark={isDark} />
      <div className="login-content">
        <div className="login-header">
          <img src={isDark ? "/logo-white.png" : "/logo.png"} alt="Logo" className="login-logo" />
          <Title level={2} className="login-title">{t('login.title')}</Title>
          <Text type="secondary" className="login-subtitle">{t('login.subtitle')}</Text>
        </div>

        <Card
          className="login-card"
        >
          <Form
            form={form}
            name="login"
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: t('validation.required', { field: t('username') }) }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('login.placeholder.username')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t('validation.required', { field: t('password') }) }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('login.placeholder.password')}
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="login-button"
                size="large"
                block
              >
                {t('login.button')}
              </Button>
            </Form.Item>
          </Form>

          {oauthProviders.length > 0 && (
            <>
              <Divider plain style={{ margin: '16px 0' }}>
                <span style={{ color: 'var(--custom-text-secondary)', fontSize: '13px' }}>{t('login.orLoginWith') || '或使用以下方式登录'}</span>
              </Divider>
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {oauthProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    icon={getOAuthIcon(provider.id)}
                    onClick={() => handleOAuthLogin(provider.id)}
                    loading={oauthLoading === provider.id}
                    block
                    size="large"
                  >
                    {t(`login.oauth.${provider.id}`) || `使用 ${provider.name} 登录`}
                  </Button>
                ))}
              </Space>
            </>
          )}

          <div className="login-lang">
            <Text type="secondary" style={{ marginRight: 8 }}>
              {t('settings.platformLanguage')}
            </Text>
            <LanguageSwitcher size="middle" />
            <ThemeSwitch />
          </div>
        </Card>

        <div className="login-footer">
          <Text type="secondary">© 2025 MesaLogo. All Rights Reserved.</Text>
        </div>
      </div>
    </div>
  );
};

export default Login;
