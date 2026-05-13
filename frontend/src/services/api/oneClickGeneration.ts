import api from './axios';

/**
 * 一键生成API服务
 * 提供一键创建角色、行动空间、规则和任务的API函数
 */
const oneClickGenerationAPI = {
  /**
   * 生成角色配置
   * @param {string} userRequirement 用户需求描述
   * @returns {Promise<Object>} 生成的角色配置
   */
  generateRole: async (userRequirement) => {
    try {
      const response = await api.post('/one-click-generation/generate-role', {
        user_requirement: userRequirement
      });
      return response.data;
    } catch (error) {
      console.error('生成角色失败:', error);
      throw error;
    }
  },

  /**
   * 生成行动空间配置
   * @param {string} userRequirement 用户需求描述
   * @param {Array} rolesInfo 多个角色信息
   * @returns {Promise<Object>} 生成的行动空间配置
   */
  generateActionSpace: async (userRequirement, rolesInfo) => {
    try {
      const response = await api.post('/one-click-generation/generate-action-space', {
        user_requirement: userRequirement,
        roles_info: rolesInfo  // 改为复数形式
      });
      return response.data;
    } catch (error) {
      console.error('生成行动空间失败:', error);
      throw error;
    }
  },

  /**
   * 生成规则配置
   * @param {string} userRequirement 用户需求描述
   * @param {Array} rolesInfo 多个角色信息
   * @param {Object} actionSpaceInfo 行动空间信息
   * @returns {Promise<Object>} 生成的规则配置
   */
  generateRules: async (userRequirement, rolesInfo, actionSpaceInfo) => {
    try {
      const response = await api.post('/one-click-generation/generate-rules', {
        user_requirement: userRequirement,
        roles_info: rolesInfo,  // 改为复数形式
        action_space_info: actionSpaceInfo
      });
      return response.data;
    } catch (error) {
      console.error('生成规则失败:', error);
      throw error;
    }
  },

  /**
   * 生成任务配置
   * @param {string} userRequirement 用户需求描述
   * @param {Array} rolesInfo 多个角色信息
   * @param {Object} actionSpaceInfo 行动空间信息
   * @param {Array} rulesInfo 规则信息
   * @returns {Promise<Object>} 生成的任务配置
   */
  generateTask: async (userRequirement, rolesInfo, actionSpaceInfo, rulesInfo) => {
    try {
      const response = await api.post('/one-click-generation/generate-task', {
        user_requirement: userRequirement,
        roles_info: rolesInfo,  // 改为复数形式
        action_space_info: actionSpaceInfo,
        rules_info: rulesInfo
      });
      return response.data;
    } catch (error) {
      console.error('生成任务失败:', error);
      throw error;
    }
  },

  /**
   * 一键生成所有内容
   * @param {string} userRequirement 用户需求描述
   * @returns {Promise<Object>} 生成的所有配置
   */
  generateAll: async (userRequirement) => {
    try {
      const response = await api.post('/one-click-generation/generate-all', {
        user_requirement: userRequirement
      });
      return response.data;
    } catch (error) {
      console.error('一键生成失败:', error);
      throw error;
    }
  },

  /**
   * 批量创建所有实体
   * @param {Object} generatedData 生成的数据
   * @returns {Promise<Object>} 创建结果
   */
  createAll: async (generatedData) => {
    try {
      const response = await api.post('/one-click-generation/create-all', {
        generated_data: generatedData
      });
      return response.data;
    } catch (error) {
      console.error('批量创建失败:', error);
      throw error;
    }
  }
};

export { oneClickGenerationAPI };
export default oneClickGenerationAPI;
