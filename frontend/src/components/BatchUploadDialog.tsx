import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Upload,
  Button,
  Select,
  List,
  Progress,
  Space,
  Typography,
  Tag,
  message,
  Divider,
  Empty,
  Tooltip,
  Card,
  Row,
  Col,
  Alert
} from 'antd';
import {
  InboxOutlined,
  UploadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileMarkdownOutlined,
  FileUnknownOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  FolderOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import knowledgeAPI from '../services/api/knowledge';
import {
  validateFileType,
  formatFileSize,
  generateUniqueId,
  getSupportedFileTypesDescription,
  getFileAcceptString,
  getFileIcon
} from '../utils/fileUtils';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

// 文件状态枚举
const FILE_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed'
};





const BatchUploadDialog = ({
  visible,
  onClose,
  knowledgeBases = [],
  onUploadComplete,
  defaultKnowledgeBaseId = null
}) => {
  const { t } = useTranslation();
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState(defaultKnowledgeBaseId);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0
  });

  // 重置状态
  const resetState = useCallback(() => {
    setUploadQueue([]);
    setIsUploading(false);
    setUploadStats({
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: 0
    });
  }, []);

  // 当对话框关闭时重置状态
  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

  // 当默认知识库ID改变时更新选中的知识库
  useEffect(() => {
    if (defaultKnowledgeBaseId) {
      setSelectedKnowledgeBaseId(defaultKnowledgeBaseId);
    }
  }, [defaultKnowledgeBaseId]);



  // 处理文件添加到队列
  const handleFilesAdd = (files) => {
    const validFiles = [];
    const invalidFiles = [];
    const duplicateFiles = [];

    files.forEach(file => {
      // 检查是否已经在队列中（基于文件名和大小）
      const isDuplicate = uploadQueue.some(item =>
        item.name === file.name && item.size === file.size
      );

      if (isDuplicate) {
        duplicateFiles.push(file.name);
        return;
      }

      if (validateFileType(file)) {
        const queueItem = {
          id: generateUniqueId(),
          file: file,
          name: file.name,
          size: file.size,
          type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
          status: FILE_STATUS.PENDING,
          progress: 0,
          error: null
        };
        validFiles.push(queueItem);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (duplicateFiles.length > 0) {
      message.info(t('batchUpload.msg.duplicateFiles', { files: duplicateFiles.join(', ') }));
    }

    if (invalidFiles.length > 0) {
      message.warning(t('batchUpload.msg.invalidFiles', { files: invalidFiles.join(', ') }));
    }

    if (validFiles.length > 0) {
      setUploadQueue(prev => [...prev, ...validFiles]);
      setUploadStats(prev => ({
        ...prev,
        total: prev.total + validFiles.length
      }));
    }

    return false; // 阻止默认上传行为
  };

  // 从队列中移除文件
  const removeFromQueue = (id) => {
    setUploadQueue(prev => {
      const newQueue = prev.filter(item => item.id !== id);
      const removedItem = prev.find(item => item.id === id);

      if (removedItem && removedItem.status === FILE_STATUS.PENDING) {
        setUploadStats(prevStats => ({
          ...prevStats,
          total: prevStats.total - 1
        }));
      }

      return newQueue;
    });
  };

  // 重试上传
  const retryUpload = (id) => {
    setUploadQueue(prev => prev.map(item =>
      item.id === id
        ? { ...item, status: FILE_STATUS.PENDING, progress: 0, error: null }
        : item
    ));

    setUploadStats(prev => ({
      ...prev,
      failed: prev.failed - 1,
      total: prev.total // 保持总数不变
    }));
  };

  // 单个文件上传
  const uploadSingleFile = async (queueItem) => {
    if (!selectedKnowledgeBaseId) {
      throw new Error('请先选择知识库');
    }

    // 更新状态为上传中
    setUploadQueue(prev => prev.map(item =>
      item.id === queueItem.id
        ? { ...item, status: FILE_STATUS.UPLOADING, progress: 0 }
        : item
    ));

    setUploadStats(prev => ({
      ...prev,
      inProgress: prev.inProgress + 1
    }));

    try {
      const formData = new FormData();
      formData.append('file', queueItem.file);

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setUploadQueue(prev => prev.map(item =>
          item.id === queueItem.id && item.status === FILE_STATUS.UPLOADING
            ? { ...item, progress: Math.min(item.progress + 10, 90) }
            : item
        ));
      }, 200);

      const response = await knowledgeAPI.uploadFile(selectedKnowledgeBaseId, formData);

      clearInterval(progressInterval);

      if (response.success) {
        // 上传成功
        setUploadQueue(prev => prev.map(item =>
          item.id === queueItem.id
            ? { ...item, status: FILE_STATUS.COMPLETED, progress: 100 }
            : item
        ));

        setUploadStats(prev => ({
          ...prev,
          completed: prev.completed + 1,
          inProgress: prev.inProgress - 1
        }));

        return { success: true, file: queueItem.name };
      } else {
        throw new Error(response.message || t('batchUpload.msg.uploadFailed'));
      }
    } catch (error) {
      // 上传失败
      setUploadQueue(prev => prev.map(item =>
        item.id === queueItem.id
          ? {
              ...item,
              status: FILE_STATUS.FAILED,
              progress: 0,
              error: error.message
            }
          : item
      ));

      setUploadStats(prev => ({
        ...prev,
        failed: prev.failed + 1,
        inProgress: prev.inProgress - 1
      }));

      return { success: false, file: queueItem.name, error: error.message };
    }
  };

  // 批量上传
  const handleBatchUpload = async () => {
    if (!selectedKnowledgeBaseId) {
      message.error(t('batchUpload.msg.selectKbFirst'));
      return;
    }

    const pendingFiles = uploadQueue.filter(item => item.status === FILE_STATUS.PENDING);

    if (pendingFiles.length === 0) {
      message.warning(t('batchUpload.msg.noPendingFiles'));
      return;
    }

    setIsUploading(true);

    try {
      // 并发上传，限制并发数为3
      const concurrencyLimit = 3;
      const results = [];

      for (let i = 0; i < pendingFiles.length; i += concurrencyLimit) {
        const batch = pendingFiles.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(file => uploadSingleFile(file));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      // 通知父组件上传完成
      if (onUploadComplete) {
        onUploadComplete(results);
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount > 0 && failCount === 0) {
        message.success(t('batchUpload.msg.uploadSuccess', { count: successCount }));
      } else if (successCount > 0 && failCount > 0) {
        message.warning(t('batchUpload.msg.uploadPartial', { success: successCount, fail: failCount }));
      } else {
        message.error(t('batchUpload.msg.uploadAllFailed'));
      }

    } catch (error) {
      console.error('批量上传失败:', error);
      message.error(t('batchUpload.msg.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  // 清空队列
  const clearQueue = () => {
    if (isUploading) {
      message.warning(t('batchUpload.msg.clearingUploading'));
      return;
    }
    resetState();
  };

  // 拖拽上传配置 - 文件上传
  const acceptString = getFileAcceptString();
  const draggerProps = {
    name: 'files',
    multiple: true,
    beforeUpload: (file, fileList) => {
      handleFilesAdd(fileList);
      return false; // 阻止默认上传
    },
    showUploadList: false,
    // 只有当acceptString有值时才设置accept属性
    ...(acceptString && { accept: acceptString }),
  };

  // 文件夹上传配置
  const folderUploadProps = {
    name: 'files',
    multiple: true,
    directory: true, // 支持文件夹上传
    beforeUpload: (file, fileList) => {
      handleFilesAdd(fileList);
      return false; // 阻止默认上传
    },
    showUploadList: false,
  };

  // 渲染队列项状态图标
  const renderStatusIcon = (status) => {
    switch (status) {
      case FILE_STATUS.PENDING:
        return <Tag color="default">{t('batchUpload.status.pending')}</Tag>;
      case FILE_STATUS.UPLOADING:
        return <Tag color="processing" icon={<LoadingOutlined />}>{t('batchUpload.status.uploading')}</Tag>;
      case FILE_STATUS.COMPLETED:
        return <Tag color="success" icon={<CheckCircleOutlined />}>{t('batchUpload.status.completed')}</Tag>;
      case FILE_STATUS.FAILED:
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>{t('batchUpload.status.failed')}</Tag>;
      default:
        return <Tag>{t('batchUpload.status.unknown')}</Tag>;
    }
  };

  // 渲染队列项
  const renderQueueItem = (item) => {
    return (
      <List.Item
        key={item.id}
        actions={[
          item.status === FILE_STATUS.FAILED && (
            <Tooltip title={t('batchUpload.tooltip.retry')}>
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => retryUpload(item.id)}
                disabled={isUploading}
              />
            </Tooltip>
          ),
          item.status === FILE_STATUS.PENDING && (
            <Tooltip title={t('batchUpload.tooltip.remove')}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeFromQueue(item.id)}
                disabled={isUploading}
              />
            </Tooltip>
          )
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={getFileIcon(item.name)}
          title={
            <Space>
              <Text>{item.name}</Text>
              {renderStatusIcon(item.status)}
            </Space>
          }
          description={
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Text type="secondary">{formatFileSize(item.size)}</Text>
              {item.status === FILE_STATUS.UPLOADING && (
                <Progress
                  percent={item.progress}
                 
                  status="active"
                />
              )}
              {item.status === FILE_STATUS.FAILED && item.error && (
                <Text type="danger" style={{ fontSize: '12px' }}>
                  {item.error}
                </Text>
              )}
            </Space>
          }
        />
      </List.Item>
    );
  };

  return (
    <Modal
      title={t('batchUpload.title')}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="clear" onClick={clearQueue} disabled={isUploading}>
          {t('batchUpload.clearQueue')}
        </Button>,
        <Button key="cancel" onClick={onClose} disabled={isUploading}>
          {t('cancel')}
        </Button>,
        <Button
          key="upload"
          type="primary"
          onClick={handleBatchUpload}
          loading={isUploading}
          disabled={uploadQueue.filter(item => item.status === FILE_STATUS.PENDING).length === 0}
        >
          {t('batchUpload.startUpload')}
        </Button>
      ]}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        {/* 知识库选择 - 如果有知识库列表则显示选择器，否则隐藏 */}
        {knowledgeBases.length > 0 && (
          <div>
            <Title level={5}>{t('batchUpload.selectKnowledgeBase')}</Title>
            <Select
              style={{ width: '100%' }}
              placeholder={t('batchUpload.knowledgeBasePlaceholder')}
              value={selectedKnowledgeBaseId}
              onChange={setSelectedKnowledgeBaseId}
              disabled={isUploading}
            >
              {knowledgeBases.map(kb => (
                <Option key={kb.id} value={kb.id}>
                  {kb.name}
                </Option>
              ))}
            </Select>
          </div>
        )}

        {/* 文件上传区域 */}
        <div>
          <Title level={5}>{t('batchUpload.selectFiles')}</Title>

          {/* 主要的拖拽上传区域 - 支持文件 */}
          <Dragger {...draggerProps} disabled={isUploading}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t('batchUpload.dragHint')}</p>
            <p className="ant-upload-hint">
              {t('batchUpload.dragHintDesc')}{getSupportedFileTypesDescription()}
            </p>
          </Dragger>

          {/* 文件夹上传按钮 */}
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <Upload {...folderUploadProps} disabled={isUploading}>
              <Button
                icon={<FolderOutlined />}
                disabled={isUploading}
                type="dashed"
              >
                {t('batchUpload.selectFolder')}
              </Button>
            </Upload>
          </div>
        </div>

        {/* 上传统计 */}
        {uploadStats.total > 0 && (
          <Card>
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1677ff' }}>
                    {uploadStats.total}
                  </div>
                  <div style={{ color: 'var(--custom-text-secondary)' }}>{t('batchUpload.totalCount')}</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                    {uploadStats.completed}
                  </div>
                  <div style={{ color: 'var(--custom-text-secondary)' }}>{t('batchUpload.completedCount')}</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                    {uploadStats.inProgress}
                  </div>
                  <div style={{ color: 'var(--custom-text-secondary)' }}>{t('batchUpload.inProgressCount')}</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                    {uploadStats.failed}
                  </div>
                  <div style={{ color: 'var(--custom-text-secondary)' }}>{t('batchUpload.failedCount')}</div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {/* 上传队列 - 只有当有文件时才显示 */}
        {uploadQueue.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Title level={5} style={{ margin: 0 }}>{t('batchUpload.queueTitle')}</Title>
              <Text type="secondary">{t('batchUpload.queueTotal', { count: uploadQueue.length })}</Text>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <List
                dataSource={uploadQueue}
                renderItem={renderQueueItem}
               
              />
            </div>
          </div>
        )}

        {/* 提示信息 */}
        {!selectedKnowledgeBaseId && (
          <Alert
            message={t('batchUpload.alert.selectKnowledgeBase')}
            type="warning"
            showIcon
          />
        )}
      </Space>
    </Modal>
  );
};

export default BatchUploadDialog;