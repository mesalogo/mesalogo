import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { getIcon } from '../../../constants/menuConfig';

const { Sider } = Layout;

/**
 * 上下文侧边栏
 * 显示当前一级菜单的子菜单
 */
const ContextualSidebar = ({ section, onClose }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // 如果一级菜单没有子菜单，不显示侧边栏
  if (!section || !section.children) {
    return null;
  }

  // 获取一级菜单图标
  const SectionIcon = getIcon(section.icon);

  // 构建菜单项（支持嵌套子菜单）
  const buildMenuItem = (child): any => {
    const ChildIcon = getIcon(child.icon);
    const item: any = {
      key: child.path || child.key,
      icon: ChildIcon ? <ChildIcon /> : null,
      label: t(child.labelKey),
    };

    // 如果有path，添加点击事件
    if (child.path) {
      item.onClick = () => navigate(child.path);
    }

    // 如果有子菜单，递归构建
    if (child.children && child.children.length > 0) {
      item.children = child.children.map(buildMenuItem);
    }

    return item;
  };

  const menuItems = section.children.map(buildMenuItem);

  return (
    <Sider
      width={200}
      className="contextual-sidebar"
      style={{
        position: 'fixed',
        left: 0,
        top: 56,
        height: 'calc(100vh - 56px)',
        background: 'var(--custom-header-bg)',
        borderRight: `1px solid var(--custom-border)`,
        overflow: 'auto',
        zIndex: 10
      }}
    >
      {/* 侧边栏标题 */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid var(--custom-border)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--custom-card-bg)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {SectionIcon && (
            <span style={{ fontSize: '18px', color: '#1677ff' }}>
              <SectionIcon />
            </span>
          )}
          <span style={{ fontSize: '14px', fontWeight: '600' }}>
            {t(section.labelKey)}
          </span>
        </div>
        <Button
          type="text"
         
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{ fontSize: '12px' }}
        />
      </div>

      {/* 子菜单列表 */}
      <Menu
        mode="inline"
        defaultOpenKeys={(() => {
          // 自动展开包含当前路由的子菜单
          const findParentKeys = (items, pathname, parentKey = null) => {
            const keys = [];
            for (const item of items) {
              if (item.children) {
                const childKeys = findParentKeys(item.children, pathname, item.key);
                if (childKeys.length > 0) {
                  keys.push(item.key, ...childKeys);
                  return keys;
                }
              } else if (item.key === pathname) {
                return parentKey ? [parentKey] : [];
              }
            }
            return keys;
          };
          return findParentKeys(menuItems, location.pathname);
        })()}
        selectedKeys={(() => {
          // 递归查找匹配的菜单项（支持嵌套）
          const findMatchingKey = (items, pathname) => {
            for (const item of items) {
              // 精确匹配
              if (item.key === pathname) {
                return item.key;
              }
              
              // 如果有子菜单，递归查找
              if (item.children) {
                const childMatch = findMatchingKey(item.children, pathname);
                if (childMatch) return childMatch;
              }
            }
            return null;
          };

          // 先尝试精确匹配
          const exactMatch = findMatchingKey(menuItems, location.pathname);
          if (exactMatch) return [exactMatch];
          
          // 前缀匹配（用于详情页等）
          let firstSegment = location.pathname.split('/').filter(Boolean)[0];
          if (firstSegment) {
            // 处理路径别名
            const pathAliasMap = {
              'action-space': 'action-spaces',
              'knowledge': 'knowledges',
            };
            if (pathAliasMap[firstSegment]) {
              firstSegment = pathAliasMap[firstSegment];
            }
            
            const pathPrefix = `/${firstSegment}`;
            
            // 递归查找前缀匹配
            const findPrefixMatch = (items) => {
              for (const item of items) {
                if (item.key && item.key.startsWith(pathPrefix)) {
                  return item.key;
                }
                if (item.children) {
                  const childMatch = findPrefixMatch(item.children);
                  if (childMatch) return childMatch;
                }
              }
              return null;
            };
            
            const prefixMatch = findPrefixMatch(menuItems);
            if (prefixMatch) return [prefixMatch];
          }
          
          return [];
        })()}
        style={{
          border: 'none',
          background: 'transparent',
          padding: '8px'
        }}
        items={menuItems}
      />
    </Sider>
  );
};

export default ContextualSidebar;
