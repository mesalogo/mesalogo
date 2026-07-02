import React, { useEffect } from 'react';
import { Modal, Form, Input, Button } from 'antd';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;

/**
 * 创建工作空间模板对话框组件
 */
const WorkspaceTemplateModal = ({ visible, onCancel, onSubmit, memory }: any) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && memory) {
      form.setFieldsValue({
        templateName: t('wsTemplate.defaultName', { title: memory.title }),
        templateDescription: t('wsTemplate.defaultDescription')
      });
    }
  }, [visible, memory, form, t]);

  const handleSubmit = () => {
    form.validateFields().then(values => {
      onSubmit(values);
      form.resetFields();
    });
  };

  return (
    <Modal
      title={t('wsTemplate.title')}
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
          label={t('wsTemplate.nameLabel')}
          rules={[{ required: true, message: t('wsTemplate.nameRequired') }]}
        >
          <Input placeholder={t('wsTemplate.namePlaceholder')} />
        </Form.Item>
        <Form.Item
          name="templateDescription"
          label={t('wsTemplate.descriptionLabel')}
        >
          <TextArea placeholder={t('wsTemplate.descriptionPlaceholder')} rows={4} />
        </Form.Item>
        <Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button style={{ marginRight: 8 }} onClick={onCancel}>
              {t('wsTemplate.cancel')}
            </Button>
            <Button type="primary" htmlType="submit">
              {t('wsTemplate.create')}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WorkspaceTemplateModal;
