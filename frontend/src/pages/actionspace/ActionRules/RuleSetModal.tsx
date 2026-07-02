import React, { useEffect } from 'react';
import { App, Modal, Form, Input, Checkbox, Space } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../../services/api/actionspace';

const { TextArea } = Input;

/**
 * 规则集创建/编辑 Modal
 */
const RuleSetModal = ({ visible, ruleSet, onCancel, onSuccess }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (visible && ruleSet) {
      form.setFieldsValue({
        name: ruleSet.name,
        description: ruleSet.description,
        is_shared: ruleSet.is_shared || false
      });
    } else if (visible) {
      form.resetFields();
    }
  }, [visible, ruleSet, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const urlParams = new URLSearchParams(window.location.search);
      const spaceId = urlParams.get('spaceId');
      const isValidSpaceId = spaceId && !isNaN(Number(spaceId));

      const ruleSetData: any = {
        name: values.name,
        description: values.description,
        is_shared: values.is_shared || false
      };

      if (isValidSpaceId) {
        ruleSetData.action_space_id = spaceId;
      }

      if (ruleSet) {
        await actionSpaceAPI.updateRuleSet(ruleSet.id, ruleSetData);
        message.success(t('ruleSetModal.updateSuccess'));
      } else {
        await actionSpaceAPI.createRuleSet(ruleSetData);
        message.success(t('ruleSetModal.createSuccess'));
      }

      form.resetFields();
      onSuccess();
    } catch (error) {
      console.error('Failed to save rule set:', error);
      message.error(ruleSet ? t('ruleSetModal.updateFailed') : t('ruleSetModal.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={ruleSet ? t('ruleSetModal.editTitle') : t('ruleSetModal.createTitle')}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={t('ruleSetModal.name')}
          rules={[{ required: true, message: t('ruleSetModal.nameRequired') }]}
        >
          <Input placeholder={t('ruleSetModal.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('ruleSetModal.description')}
          rules={[{ required: true, message: t('ruleSetModal.descriptionRequired') }]}
        >
          <TextArea rows={3} placeholder={t('ruleSetModal.descriptionPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="is_shared"
          valuePropName="checked"
          tooltip={t('ruleSetModal.sharedTooltip')}
        >
          <Checkbox>
            <Space>
              <TeamOutlined />
              {t('ruleSetModal.shareToAll')}
            </Space>
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RuleSetModal;
