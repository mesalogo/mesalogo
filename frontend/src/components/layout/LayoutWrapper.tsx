import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { useLayout, LAYOUT_TYPES } from '../../contexts/LayoutContext';
import MainLayout from './MainLayout';

// 懒加载现代布局
const ModernLayout = lazy(() => import('./ModernLayout'));

/**
 * 布局包装器
 * 根据用户选择的样式渲染对应的布局组件
 */
const LayoutWrapper = ({ children }) => {
  const { layoutType } = useLayout();

  // 加载占位组件
  const LoadingFallback = () => (
    <Spin size="large" tip="加载中..." spinning={true}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh' 
      }} />
    </Spin>
  );

  // 现代样式
  if (layoutType === LAYOUT_TYPES.MODERN) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ModernLayout>{children}</ModernLayout>
      </Suspense>
    );
  }

  // 默认使用经典样式
  return <MainLayout>{children}</MainLayout>;
};

export default LayoutWrapper;
