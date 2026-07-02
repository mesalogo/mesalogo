import React from 'react';
import { Button, Tooltip, Dropdown } from 'antd';
import { 
  LayoutOutlined, 
  MenuOutlined,
  AppstoreOutlined,
  CheckOutlined 
} from '@ant-design/icons';
import { useLayout, LAYOUT_TYPES } from '../../contexts/LayoutContext';
import { useTranslation } from 'react-i18next';

/**
 * 布局样式切换器组件
 * 允许用户在经典样式和现代样式之间切换
 */
const LayoutSwitcher = () => {
  const { layoutType, switchLayout } = useLayout();
  const { t } = useTranslation();

  const menuItems = [
    {
      key: LAYOUT_TYPES.CLASSIC,
      icon: <MenuOutlined />,
      label: (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          minWidth: '160px',
          gap: '12px'
        }}>
          <span>{t('layout.classic')}</span>
          {layoutType === LAYOUT_TYPES.CLASSIC && (
            <CheckOutlined style={{ color: '#1677ff' }} />
          )}
        </div>
      ),
      onClick: () => switchLayout(LAYOUT_TYPES.CLASSIC)
    },
    {
      key: LAYOUT_TYPES.MODERN,
      icon: <AppstoreOutlined />,
      label: (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          minWidth: '160px',
          gap: '12px'
        }}>
          <span>{t('layout.modern')}</span>
          {layoutType === LAYOUT_TYPES.MODERN && (
            <CheckOutlined style={{ color: '#1677ff' }} />
          )}
        </div>
      ),
      onClick: () => switchLayout(LAYOUT_TYPES.MODERN)
    }
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Tooltip title={t('layout.switchStyle')} placement="bottom">
        <Button
          type="text"
          icon={<LayoutOutlined />}
          style={{ 
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        />
      </Tooltip>
    </Dropdown>
  );
};

export default LayoutSwitcher;
