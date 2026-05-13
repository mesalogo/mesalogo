import React, { useState, useEffect } from 'react';
import { Modal, message, Spin } from 'antd';
import { DocumentEditor } from '@onlyoffice/document-editor-react';
import { workspaceAPI } from '../services/api/workspace';

/**
 * OnlyOffice在线编辑器组件
 * 从后端获取配置，包括服务器URL和JWT token
 */
const OnlyOfficeEditor = ({ visible, file, onClose, onSave }) => {
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
        console.log('OnlyOffice配置:', { ...response });
      } else {
        message.error(response.error || '获取配置失败');
        onClose();
      }
    } catch (error) {
      console.error('获取OnlyOffice配置失败:', error);
      const errorMsg = error.response?.data?.error || error.message || '未知错误';
      message.error('获取编辑器配置失败: ' + errorMsg);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // 文档准备就绪回调
  const onDocumentReady = () => {
    console.log('OnlyOffice文档已加载');
  };

  // 组件加载错误回调
  const onLoadComponentError = (errorCode, errorDescription) => {
    console.error('OnlyOffice加载错误:', errorCode, errorDescription);
    message.error('编辑器加载失败: ' + errorDescription);
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
      title={`在线编辑 - ${file?.file_name || ''}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20 }}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" tip="加载编辑器配置..." />
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
