import api from './axios';

/**
 * 系统统计相关API服务
 */
export const statisticsAPI = {
  // 获取系统概览统计数据
  getSystemOverview: async () => {
    try {
      const response = await api.get('/statistics/overview');
      return response.data;
    } catch (error) {
      console.error('获取系统概览统计数据失败:', error);
      throw error;
    }
  },

  // 获取任务统计数据
  getTaskStatistics: async () => {
    try {
      const response = await api.get('/statistics/tasks');
      return response.data;
    } catch (error) {
      console.error('获取任务统计数据失败:', error);
      throw error;
    }
  },

  // 获取角色统计数据
  getRoleStatistics: async () => {
    try {
      const response = await api.get('/statistics/roles');
      return response.data;
    } catch (error) {
      console.error('获取角色统计数据失败:', error);
      throw error;
    }
  },

  // 获取行动空间统计数据
  getActionSpaceStatistics: async () => {
    try {
      const response = await api.get('/statistics/action-spaces');
      return response.data;
    } catch (error) {
      console.error('获取行动空间统计数据失败:', error);
      throw error;
    }
  },

  // 获取活动趋势统计数据
  getActivityTrends: async () => {
    try {
      const response = await api.get('/statistics/activity-trends');
      return response.data;
    } catch (error) {
      console.error('获取活动趋势统计数据失败:', error);
      throw error;
    }
  },

  // 获取交互统计数据
  getInteractionStatistics: async () => {
    try {
      const response = await api.get('/statistics/interactions');
      return response.data;
    } catch (error) {
      console.error('获取交互统计数据失败:', error);
      throw error;
    }
  },

  // 获取生态统计数据
  getEcosystemStatistics: async () => {
    try {
      const response = await api.get('/statistics/ecosystem');
      return response.data;
    } catch (error) {
      console.error('获取生态统计数据失败:', error);
      throw error;
    }
  },

  // 获取系统资源统计数据
  getSystemResources: async () => {
    try {
      const response = await api.get('/statistics/resources');
      return response.data;
    } catch (error) {
      console.error('获取系统资源统计数据失败:', error);
      throw error;
    }
  },

  // 获取用户统计数据
  getUserStatistics: async () => {
    try {
      const response = await api.get('/statistics/users');
      return response.data;
    } catch (error) {
      console.error('获取用户统计数据失败:', error);
      throw error;
    }
  },

  // 获取自主行动任务统计数据
  getAutonomousTaskStatistics: async () => {
    try {
      const response = await api.get('/statistics/autonomous-tasks');
      return response.data;
    } catch (error) {
      console.error('获取自主行动任务统计数据失败:', error);
      throw error;
    }
  },

  // 获取仪表盘所有数据
  getDashboardData: async () => {
    try {
      const response = await api.get('/statistics/dashboard');
      return response.data;
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
      throw error;
    }
  }
};

export default statisticsAPI;
