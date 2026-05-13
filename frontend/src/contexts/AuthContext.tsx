import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { authAPI } from '../services/api/auth';
import api from '../services/api/axios';

// 创建两个独立的上下文：状态和操作分离
const AuthStateContext = createContext<any>(null);
const AuthActionsContext = createContext<any>(null);

/**
 * 认证上下文提供者组件
 * 管理全局认证状态，使用状态和操作分离的模式优化性能
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [menuPermissions, setMenuPermissions] = useState([]);

  // 初始化时检查登录状态
  useEffect(() => {
    // 添加标志，防止重复初始化
    let isMounted = true;
    console.log('AuthContext: 初始化认证状态');

    const initAuth = async () => {
      const token = localStorage.getItem('authToken');
      console.log('AuthContext: 检查token:', !!token);

      if (token) {
        try {
          // 验证token有效性并获取用户信息
          console.log('AuthContext: 验证token有效性并获取用户信息');
          const isValid = await authAPI.validateToken();
          console.log('AuthContext: token验证结果:', isValid);

          if (isValid) {
            // 获取用户信息
            console.log('AuthContext: 获取用户信息');
            const userResult = await authAPI.getCurrentUser();
            console.log('AuthContext: 用户信息结果:', userResult);

            // 只有当组件仍然挂载时才更新状态
            if (isMounted) {
              if (userResult.success) {
                setUser(userResult.user);
                setIsAuthenticated(true);

                // 获取用户权限
                await fetchUserPermissions();

                setLoading(false); // 用户信息加载完成后才结束loading
                console.log('AuthContext: 认证成功，用户:', userResult.user);
              } else {
                // 获取用户信息失败，清除token并重定向
                console.log('AuthContext: 获取用户信息失败');
                localStorage.removeItem('authToken');
                setIsAuthenticated(false);
                setLoading(false);
                // 强制刷新页面到登录页
                window.location.href = '/login';
              }
            }
          } else {
            // token无效，清除token并重定向
            console.log('AuthContext: token无效');
            if (isMounted) {
              localStorage.removeItem('authToken');
              setIsAuthenticated(false);
              setLoading(false);
              // 强制刷新页面到登录页
              window.location.href = '/login';
            }
          }
        } catch (error) {
          console.error('AuthContext: 初始化认证状态失败:', error);
          
          if (isMounted) {
            // 检查是否是许可证过期错误
            if (error.code === 'LICENSE_EXPIRED' || error.response?.data?.code === 'LICENSE_EXPIRED') {
              console.log('AuthContext: 许可证过期，跳转到授权页面');
              // 许可证过期：axios拦截器已经处理跳转，这里只需设置状态
              setUser(null);
              setIsAuthenticated(false);
              setLoading(false);
            } else {
              // 其他错误：清除token并跳转到登录页
              localStorage.removeItem('authToken');
              setIsAuthenticated(false);
              setLoading(false);
              window.location.href = '/login';
            }
          }
        }
      } else {
        console.log('AuthContext: 无token，未认证');
        if (isMounted) {
          setIsAuthenticated(false);
          setLoading(false);
        }
      }
    };

    initAuth();

    // 清理函数，防止内存泄漏
    return () => {
      console.log('AuthContext: 清理');
      isMounted = false;
    };
  }, []);

  // 获取用户权限 - 使用 useCallback 保持引用稳定
  const fetchUserPermissions = useCallback(async () => {
    try {
      const response = await api.get('/current-user/permissions');
      setPermissions(response.data.permissions || []);
      setMenuPermissions(response.data.menu_permissions || []);
      console.log('AuthContext: 权限加载成功', response.data);
    } catch (error) {
      console.error('AuthContext: 获取权限失败:', error);
    }
  }, []);

  // 登录方法 - 使用 useCallback 保持引用稳定
  const login = useCallback(async (username, password) => {
    console.log('AuthContext: 开始登录');
    setLoading(true);
    try {
      const result = await authAPI.login(username, password);
      console.log('AuthContext: 登录结果:', result);

      if (result.success) {
        // 使用Promise来确保状态更新后再返回结果
        return new Promise(resolve => {
          localStorage.setItem('authToken', result.token);
          setUser(result.user);
          setIsAuthenticated(true);
          console.log('AuthContext: 登录成功，设置认证状态为true');

          // 使用setTimeout确保状态已更新
          setTimeout(() => {
            setLoading(false);
            resolve({ success: true });
          }, 50);
        });
      } else {
        console.log('AuthContext: 登录失败:', result.message);
        setLoading(false);
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('AuthContext: 登录请求失败:', error);
      setLoading(false);
      return {
        success: false,
        message: error.response?.data?.message || '登录失败，请稍后再试'
      };
    }
  }, []);

  // 登出方法 - 使用 useCallback 保持引用稳定
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      // 无论API是否成功，都清除本地状态
      localStorage.removeItem('authToken');
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  // 刷新用户信息 - 使用 useCallback 保持引用稳定
  const refreshUser = useCallback(async () => {
    console.log('AuthContext: 刷新用户信息, 当前认证状态:', isAuthenticated);

    try {
      // 清除缓存，强制刷新
      if (authAPI.getCurrentUser.clearCache) {
        authAPI.getCurrentUser.clearCache();
      }
      // 即使未认证也尝试获取用户信息，用于恢复认证状态
      const result = await authAPI.getCurrentUser(true);
      console.log('AuthContext: 刷新用户信息结果:', result);

      if (result.success) {
        // 使用Promise来确保状态更新后再返回结果
        return new Promise(resolve => {
          setUser(result.user);
          setIsAuthenticated(true);
          console.log('AuthContext: 用户信息刷新成功，设置认证状态为true');

          // 使用setTimeout确保状态已更新
          setTimeout(() => {
            resolve(true);
          }, 50);
        });
      } else {
        // 如果获取失败且当前已认证，则设置为未认证
        if (isAuthenticated) {
          console.log('AuthContext: 用户信息刷新失败，设置认证状态为false');
          setIsAuthenticated(false);
          localStorage.removeItem('authToken');
        }
        return false;
      }
    } catch (error) {
      console.error('AuthContext: 刷新用户信息失败:', error);
      // 如果出错且当前已认证，则设置为未认证
      if (isAuthenticated) {
        console.log('AuthContext: 刷新用户信息出错，设置认证状态为false');
        setIsAuthenticated(false);
        localStorage.removeItem('authToken');
      }
      return false;
    }
  }, [isAuthenticated]);

  // 创建状态值对象 - 使用 useMemo 优化
  const stateValue = useMemo(() => ({
    user,
    isAuthenticated,
    loading,
    permissions,
    menuPermissions
  }), [user, isAuthenticated, loading, permissions, menuPermissions]);

  // 创建操作和权限检查方法对象 - 使用 useMemo 优化
  const actionsValue = useMemo(() => ({
    login,
    logout,
    refreshUser,
    fetchUserPermissions,
    // 权限检查方法
    hasAdminPermission: () => {
      return user && user.is_admin;
    },
    hasPermission: (permission) => {
      if (!user) return false;
      if (user.is_admin) return true;
      return permissions.includes(permission);
    },
    hasAnyPermission: (permissionList) => {
      if (!user) return false;
      if (user.is_admin) return true;
      return permissionList.some(perm => permissions.includes(perm));
    },
    hasAllPermissions: (permissionList) => {
      if (!user) return false;
      if (user.is_admin) return true;
      return permissionList.every(perm => permissions.includes(perm));
    },
    canAccessMenu: (menuName) => {
      if (!user) return false;
      if (user.is_admin) return true;
      return menuPermissions.includes(`menu:${menuName}`);
    }
  }), [login, logout, refreshUser, fetchUserPermissions, user, permissions, menuPermissions]);

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
};

// 自定义钩子 - 仅获取状态
export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState必须在AuthProvider内部使用');
  }
  return context;
};

// 自定义钩子 - 仅获取操作
export const useAuthActions = () => {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error('useAuthActions必须在AuthProvider内部使用');
  }
  return context;
};

// 自定义钩子 - 向后兼容，同时获取状态和操作
export const useAuth = () => {
  const state = useAuthState();
  const actions = useAuthActions();
  return { ...state, ...actions };
};
