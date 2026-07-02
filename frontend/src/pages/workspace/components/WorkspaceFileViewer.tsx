import React, { useState, useCallback, useEffect } from 'react';
import { App, Modal, Typography, Skeleton, Button, Dropdown } from 'antd';
import { DownloadOutlined, ExportOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from '../../actiontask/components/ConversationExtraction';
import { workspaceAPI } from '../../../services/api/workspace';
import OnlyOfficeEditor from '../../../components/OnlyOfficeEditor';
import { marketService } from '../../../services/marketService';

const { Title } = Typography;

/**
 * 工作空间文件查看器
 * 用于查看和编辑工作空间文件内容
 */
const WorkspaceFileViewer = ({ visible, file, onClose, onSave }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [onlyOfficeVisible, setOnlyOfficeVisible] = useState(false);
  const [onlyOfficeEnabled, setOnlyOfficeEnabled] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // 检查OnlyOffice应用状态
  useEffect(() => {
    const checkOnlyOfficeStatus = async () => {
      try {
        const appDetail = await marketService.getAppDetail('online-office');
        setOnlyOfficeEnabled(appDetail.enabled);
      } catch (error) {
        console.error('Failed to check OnlyOffice app status:', error);
        setOnlyOfficeEnabled(false);
      }
    };

    checkOnlyOfficeStatus();
  }, []);

  // 加载文件内容
  const loadFileContent = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setContent(''); // 清空之前的内容
    try {
      const data = await workspaceAPI.getWorkspaceFileContent(file.file_path);
      setContent(data.content || '');
    } catch (error) {
      console.error('Failed to load file content:', error);
      // 检查是否是二进制文件或不支持的文件类型
      if (error.response && error.response.data && error.response.data.error) {
        const errorMsg = error.response.data.error;
        if (errorMsg.includes('不支持文本预览') || errorMsg.includes('二进制文件')) {
          setContent(t('workspace.viewer.notSupportedContent'));
        } else {
          setContent(t('workspace.viewer.loadFailedWithReason', { reason: errorMsg }));
        }
      } else {
        setContent(t('workspace.viewer.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [file, t]);

  // 加载图片文件
  const loadImageFile = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    try {
      const blob = await workspaceAPI.downloadWorkspaceFile(file.file_path);
      const url = window.URL.createObjectURL(blob);
      setImageUrl(url);
    } catch (error) {
      console.error('Failed to load image:', error);
      setImageUrl(null);
    } finally {
      setLoading(false);
    }
  }, [file]);

  // 清理图片URL
  useEffect(() => {
    return () => {
      if (imageUrl) {
        window.URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // 当文件变化时加载内容或直接打开OnlyOffice
  React.useEffect(() => {
    if (visible && file) {
      setEditMode(false);
      setImageUrl(null);
      setContent(''); // 清空之前的内容，避免显示旧文件内容
      
      // 如果OnlyOffice启用且文件类型支持，直接打开OnlyOffice编辑器
      if (onlyOfficeEnabled && isOnlyOfficeSupported(file.file_name)) {
        setOnlyOfficeVisible(true);
      } else if (isImageFile(file.file_name)) {
        loadImageFile();
      } else {
        loadFileContent();
      }
    }
  }, [visible, file, loadFileContent, loadImageFile, onlyOfficeEnabled]);

  const handleSave = async () => {
    if (!file) return;

    try {
      await workspaceAPI.updateWorkspaceFileContent(file.file_path, content);
      setEditMode(false);
      if (onSave) onSave();
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  // 下载文件
  const handleDownload = async () => {
    if (!file) return;

    try {
      const blob = await workspaceAPI.downloadWorkspaceFile(file.file_path);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success(t('workspace.viewer.downloadSuccess'));
    } catch (error) {
      console.error('Failed to download file:', error);
      message.error(t('workspace.viewer.downloadFailed'));
    }
  };

  // 检查文件是否为图片类型
  const isImageFile = (filename: string) => {
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return imageTypes.includes(ext);
  };

  // 检查文件是否支持OnlyOffice在线编辑
  const isOnlyOfficeSupported = (filename) => {
    const supportedTypes = ['docx', 'doc', 'odt', 'rtf', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp'];
    const ext = filename.split('.').pop().toLowerCase();
    return supportedTypes.includes(ext);
  };

  // 打开OnlyOffice编辑器
  const handleOnlyOfficeEdit = () => {
    if (!file) return;

    if (!isOnlyOfficeSupported(file.file_name)) {
      message.error(t('workspace.viewer.onlineEditNotSupported'));
      return;
    }

    setOnlyOfficeVisible(true);
  };

  // 在新标签打开
  const handleOpenInNewTab = async () => {
    if (!file) return;

    try {
      const blob = await workspaceAPI.downloadWorkspaceFile(file.file_path);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      message.success(t('workspace.viewer.openedInNewTab'));
    } catch (error) {
      console.error('Failed to open file:', error);
      message.error(t('workspace.viewer.openFailed'));
    }
  };

  return (
    <>
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {file?.file_name || t('workspace.viewer.title')}
          </Title>
          <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
            {file?.typeName} • {file?.file_path}
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {editMode ? (
            <>
              <Button key="cancel" onClick={() => setEditMode(false)} style={{ marginRight: 8 }}>
                {t('workspace.viewer.cancel')}
              </Button>
              <Button key="save" type="primary" onClick={handleSave}>
                {t('workspace.viewer.save')}
              </Button>
            </>
          ) : (
            <>
              {!isImageFile(file?.file_name || '') && (
                <Button key="edit" type="primary" onClick={() => setEditMode(true)} style={{ marginRight: 8 }}>
                  {t('workspace.viewer.edit')}
                </Button>
              )}
              <Dropdown
                menu={{
                  items: [
                    ...(onlyOfficeEnabled && isOnlyOfficeSupported(file?.file_name || '') ? [{
                      key: 'onlyoffice',
                      label: t('workspace.viewer.onlineEdit'),
                      icon: <EditOutlined />,
                      onClick: handleOnlyOfficeEdit
                    }] : []),
                    {
                      key: 'download',
                      label: t('workspace.viewer.download'),
                      icon: <DownloadOutlined />,
                      onClick: handleDownload
                    },
                    {
                      key: 'openInNewTab',
                      label: t('workspace.viewer.openInNewTab'),
                      icon: <ExportOutlined />,
                      onClick: handleOpenInNewTab
                    }
                  ]
                }}
                trigger={['click']}
              >
                <Button style={{ marginRight: 8 }}>
                  {t('workspace.viewer.actions')}
                </Button>
              </Dropdown>
              <Button key="close" onClick={onClose}>
                {t('workspace.viewer.close')}
              </Button>
            </>
          )}
        </div>
      }
      styles={{
        body: { 
          maxHeight: '60vh', 
          overflow: 'auto',
          padding: '16px'
        }
      }}
    >
      {loading ? (
        <div style={{ padding: '40px' }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : isImageFile(file?.file_name || '') ? (
        <div style={{ textAlign: 'center' }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={file?.file_name}
              style={{
                maxWidth: '100%',
                maxHeight: '60vh',
                objectFit: 'contain'
              }}
            />
          ) : (
            <div style={{ color: 'var(--custom-text-secondary)', padding: '40px' }}>{t('workspace.viewer.imageLoadFailed')}</div>
          )}
        </div>
      ) : editMode ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            width: '100%',
            height: '400px',
            border: '1px solid var(--custom-border)',
            borderRadius: '4px',
            padding: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '14px',
            resize: 'vertical'
          }}
          placeholder={t('workspace.viewer.contentPlaceholder')}
        />
      ) : (
        <div
          style={{
            border: '1px solid var(--custom-border)',
            borderRadius: '4px',
            padding: '16px',
            backgroundColor: 'var(--custom-header-bg)',
            minHeight: '200px'
          }}
        >
          {(() => {
            // 检查文件扩展名，只有.md文件才使用MarkdownRenderer
            const fileName = file?.file_name || '';
            const isMarkdownFile = fileName.toLowerCase().endsWith('.md') || fileName.toLowerCase().endsWith('.markdown');

            if (isMarkdownFile) {
              return <MarkdownRenderer content={content || t('workspace.viewer.emptyContent')} />;
            } else {
              // 非markdown文件显示为纯文本
              return (
                <pre style={{
                  fontFamily: 'Monaco, Consolas, monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {content || t('workspace.viewer.emptyContent')}
                </pre>
              );
            }
          })()}
        </div>
      )}
    </Modal>

    {/* OnlyOffice编辑器 */}
    <OnlyOfficeEditor
      visible={onlyOfficeVisible}
      file={file}
      onClose={() => setOnlyOfficeVisible(false)}
      onSave={() => {
        setOnlyOfficeVisible(false);
        message.success(t('workspace.viewer.saveSuccess'));
        if (onSave) onSave();
      }}
    />
  </>
  );
};

export default WorkspaceFileViewer;
