import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * 受保护路由组件
 * 用于保护需要登录才能访问的路由
 *
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 子组件
 * @returns {React.ReactNode} 渲染的组件
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute: 路径:', location.pathname, '认证状态:', isAuthenticated, '加载中:', loading);

  // 如果正在初始化认证状态，静默等待（不显示加载界面）
  if (loading) {
    console.log('ProtectedRoute: 正在初始化认证状态，静默等待');
    return null; // 不显示任何内容，静默等待
  }

  // 如果未登录，重定向到登录页面，并记录当前路径
  if (!isAuthenticated) {
    console.log('ProtectedRoute: 未认证，重定向到登录页面');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 已登录，渲染子组件
  console.log('ProtectedRoute: 已认证，渲染子组件');
  return children;
};

export default ProtectedRoute;
