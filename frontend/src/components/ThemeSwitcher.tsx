import React from 'react';
import { Switch, Dropdown, Button } from 'antd';
import { SunOutlined, MoonOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

// 简单图标按钮版本（太阳/月亮切换）
export const ThemeSwitch: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  
  return (
    <Button
      type="text"
      icon={isDark ? <MoonOutlined /> : <SunOutlined />}
      onClick={toggleTheme}
      style={{ fontSize: 16 }}
    />
  );
};

// 下拉菜单版本（支持跟随系统）
export const ThemeDropdown: React.FC = () => {
  const { t } = useTranslation();
  const { themeMode, setThemeMode, isDark } = useTheme();
  
  const items = [
    { key: 'light', label: t('theme.light') || '亮色模式', icon: <SunOutlined /> },
    { key: 'dark', label: t('theme.dark') || '暗色模式', icon: <MoonOutlined /> },
    { key: 'system', label: t('theme.system') || '跟随系统', icon: <SettingOutlined /> },
  ];

  return (
    <Dropdown
      menu={{
        items,
        selectedKeys: [themeMode],
        onClick: ({ key }) => setThemeMode(key as 'light' | 'dark' | 'system'),
      }}
    >
      <Button icon={isDark ? <MoonOutlined /> : <SunOutlined />} />
    </Dropdown>
  );
};

export default ThemeSwitch;
