import api from './axios';

const skillAPI = {
  // 获取所有技能
  getAll: async () => {
    const response = await api.get('/skills');
    return response.data;
  },

  // 获取单个技能详情
  getByName: async (name) => {
    const response = await api.get(`/skills/${name}`);
    return response.data;
  },

  // 创建技能
  create: async (data) => {
    const response = await api.post('/skills', data);
    return response.data;
  },

  // 更新技能
  update: async (name, data) => {
    const response = await api.put(`/skills/${name}`, data);
    return response.data;
  },

  // 删除技能
  delete: async (name) => {
    const response = await api.delete(`/skills/${name}`);
    return response.data;
  },

  // 获取 SKILL.md 内容
  getContent: async (name) => {
    const response = await api.get(`/skills/${name}/content`);
    return response.data;
  },

  // 更新 SKILL.md 内容
  updateContent: async (name, content) => {
    const response = await api.put(`/skills/${name}/content`, { content });
    return response.data;
  },

  // 脚本管理
  listScripts: async (name) => {
    const response = await api.get(`/skills/${name}/scripts`);
    return response.data;
  },

  getScript: async (name, scriptPath) => {
    const response = await api.get(`/skills/${name}/scripts/${scriptPath}`);
    return response.data;
  },

  createScript: async (name, scriptName, content = '') => {
    const response = await api.post(`/skills/${name}/scripts`, { name: scriptName, content });
    return response.data;
  },

  updateScript: async (name, scriptPath, content) => {
    const response = await api.put(`/skills/${name}/scripts/${scriptPath}`, { content });
    return response.data;
  },

  deleteScript: async (name, scriptPath) => {
    const response = await api.delete(`/skills/${name}/scripts/${scriptPath}`);
    return response.data;
  },

  // 参考资料管理
  listReferences: async (name) => {
    const response = await api.get(`/skills/${name}/references`);
    return response.data;
  },

  getReference: async (name, refPath) => {
    const response = await api.get(`/skills/${name}/references/${refPath}`);
    return response.data;
  },

  updateReference: async (name, refPath, content) => {
    const response = await api.put(`/skills/${name}/references/${refPath}`, { content });
    return response.data;
  },

  // 资源管理
  listAssets: async (name) => {
    const response = await api.get(`/skills/${name}/assets`);
    return response.data;
  },

  uploadAsset: async (name, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/skills/${name}/assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // 导入预览
  importPreview: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/skills/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // 导入确认
  importConfirm: async (file, preview) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview', JSON.stringify(preview));
    const response = await api.post('/skills/import/confirm', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // 导出技能
  exportSkill: async (name) => {
    const response = await api.get(`/skills/${name}/export`, { responseType: 'blob' });
    return response.data;
  },

  // 文件系统同步
  syncFilesystem: async () => {
    const response = await api.post('/skills/sync');
    return response.data;
  },

  // 角色绑定
  getRoleSkills: async (roleId) => {
    const response = await api.get(`/roles/${roleId}/skills`);
    return response.data;
  },

  bindRoleSkills: async (roleId, skillIds) => {
    const response = await api.post(`/roles/${roleId}/skills`, { skill_ids: skillIds });
    return response.data;
  },

  unbindRoleSkill: async (roleId, skillId) => {
    const response = await api.delete(`/roles/${roleId}/skills/${skillId}`);
    return response.data;
  },
};

export default skillAPI;
