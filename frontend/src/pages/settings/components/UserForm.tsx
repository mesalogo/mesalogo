import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Switch,
  Button,
  message,
  Row,
  Col,
  Divider,
  Typography,
  Select,
  Alert,
  Space,
  DatePicker
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { userAPI } from '../../../services/api/users';
import { subscriptionAPI, SubscriptionPlan } from '../../../services/api/subscription';
import api from '../../../services/api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { canEditUserRole } from '../../../constants/permissions';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const UserForm = ({ visible, user, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [allRoles, setAllRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const { user: currentUser } = useAuth();
  const isEditing = !!user;
  const isRootUser = user && user.username === 'admin'; // root user check

  const canEditRole = user ? canEditUserRole(currentUser, user) : true;

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get('/user-roles');
        setAllRoles(response.data.user_roles || []);
      } catch (error) {
        console.error('fetch user roles failed:', error);
      }
    };
    if (visible) {
      fetchRoles();
    }
  }, [visible]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await subscriptionAPI.adminGetPlans();
        if (response.success && response.data?.plans) {
          setSubscriptionPlans(response.data.plans);
        }
      } catch (error) {
        console.error('fetch subscription plans failed:', error);
      }
    };
    if (visible && currentUser?.is_admin) {
      fetchPlans();
    }
  }, [visible, currentUser]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (isEditing && user) {
        try {
          const rolesResponse = await api.get(`/users/${user.id}/roles`);
          setUserRoles(rolesResponse.data.roles || []);

          if (currentUser?.is_admin) {
            const subResponse = await subscriptionAPI.adminGetUserSubscription(user.id);
            if (subResponse.success) {
              setUserSubscription(subResponse.data);
            }
          }
        } catch (error) {
          console.error('fetch user data failed:', error);
        }
      }
    };
    if (visible) {
      fetchUserData();
    }
  }, [visible, user, isEditing, currentUser]);

  useEffect(() => {
    if (visible) {
      if (isEditing && user) {
        // 编辑模式，填充表单数据
        const currentRoleId = userRoles.length > 0 ? userRoles[0].user_role_id : undefined;
        const currentPlanId = userSubscription?.subscription?.plan_id;
        const expiresAt = userSubscription?.subscription?.expires_at;
        
        form.setFieldsValue({
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          phone: user.phone,
          notes: user.notes,
          is_active: user.is_active,
          role_id: currentRoleId,
          subscription_plan_id: currentPlanId,
          subscription_expires_at: expiresAt ? dayjs(expiresAt) : null
        });
      } else {
        // 创建模式，重置表单
        form.resetFields();
        // 默认选择普通用户角色
        const regularUserRole = allRoles.find(r => r.name === 'regular_user');
        // 默认选择免费计划
        const freePlan = subscriptionPlans.find(p => p.is_default || p.name === 'free');
        form.setFieldsValue({
          is_active: true,
          role_id: regularUserRole?.id,
          subscription_plan_id: freePlan?.id
        });
      }
    }
  }, [visible, user, isEditing, form, userRoles, allRoles, userSubscription, subscriptionPlans]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      let response;
      const { role_id, subscription_plan_id, subscription_expires_at, ...userData } = values;

      if (isEditing) {
        // 更新用户基本信息
        response = await userAPI.updateUser(user.id, userData);

        // 更新用户角色（如果角色发生变化且有权限编辑）
        if (canEditRole && role_id) {
          const currentRoleId = userRoles.length > 0 ? userRoles[0].user_role_id : null;
          if (role_id !== currentRoleId) {
            // 先移除现有角色
            if (currentRoleId) {
              await api.delete(`/users/${user.id}/roles/${currentRoleId}`);
            }
            // 分配新角色
            await api.post(`/users/${user.id}/roles`, { user_role_id: role_id });
          }
        }

        // 更新用户订阅（如果有权限）
        if (currentUser?.is_admin && subscription_plan_id) {
          const currentPlanId = userSubscription?.subscription?.plan_id;
          const currentExpiresAt = userSubscription?.subscription?.expires_at;
          const newExpiresAt = subscription_expires_at ? subscription_expires_at.toISOString() : null;
          
          if (subscription_plan_id !== currentPlanId || newExpiresAt !== currentExpiresAt) {
            await subscriptionAPI.adminUpdateUserSubscription(user.id, {
              plan_id: subscription_plan_id,
              expires_at: newExpiresAt,
              notes: t('userForm.note.adminManualSet')
            });
          }
        }
      } else {
        // 创建用户
        response = await userAPI.createUser(userData);

        // 为新用户分配角色
        if (response.success && response.data?.user?.id && role_id) {
          await api.post(`/users/${response.data.user.id}/roles`, { user_role_id: role_id });
        }

        // 为新用户设置订阅计划（如果不是默认免费计划）
        if (response.success && response.data?.user?.id && subscription_plan_id && currentUser?.is_admin) {
          const freePlan = subscriptionPlans.find(p => p.is_default || p.name === 'free');
          if (subscription_plan_id !== freePlan?.id) {
            const newExpiresAt = subscription_expires_at ? subscription_expires_at.toISOString() : null;
            await subscriptionAPI.adminUpdateUserSubscription(response.data.user.id, {
              plan_id: subscription_plan_id,
              expires_at: newExpiresAt,
              notes: t('userForm.note.adminCreateSet')
            });
          }
        }
      }

      if (response.success) {
        message.success(isEditing ? t('userForm.msg.updateSuccess') : t('userForm.msg.createSuccess'));
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.message || (isEditing ? t('userForm.msg.updateFailed') : t('userForm.msg.createFailed')));
      }
    } catch (error) {
      console.error('submit user form failed:', error);
      message.error(error.response?.data?.error || (isEditing ? t('userForm.msg.updateFailed') : t('userForm.msg.createFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // username
  const usernameRules = [
    { required: true, message: t('userForm.req.username') },
    { min: 3, message: t('userForm.req.usernameMin') },
    { max: 50, message: t('userForm.req.usernameMax') },
    { pattern: /^[a-zA-Z0-9_]+$/, message: t('userForm.req.usernamePattern') }
  ];

  // email (optional, must be valid if provided)
  const emailRules = [
    {
      validator: (_, value) => {
        if (!value) return Promise.resolve();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return Promise.reject(new Error(t('userForm.req.emailValid')));
        }
        return Promise.resolve();
      }
    }
  ];

  // password (create only)
  const passwordRules = [
    { required: !isEditing, message: t('userForm.req.password') },
    { min: 6, message: t('userForm.req.passwordMin') },
    { max: 100, message: t('userForm.req.passwordMax') }
  ];

  // confirm password (create only)
  const confirmPasswordRules = [
    { required: !isEditing, message: t('userForm.req.confirmPassword') },
    ({ getFieldValue }) => ({
      validator(_, value) {
        if (!value || getFieldValue('password') === value) {
          return Promise.resolve();
        }
        return Promise.reject(new Error(t('userForm.req.passwordMismatch')));
      },
    }),
  ];

  return (
    <Modal
      title={
        <div>
          <UserOutlined style={{ marginRight: 8 }} />
          {isEditing ? t('userForm.editTitle') : t('userForm.createTitle')}
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          {t('userForm.cancel')}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={() => form.submit()}
        >
          {isEditing ? t('userForm.update') : t('userForm.create')}
        </Button>
      ]}
      width={600}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Title level={5}>{t('userForm.section.basic')}</Title>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="username"
              label={t('userForm.field.username')}
              rules={usernameRules}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('userForm.ph.username')}
                disabled={isEditing}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label={t('userForm.field.email')}
              rules={emailRules}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder={t('userForm.ph.email')}
              />
            </Form.Item>
          </Col>
        </Row>

        {!isEditing && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="password"
                label={t('userForm.field.password')}
                rules={passwordRules}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('userForm.ph.password')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="confirmPassword"
                label={t('userForm.field.confirmPassword')}
                rules={confirmPasswordRules}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('userForm.ph.confirmPassword')}
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Divider />

        <Title level={5}>{t('userForm.section.extended')}</Title>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="display_name"
              label={t('userForm.field.displayName')}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('userForm.ph.displayName')}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="phone"
              label={t('userForm.field.phone')}
            >
              <Input
                prefix={<PhoneOutlined />}
                placeholder={t('userForm.ph.phone')}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="notes"
          label={t('userForm.field.notes')}
        >
          <TextArea
            rows={3}
            placeholder={t('userForm.ph.notes')}
          />
        </Form.Item>

        <Divider />

        <Title level={5}>{t('userForm.section.permissions')}</Title>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="is_active"
              label={t('userForm.field.accountStatus')}
              valuePropName="checked"
            >
              <Switch
                checkedChildren={t('userForm.enabled')}
                unCheckedChildren={t('userForm.disabled')}
                disabled={isRootUser}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="role_id"
              label={t('userForm.field.userRole')}
              rules={[{ required: true, message: t('userForm.req.userRole') }]}
            >
              <Select
                placeholder={t('userForm.ph.userRole')}
                disabled={isRootUser || !canEditRole}
                suffixIcon={<SafetyCertificateOutlined />}
              >
                {allRoles.map(role => (
                  <Option key={role.id} value={role.id}>
                    <Space>
                      <SafetyCertificateOutlined />
                      {role.display_name}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {currentUser?.is_admin && subscriptionPlans.length > 0 && (
          <>
            <Divider />
            <Title level={5}>
              <CrownOutlined style={{ marginRight: 8 }} />
              {t('userForm.section.subscription')}
            </Title>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="subscription_plan_id"
                  label={t('userForm.field.subscriptionPlan')}
                >
                  <Select
                    placeholder={t('userForm.ph.subscriptionPlan')}
                    suffixIcon={<CrownOutlined />}
                  >
                    {subscriptionPlans.map(plan => (
                      <Option key={plan.id} value={plan.id}>
                        <Space>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: plan.badge_color
                            }}
                          />
                          {plan.display_name}
                          {plan.price_monthly > 0 && (
                            <span style={{ color: 'var(--custom-text-secondary)' }}>
                              {t('userForm.pricePerMonth', { price: plan.price_monthly })}
                            </span>
                          )}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="subscription_expires_at"
                  label={t('userForm.field.expiresAt')}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    placeholder={t('userForm.ph.neverExpire')}
                    allowClear
                    showTime={false}
                  />
                </Form.Item>
              </Col>
            </Row>

            {isEditing && userSubscription?.subscription && (
              <Alert
                message={t('userForm.currentSubInfo')}
                description={
                  <div>
                    <div>
                      <strong>{t('userForm.sub.planLabel')}</strong>
                      {userSubscription.plan?.display_name || t('userForm.sub.unknown')}
                    </div>
                    <div>
                      <strong>{t('userForm.sub.statusLabel')}</strong>
                      {userSubscription.subscription.status === 'active' ? t('userForm.sub.statusActive') :
                       userSubscription.subscription.status === 'expired' ? t('userForm.sub.statusExpired') : t('userForm.sub.statusCancelled')}
                    </div>
                    {userSubscription.subscription.expires_at && (
                      <div>
                        <strong>{t('userForm.sub.expiresAtLabel')}</strong>
                        {dayjs(userSubscription.subscription.expires_at).format('YYYY-MM-DD')}
                      </div>
                    )}
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
          </>
        )}

        <Alert
          message={t('userForm.permAlertTitle')}
          description={
            <div>
              <div><strong>{t('userForm.role.superAdmin')}</strong>{t('userForm.role.superAdminDesc')}</div>
              <div><strong>{t('userForm.role.regular')}</strong>{t('userForm.role.regularDesc')}</div>
              <div><strong>{t('userForm.role.readonly')}</strong>{t('userForm.role.readonlyDesc')}</div>
              {isRootUser && (
                <div style={{ marginTop: 8, color: '#fa8c16' }}>
                  ⚠️ {t('userForm.warn.rootUser')}
                </div>
              )}
              {!canEditRole && !isRootUser && (
                <div style={{ marginTop: 8, color: '#fa8c16' }}>
                  ⚠️ {t('userForm.warn.selfEditRole')}
                </div>
              )}
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Form>
    </Modal>
  );
};

export default UserForm;
