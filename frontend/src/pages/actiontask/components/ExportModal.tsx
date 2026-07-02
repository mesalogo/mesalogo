import React, { useState } from 'react';
import { App, Modal, Form, Checkbox, Radio, Button, Space, Typography, Divider } from 'antd';
import { ExportOutlined, FileExcelOutlined, FolderOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../../services/api/actionTask';

const { Text } = Typography;

/**
 * 导出行动任务数据Modal组件
 */
const ExportModal = ({ visible, onCancel, task, currentConversationId }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 处理导出
  const handleExport = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 构建导出选项
      const exportOptions = {
        include_agents: values.include_agents,
        conversations_scope: values.conversations_scope,
        current_conversation_id: values.conversations_scope === 'current' ? currentConversationId : null,
        include_workspace: values.include_workspace
      };

      console.log('Starting export, options:', exportOptions);

      // 调用导出API
      const response = await actionTaskAPI.exportData(task.id, exportOptions);

      // 处理文件下载
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 生成文件名
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `${timestamp}-actiontask-${task.title}.zip`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(t('exportModal.success'));
      onCancel();

    } catch (error) {
      console.error('Export failed:', error);
      message.error(t('exportModal.failed', { error: error.response?.data?.error || error.message }));
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <ExportOutlined />
          {t('exportModal.title')}
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          {t('cancel')}
        </Button>,
        <Button
          key="export"
          type="primary"
          icon={<ExportOutlined />}
          loading={loading}
          onClick={handleExport}
        >
          {t('exportModal.start')}
        </Button>
      ]}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          include_agents: true,
          conversations_scope: 'all',
          include_workspace: false
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            {t('exportModal.task')} <Text strong>{task?.title}</Text>
          </Text>
        </div>

        <Divider orientationMargin="0">
          <FileExcelOutlined style={{ marginRight: 4 }} />
          {t('exportModal.dataContent')}
        </Divider>

        <Form.Item name="include_agents" valuePropName="checked">
          <Checkbox>
            <Space>
              {t('exportModal.includeAgents')}
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('exportModal.includeAgentsDesc')}
              </Text>
            </Space>
          </Checkbox>
        </Form.Item>

        <Form.Item
          name="conversations_scope"
          label={t('exportModal.conversationsScope')}
        >
          <Radio.Group>
            <Space orientation="vertical">
              <Radio value="all">
                <Space>
                  {t('exportModal.allConversations')}
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {t('exportModal.allConversationsDesc')}
                  </Text>
                </Space>
              </Radio>
              <Radio value="current" disabled={!currentConversationId}>
                <Space>
                  {t('exportModal.currentConversation')}
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {currentConversationId ? t('exportModal.currentConversationDesc') : t('exportModal.selectConversationFirst')}
                  </Text>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Divider orientationMargin="0">
          <FolderOutlined style={{ marginRight: 4 }} />
          {t('exportModal.workspaceFiles')}
        </Divider>

        <Form.Item name="include_workspace" valuePropName="checked">
          <Checkbox>
            <Space>
              {t('exportModal.includeWorkspace')}
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('exportModal.includeWorkspaceDesc')}
              </Text>
            </Space>
          </Checkbox>
        </Form.Item>

        <div style={{ 
          background: 'var(--md-code-bg)', 
          padding: '12px', 
          borderRadius: '6px',
          marginTop: '16px'
        }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <strong>{t('exportModal.notesTitle')}</strong><br />
            • {t('exportModal.note1')}<br />
            • {t('exportModal.note2')}<br />
            • {t('exportModal.note3')}
          </Text>
        </div>
      </Form>
    </Modal>
  );
};

export default ExportModal;
