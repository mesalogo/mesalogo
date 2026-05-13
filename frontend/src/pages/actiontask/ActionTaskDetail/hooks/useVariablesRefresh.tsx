import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../../../services/api/actionTask';

/**
 * 变量刷新 Hook
 * 负责环境变量和智能体变量的刷新和比较
 */
export default function useVariablesRefresh() {
  const { t } = useTranslation();
  const [variablesRefreshKey, setVariablesRefreshKey] = useState(0);

  /**
   * 刷新变量
   * @param {Object} task - 任务对象
   * @param {Function} setTask - 更新任务状态的函数
   * @param {Function} setRefreshKey - 更新刷新键的函数
   * @returns {Promise<boolean>} - 是否有变化
   */
  const refreshVariables = useCallback(async (task, setTask, setRefreshKey) => {
    if (!task || !task.id) return false;

    try {
      console.log(t('actionTaskDetail.refreshVariables'));

      // 保存当前变量状态用于比较
      const currentEnvVars = task.environment_variables || [];
      const currentAgentVars = task.agent_variables || [];

      // 构建当前变量的映射，用于后续比较
      const currentEnvVarsMap = {};
      currentEnvVars.forEach(v => {
        currentEnvVarsMap[v.name] = v.value;
      });

      // 构建当前智能体变量的映射
      const currentAgentVarsMap = {};
      currentAgentVars.forEach(v => {
        if (!currentAgentVarsMap[v.agent_id]) {
          currentAgentVarsMap[v.agent_id] = {};
        }
        currentAgentVarsMap[v.agent_id][v.name] = v.value;
      });

      // 使用批量API一次获取所有变量
      const batchVariables = await actionTaskAPI.getBatchVariables(task.id);
      console.log('获取到批量变量数据:', batchVariables);

      // 标记变化的环境变量，包括新创建的变量
      const markedEnvVars = batchVariables.environmentVariables.map(v => {
        // 检查是否是新变量（当前映射中不存在）
        const isNewVar = currentEnvVarsMap[v.name] === undefined;
        // 检查值是否变化
        const valueChanged = !isNewVar && String(currentEnvVarsMap[v.name]) !== String(v.value);
        // 新变量或值变化的变量都标记为已变化
        return {
          ...v,
          _hasChanged: isNewVar || valueChanged,
          _isNew: isNewVar // 额外标记是否为新变量，便于调试
        };
      });

      // 标记变化的智能体变量，包括新创建的变量
      const markedAgentVars = batchVariables.agentVariables.map(v => {
        const agentVars = currentAgentVarsMap[v.agent_id] || {};
        // 检查是否是新变量（当前映射中不存在）
        const isNewVar = agentVars[v.name] === undefined;
        // 检查值是否变化
        const valueChanged = !isNewVar && String(agentVars[v.name]) !== String(v.value);
        // 新变量或值变化的变量都标记为已变化
        return {
          ...v,
          _hasChanged: isNewVar || valueChanged,
          _isNew: isNewVar // 额外标记是否为新变量，便于调试
        };
      });

      // 打印新变量和变化的变量，便于调试
      const newEnvVars = markedEnvVars.filter(v => v._isNew);
      const changedEnvVars = markedEnvVars.filter(v => v._hasChanged && !v._isNew);

      if (newEnvVars.length > 0) {
        console.log('检测到新的环境变量:', newEnvVars.map(v => v.name));
      }

      if (changedEnvVars.length > 0) {
        console.log('检测到变化的环境变量:', changedEnvVars.map(v => v.name));
      }

      const newAgentVars = markedAgentVars.filter(v => v._isNew);
      const changedAgentVars = markedAgentVars.filter(v => v._hasChanged && !v._isNew);

      if (newAgentVars.length > 0) {
        console.log('检测到新的智能体变量:', newAgentVars.map(v => `${v.agent_id}:${v.name}`));
      }

      if (changedAgentVars.length > 0) {
        console.log('检测到变化的智能体变量:', changedAgentVars.map(v => `${v.agent_id}:${v.name}`));
      }

      // 检查是否有变化的变量
      const hasChanges = newEnvVars.length > 0 || changedEnvVars.length > 0 ||
                         newAgentVars.length > 0 || changedAgentVars.length > 0;

      // 更新任务状态，保留其他字段不变
      setTask(prevTask => {
        const updatedTask = {
          ...prevTask,
          environment_variables: markedEnvVars,
          agent_variables: markedAgentVars
        };
        console.log('更新后的任务状态:', updatedTask);
        return updatedTask;
      });

      // 刷新变量表格部分
      setVariablesRefreshKey(prev => prev + 1);

      // 只刷新自主任务卡片，不刷新整个对话组件
      if (hasChanges) {
        setRefreshKey(prev => prev + 1);
        console.log('检测到变量变化，已更新自主任务卡片刷新键');
      } else {
        console.log('未检测到变量变化，跳过组件刷新');
      }

      console.log('变量刷新完成，最后更新时间:', batchVariables.lastUpdated);
      return hasChanges; // 返回是否有变化
    } catch (error) {
      console.error('刷新变量失败:', error);
      return false;
    }
  }, [t]);

  return {
    variablesRefreshKey,
    refreshVariables
  };
}
