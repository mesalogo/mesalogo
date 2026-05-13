import api from './axios';

/**
 * 认证相关API服务
 */
export const authAPI = {
  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<Object>} 登录结果
   */
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      
      // 检查响应状态，即使HTTP状态码是200，也要检查业务状态
      if (response.data.status === 'success') {
        return {
          success: true,
          token: response.data.token,
          user: response.data.user
        };
      } else {
        // 业务逻辑失败
        console.error('登录失败:', response.data.message);
        return {
          success: false,
          errorType: 'credentials',
          message: response.data.message || '登录失败，请稍后再试'
        };
      }
    } catch (error) {
      console.error('登录请求失败:', error);
      
      // 区分不同类型的错误
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        // 请求超时
        return {
          success: false,
          errorType: 'timeout',
          message: 'timeout'
        };
      } else if (!error.response) {
        // 网络错误，无法连接到服务器
        return {
          success: false,
          errorType: 'network',
          message: 'network'
        };
      } else if (error.response.status === 401) {
        // 认证失败（密码错误）
        return {
          success: false,
          errorType: 'credentials',
          message: error.response.data?.message || 'credentials'
        };
      } else {
        // 其他服务器错误
        return {
          success: false,
          errorType: 'server',
          message: error.response?.data?.message || 'server'
        };
      }
    }
  },

  /**
   * 用户登出
   * @returns {Promise<Object>} 登出结果
   */
  logout: async () => {
    try {
      await api.post('/auth/logout');
      // 清除本地存储的认证信息
      localStorage.removeItem('authToken');
      return { success: true };
    } catch (error) {
      console.error('登出请求失败:', error);
      // 即使API请求失败，也清除本地存储的认证信息
      localStorage.removeItem('authToken');
      return {
        success: false,
        message: error.response?.data?.message || '登出失败'
      };
    }
  },

  /**
   * 获取当前登录用户信息
   * @returns {Promise<Object>} 用户信息
   */
  getCurrentUser: (() => {
    // 缓存上次获取的用户信息
    let lastUserInfo = {
      timestamp: 0,
      data: null,
      promise: null
    };

    // 缓存有效期（毫秒）
    const CACHE_DURATION = 5 * 1000; // 降低到5秒，方便调试

    const fetchUser = async (forceRefresh = false) => {
      const now = Date.now();

      // 如果有正在进行的请求，直接返回该Promise
      if (lastUserInfo.promise) {
        return lastUserInfo.promise;
      }

      // 如果缓存未过期且不是强制刷新，直接返回缓存结果
      if (!forceRefresh && now - lastUserInfo.timestamp < CACHE_DURATION && lastUserInfo.data) {
        return lastUserInfo.data;
      }

      // 创建新的请求
      lastUserInfo.promise = (async () => {
        try {
          // 检查是否有token
          const token = localStorage.getItem('authToken');
          if (!token) {
            console.log('getCurrentUser: 无token，返回未认证状态');
            return {
              success: false,
              message: '未登录'
            };
          }

          console.log('getCurrentUser: 发送请求获取用户信息');
          const response = await api.get('/auth/user');
          console.log('getCurrentUser: 获取用户信息成功:', response.data);

          const result = {
            success: true,
            user: response.data.user
          };

          // 更新缓存
          lastUserInfo.timestamp = Date.now();
          lastUserInfo.data = result;

          return result;
        } catch (error) {
          console.error('获取用户信息失败:', error);

          // 如果是401或403错误，清除token
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log('getCurrentUser: 认证失败，清除token');
            localStorage.removeItem('authToken');
          }

          return {
            success: false,
            message: error.response?.data?.message || '获取用户信息失败'
          };
        } finally {
          // 清除promise引用
          lastUserInfo.promise = null;
        }
      })();

      return lastUserInfo.promise;
    };

    // 添加清除缓存的方法
    fetchUser.clearCache = () => {
      lastUserInfo.timestamp = 0;
      lastUserInfo.data = null;
    };

    return fetchUser;
  })(),

  /**
   * 验证当前token是否有效
   * @returns {Promise<boolean>} token是否有效
   */
  validateToken: (() => {
    // 缓存上次验证结果
    let lastValidation = {
      timestamp: 0,
      result: false,
      promise: null
    };

    // 缓存有效期（毫秒）
    const CACHE_DURATION = 5 * 1000; // 降低到5秒，方便调试

    return async () => {
      const now = Date.now();

      // 检查是否有token
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('validateToken: 无token，直接返回false');
        return false;
      }

      // 如果有正在进行的验证请求，直接返回该Promise
      if (lastValidation.promise) {
        return lastValidation.promise;
      }

      // 如果缓存未过期，直接返回缓存结果
      if (now - lastValidation.timestamp < CACHE_DURATION) {
        console.log('validateToken: 使用缓存结果:', lastValidation.result);
        return lastValidation.result;
      }

      console.log('validateToken: 发送验证请求');

      // 创建新的验证请求
      lastValidation.promise = (async () => {
        try {
          const response = await api.get('/auth/validate');
          const result = response.data.valid;

          console.log('validateToken: 验证结果:', result);

          // 更新缓存
          lastValidation.timestamp = now;
          lastValidation.result = result;

          // 如果token无效，清除token
          if (!result) {
            console.log('validateToken: token无效，清除token');
            localStorage.removeItem('authToken');
          }

          return result;
        } catch (error) {
          console.error('验证token失败:', error);

          // 如果是401或403错误，清除token
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log('validateToken: 认证失败，清除token');
            localStorage.removeItem('authToken');
          }

          return false;
        } finally {
          // 清除promise引用
          lastValidation.promise = null;
        }
      })();

      return lastValidation.promise;
    };
  })(),

  /**
   * 修改密码
   * @param {string} newPassword - 新密码
   * @returns {Promise<Object>} 修改结果
   */
  changePassword: async (newPassword) => {
    try {
      const response = await api.post('/auth/change-password', {
        new_password: newPassword
      });
      return {
        success: true,
        message: response.data.message || '密码修改成功'
      };
    } catch (error) {
      console.error('修改密码请求失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '修改密码失败，请稍后再试'
      };
    }
  }
};

export default authAPI;
