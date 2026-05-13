import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, Empty, List } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { actionTaskAPI } from '../../../services/api/actionTask';

const { Text } = Typography;

/**
 * 任务选择器组件
 * 用于列表展示所有行动任务
 */
const TaskSelector = ({ onTaskSelect, selectedTask }: any) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // 加载任务列表
  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await actionTaskAPI.getAll();
      setTasks(data || []);
    } catch (error) {
      console.error('加载任务列表失败:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleTaskClick = (task) => {
    onTaskSelect(task);
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FolderOutlined style={{ marginRight: 8 }} />
          <span>选择任务</span>
        </div>
      }
      style={{ height: '100%' }}
      styles={{ body: { padding: 0 } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      ) : (
        <div>
          <div style={{ padding: '16px 16px 8px 16px' }}>
            <Text type="secondary">
              选择要浏览项目文件的行动任务
            </Text>
          </div>

          <List
            dataSource={tasks}
            renderItem={task => (
              <List.Item
                onClick={() => handleTaskClick(task)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 16px',
                  backgroundColor: selectedTask?.id === task.id ? 'var(--tree-selected-bg)' : 'transparent',
                  borderLeft: selectedTask?.id === task.id ? '3px solid #1677ff' : '3px solid transparent'
                }}
                className="task-list-item"
              >
                <List.Item.Meta
                  title={
                    <div style={{
                      fontWeight: selectedTask?.id === task.id ? 600 : 400,
                      color: selectedTask?.id === task.id ? '#1677ff' : 'inherit'
                    }}>
                      {task.title}
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                        行动空间: {task.action_space_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                        创建时间: {new Date(task.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
            locale={{
              emptyText: <Empty description="暂无行动任务" />
            }}
          />
        </div>
      )}


    </Card>
  );
};

export default TaskSelector;
