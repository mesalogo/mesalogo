import { useState, useEffect } from 'react';
import { message } from 'antd';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { api as apiInstance } from '../../../services/api/index';

// 缓存数据
let ruleSetsCache = [];
let allRulesCache = [];
let lastFetchRuleSetsTime = 0;
let lastFetchRulesTime = 0;
const CACHE_TIMEOUT = 300000;

const isCacheExpired = (lastFetchTime) => {
  return Date.now() - lastFetchTime > CACHE_TIMEOUT;
};

export const useActionRulesData = (activeTab) => {
  const [ruleSets, setRuleSets] = useState([]);
  const [allRules, setAllRules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [environmentVariables, setEnvironmentVariables] = useState({ internal: [], external: [] });
  const [loading, setLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [variablesLoading, setVariablesLoading] = useState(false);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  const fetchRuleSets = async (forceRefresh = false) => {
    if (ruleSetsCache.length > 0 && !isCacheExpired(lastFetchRuleSetsTime) && !forceRefresh) {
      setRuleSets(ruleSetsCache);
      return;
    }

    setLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const spaceId = urlParams.get('spaceId');
      const isValidSpaceId = spaceId && !isNaN(Number(spaceId));

      const data = await actionSpaceAPI.getRuleSetsStats(isValidSpaceId ? spaceId : null);
      
      const processedRuleSets = data.map(ruleSet => ({
        ...ruleSet,
        rule_count: ruleSet.rule_count !== undefined ? ruleSet.rule_count : 0,
        related_spaces: Array.isArray(ruleSet.related_spaces) ? ruleSet.related_spaces : [],
        rules: Array.isArray(ruleSet.rules) ? ruleSet.rules : []
      }));

      ruleSetsCache = processedRuleSets;
      lastFetchRuleSetsTime = Date.now();
      setRuleSets(processedRuleSets);
    } catch (error) {
      console.error('获取规则集列表失败:', error);
      message.error('获取规则集列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRules = async (forceRefresh = false) => {
    if (allRulesCache.length > 0 && !isCacheExpired(lastFetchRulesTime) && !forceRefresh) {
      setAllRules(allRulesCache);
      setRulesLoaded(true);
      return;
    }

    setRulesLoading(true);
    try {
      const rulesData = await actionSpaceAPI.getAllRules();
      allRulesCache = rulesData;
      lastFetchRulesTime = Date.now();
      setAllRules(rulesData);
      setRulesLoaded(true);
    } catch (error) {
      console.error('获取规则列表失败:', error);
      message.error('获取规则列表失败');
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchRoles = async () => {
    setRolesLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const spaceId = urlParams.get('spaceId');
      const isValidSpaceId = spaceId && !isNaN(Number(spaceId));

      let rolesData = [];
      if (isValidSpaceId) {
        rolesData = await actionSpaceAPI.getRoles(spaceId);
      }

      if (!rolesData || rolesData.length === 0) {
        try {
          const response = await apiInstance.get('/roles');
          rolesData = response.data.roles || [];
        } catch (error) {
          console.error('获取所有角色失败:', error);
        }
      }

      setRoles(rolesData);
    } catch (error) {
      console.error('获取角色列表失败:', error);
      message.error('获取角色列表失败');
    } finally {
      setRolesLoading(false);
    }
  };

  const fetchEnvironmentVariables = async () => {
    setVariablesLoading(true);
    try {
      const variables = await actionSpaceAPI.getAllEnvironmentVariablesByType();
      setEnvironmentVariables(variables);
    } catch (error) {
      console.error('获取环境变量失败:', error);
      setEnvironmentVariables({ internal: [], external: [] });
    } finally {
      setVariablesLoading(false);
    }
  };

  useEffect(() => {
    fetchRuleSets();
  }, []);

  useEffect(() => {
    if (activeTab === 'ruleEditor' && !rulesLoaded) {
      fetchAllRules();
    }
  }, [activeTab, rulesLoaded]);

  return {
    ruleSets,
    allRules,
    roles,
    environmentVariables,
    loading,
    rulesLoading,
    rolesLoading,
    variablesLoading,
    rulesLoaded,
    refetchRuleSets: fetchRuleSets,
    refetchAllRules: fetchAllRules,
    refetchRoles: fetchRoles,
    refetchEnvironmentVariables: fetchEnvironmentVariables
  };
};
