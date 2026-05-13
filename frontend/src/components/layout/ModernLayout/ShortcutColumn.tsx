import React, { useState, useEffect } from 'react';
import { StarOutlined, ClockCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const FAVORITES_KEY = 'menu_favorites';
const RECENT_KEY = 'menu_recent_visited';
const MAX_RECENT = 5;

/**
 * 获取收藏的菜单
 */
const getFavorites = () => {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * 获取最近访问
 */
const getRecentVisited = () => {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * 移除收藏
 */
const removeFromFavorites = (key) => {
  const favorites = getFavorites().filter((f) => f.key !== key);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
};

/**
 * 格式化时间
 */
const formatTimeAgo = (timestamp, t) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return t('time.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('time.daysAgo', { count: days });
};

/**
 * 快捷入口列
 * 显示收藏和最近访问
 */
const ShortcutColumn = ({ onSelect }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState(getFavorites());
  const [recent, setRecent] = useState(getRecentVisited());

  // 定期刷新最近访问时间显示
  useEffect(() => {
    const interval = setInterval(() => {
      setRecent(getRecentVisited());
    }, 60000); // 每分钟刷新
    return () => clearInterval(interval);
  }, []);

  const handleRemoveFavorite = (e, key) => {
    e.stopPropagation();
    removeFromFavorites(key);
    setFavorites(getFavorites());
  };

  const handleNavigate = (path) => {
    navigate(path);
    // 关闭抽屉由父组件处理
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 收藏的功能 */}
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px'
          }}
        >
          <StarOutlined style={{ color: '#faad14', fontSize: '16px' }} />
          <span>{t('menu.favorites')}</span>
        </div>

        {favorites.length === 0 ? (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--custom-text-secondary)',
              padding: '8px 12px'
            }}
          >
            {t('menu.noFavorites')}
          </div>
        ) : (
          favorites.map((item) => (
            <div
              key={item.key}
              className="menu-child-item shortcut-item"
              onClick={() => handleNavigate(item.path)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--custom-text-secondary)',
                borderRadius: '4px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {item.icon && <span style={{ fontSize: '14px' }}>{item.icon}</span>}
              <span style={{ flex: 1 }}>{item.label}</span>
              <CloseOutlined
                style={{ fontSize: '10px', opacity: 0.5 }}
                onClick={(e) => handleRemoveFavorite(e, item.key)}
              />
            </div>
          ))
        )}
      </div>

      {/* 最近访问 */}
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px'
          }}
        >
          <ClockCircleOutlined style={{ color: '#1677ff', fontSize: '16px' }} />
          <span>{t('menu.recentVisited')}</span>
        </div>

        {recent.length === 0 ? (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--custom-text-secondary)',
              padding: '8px 12px'
            }}
          >
            {t('menu.noRecentVisited')}
          </div>
        ) : (
          recent.map((item) => (
            <div
              key={item.key}
              className="menu-child-item shortcut-item"
              onClick={() => handleNavigate(item.path)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--custom-text-secondary)',
                borderRadius: '4px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {item.icon && <span style={{ fontSize: '14px' }}>{item.icon}</span>}
              <span style={{ flex: 1 }}>{item.label}</span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--custom-text-secondary)',
                  opacity: 0.7
                }}
              >
                {formatTimeAgo(item.timestamp, t)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ShortcutColumn;
