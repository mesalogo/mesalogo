import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserPermissions, hasPermission } from '../../constants/permissions';

/**
 * 权限保护组件
 * 用于保护需要特定权限才能访问的路由
 */
const PermissionGuard = ({ children, requiredPermission, redirectTo = '/home' }) => {
  const { user } = useAuth();
  
  // 如果没有权限要求，直接渲染子组件
  if (!requiredPermission) {
    return children;
  }
  
  // 获取用户权限
  const userPermissions = getUserPermissions(user);
  
  // 检查用户是否有所需权限
  if (hasPermission(userPermissions, requiredPermission)) {
    return children;
  }
  
  // 没有权限，重定向到指定页面
  return <Navigate to={redirectTo} replace />;
};

export default PermissionGuard;

