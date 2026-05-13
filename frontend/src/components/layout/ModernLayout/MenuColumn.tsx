import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getIcon } from '../../../constants/menuConfig';

/**
 * 菜单列组件
 * 展示一个菜单section及其子菜单
 */
const MenuColumn = ({ section, onSelect, searchText }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 获取图标组件
  const IconComponent = getIcon(section.icon);

  // 如果没有子菜单，显示为单个按钮
  if (!section.children) {
    return (
      <div
        className="menu-section-item"
        onClick={() => {
          onSelect(section, {
            key: section.key,
            path: section.path,
            labelKey: section.labelKey,
            icon: section.icon
          });
        }}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          borderRadius: '6px',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        {IconComponent && (
          <span style={{ fontSize: '18px', color: '#1677ff' }}>
            <IconComponent />
          </span>
        )}
        <span style={{ fontSize: '14px', fontWeight: '500' }}>
          {t(section.labelKey)}
        </span>
      </div>
    );
  }

  // 递归渲染子菜单项（支持嵌套）
  const renderMenuItem = (child, level = 2) => {
    const ChildIcon = getIcon(child.icon);
    const label = t(child.labelKey);
    // 调整缩进：二级40px，三级60px
    const paddingLeft = level === 2 ? 40 : 40 + (level - 2) * 20;
    
    // 搜索高亮
    let labelElement = <span>{label}</span>;
    if (searchText) {
      const regex = new RegExp(`(${searchText})`, 'gi');
      const parts = label.split(regex);
      labelElement = (
        <span>
          {parts.map((part, i) =>
            part.toLowerCase() === searchText.toLowerCase() ? (
              <span key={i} style={{ background: '#fadb14', fontWeight: '600' }}>
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </span>
      );
    }

    // 如果有子菜单，渲染为子分组
    if (child.children && child.children.length > 0) {
      // 递归过滤子菜单
      const filteredGrandChildren = searchText
        ? child.children.filter((grandChild) =>
            t(grandChild.labelKey).toLowerCase().includes(searchText.toLowerCase())
          )
        : child.children;

      // 如果搜索后没有匹配的子项，不显示
      if (searchText && filteredGrandChildren.length === 0) {
        return null;
      }

      return (
        <div key={child.key} style={{ marginBottom: '8px' }}>
          {/* 子分组标题 */}
          <div
            style={{
              padding: `4px 12px 4px ${paddingLeft}px`,
              fontSize: '13px',
              color: 'var(--custom-text-secondary)',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {ChildIcon && (
              <span style={{ fontSize: '14px', color: 'var(--custom-text-secondary)' }}>
                <ChildIcon />
              </span>
            )}
            {labelElement}
          </div>
          {/* 递归渲染子菜单 */}
          {filteredGrandChildren.map((grandChild) =>
            renderMenuItem(grandChild, level + 1)
          )}
        </div>
      );
    }

    // 叶子节点，渲染为可点击项
    return (
      <div
        key={child.key}
        className="menu-child-item"
        onClick={() => {
          onSelect(section, child);
        }}
        style={{
          padding: `6px 12px 6px ${paddingLeft}px`,
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
        {/* 始终预留icon空间，保持对齐 */}
        {ChildIcon ? (
          <span style={{ fontSize: '12px', color: 'inherit', width: '12px', flexShrink: 0 }}>
            <ChildIcon />
          </span>
        ) : (
          <span style={{ fontSize: '12px', color: 'inherit', width: '12px', flexShrink: 0 }}>•</span>
        )}
        {labelElement}
      </div>
    );
  };

  // 过滤搜索结果（递归）
  const filterChildren = (children, searchLower) => {
    if (!searchLower) return children;
    
    return children.filter((child) => {
      const labelMatch = t(child.labelKey).toLowerCase().includes(searchLower);
      // 如果当前项匹配，或者有子项匹配，则保留
      if (labelMatch) return true;
      if (child.children) {
        const filteredGrandChildren = filterChildren(child.children, searchLower);
        return filteredGrandChildren.length > 0;
      }
      return false;
    });
  };

  const filteredChildren = filterChildren(
    section.children,
    searchText?.toLowerCase()
  );

  // 如果没有子菜单项（搜索过滤后或原本就没有），不显示该section
  if (!filteredChildren || filteredChildren.length === 0) {
    return null;
  }

  // 有子菜单，显示为一级标题 + 子菜单列表
  return (
    <div className="menu-section" style={{ marginBottom: '12px' }}>
      {/* 一级菜单标题（不可点击） */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '4px'
        }}
      >
        {IconComponent && (
          <span style={{ fontSize: '18px', color: '#1677ff' }}>
            <IconComponent />
          </span>
        )}
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--custom-text)' }}>
          {t(section.labelKey)}
        </span>
      </div>

      {/* 子菜单列表（支持递归渲染） */}
      <div className="menu-section-children">
        {filteredChildren.map((child) => renderMenuItem(child))}
      </div>
    </div>
  );
};

export default MenuColumn;
