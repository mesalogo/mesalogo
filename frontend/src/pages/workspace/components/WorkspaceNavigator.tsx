import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Skeleton, Empty, List, Divider } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { actionTaskAPI } from '../../../services/api/actionTask';
import { workspaceAPI } from '../../../services/api/workspace';

const { Text } = Typography;

/**
 * 工作空间导航器组件
 * 显示ActionTask任务和agent-workspace根目录下的其他目录
 */
const WorkspaceNavigator = ({ onItemSelect, selectedItem }: any) => {
  const [tasks, setTasks] = useState([]);
  const [rootDirectories, setRootDirectories] = useState([]);
  const [loading, setLoading] = useState(false);

  // 加载任务列表
  const loadTasks = async () => {
    try {
      const data = await actionTaskAPI.getAll();
      return data || [];
    } catch (error) {
      console.error('加载任务列表失败:', error);
      return [];
    }
  };

  // 加载workspace根目录
  const loadRootDirectories = async () => {
    try {
      const data = await workspaceAPI.getWorkspaceRootDirectories();
      return data.items || [];
    } catch (error) {
      console.error('加载workspace根目录失败:', error);
      return [];
    }
  };

  // 加载所有数据
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksData, rootData] = await Promise.all([
        loadTasks(),
        loadRootDirectories()
      ]);

      setTasks(tasksData);
      setRootDirectories(rootData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // 处理ActionTask点击
  const handleTaskClick = (task) => {
    onItemSelect({
      type: 'action_task',
      data: task,
      path: `ActionTask-${task.id}`
    });
  };

  // 处理根目录点击
  const handleRootClick = () => {
    onItemSelect({
      type: 'root',
      data: { name: '根目录', path: '' },
      path: ''
    });
  };

  // 根目录可见项（排除行动任务目录）
  const rootVisibleItems = rootDirectories.filter(item => !(item.is_directory && item.type === 'action_task'));

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FolderOutlined style={{ marginRight: 8 }} />
          <span>工作空间导航</span>
        </div>
      }
      style={{ height: '100%' }}
      styles={{
        body: {
          padding: 0,
          height: 'calc(100% - 57px)', // 减去header高度
          overflow: 'hidden' // 防止双重滚动条
        }
      }}
    >
      {loading ? (
        <div style={{ padding: '20px' }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '16px 16px 8px 16px',
            flexShrink: 0 // 防止被压缩
          }}>
            <Text type="secondary">
              选择要浏览的工作空间
            </Text>
          </div>

          {/* 可滚动的内容区域 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0 // 确保flex子项可以收缩
          }}>

          {/* ActionTask任务列表 */}
          {tasks.length > 0 && (
            <>
              <div style={{ padding: '8px 16px', fontWeight: 600, fontSize: '14px', color: '#1677ff' }}>
                行动任务工作空间
              </div>
              <List
                dataSource={tasks}
                renderItem={task => {
                  const isSelected = selectedItem?.type === 'action_task' && selectedItem?.data?.id === task.id;
                  return (
                    <List.Item
                      onClick={() => handleTaskClick(task)}
                      style={{
                        cursor: 'pointer',
                        padding: '8px 16px',
                        backgroundColor: isSelected ? 'var(--tree-selected-bg)' : 'transparent',
                        borderLeft: isSelected ? '3px solid #1677ff' : '3px solid transparent'
                      }}
                      className="task-list-item"
                    >
                      <List.Item.Meta
                        avatar={<FolderOutlined style={{ color: '#1677ff' }} />}
                        title={
                          <div style={{
                            fontWeight: isSelected ? 600 : 400,
                            color: isSelected ? '#1677ff' : 'inherit',
                            fontSize: '14px'
                          }}>
                            {task.title}
                          </div>
                        }
                        description={
                          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                            ActionTask-{task.id}
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
                locale={{
                  emptyText: null
                }}
              />
            </>
          )}


          {/* 根目录入口 */}
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ padding: '8px 16px', fontWeight: 600, fontSize: '14px', color: 'var(--custom-text-secondary)' }}>
              根目录
            </div>
            <List.Item
              onClick={handleRootClick}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                backgroundColor: selectedItem?.type === 'root' ? 'var(--tree-selected-bg)' : 'transparent',
                borderLeft: selectedItem?.type === 'root' ? '3px solid var(--custom-text-secondary)' : '3px solid transparent'
              }}
              className="directory-list-item"
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <FolderOutlined style={{ color: 'var(--custom-text-secondary)', marginRight: 8 }} />
                <div>
                  <div style={{
                    fontWeight: selectedItem?.type === 'root' ? 600 : 400,
                    color: selectedItem?.type === 'root' ? 'var(--custom-text-secondary)' : 'inherit',
                    fontSize: '14px'
                  }}>
                    根目录 ({rootVisibleItems.length})
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                    查看根目录下的所有内容
                  </div>
                </div>
              </div>
            </List.Item>
          </>

            {tasks.length === 0 && rootVisibleItems.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <Empty description="暂无工作空间" />
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default WorkspaceNavigator;
