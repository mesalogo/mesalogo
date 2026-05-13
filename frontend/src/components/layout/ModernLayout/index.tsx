import React, { useState, useEffect } from 'react';
import { Layout, Button, Space, Avatar, Dropdown, App } from 'antd';
import { MenuOutlined, UserOutlined, LogoutOutlined, LockOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import GlobalMenuDrawer from './GlobalMenuDrawer';
import ContextualSidebar from './ContextualSidebar';
import LayoutSwitcher from '../LayoutSwitcher';
import LanguageSwitcher from '../../LanguageSwitcher';
import { ThemeSwitch } from '../../ThemeSwitcher';
import { JobCenterButton } from '../../Jobs';
import ChangePasswordModal from '../../auth/ChangePasswordModal';
import { inferSectionFromPath } from '../../../constants/menuConfig';
import './styles.css';

const { Header, Content } = Layout;
const STORAGE_KEY = 'modern_layout_current_section';

/**
 * 现代布局组件
 * - 顶部：Logo + 搜索 + 操作按钮
 * - 左上角菜单按钮：打开多列抽屉
 * - 左侧：上下文侧边栏（根据当前路由显示）
 */
const ModernLayout = ({ children }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark } = useTheme();

  // 状态管理
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [currentSection, setCurrentSection] = useState(() => {
    // 尝试从 localStorage 恢复
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  // 根据路由变化自动更新侧边栏
  useEffect(() => {
    const section = inferSectionFromPath(location.pathname);
    if (section && section.children) {
      setCurrentSection(section);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(section));
    }
  }, [location.pathname]);

  // 添加到最近访问（LRU 逻辑）
  const addToRecent = (item) => {
    const RECENT_KEY = 'menu_recent_visited';
    const MAX_RECENT = 3;  // 只保留最近3个
    
    try {
      let recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      
      // 检查是否已存在（通过 path 判断）
      const existingIndex = recent.findIndex(r => r.path === item.path);
      
      // 如果已存在，先移除
      if (existingIndex !== -1) {
        recent.splice(existingIndex, 1);
      }
      
      // 添加到开头
      recent.unshift({
        key: item.key || item.path,
        labelKey: item.labelKey,  // 存储国际化键值
        path: item.path,
        icon: item.icon,
        timestamp: Date.now()
      });
      
      // 限制数量为3
      recent = recent.slice(0, MAX_RECENT);
      
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to add to recent:', error);
    }
  };

  // 处理菜单选择
  const handleMenuSelect = (section, item) => {
    if (section && section.children) {
      setCurrentSection(section);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(section));
    } else {
      // 无子菜单，隐藏侧边栏
      setCurrentSection(null);
      localStorage.removeItem(STORAGE_KEY);
    }
    
    setDrawerVisible(false);
    
    if (item?.path) {
      // 添加到最近访问
      addToRecent(item);
      navigate(item.path);
    }
  };

  // 关闭侧边栏
  const handleCloseSidebar = () => {
    setCurrentSection(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // 处理登出
  const handleLogout = async () => {
    try {
      await logout();
      message.success(t('user.logoutSuccess') || '已成功登出');
      navigate('/login');
    } catch (error) {
      console.error('登出失败:', error);
      message.error(t('user.logoutFailed') || '登出失败，请稍后再试');
    }
  };

  // 处理修改密码
  const handleChangePassword = () => {
    setChangePasswordVisible(true);
  };

  // 修改密码成功回调
  const handleChangePasswordSuccess = () => {
    message.success(t('user.passwordChangeSuccess') || '密码修改成功');
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: t('user.changePassword'),
      onClick: handleChangePassword
    },
    {
      type: 'divider' as const
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('user.logout'),
      onClick: handleLogout,
      danger: true
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', position: 'relative' }} className="modern-layout">
      {/* Header */}
      <Header
        className="modern-layout-header"
        style={{
          position: 'fixed',
          zIndex: 1001,
          width: '100%',
          height: '56px',
          background: 'var(--custom-card-bg)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          borderBottom: `1px solid var(--custom-border)`,
          boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)'
        }}
      >
        {/* 左侧：菜单按钮 + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerVisible(!drawerVisible)}
            style={{
              fontSize: '18px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: drawerVisible ? '#1677ff' : undefined
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/home')}
          >
            <img
              src={isDark ? "/logo-white.png" : "/logo.png"}
              alt="Logo"
              style={{
                width: '20px',
                height: '20px',
                objectFit: 'contain'
              }}
            />
            <span
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1677ff'
              }}
            >
              MesaLogo
            </span>
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <Space
          style={{ marginLeft: 'auto' }}
         
        >
          <JobCenterButton />
          <LanguageSwitcher />
          <ThemeSwitch />
          <LayoutSwitcher />
          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
               
                style={{ backgroundColor: '#1677ff' }}
                icon={<UserOutlined />}
              />
              <span>{user?.display_name || user?.username || t('user.admin')}</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>

      {/* 全局导航抽屉 */}
      <GlobalMenuDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onSelect={handleMenuSelect}
      />

      {/* 上下文侧边栏 */}
      {currentSection && currentSection.children && (
        <ContextualSidebar
          section={currentSection}
          onClose={handleCloseSidebar}
        />
      )}

      {/* 主内容区 */}
      <Content
        className="modern-layout-content"
        style={{
          marginTop: 56,
          marginLeft: currentSection?.children ? 200 : 0,
          padding: '24px',
          transition: 'margin-left 0.3s ease',
          minHeight: 'calc(100vh - 56px)'
        }}
      >
        {children}
      </Content>

      {/* 修改密码Modal */}
      <ChangePasswordModal
        visible={changePasswordVisible}
        onCancel={() => setChangePasswordVisible(false)}
        onSuccess={handleChangePasswordSuccess}
      />
    </Layout>
  );
};

export default ModernLayout;
