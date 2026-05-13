import React, { useState } from 'react';
import { Input, Button, Space, message } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from '../actiontask/components/ConversationExtraction';

const { TextArea } = Input;

/**
 * 项目文件编辑器组件
 * 用于编辑文件内容，支持Markdown格式
 * 始终保持分屏模式，左侧编辑，右侧预览
 */
const WorkspaceEditor = ({ value, onChange, onSave, onCancel, showActions = true }: any) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(value || '');

  // 处理内容变化
  const handleContentChange = (newContent) => {
    setContent(newContent);
    if (onChange) {
      onChange(newContent);
    }
  };

  // 处理保存
  const handleSave = () => {
    if (!content.trim()) {
      message.error(t('workspaceEditor.emptyContent'));
      return;
    }
    if (onSave) {
      onSave(content);
    }
  };

  // 处理取消
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };
  return (
    <div className="memory-editor">
      {/* 操作按钮 */}
      {showActions && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
            >
              {t('workspaceEditor.save')}
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={handleCancel}
            >
              {t('workspaceEditor.cancel')}
            </Button>
          </Space>
        </div>
      )}

      <div style={{ display: 'flex', height: showActions ? 'calc(100% - 70px)' : '100%', gap: '16px' }}>
        {/* 编辑区域 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <TextArea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="在此输入项目文件内容（支持Markdown格式）"
            style={{
              height: '100%',
              resize: 'none',
              border: '1px solid var(--custom-border)',
              borderRadius: '4px'
            }}
          />
        </div>

        {/* 预览区域 */}
        <div style={{
          flex: 1,
          border: '1px solid var(--custom-border)',
          borderRadius: '4px',
          padding: '16px',
          backgroundColor: 'var(--custom-header-bg)',
          overflowY: 'auto',
          height: '100%'
        }}>
          <MarkdownRenderer content={content || ''} />
        </div>
      </div>
    </div>
  );
};

export default WorkspaceEditor;
