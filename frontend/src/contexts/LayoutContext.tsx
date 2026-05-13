import React, { createContext, useContext, useState, useEffect } from 'react';

const LayoutContext = createContext<any>(null);

// 布局类型常量
export const LAYOUT_TYPES = {
  CLASSIC: 'classic',   // 经典样式（现有）
  MODERN: 'modern'      // 现代样式（新增）
};

const STORAGE_KEY = 'layout_preference';

/**
 * 布局上下文Provider
 * 管理用户的布局样式偏好
 */
export const LayoutProvider = ({ children }) => {
  // 从 localStorage 读取用户偏好，默认使用现代样式
  const [layoutType, setLayoutType] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || LAYOUT_TYPES.MODERN;
  });

  // 切换到指定布局样式
  const switchLayout = (type) => {
    if (type !== LAYOUT_TYPES.CLASSIC && type !== LAYOUT_TYPES.MODERN) {
      console.warn(`Unknown layout type: ${type}, falling back to classic`);
      type = LAYOUT_TYPES.CLASSIC;
    }
    setLayoutType(type);
    localStorage.setItem(STORAGE_KEY, type);
  };

  // 在两种样式之间切换
  const toggleLayout = () => {
    const newType = layoutType === LAYOUT_TYPES.CLASSIC 
      ? LAYOUT_TYPES.MODERN 
      : LAYOUT_TYPES.CLASSIC;
    switchLayout(newType);
  };

  const value = {
    layoutType,
    switchLayout,
    toggleLayout,
    isClassic: layoutType === LAYOUT_TYPES.CLASSIC,
    isModern: layoutType === LAYOUT_TYPES.MODERN,
    LAYOUT_TYPES
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

/**
 * 使用布局上下文的Hook
 */
export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return context;
};
