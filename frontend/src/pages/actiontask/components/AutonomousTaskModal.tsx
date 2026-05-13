import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Radio,
  InputNumber,
  Input,
  Switch,
  Select,
  Button,
  Divider,
  Space,
  App
} from 'antd';
import { PlusOutlined, MinusCircleOutlined, DatabaseOutlined, CloudOutlined } from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';

const { TextArea } = Input;

/**
 * 自主任务配置模态框组件
 *
 * @param {Object} props - 组件属性
 * @param {boolean} props.visible - 模态框是否可见
 * @param {Function} props.onCancel - 取消回调
 * @param {Function} props.onConfirm - 确认回调
 * @param {boolean} props.confirmLoading - 确认按钮加载状态
 * @param {Object} props.task - 当前任务对象
 * @param {Array} props.environmentVariables - 环境变量列表
 * @param {Object} props.agentVariables - 智能体变量对象
 * @param {Object} props.options - 自主任务选项
 * @param {Function} props.onOptionsChange - 选项变更回调
 */
const AutonomousTaskModal = ({
  visible,
  onCancel,
  onConfirm,
  confirmLoading,
  task,
  environmentVariables = [],
  agentVariables = {},
  options,
  onOptionsChange
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [internalVariables, setInternalVariables] = useState([]);
  const [externalVariables, setExternalVariables] = useState([]);
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  // 获取内部和外部环境变量
  useEffect(() => {
    if (visible) {
      setLoadingVariables(true);  // 立即设置为 loading，避免竞态条件
      fetchAllVariables();
    }
  }, [visible]);

  const fetchAllVariables = async () => {
    setLoadingVariables(true);
    try {
      const allVariables = await actionSpaceAPI.getAllEnvironmentVariablesByType();
      setInternalVariables(allVariables.internal || []);
      setExternalVariables(allVariables.external || []);
    } catch (error) {
      console.error('获取环境变量失败:', error);
      setInternalVariables([]);
      setExternalVariables([]);
    } finally {
      setLoadingVariables(false);
    }
  };

  // 当模态框打开时，设置表单初始值（只初始化一次，等待变量加载完成）
  useEffect(() => {
    // 只在首次打开且变量加载完成时初始化
    if (visible && options && !loadingVariables && !formInitialized) {
      setFormInitialized(true);
      const taskType = options.isVariableTrigger ? 'variable_trigger' :
                      (options.isTimeTrigger ? 'time_trigger' :
                       (options.isAutonomousScheduling ? 'autonomous_scheduling' :
                        (options.isInfinite ? 'infinite' : 'rounds')));
      // 验证 agent ID 是否在当前智能体列表中存在
      const agentIds = task?.agents?.map(a => a.id) || [];
      const validPlannerAgentId = options.plannerAgentId && agentIds.includes(options.plannerAgentId) 
        ? options.plannerAgentId : null;
      const validSummarizerAgentId = options.summarizerAgentId && agentIds.includes(options.summarizerAgentId)
        ? options.summarizerAgentId : null;

      form.setFieldsValue({
        taskType: taskType,
        rounds: options.rounds,
        topic: options.topic,
        speakingMode: options.speakingMode,
        // 总结功能仅在讨论模式下可用
        summarize: taskType === 'rounds' ? options.summarize : false,
        summarizerAgentId: taskType === 'rounds' ? validSummarizerAgentId : null,
        // 计划功能
        enablePlanning: options.enablePlanning !== undefined ? options.enablePlanning : true,
        plannerAgentId: validPlannerAgentId,
        stopConditions: options.stopConditions || [],
        maxRuntime: options.maxRuntime || 0,
        conditionLogic: options.conditionLogic || 'and',
        // 时间触发模式相关字段
        timeInterval: options.timeInterval || 30,
        maxExecutions: options.maxExecutions || 0,
        triggerAction: 'single_round',
        enableTimeLimit: options.enableTimeLimit || false,
        totalTimeLimit: options.totalTimeLimit || 1440,
        // 变量触发模式相关字段
        triggerConditions: options.triggerConditions || [],
        triggerConditionLogic: options.triggerConditionLogic || 'and',
        checkInterval: options.checkInterval || 60,
        maxTriggerExecutions: options.maxTriggerExecutions || 0,
        variableTriggerAction: options.variableTriggerAction || 'single_round',
        variableTriggerRounds: options.variableTriggerRounds || 2,
        // 自主调度模式相关字段
        maxRounds: options.maxRounds || 50,
        timeoutMinutes: options.timeoutMinutes || 60
      });
    }
    // modal 关闭时重置初始化标记
    if (!visible && formInitialized) {
      setFormInitialized(false);
    }
  }, [visible, options, form, task, loadingVariables, formInitialized]);

  // 处理表单值变化
  const handleFormChange = (_, allValues) => {
    const newOptions = {
      ...options,
      isInfinite: allValues.taskType === 'infinite',
      isTimeTrigger: allValues.taskType === 'time_trigger',
      isVariableTrigger: allValues.taskType === 'variable_trigger',
      isAutonomousScheduling: allValues.taskType === 'autonomous_scheduling',
      rounds: allValues.rounds,
      topic: allValues.topic,
      speakingMode: allValues.speakingMode,
      // 总结功能仅在讨论模式下可用
      summarize: allValues.taskType === 'rounds' ? allValues.summarize : false,
      summarizerAgentId: allValues.taskType === 'rounds' ? allValues.summarizerAgentId : null,
      // 计划功能 - 修复传值问题
      enablePlanning: allValues.enablePlanning !== undefined ? allValues.enablePlanning : true,
      plannerAgentId: allValues.plannerAgentId !== undefined ? allValues.plannerAgentId : null,
      stopConditions: allValues.stopConditions || [],
      maxRuntime: allValues.maxRuntime || 0,
      conditionLogic: allValues.conditionLogic || 'and',
      // 时间触发模式相关字段
      timeInterval: allValues.timeInterval || 30,
      maxExecutions: allValues.maxExecutions || 0,
      triggerAction: 'single_round',
      enableTimeLimit: allValues.enableTimeLimit || false,
      totalTimeLimit: allValues.totalTimeLimit || 1440,
      // 变量触发模式相关字段
      triggerConditions: allValues.triggerConditions || [],
      triggerConditionLogic: allValues.triggerConditionLogic || 'and',
      checkInterval: allValues.checkInterval || 60,
      maxTriggerExecutions: allValues.maxTriggerExecutions || 0,
      variableTriggerAction: allValues.variableTriggerAction || 'single_round',
      variableTriggerRounds: allValues.variableTriggerRounds || 2,
      // 自主调度模式相关字段
      maxRounds: allValues.maxRounds || 50,
      timeoutMinutes: allValues.timeoutMinutes || 60
    };
    onOptionsChange(newOptions);
  };

  // 处理确认
  const handleOk = async () => {
    try {
      await form.validateFields();

      // 获取表单值进行额外验证
      const values = form.getFieldsValue();

      // 如果是变量停止模式，检查是否设置了停止条件
      if (values.taskType === 'infinite') {
        const stopConditions = values.stopConditions || [];
        
        // 检查是否至少有一个完整的停止条件
        const validConditions = stopConditions.filter(condition =>
          condition &&
          condition.type &&
          condition.variable &&
          condition.operator &&
          condition.value !== undefined &&
          condition.value !== ''
        );

        if (validConditions.length === 0) {
          message.error('变量停止模式必须设置至少一个完整的停止条件');
          return;
        }


      }

      // 如果是变量触发模式，检查是否设置了触发条件
      if (values.taskType === 'variable_trigger') {
        const triggerConditions = values.triggerConditions || [];

        const validTriggerConditions = triggerConditions.filter(condition =>
          condition &&
          condition.type &&
          condition.variable &&
          condition.operator &&
          condition.value !== undefined &&
          condition.value !== ''
        );

        if (validTriggerConditions.length === 0) {
          message.error('变量触发模式必须设置至少一个完整的触发条件');
          return;
        }
      }

      // 确保使用最新的完整表单数据更新 options
      const finalOptions = {
        ...options,
        isInfinite: values.taskType === 'infinite',
        isTimeTrigger: values.taskType === 'time_trigger',
        isVariableTrigger: values.taskType === 'variable_trigger',
        isAutonomousScheduling: values.taskType === 'autonomous_scheduling',
        rounds: values.rounds,
        topic: values.topic,
        speakingMode: values.speakingMode,
        summarize: values.taskType === 'rounds' ? values.summarize : false,
        summarizerAgentId: values.taskType === 'rounds' ? values.summarizerAgentId : null,
        enablePlanning: values.enablePlanning !== undefined ? values.enablePlanning : true,
        plannerAgentId: values.plannerAgentId !== undefined ? values.plannerAgentId : null,
        stopConditions: values.stopConditions || [],
        maxRuntime: values.maxRuntime || 0,
        conditionLogic: values.conditionLogic || 'and',
        timeInterval: values.timeInterval || 30,
        maxExecutions: values.maxExecutions || 0,
        triggerConditions: values.triggerConditions || [],
        triggerConditionLogic: values.triggerConditionLogic || 'and',
        checkInterval: values.checkInterval || 60,
        maxTriggerExecutions: values.maxTriggerExecutions || 0,
        variableTriggerAction: values.variableTriggerAction || 'single_round',
        variableTriggerRounds: values.variableTriggerRounds || 2,
        maxRounds: values.maxRounds || 50,
        timeoutMinutes: values.timeoutMinutes || 60
      };
      
      onOptionsChange(finalOptions);
      
      // 传递完整的选项数据给 onConfirm，避免异步状态更新问题
      onConfirm(finalOptions);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };



  return (
    <Modal
      title="启动智能体自主行动"
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      width={900}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        preserve={false}
      >
        <Form.Item
          name="taskType"
          label="行动类型"
          initialValue="rounds"
        >
          <Radio.Group>
            <Radio value="rounds">讨论</Radio>
            <Radio value="infinite">
              变量停止
            </Radio>
            <Radio value="time_trigger">持续运行</Radio>
            <Radio value="variable_trigger">
              变量触发
            </Radio>
            <Radio value="autonomous_scheduling">
              自主调度
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.taskType !== currentValues.taskType
          }
        >
          {({ getFieldValue }) => {
            const taskType = getFieldValue('taskType');
            return (
              <Form.Item
                name="rounds"
                label="任务轮数 (每轮所有智能体轮流行动)"
                initialValue={1}
              >
                <InputNumber
                  min={1}
                  max={9999}
                  style={{ width: '100%' }}
                  disabled={taskType === 'infinite' || taskType === 'time_trigger' || taskType === 'variable_trigger' || taskType === 'autonomous_scheduling'}
                />
              </Form.Item>
            );
          }}
        </Form.Item>

        <Form.Item
          name="topic"
          label="主题 (可选)"
          initialValue=""
        >
          <TextArea
            placeholder="请输入主题，为空则使用默认主题"
            autoSize={false}
            style={{ resize: 'vertical', minHeight: '60px' }}
          />
        </Form.Item>

        <Form.Item
          name="speakingMode"
          label="智能体行动方式"
          initialValue="sequential"
        >
          <Radio.Group>
            <Radio value="sequential">顺序行动（按照添加顺序行动）</Radio>
            <Radio value="random" disabled>监督者指定（监督者根据智能体情况指定行动）</Radio>
          </Radio.Group>
        </Form.Item>



        {/* 计划功能 - 适用于所有任务类型 */}
        <Form.Item style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>制定计划</span>
            <Form.Item name="enablePlanning" valuePropName="checked" initialValue={true} style={{ margin: 0 }}>
              <Switch />
            </Form.Item>
          </div>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.enablePlanning !== currentValues.enablePlanning
            }
          >
            {({ getFieldValue }) => {
              const enablePlanning = getFieldValue('enablePlanning');

              if (enablePlanning) {
                return (
                  <div>
                    <Form.Item
                      name="plannerAgentId"
                      style={{ marginTop: '8px', marginBottom: 0 }}
                    >
                      <Select
                        placeholder="选择计划智能体（不选择则使用第一个智能体）"
                        allowClear
                        style={{ width: '100%' }}
                      >
                        {task?.agents?.map((agent) => (
                          <Select.Option key={agent.id} value={agent.id}>
                            {agent.role_name ? `${agent.name} [${agent.role_name}]` : agent.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--custom-text-secondary)' }}>
                      计划将被写入工作区，供其他智能体参考
                    </div>
                  </div>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form.Item>

        {/* 总结功能 - 仅在讨论模式下可用 */}
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.taskType !== currentValues.taskType
          }
        >
          {({ getFieldValue }) => {
            const taskType = getFieldValue('taskType');

            // 总结功能仅在讨论模式下可用
            if (taskType === 'rounds') {
              return (
                <Form.Item style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>讨论总结</span>
                    <Form.Item name="summarize" valuePropName="checked" initialValue={true} style={{ margin: 0 }}>
                      <Switch />
                    </Form.Item>
                  </div>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.summarize !== currentValues.summarize
                    }
                  >
                    {({ getFieldValue: getFieldValueInner }) => {
                      const summarize = getFieldValueInner('summarize');

                      if (summarize) {
                        return (
                          <div>
                            <Form.Item
                              name="summarizerAgentId"
                              style={{ marginTop: '8px', marginBottom: 0 }}
                            >
                              <Select
                                placeholder="选择总结智能体（不选择则使用第一个智能体）"
                                allowClear
                                style={{ width: '100%' }}
                              >
                                {task?.agents?.map((agent) => (
                                  <Select.Option key={agent.id} value={agent.id}>
                                    {agent.role_name ? `${agent.name} [${agent.role_name}]` : agent.name}
                                  </Select.Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--custom-text-secondary)' }}>
                              总结将被写入任务结论中
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  </Form.Item>
                </Form.Item>
              );
            }
            return null;
          }}
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.taskType !== currentValues.taskType
          }
        >
          {({ getFieldValue }) => {
            const taskType = getFieldValue('taskType');

            if (taskType === 'time_trigger') {
              return (
                <div>
                  <Divider>持续运行设置</Divider>

                  <Form.Item
                    name="timeInterval"
                    label="时间间隔（分钟）"
                    initialValue={30}
                    rules={[
                      { required: true, message: '请输入时间间隔' },
                      {
                        validator: (_, value) => {
                          if (value === undefined || value === null) return Promise.resolve();
                          if (value >= 1 && value <= 1440) return Promise.resolve();
                          return Promise.reject(new Error('时间间隔必须在1-1440分钟之间'));
                        }
                      }
                    ]}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={1}
                        max={1440}
                        style={{ width: '100%' }}
                        placeholder="每隔多少分钟触发一次"
                      />
                      <Button disabled style={{ pointerEvents: 'none' }}>分钟</Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="maxExecutions"
                    label="最大执行次数（0表示不限制）"
                    initialValue={0}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                        placeholder="最多执行多少次，0表示不限制"
                      />
                      <Button disabled style={{ pointerEvents: 'none' }}>次</Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="triggerAction"
                    label="触发行动"
                    initialValue="single_round"
                  >
                    <Radio.Group>
                      <Radio value="single_round">单轮行动（每次触发执行一轮）</Radio>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item
                    name="enableTimeLimit"
                    label="启用总时长限制"
                    valuePropName="checked"
                    initialValue={false}
                  >
                    <Switch />
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.enableTimeLimit !== currentValues.enableTimeLimit
                    }
                  >
                    {({ getFieldValue: getFieldValueInner }) => {
                      const enableTimeLimit = getFieldValueInner('enableTimeLimit');

                      if (enableTimeLimit) {
                        return (
                          <Form.Item
                            name="totalTimeLimit"
                            label="总运行时长限制（分钟）"
                            initialValue={1440}
                            rules={[
                              { required: true, message: '请输入总时长限制' },
                              {
                                validator: (_, value) => {
                                  if (value === undefined || value === null) return Promise.resolve();
                                  if (value >= 1 && value <= 10080) return Promise.resolve();
                                  return Promise.reject(new Error('总时长必须在1-10080分钟之间（1分钟-7天）'));
                                }
                              }
                            ]}
                          >
                            <Space.Compact style={{ width: '100%' }}>
                              <InputNumber
                                min={1}
                                max={10080}
                                style={{ width: '100%' }}
                              />
                              <Button disabled style={{ pointerEvents: 'none' }}>分钟</Button>
                            </Space.Compact>
                          </Form.Item>
                        );
                      }
                      return null;
                    }}
                  </Form.Item>
                </div>
              );
            } else if (taskType === 'infinite') {
              return (
                <div>
                  <Divider>变量停止设置</Divider>
                  <p style={{ marginBottom: '16px' }}>设置变量停止条件，当满足条件时自动停止任务</p>



                  <Form.List name="stopConditions">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(field => (
                          <div key={field.key} style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
                            <Form.Item
                              name={[field.name, 'type']}
                              style={{ width: '30%', marginBottom: 0 }}
                            >
                              <Select
                                placeholder="变量类型"
                                style={{ height: '32px' }}
                                onChange={() => {
                                  // 类型改变时清空变量选择（只更新 variable 字段，不影响其他字段）
                                  form.setFields([{
                                    name: ['stopConditions', field.name, 'variable'],
                                    value: undefined
                                  }]);
                                }}
                              >
                                <Select.Option value="environment">环境变量</Select.Option>
                                <Select.Option value="agent">智能体变量</Select.Option>
                                <Select.Option value="external">外部变量</Select.Option>
                              </Select>
                            </Form.Item>

                            <Form.Item
                              noStyle
                              shouldUpdate={(prevValues: any, currentValues: any) => {
                                const prevType = prevValues?.stopConditions?.[field.name]?.type;
                                const currentType = currentValues?.stopConditions?.[field.name]?.type;
                                return prevType !== currentType;
                              }}
                            >
                              {() => {
                                const varType = form.getFieldValue(['stopConditions', field.name, 'type']);
                                return (
                                  <Form.Item
                                    name={[field.name, 'variable']}
                                    style={{ width: '25%', marginBottom: 0 }}
                                  >
                                    <Select
                                      placeholder="变量名"
                                      style={{ height: '32px' }}
                                      showSearch
                                      disabled={!varType}
                                    >
                                      {varType === 'environment' && environmentVariables?.map(v => (
                                        v.label ? (
                                          <Select.OptGroup key={v.name} label={v.label}>
                                            <Select.Option value={v.name}>
                                              {v.name}
                                            </Select.Option>
                                          </Select.OptGroup>
                                        ) : (
                                          <Select.Option key={v.name} value={v.name}>
                                            {v.name}
                                          </Select.Option>
                                        )
                                      ))}
                                      {varType === 'agent' && task?.agents?.map(agent => (
                                        <Select.OptGroup key={agent.id} label={agent.name}>
                                          {agent.variables?.map(v => (
                                            <Select.Option key={`${agent.id}-${v.name}`} value={`${agent.id}.${v.name}`}>
                                              {v.name}
                                            </Select.Option>
                                          ))}
                                        </Select.OptGroup>
                                      ))}
                                      {varType === 'external' && externalVariables?.map(variable => (
                                        <Select.OptGroup key={variable.id} label={variable.label}>
                                          <Select.Option value={variable.name}>
                                            {variable.name}
                                          </Select.Option>
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
                              <Select
                                placeholder="运算符"
                                style={{ height: '32px' }}
                              >
                                <Select.Option value=">">&gt;</Select.Option>
                                <Select.Option value=">=">&gt;=</Select.Option>
                                <Select.Option value="=">=</Select.Option>
                                <Select.Option value="<=">&lt;=</Select.Option>
                                <Select.Option value="<">&lt;</Select.Option>
                              </Select>
                            </Form.Item>

                            <Form.Item
                              name={[field.name, 'value']}
                              style={{ width: '20%', marginBottom: 0 }}
                            >
                              <Input
                                placeholder="阈值"
                                style={{ height: '32px' }}
                              />
                            </Form.Item>

                            <Button
                              onClick={() => remove(field.name)}
                              icon={<MinusCircleOutlined />}
                              type="text"
                              danger
                              style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                            添加停止条件
                          </Button>
                        </Form.Item>

                        {fields.length > 1 && (
                          <Form.Item name="conditionLogic" initialValue="and">
                            <Radio.Group>
                              <Radio value="and">满足所有条件（AND）</Radio>
                              <Radio value="or">满足任一条件（OR）</Radio>
                            </Radio.Group>
                          </Form.Item>
                        )}
                      </>
                    )}
                  </Form.List>

                  <Form.Item
                    name="maxRuntime"
                    label="最长运行时间（分钟，0表示不限制）"
                    initialValue={0}
                  >
                    <InputNumber
                      min={0}
                      max={180}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </div>
              );
            } else if (taskType === 'variable_trigger') {
              return (
                <div>
                  <Divider>变量触发设置</Divider>
                  <p style={{ marginBottom: '16px' }}>选择内部变量或外部变量进行监控，当变量值满足条件时触发智能体行动</p>





                  <Form.Item label="触发条件">
                    <p style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                      设置变量触发条件，支持内部变量（环境变量、智能体变量）和外部变量
                    </p>
                    <Form.List name="triggerConditions">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(field => (
                            <div key={field.key} style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
                              <Form.Item
                                name={[field.name, 'type']}
                                style={{ width: '20%', marginBottom: 0 }}
                              >
                                <Select
                                  placeholder="变量类型"
                                  style={{ height: '32px' }}
                                  onChange={() => {
                                    // 类型改变时清空变量选择（只更新 variable 字段，不影响其他字段）
                                    form.setFields([{
                                      name: ['triggerConditions', field.name, 'variable'],
                                      value: undefined
                                    }]);
                                  }}
                                >
                                  <Select.Option value="environment">环境变量</Select.Option>
                                  <Select.Option value="agent">智能体变量</Select.Option>
                                  <Select.Option value="external">外部变量</Select.Option>
                                </Select>
                              </Form.Item>

                              <Form.Item
                                style={{ width: '25%', marginBottom: 0 }}
                                shouldUpdate={(prevValues, currentValues) => {
                                  const prevType = prevValues?.triggerConditions?.[field.name]?.type;
                                  const currentType = currentValues?.triggerConditions?.[field.name]?.type;
                                  return prevType !== currentType;
                                }}
                              >
                                {({ getFieldValue }) => {
                                  const varType = getFieldValue(['triggerConditions', field.name, 'type']);
                                  return (
                                    <Form.Item
                                      name={[field.name, 'variable']}
                                      noStyle
                                    >
                                      <Select
                                        placeholder="变量名"
                                        style={{ height: '32px' }}
                                        showSearch
                                        disabled={!varType}
                                      >
                                        {varType === 'environment' && environmentVariables?.map(v => (
                                          v.label ? (
                                            <Select.OptGroup key={v.name} label={v.label}>
                                              <Select.Option value={v.name}>
                                                {v.name}
                                              </Select.Option>
                                            </Select.OptGroup>
                                          ) : (
                                            <Select.Option key={v.name} value={v.name}>
                                              {v.name}
                                            </Select.Option>
                                          )
                                        ))}
                                        {varType === 'agent' && task?.agents?.map(agent => (
                                          <Select.OptGroup key={agent.id} label={agent.name}>
                                            {agent.variables?.map(v => (
                                              <Select.Option key={`${agent.id}-${v.name}`} value={`${agent.id}.${v.name}`}>
                                                {v.name}
                                              </Select.Option>
                                            ))}
                                          </Select.OptGroup>
                                        ))}
                                        {varType === 'external' && externalVariables?.map(variable => (
                                          <Select.OptGroup key={variable.id} label={variable.label}>
                                            <Select.Option value={variable.name}>
                                              {variable.name}
                                            </Select.Option>
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
                                <Select
                                  placeholder="运算符"
                                  style={{ height: '32px' }}
                                >
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
                                <Input
                                  placeholder="阈值"
                                  style={{ height: '32px' }}
                                />
                              </Form.Item>

                              <Button
                                onClick={() => remove(field.name)}
                                icon={<MinusCircleOutlined />}
                                type="text"
                                danger
                                style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                              添加触发条件
                            </Button>
                          </Form.Item>

                          {fields.length > 1 && (
                            <Form.Item name="triggerConditionLogic" initialValue="and">
                              <Radio.Group>
                                <Radio value="and">满足所有条件（AND）</Radio>
                                <Radio value="or">满足任一条件（OR）</Radio>
                              </Radio.Group>
                            </Form.Item>
                          )}
                        </>
                      )}
                    </Form.List>
                  </Form.Item>

                  <Form.Item
                    name="checkInterval"
                    label="检查间隔（秒）"
                    initialValue={60}
                    rules={[
                      { required: true, message: '请输入检查间隔' },
                      {
                        validator: (_, value) => {
                          if (value === undefined || value === null) return Promise.resolve();
                          if (value >= 10 && value <= 3600) return Promise.resolve();
                          return Promise.reject(new Error('检查间隔必须在10-3600秒之间'));
                        }
                      }
                    ]}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={10}
                        max={3600}
                        style={{ width: '100%' }}
                      />
                      <Button disabled style={{ pointerEvents: 'none' }}>秒</Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="maxTriggerExecutions"
                    label="最大触发次数（0表示不限制）"
                    initialValue={0}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                      />
                      <Button disabled style={{ pointerEvents: 'none' }}>次</Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="variableTriggerAction"
                    label="触发行动"
                    initialValue="single_round"
                  >
                    <Radio.Group>
                      <Radio value="single_round">单轮行动（每次触发执行一轮）</Radio>
                      <Radio value="discussion">讨论（每次触发执行指定轮数讨论）</Radio>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.variableTriggerAction !== currentValues.variableTriggerAction
                    }
                  >
                    {({ getFieldValue: getFieldValueInner }) => {
                      const variableTriggerAction = getFieldValueInner('variableTriggerAction');

                      if (variableTriggerAction === 'discussion') {
                        return (
                          <Form.Item
                            name="variableTriggerRounds"
                            label="每次触发的讨论轮数"
                            initialValue={2}
                          >
                            <Space.Compact style={{ width: '100%' }}>
                              <InputNumber
                                min={1}
                                max={9999}
                                style={{ width: '100%' }}
                              />
                              <Button disabled style={{ pointerEvents: 'none' }}>轮</Button>
                            </Space.Compact>
                          </Form.Item>
                        );
                      }
                      return null;
                    }}
                  </Form.Item>
                </div>
              );
            } else if (taskType === 'autonomous_scheduling') {
              return (
                <div>
                  <Divider>自主调度设置</Divider>
                  <div style={{ marginBottom: '16px' }}>
                    <p>智能体通过设置 <code>nextAgent</code> 和 <code>nextAgentTODO</code> 变量来决定下一个执行的智能体。</p>
                    <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                      每个智能体发言一次算一步，任务在以下情况停止：
                    </p>
                    <ul style={{ marginTop: '4px', marginBottom: 0, fontSize: '12px', color: 'var(--custom-text-secondary)', paddingLeft: '20px' }}>
                      <li>智能体设置 <code>nextAgent=""</code>（空字符串）主动结束</li>
                      <li>智能体未设置 <code>nextAgent</code>（超时后自动停止）</li>
                      <li>达到最大发言次数</li>
                      <li>达到超时时间</li>
                    </ul>
                  </div>

                  <Form.Item
                    name="maxRounds"
                    label="最大发言次数"
                    initialValue={50}
                    rules={[
                      { required: true, message: '请输入最大发言次数' },
                      {
                        validator: (_, value) => {
                          if (value === undefined || value === null) return Promise.resolve();
                          if (value >= 1 && value <= 100) return Promise.resolve();
                          return Promise.reject(new Error('最大发言次数必须在1-100之间'));
                        }
                      }
                    ]}
                    tooltip="每个智能体发言一次算一步，达到上限后任务自动停止（防止无限循环）"
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={1}
                        max={100}
                        style={{ width: '100%' }}
                      />
                      <Button disabled style={{ pointerEvents: 'none' }}>次</Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="timeoutMinutes"
                    label="超时时间"
                    initialValue={60}
                    rules={[
                      { required: true, message: '请输入超时时间' },
                      {
                        validator: (_, value) => {
                          if (value === undefined || value === null) return Promise.resolve();
                          if (value >= 1 && value <= 480) return Promise.resolve();
                          return Promise.reject(new Error('超时时间必须在1-480分钟之间'));
                        }
                      }
                    ]}
                    tooltip="任务运行的最大时间限制"
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={1}
                        max={480}
                        style={{ width: '100%' }}
                      />
                      <Button disabled style={{ pointerEvents: 'none' }}>分钟</Button>
                    </Space.Compact>
                  </Form.Item>
                </div>
              );
            }
            return null;
          }}
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AutonomousTaskModal;
