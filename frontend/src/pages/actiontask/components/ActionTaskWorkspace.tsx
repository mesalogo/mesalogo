import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Typography, Skeleton, Empty, message, Button, Space, Breadcrumb, Upload, Modal, Radio, Segmented } from 'antd';
import { EyeOutlined, DeleteOutlined, HomeOutlined, ReloadOutlined, UploadOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import WorkspaceFileViewer from '../../workspace/components/WorkspaceFileViewer';
import { workspaceAPI } from '../../../services/api/workspace';
import { actionTaskAPI } from '../../../services/api/actionTask';
import { getFileIcon, getDisplayName, formatFileSize, processFileData } from '../../../utils/workspaceUtils';

const { Text } = Typography;

/**
 * 行动任务工作空间组件
 * 直接引用工作空间浏览器的文件展示逻辑，展示当前任务下的所有文件
 * @param {Object} task - 任务对象
 * @param {string|null} respondingAgentId - 当前正在响应的智能体ID
 */
const ActionTaskWorkspace = ({ task, respondingAgentId }) => {
  const { t } = useTranslation();
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [agentInfo, setAgentInfo] = useState({}); // 智能体信息缓存
  const [currentPath, setCurrentPath] = useState(''); // 当前浏览的路径
  const [breadcrumbs, setBreadcrumbs] = useState([]); // 面包屑导航
  const [viewMode, setViewMode] = useState('task');
  const [isPolling, setIsPolling] = useState(false); // 防止并发请求

  // 获取智能体信息
  const loadAgentInfo = async (task) => {
    try {
      // 获取任务的智能体信息
      const agents = await actionTaskAPI.getAgents(task.id);
      const agentMap = {};
      agents.forEach(agent => {
        agentMap[agent.id] = {
          name: agent.name,
          role_name: agent.role_name
        };
      });
      setAgentInfo(agentMap);
    } catch (error) {
      console.error('获取智能体信息失败:', error);
    }
  };

  // 加载工作空间文件
  const loadWorkspaceFiles = async (mode = viewMode, path = '') => {
    if (!task || !task.id) return;

    setLoading(true);
    try {
      let data;
      let processedFiles = [];

      if (mode === 'root') {
        // 根目录浏览：支持目录与文件，以及子目录导航
        if (!path) {
          const root = await workspaceAPI.getWorkspaceRootDirectories();
          data = {
            items: (root.items || [])
              .filter(it => !(it.is_directory && (it.type === 'action_task' || (it.name || '').startsWith('ActionTask-'))))
              .map(it => ({
                file_name: it.name,
                file_path: it.path,
                is_directory: it.is_directory,
                size: it.size,
                modified_time: it.modified_time
              }))
          };
        } else {
          const [dir, ...rest] = path.split('/');
          const subPath = rest.join('/');
          data = await workspaceAPI.getWorkspaceDirectoryFiles(dir, subPath);
        }
        processedFiles = processFileData(data, {});
      } else {
        // 加载任务工作空间文件
        let currentAgentInfo = agentInfo;
        if (Object.keys(agentInfo).length === 0 || (agentInfo as any)._taskId !== task.id) {
          await loadAgentInfo(task);
          const agents = await actionTaskAPI.getAgents(task.id);
          const agentMap: any = { _taskId: task.id };
          agents.forEach(agent => {
            agentMap[agent.id] = {
              name: agent.name,
              role_name: agent.role_name
            };
          });
          currentAgentInfo = agentMap;
          setAgentInfo(agentMap);
        }

        data = await workspaceAPI.getWorkspaceFiles(task.id, path);
        processedFiles = processFileData(data, currentAgentInfo);
      }

      // 设置导航状态
      setCurrentPath(path);

      if (mode === 'root') {
        if (path) {
          const pathParts = path.split('/');
          const breadcrumbs = [{ name: t('workspace.rootDirectory'), path: '' }];
          let cur = '';
          pathParts.forEach((part) => {
            cur = cur ? `${cur}/${part}` : part;
            breadcrumbs.push({ name: part, path: cur });
          });
          setBreadcrumbs(breadcrumbs);
        } else {
          setBreadcrumbs([{ name: t('workspace.rootDirectory'), path: '' }]);
        }
      } else if (path) {
        const pathParts = path.split('/');
        const breadcrumbs = [{ name: task.title, path: '' }];
        let currentPath = '';
        pathParts.forEach((part) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          breadcrumbs.push({ name: part, path: currentPath });
        });
        setBreadcrumbs(breadcrumbs);
      } else {
        setBreadcrumbs([{ name: task.title, path: '' }]);
      }

      setWorkspaceFiles(processedFiles);

    } catch (error) {
      console.error('加载工作空间文件失败:', error);
      message.error('加载工作空间文件失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理视图模式切换
  const handleViewModeChange = (e) => {
    const newMode = e.target.value;

    // 立即更新状态，清空数据
    setViewMode(newMode);
    setWorkspaceFiles([]);
    setBreadcrumbs([]);
    setCurrentPath('');

    // 直接传递新模式给加载函数
    loadWorkspaceFiles(newMode);
  };

  // 处理目录点击
  const handleDirectoryClick = (record) => {
    if (!record.isDirectory) return;

    if (viewMode === 'root') {
      const newPath = currentPath ? `${currentPath}/${record.file_name}` : record.file_name;
      loadWorkspaceFiles('root', newPath);
      return;
    }

    // 从完整路径中提取相对于任务目录的子路径
    // 例如：ActionTask-5/Agent-5 -> Agent-5
    const taskPrefix = `ActionTask-${task.id}/`;
    let subPath = record.file_path;
    if (subPath.startsWith(taskPrefix)) {
      subPath = subPath.substring(taskPrefix.length);
    }
    loadWorkspaceFiles(viewMode, subPath);
  };

  // 处理面包屑导航
  const handleBreadcrumbClick = (breadcrumb) => {
    console.log('面包屑导航，路径:', breadcrumb.path);
    loadWorkspaceFiles(viewMode, breadcrumb.path);
  };

  // 查看文件
  const handleViewFile = (file) => {
    setSelectedFile(file);
    setIsViewerVisible(true);
  };

  // 删除文件
  const handleDeleteFile = (file) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文件 "${file.file_name}" 吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await workspaceAPI.deleteWorkspaceFile(file.file_path);
          message.success('文件删除成功');
          loadWorkspaceFiles(viewMode, currentPath); // 重新加载当前目录
        } catch (error) {
          console.error('删除文件失败:', error);
          message.error('删除文件失败');
        }
      }
    });
  };

  // 处理文件上传
  const handleFileUpload = async (file) => {
    if (viewMode === 'root') {
      message.error(t('workspace.rootUploadNotSupported'));
      return false;
    }

    if (!task || !task.id) {
      message.error('任务信息无效');
      return false;
    }

    // 检查文件大小（10MB限制）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      message.error('文件大小不能超过10MB');
      return false;
    }

    try {
      const result = await workspaceAPI.uploadWorkspaceFile(task.id, currentPath, file);
      if (result.success) {
        message.success('文件上传成功');
        loadWorkspaceFiles(viewMode, currentPath); // 重新加载当前目录
      } else {
        message.error(result.error || '文件上传失败');
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      message.error('文件上传失败');
    }

    return false; // 阻止默认上传行为
  };

  /**
   * 静默刷新文件列表（不显示loading状态）
   * 用于轮询时的增量更新
   */
  const silentRefreshFiles = useCallback(async () => {
    if (!task || !task.id || isPolling) return;

    setIsPolling(true);
    try {
      let data;
      let processedFiles = [];

      if (viewMode === 'root') {
        // 根目录浏览
        if (!currentPath) {
          const root = await workspaceAPI.getWorkspaceRootDirectories();
          data = {
            items: (root.items || [])
              .filter(it => !(it.is_directory && (it.type === 'action_task' || (it.name || '').startsWith('ActionTask-'))))
              .map(it => ({
                file_name: it.name,
                file_path: it.path,
                is_directory: it.is_directory,
                size: it.size,
                modified_time: it.modified_time
              }))
          };
        } else {
          const [dir, ...rest] = currentPath.split('/');
          const subPath = rest.join('/');
          data = await workspaceAPI.getWorkspaceDirectoryFiles(dir, subPath);
        }
        processedFiles = processFileData(data, {});
      } else {
        // 任务工作空间
        data = await workspaceAPI.getWorkspaceFiles(task.id, currentPath);
        processedFiles = processFileData(data, agentInfo);
      }

      // 使用函数式更新避免依赖workspaceFiles
      setWorkspaceFiles(currentFiles => {
        // 对比新旧文件，标记变化（内联函数）
        const oldMap = new Map(currentFiles.map(f => [f.file_path, f]));
        
        const mergedFiles = processedFiles.map(newFile => {
          const oldFile = oldMap.get(newFile.file_path);
          
          // 新增文件
          if (!oldFile) {
            return { ...newFile, _isNew: true, _timestamp: Date.now() };
          }
          
          // 检测文件是否被修改
          const oldTime = oldFile.modified_time || oldFile.updated_at;
          const newTime = newFile.modified_time || newFile.updated_at;
          
          if (oldTime !== newTime) {
            return { ...newFile, _hasChanged: true, _timestamp: Date.now() };
          }
          
          // 未变化：保留旧对象引用
          return oldFile;
        });

        // 检查是否有实际变化
        const hasChanges = mergedFiles.some(f => f._isNew || f._hasChanged);

        if (hasChanges) {
          console.log('检测到工作空间文件变化');
          return mergedFiles;
        }
        
        // 无变化时返回原数组
        return currentFiles;
      });
    } catch (error) {
      console.error('静默刷新文件失败:', error);
    } finally {
      setIsPolling(false);
    }
  }, [task, viewMode, currentPath, agentInfo, isPolling]);

  // 初始化时加载工作空间文件
  useEffect(() => {
    if (task && task.id) {
      loadWorkspaceFiles();
    }
  }, [task?.id]);

  // 轮询：只在Agent响应时每3秒刷新
  useEffect(() => {
    // 只在Agent响应时启动轮询
    if (!respondingAgentId || !task?.id) {
      return;
    }

    console.log('Agent正在响应，启动工作空间轮询（每3秒）');

    const interval = setInterval(() => {
      silentRefreshFiles();
    }, 3000);

    return () => {
      console.log('Agent停止响应，停止工作空间轮询');
      clearInterval(interval);
    };
  }, [respondingAgentId, task?.id, silentRefreshFiles]);

  // 自动清除变化标记（5秒后）
  useEffect(() => {
    const timer = setInterval(() => {
      setWorkspaceFiles(prev => {
        const now = Date.now();
        let hasExpiredMarks = false;

        const cleaned = prev.map(f => {
          if ((f._hasChanged || f._isNew) && now - f._timestamp > 5000) {
            hasExpiredMarks = true;
            const { _hasChanged, _isNew, _timestamp, ...clean } = f;
            return clean;
          }
          return f;
        });

        // 只在有标记过期时才更新状态
        return hasExpiredMarks ? cleaned : prev;
      });
    }, 1000); // 每秒检查一次

    return () => clearInterval(timer);
  }, []);

  // 文件列表的列定义
  const columns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (text, record) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            cursor: record.isDirectory ? 'pointer' : 'default',
            minHeight: '40px',
            paddingTop: '4px'
          }}
          onClick={() => record.isDirectory && handleDirectoryClick(record)}
        >
          {/* 文件夹图标区域 */}
          <div style={{
            width: 16,
            height: 20,
            marginRight: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {record.icon || getFileIcon(record.file_name, record.isDirectory)}
          </div>

          {/* 文件信息区域 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 500,
              fontSize: '14px',
              lineHeight: '20px',
              color: record.isDirectory ? '#1677ff' : 'var(--custom-text)',
              marginBottom: '4px',
              wordBreak: 'break-word'
            }}>
              {record.file_name}
            </div>
            {record.display_name && record.display_name !== record.file_name && (
              <div style={{
                fontSize: '12px',
                color: 'var(--custom-text-secondary)',
                lineHeight: '16px',
                marginBottom: '4px'
              }}>
                {record.display_name}
              </div>
            )}
            <div>
              {!record.isDirectory && (
                <div style={{ marginBottom: '2px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {record.size}
                  </Text>
                </div>
              )}
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {record.updated_at ? new Date(record.updated_at).toLocaleString() : ''}
                </Text>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: '120px',
      render: (_, record) => (
        <Space>
          {!record.isDirectory && (
            <>
              <Button
                type="text"
               
                icon={<EyeOutlined />}
                onClick={() => handleViewFile(record)}
                title="查看"
                style={{ color: '#1677ff' }}
              />

              <Button
                type="text"
               
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteFile(record)}
                title="删除"
                danger
              />
            </>
          )}
        </Space>
      )
    }
  ];

  if (!task) {
    return <Empty description="请先选择一个任务" />;
  }

  return (
    <div className="action-task-workspace">
      <Card
        className="task-detail-tab-card"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Segmented
                value={viewMode}
                onChange={(value) => handleViewModeChange({ target: { value } })}
                options={[
                  { label: t('workspace.taskWorkspace'), value: 'task', icon: <FolderOutlined /> },
                  { label: t('workspace.rootDirectory'), value: 'root', icon: <FileOutlined /> }
                ]}
              />
            </div>
            <Space>
              {viewMode === 'task' && (
                <Upload
                  beforeUpload={handleFileUpload}
                  showUploadList={false}
                  multiple={false}
                >
                  <Button
                    type="text"
                   
                    icon={<UploadOutlined />}
                    title="上传文件到当前目录"
                    style={{ color: '#1677ff' }}
                  >
                  </Button>
                </Upload>
              )}
              <Button
                type="text"
               
                icon={<ReloadOutlined />}
                onClick={() => loadWorkspaceFiles(viewMode, viewMode === 'root' ? '' : currentPath)}
                loading={loading}
                title="刷新"
                style={{ color: '#1677ff' }}
              />
            </Space>
          </div>
        }
       
        style={{ marginBottom: 16 }}
      >
        {/* 面包屑导航 */}
        {breadcrumbs.length > 0 && (
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--custom-border)',
            backgroundColor: 'var(--custom-header-bg)'
          }}>
            <Breadcrumb
              items={breadcrumbs.map((crumb, index) => ({
                key: index,
                title: (
                  <span
                    onClick={() => handleBreadcrumbClick(crumb)}
                    style={{
                      cursor: index < breadcrumbs.length - 1 ? 'pointer' : 'default',
                      color: index < breadcrumbs.length - 1 ? '#1677ff' : 'inherit'
                    }}
                  >
                    {index === 0 && <HomeOutlined style={{ marginRight: 4 }} />}
                    {crumb.name}
                  </span>
                )
              }))}
            />
          </div>
        )}

        {loading ? (
          <div style={{ padding: '24px' }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={workspaceFiles}
            loading={false}
            pagination={false}
            size="middle"
            rowClassName={(record) => {
              const classes = ['workspace-table-row'];
              // 为有变化或新增的文件添加动画class
              if (record._hasChanged || record._isNew) {
                classes.push('variable-flash');
              }
              return classes.join(' ');
            }}
            locale={{
              emptyText: '该任务暂无工作空间文件'
            }}
          />
        )}


      </Card>

      {/* 文件查看器 */}
      <WorkspaceFileViewer
        visible={isViewerVisible}
        file={selectedFile}
        onClose={() => setIsViewerVisible(false)}
        onSave={() => {
          setIsViewerVisible(false);
          loadWorkspaceFiles(viewMode, currentPath); // 重新加载当前目录
        }}
      />
    </div>
  );
};

export default ActionTaskWorkspace;
