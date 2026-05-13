import React, { useState, useMemo } from 'react';
import { Drawer, Input } from 'antd';
import { SearchOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { menuConfig, multiColumnConfig, filterMenuByPermission, getIcon } from '../../../constants/menuConfig';
import MenuColumn from './MenuColumn';
import ShortcutColumn from './ShortcutColumn';

const RECENT_KEY = 'menu_recent_visited';

// 获取最近访问
const getRecentVisited = () => {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * 全局菜单抽屉
 * 多列布局展示所有菜单选项
 */
const GlobalMenuDrawer = ({ visible, onClose, onSelect }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [searchText, setSearchText] = useState('');
  const [recentItems, setRecentItems] = useState(getRecentVisited());

  // 判断是否为管理员
  const isAdmin = useMemo(() => {
    const userRole = user?.roles?.[0]?.user_role?.name;
    return userRole === 'super_admin';
  }, [user]);

  // 根据权限过滤菜单
  const filteredMenuConfig = useMemo(() => {
    return filterMenuByPermission(menuConfig, isAdmin);
  }, [isAdmin]);

  // 构建多列数据，并过滤掉没有可显示内容的列
  const columnData = useMemo(() => {
    return multiColumnConfig.map(column => {
      if (column.type === 'shortcuts') {
        return column;
      }

      const sections = column.sections
        .map(sectionKey => {
          if (typeof sectionKey === 'string') {
            const menu = filteredMenuConfig.find(m => m.key === sectionKey);
            if (menu && menu.children && menu.children.length === 0) {
              return null;
            }
            return menu;
          } else {
            return sectionKey;
          }
        })
        .filter(Boolean);

      return {
        ...column,
        sections
      };
    }).filter(column => column.sections && column.sections.length > 0);
  }, [filteredMenuConfig]);

  // ESC 关闭抽屉 & 刷新最近访问
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && visible) {
        onClose();
      }
    };

    if (visible) {
      setRecentItems(getRecentVisited());
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  return (
    <Drawer
      placement="left"
      size="large"
      open={visible}
      onClose={onClose}
      closeIcon={null}
      styles={{ body: { padding: 0 } }}
      className="global-menu-drawer"
      zIndex={900}
    >
      {/* 搜索栏 */}
      <div
        style={{
          padding: '20px 40px 16px',
          borderBottom: `1px solid var(--custom-border)`,
          background: 'var(--custom-header-bg)'
        }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('search') + '...'}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="large"
          suffix={
            <span style={{ color: 'var(--custom-text-secondary)', fontSize: '12px' }}>
              ESC {t('close')}
            </span>
          }
          autoFocus
          allowClear
        />
        
        {/* 最近访问 */}
        {recentItems.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--custom-text-secondary)', 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ClockCircleOutlined />
              <span>{t('menu.recentVisited')}</span>
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px'
            }}>
              {recentItems.map((item, index) => {
                const IconComponent = getIcon(item.icon);
                return (
                  <div
                    key={item.key + '-' + index}
                    onClick={() => {
                      navigate(item.path);
                      onClose();
                    }}
                    style={{
                      padding: '8px 12px',
                      background: isDark ? '#141414' : 'var(--custom-card-bg)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: `1px solid var(--custom-border)`,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#1677ff';
                      e.currentTarget.style.background = isDark ? '#111d2c' : '#f0f7ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--custom-border)';
                      e.currentTarget.style.background = 'var(--custom-card-bg)';
                    }}
                  >
                    {IconComponent && (
                      <span style={{ fontSize: '14px', color: '#1677ff' }}>
                        <IconComponent />
                      </span>
                    )}
                    <span style={{ 
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {t(item.labelKey)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 多列菜单网格 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnData.length}, 1fr)`,
          gap: '24px',
          padding: '24px',
          flex: 1,
          overflow: 'auto'
        }}
      >
        {columnData.map((column, idx) => (
          <div key={column.key || idx} className="menu-column">
            {/* 列标题 */}
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--custom-text-secondary)',
                textTransform: 'uppercase',
                marginBottom: '12px',
                letterSpacing: '0.5px'
              }}
            >
              {t(column.titleKey)}
            </div>

            {/* 列内容 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {column.sections.map((section) => (
                <MenuColumn
                  key={section.key}
                  section={section}
                  onSelect={onSelect}
                  searchText={searchText}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
};

export default GlobalMenuDrawer;
