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
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const UserForm = ({ visible, user, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [allRoles, setAllRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const { user: currentUser } = useAuth();
  const isEditing = !!user;
  const isRootUser = user && user.username === 'admin'; // 判断是否为根用户

  // 检查是否可以编辑用户角色
  const canEditRole = user ? canEditUserRole(currentUser, user) : true;

  // 获取所有角色
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get('/user-roles');
        setAllRoles(response.data.user_roles || []);
      } catch (error) {
        console.error('获取角色列表失败:', error);
      }
    };
    if (visible) {
      fetchRoles();
    }
  }, [visible]);

  // 获取订阅计划列表
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await subscriptionAPI.adminGetPlans();
        if (response.success && response.data?.plans) {
          setSubscriptionPlans(response.data.plans);
        }
      } catch (error) {
        console.error('获取订阅计划失败:', error);
      }
    };
    if (visible && currentUser?.is_admin) {
      fetchPlans();
    }
  }, [visible, currentUser]);

  // 获取用户当前角色和订阅
  useEffect(() => {
    const fetchUserData = async () => {
      if (isEditing && user) {
        try {
          // 获取用户角色
          const rolesResponse = await api.get(`/users/${user.id}/roles`);
          setUserRoles(rolesResponse.data.roles || []);
          
          // 获取用户订阅
          if (currentUser?.is_admin) {
            const subResponse = await subscriptionAPI.adminGetUserSubscription(user.id);
            if (subResponse.success) {
              setUserSubscription(subResponse.data);
            }
          }
        } catch (error) {
          console.error('获取用户数据失败:', error);
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
              notes: '管理员手动设置'
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
              notes: '管理员创建时设置'
            });
          }
        }
      }

      if (response.success) {
        message.success(isEditing ? '用户更新成功' : '用户创建成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.message || (isEditing ? '更新用户失败' : '创建用户失败'));
      }
    } catch (error) {
      console.error('提交用户表单失败:', error);
      message.error(error.response?.data?.error || (isEditing ? '更新用户失败' : '创建用户失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  // 用户名验证规则
  const usernameRules = [
    { required: true, message: '请输入用户名' },
    { min: 3, message: '用户名至少3个字符' },
    { max: 50, message: '用户名不能超过50个字符' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' }
  ];

  // 邮箱验证规则（非必选，但如果填写则需要格式正确）
  const emailRules = [
    {
      validator: (_, value) => {
        if (!value) {
          // 邮箱为空时通过验证（非必选）
          return Promise.resolve();
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return Promise.reject(new Error('请输入有效的邮箱地址'));
        }
        return Promise.resolve();
      }
    }
  ];

  // 密码验证规则（仅在创建模式下使用）
  const passwordRules = [
    { required: !isEditing, message: '请输入密码' },
    { min: 6, message: '密码至少6个字符' },
    { max: 100, message: '密码不能超过100个字符' }
  ];

  // 确认密码验证规则（仅在创建模式下使用）
  const confirmPasswordRules = [
    { required: !isEditing, message: '请确认密码' },
    ({ getFieldValue }) => ({
      validator(_, value) {
        if (!value || getFieldValue('password') === value) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('两次输入的密码不一致'));
      },
    }),
  ];

  return (
    <Modal
      title={
        <div>
          <UserOutlined style={{ marginRight: 8 }} />
          {isEditing ? '编辑用户' : '创建用户'}
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
          {isEditing ? '更新' : '创建'}
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
        {/* 基本信息 */}
        <Title level={5}>基本信息</Title>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="username"
              label="用户名"
              rules={usernameRules}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
                disabled={isEditing} // 编辑时不允许修改用户名
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label="邮箱"
              rules={emailRules}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="请输入邮箱"
              />
            </Form.Item>
          </Col>
        </Row>

        {!isEditing && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="password"
                label="密码"
                rules={passwordRules}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请输入密码"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                rules={confirmPasswordRules}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="请再次输入密码"
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Divider />

        {/* 扩展信息 */}
        <Title level={5}>扩展信息</Title>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="display_name"
              label="显示名称"
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入显示名称"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="phone"
              label="手机号码"
            >
              <Input
                prefix={<PhoneOutlined />}
                placeholder="请输入手机号码"
              />
            </Form.Item>
          </Col>
        </Row>



        <Form.Item
          name="notes"
          label="备注"
        >
          <TextArea
            rows={3}
            placeholder="请输入备注信息"
          />
        </Form.Item>

        <Divider />

        {/* 权限设置 */}
        <Title level={5}>权限设置</Title>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="is_active"
              label="账户状态"
              valuePropName="checked"
            >
              <Switch
                checkedChildren="启用"
                unCheckedChildren="禁用"
                disabled={isRootUser} // 根用户不可禁用
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="role_id"
              label="用户角色"
              rules={[{ required: true, message: '请选择用户角色' }]}
            >
              <Select
                placeholder="请选择用户角色"
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

        {/* 订阅管理 - 仅管理员可见 */}
        {currentUser?.is_admin && subscriptionPlans.length > 0 && (
          <>
            <Divider />
            <Title level={5}>
              <CrownOutlined style={{ marginRight: 8 }} />
              订阅管理
            </Title>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="subscription_plan_id"
                  label="订阅计划"
                >
                  <Select
                    placeholder="请选择订阅计划"
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
                            <span style={{ color: '#999' }}>
                              ¥{plan.price_monthly}/月
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
                  label="到期时间"
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    placeholder="永不过期"
                    allowClear
                    showTime={false}
                  />
                </Form.Item>
              </Col>
            </Row>

            {isEditing && userSubscription?.subscription && (
              <Alert
                message="当前订阅信息"
                description={
                  <div>
                    <div>
                      <strong>计划：</strong>
                      {userSubscription.plan?.display_name || '未知'}
                    </div>
                    <div>
                      <strong>状态：</strong>
                      {userSubscription.subscription.status === 'active' ? '生效中' : 
                       userSubscription.subscription.status === 'expired' ? '已过期' : '已取消'}
                    </div>
                    {userSubscription.subscription.expires_at && (
                      <div>
                        <strong>到期时间：</strong>
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
          message="角色权限说明"
          description={
            <div>
              <div><strong>超级管理员：</strong>拥有租户内所有权限，可以管理用户、系统设置和所有内容。</div>
              <div><strong>普通用户：</strong>可以创建和管理自己的任务、行动空间，查看租户内的智能体。</div>
              <div><strong>只读用户：</strong>只能查看自己创建的内容，不能进行任何修改操作。</div>
              {isRootUser && (
                <div style={{ marginTop: 8, color: '#fa8c16' }}>
                  ⚠️ admin为系统根用户，其启用状态和角色不可修改。
                </div>
              )}
              {!canEditRole && !isRootUser && (
                <div style={{ marginTop: 8, color: '#fa8c16' }}>
                  ⚠️ 超级管理员不能修改自己的角色，防止误操作。
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
