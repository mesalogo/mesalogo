import api from './axios';

/**
 * 项目空间文件相关API服务
 */
export const workspaceAPI = {
  /**
   * 获取所有行动任务及其智能体信息（用于项目空间管理页面）
   * @returns {Promise<Array>} - 任务列表
   */
  getTasksWithAgents: async () => {
    try {
      const response = await api.get('/workspace-management/tasks-with-agents');
      return response.data.tasks || [];
    } catch (error) {
      console.error('获取任务和智能体信息失败:', error);
      throw error;
    }
  },

  /**
   * 获取指定任务的所有项目空间信息
   * @param {number} taskId - 行动任务ID
   * @returns {Promise<Object>} - 项目空间信息
   */
  getTaskWorkspaces: async (taskId) => {
    try {
      const response = await api.get(`/workspace-management/task/${taskId}/workspaces`);
      return response.data.data;
    } catch (error) {
      console.error('获取任务项目空间信息失败:', error);
      throw error;
    }
  },

  /**
   * 获取指定任务的所有项目空间信息（别名方法，保持兼容性）
   * @param {number} taskId - 行动任务ID
   * @returns {Promise<Object>} - 项目空间信息
   */
  getTaskMemories: async (taskId) => {
    try {
      const response = await api.get(`/workspace-management/task/${taskId}/workspaces`);
      return response.data.data;
    } catch (error) {
      console.error('获取任务项目空间信息失败:', error);
      throw error;
    }
  },

  /**
   * 获取行动任务的所有项目文件列表，支持子目录浏览
   * @param {number} taskId - 行动任务ID
   * @param {string} subPath - 子路径（可选）
   * @returns {Promise<Object>} - 项目文件列表
   */
  getWorkspaceFiles: async (taskId, subPath = '') => {
    try {
      const url = subPath
        ? `/action-tasks/${taskId}/workspace-files/${subPath}`
        : `/action-tasks/${taskId}/workspace-files`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('获取项目文件列表失败:', error);
      throw error;
    }
  },

  /**
   * 获取workspace根目录下的所有目录和文件
   * @returns {Promise<Object>} - 根目录内容列表
   */
  getWorkspaceRootDirectories: async () => {
    try {
      const response = await api.get('/workspace-root-directories');
      return response.data;
    } catch (error) {
      console.error('获取workspace根目录失败:', error);
      throw error;
    }
  },

  /**
   * 获取workspace中任意目录的文件列表，支持子目录浏览
   * @param {string} dirPath - 目录路径
   * @param {string} subPath - 子路径（可选）
   * @returns {Promise<Object>} - 目录文件列表
   */
  getWorkspaceDirectoryFiles: async (dirPath, subPath = '') => {
    try {
      const url = subPath
        ? `/workspace-directory/${dirPath}/${subPath}`
        : `/workspace-directory/${dirPath}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('获取目录文件列表失败:', error);
      throw error;
    }
  },

  /**
   * 获取项目文件内容
   * @param {string} filePath - 项目文件路径
   * @returns {Promise<Object>} - 项目文件内容
   */
  getWorkspaceFileContent: async (filePath) => {
    try {
      const response = await api.get(`/workspace-management/workspace-file/${filePath}`);
      return response.data;
    } catch (error) {
      console.error('获取项目文件内容失败:', error);
      throw error;
    }
  },

  /**
   * 更新项目文件内容
   * @param {string} filePath - 项目文件路径
   * @param {string} content - 新内容
   * @returns {Promise<Object>} - 更新结果
   */
  updateWorkspaceFileContent: async (filePath, content) => {
    try {
      const response = await api.put(`/workspace-management/workspace-file/${filePath}`, {
        content
      });
      return response.data;
    } catch (error) {
      console.error('更新项目文件内容失败:', error);
      throw error;
    }
  },

  /**
   * 下载项目文件
   * @param {string} filePath - 项目文件路径
   * @returns {Promise<Blob>} - 文件Blob对象
   */
  downloadWorkspaceFile: async (filePath) => {
    try {
      const response = await api.get(`/workspace-management/workspace-file/${filePath}/download`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('下载项目文件失败:', error);
      throw error;
    }
  },

  /**
   * 创建新项目文件
   * @param {Object} workspaceData - 项目数据
   * @returns {Promise<Object>} - 创建的项目文件
   */
  createWorkspaceFile: async (workspaceData) => {
    try {
      const response = await api.post('/workspace-management/workspace-file', workspaceData);
      return response.data;
    } catch (error) {
      console.error('创建项目文件失败:', error);
      throw error;
    }
  },

  /**
   * 创建新项目文件（旧接口，保持兼容性）
   * @param {Object} workspaceData - 项目数据
   * @returns {Promise<Object>} - 创建的项目文件
   */
  createWorkspace: async (workspaceData) => {
    try {
      const response = await api.post('/workspaces', workspaceData);
      return response.data;
    } catch (error) {
      console.error('创建项目文件失败:', error);
      throw error;
    }
  },

  /**
   * 更新项目文件内容（旧接口，保持兼容性）
   * @param {string} workspaceId - 项目文件ID
   * @param {Object} workspaceData - 更新的项目文件数据
   * @returns {Promise<Object>} - 更新后的项目文件
   */
  updateWorkspace: async (workspaceId, workspaceData) => {
    try {
      const response = await api.put(`/workspaces/${workspaceId}`, workspaceData);
      return response.data;
    } catch (error) {
      console.error('更新项目文件失败:', error);
      throw error;
    }
  },

  /**
   * 删除项目文件
   * @param {string} filePath - 项目文件路径
   * @returns {Promise<Object>} - 删除结果
   */
  deleteWorkspaceFile: async (filePath) => {
    try {
      const response = await api.delete(`/workspace-management/workspace-file/${filePath}`);
      return response.data;
    } catch (error) {
      console.error('删除项目文件失败:', error);
      throw error;
    }
  },

  /**
   * 上传文件到工作空间
   * @param {number} taskId - 行动任务ID
   * @param {string} subPath - 子路径（可选）
   * @param {File} file - 要上传的文件
   * @returns {Promise<Object>} - 上传结果
   */
  uploadWorkspaceFile: async (taskId, subPath = '', file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const url = subPath
        ? `/action-tasks/${taskId}/workspace-files/${subPath}/upload`
        : `/action-tasks/${taskId}/workspace-files/upload`;

      const response = await api.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('上传文件失败:', error);
      throw error;
    }
  },

  /**
   * 删除项目文件（旧接口，保持兼容性）
   * @param {string} workspaceId - 项目文件ID
   * @returns {Promise<Object>} - 删除结果
   */
  deleteWorkspace: async (workspaceId) => {
    try {
      const response = await api.delete(`/workspaces/${workspaceId}`);
      return response.data;
    } catch (error) {
      console.error('删除项目文件失败:', error);
      throw error;
    }
  },

  /**
   * 创建工作空间模板
   * @param {Object} templateData - 模板数据
   * @returns {Promise<Object>} - 创建的模板
   */
  createWorkspaceTemplate: async (templateData) => {
    try {
      const response = await api.post('/workspace-management/workspace-template', templateData);
      return response.data;
    } catch (error) {
      console.error('创建工作空间模板失败:', error);
      throw error;
    }
  },

  /**
   * 获取工作空间模板列表
   * @returns {Promise<Array>} - 模板列表
   */
  getWorkspaceTemplates: async () => {
    try {
      const response = await api.get('/workspace-management/workspace-templates');
      return response.data.templates || [];
    } catch (error) {
      console.error('获取工作空间模板列表失败:', error);
      throw error;
    }
  },

  /**
   * 更新工作空间模板
   * @param {number} templateId - 模板ID
   * @param {Object} templateData - 模板数据
   * @returns {Promise<Object>} - 更新的模板
   */
  updateWorkspaceTemplate: async (templateId, templateData) => {
    try {
      const response = await api.put(`/workspace-management/workspace-template/${templateId}`, templateData);
      return response.data;
    } catch (error) {
      console.error('更新工作空间模板失败:', error);
      throw error;
    }
  },

  /**
   * 删除工作空间模板
   * @param {number} templateId - 模板ID
   * @returns {Promise<Object>} - 删除结果
   */
  deleteWorkspaceTemplate: async (templateId) => {
    try {
      const response = await api.delete(`/workspace-management/workspace-template/${templateId}`);
      return response.data;
    } catch (error) {
      console.error('删除工作空间模板失败:', error);
      throw error;
    }
  },

  /**
   * 创建新的工作空间模板
   * @param {Object} templateData - 模板数据
   * @returns {Promise<Object>} - 创建的模板
   */
  createNewWorkspaceTemplate: async (templateData) => {
    try {
      const response = await api.post('/workspace-management/workspace-template/new', templateData);
      return response.data;
    } catch (error) {
      console.error('创建新工作空间模板失败:', error);
      throw error;
    }
  },

  /**
   * 获取OnlyOffice编辑器配置
   * @param {string} filePath - 文件路径
   * @param {string} fileName - 文件名
   * @returns {Promise<Object>} - 完整的编辑器配置
   */
  getOnlyOfficeConfig: async (filePath, fileName) => {
    try {
      const response = await api.post('/onlyoffice/config', {
        file_path: filePath,
        file_name: fileName
      });
      return response.data;
    } catch (error) {
      console.error('获取OnlyOffice配置失败:', error);
      throw error;
    }
  }
};

export default workspaceAPI;
