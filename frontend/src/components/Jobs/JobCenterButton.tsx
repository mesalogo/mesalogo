/**
 * 后台任务中心按钮
 * 
 * 右上角显示的后台任务中心入口按钮，带未读数量徽章
 */

import React, { useState, useEffect } from 'react';
import { Badge, Button, Tooltip } from 'antd';
import { BarsOutlined, FileDoneOutlined, ProjectOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import jobsAPI from '../../services/api/jobs';
import JobCenterDrawer from './JobCenterDrawer';

const JobCenterButton = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [runningCount, setRunningCount] = useState(0);

  // 获取运行中的任务数量
  useEffect(() => {
    const fetchRunningCount = async () => {
      try {
        const stats = await jobsAPI.getStats();
        // 运行中 + 等待中 + 重试中
        const count = (stats.running || 0) + (stats.pending || 0);
        setRunningCount(count);
      } catch (error) {
        console.error('获取任务统计失败:', error);
      }
    };

    // 立即执行一次
    fetchRunningCount();

    // 每 30 秒刷新一次（降低轮询频率）
    const interval = setInterval(fetchRunningCount, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Tooltip title={t('jobs.center')}>
        <Badge count={runningCount} offset={[-5, 5]}>
          <Button
            type="text"
            icon={<BarsOutlined />}
            onClick={() => setOpen(true)}
          />
        </Badge>
      </Tooltip>

      <JobCenterDrawer
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default JobCenterButton;
