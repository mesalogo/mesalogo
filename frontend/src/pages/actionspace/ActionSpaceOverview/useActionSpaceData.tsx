import { useState, useEffect } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { actionTaskAPI } from '../../../services/api/actionTask';

/**
 * 行动空间数据获取 Hook
 * 负责获取行动空间列表、标签数据等
 */
export const useActionSpaceData = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [actionSpaces, setActionSpaces] = useState([]);
  const [industryTags, setIndustryTags] = useState([]);
  const [scenarioTags, setScenarioTags] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 并行获取数据
      const [spaces, tags, tasks] = await Promise.all([
        actionSpaceAPI.getAll(),
        actionSpaceAPI.getAllTags(),
        actionTaskAPI.getAll()
      ]);

      // 统计任务数
      const taskCount = {};
      (tasks || []).forEach(task => {
        if (task.action_space_id) {
          taskCount[task.action_space_id] = (taskCount[task.action_space_id] || 0) + 1;
        }
      });

      // 处理数据
      const processed = (spaces || []).map(space => ({
        ...space,
        tags: Array.isArray(space.tags) ? space.tags : [],
        action_tasks: Array(taskCount[space.id] || 0).fill(null)
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActionSpaces(processed);
      
      // 分类标签
      const allTags = tags || [];
      setIndustryTags(allTags.filter(tag => tag.type === 'industry'));
      setScenarioTags(allTags.filter(tag => tag.type === 'scenario'));
    } catch (error) {
      console.error('Failed to get data:', error);
      message.error(t('spaceData.fetchFailed'));
      setActionSpaces([]);
      setIndustryTags([]);
      setScenarioTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { 
    actionSpaces, 
    industryTags, 
    scenarioTags, 
    loading, 
    refetch: fetchData 
  };
};
