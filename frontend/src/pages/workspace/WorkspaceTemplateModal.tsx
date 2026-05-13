import React, { useEffect } from 'react';
import { Modal, Form, Input, Button } from 'antd';

const { TextArea } = Input;

/**
 * 创建工作空间模板对话框组件
 */
const WorkspaceTemplateModal = ({ visible, onCancel, onSubmit, memory }: any) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && memory) {
      form.setFieldsValue({
        templateName: `${memory.title} 模板`,
        templateDescription: '基于现有项目文件创建的模板'
      });
    }
  }, [visible, memory, form]);

  const handleSubmit = () => {
    form.validateFields().then(values => {
      onSubmit(values);
      form.resetFields();
    });
  };

  return (
    <Modal
      title="创建工作空间模板"
      open={visible}
      onCancel={onCancel}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="templateName"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="请输入模板名称" />
        </Form.Item>
        <Form.Item
          name="templateDescription"
          label="模板描述"
        >
          <TextArea placeholder="请输入模板描述" rows={4} />
        </Form.Item>
        <Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button style={{ marginRight: 8 }} onClick={onCancel}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              创建
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WorkspaceTemplateModal;
