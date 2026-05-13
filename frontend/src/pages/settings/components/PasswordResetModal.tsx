import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  message,
  Typography,
  Space,
  Alert
} from 'antd';
import {
  LockOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAuth } from '../../../contexts/AuthContext';
import { userAPI } from '../../../services/api/users';

const { Title, Text } = Typography;

const PasswordResetModal = ({ visible, user, onCancel, onSuccess }: any) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (visible) {
      form.resetFields();
    }
  }, [visible, form]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const requestData = {
        new_password: values.new_password
      };

      const response = await userAPI.resetPassword(user.id, requestData);

      if (response.success) {
        message.success('密码重置成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.message || '密码重置失败');
      }
    } catch (error) {
      console.error('密码重置失败:', error);
      message.error('密码重置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // 验证新密码
  const validateNewPassword = (_, value) => {
    if (!value) {
      return Promise.reject(new Error('请输入新密码'));
    }
    if (value.length < 6) {
      return Promise.reject(new Error('密码至少6个字符'));
    }
    return Promise.resolve();
  };

  // 验证确认密码
  const validateConfirmPassword = (_, value) => {
    const newPassword = form.getFieldValue('new_password');
    if (!value) {
      return Promise.reject(new Error('请确认新密码'));
    }
    if (value !== newPassword) {
      return Promise.reject(new Error('两次输入的密码不一致'));
    }
    return Promise.resolve();
  };

  return (
    <Modal
      title={
        <div>
          <LockOutlined style={{ marginRight: 8 }} />
          重置密码
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={() => form.submit()}
        >
          重置密码
        </Button>
      ]}
      width={500}
      destroyOnHidden
    >
      {user && (
        <div style={{ marginBottom: 24 }}>
          <Space>
            <UserOutlined />
            <Text strong>用户：{user.username}</Text>
            <Text type="secondary">({user.display_name || user.username})</Text>
          </Space>
        </div>
      )}

      <Alert
        message="重置用户密码"
        description="直接为用户设置新密码，无需验证原密码。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="new_password"
          label="新密码"
          rules={[{ validator: validateNewPassword }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入新密码（至少6个字符）"
          />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label="确认新密码"
          rules={[{ validator: validateConfirmPassword }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请再次输入新密码"
          />
        </Form.Item>

        <div style={{ background: 'var(--md-code-bg)', padding: 12, borderRadius: 6, marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <LockOutlined style={{ marginRight: 4 }} />
            密码要求：至少6个字符，建议包含字母、数字和特殊字符以提高安全性。
            <br />
            💡 提示：重置密码无需验证原密码，设置后立即生效。
          </Text>
        </div>
      </Form>
    </Modal>
  );
};

export default PasswordResetModal;
