import React, { useState, useEffect } from 'react';
import { App, Modal, Spin } from 'antd';
import { DocumentEditor } from '@onlyoffice/document-editor-react';
import { useTranslation } from 'react-i18next';
import { workspaceAPI } from '../services/api/workspace';

/**
 * OnlyOffice在线编辑器组件
 * 从后端获取配置，包括服务器URL和JWT token
 */
const OnlyOfficeEditor = ({ visible, file, onClose, onSave }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [editorConfig, setEditorConfig] = useState(null);
  const [serverUrl, setServerUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // 从后端获取完整的编辑器配置
  const fetchEditorConfig = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const response = await workspaceAPI.getOnlyOfficeConfig(file.file_path, file.file_name);
      
      if (response.success) {
        setEditorConfig(response.config);
        // 直接使用后端返回的完整URL
        setServerUrl(response.documentServerUrl);
        console.log('OnlyOffice config:', { ...response });
      } else {
        message.error(response.error || t('onlyOfficeEditor.getConfigFailed'));
        onClose();
      }
    } catch (error) {
      console.error('Failed to get OnlyOffice config:', error);
      const errorMsg = error.response?.data?.error || error.message || t('onlyOfficeEditor.unknownError');
      message.error(t('onlyOfficeEditor.getEditorConfigFailed', { error: errorMsg }));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // 文档准备就绪回调
  const onDocumentReady = () => {
    console.log('OnlyOffice document loaded');
  };

  // 组件加载错误回调
  const onLoadComponentError = (errorCode, errorDescription) => {
    console.error('OnlyOffice load error:', errorCode, errorDescription);
    message.error(t('onlyOfficeEditor.loadFailed', { error: errorDescription }));
  };

  // 当文件变化时获取配置
  useEffect(() => {
    if (visible && file) {
      // 重置状态
      setEditorConfig(null);
      setServerUrl(null);
      
      fetchEditorConfig();
    }
  }, [visible, file]);

  return (
    <Modal
      title={t('onlyOfficeEditor.title', { name: file?.file_name || '' })}
      open={visible}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20 }}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip={t('onlyOfficeEditor.loadingConfig')} />
        </div>
      ) : (
        editorConfig && serverUrl && (
          <DocumentEditor
            id="onlyoffice-editor"
            documentServerUrl={serverUrl}
            config={editorConfig}
            events_onDocumentReady={onDocumentReady}
            onLoadComponentError={onLoadComponentError}
          />
        )
      )}
    </Modal>
  );
};

export default OnlyOfficeEditor;
