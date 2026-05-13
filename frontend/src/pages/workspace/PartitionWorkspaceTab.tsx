import { useState, useEffect } from 'react';
import { Card, Typography, message, Tabs, Table, Button, Space, Modal, Breadcrumb, Upload, Skeleton } from 'antd';
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
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState(null); // 选中的项目（任务或目录）
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('workspace');
  const [currentPath, setCurrentPath] = useState(''); // 当前浏览的路径
  const [breadcrumbs, setBreadcrumbs] = useState([]); // 面包屑导航
  const [agentInfo, setAgentInfo] = useState({}); // 智能体信息缓存

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
      console.log('获取到的智能体信息:', agents);
      const agentMap = {};
      agents.forEach(agent => {
        agentMap[agent.id] = {
          name: agent.name,
          role_name: agent.role_name
        };
      });
      console.log('处理后的智能体映射:', agentMap);
      setAgentInfo(agentMap);
    } catch (error) {
      console.error('获取智能体信息失败:', error);
    }
  };

  // 加载工作空间文件
  const loadWorkspaceFiles = async (item, path = '') => {
    if (!item) {
      setWorkspaceFiles([]);
      setBreadcrumbs([]);
      setCurrentPath('');
      setAgentInfo({}); // 清理智能体信息
      return;
    }

    setLoading(true);
    try {
      let data;
      let currentAgentInfo = agentInfo;

      if (item.type === 'action_task') {
        // ActionTask类型，使用原有的API
        const task = item.data;

        // 检查是否需要重新加载智能体信息
        const needReloadAgentInfo = Object.keys(agentInfo).length === 0 ||
                                    !(agentInfo as any)._taskId ||
                                    (agentInfo as any)._taskId !== task.id;

        if (needReloadAgentInfo) {
          await loadAgentInfo(task);
          // 重新获取任务的智能体信息，确保我们有最新的数据
          const agents = await actionTaskAPI.getAgents(task.id);
          const agentMap = { _taskId: task.id }; // 添加任务ID标记
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
        // 自定义目录类型，使用新的API
        data = await workspaceAPI.getWorkspaceDirectoryFiles(item.path, path);
        // 自定义目录不需要智能体信息
        currentAgentInfo = {};
      } else if (item.type === 'root') {
        // 根目录浏览：支持目录和文件，以及子目录导航
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

      console.log('正在加载工作空间文件，类型:', item.type, '路径:', path);
      console.log('API返回数据:', data);

      // 统一处理所有文件数据，使用当前的智能体信息
      const processedFiles = processFileData(data, currentAgentInfo);

      // 设置当前路径和面包屑导航
      setCurrentPath(path);

      // 构建面包屑导航
      const rootName = item.type === 'action_task' ? item.data.title :
                      item.type === 'root' ? '根目录' :
                      item.data.name;

      if (path) {
        // 子目录：添加面包屑导航
        const pathParts = path.split('/');
        const breadcrumbs = [{ name: rootName, path: '' }];

        // 构建面包屑路径
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
        // 根目录
        setBreadcrumbs([{ name: rootName, path: '' }]);
      }

      console.log('处理后的文件列表:', processedFiles);
      setWorkspaceFiles(processedFiles);

      // 后端已经提供了文件大小，不需要前端异步加载

    } catch (error) {
      console.error('加载工作空间文件失败:', error);
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
    loadWorkspaceFiles(item, ''); // 加载根目录
  };

  // 处理目录点击
  const handleDirectoryClick = (directory) => {
    if (directory.isDirectory) {
      // 构建新的路径：当前路径 + 目录名
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
          loadWorkspaceFiles(selectedItem, currentPath); // 重新加载当前目录
        } catch (error) {
          console.error('删除文件失败:', error);
          message.error('删除文件失败');
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

    // 检查文件大小（10MB限制）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      message.error('文件大小不能超过10MB');
      return false;
    }

    try {
      const result = await workspaceAPI.uploadWorkspaceFile(selectedItem.data.id, currentPath, file);
      if (result.success) {
        message.success('文件上传成功');
        loadWorkspaceFiles(selectedItem, currentPath); // 重新加载当前目录
      } else {
        message.error(result.error || '文件上传失败');
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      message.error('文件上传失败');
    }

    return false; // 阻止默认上传行为
  };

  // 文件列表的列定义
  const columns = [
    {
      title: '文件名',
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
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: '20%',
      render: (text, record) => record.isDirectory ? '' : text
    },
    {
      title: '修改时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: '20%',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
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
              title="查看"
            />

            <Button
              type="text"
              icon={<DeleteOutlined />}
             
              danger
              onClick={() => handleDeleteFile(record)}
              title="删除"
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
                                  title="上传文件到当前目录"
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
                              title="刷新"
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
          message.success('文件保存成功');
          loadWorkspaceFiles(selectedItem, currentPath); // 重新加载当前目录
        }}
      />
    </div>
  );
};

export default PartitionWorkspaceTab;
