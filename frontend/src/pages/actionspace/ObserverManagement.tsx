// ObserverManagement.js
// 此文件包含行动空间监督者管理组件

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card, Button, Table, Empty,
  Space, Modal, Form, Input, message,
  Typography, Select, Spin, Tooltip, Tag,
  Switch, InputNumber, Divider, Slider,
  Radio, Row, Col, Steps, Badge
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, InfoCircleOutlined, SettingOutlined,
  QuestionCircleOutlined, ClockCircleOutlined,
  FileSearchOutlined, CheckCircleOutlined,
  ThunderboltOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { actionSpaceAPI } from '../../services/api/actionspace';
import { roleAPI } from '../../services/api/role';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ObserverManagement = ({ actionSpaceId, onDataChange }: any) => {
  const { t } = useTranslation();
  const [observers, setObservers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [editingObserver, setEditingObserver] = useState(null);
  const [configuringObserver, setConfiguringObserver] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [currentSupervisionMode, setCurrentSupervisionMode] = useState('round_based');
  const [availableVariables, setAvailableVariables] = useState<any>({ environmentVariables: [], agentRoles: [] });
  const [currentFormValues, setCurrentFormValues] = useState(null);
  const [form] = Form.useForm();
  const [settingsForm] = Form.useForm();

  // 获取监督者列表
  const fetchObservers = async () => {
    if (!actionSpaceId) return;

    setLoading(true);
    try {
      const response = await actionSpaceAPI.getObservers(actionSpaceId);
      setObservers(response.observers || []);
    } catch (error) {
      console.error('fetch observers failed:', error);
      message.error(t('observer.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 获取可用角色
  const fetchAvailableRoles = async () => {
    try {
      const roles = await roleAPI.getAvailableRoles();
      // 过滤出标记为监督者角色的角色或所有角色
      const filteredRoles = roles.filter(role => role.is_observer_role || true);
      setAvailableRoles(filteredRoles);
    } catch (error) {
      console.error('fetch available roles failed:', error);
      message.error(t('observer.fetchRolesFailed'));
    }
  };

  // 获取行动空间中的可用变量
  const fetchAvailableVariables = async () => {
    if (!actionSpaceId) {
      setAvailableVariables([]);
      return;
    }

    try {
      const variableData = {
        environmentVariables: [],
        agentRoles: []
      };

      // 1. 获取行动空间的环境变量
      try {
        const spaceDetail = await actionSpaceAPI.getDetail(actionSpaceId);
        const environmentVariables = spaceDetail.environment_variables || [];

        environmentVariables.forEach(envVar => {
          variableData.environmentVariables.push({
            name: envVar.name,
            displayName: envVar.name  // 环境变量直接显示变量名
          });
        });
      } catch (error) {
        console.warn('fetch action-space env variables failed:', error);
      }

      // 2. 获取行动空间中角色的变量
      try {
        const spaceDetail = await actionSpaceAPI.getDetail(actionSpaceId);
        const roles = spaceDetail.roles || [];

        roles.forEach(role => {
          if (role.environment_variables && Array.isArray(role.environment_variables)) {
            const roleData = {
              id: role.id,
              name: role.name,
              variables: []
            };

            role.environment_variables.forEach(roleVar => {
              roleData.variables.push({
                name: roleVar.name,
                displayName: roleVar.name,
                fullName: `${role.name}-${roleVar.name}`  // 用于存储的完整名称
              });
            });

            if (roleData.variables.length > 0) {
              variableData.agentRoles.push(roleData);
            }
          }
        });
      } catch (error) {
        console.warn('fetch role variables failed:', error);
      }

      setAvailableVariables(variableData);
    } catch (error) {
      console.error('fetch available variables failed:', error);
      setAvailableVariables({ environmentVariables: [], agentRoles: [] });
    }
  };

  // 不再需要获取规则集

  useEffect(() => {
    fetchObservers();
  }, [actionSpaceId]);

  useEffect(() => {
    if (modalVisible) {
      fetchAvailableRoles();
    }
  }, [modalVisible]);

  useEffect(() => {
    if (settingsModalVisible) {
      fetchAvailableVariables();
    }
  }, [settingsModalVisible]);

  // 添加监督者
  const handleAddObserver = () => {
    form.resetFields();
    setEditingObserver(null);
    setModalVisible(true);
  };

  // 编辑监督者
  const handleEditObserver = (observer) => {
    setEditingObserver(observer);
    form.setFieldsValue({
      role_id: observer.id.toString(),
      additional_prompt: observer.additional_prompt || ''
    });
    setModalVisible(true);
  };

  // 删除监督者
  const handleDeleteObserver = async (observerId) => {
    try {
      await actionSpaceAPI.deleteObserver(actionSpaceId, observerId);
      message.success(t('observer.deleted'));
      fetchObservers();
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('delete observer failed:', error);
      message.error(t('observer.deleteFailed'));
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingObserver) {
        // 更新监督者
        await actionSpaceAPI.updateObserver(
          actionSpaceId,
          editingObserver.id,
          {
            additional_prompt: values.additional_prompt
          }
        );
        message.success(t('observer.updated'));
      } else {
        // 添加监督者
        await actionSpaceAPI.addObserver(
          actionSpaceId,
          {
            role_id: values.role_id,
            additional_prompt: values.additional_prompt
          }
        );
        message.success(t('observer.added'));
      }

      setModalVisible(false);
      fetchObservers();
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('submit observer failed:', error);
      message.error(t('observer.submitFailed'));
    }
  };

  // 确保布尔值的辅助函数
  const ensureBoolean = (value, defaultValue = false) => {
    // 如果是明确的布尔值，直接返回
    if (typeof value === 'boolean') {
      return value;
    }
    // 如果是字符串或数字形式的布尔值，转换后返回
    if (value === 'true' || value === 1) {
      return true;
    }
    if (value === 'false' || value === 0) {
      return false;
    }
    // 如果是undefined或null，返回默认值
    if (value === undefined || value === null) {
      return defaultValue;
    }
    // 其他情况返回默认值
    return defaultValue;
  };

  // 配置监督者设置
  const handleConfigureObserver = (observer) => {
    setConfiguringObserver(observer);

    // 获取当前监督者的设置
    const currentSettings = observer.settings?.supervision;



    // 如果没有设置，使用默认值；如果有设置，直接使用
    let formValues;
    if (!currentSettings) {
      // 新监督者，使用默认值
      const defaultSettings = getDefaultSupervisionSettings();
      formValues = {
        supervision_mode: defaultSettings.supervision_mode,
        after_each_agent: ensureBoolean(defaultSettings.triggers.after_each_agent),
        after_each_round: ensureBoolean(defaultSettings.triggers.after_each_round),
        on_rule_violation: ensureBoolean(defaultSettings.triggers.on_rule_violation),
        variable_conditions: defaultSettings.variable_conditions,
        condition_logic: defaultSettings.condition_logic,
        check_interval: defaultSettings.check_interval,
        threshold: defaultSettings.intervention_settings.threshold,
        max_interventions_per_round: defaultSettings.intervention_settings.max_interventions_per_round,
        intervention_mode: defaultSettings.intervention_settings.intervention_mode,
        rule_compliance: true,  // 始终启用规则遵守监控
        conversation_quality: false,  // 待实现功能，暂时关闭
        task_progress: false,  // 待实现功能，暂时关闭
        agent_behavior: false,  // 待实现功能，暂时关闭
        generate_summary: ensureBoolean(defaultSettings.reporting.generate_summary, true),
        log_interventions: ensureBoolean(defaultSettings.reporting.log_interventions, true),
        alert_on_issues: ensureBoolean(defaultSettings.reporting.alert_on_issues, true)
      };
    } else {
      // 已有设置，直接解析并确保布尔值类型
      formValues = {
        supervision_mode: currentSettings.supervision_mode,
        after_each_agent: ensureBoolean(currentSettings.triggers?.after_each_agent),
        after_each_round: ensureBoolean(currentSettings.triggers?.after_each_round),
        on_rule_violation: ensureBoolean(currentSettings.triggers?.on_rule_violation),
        variable_conditions: Array.isArray(currentSettings.variable_conditions)
          ? currentSettings.variable_conditions.filter(condition =>
              condition && typeof condition === 'object' &&
              condition.type && condition.variable && condition.operator && condition.value
            )
          : [],
        condition_logic: currentSettings.condition_logic || 'and',
        check_interval: currentSettings.check_interval,
        threshold: currentSettings.intervention_settings?.threshold,
        max_interventions_per_round: currentSettings.intervention_settings?.max_interventions_per_round,
        intervention_mode: currentSettings.intervention_settings?.intervention_mode,
        rule_compliance: true,  // 始终启用规则遵守监控
        conversation_quality: false,  // 待实现功能，暂时关闭
        task_progress: false,  // 待实现功能，暂时关闭
        agent_behavior: false,  // 待实现功能，暂时关闭
        generate_summary: ensureBoolean(currentSettings.reporting?.generate_summary),
        log_interventions: ensureBoolean(currentSettings.reporting?.log_interventions),
        alert_on_issues: ensureBoolean(currentSettings.reporting?.alert_on_issues)
      };

    }

    // 设置当前监督模式（用于UI显示）
    setCurrentSupervisionMode(formValues.supervision_mode);

    // 存储表单值到状态
    setCurrentFormValues(formValues);

    // 显示模态框
    setSettingsModalVisible(true);


  };

  // 处理监督模式变化
  const handleSupervisionModeChange = (mode) => {
    setCurrentSupervisionMode(mode);

    // 根据监督模式自动设置相关触发条件
    const currentValues = settingsForm.getFieldsValue();
    const updates: any = { supervision_mode: mode };

    switch (mode) {
      case 'immediate':
        updates.after_each_agent = true;
        updates.after_each_round = false;
        updates.on_rule_violation = false;
        break;
      case 'round_based':
        updates.after_each_agent = false;
        updates.after_each_round = true;
        updates.on_rule_violation = true;
        break;
      case 'variable_based':
        // 变量监督模式不使用传统触发条件
        updates.after_each_agent = false;
        updates.after_each_round = false;
        updates.on_rule_violation = false;
        break;
      default:
        break;
    }

    settingsForm.setFieldsValue({ ...currentValues, ...updates });
  };

  // 获取默认监督设置
  const getDefaultSupervisionSettings = () => {
    return {
      supervision_mode: "round_based",
      triggers: {
        after_each_agent: false,
        after_each_round: true,
        on_rule_violation: true
      },
      variable_conditions: [],
      condition_logic: 'and',
      check_interval: 60,
      intervention_settings: {
        threshold: 0.7,  // 默认平衡阈值
        max_interventions_per_round: 1,  // 保守的干预次数
        intervention_mode: "passive"  // 默认被动响应模式
      },
      monitoring_scope: {
        rule_compliance: true,  // 始终启用规则遵守监控
        conversation_quality: false,  // 待实现功能，暂时关闭
        task_progress: false,  // 待实现功能，暂时关闭
        agent_behavior: false  // 待实现功能，暂时关闭
      },
      reporting: {
        generate_summary: true,
        log_interventions: true,
        alert_on_issues: true
      }
    };
  };

  // 提交监督者设置
  const handleSubmitSettings = async () => {
    try {
      const values = await settingsForm.validateFields();

      // 构建设置对象 - 确保布尔值类型正确
      const supervisionSettings = {
        supervision_mode: values.supervision_mode,
        triggers: {
          after_each_agent: ensureBoolean(values.after_each_agent),
          after_each_round: ensureBoolean(values.after_each_round),
          on_rule_violation: ensureBoolean(values.on_rule_violation)
        },
        variable_conditions: values.variable_conditions || [],
        condition_logic: values.condition_logic || 'and',
        check_interval: values.check_interval || 60,
        intervention_settings: {
          threshold: values.threshold,
          max_interventions_per_round: values.max_interventions_per_round,
          intervention_mode: values.intervention_mode
        },
        monitoring_scope: {
          rule_compliance: true,  // 始终启用规则遵守监控
          conversation_quality: false,  // 待实现功能，暂时关闭
          task_progress: false,  // 待实现功能，暂时关闭
          agent_behavior: false  // 待实现功能，暂时关闭
        },
        reporting: {
          generate_summary: ensureBoolean(values.generate_summary),
          log_interventions: ensureBoolean(values.log_interventions),
          alert_on_issues: ensureBoolean(values.alert_on_issues)
        }
      };

      // 更新监督者设置
      const currentSettings = configuringObserver.settings || {};
      const updatedSettings = {
        ...currentSettings,
        supervision: supervisionSettings
      };

      await actionSpaceAPI.updateObserver(
        actionSpaceId,
        configuringObserver.id,
        {
          settings: updatedSettings
        }
      );

      message.success(t('observer.settingsUpdated'));
      setSettingsModalVisible(false);
      setCurrentFormValues(null);
      fetchObservers();
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('update observer settings failed:', error);
      message.error(t('observer.settingsUpdateFailed'));
    }
  };

  // helper: supervision-mode display name
  const getModeName = (mode) => {
    const modeMap = {
      'immediate': t('observer.mode.immediate'),
      'round_based': t('observer.mode.roundBased'),
      'variable_based': t('observer.mode.conditional')
    };
    return modeMap[mode] || mode;
  };

  // helper: trigger-timing description
  const getTriggerDescription = (mode) => {
    const descMap = {
      'immediate': t('observer.trigger.immediate'),
      'round_based': t('observer.trigger.roundBased'),
      'variable_based': t('observer.trigger.variableBased')
    };
    return descMap[mode] || '';
  };

  // helper: intervention-mode display name
  const getInterventionName = (mode) => {
    const nameMap = {
      'passive': t('observer.intervention.passive'),
      'alert': t('observer.intervention.alert'),
      'intervene': t('observer.intervention.intervene')
    };
    return nameMap[mode] || mode;
  };

  // 辅助函数：获取干预模式颜色
  const getInterventionColor = (mode) => {
    const colorMap = {
      'passive': 'default',
      'alert': 'warning',
      'intervene': 'error'
    };
    return colorMap[mode] || 'default';
  };

  // helper: intervention-mode detailed description
  const getInterventionActionDesc = (mode) => {
    const descMap = {
      'passive': t('observer.intervention.desc.passive'),
      'alert': t('observer.intervention.desc.alert'),
      'intervene': t('observer.intervention.desc.intervene')
    };
    return descMap[mode] || '';
  };

  // helper: threshold description
  const getThresholdDescription = (value) => {
    if (value <= 0.5) return t('observer.threshold.desc.aggressive');
    if (value <= 0.7) return t('observer.threshold.desc.balanced');
    return t('observer.threshold.desc.cautious');
  };

  // helper: threshold level name
  const getThresholdLevel = (value) => {
    if (value <= 0.5) return t('observer.threshold.aggressive');
    if (value <= 0.7) return t('observer.threshold.balanced');
    return t('observer.threshold.cautious');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>{t('observer.title')}</Title>
          <Paragraph style={{ margin: 0, marginTop: 8 }}>
            {t('observer.intro')}
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddObserver}
        >
          {t('observer.add')}
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      ) : observers.length > 0 ? (
        <Table
            dataSource={observers}
            rowKey="id"
            columns={[
              { title: t('observer.col.name'), dataIndex: 'name', key: 'name', width: '20%' },
              {
                title: t('observer.col.extraPrompt'),
                dataIndex: 'additional_prompt',
                key: 'additional_prompt',
                ellipsis: true,
                width: '50%',
                render: (text) => text || t('observer.col.none')
              },
              {
                title: t('observer.col.supervisionMode'),
                key: 'supervision_mode',
                width: '15%',
                render: (_, record) => {
                  const mode = record.settings?.supervision?.supervision_mode || 'round_based';
                  const modeMap = {
                    'immediate': t('observer.mode.immediate'),
                    'round_based': t('observer.mode.roundBased'),
                    'variable_based': t('observer.mode.variableBased')
                  };
                  return <Tag color="blue">{modeMap[mode] || t('observer.mode.roundBased')}</Tag>;
                }
              },
              {
                title: t('observer.col.actions'),
                key: 'action',
                width: '25%',
                render: (_, record) => (
                  <Space>
                    <Button
                      type="link"

                      icon={<SettingOutlined />}
                      onClick={() => handleConfigureObserver(record)}
                    >
                      {t('observer.action.configure')}
                    </Button>
                    <Button type="link" onClick={() => handleEditObserver(record)}>
                      {t('observer.action.edit')}
                    </Button>
                    <Button type="link" danger onClick={() => handleDeleteObserver(record.id)}>
                      {t('observer.action.delete')}
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        ) : (
          <Empty description={t('observer.empty')} />
        )}

      {/* observer form modal */}
      <Modal
        title={editingObserver ? t('observer.form.title.edit') : t('observer.form.title.add')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
        >
          {editingObserver ? (
            <Form.Item
              name="role_id"
              label={t('observer.form.role')}
              rules={[{ required: true, message: t('observer.form.roleRequired') }]}
            >
              <Select
                placeholder={t('observer.form.rolePlaceholder')}
                optionFilterProp="children"
                showSearch
                disabled={true}
              >
                {availableRoles.map(role => (
                  <Option key={role.id} value={role.id.toString()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{role.name}</span>
                      <Tag
                        color={role.source === 'external' ? 'orange' : 'blue'}
                      >
                        {role.source === 'external' ? t('observer.form.sourceExternal') : t('observer.form.sourceInternal')}
                      </Tag>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item
              name="role_id"
              label={t('observer.form.role')}
              rules={[{ required: true, message: t('observer.form.roleRequired') }]}
            >
              <Select
                placeholder={t('observer.form.rolePlaceholder')}
                optionFilterProp="children"
                showSearch
              >
                {availableRoles.map(role => (
                  <Option key={role.id} value={role.id.toString()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{role.name} {role.is_observer_role ? t('observer.form.observerSuffix') : ''}</span>
                      <Tag
                        color={role.source === 'external' ? 'orange' : 'blue'}
                      >
                        {role.source === 'external' ? t('observer.form.sourceExternal') : t('observer.form.sourceInternal')}
                      </Tag>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="additional_prompt"
            label={t('observer.form.extraPrompt')}
            extra={t('observer.form.extraPromptExtra')}
          >
            <TextArea
              rows={6}
              placeholder={t('observer.form.extraPromptPlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* observer config modal */}
      <Modal
        title={t('observer.config.title', { name: configuringObserver?.name || '' })}
        open={settingsModalVisible}
        onCancel={() => {
          setSettingsModalVisible(false);
          settingsForm.resetFields();
          setCurrentSupervisionMode('round_based');
          setCurrentFormValues(null);
        }}
        onOk={handleSubmitSettings}
        width={1200}
        style={{ top: 20 }}
        afterOpenChange={(open) => {
          if (open && currentFormValues) {
            // 模态框完全打开后设置表单值
            setTimeout(() => {
              settingsForm.setFieldsValue(currentFormValues);

              // 如果有变量条件，强制刷新Form.List和condition_logic
              if (currentFormValues.variable_conditions && currentFormValues.variable_conditions.length > 0) {
                setTimeout(() => {
                  settingsForm.setFieldsValue({
                    variable_conditions: currentFormValues.variable_conditions,
                    condition_logic: currentFormValues.condition_logic
                  });
                }, 100);
              }
            }, 50);
          }
        }}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          preserve={false}
        >
          {/* 监督流程说明 */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.supervision_mode !== currentValues.supervision_mode ||
              prevValues.threshold !== currentValues.threshold ||
              prevValues.intervention_mode !== currentValues.intervention_mode
            }
          >
            {({ getFieldValue }) => {
              const mode = getFieldValue('supervision_mode') || currentSupervisionMode;
              const threshold = getFieldValue('threshold') || 0.7;
              const interventionMode = getFieldValue('intervention_mode') || 'passive';
              
              return (
                <Card 
                  
                  style={{ marginBottom: 16, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <InfoCircleOutlined style={{ color: '#52c41a', marginRight: 8, fontSize: '16px' }} />
                    <Text strong style={{ fontSize: '14px' }}>{t('observer.config.flow.title')}</Text>
                  </div>
                  <Steps

                    current={-1}
                    items={[
                      {
                        title: t('observer.config.flow.trigger'),
                        description: getTriggerDescription(mode),
                        icon: <ClockCircleOutlined style={{ color: '#1677ff' }} />
                      },
                      {
                        title: t('observer.config.flow.ruleEval'),
                        description: t('observer.config.flow.ruleEvalDesc'),
                        icon: <FileSearchOutlined style={{ color: '#722ed1' }} />
                      },
                      {
                        title: t('observer.config.flow.decide'),
                        description: t('observer.config.flow.decideDesc', { threshold }),
                        icon: <CheckCircleOutlined style={{ color: '#fa8c16' }} />
                      },
                      {
                        title: t('observer.config.flow.execute'),
                        description: getInterventionActionDesc(interventionMode),
                        icon: <ThunderboltOutlined style={{ color: '#52c41a' }} />
                      }
                    ]}
                  />
                </Card>
              );
            }}
          </Form.Item>
          <Row gutter={[24, 24]}>
            {/* 基本设置卡片 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <SettingOutlined style={{ color: '#1677ff' }} />
                    <span>{t('observer.basic.title')}</span>
                  </Space>
                }
                style={{
                  borderRadius: '12px',
                  border: '1px solid #1677ff20',
                  height: '100%'
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <Form.Item
                  name="supervision_mode"
                  label={
                    <Space>
                      <span>{t('observer.basic.supervisionMode')}</span>
                      <Tooltip
                        title={
                          <div>
                            <div><strong>{t('observer.basic.modeTip.title')}</strong>{t('observer.basic.modeTip.intro')}</div>
                            <br />
                            <div><strong>{t('observer.basic.modeTip.immediateTitle')}</strong></div>
                            <div>• {t('observer.basic.modeTip.immediate1')}</div>
                            <div>• {t('observer.basic.modeTip.immediate2')}</div>
                            <br />
                            <div><strong>{t('observer.basic.modeTip.roundTitle')}</strong></div>
                            <div>• {t('observer.basic.modeTip.round1')}</div>
                            <div>• {t('observer.basic.modeTip.round2')}</div>
                            <br />
                            <div><strong>{t('observer.basic.modeTip.variableTitle')}</strong></div>
                            <div>• {t('observer.basic.modeTip.variable1')}</div>
                            <div>• {t('observer.basic.modeTip.variable2')}</div>
                            <div>• {t('observer.basic.modeTip.variable3')}</div>
                          </div>
                        }
                      >
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: t('observer.basic.modeRequired') }]}
                >
                  <Select
                    placeholder={t('observer.basic.modePlaceholder')}
                    onChange={handleSupervisionModeChange}
                    optionLabelProp="label"
                  >
                    <Option value="immediate" label={t('observer.basic.option.immediate.title')}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{t('observer.basic.option.immediate.title')}</div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                          {t('observer.basic.option.immediate.desc')}
                        </div>
                      </div>
                    </Option>
                    <Option
                      value="round_based"
                      label={<span>{t('observer.basic.option.round.title')} <Tag color="green">{t('observer.mode.recommended')}</Tag></span>}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{t('observer.basic.option.round.title')} <Tag color="green">{t('observer.mode.recommended')}</Tag></div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                          {t('observer.basic.option.round.desc')}
                        </div>
                      </div>
                    </Option>
                    <Option
                      value="variable_based"
                      label={t('observer.basic.option.conditional.title')}
                      disabled={
                        !availableVariables.environmentVariables?.length &&
                        !availableVariables.agentRoles?.length
                      }
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{t('observer.basic.option.conditional.title')}</div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                          {(!availableVariables.environmentVariables?.length && !availableVariables.agentRoles?.length)
                            ? t('observer.basic.option.conditional.descEmpty')
                            : t('observer.basic.option.conditional.descNormal')}
                        </div>
                      </div>
                    </Option>
                  </Select>
                </Form.Item>

                {/* 只在变量监督模式下显示变量条件配置 */}
                {currentSupervisionMode === 'variable_based' && (
                  <>
                    <Divider>{t('observer.var.divider')}</Divider>

                    <Form.Item label={t('observer.var.label')}>
                      <Form.List name="variable_conditions">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(field => (
                              <div key={field.key} style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
                                <Form.Item
                                  name={[field.name, 'type']}
                                  style={{ width: '25%', marginBottom: 0 }}
                                >
                                  <Select
                                    placeholder={t('observer.var.typePlaceholder')}
                                    onChange={() => {
                                      // 当变量类型改变时，清空变量选择
                                      settingsForm.setFieldsValue({
                                        variable_conditions: {
                                          ...settingsForm.getFieldValue('variable_conditions'),
                                          [field.name]: {
                                            ...settingsForm.getFieldValue(['variable_conditions', field.name]),
                                            variable: undefined
                                          }
                                        }
                                      });
                                    }}
                                  >
                                    <Select.Option value="environment">{t('observer.var.typeEnv')}</Select.Option>
                                    <Select.Option value="agent">{t('observer.var.typeAgent')}</Select.Option>
                                  </Select>
                                </Form.Item>

                                <Form.Item
                                  noStyle
                                  shouldUpdate={(prevValues, currentValues) => {
                                    const prevType = prevValues?.variable_conditions?.[field.name]?.type;
                                    const currentType = currentValues?.variable_conditions?.[field.name]?.type;
                                    return prevType !== currentType;
                                  }}
                                >
                                  {({ getFieldValue }) => {
                                    const varType = getFieldValue(['variable_conditions', field.name, 'type']);
                                    return (
                                      <Form.Item
                                        name={[field.name, 'variable']}
                                        style={{ width: '30%', marginBottom: 0 }}
                                      >
                                        <Select
                                          placeholder={t('observer.var.namePlaceholder')}
                                          showSearch
                                          disabled={!varType}
                                        >
                                          {varType === 'environment' && availableVariables.environmentVariables?.map(variable => (
                                            <Select.Option key={variable.name} value={variable.name}>
                                              {variable.displayName}
                                            </Select.Option>
                                          ))}
                                          {varType === 'agent' && availableVariables.agentRoles?.map(role => (
                                            <Select.OptGroup key={role.id} label={role.name}>
                                              {role.variables?.map(variable => (
                                                <Select.Option key={`${role.id}-${variable.name}`} value={variable.fullName}>
                                                  {variable.displayName}
                                                </Select.Option>
                                              ))}
                                            </Select.OptGroup>
                                          ))}
                                        </Select>
                                      </Form.Item>
                                    );
                                  }}
                                </Form.Item>

                                <Form.Item
                                  name={[field.name, 'operator']}
                                  style={{ width: '15%', marginBottom: 0 }}
                                >
                                  <Select placeholder={t('observer.var.opPlaceholder')}>
                                    <Select.Option value=">">&gt;</Select.Option>
                                    <Select.Option value=">=">&gt;=</Select.Option>
                                    <Select.Option value="=">=</Select.Option>
                                    <Select.Option value="<=">&lt;=</Select.Option>
                                    <Select.Option value="<">&lt;</Select.Option>
                                    <Select.Option value="!=">!=</Select.Option>
                                  </Select>
                                </Form.Item>

                                <Form.Item
                                  name={[field.name, 'value']}
                                  style={{ width: '20%', marginBottom: 0 }}
                                >
                                  <Input placeholder={t('observer.var.targetPlaceholder')} />
                                </Form.Item>

                                <Button
                                  onClick={() => remove(field.name)}
                                  icon={<DeleteOutlined />}
                                  type="text"
                                  danger
                                  style={{ height: '32px' }}
                                />
                              </div>
                            ))}

                            <Form.Item>
                              <Button
                                type="dashed"
                                onClick={() => add()}
                                block
                                icon={<PlusOutlined />}
                              >
                                {t('observer.var.addCondition')}
                              </Button>
                            </Form.Item>


                          </>
                        )}
                      </Form.List>
                    </Form.Item>

                    {/* 逻辑条件选择 - 只在有多个变量条件时显示 */}
                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, currentValues) => {
                        const prevConditions = prevValues?.variable_conditions || [];
                        const currentConditions = currentValues?.variable_conditions || [];
                        return prevConditions.length !== currentConditions.length;
                      }}
                    >
                      {({ getFieldValue }) => {
                        const conditions = getFieldValue('variable_conditions') || [];
                        return conditions.length > 1 ? (
                          <Form.Item
                            name="condition_logic"
                            style={{ marginTop: 16 }}
                          >
                            <Radio.Group>
                              <Radio value="and">{t('observer.var.logicAnd')}</Radio>
                              <Radio value="or">{t('observer.var.logicOr')}</Radio>
                            </Radio.Group>
                          </Form.Item>
                        ) : null;
                      }}
                    </Form.Item>

                    <Form.Item
                      name="check_interval"
                      label={
                        <Space>
                          <span>{t('observer.var.checkInterval')}</span>
                          <Tooltip title={t('observer.var.checkIntervalTip')}>
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      initialValue={60}
                      rules={[
                        { required: true, message: t('observer.var.checkIntervalRequired') },
                        { type: 'number', min: 10, max: 3600, message: t('observer.var.checkIntervalRange') }
                      ]}
                    >
                      <InputNumber
                        min={10}
                        max={3600}
                        style={{ width: '100%' }}
                        addonAfter={t('observer.var.seconds')}
                      />
                    </Form.Item>
                  </>
                )}
              </Card>
            </Col>

            {/* 干预设置卡片 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <EditOutlined style={{ color: '#fa8c16' }} />
                    <span>{t('observer.intervene.title')}</span>
                  </Space>
                }
                style={{
                  borderRadius: '12px',
                  border: '1px solid #fa8c1620',
                  height: '100%'
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <Form.Item
                  name="intervention_mode"
                  label={
                    <Space>
                      <span>{t('observer.intervene.modeLabel')}</span>
                      <Tooltip
                        title={
                          <div>
                            <div><strong>{t('observer.intervene.modeLabel')}</strong> — {t('observer.intervene.tip.intro')}</div>
                            <br />
                            <div><strong>{t('observer.intervene.tip.passiveTitle')}</strong></div>
                            <div>• {t('observer.intervene.tip.passive1')}</div>
                            <div>• {t('observer.intervene.tip.passive2')}</div>
                            <div>• {t('observer.intervene.tip.passive3')}</div>
                            <br />
                            <div><strong>{t('observer.intervene.tip.alertTitle')}</strong></div>
                            <div>• {t('observer.intervene.tip.alert1')}</div>
                            <div>• {t('observer.intervene.tip.alert2')}</div>
                            <div>• {t('observer.intervene.tip.alert3')}</div>
                            <br />
                            <div><strong>{t('observer.intervene.tip.interveneTitle')}</strong></div>
                            <div>• {t('observer.intervene.tip.intervene1')}</div>
                            <div>• {t('observer.intervene.tip.intervene2')}</div>
                            <div>• {t('observer.intervene.tip.intervene3')}</div>
                          </div>
                        }
                      >
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: t('observer.intervene.modeRequired') }]}
                >
                  <Select
                    placeholder={t('observer.intervene.modePlaceholder')}
                    optionLabelProp="label"
                  >
                    <Option value="passive" label={t('observer.intervene.option.passive.title')}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          <Badge status="default" /> {t('observer.intervene.option.passive.title')}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
                          {t('observer.intervene.option.passive.desc')}
                        </div>
                      </div>
                    </Option>
                    <Option
                      value="alert"
                      label={<span><Badge status="warning" /> {t('observer.intervene.option.alert.title')} <Tag color="green">{t('observer.mode.recommended')}</Tag></span>}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          <Badge status="warning" /> {t('observer.intervene.option.alert.title')} <Tag color="green">{t('observer.mode.recommended')}</Tag>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
                          {t('observer.intervene.option.alert.desc')}
                        </div>
                      </div>
                    </Option>
                    <Option
                      value="intervene"
                      label={<span><Badge status="error" /> {t('observer.intervene.option.intervene.title')} <Tag color="orange" icon={<ExclamationCircleOutlined />}>{t('observer.intervention.cautious')}</Tag></span>}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          <Badge status="error" /> {t('observer.intervene.option.intervene.title')} <Tag color="orange" icon={<ExclamationCircleOutlined />}>{t('observer.intervention.cautious')}</Tag>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
                          {t('observer.intervene.option.intervene.desc')}
                        </div>
                      </div>
                    </Option>
                  </Select>
                </Form.Item>

                {/* 干预阈值 - 在"主动记录"或"任务干预"时显示 */}
                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) => 
                    prevValues.intervention_mode !== currentValues.intervention_mode ||
                    prevValues.threshold !== currentValues.threshold
                  }
                >
                  {({ getFieldValue }) => {
                    const interventionMode = getFieldValue('intervention_mode');
                    const needThreshold = interventionMode !== 'passive'; // 被动响应不需要阈值
                    const thresholdValue = getFieldValue('threshold') || 0.7;
                    
                    return needThreshold ? (
                      <Form.Item
                        name="threshold"
                        label={
                          <Space>
                            <span>{t('observer.thresholdLabel')}</span>
                            <Tooltip
                              title={
                                <div>
                                  <div><strong>{t('observer.thresholdLabel')}</strong> — {t('observer.threshold.tip.intro')}</div>
                                  <br />
                                  <div><strong>{t('observer.threshold.tip.current', { value: thresholdValue, level: getThresholdLevel(thresholdValue) })}</strong></div>
                                  <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
                                    {getThresholdDescription(thresholdValue)}
                                  </div>
                                  <br />
                                  <div><strong>{t('observer.threshold.tip.howTitle')}</strong></div>
                                  <div>• {t('observer.threshold.tip.how1')}</div>
                                  <div>• {t('observer.threshold.tip.how2')}</div>
                                  <div>• {t('observer.threshold.tip.how3')}</div>
                                  <div>• {t('observer.threshold.tip.how4')}</div>
                                  <br />
                                  <div><strong>{t('observer.threshold.tip.levelTitle')}</strong></div>
                                  <div>• {t('observer.threshold.tip.level1')}</div>
                                  <div>• {t('observer.threshold.tip.level2')}</div>
                                  <div>• {t('observer.threshold.tip.level3')}</div>
                                </div>
                              }
                            >
                              <QuestionCircleOutlined />
                            </Tooltip>
                          </Space>
                        }
                        rules={[{ required: true, message: t('observer.thresholdRequired') }]}
                        style={{ marginTop: 16 }}
                      >
                        <Slider
                          min={0.5}
                          max={0.9}
                          step={null}
                          marks={{
                            0.5: t('observer.threshold.aggressive'),
                            0.7: t('observer.threshold.balanced'),
                            0.9: t('observer.threshold.cautious')
                          }}
                          tooltip={{
                            formatter: (value) => `${value} - ${getThresholdLevel(value)}`
                          }}
                        />
                      </Form.Item>
                    ) : null;
                  }}
                </Form.Item>

                <Form.Item
                  name="max_interventions_per_round"
                  label={
                    <Space>
                      <span>{t('observer.maxPerRound')}</span>
                      <Tooltip title={t('observer.maxPerRoundTip')}>
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: t('observer.maxPerRoundRequired') }]}
                >
                  <InputNumber
                    min={1}
                    max={10}
                    placeholder="1"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Card>
            </Col>

            {/* 监控范围卡片 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <EyeOutlined style={{ color: '#722ed1' }} />
                    <span>{t('observer.scope.title')}</span>
                  </Space>
                }
                style={{
                  borderRadius: '12px',
                  border: '1px solid #722ed120',
                  height: '100%'
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="rule_compliance"
                      valuePropName="checked"
                      style={{ marginBottom: 16 }}
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{t('observer.scope.ruleCompliance')}</span>
                          <Tag color="blue">{t('observer.scope.required')}</Tag>
                          <Tooltip title={t('observer.scope.ruleComplianceTip')}>
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </div>
                      }
                    >
                      <Switch checked={true} disabled={true} />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="conversation_quality"
                      valuePropName="checked"
                      style={{ marginBottom: 16 }}
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{t('observer.scope.conversationQuality')}</span>
                          <Tag color="orange" style={{ marginLeft: 4 }}>{t('observer.scope.todo')}</Tag>
                          <Tooltip title={t('observer.scope.conversationQualityTip')}>
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </div>
                      }
                    >
                      <Switch checked={false} disabled={true} />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="task_progress"
                      valuePropName="checked"
                      style={{ marginBottom: 16 }}
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{t('observer.scope.taskProgress')}</span>
                          <Tag color="orange" style={{ marginLeft: 4 }}>{t('observer.scope.todo')}</Tag>
                          <Tooltip title={t('observer.scope.taskProgressTip')}>
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </div>
                      }
                    >
                      <Switch checked={false} disabled={true} />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="agent_behavior"
                      valuePropName="checked"
                      style={{ marginBottom: 16 }}
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{t('observer.scope.agentBehavior')}</span>
                          <Tag color="orange" style={{ marginLeft: 4 }}>{t('observer.scope.todo')}</Tag>
                          <Tooltip title={t('observer.scope.agentBehaviorTip')}>
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </div>
                      }
                    >
                      <Switch checked={false} disabled={true} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* 报告设置卡片 */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <InfoCircleOutlined style={{ color: '#eb2f96' }} />
                    <span>{t('observer.report.title')}</span>
                  </Space>
                }
                style={{
                  borderRadius: '12px',
                  border: '1px solid #eb2f9620',
                  height: '100%'
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="generate_summary"
                      valuePropName="checked"
                      style={{ marginBottom: 16 }}
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{t('observer.report.generateSummary')}</span>
                          <Tooltip title={t('observer.report.generateSummaryTip')}>
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </div>
                      }
                    >
                      <Switch />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="log_interventions"
                      valuePropName="checked"
                      style={{ marginBottom: 16 }}
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{t('observer.report.logInterventions')}</span>
                          <Tooltip title={t('observer.report.logInterventionsTip')}>
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </div>
                      }
                    >
                      <Switch />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="alert_on_issues"
                      valuePropName="checked"
                      style={{ marginBottom: 16 }}
                      label={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{t('observer.report.alertOnIssues')}</span>
                          <Tooltip title={t('observer.report.alertOnIssuesTip')}>
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </div>
                      }
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default ObserverManagement;
