import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../../constants/permissions';

/**
 * 页面权限保护组件 - 遵循KISS原则的页面级权限控制
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.permission - 单个权限要求
 * @param {string[]} props.anyPermissions - 任意权限要求（满足其中一个即可）
 * @param {string[]} props.allPermissions - 全部权限要求（必须全部满足）
 * @param {React.ReactNode} props.children - 子组件
 * @param {boolean} props.adminOnly - 是否仅限管理员
 * @param {string} props.title - 无权限时显示的标题
 * @param {string} props.subTitle - 无权限时显示的副标题
 * @returns {React.ReactNode} 渲染的组件
 */
const PagePermissionGuard = ({ 
  permission, 
  anyPermissions, 
  allPermissions, 
  children, 
  adminOnly = false,
  title = '403',
  subTitle = '抱歉，您没有权限访问此页面。'
}) => {
  const { user, permissions, hasAdminPermission } = useAuth();
  const navigate = useNavigate();

  // 如果用户未登录，这种情况应该由ProtectedRoute处理
  if (!user) {
    return (
      <Result
        status="403"
        title="401"
        subTitle="请先登录系统。"
        extra={
          <Button type="primary" onClick={() => navigate('/login')}>
            去登录
          </Button>
        }
      />
    );
  }

  // 检查权限
  let hasRequiredPermission = true;

  // 如果仅限管理员且用户不是管理员
  if (adminOnly && !hasAdminPermission()) {
    hasRequiredPermission = false;
  }
  // 管理员拥有所有权限，跳过其他检查
  else if (!hasAdminPermission()) {
    // 检查单个权限
    if (permission && !hasPermission(permissions, permission)) {
      hasRequiredPermission = false;
    }
    // 检查任意权限
    else if (anyPermissions && !hasAnyPermission(permissions, anyPermissions)) {
      hasRequiredPermission = false;
    }
    // 检查全部权限
    else if (allPermissions && !hasAllPermissions(permissions, allPermissions)) {
      hasRequiredPermission = false;
    }
  }

  // 如果没有权限，显示403页面
  if (!hasRequiredPermission) {
    return (
      <Result
        status="403"
        title={title}
        subTitle={subTitle}
        extra={
          <Button type="primary" onClick={() => navigate('/home')}>
            返回首页
          </Button>
        }
      />
    );
  }

  return children;
};

export default PagePermissionGuard;
