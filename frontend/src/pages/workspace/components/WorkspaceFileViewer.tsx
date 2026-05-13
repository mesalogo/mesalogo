import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Typography, Skeleton, Button, Dropdown, message } from 'antd';
import { DownloadOutlined, ExportOutlined, EditOutlined } from '@ant-design/icons';
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
        console.error('检查OnlyOffice应用状态失败:', error);
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
      console.error('加载文件内容失败:', error);
      // 检查是否是二进制文件或不支持的文件类型
      if (error.response && error.response.data && error.response.data.error) {
        const errorMsg = error.response.data.error;
        if (errorMsg.includes('不支持文本预览') || errorMsg.includes('二进制文件')) {
          setContent('此文件类型不支持预览，请使用下载功能获取文件，或使用在线编辑器编辑（如已配置）。');
        } else {
          setContent(`加载文件内容失败: ${errorMsg}`);
        }
      } else {
        setContent('加载文件内容失败');
      }
    } finally {
      setLoading(false);
    }
  }, [file]);

  // 加载图片文件
  const loadImageFile = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    try {
      const blob = await workspaceAPI.downloadWorkspaceFile(file.file_path);
      const url = window.URL.createObjectURL(blob);
      setImageUrl(url);
    } catch (error) {
      console.error('加载图片失败:', error);
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
      console.error('保存文件失败:', error);
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
      message.success('文件下载成功');
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error('下载文件失败');
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
      message.error('该文件类型不支持在线编辑');
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
      message.success('已在新标签页打开文件');
    } catch (error) {
      console.error('打开文件失败:', error);
      message.error('打开文件失败');
    }
  };

  return (
    <>
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {file?.file_name || '文件查看器'}
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
                取消
              </Button>
              <Button key="save" type="primary" onClick={handleSave}>
                保存
              </Button>
            </>
          ) : (
            <>
              {!isImageFile(file?.file_name || '') && (
                <Button key="edit" type="primary" onClick={() => setEditMode(true)} style={{ marginRight: 8 }}>
                  编辑
                </Button>
              )}
              <Dropdown
                menu={{
                  items: [
                    ...(onlyOfficeEnabled && isOnlyOfficeSupported(file?.file_name || '') ? [{
                      key: 'onlyoffice',
                      label: '在线编辑',
                      icon: <EditOutlined />,
                      onClick: handleOnlyOfficeEdit
                    }] : []),
                    {
                      key: 'download',
                      label: '下载文件',
                      icon: <DownloadOutlined />,
                      onClick: handleDownload
                    },
                    {
                      key: 'openInNewTab',
                      label: '在新标签打开',
                      icon: <ExportOutlined />,
                      onClick: handleOpenInNewTab
                    }
                  ]
                }}
                trigger={['click']}
              >
                <Button style={{ marginRight: 8 }}>
                  操作
                </Button>
              </Dropdown>
              <Button key="close" onClick={onClose}>
                关闭
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
            <div style={{ color: 'var(--custom-text-secondary)', padding: '40px' }}>图片加载失败</div>
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
          placeholder="请输入文件内容..."
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
              return <MarkdownRenderer content={content || '文件内容为空'} />;
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
                  {content || '文件内容为空'}
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
        message.success('文件保存成功');
        if (onSave) onSave();
      }}
    />
  </>
  );
};

export default WorkspaceFileViewer;
