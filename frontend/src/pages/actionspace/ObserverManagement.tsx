// ObserverManagement.js
// 此文件包含行动空间监督者管理组件

import React, { useState, useEffect } from 'react';
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
      console.error('获取监督者失败:', error);
      message.error('获取监督者失败');
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
      console.error('获取可用角色失败:', error);
      message.error('获取可用角色失败');
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
        console.warn('获取行动空间环境变量失败:', error);
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
        console.warn('获取角色变量失败:', error);
      }

      setAvailableVariables(variableData);
    } catch (error) {
      console.error('获取可用变量失败:', error);
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
      message.success('监督者已删除');
      fetchObservers();
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('删除监督者失败:', error);
      message.error('删除监督者失败');
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
        message.success('监督者已更新');
      } else {
        // 添加监督者
        await actionSpaceAPI.addObserver(
          actionSpaceId,
          {
            role_id: values.role_id,
            additional_prompt: values.additional_prompt
          }
        );
        message.success('监督者已添加');
      }

      setModalVisible(false);
      fetchObservers();
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('提交监督者失败:', error);
      message.error('提交监督者失败');
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

      message.success('监督者设置已更新');
      setSettingsModalVisible(false);
      setCurrentFormValues(null);
      fetchObservers();
      if (onDataChange) onDataChange();
    } catch (error) {
      console.error('更新监督者设置失败:', error);
      message.error('更新监督者设置失败');
    }
  };

  // 辅助函数：获取监督方式名称
  const getModeName = (mode) => {
    const modeMap = {
      'immediate': '即时监督',
      'round_based': '轮次监督',
      'variable_based': '条件监督'
    };
    return modeMap[mode] || mode;
  };

  // 辅助函数：获取触发时机描述
  const getTriggerDescription = (mode) => {
    const descMap = {
      'immediate': '每个智能体回复后立即检查',
      'round_based': '每轮对话结束后统一检查',
      'variable_based': '当指定变量达到条件时检查'
    };
    return descMap[mode] || '';
  };

  // 辅助函数：获取干预模式名称
  const getInterventionName = (mode) => {
    const nameMap = {
      'passive': '被动响应',
      'alert': '主动记录',
      'intervene': '任务干预'
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

  // 辅助函数：获取干预模式的详细描述
  const getInterventionActionDesc = (mode) => {
    const descMap = {
      'passive': '仅在监督会话中被动响应用户消息',
      'alert': '规则违规时在监督会话中主动记录',
      'intervene': '规则违规且达到阈值时直接在任务会话中干预'
    };
    return descMap[mode] || '';
  };

  // 辅助函数：获取阈值描述
  const getThresholdDescription = (value) => {
    if (value <= 0.5) return '监督者会频繁介入，即使是轻微的问题也会触发';
    if (value <= 0.7) return '监督者会在发现明显问题时介入，适合一般场景';
    return '监督者只在发现严重问题时才会介入，适合探索性任务';
  };

  // 辅助函数：获取阈值档位名称
  const getThresholdLevel = (value) => {
    if (value <= 0.5) return '积极';
    if (value <= 0.7) return '平衡';
    return '谨慎';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>行动空间监督者</Title>
          <Paragraph style={{ margin: 0, marginTop: 8 }}>
            监督者是特殊的智能体角色，用于监控和评估其他智能体的行为。监督者可以根据规则集对智能体的行为进行评估，并在必要时进行干预。
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddObserver}
        >
          添加监督者
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
              { title: '监督者名称', dataIndex: 'name', key: 'name', width: '20%' },
              {
                title: '额外提示词',
                dataIndex: 'additional_prompt',
                key: 'additional_prompt',
                ellipsis: true,
                width: '50%',
                render: (text) => text || '无'
              },
              {
                title: '监督模式',
                key: 'supervision_mode',
                width: '15%',
                render: (_, record) => {
                  const mode = record.settings?.supervision?.supervision_mode || 'round_based';
                  const modeMap = {
                    'immediate': '即时监督',
                    'round_based': '轮次监督',
                    'variable_based': '变量监督'
                  };
                  return <Tag color="blue">{modeMap[mode] || '轮次监督'}</Tag>;
                }
              },
              {
                title: '操作',
                key: 'action',
                width: '25%',
                render: (_, record) => (
                  <Space>
                    <Button
                      type="link"
                     
                      icon={<SettingOutlined />}
                      onClick={() => handleConfigureObserver(record)}
                    >
                      配置
                    </Button>
                    <Button type="link" onClick={() => handleEditObserver(record)}>
                      编辑
                    </Button>
                    <Button type="link" danger onClick={() => handleDeleteObserver(record.id)}>
                      删除
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        ) : (
          <Empty description="暂无监督者" />
        )}

      {/* 监督者表单对话框 */}
      <Modal
        title={`${editingObserver ? '编辑' : '添加'}监督者`}
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
            // 编辑模式 - 不允许更改角色
            <Form.Item
              name="role_id"
              label="选择角色"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select
                placeholder="选择角色"
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
                        {role.source === 'external' ? '外部' : '内部'}
                      </Tag>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            // 添加模式 - 可以选择角色
            <Form.Item
              name="role_id"
              label="选择角色"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select
                placeholder="选择角色"
                optionFilterProp="children"
                showSearch
              >
                {availableRoles.map(role => (
                  <Option key={role.id} value={role.id.toString()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{role.name} {role.is_observer_role ? '(监督者)' : ''}</span>
                      <Tag
                        color={role.source === 'external' ? 'orange' : 'blue'}
                       
                      >
                        {role.source === 'external' ? '外部' : '内部'}
                      </Tag>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 移除规则集选择 */}

          <Form.Item
            name="additional_prompt"
            label="额外提示词"
            extra="为监督者提供额外的指导，帮助其更好地执行监督任务"
          >
            <TextArea
              rows={6}
              placeholder="请输入额外提示词，用于指导监督者行为"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 监督者配置模态框 */}
      <Modal
        title={`配置监督者: ${configuringObserver?.name || ''}`}
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
                    <Text strong style={{ fontSize: '14px' }}>监督流程预览</Text>
                  </div>
                  <Steps
                   
                    current={-1}
                    items={[
                      {
                        title: '触发检查',
                        description: getTriggerDescription(mode),
                        icon: <ClockCircleOutlined style={{ color: '#1677ff' }} />
                      },
                      {
                        title: '规则评估',
                        description: '检查是否违反行动空间规则',
                        icon: <FileSearchOutlined style={{ color: '#722ed1' }} />
                      },
                      {
                        title: '判断介入',
                        description: `违规严重度 ≥ ${threshold} 时触发`,
                        icon: <CheckCircleOutlined style={{ color: '#fa8c16' }} />
                      },
                      {
                        title: '执行动作',
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
                    <span>基本设置</span>
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
                      <span>监督方式</span>
                      <Tooltip
                        title={
                          <div>
                            <div><strong>监督方式</strong>决定何时触发规则检查（自然语言规则与逻辑规则），进而决定是否执行干预动作</div>
                            <br />
                            <div><strong>即时监督：</strong></div>
                            <div>• 每个智能体回复后立即触发规则检查</div>
                            <div>• 高频率检查，适合需要严格实时监控的场景</div>
                            <br />
                            <div><strong>轮次监督：</strong></div>
                            <div>• 每轮对话结束后触发规则检查</div>
                            <div>• 中等频率检查，适合一般业务场景</div>
                            <br />
                            <div><strong>变量监督：</strong></div>
                            <div>• 基于任务变量条件触发规则检查</div>
                            <div>• 通过检测任务空间中的变量与目标值对比来触发</div>
                            <div>• 适合基于特定条件的精确监督场景</div>
                          </div>
                        }
                      >
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: '请选择监督方式' }]}
                >
                  <Select
                    placeholder="选择监督方式"
                    onChange={handleSupervisionModeChange}
                    optionLabelProp="label"
                  >
                    <Option value="immediate" label="即时监督">
                      <div>
                        <div style={{ fontWeight: 'bold' }}>即时监督</div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                          每个智能体回复后立即检查规则
                        </div>
                      </div>
                    </Option>
                    <Option 
                      value="round_based" 
                      label={<span>轮次监督 <Tag color="green">推荐</Tag></span>}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>轮次监督 <Tag color="green">推荐</Tag></div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                          每轮对话结束后统一检查规则
                        </div>
                      </div>
                    </Option>
                    <Option
                      value="variable_based"
                      label="条件监督"
                      disabled={
                        !availableVariables.environmentVariables?.length &&
                        !availableVariables.agentRoles?.length
                      }
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>条件监督</div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                          {(!availableVariables.environmentVariables?.length && !availableVariables.agentRoles?.length)
                            ? '当前行动空间未检测出变量'
                            : '当指定变量达到条件时检查规则'}
                        </div>
                      </div>
                    </Option>
                  </Select>
                </Form.Item>

                {/* 只在变量监督模式下显示变量条件配置 */}
                {currentSupervisionMode === 'variable_based' && (
                  <>
                    <Divider>变量触发条件</Divider>

                    <Form.Item label="变量监督条件">
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
                                    placeholder="变量类型"
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
                                    <Select.Option value="environment">环境变量</Select.Option>
                                    <Select.Option value="agent">智能体变量</Select.Option>
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
                                          placeholder="变量名"
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
                                  <Select placeholder="运算符">
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
                                  <Input placeholder="目标值" />
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
                                添加变量条件
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
                              <Radio value="and">满足所有条件（AND）</Radio>
                              <Radio value="or">满足任一条件（OR）</Radio>
                            </Radio.Group>
                          </Form.Item>
                        ) : null;
                      }}
                    </Form.Item>

                    <Form.Item
                      name="check_interval"
                      label={
                        <Space>
                          <span>检查间隔（秒）</span>
                          <Tooltip title="监督者检查变量条件的时间间隔">
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      initialValue={60}
                      rules={[
                        { required: true, message: '请输入检查间隔' },
                        { type: 'number', min: 10, max: 3600, message: '检查间隔必须在10-3600秒之间' }
                      ]}
                    >
                      <InputNumber
                        min={10}
                        max={3600}
                        style={{ width: '100%' }}
                        addonAfter="秒"
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
                    <span>干预动作</span>
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
                      <span>干预方式</span>
                      <Tooltip
                        title={
                          <div>
                            <div><strong>干预方式</strong>决定当规则检查发现违规时如何响应</div>
                            <br />
                            <div><strong>被动响应：</strong></div>
                            <div>• 完全被动，不主动发送消息</div>
                            <div>• 仅在监督会话中响应用户提问</div>
                            <div>• 适合需要人工判断的场景</div>
                            <br />
                            <div><strong>主动记录：</strong></div>
                            <div>• 发现违规时在监督会话中主动记录</div>
                            <div>• 不干预任务会话，保持自然性</div>
                            <div>• 适合一般监督场景（推荐）</div>
                            <br />
                            <div><strong>任务干预：</strong></div>
                            <div>• 违规且达到阈值时直接在任务会话中干预</div>
                            <div>• 会直接影响任务会话流程</div>
                            <div>• 适合严格管控场景（需谨慎使用）</div>
                          </div>
                        }
                      >
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: '请选择干预方式' }]}
                >
                  <Select
                    placeholder="选择干预方式"
                    optionLabelProp="label"
                  >
                    <Option value="passive" label="被动响应">
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          <Badge status="default" /> 被动响应
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
                          仅在监督会话中被动回答用户问题
                        </div>
                      </div>
                    </Option>
                    <Option 
                      value="alert" 
                      label={<span><Badge status="warning" /> 主动记录 <Tag color="green">推荐</Tag></span>}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          <Badge status="warning" /> 主动记录 <Tag color="green">推荐</Tag>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
                          规则违规时在监督会话中主动记录建议
                        </div>
                      </div>
                    </Option>
                    <Option 
                      value="intervene" 
                      label={<span><Badge status="error" /> 任务干预 <Tag color="orange" icon={<ExclamationCircleOutlined />}>谨慎</Tag></span>}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          <Badge status="error" /> 任务干预 <Tag color="orange" icon={<ExclamationCircleOutlined />}>谨慎</Tag>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
                          达到阈值时直接在任务会话中发消息干预
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
                            <span>干预阈值</span>
                            <Tooltip
                              title={
                                <div>
                                  <div><strong>干预阈值</strong>决定监督者何时主动响应</div>
                                  <br />
                                  <div><strong>当前值：</strong>{thresholdValue} - {getThresholdLevel(thresholdValue)}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginTop: 4 }}>
                                    {getThresholdDescription(thresholdValue)}
                                  </div>
                                  <br />
                                  <div><strong>工作原理：</strong></div>
                                  <div>• 规则检查评估违规严重程度（0-1）</div>
                                  <div>• 当严重度 ≥ 阈值时，触发主动响应</div>
                                  <div>• 主动记录：在监督会话中记录</div>
                                  <div>• 任务干预：在任务会话中干预</div>
                                  <br />
                                  <div><strong>档位说明：</strong></div>
                                  <div>• 0.5（积极）：较低标准，响应频繁</div>
                                  <div>• 0.7（平衡）：适中标准，推荐设置</div>
                                  <div>• 0.9（谨慎）：高标准，只在严重违规时响应</div>
                                </div>
                              }
                            >
                              <QuestionCircleOutlined />
                            </Tooltip>
                          </Space>
                        }
                        rules={[{ required: true, message: '请设置干预阈值' }]}
                        style={{ marginTop: 16 }}
                      >
                        <Slider
                          min={0.5}
                          max={0.9}
                          step={null}
                          marks={{
                            0.5: '积极',
                            0.7: '平衡',
                            0.9: '谨慎'
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
                      <span>每轮最大干预次数</span>
                      <Tooltip title="限制监督者在每轮会话中的最大干预次数">
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: '请设置最大干预次数' }]}
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
                    <span>监控范围</span>
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
                          <span>规则遵守情况</span>
                          <Tag color="blue">必选</Tag>
                          <Tooltip title="监控智能体是否遵守预设的规则（此选项为监督者核心功能，始终启用）">
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
                          <span>对话质量</span>
                          <Tag color="orange" style={{ marginLeft: 4 }}>待实现</Tag>
                          <Tooltip title="监控对话的质量和有效性（功能开发中）">
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
                          <span>任务进度</span>
                          <Tag color="orange" style={{ marginLeft: 4 }}>待实现</Tag>
                          <Tooltip title="监控任务的执行进度和完成情况（功能开发中）">
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
                          <span>智能体行为</span>
                          <Tag color="orange" style={{ marginLeft: 4 }}>待实现</Tag>
                          <Tooltip title="监控智能体的行为模式和表现（功能开发中）">
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
                    <span>报告设置</span>
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
                          <span>生成监督总结</span>
                          <Tooltip title="自动生成监督过程的总结报告">
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
                          <span>记录干预日志</span>
                          <Tooltip title="详细记录所有监督干预的日志">
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
                          <span>问题警报</span>
                          <Tooltip title="发现重要问题时发出警报通知">
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
