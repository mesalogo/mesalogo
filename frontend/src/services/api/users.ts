/**
 * 用户管理API服务
 */
import api from './axios';

const API_BASE_URL = api.defaults.baseURL || '';

// 获取认证头
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// 处理API响应
const handleResponse = async (response) => {
  const data = await response.json();
  
  if (response.ok) {
    return {
      success: true,
      data: data,
      message: data.message
    };
  } else {
    return {
      success: false,
      message: data.error || data.message || '请求失败',
      status: response.status
    };
  }
};

// 用户API
export const userAPI = {
  /**
   * 获取用户列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.per_page - 每页数量
   * @param {string} params.search - 搜索关键词
   */
  async getUsers(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${API_BASE_URL}/users${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 获取用户详情
   * @param {number} userId - 用户ID
   */
  async getUser(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('获取用户详情失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   */
  async createUser(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData)
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('创建用户失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 更新用户信息
   * @param {number} userId - 用户ID
   * @param {Object} userData - 用户数据
   */
  async updateUser(userId, userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData)
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('更新用户失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 获取删除用户预览
   * @param {string} userId - 用户ID
   */
  async getDeletionPreview(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/deletion-preview`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('获取删除预览失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 删除用户
   * @param {string} userId - 用户ID
   */
  async deleteUser(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('删除用户失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 重置用户密码
   * @param {number} userId - 用户ID
   * @param {Object} passwordData - 密码数据
   * @param {string} passwordData.new_password - 新密码
   */
  async resetPassword(userId, passwordData) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(passwordData)
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('重置密码失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 切换用户状态
   * @param {number} userId - 用户ID
   * @param {Object} statusData - 状态数据
   * @param {boolean} statusData.is_active - 是否启用
   */
  async toggleUserStatus(userId, statusData) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(statusData)
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('切换用户状态失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser() {
    try {
      const response = await fetch(`${API_BASE_URL}/users/current`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('获取当前用户信息失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 获取用户权限
   */
  async getUserPermissions() {
    try {
      const response = await fetch(`${API_BASE_URL}/users/permissions`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('获取用户权限失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 更新当前用户资料
   * @param {Object} profileData - 资料数据
   */
  async updateProfile(profileData) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(profileData)
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('更新资料失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  },

  /**
   * 修改当前用户密码
   * @param {Object} passwordData - 密码数据
   * @param {string} passwordData.old_password - 旧密码
   * @param {string} passwordData.new_password - 新密码
   */
  async changePassword(passwordData) {
    try {
      const response = await fetch(`${API_BASE_URL}/users/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(passwordData)
      });
      
      return await handleResponse(response);
    } catch (error) {
      console.error('修改密码失败:', error);
      return {
        success: false,
        message: '网络错误，请检查网络连接'
      };
    }
  }
};
