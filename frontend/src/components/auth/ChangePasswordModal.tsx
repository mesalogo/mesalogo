import React, { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { LockOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../../services/api/auth';

const ChangePasswordModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const result = await authAPI.changePassword(values.newPassword);
      
      if (result.success) {
        message.success(result.message);
        form.resetFields();
        onSuccess && onSuccess();
        onCancel();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('Change password failed:', error);
      message.error(t('password.changeFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setPasswordVisible(false);
    setConfirmPasswordVisible(false);
    onCancel();
  };

  const passwordRules = [
    { required: true, message: t('password.newPasswordRequired') },
    { min: 6, message: t('password.minLength') },
    { max: 50, message: t('password.maxLength') }
  ];

  const confirmPasswordRules = [
    { required: true, message: t('password.confirmPasswordRequired') },
    ({ getFieldValue }) => ({
      validator(_, value) {
        if (!value || getFieldValue('newPassword') === value) {
          return Promise.resolve();
        }
        return Promise.reject(new Error(t('password.passwordMismatch')));
      },
    }),
  ];

  return (
    <Modal
      title={t('password.changeTitle')}
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={400}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="newPassword"
          label={t('password.newPassword')}
          rules={passwordRules}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('password.newPasswordPlaceholder')}
            visibilityToggle={{
              visible: passwordVisible,
              onVisibleChange: setPasswordVisible,
            }}
            iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={t('password.confirmPassword')}
          rules={confirmPasswordRules}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('password.confirmPasswordPlaceholder')}
            visibilityToggle={{
              visible: confirmPasswordVisible,
              onVisibleChange: setConfirmPasswordVisible,
            }}
            iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
            >
              {t('password.confirmChange')}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
