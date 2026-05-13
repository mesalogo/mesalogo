import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../../constants/permissions';

/**
 * 权限包装组件 - 遵循KISS原则的简单权限控制
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.permission - 单个权限要求
 * @param {string[]} props.anyPermissions - 任意权限要求（满足其中一个即可）
 * @param {string[]} props.allPermissions - 全部权限要求（必须全部满足）
 * @param {React.ReactNode} props.children - 子组件
 * @param {React.ReactNode} props.fallback - 无权限时显示的内容
 * @param {boolean} props.adminOnly - 是否仅限管理员
 * @returns {React.ReactNode} 渲染的组件
 */
const PermissionWrapper = ({ 
  permission, 
  anyPermissions, 
  allPermissions, 
  children, 
  fallback = null,
  adminOnly = false 
}) => {
  const { user, permissions, hasAdminPermission } = useAuth();

  // 如果用户未登录，不显示内容
  if (!user) {
    return fallback;
  }

  // 如果仅限管理员且用户不是管理员
  if (adminOnly && !hasAdminPermission()) {
    return fallback;
  }

  // 管理员拥有所有权限
  if (hasAdminPermission()) {
    return children;
  }

  // 检查单个权限
  if (permission && !hasPermission(permissions, permission)) {
    return fallback;
  }

  // 检查任意权限
  if (anyPermissions && !hasAnyPermission(permissions, anyPermissions)) {
    return fallback;
  }

  // 检查全部权限
  if (allPermissions && !hasAllPermissions(permissions, allPermissions)) {
    return fallback;
  }

  return children;
};

export default PermissionWrapper;
