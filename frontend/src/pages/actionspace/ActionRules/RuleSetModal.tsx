import React, { useEffect } from 'react';
import { Modal, Form, Input, message, Checkbox, Space } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';

const { TextArea } = Input;

/**
 * 规则集创建/编辑 Modal
 */
const RuleSetModal = ({ visible, ruleSet, onCancel, onSuccess }: any) => {
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
        message.success('规则集更新成功');
      } else {
        await actionSpaceAPI.createRuleSet(ruleSetData);
        message.success('规则集创建成功');
      }

      form.resetFields();
      onSuccess();
    } catch (error) {
      console.error('保存规则集失败:', error);
      message.error(ruleSet ? '更新规则集失败' : '创建规则集失败');
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
      title={ruleSet ? '编辑规则集' : '创建规则集'}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="规则集名称"
          rules={[{ required: true, message: '请输入规则集名称' }]}
        >
          <Input placeholder="输入规则集名称" />
        </Form.Item>

        <Form.Item
          name="description"
          label="描述"
          rules={[{ required: true, message: '请输入描述' }]}
        >
          <TextArea rows={3} placeholder="输入规则集描述" />
        </Form.Item>

        <Form.Item
          name="is_shared"
          valuePropName="checked"
          tooltip="勾选后，该规则集将对所有用户可见可用（但只有创建者可编辑）"
        >
          <Checkbox>
            <Space>
              <TeamOutlined />
              共享给所有用户
            </Space>
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RuleSetModal;
