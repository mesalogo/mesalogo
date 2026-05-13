import { useState, useEffect, useCallback } from 'react';
import { App } from 'antd';
import { roleAPI } from '../../services/api/role';
import { modelConfigAPI } from '../../services/api/model';
import capabilityAPI from '../../services/api/capability';
import knowledgeAPI from '../../services/api/knowledge';
import externalKnowledgeAPI from '../../services/api/externalKnowledge';
import { settingsAPI } from '../../services/api/settings';
import { actionSpaceAPI } from '../../services/api/actionspace';

export const useRoleManagement = () => {
  const { message } = App.useApp();
  
  const [roles, setRoles] = useState([]);
  const [models, setModels] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [allKnowledges, setAllKnowledges] = useState([]);
  const [actionSpaces, setActionSpaces] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({
    streamingEnabled: true,
    enableAssistantGeneration: true,
    assistantGenerationModel: 'default'
  });
  
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [loadingKnowledges, setLoadingKnowledges] = useState(false);

  const fetchRoles = useCallback(async (actionSpaceFilter = '') => {
    setLoading(true);
    try {
      let rolesWithDetails;

      if (actionSpaceFilter) {
        const filteredRoles = await roleAPI.getAll({ action_space_id: actionSpaceFilter });
        rolesWithDetails = filteredRoles.map(role => ({
          ...role,
          capabilities: [],
          internalKnowledges: [],
          externalKnowledges: [],
          allKnowledges: []
        }));
      } else {
        rolesWithDetails = await roleAPI.getAllWithDetails();
      }

      setRoles(rolesWithDetails);
    } catch (error) {
      console.error('获取角色列表失败:', error);
      message.error(`获取角色列表失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [message]);

  const fetchModels = useCallback(async () => {
    try {
      setLoadingModels(true);
      const data = await modelConfigAPI.getAll();
      setModels(data);
    } catch (error) {
      console.error('获取模型列表失败:', error);
      message.error(`获取模型列表失败: ${error.message || '未知错误'}`);
    } finally {
      setLoadingModels(false);
    }
  }, [message]);

  const fetchCapabilities = useCallback(async () => {
    try {
      setLoadingCapabilities(true);
      const response = await capabilityAPI.getAll();
      
      let capabilitiesData = [];
      if (response.data && Array.isArray(response.data)) {
        capabilitiesData = response.data;
      }

      const capsByType: any = {};
      capabilitiesData.forEach((cap: any) => {
        if (!capsByType[cap.type]) {
          capsByType[cap.type] = [];
        }
        capsByType[cap.type].push(cap);
      });

      setCapabilities(capsByType);
    } catch (error) {
      console.error('获取能力列表失败:', error);
      message.error(`获取能力列表失败: ${error.message || '未知错误'}`);
    } finally {
      setLoadingCapabilities(false);
    }
  }, [message]);

  const fetchAllKnowledges = useCallback(async () => {
    try {
      setLoadingKnowledges(true);
      const [internalResponse, externalResponse] = await Promise.allSettled([
        knowledgeAPI.getAll(),
        externalKnowledgeAPI.getExternalKnowledges()
      ]);

      let allKnowledgesData = [];

      if (internalResponse.status === 'fulfilled') {
        let internalKnowledges = [];
        const internalData = internalResponse.value;

        if (internalData.data && Array.isArray(internalData.data)) {
          internalKnowledges = internalData.data;
        } else if (Array.isArray(internalData)) {
          internalKnowledges = internalData;
        }

        internalKnowledges = internalKnowledges.map(kb => ({
          ...kb,
          type: 'internal',
          provider_name: '内部知识库',
          status: 'active'
        }));

        allKnowledgesData = [...allKnowledgesData, ...internalKnowledges];
      }

      if (externalResponse.status === 'fulfilled') {
        let externalKnowledges = [];
        const externalData = externalResponse.value;

        if (externalData.data && Array.isArray(externalData.data)) {
          externalKnowledges = externalData.data;
        } else if (Array.isArray(externalData)) {
          externalKnowledges = externalData;
        }

        externalKnowledges = externalKnowledges.map(kb => ({
          ...kb,
          type: 'external'
        }));

        allKnowledgesData = [...allKnowledgesData, ...externalKnowledges];
      }

      setAllKnowledges(allKnowledgesData);
    } catch (error) {
      console.error('获取知识库列表失败:', error);
      message.error(`获取知识库列表失败: ${error.message || '未知错误'}`);
    } finally {
      setLoadingKnowledges(false);
    }
  }, [message]);

  const fetchActionSpaces = useCallback(async () => {
    try {
      const spaces = await actionSpaceAPI.getAll();
      setActionSpaces(spaces);
    } catch (error) {
      console.error('获取行动空间列表失败:', error);
      message.error('获取行动空间列表失败');
    }
  }, [message]);

  const fetchGlobalSettings = useCallback(async () => {
    try {
      const settings = await settingsAPI.getSettings();
      setGlobalSettings({
        streamingEnabled: settings.streamingEnabled !== undefined ? settings.streamingEnabled : true,
        enableAssistantGeneration: settings.enableAssistantGeneration !== undefined ? settings.enableAssistantGeneration : true,
        assistantGenerationModel: settings.assistantGenerationModel || 'default'
      });
    } catch (error) {
      console.error('获取全局设置失败:', error);
    }
  }, []);

  const createRole = useCallback(async (formData) => {
    try {
      const result = await roleAPI.create(formData);
      message.success('角色创建成功');
      return result;
    } catch (error: any) {
      console.error('创建角色失败:', error);
      // 检查是否是配额超限错误
      if (error.response?.status === 403 && error.response?.data?.quota) {
        message.error(`配额超限：${error.response.data.message || '您的计划已达到智能体数量上限'}`);
      } else {
        message.error('创建角色失败');
      }
      throw error;
    }
  }, [message]);

  const updateRole = useCallback(async (roleId, formData) => {
    try {
      await roleAPI.update(roleId, formData);
      message.success('角色更新成功');
    } catch (error) {
      console.error('更新角色失败:', error);
      message.error('更新角色失败');
      throw error;
    }
  }, [message]);

  const deleteRole = useCallback(async (roleId) => {
    try {
      await roleAPI.delete(roleId);
      message.success('角色删除成功');
      await fetchRoles();
    } catch (error) {
      console.error('删除角色失败:', error);
      message.error('删除角色失败');
      throw error;
    }
  }, [message, fetchRoles]);

  const updateRoleCapabilities = useCallback(async (roleId, capabilitiesMap) => {
    try {
      const currentCapabilities = await capabilityAPI.getByRoleId(roleId);
      
      let currentCapabilityIds = [];
      if (currentCapabilities && currentCapabilities.data) {
        if (Array.isArray(currentCapabilities.data)) {
          currentCapabilityIds = currentCapabilities.data.map(cap => cap.id);
        } else if (typeof currentCapabilities.data === 'object') {
          if (currentCapabilities.data.status === 'success' && Array.isArray(currentCapabilities.data.data)) {
            currentCapabilityIds = currentCapabilities.data.data.map(cap => cap.id);
          }
        }
      }

      const selectedCapabilityIds = Object.entries(capabilitiesMap)
        .filter(([_, isSelected]) => isSelected)
        .map(([id]) => id);

      const toRemove = currentCapabilityIds.filter(id => !selectedCapabilityIds.includes(id));
      const toAdd = selectedCapabilityIds.filter(id => !currentCapabilityIds.includes(id));

      for (const capId of toAdd) {
        await capabilityAPI.assignToRole(roleId, capId);
      }

      for (const capId of toRemove) {
        await capabilityAPI.unassignFromRole(roleId, capId);
      }

      if (toAdd.length > 0 || toRemove.length > 0) {
        await fetchRoles();
      }
    } catch (error) {
      console.error(`更新角色能力关联失败:`, error);
      throw error;
    }
  }, [fetchRoles]);

  const updateRoleKnowledges = useCallback(async (roleId, newSelectedKnowledges, currentKnowledgeIds) => {
    const toBindIds = newSelectedKnowledges.filter(id => !currentKnowledgeIds.includes(id));
    const toUnbindIds = currentKnowledgeIds.filter(id => !newSelectedKnowledges.includes(id));

    const internalToBindIds = toBindIds.filter(id => id.startsWith('internal_')).map(id => id.replace('internal_', ''));
    const externalToBindIds = toBindIds.filter(id => id.startsWith('external_')).map(id => id.replace('external_', ''));
    const internalToUnbindIds = toUnbindIds.filter(id => id.startsWith('internal_')).map(id => id.replace('internal_', ''));
    const externalToUnbindIds = toUnbindIds.filter(id => id.startsWith('external_')).map(id => id.replace('external_', ''));

    let hasError = false;
    let errorMessage = '';

    // 绑定内部知识库 - 单个失败不影响其他
    for (const kbId of internalToBindIds) {
      try {
        await knowledgeAPI.mountToRole(roleId, kbId);
      } catch (error) {
        console.error(`内部知识库绑定失败: ${kbId}`, error);
        hasError = true;
        errorMessage = error.message || '未知错误';
      }
    }

    // 绑定外部知识库 - 单个失败不影响其他
    for (const kbId of externalToBindIds) {
      try {
        await externalKnowledgeAPI.bindRoleExternalKnowledge(roleId, kbId);
      } catch (error) {
        console.error(`外部知识库绑定失败: ${kbId}`, error);
        hasError = true;
        errorMessage = error.message || '未知错误';
      }
    }

    // 解绑内部知识库 - 单个失败不影响其他
    for (const kbId of internalToUnbindIds) {
      try {
        await knowledgeAPI.unmountFromRole(roleId, kbId);
      } catch (error) {
        console.error(`内部知识库解绑失败: ${kbId}`, error);
        hasError = true;
        errorMessage = error.message || '未知错误';
      }
    }

    // 解绑外部知识库 - 单个失败不影响其他
    for (const kbId of externalToUnbindIds) {
      try {
        await externalKnowledgeAPI.unbindRoleExternalKnowledge(roleId, kbId);
      } catch (error) {
        console.error(`外部知识库解绑失败: ${kbId}`, error);
        hasError = true;
        errorMessage = error.message || '未知错误';
      }
    }

    await fetchRoles();

    if (hasError) {
      message.warning(`部分知识库操作失败: ${errorMessage}`);
    } else if (toBindIds.length > 0 || toUnbindIds.length > 0) {
      message.success('知识库绑定更新成功');
    }
  }, [message, fetchRoles]);

  useEffect(() => {
    fetchRoles();
    fetchModels();
    fetchCapabilities();
    fetchGlobalSettings();
    fetchAllKnowledges();
    fetchActionSpaces();
  }, [fetchRoles, fetchModels, fetchCapabilities, fetchGlobalSettings, fetchAllKnowledges, fetchActionSpaces]);

  return {
    roles,
    models,
    capabilities,
    allKnowledges,
    actionSpaces,
    globalSettings,
    loading,
    loadingModels,
    loadingCapabilities,
    loadingKnowledges,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    updateRoleCapabilities,
    updateRoleKnowledges
  };
};
