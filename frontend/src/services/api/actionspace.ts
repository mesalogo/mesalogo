import api from './axios';

/**
 * Action-space API service
 */
export const actionSpaceAPI = {
  // Fetch all action spaces
  getAll: async (filters: any = {}) => {
    try {
      // Build query params
      const params = new URLSearchParams();
      if (filters.name) {
        params.append('name', filters.name);
      }

      // Handle tag filters
      if (filters.tagIds && filters.tagIds.length > 0) {
        filters.tagIds.forEach((tagId: any) => {
          params.append('tag_ids', tagId);
        });
      }

      // Append query params to request URL
      const queryString = params.toString();
      const url = queryString ? `/action-spaces?${queryString}` : '/action-spaces';

      // Request API
      const response = await api.get(url);
      const spaces = response.data.action_spaces || [];

      // Ensure every action space has a valid tags field
      return spaces.map(space => ({
        ...space,
        tags: Array.isArray(space.tags) ? space.tags : []
      }));
    } catch (error) {
      console.error('fetch action spaces failed:', error);
      return []; // Return an empty array instead of mock data
    }
  },

  // Fetch all tags
  getAllTags: async () => {
    try {
      const response = await api.get('/tags');
      return response.data || [];
    } catch (error) {
      console.error('fetch tags failed:', error);
      return [];
    }
  },

  // Create tag
  createTag: async (tagData) => {
    try {
      const response = await api.post('/tags', tagData);
      return response.data;
    } catch (error) {
      console.error('create tag failed:', error);
      throw error;
    }
  },

  // Update tag
  updateTag: async (tagId, tagData) => {
    try {
      const response = await api.put(`/tags/${tagId}`, tagData);
      return response.data;
    } catch (error) {
      console.error(`update tag ${tagId} failed:`, error);
      throw error;
    }
  },

  // Delete tag
  deleteTag: async (tagId) => {
    try {
      const response = await api.delete(`/tags/${tagId}`);
      return response.data;
    } catch (error) {
      console.error(`delete tag ${tagId} failed:`, error);
      throw error;
    }
  },

  // Add tag to action space
  addTag: async (actionSpaceId, tagId) => {
    try {
      const response = await api.post(`/action-spaces/${actionSpaceId}/tags`, { tag_id: tagId });
      return response.data;
    } catch (error) {
      console.error(`add tag ${tagId} to action space ${actionSpaceId} failed:`, error);
      throw error;
    }
  },

  // Remove tag from action space
  removeTag: async (actionSpaceId, tagId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/tags/${tagId}`);
      return response.data;
    } catch (error) {
      console.error(`remove tag ${tagId} from action space ${actionSpaceId} failed:`, error);
      throw error;
    }
  },

  // Fetch single action space
  getById: async (id) => {
    try {
      const response = await api.get(`/action-spaces/${id}`);

      // Ensure rule sets have unique IDs
      if (response.data && response.data.rule_sets) {
        response.data.rule_sets = response.data.rule_sets.map((rs, index) => {
          if (!rs.id) {
            rs.id = `rs-${id}-${index}`; // Ensure rule set has a unique ID
          }
          return rs;
        });
      }

      return response.data;
    } catch (error) {
      console.error(`fetch action space ${id} failed:`, error);
      return null;
    }
  },

  // Fetch action-space detail, including env variables
  getDetail: async (id) => {
    const response = await api.get(`/action-spaces/${id}/detail`);

    // Ensure env variables field exists
    if (!response.data.environment_variables) {
      response.data.environment_variables = [];
    }

    return response.data;
  },

  // Fetch roles linked to action space
  getRoles: async (actionSpaceId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/roles`);
      return response.data.roles || [];
    } catch (error) {
      console.error(`fetch roles for action space ${actionSpaceId} failed:`, error);
      return [];
    }
  },

  // Fetch internal env variables for all action spaces
  getAllEnvironmentVariables: async () => {
    try {
      console.log('requesting all action-space env variables...');
      const response = await api.get('/action-spaces/environment-variables/all');
      console.log('API response:', response.data);

      // Ensure returned data is an array
      const variables = response.data?.variables || response.data || [];
      if (!Array.isArray(variables)) {
        console.warn('API returned non-array env variable data:', variables);
        return [];
      }

      console.log(`fetched ${variables.length} env variables`);
      return variables;
    } catch (error) {
      console.error('fetch all action-space env variables failed:', error);
      console.error('error detail:', error.response?.data || error.message);
      return [];
    }
  },

  // External env variable APIs
  // Fetch all external env variables
  getAllExternalVariables: async () => {
    try {
      const response = await api.get('/external-variables');
      return response.data || [];
    } catch (error) {
      console.error('fetch external env variables failed:', error);
      return [];
    }
  },

  // Create external env variable
  createExternalVariable: async (data) => {
    try {
      const response = await api.post('/external-variables', data);
      return response.data;
    } catch (error) {
      console.error('create external env variable failed:', error);
      throw error;
    }
  },

  // Update external env variable
  updateExternalVariable: async (id, data) => {
    try {
      const response = await api.put(`/external-variables/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('update external env variable failed:', error);
      throw error;
    }
  },

  // Delete external env variable
  deleteExternalVariable: async (id) => {
    try {
      await api.delete(`/external-variables/${id}`);
    } catch (error) {
      console.error('delete external env variable failed:', error);
      throw error;
    }
  },

  // Manually sync external env variable
  syncExternalVariable: async (id) => {
    try {
      const response = await api.post(`/external-variables/${id}/sync`);
      return response.data;
    } catch (error) {
      console.error('sync external env variable failed:', error);
      throw error;
    }
  },

  // Fetch action-space env variables, including traditional and shared variables
  getEnvironmentVariables: async (actionSpaceId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/environment-variables`);
      return response.data;
    } catch (error) {
      console.error(`fetch env variables for action space ${actionSpaceId} failed:`, error);
      return {
        traditional_variables: [],
        shared_variables: []
      };
    }
  },

  // Create env variable
  createEnvironmentVariable: async (actionSpaceId, variableData) => {
    const response = await api.post(`/action-spaces/${actionSpaceId}/environment-variables`, variableData);
    return response.data;
  },

  // Add action-space env variable alias for compatibility
  addSpaceEnvVar: async (actionSpaceId, variableData) => {
    return actionSpaceAPI.createEnvironmentVariable(actionSpaceId, variableData);
  },

  // Update env variable
  updateEnvironmentVariable: async (actionSpaceId, variableId, variableData) => {
    const response = await api.put(`/action-spaces/${actionSpaceId}/environment-variables/${variableId}`, variableData);
    return response.data;
  },

  // Update action-space env variable alias for compatibility
  updateSpaceEnvVar: async (actionSpaceId, variableId, variableData) => {
    return actionSpaceAPI.updateEnvironmentVariable(actionSpaceId, variableId, variableData);
  },

  // Delete env variable
  deleteEnvironmentVariable: async (actionSpaceId, variableId) => {
    const response = await api.delete(`/action-spaces/${actionSpaceId}/environment-variables/${variableId}`);
    return response.data;
  },

  // Delete action-space env variable alias for compatibility
  deleteSpaceEnvVar: async (actionSpaceId, variableId) => {
    return actionSpaceAPI.deleteEnvironmentVariable(actionSpaceId, variableId);
  },

  // Add role variable
  addRoleEnvVar: async (actionSpaceId, roleId, variableData) => {
    const response = await api.post(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables`, variableData);
    return response.data;
  },

  // Update role variable
  updateRoleEnvVar: async (actionSpaceId, roleId, variableId, variableData) => {
    const response = await api.put(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables/${variableId}`, variableData);
    return response.data;
  },

  // Delete role variable
  deleteRoleEnvVar: async (actionSpaceId, roleId, variableId) => {
    const response = await api.delete(`/action-spaces/${actionSpaceId}/roles/${roleId}/environment-variables/${variableId}`);
    return response.data;
  },

  // Create action space
  create: async (actionSpaceData) => {
    try {
      console.log('send create action-space request:', actionSpaceData);
      const response = await api.post('/action-spaces', actionSpaceData);
      return response.data;
    } catch (error) {
      console.error('create action space failed:', error);
      console.error('error detail:', error.response?.data || error.message);
      throw error; // Throw directly instead of using mock data
    }
  },

  // Update action space
  update: async (id, actionSpaceData) => {
    try {
      const response = await api.put(`/action-spaces/${id}`, actionSpaceData);
      return response.data;
    } catch (error) {
      console.error(`update action space ${id} failed:`, error);
      throw error; // Throw directly instead of using mock data
    }
  },

  // Delete action space
  delete: async (id) => {
    try {
      const response = await api.delete(`/action-spaces/${id}`);
      return response.data;
    } catch (error) {
      console.error(`delete action space ${id} failed:`, error);
      throw error; // Throw directly instead of using mock data
    }
  },

  // Fetch action-space preset templates
  getTemplates: async () => {
    try {
      const response = await api.get('/action-spaces/templates');
      return response.data.templates || [];
    } catch (error) {
      console.error('fetch action-space templates failed:', error);
      return []; // Return an empty array instead of mock data
    }
  },

  // Create action space from template
  createFromTemplate: async (templateId, customData = {}) => {
    try {
      const response = await api.post(`/action-spaces/from-template/${templateId}`, customData);
      return response.data;
    } catch (error) {
      console.error(`create action space from template failed:`, error);
      throw error; // Throw directly instead of using mock data
    }
  },

  // Fetch action-space stats
  getStats: async (id) => {
    try {
      const response = await api.get(`/action-spaces/${id}/stats`);
      return response.data;
    } catch (error) {
      console.error(`fetch action-space stats failed:`, error);
      // Return empty data
      return {
        session_count: 0,
        rule_set_count: 0,
        avg_rating: 0,
        total_actions: 0,
        action_distribution: {}
      };
    }
  },

  // Fetch rule sets
  getRuleSets: async (actionSpaceId, cachedSpaces = null) => {
    try {
      let response;
      let ruleSets = [];

      if (actionSpaceId && actionSpaceId !== 'default') {
        // Use action-space rule-set API when an action-space ID is provided
        console.log(`request rule sets for action space (${actionSpaceId})`);
        try {
          response = await api.get(`/action-spaces/${actionSpaceId}/rule-sets`);
          console.log('action-space rule-set API succeeded:', response.data);
          ruleSets = response.data.rule_sets || [];

          // Do not fetch rules per rule set; use stats API instead
        } catch (spaceApiError) {
          console.error('action-space rule-set API failed:', spaceApiError);
          throw spaceApiError; // Rethrow for downstream error handling
        }
      } else {
        // Use cached action-space data or fetch new data when no action-space ID is provided
        if (cachedSpaces && Array.isArray(cachedSpaces) && cachedSpaces.length > 0) {
          console.log('extracting rule sets from cached action spaces; skipping API request');
          const spaces = cachedSpaces;

          // Extract rule sets from action spaces
          const extractedRuleSets = [];
          for (const space of spaces) {
            if (space.rule_sets && Array.isArray(space.rule_sets)) {
              // Attach owning action-space info to each rule set
              const ruleSetsWithSpace = space.rule_sets.map(rs => ({
                ...rs,
                action_space_id: space.id,
                action_space_name: space.name
              }));
              extractedRuleSets.push(...ruleSetsWithSpace);
            }
          }

          console.log(`extracted ${extractedRuleSets.length} rule sets from ${spaces.length} cached action spaces`);
          ruleSets = extractedRuleSets;

          // Do not fetch rules per rule set; fetch only when needed
        } else {
          // Fetch new data when no cached action-space data exists
          console.log('no action-space ID provided; extracting rule sets from all action spaces');
          try {
            const spacesResponse = await api.get('/action-spaces');
            const spaces = spacesResponse.data.action_spaces || [];

            console.log(`found ${spaces.length} action spaces; extracting rule sets`);

            // Extract rule sets from all action spaces
            const extractedRuleSets = [];
            for (const space of spaces) {
              if (space.rule_sets && Array.isArray(space.rule_sets)) {
                // Attach owning action-space info to each rule set
                const ruleSetsWithSpace = space.rule_sets.map(rs => ({
                  ...rs,
                  action_space_id: space.id,
                  action_space_name: space.name
                }));
                extractedRuleSets.push(...ruleSetsWithSpace);
              }
            }

            console.log(`extracted ${extractedRuleSets.length} rule sets from action spaces`);
            ruleSets = extractedRuleSets;

            // Do not fetch rules per rule set; fetch only when needed
          } catch (spacesError) {
            console.error('fetch all action spaces failed:', spacesError);
            throw spacesError; // Rethrow for downstream error handling
          }
        }
      }

      // Ensure rule sets have unique IDs
      ruleSets = ruleSets.map((rs, index) => {
        if (!rs.id) {
          rs.id = `rs-${actionSpaceId || 'default'}-${index}`; // Ensure rule set has a unique ID
        }
        return rs;
      });

      // Deduplicate to avoid showing same-named rule sets repeatedly
      const uniqueRuleSets = [];
      const ruleSetIds = new Set();

      for (const ruleSet of ruleSets) {
        // Use rule-set ID as unique identifier
        if (!ruleSetIds.has(ruleSet.id)) {
          ruleSetIds.add(ruleSet.id);
          uniqueRuleSets.push(ruleSet);
        }
      }

      console.log(`rule sets after dedupe: ${uniqueRuleSets.length} (original ${ruleSets.length})`);
      return uniqueRuleSets;
    } catch (error) {
      console.error('fetch rule sets failed:', error);
      return []; // Return empty array on error
    }
  },

  // Fetch rule-set stats, including rule count and linked action spaces
  async getRuleSetsStats(actionSpaceId) {
    try {
      if (!actionSpaceId || actionSpaceId === 'default') {
        console.log('no valid action-space ID provided; fetching all rule-set info in one request');

        // Request dedicated API for all rule-set stats directly
        const response = await api.get('/rule-sets/all-stats');
        console.log('fetch all rule-set stats succeeded:', response.data);

        return response.data.rule_sets || [];
      }

      console.log(`request rule-set stats for action space (${actionSpaceId})`);
      const response = await api.get(`/action-spaces/${actionSpaceId}/rule-sets/stats`);
      console.log('fetch rule-set stats succeeded:', response.data);

      return response.data.rule_sets || [];
    } catch (error) {
      console.error(`fetch rule-set stats failed:`, error);
      console.error('error detail:', error.response || error.request || error.message);
      return [];
    }
  },

  // Fetch single rule set
  getRuleSet: async (ruleSetId) => {
    try {
      const response = await api.get(`/rule-sets/${ruleSetId}`);
      return response.data;
    } catch (error) {
      console.error(`fetch rule set ${ruleSetId} failed:`, error);
      return null;
    }
  },

  // Create rule set
  createRuleSet: async (ruleSetData) => {
    try {
      // Use action-space rule-set API when action-space ID is present
      if (ruleSetData.action_space_id) {
        const response = await api.post(`/action-spaces/${ruleSetData.action_space_id}/rule-sets`, {
          name: ruleSetData.name,
          description: ruleSetData.description,
          rule_ids: ruleSetData.rule_ids || [],
          rule_names: ruleSetData.rule_names || [],
          rules: ruleSetData.rules || [], // Compatible with legacy rule-name list
          conditions: ruleSetData.conditions || [],
          actions: ruleSetData.actions || [],
          settings: ruleSetData.settings || {}
        });
        return response.data;
      } else {
        // Create standalone rule set
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
      console.error(`create rule set failed:`, error);
      throw error;
    }
  },

  // Update rule set
  updateRuleSet: async (ruleSetId, ruleSetData) => {
    try {
      const updateData: any = {
        name: ruleSetData.name,
        description: ruleSetData.description,
        conditions: ruleSetData.conditions || [],
        actions: ruleSetData.actions || [],
        settings: ruleSetData.settings || {}
      };

      // Add rule IDs to update data when present
      if (ruleSetData.rule_ids && Array.isArray(ruleSetData.rule_ids)) {
        updateData.rule_ids = ruleSetData.rule_ids;
      }

      // Add rule priority map to update data when present
      if (ruleSetData.rule_priorities && typeof ruleSetData.rule_priorities === 'object') {
        updateData.rule_priorities = ruleSetData.rule_priorities;
      }

      // Add action-space IDs to update data when present
      if (ruleSetData.action_space_ids && Array.isArray(ruleSetData.action_space_ids)) {
        updateData.action_space_ids = ruleSetData.action_space_ids;
      }

      // Use action-space rule-set API when action-space ID is present
      if (ruleSetData.action_space_id) {
        const response = await api.put(`/action-spaces/${ruleSetData.action_space_id}/rule-sets/${ruleSetId}`, updateData);
        return response.data;
      } else {
        // Otherwise use generic rule-set API
        const response = await api.put(`/rule-sets/${ruleSetId}`, updateData);
        return response.data;
      }
    } catch (error) {
      console.error(`update rule set failed:`, error);
      throw error;
    }
  },

  // Delete rule set
  deleteRuleSet: async (ruleSetId) => {
    try {
      // Try deleting via rule-set API
      try {
        const response = await api.delete(`/rule-sets/${ruleSetId}`);
        return response.data;
      } catch (directError) {
        console.warn(`direct rule-set deletion failed; trying action-space deletion:`, directError);

        // Try locating the action space that owns the rule set
        const allSpaces = await api.get('/action-spaces');
        const spaces = allSpaces.data.action_spaces || [];

        for (const space of spaces) {
          if (space.rule_sets && Array.isArray(space.rule_sets)) {
            const matchingRuleSet = space.rule_sets.find(rs => rs.id === ruleSetId);
            if (matchingRuleSet) {
              // Found owning action space; use action-space rule-set API
              console.log(`found owning action space for rule set: ${space.id}`);
              const response = await api.delete(`/action-spaces/${space.id}/rule-sets/${ruleSetId}`);
              return response.data;
            }
          }
        }

        // Rethrow if owning action space cannot be found
        throw directError;
      }
    } catch (error) {
      console.error(`delete rule set failed:`, error);
      throw error;
    }
  },

  // Create rule
  createRule: async (ruleData) => {
    try {
      // Ensure rule type exists
      if (!ruleData.type) {
        ruleData.type = 'llm'; // Default to natural-language rule
      }

      // Save rule-set ID
      const ruleSetId = ruleData.rule_set_id;

      // Remove rule_set_id because API does not need it
      const { rule_set_id, ...ruleDataWithoutSetId } = ruleData;

      // Create rule first
      const createResponse = await api.post('/rules', ruleDataWithoutSetId);
      console.log('rule created successfully:', createResponse.data);

      // Get newly-created rule ID
      const newRuleId = createResponse.data.id;

      // Add rule to rule set when rule-set ID exists
      if (ruleSetId) {
        // Add rule to rule set
        const addToSetResponse = await api.post(`/rule-sets/${ruleSetId}/rules`, {
          rule_id: newRuleId,
          priority: 0 // Default priority
        });
        console.log('rule added to rule set successfully:', addToSetResponse.data);
      }

      return createResponse.data;
    } catch (error) {
      console.error(`create rule failed:`, error);
      throw error;
    }
  },

  // Update rule
  updateRule: async (ruleId, ruleData) => {
    try {
      // Ensure rule type exists
      if (!ruleData.type) {
        ruleData.type = 'llm'; // Default to natural-language rule
      }

      // Save rule-set ID
      const ruleSetId = ruleData.rule_set_id;

      // Remove rule_set_id because update rule API does not need this field
      const { rule_set_id, ...ruleDataWithoutSetId } = ruleData;

      // Add detailed log output
      console.log('updating rule:', ruleId);
      console.log('rule type:', ruleDataWithoutSetId.type);
      console.log('rule data:', JSON.stringify(ruleDataWithoutSetId, null, 2));

      // Ensure logic-rule interpreter info is passed correctly
      if (ruleDataWithoutSetId.type === 'logic' && ruleDataWithoutSetId.interpreter) {
        console.log('logic-rule interpreter:', ruleDataWithoutSetId.interpreter);

        // Ensure settings field exists
        if (!ruleDataWithoutSetId.settings) {
          ruleDataWithoutSetId.settings = {};
        }

        // Save interpreter to settings as well so backend can process it correctly
        ruleDataWithoutSetId.settings.interpreter = ruleDataWithoutSetId.interpreter;
      }

      // Send update request
      const updateResponse = await api.put(`/rules/${ruleId}`, ruleDataWithoutSetId);
      console.log('rule updated successfully:', updateResponse.data);

      // Ensure rule and rule-set association when rule-set ID exists
      if (ruleSetId) {
        try {
          // Fetch rule detail to inspect current linked rule sets
          const ruleResponse = await api.get(`/rules/${ruleId}`);
          const currentRuleSets = ruleResponse.data.rule_sets || [];

          // Check whether rule is already linked to the specified rule set
          const isAlreadyAssociated = currentRuleSets.some(rs =>
            String(rs.id) === String(ruleSetId)
          );

          // Add link if missing
          if (!isAlreadyAssociated) {
            const addToSetResponse = await api.post(`/rule-sets/${ruleSetId}/rules`, {
              rule_id: ruleId,
              priority: 0 // Default priority
            });
            console.log('rule added to new rule set successfully:', addToSetResponse.data);
          }
        } catch (associationError) {
          console.warn('check or update rule-set association failed:', associationError);
          // Continue without affecting main flow
        }
      }

      return updateResponse.data;
    } catch (error) {
      console.error(`update rule failed:`, error);
      throw error;
    }
  },

  // Delete rule
  deleteRule: async (ruleId, ruleSetId) => {
    try {
      // If rule-set ID is provided, remove the rule from the rule set instead of fully deleting it
      if (ruleSetId) {
        try {
          console.log(`removing rule ${ruleId} from rule set ${ruleSetId}`);
          const response = await api.delete(`/rule-sets/${ruleSetId}/rules/${ruleId}`);
          console.log('rule removed from rule set:', response.data);
          return response.data;
        } catch (removeError) {
          console.error(`remove rule from rule set failed:`, removeError);

          // If this is 404 (rule not in rule set), continue trying direct deletion
          if (removeError.response && removeError.response.status === 404) {
            console.warn('rule may not be in rule set; trying direct deletion');
          } else {
            throw removeError; // Rethrow other errors directly
          }
        }
      }

      // Delete rule directly
      console.log(`Delete rule${ruleId}`);
      const response = await api.delete(`/rules/${ruleId}`);
      console.log('rule fully deleted:', response.data);
      return response.data;
    } catch (error) {
      console.error(`delete rule failed:`, error);
      throw error;
    }
  },

  // Test rules
  testRules: async (rules, testContext, roleId = null, variables = {}) => {
    try {
      // Prepare request data with full rule content
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

      // Add role ID to request when provided
      if (roleId) {
        requestData.role_id = roleId;
      }

      // Add variables to request when provided
      if (variables && Object.keys(variables).length > 0) {
        requestData.variables = variables;
      }

      console.log('send rule-test request:', requestData);

      // Call API to run rule test
      // Note: no mock fallback; backend API is required
      try {
        const response = await api.post('/rules/test', requestData);
        console.log('rule test succeeded:', response.data);
        return response.data;
      } catch (apiError) {
        console.warn('rule-test API failed:', apiError);
        throw apiError;
      }
    } catch (error) {
      console.error('rule test failed:', error);
      throw error;
    }
  },

  // Fetch joint spaces
  getJointSpaces: async () => {
    try {
      const response = await api.get('/joint-spaces');
      return response.data.joint_spaces || [];
    } catch (error) {
      console.error(`fetch joint spaces failed:`, error);
      return [];
    }
  },

  // Create joint-space relationship
  createJointSpace: async (relationshipData) => {
    try {
      const response = await api.post('/joint-spaces', relationshipData);
      return response.data;
    } catch (error) {
      console.error(`create joint-space relationship failed:`, error);
      throw error; // Throw directly instead of using mock data
    }
  },

  // Update joint-space relationship
  updateJointSpace: async (id, relationshipData) => {
    try {
      const response = await api.put(`/joint-spaces/${id}`, relationshipData);
      return response.data;
    } catch (error) {
      console.error(`update joint-space relationship failed:`, error);
      throw error; // Throw directly instead of using mock data
    }
  },

  // Delete joint-space relationship
  deleteJointSpace: async (id) => {
    try {
      const response = await api.delete(`/joint-spaces/${id}`);
      return response.data;
    } catch (error) {
      console.error(`delete joint-space relationship failed:`, error);
      throw error; // Throw directly instead of using mock data
    }
  },

  // Test API connection
  testAPI: async () => {
    try {
      // Test action-space API
      const response = await api.get('/action-spaces');
      return {
        success: true,
        message: 'Action-space API connection OK',
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: `Action-space API connection failed: ${error.message}`,
        error: error
      };
    }
  },

  // Fetch all rules
  getAllRules: async (filters: any = {}) => {
    try {
      // Build query params
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

      // Append query params to request URL
      const queryString = params.toString();
      const url = queryString ? `/rules?${queryString}` : '/rules';

      console.log('fetch all rules, request URL:', url);
      const response = await api.get(url);
      console.log('fetch all rules succeeded:', response.data);

      return response.data.rules || [];
    } catch (error) {
      console.error('fetch all rules failed:', error);
      console.error('error detail:', error.response || error.request || error.message);
      return []; // Return an empty array instead of mock data
    }
  },

  // Fetch all env variables (internal + external) for classified display
  getAllEnvironmentVariablesByType: async () => {
    try {
      console.log('fetching all env variables...');

      // Fetch internal and external env variables in parallel
      const [internalResponse, externalResponse] = await Promise.all([
        api.get('/environment-variables/internal'),
        api.get('/external-variables')
      ]);

      const internalVars = internalResponse.data || [];
      const externalVars = externalResponse.data || [];

      console.log('fetch env variables succeeded:', {
        internal: internalVars.length,
        external: externalVars.length
      });

      return {
        internal: internalVars,
        external: externalVars
      };
    } catch (error) {
      console.error('fetch env variables failed:', error);

      // Return empty data instead of throwing
      return {
        internal: [],
        external: []
      };
    }
  },

  // Create role
  createRole: async (actionSpaceId, roleData) => {
    // If roleId is passed instead of full role data
    if (typeof roleData === 'number' || (typeof roleData === 'string' && !isNaN(parseInt(roleData)))) {
      const response = await api.post(`/action-spaces/${actionSpaceId}/roles`, {
        role_id: typeof roleData === 'number' ? roleData : parseInt(roleData as string)
      });
      return response.data;
    }

    // If a role ID object is passed
    if (roleData.roleId) {
      const response = await api.post(`/action-spaces/${actionSpaceId}/roles`, {
        role_id: roleData.roleId,
        quantity: roleData.quantity || 1,
        settings: roleData.settings || {}
      });
      return response.data;
    }

    // Link existing role ID directly
    throw new Error('Missing valid role ID');
  },

  // Update role
  updateRole: async (actionSpaceId, roleId, roleData) => {
    try {
      const response = await api.put(`/action-spaces/${actionSpaceId}/roles/${roleId}`, roleData);
      return response.data;
    } catch (error) {
      console.error(`update role ${roleId} in action space ${actionSpaceId} failed:`, error);
      throw error; // Throw directly
    }
  },

  // Delete role
  deleteRole: async (actionSpaceId, roleId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/roles/${roleId}`);
      return response.data;
    } catch (error) {
      console.error(`delete role ${roleId} from action space ${actionSpaceId} failed:`, error);
      throw error; // Throw directly
    }
  },

  // Add role to action space
  addRole: async (actionSpaceId, roleData) => {
    try {
      const response = await api.post(`/action-spaces/${actionSpaceId}/roles`, roleData);
      return response.data;
    } catch (error) {
      console.error(`add role to action space ${actionSpaceId} failed:`, error);
      throw error; // Throw directly
    }
  },

  // Test logic rule
  testLogicRule: async (rule, context) => {
    // ... existing code ...
  },

  // Fetch action-space rule-set rules
  getRuleSetRules: async (actionSpaceId, ruleSetId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/rule-sets/${ruleSetId}/rules`);
      return response.data.rules || [];
    } catch (error) {
      console.error(`fetch rules for rule set ${ruleSetId} failed:`, error);
      throw error;
    }
  },

  // Link rule set
  associateRuleSet: async (actionSpaceId, ruleSetId) => {
    try {
      // Use correct association API
      const response = await api.post(`/action-spaces/${actionSpaceId}/rule-sets/${ruleSetId}/associate`, {});
      return response.data;
    } catch (error) {
      console.error(`link rule set ${ruleSetId} failed:`, error);
      throw error;
    }
  },

  // Fetch rule-set detail, including linked rules
  getRuleSetDetail: async (ruleSetId) => {
    try {
      const response = await api.get(`/rule-sets/${ruleSetId}`);
      return response.data;
    } catch (error) {
      console.error(`fetch rule set ${ruleSetId} detail failed:`, error);
      throw error;
    }
  },

  // Add rule to rule set
  addRuleToRuleSet: async (ruleSetId, ruleId, priority = 0) => {
    try {
      const response = await api.post(`/rule-sets/${ruleSetId}/rules`, {
        rule_id: ruleId,
        priority: priority
      });
      return response.data;
    } catch (error) {
      console.error(`add rule ${ruleId} to rule set ${ruleSetId} failed:`, error);
      throw error;
    }
  },

  // Remove rule from rule set
  removeRuleFromRuleSet: async (ruleSetId, ruleId) => {
    try {
      const response = await api.delete(`/rule-sets/${ruleSetId}/rules/${ruleId}`);
      return response.data;
    } catch (error) {
      console.error(`remove rule ${ruleId} from rule set ${ruleSetId} failed:`, error);
      throw error;
    }
  },

  // Unlink rule set
  disassociateRuleSet: async (actionSpaceId, ruleSetId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/rule-sets/${ruleSetId}`);
      return response.data;
    } catch (error) {
      console.error(`unlink rule set ${ruleSetId} failed:`, error);
      throw error;
    }
  },

  // Fetch action-space supervisors
  getObservers: async (actionSpaceId) => {
    try {
      const response = await api.get(`/action-spaces/${actionSpaceId}/observers`);
      return response.data;
    } catch (error) {
      console.error(`fetch supervisors for action space ${actionSpaceId} failed:`, error);
      return { observers: [] };
    }
  },

  // Add supervisor to action space
  addObserver: async (actionSpaceId, observerData) => {
    try {
      const response = await api.post(`/action-spaces/${actionSpaceId}/observers`, observerData);
      return response.data;
    } catch (error) {
      console.error(`add supervisor to action space ${actionSpaceId} failed:`, error);
      throw error;
    }
  },

  // Update supervisor in action space
  updateObserver: async (actionSpaceId, roleId, observerData) => {
    try {
      const response = await api.put(`/action-spaces/${actionSpaceId}/observers/${roleId}`, observerData);
      return response.data;
    } catch (error) {
      console.error(`update supervisor ${roleId} in action space ${actionSpaceId} failed:`, error);
      throw error;
    }
  },

  // Delete supervisor from action space
  deleteObserver: async (actionSpaceId, roleId) => {
    try {
      const response = await api.delete(`/action-spaces/${actionSpaceId}/observers/${roleId}`);
      return response.data;
    } catch (error) {
      console.error(`delete supervisor ${roleId} from action space ${actionSpaceId} failed:`, error);
      throw error;
    }
  }
};