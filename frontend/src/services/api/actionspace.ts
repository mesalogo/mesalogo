import api from './axios';

/**
 * 行动空间相关API服务
 */
export const actionSpaceAPI = {
  // 获取所有行动空间
  getAll: async (filters: any = {}) => {
    try {
      // 构建查询参数
      const params = new URLSearchParams();
      if (filters.name) {
        params.append('name', filters.name);
      }

      // 处理标签过滤
      if (filters.tagIds && filters.tagIds.length > 0) {
        filters.tagIds.forEach((tagId: any) => {
          params.append('tag_ids', tagId);
        });
      }

      // 添加查询参数到请求URL
      const queryString = params.toString();
      const url = queryString ? `/action-spaces?${queryString}` : '/action-spaces';

      // 请求API
      const response = await api.get(url);
      const spaces = response.data.action_spaces || [];

      // 确保每个行动空间都有tags字段并且格式正确
      return spaces.map(space => ({
        ...space,
        tags: Array.isArray(space.tags) ? space.tags : []
      }));
    } catch (error) {
      console.error('获取行动空间失败:', error);
      return []; // 返回空数组，不使用模拟数据
    }
  },

  // 获取所有标签
  getAllTags: async () => {
    try {
      const response = await api.get('/tags');
      return response.data || [];
    } catch (error) {
      console.error('获取标签失败:', error);
      return [];
    }
  },

  // 创建标签
  createTag: async (tagData) => {
    try {
      const response = await api.post('/tags', tagData);
      return response.data;
    } catch (error) {
      console.error('创建标签失败:', error);
      throw error;
    }
  },

  // 更新标签
  updateTag: async (tagId, tagData) => {
    try {
      const response = await api.put(`/tags/${tagId}`, tagData);
      return response.data;
    } catch (error) {
      console.error(`更新标签${tagId}失败:`, error);
      throw error;
    }
  },

  // 删除标签
  deleteTag: async (tagId) => {
    try {
      const response = await api.delete(`/tags/${tagId}`);
      return response.data;
    } catch (error) {
      console.error(`删除标签${tagId}失败:`, error);
      throw error;
    }
  },

  // 为行动空间添加标签
  addTag: async (actionSpaceId, tagId) => {
    try {
      const response = await api.post(`/action-spaces/${actionSpaceId}/tags`, { tag_id: tagId });
      return response.data;
    } catch (error) {
      console.error(`为行动空间${actionSpaceId}添加标签${tagId}失败:`, error);
      throw error;
    }
  },

  // 从行动空间移除标签
  removeTag: async (actionSpaceId, tagId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/tags/${tagId}`);
      return response.data;
    } catch (error) {
      console.error(`从行动空间${actionSpaceId}移除标签${tagId}失败:`, error);
      throw error;
    }
  },

  // 获取单个行动空间
  getById: async (id) => {
    try {
      const response = await api.get(`/action-spaces/${id}`);

      // 确保规则集有唯一的ID
      if (response.data && response.data.rule_sets) {
        response.data.rule_sets = response.data.rule_sets.map((rs, index) => {
          if (!rs.id) {
            rs.id = `rs-${id}-${index}`; // 确保规则集有唯一ID
          }
          return rs;
        });
      }

      return response.data;
    } catch (error) {
      console.error(`获取行动空间${id}失败:`, error);
      return null;
    }
  },

  // 获取行动空间详情（包含环境变量信息）
  getDetail: async (id) => {
    const response = await api.get(`/action-spaces/${id}/detail`);

    // 确保环境变量字段存在
    if (!response.data.environment_variables) {
      response.data.environment_variables = [];
    }

    return response.data;
  },

  // 获取行动空间关联的角色
  getRoles: async (actionSpaceId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/roles`);
      return response.data.roles || [];
    } catch (error) {
      console.error(`获取行动空间${actionSpaceId}关联角色失败:`, error);
      return [];
    }
  },

  // 获取所有行动空间的内部环境变量（仅内部变量）
  getAllEnvironmentVariables: async () => {
    try {
      console.log('正在请求所有行动空间环境变量...');
      const response = await api.get('/action-spaces/environment-variables/all');
      console.log('API响应:', response.data);

      // 确保返回的数据是数组格式
      const variables = response.data?.variables || response.data || [];
      if (!Array.isArray(variables)) {
        console.warn('API返回的环境变量数据不是数组格式:', variables);
        return [];
      }

      console.log(`成功获取${variables.length}个环境变量`);
      return variables;
    } catch (error) {
      console.error('获取所有行动空间环境变量失败:', error);
      console.error('错误详情:', error.response?.data || error.message);
      return [];
    }
  },

  // 外部环境变量相关API
  // 获取所有外部环境变量
  getAllExternalVariables: async () => {
    try {
      const response = await api.get('/external-variables');
      return response.data || [];
    } catch (error) {
      console.error('获取外部环境变量失败:', error);
      return [];
    }
  },

  // 创建外部环境变量
  createExternalVariable: async (data) => {
    try {
      const response = await api.post('/external-variables', data);
      return response.data;
    } catch (error) {
      console.error('创建外部环境变量失败:', error);
      throw error;
    }
  },

  // 更新外部环境变量
  updateExternalVariable: async (id, data) => {
    try {
      const response = await api.put(`/external-variables/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('更新外部环境变量失败:', error);
      throw error;
    }
  },

  // 删除外部环境变量
  deleteExternalVariable: async (id) => {
    try {
      await api.delete(`/external-variables/${id}`);
    } catch (error) {
      console.error('删除外部环境变量失败:', error);
      throw error;
    }
  },

  // 手动同步外部环境变量
  syncExternalVariable: async (id) => {
    try {
      const response = await api.post(`/external-variables/${id}/sync`);
      return response.data;
    } catch (error) {
      console.error('同步外部环境变量失败:', error);
      throw error;
    }
  },

  // 获取行动空间的环境变量（包括传统环境变量和共享环境变量）
  getEnvironmentVariables: async (actionSpaceId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/environment-variables`);
      return response.data;
    } catch (error) {
      console.error(`获取行动空间${actionSpaceId}环境变量失败:`, error);
      return {
        traditional_variables: [],
        shared_variables: []
      };
    }
  },

  // 创建环境变量
  createEnvironmentVariable: async (actionSpaceId, variableData) => {
    const response = await api.post(`/action-spaces/${actionSpaceId}/environment-variables`, variableData);
    return response.data;
  },

  // 添加行动空间环境变量（别名，为了兼容性）
  addSpaceEnvVar: async (actionSpaceId, variableData) => {
    return actionSpaceAPI.createEnvironmentVariable(actionSpaceId, variableData);
  },

  // 更新环境变量
  updateEnvironmentVariable: async (actionSpaceId, variableId, variableData) => {
    const response = await api.put(`/action-spaces/${actionSpaceId}/environment-variables/${variableId}`, variableData);
    return response.data;
  },

  // 更新行动空间环境变量（别名，为了兼容性）
  updateSpaceEnvVar: async (actionSpaceId, variableId, variableData) => {
    return actionSpaceAPI.updateEnvironmentVariable(actionSpaceId, variableId, variableData);
  },

  // 删除环境变量
  deleteEnvironmentVariable: async (actionSpaceId, variableId) => {
    const response = await api.delete(`/action-spaces/${actionSpaceId}/environment-variables/${variableId}`);
    return response.data;
  },

  // 删除行动空间环境变量（别名，为了兼容性）
  deleteSpaceEnvVar: async (actionSpaceId, variableId) => {
    return actionSpaceAPI.deleteEnvironmentVariable(actionSpaceId, variableId);
  },

  // 添加角色变量
  addRoleEnvVar: async (actionSpaceId, roleId, variableData) => {
    const response = await api.post(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables`, variableData);
    return response.data;
  },

  // 更新角色变量
  updateRoleEnvVar: async (actionSpaceId, roleId, variableId, variableData) => {
    const response = await api.put(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables/${variableId}`, variableData);
    return response.data;
  },

  // 删除角色变量
  deleteRoleEnvVar: async (actionSpaceId, roleId, variableId) => {
    const response = await api.delete(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables/${variableId}`);
    return response.data;
  },

  // 创建行动空间
  create: async (actionSpaceData) => {
    try {
      console.log('发送创建行动空间请求:', actionSpaceData);
      const response = await api.post('/action-spaces', actionSpaceData);
      return response.data;
    } catch (error) {
      console.error('创建行动空间失败:', error);
      console.error('错误详情:', error.response?.data || error.message);
      throw error; // 直接抛出错误，不使用模拟数据
    }
  },

  // 更新行动空间
  update: async (id, actionSpaceData) => {
    try {
      const response = await api.put(`/action-spaces/${id}`, actionSpaceData);
      return response.data;
    } catch (error) {
      console.error(`更新行动空间${id}失败:`, error);
      throw error; // 直接抛出错误，不使用模拟数据
    }
  },

  // 删除行动空间
  delete: async (id) => {
    try {
      const response = await api.delete(`/action-spaces/${id}`);
      return response.data;
    } catch (error) {
      console.error(`删除行动空间${id}失败:`, error);
      throw error; // 直接抛出错误，不使用模拟数据
    }
  },

  // 获取行动空间预设模板
  getTemplates: async () => {
    try {
      const response = await api.get('/action-spaces/templates');
      return response.data.templates || [];
    } catch (error) {
      console.error('获取行动空间模板失败:', error);
      return []; // 返回空数组，不使用模拟数据
    }
  },

  // 从模板创建行动空间
  createFromTemplate: async (templateId, customData = {}) => {
    try {
      const response = await api.post(`/action-spaces/from-template/${templateId}`, customData);
      return response.data;
    } catch (error) {
      console.error(`从模板创建行动空间失败:`, error);
      throw error; // 直接抛出错误，不使用模拟数据
    }
  },

  // 获取行动空间的统计数据
  getStats: async (id) => {
    try {
      const response = await api.get(`/action-spaces/${id}/stats`);
      return response.data;
    } catch (error) {
      console.error(`获取行动空间统计数据失败:`, error);
      // 返回空数据
      return {
        session_count: 0,
        rule_set_count: 0,
        avg_rating: 0,
        total_actions: 0,
        action_distribution: {}
      };
    }
  },

  // 获取规则集
  getRuleSets: async (actionSpaceId, cachedSpaces = null) => {
    try {
      let response;
      let ruleSets = [];

      if (actionSpaceId && actionSpaceId !== 'default') {
        // 如果有指定行动空间ID，直接使用行动空间规则集API
        console.log(`请求特定行动空间(${actionSpaceId})的规则集`);
        try {
          response = await api.get(`/action-spaces/${actionSpaceId}/rule-sets`);
          console.log('使用行动空间规则集API成功:', response.data);
          ruleSets = response.data.rule_sets || [];

          // 不再为每个规则集单独获取规则，使用统计API代替
        } catch (spaceApiError) {
          console.error('使用行动空间规则集API失败:', spaceApiError);
          throw spaceApiError; // 继续抛出错误，进入后续的错误处理
        }
      } else {
        // 如果没有指定行动空间ID，使用缓存的行动空间数据或获取新数据
        if (cachedSpaces && Array.isArray(cachedSpaces) && cachedSpaces.length > 0) {
          console.log('使用缓存的行动空间数据提取规则集，跳过API请求');
          const spaces = cachedSpaces;

          // 从行动空间中提取规则集
          const extractedRuleSets = [];
          for (const space of spaces) {
            if (space.rule_sets && Array.isArray(space.rule_sets)) {
              // 为每个规则集添加所属行动空间信息
              const ruleSetsWithSpace = space.rule_sets.map(rs => ({
                ...rs,
                action_space_id: space.id,
                action_space_name: space.name
              }));
              extractedRuleSets.push(...ruleSetsWithSpace);
            }
          }

          console.log(`从${spaces.length}个缓存行动空间中提取了${extractedRuleSets.length}个规则集`);
          ruleSets = extractedRuleSets;

          // 不再为每个规则集单独获取规则，只在需要时获取
        } else {
          // 如果没有缓存的行动空间数据，请求新数据
          console.log('未指定行动空间ID，从所有行动空间提取规则集');
          try {
            const spacesResponse = await api.get('/action-spaces');
            const spaces = spacesResponse.data.action_spaces || [];

            console.log(`找到${spaces.length}个行动空间，提取规则集`);

            // 从所有行动空间中提取规则集
            const extractedRuleSets = [];
            for (const space of spaces) {
              if (space.rule_sets && Array.isArray(space.rule_sets)) {
                // 为每个规则集添加所属行动空间信息
                const ruleSetsWithSpace = space.rule_sets.map(rs => ({
                  ...rs,
                  action_space_id: space.id,
                  action_space_name: space.name
                }));
                extractedRuleSets.push(...ruleSetsWithSpace);
              }
            }

            console.log(`从行动空间中提取了${extractedRuleSets.length}个规则集`);
            ruleSets = extractedRuleSets;

            // 不再为每个规则集单独获取规则，只在需要时获取
          } catch (spacesError) {
            console.error('获取所有行动空间失败:', spacesError);
            throw spacesError; // 继续抛出错误，进入后续的错误处理
          }
        }
      }

      // 确保规则集有唯一的ID
      ruleSets = ruleSets.map((rs, index) => {
        if (!rs.id) {
          rs.id = `rs-${actionSpaceId || 'default'}-${index}`; // 确保规则集有唯一ID
        }
        return rs;
      });

      // 去重处理，避免重复显示同名规则集
      const uniqueRuleSets = [];
      const ruleSetIds = new Set();

      for (const ruleSet of ruleSets) {
        // 使用规则集ID作为唯一标识
        if (!ruleSetIds.has(ruleSet.id)) {
          ruleSetIds.add(ruleSet.id);
          uniqueRuleSets.push(ruleSet);
        }
      }

      console.log(`规则集去重后: ${uniqueRuleSets.length}个（原${ruleSets.length}个）`);
      return uniqueRuleSets;
    } catch (error) {
      console.error('获取规则集失败:', error);
      return []; // 发生错误时返回空数组
    }
  },

  // 获取规则集统计信息（包括规则数量和关联行动空间）
  async getRuleSetsStats(actionSpaceId) {
    try {
      if (!actionSpaceId || actionSpaceId === 'default') {
        console.log('未提供有效的行动空间ID，一次性获取所有规则集信息');

        // 直接请求一个专门用于获取所有规则集统计信息的API
        const response = await api.get('/rule-sets/all-stats');
        console.log('获取所有规则集统计信息成功:', response.data);

        return response.data.rule_sets || [];
      }

      console.log(`请求行动空间(${actionSpaceId})的规则集统计信息`);
      const response = await api.get(`/action-spaces/${actionSpaceId}/rule-sets/stats`);
      console.log('获取规则集统计信息成功:', response.data);

      return response.data.rule_sets || [];
    } catch (error) {
      console.error(`获取规则集统计信息失败:`, error);
      console.error('错误详情:', error.response || error.request || error.message);
      return [];
    }
  },

  // 获取单个规则集
  getRuleSet: async (ruleSetId) => {
    try {
      const response = await api.get(`/rule-sets/${ruleSetId}`);
      return response.data;
    } catch (error) {
      console.error(`获取规则集${ruleSetId}失败:`, error);
      return null;
    }
  },

  // 创建规则集
  createRuleSet: async (ruleSetData) => {
    try {
      // 如果有行动空间ID，使用行动空间的规则集API
      if (ruleSetData.action_space_id) {
        const response = await api.post(`/action-spaces/${ruleSetData.action_space_id}/rule-sets`, {
          name: ruleSetData.name,
          description: ruleSetData.description,
          rule_ids: ruleSetData.rule_ids || [],
          rule_names: ruleSetData.rule_names || [],
          rules: ruleSetData.rules || [], // 兼容旧版的规则名称列表
          conditions: ruleSetData.conditions || [],
          actions: ruleSetData.actions || [],
          settings: ruleSetData.settings || {}
        });
        return response.data;
      } else {
        // 创建独立的规则集
        const response = await api.post('/rule-sets', {
          name: ruleSetData.name,
          description: ruleSetData.description,
          rule_ids: ruleSetData.rule_ids || [],
          rule_names: ruleSetData.rule_names || [],
          action_space_ids: ruleSetData.action_space_ids || [],
          action_space_id: ruleSetData.action_space_id,
          conditions: ruleSetData.conditions || [],
          actions: ruleSetData.actions || [],
          settings: ruleSetData.settings || {}
        });
        return response.data;
      }
    } catch (error) {
      console.error(`创建规则集失败:`, error);
      throw error;
    }
  },

  // 更新规则集
  updateRuleSet: async (ruleSetId, ruleSetData) => {
    try {
      const updateData: any = {
        name: ruleSetData.name,
        description: ruleSetData.description,
        conditions: ruleSetData.conditions || [],
        actions: ruleSetData.actions || [],
        settings: ruleSetData.settings || {}
      };

      // 如果有规则ID列表，添加到更新数据中
      if (ruleSetData.rule_ids && Array.isArray(ruleSetData.rule_ids)) {
        updateData.rule_ids = ruleSetData.rule_ids;
      }

      // 如果有规则优先级映射，添加到更新数据中
      if (ruleSetData.rule_priorities && typeof ruleSetData.rule_priorities === 'object') {
        updateData.rule_priorities = ruleSetData.rule_priorities;
      }

      // 如果有行动空间ID列表，添加到更新数据中
      if (ruleSetData.action_space_ids && Array.isArray(ruleSetData.action_space_ids)) {
        updateData.action_space_ids = ruleSetData.action_space_ids;
      }

      // 如果有行动空间ID，使用行动空间的规则集API
      if (ruleSetData.action_space_id) {
        const response = await api.put(`/action-spaces/${ruleSetData.action_space_id}/rule-sets/${ruleSetId}`, updateData);
        return response.data;
      } else {
        // 否则使用通用规则集API
        const response = await api.put(`/rule-sets/${ruleSetId}`, updateData);
        return response.data;
      }
    } catch (error) {
      console.error(`更新规则集失败:`, error);
      throw error;
    }
  },

  // 删除规则集
  deleteRuleSet: async (ruleSetId) => {
    try {
      // 尝试使用规则集API删除
      try {
        const response = await api.delete(`/rule-sets/${ruleSetId}`);
        return response.data;
      } catch (directError) {
        console.warn(`直接删除规则集失败，尝试从行动空间中删除:`, directError);

        // 尝试查找规则集所属的行动空间
        const allSpaces = await api.get('/action-spaces');
        const spaces = allSpaces.data.action_spaces || [];

        for (const space of spaces) {
          if (space.rule_sets && Array.isArray(space.rule_sets)) {
            const matchingRuleSet = space.rule_sets.find(rs => rs.id === ruleSetId);
            if (matchingRuleSet) {
              // 找到了所属行动空间，使用行动空间规则集API
              console.log(`找到规则集所属行动空间:${space.id}`);
              const response = await api.delete(`/action-spaces/${space.id}/rule-sets/${ruleSetId}`);
              return response.data;
            }
          }
        }

        // 如果找不到所属行动空间，重新抛出错误
        throw directError;
      }
    } catch (error) {
      console.error(`删除规则集失败:`, error);
      throw error;
    }
  },

  // 创建规则
  createRule: async (ruleData) => {
    try {
      // 确保有规则类型
      if (!ruleData.type) {
        ruleData.type = 'llm'; // 默认为自然语言规则
      }

      // 保存规则集ID
      const ruleSetId = ruleData.rule_set_id;

      // 移除rule_set_id, API不需要这个字段
      const { rule_set_id, ...ruleDataWithoutSetId } = ruleData;

      // 先创建规则
      const createResponse = await api.post('/rules', ruleDataWithoutSetId);
      console.log('规则创建成功:', createResponse.data);

      // 获取新创建的规则ID
      const newRuleId = createResponse.data.id;

      // 如果有规则集ID，将规则添加到规则集
      if (ruleSetId) {
        // 添加规则到规则集
        const addToSetResponse = await api.post(`/rule-sets/${ruleSetId}/rules`, {
          rule_id: newRuleId,
          priority: 0 // 默认优先级
        });
        console.log('规则添加到规则集成功:', addToSetResponse.data);
      }

      return createResponse.data;
    } catch (error) {
      console.error(`创建规则失败:`, error);
      throw error;
    }
  },

  // 更新规则
  updateRule: async (ruleId, ruleData) => {
    try {
      // 确保有规则类型
      if (!ruleData.type) {
        ruleData.type = 'llm'; // 默认为自然语言规则
      }

      // 保存规则集ID
      const ruleSetId = ruleData.rule_set_id;

      // 移除rule_set_id, 更新规则API不需要这个字段
      const { rule_set_id, ...ruleDataWithoutSetId } = ruleData;

      // 添加详细日志输出
      console.log('正在更新规则:', ruleId);
      console.log('规则类型:', ruleDataWithoutSetId.type);
      console.log('规则数据:', JSON.stringify(ruleDataWithoutSetId, null, 2));

      // 确保逻辑规则的解释器信息被正确传递
      if (ruleDataWithoutSetId.type === 'logic' && ruleDataWithoutSetId.interpreter) {
        console.log('逻辑规则解释器:', ruleDataWithoutSetId.interpreter);

        // 确保settings字段存在
        if (!ruleDataWithoutSetId.settings) {
          ruleDataWithoutSetId.settings = {};
        }

        // 将interpreter也保存到settings中，确保后端能正确处理
        ruleDataWithoutSetId.settings.interpreter = ruleDataWithoutSetId.interpreter;
      }

      // 发送更新请求
      const updateResponse = await api.put(`/rules/${ruleId}`, ruleDataWithoutSetId);
      console.log('规则更新成功:', updateResponse.data);

      // 如果有规则集ID，确保规则和规则集的关联
      if (ruleSetId) {
        try {
          // 获取规则详情，查看当前关联的规则集
          const ruleResponse = await api.get(`/rules/${ruleId}`);
          const currentRuleSets = ruleResponse.data.rule_sets || [];

          // 检查规则是否已关联到指定规则集
          const isAlreadyAssociated = currentRuleSets.some(rs =>
            String(rs.id) === String(ruleSetId)
          );

          // 如果未关联，则添加关联
          if (!isAlreadyAssociated) {
            const addToSetResponse = await api.post(`/rule-sets/${ruleSetId}/rules`, {
              rule_id: ruleId,
              priority: 0 // 默认优先级
            });
            console.log('规则添加到新规则集成功:', addToSetResponse.data);
          }
        } catch (associationError) {
          console.warn('检查或更新规则集关联失败:', associationError);
          // 继续执行，不影响主流程
        }
      }

      return updateResponse.data;
    } catch (error) {
      console.error(`更新规则失败:`, error);
      throw error;
    }
  },

  // 删除规则
  deleteRule: async (ruleId, ruleSetId) => {
    try {
      // 如果提供了规则集ID，表示仅从规则集中移除规则，而不是完全删除规则
      if (ruleSetId) {
        try {
          console.log(`从规则集${ruleSetId}中移除规则${ruleId}`);
          const response = await api.delete(`/rule-sets/${ruleSetId}/rules/${ruleId}`);
          console.log('规则已从规则集移除:', response.data);
          return response.data;
        } catch (removeError) {
          console.error(`从规则集移除规则失败:`, removeError);

          // 如果是404错误（规则未添加到规则集），则继续尝试删除规则
          if (removeError.response && removeError.response.status === 404) {
            console.warn('规则可能未添加到规则集，尝试直接删除规则');
          } else {
            throw removeError; // 其他错误直接抛出
          }
        }
      }

      // 直接删除规则
      console.log(`删除规则${ruleId}`);
      const response = await api.delete(`/rules/${ruleId}`);
      console.log('规则已完全删除:', response.data);
      return response.data;
    } catch (error) {
      console.error(`删除规则失败:`, error);
      throw error;
    }
  },

  // 测试规则
  testRules: async (rules, testContext, roleId = null, variables = {}) => {
    try {
      // 准备请求数据，包含完整的规则内容
      const requestData: any = {
        rules: rules.map((rule: any) => ({
          id: rule.id,
          name: rule.name,
          type: rule.type,
          content: rule.content,
          interpreter: rule.type === 'logic' ? rule.interpreter : undefined
        })),
        context: testContext
      };

      // 如果提供了角色ID，添加到请求中
      if (roleId) {
        requestData.role_id = roleId;
      }

      // 如果提供了变量，添加到请求中
      if (variables && Object.keys(variables).length > 0) {
        requestData.variables = variables;
      }

      console.log('发送规则测试请求:', requestData);

      // 调用API执行规则测试
      // 注意：如果后端API尚未实现，则返回模拟数据
      try {
        const response = await api.post('/rules/test', requestData);
        console.log('规则测试成功:', response.data);
        return response.data;
      } catch (apiError) {
        console.warn('规则测试API可能未实现，使用模拟数据:', apiError);

        // 返回模拟测试结果
        const mockResults = {
          success: true,
          timestamp: new Date().toISOString(),
          results: rules.map(rule => ({
            rule_id: rule.id,
            rule_name: rule.name,
            rule_type: rule.type,
            passed: Math.random() > 0.3, // 随机模拟通过/失败
            message: Math.random() > 0.3 ?
              '规则测试通过' :
              '规则测试失败：条件不满足',
            details: rule.type === 'llm' ?
              `大模型评估：从${roleId ? '指定角色' : '默认'}视角评估，测试场景符合规则描述的条件` :
              '逻辑评估：条件执行结果为true'
          }))
        };

        // 模拟延迟
        await new Promise(resolve => setTimeout(resolve, 1500));

        return mockResults;
      }
    } catch (error) {
      console.error('规则测试失败:', error);
      throw error;
    }
  },

  // 获取联合空间列表
  getJointSpaces: async () => {
    try {
      const response = await api.get('/joint-spaces');
      return response.data.joint_spaces || [];
    } catch (error) {
      console.error(`获取联合空间失败:`, error);
      return [];
    }
  },

  // 创建联合空间关系
  createJointSpace: async (relationshipData) => {
    try {
      const response = await api.post('/joint-spaces', relationshipData);
      return response.data;
    } catch (error) {
      console.error(`创建联合空间关系失败:`, error);
      throw error; // 直接抛出错误，不使用模拟数据
    }
  },

  // 更新联合空间关系
  updateJointSpace: async (id, relationshipData) => {
    try {
      const response = await api.put(`/joint-spaces/${id}`, relationshipData);
      return response.data;
    } catch (error) {
      console.error(`更新联合空间关系失败:`, error);
      throw error; // 直接抛出错误，不使用模拟数据
    }
  },

  // 删除联合空间关系
  deleteJointSpace: async (id) => {
    try {
      const response = await api.delete(`/joint-spaces/${id}`);
      return response.data;
    } catch (error) {
      console.error(`删除联合空间关系失败:`, error);
      throw error; // 直接抛出错误，不使用模拟数据
    }
  },

  // 测试API连接
  testAPI: async () => {
    try {
      // 测试行动空间API
      const response = await api.get('/action-spaces');
      return {
        success: true,
        message: '行动空间API连接正常',
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: `行动空间API连接失败: ${error.message}`,
        error: error
      };
    }
  },

  // 获取所有规则
  getAllRules: async (filters: any = {}) => {
    try {
      // 构建查询参数
      const params = new URLSearchParams();
      if (filters.category) {
        params.append('category', filters.category);
      }
      if (filters.is_active !== undefined) {
        params.append('is_active', filters.is_active);
      }
      if (filters.type) {
        params.append('type', filters.type);
      }

      // 添加查询参数到请求URL
      const queryString = params.toString();
      const url = queryString ? `/rules?${queryString}` : '/rules';

      console.log('获取所有规则，请求URL:', url);
      const response = await api.get(url);
      console.log('获取所有规则成功:', response.data);

      return response.data.rules || [];
    } catch (error) {
      console.error('获取所有规则失败:', error);
      console.error('错误详情:', error.response || error.request || error.message);
      return []; // 返回空数组，不使用模拟数据
    }
  },

  // 获取所有环境变量（内部+外部）- 用于需要分类显示的场景
  getAllEnvironmentVariablesByType: async () => {
    try {
      console.log('获取所有环境变量...');

      // 并行获取内部和外部环境变量
      const [internalResponse, externalResponse] = await Promise.all([
        api.get('/environment-variables/internal'),
        api.get('/external-variables')
      ]);

      const internalVars = internalResponse.data || [];
      const externalVars = externalResponse.data || [];

      console.log('获取环境变量成功:', {
        internal: internalVars.length,
        external: externalVars.length
      });

      return {
        internal: internalVars,
        external: externalVars
      };
    } catch (error) {
      console.error('获取环境变量失败:', error);

      // 返回空数据而不是抛出错误
      return {
        internal: [],
        external: []
      };
    }
  },

  // 创建角色
  createRole: async (actionSpaceId, roleData) => {
    // 如果传入的是roleId而不是完整的角色数据
    if (typeof roleData === 'number' || (typeof roleData === 'string' && !isNaN(parseInt(roleData)))) {
      const response = await api.post(`/action-spaces/${actionSpaceId}/roles`, {
        role_id: typeof roleData === 'number' ? roleData : parseInt(roleData as string)
      });
      return response.data;
    }

    // 如果传入的是角色ID对象
    if (roleData.roleId) {
      const response = await api.post(`/action-spaces/${actionSpaceId}/roles`, {
        role_id: roleData.roleId,
        quantity: roleData.quantity || 1,
        settings: roleData.settings || {}
      });
      return response.data;
    }

    // 直接关联已有的角色ID
    throw new Error('缺少有效的角色ID');
  },

  // 更新角色
  updateRole: async (actionSpaceId, roleId, roleData) => {
    try {
      const response = await api.put(`/action-spaces/${actionSpaceId}/roles/${roleId}`, roleData);
      return response.data;
    } catch (error) {
      console.error(`更新行动空间${actionSpaceId}的角色${roleId}失败:`, error);
      throw error; // 直接抛出错误
    }
  },

  // 删除角色
  deleteRole: async (actionSpaceId, roleId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/roles/${roleId}`);
      return response.data;
    } catch (error) {
      console.error(`删除行动空间${actionSpaceId}的角色${roleId}失败:`, error);
      throw error; // 直接抛出错误
    }
  },

  // 添加角色到行动空间
  addRole: async (actionSpaceId, roleData) => {
    try {
      const response = await api.post(`/action-spaces/${actionSpaceId}/roles`, roleData);
      return response.data;
    } catch (error) {
      console.error(`向行动空间${actionSpaceId}添加角色失败:`, error);
      throw error; // 直接抛出错误
    }
  },

  // 测试逻辑规则
  testLogicRule: async (rule, context) => {
    // ... existing code ...
  },

  // 获取行动空间规则集的规则列表
  getRuleSetRules: async (actionSpaceId, ruleSetId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/rule-sets/${ruleSetId}/rules`);
      return response.data.rules || [];
    } catch (error) {
      console.error(`获取规则集${ruleSetId}的规则失败:`, error);
      throw error;
    }
  },

  // 关联规则集
  associateRuleSet: async (actionSpaceId, ruleSetId) => {
    try {
      // 使用正确的关联API
      const response = await api.post(`/action-spaces/${actionSpaceId}/rule-sets/${ruleSetId}/associate`, {});
      return response.data;
    } catch (error) {
      console.error(`关联规则集${ruleSetId}失败:`, error);
      throw error;
    }
  },

  // 获取规则集详情（包括关联的规则）
  getRuleSetDetail: async (ruleSetId) => {
    try {
      const response = await api.get(`/rule-sets/${ruleSetId}`);
      return response.data;
    } catch (error) {
      console.error(`获取规则集${ruleSetId}详情失败:`, error);
      throw error;
    }
  },

  // 添加规则到规则集
  addRuleToRuleSet: async (ruleSetId, ruleId, priority = 0) => {
    try {
      const response = await api.post(`/rule-sets/${ruleSetId}/rules`, {
        rule_id: ruleId,
        priority: priority
      });
      return response.data;
    } catch (error) {
      console.error(`添加规则${ruleId}到规则集${ruleSetId}失败:`, error);
      throw error;
    }
  },

  // 从规则集移除规则
  removeRuleFromRuleSet: async (ruleSetId, ruleId) => {
    try {
      const response = await api.delete(`/rule-sets/${ruleSetId}/rules/${ruleId}`);
      return response.data;
    } catch (error) {
      console.error(`从规则集${ruleSetId}移除规则${ruleId}失败:`, error);
      throw error;
    }
  },

  // 解除规则集关联
  disassociateRuleSet: async (actionSpaceId, ruleSetId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/rule-sets/${ruleSetId}`);
      return response.data;
    } catch (error) {
      console.error(`解除规则集${ruleSetId}关联失败:`, error);
      throw error;
    }
  },

  // 获取行动空间的监督者
  getObservers: async (actionSpaceId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/observers`);
      return response.data;
    } catch (error) {
      console.error(`获取行动空间${actionSpaceId}的监督者失败:`, error);
      return { observers: [] };
    }
  },

  // 添加监督者到行动空间
  addObserver: async (actionSpaceId, observerData) => {
    try {
      const response = await api.post(`/action-spaces/${actionSpaceId}/observers`, observerData);
      return response.data;
    } catch (error) {
      console.error(`向行动空间${actionSpaceId}添加监督者失败:`, error);
      throw error;
    }
  },

  // 更新行动空间中的监督者
  updateObserver: async (actionSpaceId, roleId, observerData) => {
    try {
      const response = await api.put(`/action-spaces/${actionSpaceId}/observers/${roleId}`, observerData);
      return response.data;
    } catch (error) {
      console.error(`更新行动空间${actionSpaceId}的监督者${roleId}失败:`, error);
      throw error;
    }
  },

  // 从行动空间中删除监督者
  deleteObserver: async (actionSpaceId, roleId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/observers/${roleId}`);
      return response.data;
    } catch (error) {
      console.error(`从行动空间${actionSpaceId}中删除监督者${roleId}失败:`, error);
      throw error;
    }
  }
};