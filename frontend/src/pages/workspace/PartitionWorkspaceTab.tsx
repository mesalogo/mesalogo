import { useState, useEffect } from 'react';
import { App, Card, Typography, Tabs, Table, Button, Space, Modal, Breadcrumb, Upload, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { BookOutlined, FolderOutlined, EyeOutlined, DeleteOutlined, HomeOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons';
import WorkspaceNavigator from './components/WorkspaceNavigator';
import WorkspaceFileViewer from './components/WorkspaceFileViewer';
import WorkspaceTemplateTab from './WorkspaceTemplateTab';
import { workspaceAPI } from '../../services/api/workspace';
import { actionTaskAPI } from '../../services/api/actionTask';
import { getFileIcon, processFileData } from '../../utils/workspaceUtils';

const { Text, Title } = Typography;

/**
 * 工作空间浏览器标签页组件
 * 简化的文件浏览器界面
 */
const PartitionWorkspaceTab = () => {
  const { message, modal } = App.useApp();
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null); // Selected item (task or directory)
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('workspace');
  const [currentPath, setCurrentPath] = useState(''); // Current browsing path
  const [breadcrumbs, setBreadcrumbs] = useState([]); // Breadcrumb navigation
  const [agentInfo, setAgentInfo] = useState({}); // Agent info cache

  // 监听选中项变化，清理状态
  useEffect(() => {
    if (selectedItem) {
      // 当选中项切换时，清理相关状态
      setCurrentPath('');
      setBreadcrumbs([]);
      setSelectedFile(null);
      setIsViewerVisible(false);
      // 不清理 agentInfo，让 loadWorkspaceFiles 来处理
    }
  }, [selectedItem]);

  // 获取智能体信息
  const loadAgentInfo = async (task) => {
    try {
      // 获取任务的智能体信息
      const agents = await actionTaskAPI.getAgents(task.id);
      console.log('Fetched agent info:', agents);
      const agentMap = {};
      agents.forEach(agent => {
        agentMap[agent.id] = {
          name: agent.name,
          role_name: agent.role_name
        };
      });
      console.log('Processed agent map:', agentMap);
      setAgentInfo(agentMap);
    } catch (error) {
      console.error('Failed to fetch agent info:', error);
    }
  };

  // 加载工作空间文件
  const loadWorkspaceFiles = async (item, path = '') => {
    if (!item) {
      setWorkspaceFiles([]);
      setBreadcrumbs([]);
      setCurrentPath('');
      setAgentInfo({}); // Clear agent info
      return;
    }

    setLoading(true);
    try {
      let data;
      let currentAgentInfo = agentInfo;

      if (item.type === 'action_task') {
        // ActionTask type, use the existing API
        const task = item.data;

        // 检查是否需要重新加载智能体信息
        const needReloadAgentInfo = Object.keys(agentInfo).length === 0 ||
                                    !(agentInfo as any)._taskId ||
                                    (agentInfo as any)._taskId !== task.id;

        if (needReloadAgentInfo) {
          await loadAgentInfo(task);
          // Re-fetch task agent info to ensure we have the latest data
          const agents = await actionTaskAPI.getAgents(task.id);
          const agentMap = { _taskId: task.id }; // Tag with the task ID
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
      } else if (item.type === 'custom_directory') {
        // Custom directory type, use the new API
        data = await workspaceAPI.getWorkspaceDirectoryFiles(item.path, path);
        // Custom directories don't need agent info
        currentAgentInfo = {};
      } else if (item.type === 'root') {
        // Root directory browsing: supports directories, files, and subdirectory navigation
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
        currentAgentInfo = {};
      } else {
        throw new Error(t('workspace.unknownType'));
      }

      console.log('Loading workspace files, type:', item.type, 'path:', path);
      console.log('API response data:', data);

      // Uniformly process all file data using the current agent info
      const processedFiles = processFileData(data, currentAgentInfo);

      // Set the current path and breadcrumb navigation
      setCurrentPath(path);

      // Build breadcrumb navigation
      const rootName = item.type === 'action_task' ? item.data.title :
                      item.type === 'root' ? t('workspace.rootDirectoryName') :
                      item.data.name;

      if (path) {
        // Subdirectory: append breadcrumb navigation
        const pathParts = path.split('/');
        const breadcrumbs = [{ name: rootName, path: '' }];

        // Build the breadcrumb path
        let currentPath = '';
        pathParts.forEach((part) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          breadcrumbs.push({
            name: part,
            path: currentPath
          });
        });

        setBreadcrumbs(breadcrumbs);
      } else {
        // Root directory
        setBreadcrumbs([{ name: rootName, path: '' }]);
      }

      console.log('Processed file list:', processedFiles);
      setWorkspaceFiles(processedFiles);

      // The backend already provides file sizes; no async loading needed on the frontend

    } catch (error) {
      console.error('Failed to load workspace files:', error);
      message.error(t('workspace.loadFailed'));
      setWorkspaceFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理工作空间项目选择
  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setSelectedFile(null);
    loadWorkspaceFiles(item, ''); // Load the root directory
  };

  // 处理目录点击
  const handleDirectoryClick = (directory) => {
    if (directory.isDirectory) {
      // Build the new path: current path + directory name
      const newPath = currentPath ? `${currentPath}/${directory.file_name}` : directory.file_name;
      loadWorkspaceFiles(selectedItem, newPath);
    }
  };

  // 处理面包屑导航
  const handleBreadcrumbClick = (breadcrumb) => {
    loadWorkspaceFiles(selectedItem, breadcrumb.path);
  };

  // 查看文件
  const handleViewFile = (file) => {
    setSelectedFile(file);
    setIsViewerVisible(true);
  };

  // 删除文件
  const handleDeleteFile = (file) => {
    modal.confirm({
      title: t('workspace.deleteConfirmTitle'),
      content: t('workspace.deleteConfirmContent', { name: file.file_name }),
      okText: t('workspace.deleteConfirmOk'),
      okType: 'danger',
      cancelText: t('workspace.deleteConfirmCancel'),
      onOk: async () => {
        try {
          await workspaceAPI.deleteWorkspaceFile(file.file_path);
          message.success(t('workspace.deleteFileSuccess'));
          loadWorkspaceFiles(selectedItem, currentPath); // Reload the current directory
        } catch (error) {
          console.error('Failed to delete file:', error);
          message.error(t('workspace.deleteFileFailed'));
        }
      }
    });
  };

  // 处理文件上传
  const handleFileUpload = async (file) => {
    if (!selectedItem) {
      message.error(t('workspace.selectFirst'));
      return false;
    }

    // 只有ActionTask类型支持文件上传
    if (selectedItem.type !== 'action_task') {
      message.error(t('workspace.uploadNotSupported'));
      return false;
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      message.error(t('workspace.uploadFileSizeLimit'));
      return false;
    }

    try {
      const result = await workspaceAPI.uploadWorkspaceFile(selectedItem.data.id, currentPath, file);
      if (result.success) {
        message.success(t('workspace.uploadFileSuccess'));
        loadWorkspaceFiles(selectedItem, currentPath); // Reload the current directory
      } else {
        message.error(result.error || t('workspace.uploadFileFailed'));
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      message.error(t('workspace.uploadFileFailed'));
    }

    return false; // Prevent the default upload behavior
  };

  // 文件列表的列定义
  const columns = [
    {
      title: t('workspace.col.fileName'),
      dataIndex: 'file_name',
      key: 'file_name',
      width: '50%',
      render: (text, record) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: record.isDirectory ? 'pointer' : 'default',
            minHeight: '40px',
            padding: '4px 0'
          }}
          onClick={() => record.isDirectory && handleDirectoryClick(record)}
        >
          {/* 文件/文件夹图标 */}
          <div style={{
            width: 16,
            height: 16,
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
              marginBottom: record.display_name && record.display_name !== record.file_name ? '2px' : 0,
              wordBreak: 'break-word'
            }}>
              {text}
            </div>
            {record.display_name && record.display_name !== record.file_name && (
              <div style={{
                fontSize: '12px',
                color: 'var(--custom-text-secondary)',
                lineHeight: '16px'
              }}>
                {record.display_name}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: t('workspace.col.size'),
      dataIndex: 'size',
      key: 'size',
      width: '20%',
      render: (text, record) => record.isDirectory ? '' : text
    },
    {
      title: t('workspace.col.modifiedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: '20%',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: t('workspace.col.actions'),
      key: 'actions',
      width: '10%',
      render: (_, record) => (
        record.isDirectory ? null : (
          <Space>
            <Button
              type="text"
              icon={<EyeOutlined />}
              style={{ color: '#1677ff' }}
              onClick={() => handleViewFile(record)}
              title={t('workspace.action.view')}
            />

            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              onClick={() => handleDeleteFile(record)}
              title={t('workspace.action.delete')}
            />
          </Space>
        )
      )
    }
  ];

  return (
    <div className="partition-memory-tab">
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20
        }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('workspace.title')}</Title>
            <Text type="secondary">
              {t('workspace.subtitle')}
            </Text>
          </div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'workspace',
            label: (
              <span>
                <FolderOutlined style={{ color: '#1677ff' }} />
                {t('workspace.browser')}
              </span>
            ),
            children: (
              <div style={{ display: 'flex', height: 'calc(100vh - 250px)', gap: '16px' }}>
                {/* 左侧：工作空间导航 */}
                <div style={{ width: 280, flexShrink: 0 }}>
                  <WorkspaceNavigator
                    onItemSelect={handleItemSelect}
                    selectedItem={selectedItem}
                  />
                </div>

                {/* 右侧：文件列表 */}
                <div style={{ flex: 1 }}>
                  <Card
                    title={
                      selectedItem ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <FolderOutlined style={{ marginRight: 8 }} />
                            {selectedItem.type === 'action_task' ? selectedItem.data.title : selectedItem.data.name} - {t('workspace.files')}
                          </div>
                          <Space>
                            {selectedItem.type === 'action_task' && (
                              <Upload
                                beforeUpload={handleFileUpload}
                                showUploadList={false}
                                multiple={false}
                              >
                                <Button
                                  type="text"
                                  icon={<UploadOutlined />}
                                  title={t('workspace.action.uploadToCurrentDir')}
                                  style={{ color: '#1677ff' }}
                                >
                                </Button>
                              </Upload>
                            )}
                            <Button
                              type="text"
                              icon={<ReloadOutlined />}
                              onClick={() => loadWorkspaceFiles(selectedItem, currentPath)}
                              loading={loading}
                              title={t('workspace.action.refresh')}
                              style={{ color: '#1677ff' }}
                            />
                          </Space>
                        </div>
                      ) : (
                        <div>
                          <FolderOutlined style={{ marginRight: 8 }} />
                          {t('workspace.fileList')}
                        </div>
                      )
                    }
                    style={{ height: '100%' }}
                    styles={{ body: { padding: 0, overflowY: 'auto', height: 'calc(100% - 57px)' } }}
                  >
                    {/* 面包屑导航 */}
                    {selectedItem && breadcrumbs.length > 0 && (
                      <div style={{
                        padding: '12px 16px',
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
                        rowClassName={() => 'workspace-table-row'}
                        locale={{
                          emptyText: selectedItem ? t('workspace.noFiles') : t('workspace.selectFirst')
                        }}
                      />
                    )}
                  </Card>
                </div>
              </div>
            )
          },
          {
            key: 'template',
            label: (
              <span>
                <BookOutlined style={{ color: '#52c41a' }} />
                {t('workspace.template')}
              </span>
            ),
            children: <WorkspaceTemplateTab />
          }
        ]}
      />

      {/* 文件查看器 */}
      <WorkspaceFileViewer
        visible={isViewerVisible}
        file={selectedFile}
        onClose={() => {
          setIsViewerVisible(false);
          setSelectedFile(null);
        }}
        onSave={() => {
          message.success(t('workspace.saveFileSuccess'));
          loadWorkspaceFiles(selectedItem, currentPath); // Reload the current directory
        }}
      />
    </div>
  );
};

export default PartitionWorkspaceTab;
