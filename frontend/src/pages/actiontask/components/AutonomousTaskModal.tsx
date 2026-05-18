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
  App,
} from 'antd';
import {
  PlusOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../../services/api/actionspace';

const { TextArea } = Input;

/**
 * Autonomous Task Modal.
 *
 * Lets the user start an autonomous run for a task. Supports five mutually
 * exclusive run types:
 *   - rounds: classic N-round discussion
 *   - infinite: variable-stop mode (runs until a variable matches a rule)
 *   - time_trigger: cron-like continuous mode
 *   - variable_trigger: act when a watched variable matches a rule
 *   - autonomous_scheduling: agents pick the next speaker themselves
 */
interface AutonomousTaskModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (options: any) => void;
  confirmLoading?: boolean;
  task: any;
  environmentVariables?: any[];
  agentVariables?: any;
  options: any;
  onOptionsChange: (options: any) => void;
}

const AutonomousTaskModal: React.FC<AutonomousTaskModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  confirmLoading,
  task,
  environmentVariables = [],
  options,
  onOptionsChange,
}) => {
  const { t } = useTranslation('actiontask');
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [, setInternalVariables] = useState<any[]>([]);
  const [externalVariables, setExternalVariables] = useState<any[]>([]);
  const [loadingVariables, setLoadingVariables] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  // Fetch internal and external environment variables when the modal opens.
  useEffect(() => {
    if (visible) {
      setLoadingVariables(true);
      fetchAllVariables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const fetchAllVariables = async () => {
    setLoadingVariables(true);
    try {
      const allVariables = await actionSpaceAPI.getAllEnvironmentVariablesByType();
      setInternalVariables(allVariables.internal || []);
      setExternalVariables(allVariables.external || []);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch environment variables:', error);
      setInternalVariables([]);
      setExternalVariables([]);
    } finally {
      setLoadingVariables(false);
    }
  };

  // Initialise form values once the modal opens and variables are loaded.
  useEffect(() => {
    if (visible && options && !loadingVariables && !formInitialized) {
      setFormInitialized(true);
      const taskType = options.isVariableTrigger
        ? 'variable_trigger'
        : options.isTimeTrigger
        ? 'time_trigger'
        : options.isAutonomousScheduling
        ? 'autonomous_scheduling'
        : options.isInfinite
        ? 'infinite'
        : 'rounds';

      const agentIds = task?.agents?.map((a: any) => a.id) || [];
      const validPlannerAgentId =
        options.plannerAgentId && agentIds.includes(options.plannerAgentId)
          ? options.plannerAgentId
          : null;
      const validSummarizerAgentId =
        options.summarizerAgentId && agentIds.includes(options.summarizerAgentId)
          ? options.summarizerAgentId
          : null;

      form.setFieldsValue({
        taskType,
        rounds: options.rounds,
        topic: options.topic,
        speakingMode: options.speakingMode,
        summarize: taskType === 'rounds' ? options.summarize : false,
        summarizerAgentId: taskType === 'rounds' ? validSummarizerAgentId : null,
        enablePlanning:
          options.enablePlanning !== undefined ? options.enablePlanning : true,
        plannerAgentId: validPlannerAgentId,
        stopConditions: options.stopConditions || [],
        maxRuntime: options.maxRuntime || 0,
        conditionLogic: options.conditionLogic || 'and',
        timeInterval: options.timeInterval || 30,
        maxExecutions: options.maxExecutions || 0,
        triggerAction: 'single_round',
        enableTimeLimit: options.enableTimeLimit || false,
        totalTimeLimit: options.totalTimeLimit || 1440,
        triggerConditions: options.triggerConditions || [],
        triggerConditionLogic: options.triggerConditionLogic || 'and',
        checkInterval: options.checkInterval || 60,
        maxTriggerExecutions: options.maxTriggerExecutions || 0,
        variableTriggerAction: options.variableTriggerAction || 'single_round',
        variableTriggerRounds: options.variableTriggerRounds || 2,
        maxRounds: options.maxRounds || 50,
        timeoutMinutes: options.timeoutMinutes || 60,
      });
    }
    if (!visible && formInitialized) {
      setFormInitialized(false);
    }
  }, [visible, options, form, task, loadingVariables, formInitialized]);

  const handleFormChange = (_: any, allValues: any) => {
    const newOptions = {
      ...options,
      isInfinite: allValues.taskType === 'infinite',
      isTimeTrigger: allValues.taskType === 'time_trigger',
      isVariableTrigger: allValues.taskType === 'variable_trigger',
      isAutonomousScheduling: allValues.taskType === 'autonomous_scheduling',
      rounds: allValues.rounds,
      topic: allValues.topic,
      speakingMode: allValues.speakingMode,
      summarize: allValues.taskType === 'rounds' ? allValues.summarize : false,
      summarizerAgentId:
        allValues.taskType === 'rounds' ? allValues.summarizerAgentId : null,
      enablePlanning:
        allValues.enablePlanning !== undefined ? allValues.enablePlanning : true,
      plannerAgentId:
        allValues.plannerAgentId !== undefined ? allValues.plannerAgentId : null,
      stopConditions: allValues.stopConditions || [],
      maxRuntime: allValues.maxRuntime || 0,
      conditionLogic: allValues.conditionLogic || 'and',
      timeInterval: allValues.timeInterval || 30,
      maxExecutions: allValues.maxExecutions || 0,
      triggerAction: 'single_round',
      enableTimeLimit: allValues.enableTimeLimit || false,
      totalTimeLimit: allValues.totalTimeLimit || 1440,
      triggerConditions: allValues.triggerConditions || [],
      triggerConditionLogic: allValues.triggerConditionLogic || 'and',
      checkInterval: allValues.checkInterval || 60,
      maxTriggerExecutions: allValues.maxTriggerExecutions || 0,
      variableTriggerAction: allValues.variableTriggerAction || 'single_round',
      variableTriggerRounds: allValues.variableTriggerRounds || 2,
      maxRounds: allValues.maxRounds || 50,
      timeoutMinutes: allValues.timeoutMinutes || 60,
    };
    onOptionsChange(newOptions);
  };

  const handleOk = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();

      if (values.taskType === 'infinite') {
        const stopConditions = values.stopConditions || [];
        const validConditions = stopConditions.filter(
          (c: any) =>
            c &&
            c.type &&
            c.variable &&
            c.operator &&
            c.value !== undefined &&
            c.value !== ''
        );
        if (validConditions.length === 0) {
          message.error(t('autoTask.varStop.errMissingConditions'));
          return;
        }
      }

      if (values.taskType === 'variable_trigger') {
        const triggerConditions = values.triggerConditions || [];
        const validTriggerConditions = triggerConditions.filter(
          (c: any) =>
            c &&
            c.type &&
            c.variable &&
            c.operator &&
            c.value !== undefined &&
            c.value !== ''
        );
        if (validTriggerConditions.length === 0) {
          message.error(t('autoTask.varTrigger.errMissingConditions'));
          return;
        }
      }

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
        summarizerAgentId:
          values.taskType === 'rounds' ? values.summarizerAgentId : null,
        enablePlanning:
          values.enablePlanning !== undefined ? values.enablePlanning : true,
        plannerAgentId:
          values.plannerAgentId !== undefined ? values.plannerAgentId : null,
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
        timeoutMinutes: values.timeoutMinutes || 60,
      };

      onOptionsChange(finalOptions);
      onConfirm(finalOptions);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Form validation failed:', error);
    }
  };

  // Helper: render a variable-condition row used by both stop / trigger lists.
  const renderConditionRow = (
    listName: 'stopConditions' | 'triggerConditions',
    field: any,
    remove: (i: number) => void,
    withNotEqual: boolean
  ) => (
    <div key={field.key} style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
      <Form.Item
        name={[field.name, 'type']}
        style={{ width: listName === 'stopConditions' ? '30%' : '20%', marginBottom: 0 }}
      >
        <Select
          placeholder={t('autoTask.condition.varType')}
          style={{ height: '32px' }}
          onChange={() => {
            form.setFields([
              {
                name: [listName, field.name, 'variable'],
                value: undefined,
              },
            ]);
          }}
        >
          <Select.Option value="environment">
            {t('autoTask.condition.varType.environment')}
          </Select.Option>
          <Select.Option value="agent">
            {t('autoTask.condition.varType.agent')}
          </Select.Option>
          <Select.Option value="external">
            {t('autoTask.condition.varType.external')}
          </Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prev: any, cur: any) => {
          const a = prev?.[listName]?.[field.name]?.type;
          const b = cur?.[listName]?.[field.name]?.type;
          return a !== b;
        }}
      >
        {() => {
          const varType = form.getFieldValue([listName, field.name, 'type']);
          return (
            <Form.Item
              name={[field.name, 'variable']}
              style={{ width: '25%', marginBottom: 0 }}
            >
              <Select
                placeholder={t('autoTask.condition.varName')}
                style={{ height: '32px' }}
                showSearch
                disabled={!varType}
              >
                {varType === 'environment' &&
                  environmentVariables?.map((v: any) =>
                    v.label ? (
                      <Select.OptGroup key={v.name} label={v.label}>
                        <Select.Option value={v.name}>{v.name}</Select.Option>
                      </Select.OptGroup>
                    ) : (
                      <Select.Option key={v.name} value={v.name}>
                        {v.name}
                      </Select.Option>
                    )
                  )}
                {varType === 'agent' &&
                  task?.agents?.map((agent: any) => (
                    <Select.OptGroup key={agent.id} label={agent.name}>
                      {agent.variables?.map((v: any) => (
                        <Select.Option
                          key={`${agent.id}-${v.name}`}
                          value={`${agent.id}.${v.name}`}
                        >
                          {v.name}
                        </Select.Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                {varType === 'external' &&
                  externalVariables?.map((variable: any) => (
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
          placeholder={t('autoTask.condition.operator')}
          style={{ height: '32px' }}
        >
          <Select.Option value=">">&gt;</Select.Option>
          <Select.Option value=">=">&gt;=</Select.Option>
          <Select.Option value="=">=</Select.Option>
          <Select.Option value="<=">&lt;=</Select.Option>
          <Select.Option value="<">&lt;</Select.Option>
          {withNotEqual && <Select.Option value="!=">!=</Select.Option>}
        </Select>
      </Form.Item>

      <Form.Item
        name={[field.name, 'value']}
        style={{ width: '20%', marginBottom: 0 }}
      >
        <Input placeholder={t('autoTask.condition.threshold')} style={{ height: '32px' }} />
      </Form.Item>

      <Button
        onClick={() => remove(field.name)}
        icon={<MinusCircleOutlined />}
        type="text"
        danger
        style={{
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </div>
  );

  return (
    <Modal
      title={t('autoTask.modalTitle')}
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
          label={t('autoTask.taskType.label')}
          initialValue="rounds"
        >
          <Radio.Group>
            <Radio value="rounds">{t('autoTask.taskType.rounds')}</Radio>
            <Radio value="infinite">{t('autoTask.taskType.infinite')}</Radio>
            <Radio value="time_trigger">{t('autoTask.taskType.timeTrigger')}</Radio>
            <Radio value="variable_trigger">
              {t('autoTask.taskType.variableTrigger')}
            </Radio>
            <Radio value="autonomous_scheduling">
              {t('autoTask.taskType.autonomousScheduling')}
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev: any, cur: any) => prev.taskType !== cur.taskType}
        >
          {({ getFieldValue }) => {
            const taskType = getFieldValue('taskType');
            return (
              <Form.Item
                name="rounds"
                label={t('autoTask.rounds.label')}
                initialValue={1}
              >
                <InputNumber
                  min={1}
                  max={9999}
                  style={{ width: '100%' }}
                  disabled={
                    taskType === 'infinite' ||
                    taskType === 'time_trigger' ||
                    taskType === 'variable_trigger' ||
                    taskType === 'autonomous_scheduling'
                  }
                />
              </Form.Item>
            );
          }}
        </Form.Item>

        <Form.Item name="topic" label={t('autoTask.topic.label')} initialValue="">
          <TextArea
            placeholder={t('autoTask.topic.placeholder')}
            autoSize={false}
            style={{ resize: 'vertical', minHeight: '60px' }}
          />
        </Form.Item>

        <Form.Item
          name="speakingMode"
          label={t('autoTask.speakingMode.label')}
          initialValue="sequential"
        >
          <Radio.Group>
            <Radio value="sequential">{t('autoTask.speakingMode.sequential')}</Radio>
            <Radio value="random" disabled>
              {t('autoTask.speakingMode.random')}
            </Radio>
          </Radio.Group>
        </Form.Item>

        {/* Planning toggle */}
        <Form.Item style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <span>{t('autoTask.planning.title')}</span>
            <Form.Item
              name="enablePlanning"
              valuePropName="checked"
              initialValue={true}
              style={{ margin: 0 }}
            >
              <Switch />
            </Form.Item>
          </div>
          <Form.Item
            noStyle
            shouldUpdate={(prev: any, cur: any) =>
              prev.enablePlanning !== cur.enablePlanning
            }
          >
            {({ getFieldValue }) => {
              if (getFieldValue('enablePlanning')) {
                return (
                  <div>
                    <Form.Item
                      name="plannerAgentId"
                      style={{ marginTop: '8px', marginBottom: 0 }}
                    >
                      <Select
                        placeholder={t('autoTask.planning.selectAgent')}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        {task?.agents?.map((agent: any) => (
                          <Select.Option key={agent.id} value={agent.id}>
                            {agent.role_name
                              ? `${agent.name} [${agent.role_name}]`
                              : agent.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '11px',
                        color: 'var(--custom-text-secondary)',
                      }}
                    >
                      {t('autoTask.planning.hint')}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form.Item>

        {/* Discussion-only summary toggle */}
        <Form.Item
          noStyle
          shouldUpdate={(prev: any, cur: any) => prev.taskType !== cur.taskType}
        >
          {({ getFieldValue }) => {
            const taskType = getFieldValue('taskType');
            if (taskType !== 'rounds') return null;
            return (
              <Form.Item style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                >
                  <span>{t('autoTask.summary.title')}</span>
                  <Form.Item
                    name="summarize"
                    valuePropName="checked"
                    initialValue={true}
                    style={{ margin: 0 }}
                  >
                    <Switch />
                  </Form.Item>
                </div>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev: any, cur: any) =>
                    prev.summarize !== cur.summarize
                  }
                >
                  {({ getFieldValue: getInner }) => {
                    if (!getInner('summarize')) return null;
                    return (
                      <div>
                        <Form.Item
                          name="summarizerAgentId"
                          style={{ marginTop: '8px', marginBottom: 0 }}
                        >
                          <Select
                            placeholder={t('autoTask.summary.selectAgent')}
                            allowClear
                            style={{ width: '100%' }}
                          >
                            {task?.agents?.map((agent: any) => (
                              <Select.Option key={agent.id} value={agent.id}>
                                {agent.role_name
                                  ? `${agent.name} [${agent.role_name}]`
                                  : agent.name}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '11px',
                            color: 'var(--custom-text-secondary)',
                          }}
                        >
                          {t('autoTask.summary.hint')}
                        </div>
                      </div>
                    );
                  }}
                </Form.Item>
              </Form.Item>
            );
          }}
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev: any, cur: any) => prev.taskType !== cur.taskType}
        >
          {({ getFieldValue }) => {
            const taskType = getFieldValue('taskType');

            // ---------- time_trigger ----------
            if (taskType === 'time_trigger') {
              return (
                <div>
                  <Divider>{t('autoTask.timeTrigger.divider')}</Divider>

                  <Form.Item
                    name="timeInterval"
                    label={t('autoTask.timeTrigger.interval.label')}
                    initialValue={30}
                    rules={[
                      {
                        required: true,
                        message: t('autoTask.timeTrigger.interval.required'),
                      },
                      {
                        validator: (_: any, value: any) => {
                          if (value === undefined || value === null)
                            return Promise.resolve();
                          if (value >= 1 && value <= 1440)
                            return Promise.resolve();
                          return Promise.reject(
                            new Error(t('autoTask.timeTrigger.interval.range'))
                          );
                        },
                      },
                    ]}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={1}
                        max={1440}
                        style={{ width: '100%' }}
                        placeholder={t('autoTask.timeTrigger.interval.placeholder')}
                      />
                      <Button disabled style={{ pointerEvents: 'none' }}>
                        {t('autoTask.timeTrigger.unit.minutes')}
                      </Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="maxExecutions"
                    label={t('autoTask.timeTrigger.maxExecutions.label')}
                    initialValue={0}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                        placeholder={t('autoTask.timeTrigger.maxExecutions.placeholder')}
                      />
                      <Button disabled style={{ pointerEvents: 'none' }}>
                        {t('autoTask.timeTrigger.unit.times')}
                      </Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="triggerAction"
                    label={t('autoTask.timeTrigger.action.label')}
                    initialValue="single_round"
                  >
                    <Radio.Group>
                      <Radio value="single_round">
                        {t('autoTask.timeTrigger.action.singleRound')}
                      </Radio>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item
                    name="enableTimeLimit"
                    label={t('autoTask.timeTrigger.enableTimeLimit.label')}
                    valuePropName="checked"
                    initialValue={false}
                  >
                    <Switch />
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prev: any, cur: any) =>
                      prev.enableTimeLimit !== cur.enableTimeLimit
                    }
                  >
                    {({ getFieldValue: getInner }) => {
                      if (!getInner('enableTimeLimit')) return null;
                      return (
                        <Form.Item
                          name="totalTimeLimit"
                          label={t('autoTask.timeTrigger.totalTimeLimit.label')}
                          initialValue={1440}
                          rules={[
                            {
                              required: true,
                              message: t('autoTask.timeTrigger.totalTimeLimit.required'),
                            },
                            {
                              validator: (_: any, value: any) => {
                                if (value === undefined || value === null)
                                  return Promise.resolve();
                                if (value >= 1 && value <= 10080)
                                  return Promise.resolve();
                                return Promise.reject(
                                  new Error(
                                    t('autoTask.timeTrigger.totalTimeLimit.range')
                                  )
                                );
                              },
                            },
                          ]}
                        >
                          <Space.Compact style={{ width: '100%' }}>
                            <InputNumber
                              min={1}
                              max={10080}
                              style={{ width: '100%' }}
                            />
                            <Button disabled style={{ pointerEvents: 'none' }}>
                              {t('autoTask.timeTrigger.unit.minutes')}
                            </Button>
                          </Space.Compact>
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                </div>
              );
            }

            // ---------- infinite (variable stop) ----------
            if (taskType === 'infinite') {
              return (
                <div>
                  <Divider>{t('autoTask.varStop.divider')}</Divider>
                  <p style={{ marginBottom: '16px' }}>
                    {t('autoTask.varStop.intro')}
                  </p>

                  <Form.List name="stopConditions">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field) =>
                          renderConditionRow('stopConditions', field, remove, false)
                        )}

                        <Form.Item>
                          <Button
                            type="dashed"
                            onClick={() => add()}
                            block
                            icon={<PlusOutlined />}
                          >
                            {t('autoTask.varStop.addCondition')}
                          </Button>
                        </Form.Item>

                        {fields.length > 1 && (
                          <Form.Item name="conditionLogic" initialValue="and">
                            <Radio.Group>
                              <Radio value="and">
                                {t('autoTask.varStop.allConditions')}
                              </Radio>
                              <Radio value="or">
                                {t('autoTask.varStop.anyCondition')}
                              </Radio>
                            </Radio.Group>
                          </Form.Item>
                        )}
                      </>
                    )}
                  </Form.List>

                  <Form.Item
                    name="maxRuntime"
                    label={t('autoTask.varStop.maxRuntime.label')}
                    initialValue={0}
                  >
                    <InputNumber min={0} max={180} style={{ width: '100%' }} />
                  </Form.Item>
                </div>
              );
            }

            // ---------- variable_trigger ----------
            if (taskType === 'variable_trigger') {
              return (
                <div>
                  <Divider>{t('autoTask.varTrigger.divider')}</Divider>
                  <p style={{ marginBottom: '16px' }}>
                    {t('autoTask.varTrigger.intro')}
                  </p>

                  <Form.Item label={t('autoTask.varTrigger.conditionsLabel')}>
                    <p
                      style={{
                        marginBottom: '16px',
                        fontSize: '12px',
                        color: 'var(--custom-text-secondary)',
                      }}
                    >
                      {t('autoTask.varTrigger.conditionsHint')}
                    </p>
                    <Form.List name="triggerConditions">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map((field) =>
                            renderConditionRow(
                              'triggerConditions',
                              field,
                              remove,
                              true
                            )
                          )}

                          <Form.Item>
                            <Button
                              type="dashed"
                              onClick={() => add()}
                              block
                              icon={<PlusOutlined />}
                            >
                              {t('autoTask.varTrigger.addCondition')}
                            </Button>
                          </Form.Item>

                          {fields.length > 1 && (
                            <Form.Item
                              name="triggerConditionLogic"
                              initialValue="and"
                            >
                              <Radio.Group>
                                <Radio value="and">
                                  {t('autoTask.varStop.allConditions')}
                                </Radio>
                                <Radio value="or">
                                  {t('autoTask.varStop.anyCondition')}
                                </Radio>
                              </Radio.Group>
                            </Form.Item>
                          )}
                        </>
                      )}
                    </Form.List>
                  </Form.Item>

                  <Form.Item
                    name="checkInterval"
                    label={t('autoTask.varTrigger.checkInterval.label')}
                    initialValue={60}
                    rules={[
                      {
                        required: true,
                        message: t('autoTask.varTrigger.checkInterval.required'),
                      },
                      {
                        validator: (_: any, value: any) => {
                          if (value === undefined || value === null)
                            return Promise.resolve();
                          if (value >= 10 && value <= 3600)
                            return Promise.resolve();
                          return Promise.reject(
                            new Error(t('autoTask.varTrigger.checkInterval.range'))
                          );
                        },
                      },
                    ]}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber min={10} max={3600} style={{ width: '100%' }} />
                      <Button disabled style={{ pointerEvents: 'none' }}>
                        {t('autoTask.varTrigger.unit.seconds')}
                      </Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="maxTriggerExecutions"
                    label={t('autoTask.varTrigger.maxExecutions.label')}
                    initialValue={0}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber min={0} max={100} style={{ width: '100%' }} />
                      <Button disabled style={{ pointerEvents: 'none' }}>
                        {t('autoTask.timeTrigger.unit.times')}
                      </Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="variableTriggerAction"
                    label={t('autoTask.varTrigger.action.label')}
                    initialValue="single_round"
                  >
                    <Radio.Group>
                      <Radio value="single_round">
                        {t('autoTask.varTrigger.action.singleRound')}
                      </Radio>
                      <Radio value="discussion">
                        {t('autoTask.varTrigger.action.discussion')}
                      </Radio>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prev: any, cur: any) =>
                      prev.variableTriggerAction !== cur.variableTriggerAction
                    }
                  >
                    {({ getFieldValue: getInner }) => {
                      if (getInner('variableTriggerAction') !== 'discussion')
                        return null;
                      return (
                        <Form.Item
                          name="variableTriggerRounds"
                          label={t('autoTask.varTrigger.rounds.label')}
                          initialValue={2}
                        >
                          <Space.Compact style={{ width: '100%' }}>
                            <InputNumber min={1} max={9999} style={{ width: '100%' }} />
                            <Button disabled style={{ pointerEvents: 'none' }}>
                              {t('autoTask.varTrigger.unit.rounds')}
                            </Button>
                          </Space.Compact>
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                </div>
              );
            }

            // ---------- autonomous_scheduling ----------
            if (taskType === 'autonomous_scheduling') {
              return (
                <div>
                  <Divider>{t('autoTask.autoSched.divider')}</Divider>
                  <div style={{ marginBottom: '16px' }}>
                    <p>
                      <Trans
                        t={t}
                        i18nKey="autoTask.autoSched.intro"
                        components={{ code: <code /> }}
                      />
                    </p>
                    <p
                      style={{
                        marginTop: '8px',
                        marginBottom: 0,
                        fontSize: '12px',
                        color: 'var(--custom-text-secondary)',
                      }}
                    >
                      {t('autoTask.autoSched.stopHint')}
                    </p>
                    <ul
                      style={{
                        marginTop: '4px',
                        marginBottom: 0,
                        fontSize: '12px',
                        color: 'var(--custom-text-secondary)',
                        paddingLeft: '20px',
                      }}
                    >
                      <li>
                        <Trans
                          t={t}
                          i18nKey="autoTask.autoSched.stop.empty"
                          components={{ code: <code /> }}
                        />
                      </li>
                      <li>
                        <Trans
                          t={t}
                          i18nKey="autoTask.autoSched.stop.unset"
                          components={{ code: <code /> }}
                        />
                      </li>
                      <li>{t('autoTask.autoSched.stop.maxRounds')}</li>
                      <li>{t('autoTask.autoSched.stop.timeout')}</li>
                    </ul>
                  </div>

                  <Form.Item
                    name="maxRounds"
                    label={t('autoTask.autoSched.maxRounds.label')}
                    initialValue={50}
                    rules={[
                      {
                        required: true,
                        message: t('autoTask.autoSched.maxRounds.required'),
                      },
                      {
                        validator: (_: any, value: any) => {
                          if (value === undefined || value === null)
                            return Promise.resolve();
                          if (value >= 1 && value <= 100)
                            return Promise.resolve();
                          return Promise.reject(
                            new Error(t('autoTask.autoSched.maxRounds.range'))
                          );
                        },
                      },
                    ]}
                    tooltip={t('autoTask.autoSched.maxRounds.tooltip')}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber min={1} max={100} style={{ width: '100%' }} />
                      <Button disabled style={{ pointerEvents: 'none' }}>
                        {t('autoTask.timeTrigger.unit.times')}
                      </Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item
                    name="timeoutMinutes"
                    label={t('autoTask.autoSched.timeout.label')}
                    initialValue={60}
                    rules={[
                      {
                        required: true,
                        message: t('autoTask.autoSched.timeout.required'),
                      },
                      {
                        validator: (_: any, value: any) => {
                          if (value === undefined || value === null)
                            return Promise.resolve();
                          if (value >= 1 && value <= 480)
                            return Promise.resolve();
                          return Promise.reject(
                            new Error(t('autoTask.autoSched.timeout.range'))
                          );
                        },
                      },
                    ]}
                    tooltip={t('autoTask.autoSched.timeout.tooltip')}
                  >
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber min={1} max={480} style={{ width: '100%' }} />
                      <Button disabled style={{ pointerEvents: 'none' }}>
                        {t('autoTask.timeTrigger.unit.minutes')}
                      </Button>
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
