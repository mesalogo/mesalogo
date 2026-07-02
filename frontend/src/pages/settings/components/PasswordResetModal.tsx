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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { userAPI } from '../../../services/api/users';

const { Title, Text } = Typography;

const PasswordResetModal = ({ visible, user, onCancel, onSuccess }: any) => {
  const { t } = useTranslation();
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
        message.success(t('passwordReset.success'));
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.message || t('passwordReset.failed'));
      }
    } catch (error) {
      console.error('Password reset failed:', error);
      message.error(t('passwordReset.failed'));
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
      return Promise.reject(new Error(t('passwordReset.enterNewPassword')));
    }
    if (value.length < 6) {
      return Promise.reject(new Error(t('passwordReset.minLength')));
    }
    return Promise.resolve();
  };

  // 验证确认密码
  const validateConfirmPassword = (_, value) => {
    const newPassword = form.getFieldValue('new_password');
    if (!value) {
      return Promise.reject(new Error(t('passwordReset.confirmNewPassword')));
    }
    if (value !== newPassword) {
      return Promise.reject(new Error(t('passwordReset.mismatch')));
    }
    return Promise.resolve();
  };

  return (
    <Modal
      title={
        <div>
          <LockOutlined style={{ marginRight: 8 }} />
          {t('passwordReset.title')}
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          {t('passwordReset.cancel')}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={() => form.submit()}
        >
          {t('passwordReset.submit')}
        </Button>
      ]}
      width={500}
      destroyOnHidden
    >
      {user && (
        <div style={{ marginBottom: 24 }}>
          <Space>
            <UserOutlined />
            <Text strong>{t('passwordReset.userLabel', { username: user.username })}</Text>
            <Text type="secondary">({user.display_name || user.username})</Text>
          </Space>
        </div>
      )}

      <Alert
        message={t('passwordReset.alertTitle')}
        description={t('passwordReset.alertDesc')}
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
          label={t('passwordReset.newPassword')}
          rules={[{ validator: validateNewPassword }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('passwordReset.newPasswordPlaceholder')}
          />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label={t('passwordReset.confirmPassword')}
          rules={[{ validator: validateConfirmPassword }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('passwordReset.confirmPasswordPlaceholder')}
          />
        </Form.Item>

        <div style={{ background: 'var(--md-code-bg)', padding: 12, borderRadius: 6, marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <LockOutlined style={{ marginRight: 4 }} />
            {t('passwordReset.requirement')}
            <br />
            💡 {t('passwordReset.tip')}
          </Text>
        </div>
      </Form>
    </Modal>
  );
};

export default PasswordResetModal;
