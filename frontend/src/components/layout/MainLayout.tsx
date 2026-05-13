import React, { useState, useMemo } from 'react';
import { Layout, Menu, Typography, Space, Avatar, Button, Dropdown, App } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ChangePasswordModal from '../auth/ChangePasswordModal';
import LanguageSwitcher from '../LanguageSwitcher';
import { ThemeSwitch } from '../ThemeSwitcher';
import { JobCenterButton } from '../Jobs';
import LayoutSwitcher from './LayoutSwitcher';
import { menuConfig, filterMenuByPermission, iconMap } from '../../constants/menuConfig';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  LockOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

/**
 * 将 menuConfig 转换为 Ant Design Menu 的 items 格式
 */
const convertMenuConfigToItems = (config: any[], t: any): any[] => {
  return config.map(item => {
    const IconComponent = iconMap[item.icon];
    
    const menuItem: any = {
      key: item.children ? item.key : item.path,
      icon: IconComponent ? <IconComponent style={{ fontSize: item.children ? '18px' : '14px' }} /> : null,
      label: item.children 
        ? <span style={{ fontWeight: 'bold' }}>{t(item.labelKey)}</span>
        : <Link to={item.path}>{t(item.labelKey)}</Link>,
    };

    if (item.children && item.children.length > 0) {
      menuItem.children = item.children.map(child => {
        const ChildIconComponent = iconMap[child.icon];
        return {
          key: child.path,
          icon: ChildIconComponent ? <ChildIconComponent style={{ fontSize: '14px' }} /> : null,
          label: <Link to={child.path}>{t(child.labelKey)}</Link>,
        };
      });
    }

    return menuItem;
  });
};

const MainLayout = ({ children }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);

  const toggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem('sidebarCollapsed', newCollapsed.toString());
  };

  const handleLogout = async () => {
    try {
      await logout();
      message.success(t('user.logoutSuccess'));
      navigate('/login');
    } catch (error) {
      console.error('登出失败:', error);
      message.error('登出失败，请稍后再试');
    }
  };

  const handleChangePassword = () => {
    setChangePasswordVisible(true);
  };

  const handleChangePasswordSuccess = () => {
    message.success('密码修改成功');
  };

  const isAdmin = useMemo(() => {
    const userRole = user?.roles?.[0]?.user_role?.name;
    return userRole === 'super_admin';
  }, [user]);

  // 使用统一的 menuConfig，根据权限过滤
  const filteredMenuConfig = useMemo(() => {
    return filterMenuByPermission(menuConfig, isAdmin);
  }, [isAdmin]);

  // 转换为 Ant Design Menu items 格式
  const menuItems = useMemo(() => {
    return convertMenuConfigToItems(filteredMenuConfig, t);
  }, [filteredMenuConfig, t]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        position: 'fixed',
        zIndex: 10,
        width: '100%',
        height: '50px',
        lineHeight: '50px',
        background: 'var(--custom-card-bg)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: isDark ? '0 1px 4px rgba(0, 0, 0, 0.3)' : '0 1px 4px rgba(0, 0, 0, 0.08)',
        borderBottom: `1px solid var(--custom-border)`
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={isDark ? "/logo-white.png" : "/logo.png"}
              alt="Logo"
              style={{
                width: '20px',
                height: '20px',
                objectFit: 'contain',
                display: 'block'
              }}
            />
            <Title
              level={5}
              style={{
                margin: 0,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
                lineHeight: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => navigate('/home')}
              onMouseEnter={(e) => (e.target as HTMLElement).style.opacity = '0.8'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.opacity = '1'}
            >
              <span style={{ color: '#1677ff' }}>MesaLogo</span>
            </Title>
          </div>
        </div>
        <Space>
          <JobCenterButton />
          <LanguageSwitcher />
          <ThemeSwitch />
          <LayoutSwitcher />
          <Dropdown
            menu={{
              items: [
                {
                  key: '1',
                  icon: <LockOutlined />,
                  label: t('user.changePassword'),
                  onClick: handleChangePassword,
                },
                {
                  key: '2',
                  icon: <LogoutOutlined />,
                  label: t('user.logout'),
                  onClick: handleLogout,
                  danger: true
                },
              ],
            }}
            placement="bottomRight"
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                style={{
                  backgroundColor: '#1677ff',
                }}
                icon={<UserOutlined />}
              />
              <span>{user?.display_name || user?.username || t('user.admin')}</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <Layout style={{ marginTop: 50 }}>
        <Sider
          width={260}
          collapsible
          collapsed={collapsed}
          trigger={null}
          collapsedWidth={80}
          style={{
            background: 'var(--custom-card-bg)',
            boxShadow: isDark ? '0 1px 4px rgba(0, 0, 0, 0.3)' : '0 1px 4px rgba(0, 0, 0, 0.08)',
            position: 'fixed',
            height: 'calc(100vh - 50px)',
            left: 0,
            overflow: 'auto',
            borderRight: `1px solid var(--custom-border)`,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{
            padding: collapsed ? '0 0 20px 0' : '0 20px 20px 20px',
            borderBottom: `1px solid var(--custom-border)`,
            textAlign: collapsed ? 'center' : 'left',
            marginTop: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '0' : '0 16px',
              height: '40px'
            }}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapsed}
                style={{
                  width: collapsed ? '48px' : '100%',
                  borderRadius: '2px',
                  fontSize: '16px',
                  color: 'var(--custom-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start'
                }}
              >
                {!collapsed && <span style={{ marginLeft: '8px', fontSize: '12px' }}>{t('menu.collapse')}</span>}
              </Button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname + location.search]}
              defaultOpenKeys={[]}
              style={{
                border: 'none',
                padding: '16px 0'
              }}
              items={menuItems.map(item => ({
                ...item,
                style: {
                  margin: '4px 0',
                }
              }))}
            />
          </div>
        </Sider>
        <Layout style={{
          padding: '24px',
          marginLeft: collapsed ? 80 : 260,
          minHeight: 'calc(100vh - 50px)',
          transition: 'margin-left 0.2s'
        }}>
          <Content style={{
            background: 'transparent',
            padding: 0
          }}>
            {children}
          </Content>
        </Layout>
      </Layout>

      <ChangePasswordModal
        visible={changePasswordVisible}
        onCancel={() => setChangePasswordVisible(false)}
        onSuccess={handleChangePasswordSuccess}
      />
    </Layout>
  );
};

export default MainLayout;
