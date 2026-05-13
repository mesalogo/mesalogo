import React, { useState } from 'react';
import { Modal, Form, Checkbox, Radio, Button, message, Space, Typography, Divider } from 'antd';
import { ExportOutlined, FileExcelOutlined, FolderOutlined } from '@ant-design/icons';
import { actionTaskAPI } from '../../../services/api/actionTask';

const { Text } = Typography;

/**
 * 导出行动任务数据Modal组件
 */
const ExportModal = ({ visible, onCancel, task, currentConversationId }) => {
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

      console.log('开始导出，选项:', exportOptions);

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

      message.success('导出成功！文件已开始下载');
      onCancel();

    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败: ' + (error.response?.data?.error || error.message));
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
          导出行动任务数据
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="export"
          type="primary"
          icon={<ExportOutlined />}
          loading={loading}
          onClick={handleExport}
        >
          开始导出
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
            任务: <Text strong>{task?.title}</Text>
          </Text>
        </div>

        <Divider orientationMargin="0">
          <FileExcelOutlined style={{ marginRight: 4 }} />
          数据内容
        </Divider>

        <Form.Item name="include_agents" valuePropName="checked">
          <Checkbox>
            <Space>
              智能体列表
              <Text type="secondary" style={{ fontSize: '12px' }}>
                (包含智能体基本信息、角色、状态等)
              </Text>
            </Space>
          </Checkbox>
        </Form.Item>

        <Form.Item
          name="conversations_scope"
          label="会话数据范围"
        >
          <Radio.Group>
            <Space orientation="vertical">
              <Radio value="all">
                <Space>
                  全部会话
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    (导出所有会话的消息记录)
                  </Text>
                </Space>
              </Radio>
              <Radio value="current" disabled={!currentConversationId}>
                <Space>
                  当前会话
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {currentConversationId ? '(仅导出当前查看的会话)' : '(请先选择一个会话)'}
                  </Text>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Divider orientationMargin="0">
          <FolderOutlined style={{ marginRight: 4 }} />
          工作空间文件
        </Divider>

        <Form.Item name="include_workspace" valuePropName="checked">
          <Checkbox>
            <Space>
              包含工作空间内容
              <Text type="secondary" style={{ fontSize: '12px' }}>
                (包含任务的所有工作空间文件和目录)
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
            <strong>导出说明:</strong><br />
            • 数据将以Excel格式导出，包含智能体和会话消息两个工作表<br />
            • 如选择包含工作空间，将一并打包所有相关文件<br />
            • 最终生成ZIP压缩包供下载
          </Text>
        </div>
      </Form>
    </Modal>
  );
};

export default ExportModal;
