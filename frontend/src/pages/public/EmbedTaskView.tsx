import React from 'react';
import PublicTaskView from './PublicTaskView';
import './EmbedTaskView.css';

/**
 * 嵌入模式任务查看页面
 * 用于iframe嵌入，去除了一些装饰性元素
 */
const EmbedTaskView = () => {
  return (
    <div className="embed-task-view">
      <PublicTaskView />
    </div>
  );
};

export default EmbedTaskView;

