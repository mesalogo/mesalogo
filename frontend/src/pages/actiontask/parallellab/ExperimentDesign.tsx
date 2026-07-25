import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  Row,
  Col,
  Select,
  InputNumber,
  Input,
  Form,
  Space,
  Table,
  Tooltip,
  Typography,
  Tag,
  Statistic,
  Modal,
  Empty,
  message
} from 'antd';
import {
  ExperimentOutlined,
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  EditOutlined,
  EyeOutlined,
  WarningOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { modelConfigAPI } from '../../../services/api/model';
import { settingsAPI } from '../../../services/api/settings';
import { getAssistantGenerationModelId } from '../../../utils/modelUtils';
import { replaceTemplateVariables } from '../../../utils/templateUtils';
import {
  getProtocolGenerationAvailability,
  type ProtocolGenerationDisabledReason
} from './protocolGeneration';

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

interface Variable {
  key: string;
  name: string;
  type: 'enumerated' | 'stepped' | 'random';
  values?: (string | number)[];
  start?: number;
  step?: number;
  end?: number;
  min?: number;
  max?: number;
  count?: number;
  originalValue?: any;
}

interface Objective {
  key: string;
  variable: string;
  type: 'maximize' | 'minimize';
  weight: number;
  description?: string;
}

interface StopCondition {
  key: string;
  expression: string;
}

interface ExperimentDesignProps {
  actionSpaces: any[];
  experimentConfig: any;
  setExperimentConfig: (config: any) => void;
  selectedSpace: string | null;
  setSelectedSpace: (id: string | null) => void;
  handleCreateExperiment: (config: any) => void;
  handleStartExperiment?: () => void;
  loading: boolean;
  readOnly?: boolean;
  hideBasicInfo?: boolean;
  existingVariables?: any;
  existingObjectives?: any[];
  existingStopConditions?: any[];
  existingTaskConfig?: any;
  existingCustomVariables?: string[];
  existingProtocol?: string;
  existingExperimentType?: 'comparative' | 'normal';
  models?: any[];
  globalSettings?: any;
}

const ExperimentDesign: React.FC<ExperimentDesignProps> = ({
  actionSpaces,
  experimentConfig,
  setExperimentConfig,
  selectedSpace,
  setSelectedSpace,
  handleCreateExperiment,
  handleStartExperiment,
  loading,
  readOnly = false,
  hideBasicInfo = false,
  existingVariables,
  existingObjectives,
  existingStopConditions,
  existingTaskConfig,
  existingCustomVariables,
  existingProtocol,
  existingExperimentType,
  models = [],
  globalSettings = {}
}) => {
  const { t } = useTranslation();
  const [newVariableName, setNewVariableName] = useState('');
  const [newVariableModalVisible, setNewVariableModalVisible] = useState(false);
  const [customVariables, setCustomVariables] = useState<string[]>(existingCustomVariables || []);
  const [spaceVariables, setSpaceVariables] = useState<any[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [stopConditions, setStopConditions] = useState<StopCondition[]>([]);
  const [loadingSpace, setLoadingSpace] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [variableModalVisible, setVariableModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [experimentType, setExperimentType] = useState<'comparative' | 'normal'>('comparative');
  const [taskConfig, setTaskConfig] = useState({
    type: 'discussion' as string,
    rounds: 3,
    topic: '',
    totalTasks: 3,      // 总任务数（普通任务手动设置，对比实验自动计算）
    maxConcurrent: 3,   // 最大同时运行数
    singleTaskTimeout: 60  // 单任务超时（分钟），0表示不限制
  });

  // 实验协议相关状态
  const [experimentProtocol, setExperimentProtocol] = useState<string>(existingProtocol || '');
  const [protocolModalVisible, setProtocolModalVisible] = useState(false);
  const [generatingProtocol, setGeneratingProtocol] = useState(false);
  const protocolGenerationAvailability = getProtocolGenerationAvailability({
    readOnly,
    selectedSpace,
    enableAssistantGeneration:
      globalSettings?.enableAssistantGeneration === true,
    enableExperimentProtocolGeneration:
      globalSettings?.enableExperimentProtocolGeneration === true
  });

  const getProtocolGenerationDisabledMessage = (
    reason: ProtocolGenerationDisabledReason | null
  ) => {
    switch (reason) {
      case 'read-only':
        return t('parallelLab.design.msg.protocolReadOnly');
      case 'assistant-disabled':
        return t('parallelLab.design.msg.assistantDisabled');
      case 'protocol-disabled':
        return t('parallelLab.design.msg.protocolGenerationDisabled');
      case 'space-required':
        return t('parallelLab.design.msg.spaceRequired');
      default:
        return undefined;
    }
  };

  // 初始化已有数据（无论是否 readOnly，只要有数据就回填）
  // 注意：不依赖 spaceVariables，避免异步加载导致的时序问题
  useEffect(() => {
    // 初始化实验类型
    if (existingExperimentType) {
      setExperimentType(existingExperimentType);
    }

    if (existingVariables && Object.keys(existingVariables).length > 0) {
      const vars: Variable[] = Object.entries(existingVariables).map(([name, config]: [string, any], idx) => ({
        key: `var-${idx}`,
        name,
        type: config.type || 'enumerated',
        values: config.values,
        start: config.start,
        step: config.step,
        end: config.end,
        min: config.min,
        max: config.max,
        count: config.count
      }));
      setVariables(vars);
    }
    if (existingObjectives && existingObjectives.length > 0) {
      setObjectives(existingObjectives.map((o: any, idx: number) => ({
        key: `obj-${idx}`,
        variable: o.variable,
        type: o.type,
        weight: o.weight || 1,
        description: o.description || ''
      })));
    }
    if (existingStopConditions && existingStopConditions.length > 0) {
      setStopConditions(existingStopConditions.map((c: any, idx: number) => ({
        key: `cond-${idx}`,
        expression: c.expression || c
      })));
    }
    if (existingTaskConfig) {
      setTaskConfig({
        type: existingTaskConfig.type || 'discussion',
        rounds: existingTaskConfig.rounds || 3,
        topic: existingTaskConfig.topic || '',
        totalTasks: existingTaskConfig.totalTasks || 3,
        maxConcurrent: existingTaskConfig.maxConcurrent || 3,
        singleTaskTimeout: existingTaskConfig.singleTaskTimeout ?? 60
      });
    }
    if (existingCustomVariables && existingCustomVariables.length > 0) {
      setCustomVariables(existingCustomVariables);
    }
    if (existingProtocol) {
      setExperimentProtocol(existingProtocol);
    }
  }, [existingVariables, existingObjectives, existingStopConditions, existingTaskConfig, existingCustomVariables, existingProtocol, existingExperimentType]);

  // 当 spaceVariables 加载完成后，补充自定义变量列表
  useEffect(() => {
    if (spaceVariables.length === 0) return;

    const customVarsFromProps = existingCustomVariables || [];
    const objectiveVarNames = (existingObjectives || []).map((o: any) => o.variable).filter(Boolean);
    const scanVarNames = existingVariables ? Object.keys(existingVariables) : [];
    const spaceVarNames = spaceVariables.map(v => v.name);
    // 找出目标变量中不在其他列表中的变量名
    const additionalCustomVars = objectiveVarNames.filter((name: string) =>
      !customVarsFromProps.includes(name) &&
      !scanVarNames.includes(name) &&
      !spaceVarNames.includes(name)
    );
    const allCustomVars = [...new Set([...customVarsFromProps, ...additionalCustomVars])];
    if (allCustomVars.length > 0) {
      setCustomVariables(allCustomVars);
    }
  }, [spaceVariables, existingCustomVariables, existingObjectives, existingVariables]);

  // 当选择行动空间时，加载其变量
  useEffect(() => {
    if (selectedSpace) {
      loadSpaceVariables(selectedSpace);
    } else {
      setSpaceVariables([]);
      setVariables([]);
    }
  }, [selectedSpace]);

  const loadSpaceVariables = async (spaceId: string) => {
    setLoadingSpace(true);
    try {
      const detail = await actionSpaceAPI.getDetail(spaceId);
      const vars = detail.shared_variables || detail.environment_variables || [];
      setSpaceVariables(vars);
    } catch (error) {
      console.error('load action-space variables failed:', error);
    } finally {
      setLoadingSpace(false);
    }
  };

  // 添加变量到扫描列表（修复问题1：生成合理的默认扫描值）
  const handleAddVariable = (spaceVar: any) => {
    if (variables.find(v => v.name === spaceVar.name)) {
      return;
    }
    const originalValue = spaceVar.value;
    let defaultValues: (string | number)[] = [originalValue];

    // 根据原始值类型生成合理的默认扫描值
    if (typeof originalValue === 'number') {
      // 数值类型：生成原值的 50%, 75%, 100%, 125%, 150%
      const base = originalValue || 1;
      defaultValues = [
        Math.round(base * 0.5 * 100) / 100,
        Math.round(base * 0.75 * 100) / 100,
        base,
        Math.round(base * 1.25 * 100) / 100,
        Math.round(base * 1.5 * 100) / 100
      ].filter((v, i, arr) => arr.indexOf(v) === i); // 去重
    } else if (typeof originalValue === 'boolean') {
      // 布尔类型：转为字符串表示
      defaultValues = ['true', 'false'];
    } else if (typeof originalValue === 'string') {
      // 字符串类型：只保留原值，用户需手动编辑
      defaultValues = [originalValue];
    }

    const newVar: Variable = {
      key: Date.now().toString(),
      name: spaceVar.name,
      type: 'enumerated',
      values: defaultValues,
      originalValue: originalValue
    };
    setVariables([...variables, newVar]);

    // 提示用户编辑变量配置
    if (defaultValues.length <= 1) {
      message.info(t('parallelLab.design.msg.editToConfigure', { name: spaceVar.name }));
    }
  };

  // 编辑变量配置
  const handleEditVariable = (variable: Variable) => {
    setEditingVariable({ ...variable });
    setVariableModalVisible(true);
  };

  // 保存变量配置
  const handleSaveVariable = () => {
    if (!editingVariable) return;
    setVariables(variables.map(v =>
      v.key === editingVariable.key ? editingVariable : v
    ));
    setVariableModalVisible(false);
    setEditingVariable(null);
  };

  // 删除变量
  const handleDeleteVariable = (key: string) => {
    setVariables(variables.filter(v => v.key !== key));
  };

  // 获取所有可用变量（行动空间变量 + 自定义变量）
  const getAllAvailableVariables = () => {
    const allVars = [...spaceVariables];
    customVariables.forEach(name => {
      if (!allVars.find(v => v.name === name)) {
        allVars.push({ name, value: 0, isCustom: true });
      }
    });
    return allVars;
  };

  // 获取可用于目标的变量（排除已作为扫描参数的变量）
  const getAvailableObjectiveVariables = () => {
    const allVars = getAllAvailableVariables();
    const scanVarNames = variables.map(v => v.name);
    return allVars.filter(v => !scanVarNames.includes(v.name));
  };

  // 添加目标
  const handleAddObjective = () => {
    const availableVars = getAvailableObjectiveVariables();
    const newObj: Objective = {
      key: Date.now().toString(),
      variable: availableVars[0]?.name || '',
      type: 'maximize',
      weight: 1.0,
      description: ''
    };
    setObjectives([...objectives, newObj]);
  };

  // 添加自定义目标变量
  const [newObjectiveVarName, setNewObjectiveVarName] = useState('');
  const [newObjectiveVarModalVisible, setNewObjectiveVarModalVisible] = useState(false);

  const handleAddCustomObjectiveVariable = () => {
    if (!newObjectiveVarName.trim()) {
      message.warning(t('parallelLab.design.msg.varNameRequired'));
      return;
    }
    const varName = newObjectiveVarName.trim();
    if (spaceVariables.find(v => v.name === varName) || customVariables.includes(varName)) {
      message.warning(t('parallelLab.design.msg.varNameExists'));
      return;
    }
    if (variables.find(v => v.name === varName)) {
      message.warning(t('parallelLab.design.msg.scanVarConflict'));
      return;
    }
    // 添加到自定义变量列表（但不添加到扫描列表）
    setCustomVariables([...customVariables, varName]);
    // 直接添加为目标
    const newObj: Objective = {
      key: Date.now().toString(),
      variable: varName,
      type: 'maximize',
      weight: 1.0,
      description: ''
    };
    setObjectives([...objectives, newObj]);
    setNewObjectiveVarName('');
    setNewObjectiveVarModalVisible(false);
    message.success(t('parallelLab.design.msg.targetVarAdded', { name: varName }));
  };

  // 添加停止条件
  const handleAddStopCondition = () => {
    const newCondition: StopCondition = {
      key: Date.now().toString(),
      expression: ''
    };
    setStopConditions([...stopConditions, newCondition]);
  };

  // 计算参数组合数
  const calculateCombinations = () => {
    if (variables.length === 0) return 0;
    return variables.reduce((total, v) => {
      let count = 1;
      if (v.type === 'enumerated') {
        count = v.values?.length || 1;
      } else if (v.type === 'stepped' && v.start !== undefined && v.end !== undefined && v.step) {
        count = Math.floor((v.end - v.start) / v.step) + 1;
      } else if (v.type === 'random') {
        count = v.count || 10;
      }
      return total * count;
    }, 1);
  };

  // 生成参数组合列表（修复问题4：预览参数组合）
  const generateCombinations = (): Record<string, any>[] => {
    if (variables.length === 0) return [];

    // 为每个变量生成值列表
    const variableValues: { name: string; values: any[] }[] = variables.map(v => {
      if (v.type === 'enumerated') {
        return { name: v.name, values: v.values || [] };
      } else if (v.type === 'stepped' && v.start !== undefined && v.end !== undefined && v.step && v.step > 0) {
        const values: number[] = [];
        for (let val = v.start; val <= v.end; val += v.step) {
          values.push(Math.round(val * 1000) / 1000);
        }
        return { name: v.name, values };
      } else if (v.type === 'random' && v.min !== undefined && v.max !== undefined && v.count) {
        const values: number[] = [];
        for (let i = 0; i < v.count; i++) {
          values.push(Math.round((v.min + Math.random() * (v.max - v.min)) * 1000) / 1000);
        }
        return { name: v.name, values };
      }
      return { name: v.name, values: [] };
    });

    // 笛卡尔积
    const cartesian = (arrays: any[][]): any[][] => {
      return arrays.reduce((acc, arr) => {
        return acc.flatMap(x => arr.map(y => [...x, y]));
      }, [[]] as any[][]);
    };

    const allValues = variableValues.map(v => v.values);
    const combinations = cartesian(allValues);

    return combinations.map(combo => {
      const obj: Record<string, any> = {};
      variableValues.forEach((v, idx) => {
        obj[v.name] = combo[idx];
      });
      return obj;
    });
  };

  // 验证配置
  const validateConfig = (): string[] => {
    const errors: string[] = [];

    // 普通任务模式不需要验证变量配置
    if (experimentType === 'normal') {
      return errors;
    }

    variables.forEach(v => {
      if (v.type === 'enumerated') {
        if (!v.values || v.values.length < 2) {
          errors.push(t('parallelLab.design.validation.enumeratedMin', { name: v.name }));
        }
      } else if (v.type === 'stepped') {
        if (v.start === undefined || v.end === undefined || v.step === undefined) {
          errors.push(t('parallelLab.design.validation.steppedIncomplete', { name: v.name }));
        } else {
          if (v.start >= v.end) {
            errors.push(t('parallelLab.design.validation.startLessThanEnd', { name: v.name }));
          }
          if (v.step <= 0) {
            errors.push(t('parallelLab.design.validation.stepPositive', { name: v.name }));
          }
        }
      } else if (v.type === 'random') {
        if (v.min === undefined || v.max === undefined || v.count === undefined) {
          errors.push(t('parallelLab.design.validation.randomIncomplete', { name: v.name }));
        } else {
          if (v.min >= v.max) {
            errors.push(t('parallelLab.design.validation.minLessThanMax', { name: v.name }));
          }
          if (v.count < 1) {
            errors.push(t('parallelLab.design.validation.countAtLeastOne', { name: v.name }));
          }
        }
      }
    });

    return errors;
  };

  // 实时验证
  useEffect(() => {
    if (!readOnly) {
      setValidationErrors(validateConfig());
    }
  }, [variables, readOnly, experimentType]);

  // 构建配置对象
  const buildConfig = () => {
    const variablesConfig: Record<string, any> = {};

    if (experimentType === 'normal') {
      // 普通任务：变量使用固定值
      variables.forEach(v => {
        // 对于普通任务，使用第一个值作为固定值
        if (v.type === 'enumerated' && v.values && v.values.length > 0) {
          variablesConfig[v.name] = v.values[0];
        } else if (v.type === 'stepped' && v.start !== undefined) {
          variablesConfig[v.name] = v.start;
        } else if (v.type === 'random' && v.min !== undefined) {
          variablesConfig[v.name] = v.min;
        }
      });
    } else {
      // 对比实验：变量使用扫描配置
      variables.forEach(v => {
        if (v.type === 'enumerated') {
          variablesConfig[v.name] = { type: 'enumerated', values: v.values };
        } else if (v.type === 'stepped') {
          variablesConfig[v.name] = { type: 'stepped', start: v.start, step: v.step, end: v.end };
        } else if (v.type === 'random') {
          variablesConfig[v.name] = { type: 'random', min: v.min, max: v.max, count: v.count };
        }
      });
    }

    return {
      experiment_type: experimentType,
      variables: variablesConfig,
      objectives: objectives.map(o => ({
        variable: o.variable,
        type: o.type,
        weight: o.weight,
        description: o.description || ''
      })),
      stopConditions: stopConditions.map(c => ({ expression: c.expression })),
      customVariables: customVariables,
      task_config: {
        type: stopConditions.length > 0 ? 'conditional_stop' : 'discussion',
        rounds: taskConfig.rounds,
        topic: taskConfig.topic,
        totalTasks: taskConfig.totalTasks,
        maxConcurrent: taskConfig.maxConcurrent,
        singleTaskTimeout: taskConfig.singleTaskTimeout
      },
      experiment_protocol: experimentProtocol || undefined
    };
  };

  // 生成实验协议（流式，前端直接调用模型）
  const handleGenerateProtocol = async () => {
    if (!selectedSpace) {
      message.warning(t('parallelLab.design.msg.spaceRequired'));
      return;
    }

    if (!globalSettings?.enableAssistantGeneration) {
      message.warning(t('parallelLab.design.msg.assistantDisabled'));
      return;
    }

    if (!globalSettings?.enableExperimentProtocolGeneration) {
      message.warning(t('parallelLab.design.msg.protocolGenerationDisabled'));
      return;
    }

    setGeneratingProtocol(true);
    setExperimentProtocol(''); // 清空现有内容

    try {
      // 获取提示词模板
      let promptTemplate;
      try {
        const templates = await settingsAPI.getPromptTemplates();
        promptTemplate = templates.experimentProtocolGeneration;
        if (!promptTemplate) {
          throw new Error(t('parallelLab.design.msg.templateMissing'));
        }
      } catch (error) {
        console.error('fetch prompt template failed:', error);
        message.error(t('parallelLab.design.msg.templateFetchFailed'));
        setGeneratingProtocol(false);
        return;
      }

      // 构建变量配置JSON
      const variablesConfig: Record<string, any> = {};
      variables.forEach(v => {
        if (v.type === 'enumerated') {
          variablesConfig[v.name] = { type: 'enumerated', values: v.values };
        } else if (v.type === 'stepped') {
          variablesConfig[v.name] = { type: 'stepped', start: v.start, step: v.step, end: v.end };
        } else if (v.type === 'random') {
          variablesConfig[v.name] = { type: 'random', min: v.min, max: v.max, count: v.count };
        }
      });

      // 获取行动空间信息
      const currentSpace = actionSpaces.find(s => s.id === selectedSpace);

      // 替换模板变量
      const generatePrompt = replaceTemplateVariables(promptTemplate, {
        experiment_name: experimentConfig.name || t('parallelLab.design.protocol.unnamedExperiment'),
        action_space_name: currentSpace?.name || '',
        action_space_description: currentSpace?.description || '',
        roles: currentSpace?.variables?.join(', ') || t('parallelLab.design.protocol.noRoles'),
        topic: taskConfig.topic || t('parallelLab.design.protocol.noTopic'),
        variables_json: JSON.stringify(variablesConfig, null, 2),
        objectives_json: JSON.stringify(objectives.map(o => ({
          variable: o.variable,
          type: o.type,
          weight: o.weight
        })), null, 2)
      });

      // 获取模型
      const modelToUse = await getAssistantGenerationModelId(
        models,
        globalSettings?.experimentProtocolModel || 'default'
      );

      let generatedProtocol = '';
      const handleStreamResponse = (chunk: string) => {
        if (chunk && chunk !== 'null' && chunk !== 'undefined' && typeof chunk === 'string') {
          generatedProtocol += chunk;
          setExperimentProtocol(generatedProtocol);
        }
      };

      await modelConfigAPI.testModelStream(
        modelToUse,
        generatePrompt,
        handleStreamResponse,
        t('parallelLab.design.protocol.systemPrompt'),
        { temperature: 0.7, max_tokens: 2000 }
      );

      setExperimentProtocol(generatedProtocol.trim());
      message.success(t('parallelLab.design.msg.protocolGenerated'));
    } catch (error: any) {
      console.error('generate experiment protocol failed:', error);
      message.error(error.message || t('parallelLab.design.msg.protocolFailed'));
    } finally {
      setGeneratingProtocol(false);
    }
  };

  // 保存配置（不启动）
  const handleSaveConfig = () => {
    const config = buildConfig();
    handleCreateExperiment(config);
  };

  // 变量配置表格列
  const variableColumns = [
    {
      title: t('parallelLab.design.col.varName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text code>{text}</Text>
    },
    {
      title: t('parallelLab.design.col.scanType'),
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'enumerated' ? 'blue' : type === 'stepped' ? 'green' : 'orange'}>
          {type === 'enumerated'
            ? t('parallelLab.design.typeEnumerated')
            : type === 'stepped'
              ? t('parallelLab.design.typeStepped')
              : t('parallelLab.design.typeRandom')}
        </Tag>
      )
    },
    {
      title: t('parallelLab.design.col.config'),
      key: 'config',
      render: (_: any, record: Variable) => {
        if (record.type === 'enumerated') {
          return <Text code>{JSON.stringify(record.values)}</Text>;
        } else if (record.type === 'stepped') {
          return <Text code>{t('parallelLab.design.cell.steppedFormat', { start: record.start, end: record.end, step: record.step })}</Text>;
        } else if (record.type === 'random') {
          return <Text code>{t('parallelLab.design.cell.randomFormat', { min: record.min, max: record.max, count: record.count })}</Text>;
        }
        return '-';
      }
    },
    {
      title: t('parallelLab.design.col.combinations'),
      key: 'combinations',
      width: 80,
      render: (_: any, record: Variable) => {
        let count = 1;
        if (record.type === 'enumerated') count = record.values?.length || 1;
        else if (record.type === 'stepped' && record.start !== undefined && record.end !== undefined && record.step) {
          count = Math.floor((record.end - record.start) / record.step) + 1;
        } else if (record.type === 'random') count = record.count || 10;
        return <Tag>{count}</Tag>;
      }
    },
    ...(!readOnly ? [{
      title: t('parallelLab.design.col.actions'),
      key: 'action',
      width: 120,
      render: (_: any, record: Variable) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditVariable(record)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteVariable(record.key)} />
        </Space>
      )
    }] : [])
  ];

  // 添加自定义变量（创建后直接添加到扫描列表）
  const handleAddCustomVariable = () => {
    if (!newVariableName.trim()) {
      message.warning(t('parallelLab.design.msg.varNameRequired'));
      return;
    }
    const varName = newVariableName.trim();
    if (spaceVariables.find(v => v.name === varName) || customVariables.includes(varName)) {
      message.warning(t('parallelLab.design.msg.varNameExists'));
      return;
    }
    // 添加到自定义变量列表
    setCustomVariables([...customVariables, varName]);
    // 直接添加到扫描变量列表
    const newVar: Variable = {
      key: Date.now().toString(),
      name: varName,
      type: 'enumerated',
      values: [0],
      originalValue: 0
    };
    setVariables([...variables, newVar]);
    setNewVariableName('');
    setNewVariableModalVisible(false);
    message.success(t('parallelLab.design.msg.customVarAdded', { name: varName }));
  };

  return (
    <div>
      <Form layout="vertical">
        {/* 基础配置 - 可隐藏 */}
        {!hideBasicInfo && (
          <Card size="small" title={t('parallelLab.design.basicInfo')} style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label={t('parallelLab.design.experimentName')} required>
                  <Input
                    placeholder={t('parallelLab.design.experimentNamePlaceholder')}
                    value={experimentConfig.name}
                    onChange={(e) => setExperimentConfig({ ...experimentConfig, name: e.target.value })}
                    disabled={readOnly}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('parallelLab.design.actionSpace')} required>
                  <Select
                    placeholder={t('parallelLab.design.actionSpacePlaceholder')}
                    value={selectedSpace}
                    onChange={setSelectedSpace}
                    loading={loadingSpace}
                    style={{ width: '100%' }}
                    disabled={readOnly}
                  >
                    {actionSpaces.map(space => (
                      <Option key={space.id} value={space.id}>{space.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('parallelLab.design.experimentDesc')}>
                  <Input
                    placeholder={t('parallelLab.design.experimentDescPlaceholder')}
                    value={experimentConfig.description}
                    onChange={(e) => setExperimentConfig({ ...experimentConfig, description: e.target.value })}
                    disabled={readOnly}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        )}

        {/* 实验类型选择 */}
        <Card size="small" title={
          <span>
            {t('parallelLab.design.experimentType')}
            <Tooltip title={t('parallelLab.design.experimentTypeTooltip')}>
              <InfoCircleOutlined style={{ marginLeft: 4 }} />
            </Tooltip>
          </span>
        } style={{ marginBottom: 16 }}>

          <Form.Item label={t('parallelLab.design.experimentType')}>
            <Select
              value={experimentType}
              onChange={(value) => setExperimentType(value)}
              disabled={readOnly}
              style={{ width: '100%' }}
            >
              <Option value="comparative">
                <Space>
                  <ExperimentOutlined />
                  <span>{t('parallelLab.design.typeComparative')}</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('parallelLab.design.typeComparativeDesc')}
                  </Text>
                </Space>
              </Option>
              <Option value="normal">
                <Space>
                  <ThunderboltOutlined />
                  <span>{t('parallelLab.design.typeNormal')}</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('parallelLab.design.typeNormalDesc')}
                  </Text>
                </Space>
              </Option>
            </Select>
          </Form.Item>

        </Card>

        {/* 任务执行配置 */}
        <Card size="small" title={t('parallelLab.design.taskConfig')} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label={t('parallelLab.design.discussionTopic')}
                required
                tooltip={t('parallelLab.design.discussionTopicTooltip')}
              >
                <TextArea
                  placeholder={t('parallelLab.design.discussionTopicPlaceholder')}
                  value={taskConfig.topic}
                  onChange={(e) => setTaskConfig({ ...taskConfig, topic: e.target.value })}
                  disabled={readOnly}
                  rows={3}
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('parallelLab.design.executionRounds')} tooltip={t('parallelLab.design.executionRoundsTooltip2')}>
                <InputNumber
                  min={1}
                  max={20}
                  value={taskConfig.rounds}
                  onChange={(v) => setTaskConfig({ ...taskConfig, rounds: v || 3 })}
                  style={{ width: '100%' }}
                  disabled={readOnly}
                />
              </Form.Item>
            </Col>
            {experimentType === 'normal' ? (
              <>
                <Col span={8}>
                  <Form.Item
                    label={
                      <span>
                        {t('parallelLab.design.totalTasks')}
                        <Tooltip title={t('parallelLab.design.totalTasksTooltip')}>
                          <InfoCircleOutlined style={{ marginLeft: 4 }} />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber
                      min={1}
                      max={9999}
                      value={taskConfig.totalTasks}
                      onChange={(v) => setTaskConfig({ ...taskConfig, totalTasks: v || 3 })}
                      style={{ width: '100%' }}
                      disabled={readOnly}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label={
                      <span>
                        {t('parallelLab.design.maxConcurrent')}
                        <Tooltip title={t('parallelLab.design.maxConcurrentNormalTooltip')}>
                          <InfoCircleOutlined style={{ marginLeft: 4 }} />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber
                      min={1}
                      max={taskConfig.totalTasks || 10}
                      value={taskConfig.maxConcurrent}
                      onChange={(v) => setTaskConfig({ ...taskConfig, maxConcurrent: v || 3 })}
                      style={{ width: '100%' }}
                      disabled={readOnly}
                    />
                  </Form.Item>
                </Col>
              </>
            ) : (
              <Col span={12}>
                <Form.Item
                  label={
                    <span>
                      {t('parallelLab.design.maxConcurrent')}
                      <Tooltip title={t('parallelLab.design.maxConcurrentComparativeTooltip')}>
                        <InfoCircleOutlined style={{ marginLeft: 4 }} />
                      </Tooltip>
                    </span>
                  }
                >
                  <InputNumber
                    min={1}
                    max={10}
                    value={taskConfig.maxConcurrent}
                    onChange={(v) => setTaskConfig({ ...taskConfig, maxConcurrent: v || 3 })}
                    style={{ width: '100%' }}
                    disabled={readOnly}
                  />
                </Form.Item>
              </Col>
            )}
            <Col span={12}>
              <Form.Item
                label={
                  <span>
                    {t('parallelLab.design.singleTaskTimeout')}
                    <Tooltip title={t('parallelLab.design.singleTaskTimeoutTooltip')}>
                      <InfoCircleOutlined style={{ marginLeft: 4 }} />
                    </Tooltip>
                  </span>
                }
              >
                <InputNumber
                  min={0}
                  max={1440}
                  value={taskConfig.singleTaskTimeout}
                  onChange={(v) => setTaskConfig({ ...taskConfig, singleTaskTimeout: v ?? 60 })}
                  style={{ width: '100%' }}
                  disabled={readOnly}
                  addonAfter={t('parallelLab.design.minutes')}
                  placeholder={t('parallelLab.design.timeoutPlaceholder')}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 以下配置仅对比实验模式显示 */}
        {experimentType === 'comparative' && (
          <>
            {/* 可用变量 */}
            {selectedSpace && !readOnly && (
              <Card size="small" title={
                <span>
                  {t('parallelLab.design.availableVariables')}
                  {customVariables.length > 0 && (
                    <Tooltip title={t('parallelLab.design.customVariableTooltip')}>
                      <InfoCircleOutlined style={{ marginLeft: 4, color: '#1677ff' }} />
                    </Tooltip>
                  )}
                </span>
              } style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <Space wrap>
                    {spaceVariables.map(v => (
                      <Tag
                        key={v.name}
                        style={{ cursor: 'pointer', padding: '4px 8px' }}
                        color={variables.find(vv => vv.name === v.name) ? 'green' : 'default'}
                        onClick={() => handleAddVariable(v)}
                      >
                        {v.name} = {JSON.stringify(v.value)}
                        {!variables.find(vv => vv.name === v.name) && <PlusOutlined style={{ marginLeft: 4 }} />}
                      </Tag>
                    ))}
                    {/* 自定义变量标签 */}
                    {customVariables.map(name => (
                      <Tag
                        key={name}
                        style={{ cursor: 'pointer', padding: '4px 8px' }}
                        color={variables.find(vv => vv.name === name) ? 'green' : 'orange'}
                        onClick={() => handleAddVariable({ name, value: 0 })}
                      >
                        {name} <Text type="warning" style={{ fontSize: 10 }}>({t('parallelLab.design.newTag')})</Text>
                        {!variables.find(vv => vv.name === name) && <PlusOutlined style={{ marginLeft: 4 }} />}
                      </Tag>
                    ))}
                    {/* 添加自定义变量按钮 */}
                    <Tag
                      style={{ cursor: 'pointer', padding: '4px 8px', borderStyle: 'dashed' }}
                      onClick={() => setNewVariableModalVisible(true)}
                    >
                      <PlusOutlined /> {t('parallelLab.design.addCustomVariable')}
                    </Tag>
                  </Space>
                </div>
              </Card>
            )}

            {/* 参数配置 - 仅对比实验显示 */}
            <Card size="small" title={
              <span>
                {t('parallelLab.design.paramScanConfig')}
                <Tooltip title={t('parallelLab.design.paramScanTooltip')}>
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              </span>
            } style={{ marginBottom: 16 }}>

              {variables.length > 0 ? (
                <Table
                  dataSource={variables}
                  columns={variableColumns}
                  pagination={false}
                  rowKey="key"
                  style={{ marginBottom: 16 }}
                />
              ) : (
                <Empty description={t('parallelLab.design.selectVariableToScan')} style={{ margin: '16px 0' }} />
              )}

              {/* 验证错误提示 */}
              {!readOnly && validationErrors.length > 0 && (
                <div style={{ marginBottom: 16, padding: '8px 16px', backgroundColor: 'var(--custom-error-bg)', border: '1px solid var(--custom-error-border)', borderRadius: 8 }}>
                  <Space align="start">
                    <WarningOutlined style={{ color: '#ff4d4f', marginTop: 4 }} />
                    <div>
                      <Text strong style={{ color: '#cf1322' }}>{t('parallelLab.design.validation.failed')}</Text>
                      <ul style={{ margin: 0, paddingLeft: 20, color: '#cf1322' }}>
                        {validationErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </Space>
                </div>
              )}
            </Card>

            {/* 优化目标 & 停止条件 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card title={t('parallelLab.design.targetVariable')} size="small" extra={
                  <Tooltip title={t('parallelLab.design.selectTargetTooltip')}>
                    <InfoCircleOutlined />
                  </Tooltip>
                }>
                  {objectives.map(obj => {
                    // 获取可选变量列表，确保当前已选的变量也在列表中
                    const availableVars = getAvailableObjectiveVariables();
                    const currentVarInList = availableVars.find(v => v.name === obj.variable);
                    const optionsToShow = currentVarInList
                      ? availableVars
                      : [...availableVars, { name: obj.variable, isCustom: true }];

                    return (
                      <div key={obj.key} style={{ marginBottom: 12, padding: 8, background: 'var(--custom-header-bg)', borderRadius: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                          <Select
                            value={obj.variable}
                            onChange={(v) => setObjectives(objectives.map(o => o.key === obj.key ? { ...o, variable: v } : o))}
                            style={{ width: 160, marginRight: 8 }}
                            disabled={readOnly}
                            placeholder={t('parallelLab.design.selectVariable')}
                          >
                            {optionsToShow.map(v => (
                              <Option key={v.name} value={v.name}>
                                {v.name}
                                {v.isCustom && (
                                  <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>{t('parallelLab.design.newTag')}</Tag>
                                )}
                              </Option>
                            ))}
                          </Select>
                          <Select
                            value={obj.type}
                            onChange={(v) => setObjectives(objectives.map(o => o.key === obj.key ? { ...o, type: v } : o))}
                            style={{ width: 100, marginRight: 8 }}
                            disabled={readOnly}
                          >
                            <Option value="maximize">{t('parallelLab.design.maximize')}</Option>
                            <Option value="minimize">{t('parallelLab.design.minimize')}</Option>
                          </Select>
                          {!readOnly && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setObjectives(objectives.filter(o => o.key !== obj.key))} />}
                        </div>
                        <Input
                          placeholder={t('parallelLab.design.targetDescPlaceholder')}
                          value={obj.description || ''}
                          onChange={(e) => setObjectives(objectives.map(o => o.key === obj.key ? { ...o, description: e.target.value } : o))}
                          size="small"
                          disabled={readOnly}
                        />
                      </div>
                    );
                  })}
                  {!readOnly && (
                    <Space>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={handleAddObjective}
                        disabled={getAvailableObjectiveVariables().length === 0}
                      >
                        {t('parallelLab.design.addTarget')}
                      </Button>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => setNewObjectiveVarModalVisible(true)}
                      >
                        {t('parallelLab.design.newTargetVariable')}
                      </Button>
                    </Space>
                  )}
                  {!readOnly && getAvailableObjectiveVariables().length === 0 && objectives.length === 0 && (
                    <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                      {t('parallelLab.design.allVariablesUsed')}
                    </Text>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card title={t('parallelLab.design.stopConditions')} size="small">
                  {stopConditions.map(cond => (
                    <div key={cond.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <Input
                        placeholder={t('parallelLab.design.stopConditionPlaceholder')}
                        value={cond.expression}
                        onChange={(e) => setStopConditions(stopConditions.map(c => c.key === cond.key ? { ...c, expression: e.target.value } : c))}
                        style={{ marginRight: 8 }}
                        disabled={readOnly}
                      />
                      {!readOnly && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setStopConditions(stopConditions.filter(c => c.key !== cond.key))} />}
                    </div>
                  ))}
                  {!readOnly && (
                    <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddStopCondition}>
                      {t('parallelLab.design.addCondition')}
                    </Button>
                  )}
                </Card>
              </Col>
            </Row>

            {/* 实验行为协议 */}
            <Card size="small" title={
              <span>
                {t('parallelLab.design.behaviorProtocol')}
                <Tooltip title={t('parallelLab.design.behaviorProtocolTooltip')}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1677ff' }} />
                </Tooltip>
              </span>
            } style={{ marginBottom: 16 }}>
              <Space>
                <Button
                  type={experimentProtocol ? 'default' : 'primary'}
                  icon={<EditOutlined />}
                  onClick={() => setProtocolModalVisible(true)}
                  disabled={readOnly}
                >
                  {experimentProtocol ? t('parallelLab.design.editProtocol') : t('parallelLab.design.configProtocol')}
                </Button>
                {experimentProtocol ? (
                  <Tag color="green">{t('parallelLab.design.protocolConfigured')}</Tag>
                ) : (
                  <Text type="secondary">{t('parallelLab.design.protocolSuggestion')}</Text>
                )}
              </Space>
            </Card>

            {/* 实验预览 */}
            <Card
              size="small"
              title={t('parallelLab.design.experimentPreview')}
              extra={
                !readOnly && variables.length > 0 && (
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewModalVisible(true)}
                    size="small"
                  >
                    {t('parallelLab.design.previewCombinations')}
                  </Button>
                )
              }
              style={{ backgroundColor: 'var(--custom-header-bg)', marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title={t('parallelLab.design.paramCombinations')} value={calculateCombinations()} />
                </Col>
                <Col span={8}>
                  <Statistic title={t('parallelLab.design.targetVariableCount')} value={objectives.length} />
                </Col>
                <Col span={8}>
                  <Statistic title={t('parallelLab.design.stopConditionCount')} value={stopConditions.length} />
                </Col>
              </Row>
            </Card>

            {!readOnly && (
              <Form.Item>
                <Space>
                  <Button
                    icon={<SettingOutlined />}
                    onClick={handleSaveConfig}
                    loading={loading}
                    disabled={variables.length === 0}
                  >
                    {t('parallelLab.design.saveConfig')}
                  </Button>
                  {handleStartExperiment && (
                    <Button
                      type="primary"
                      icon={<ExperimentOutlined />}
                      onClick={handleStartExperiment}
                      loading={loading}
                      disabled={variables.length === 0 || validationErrors.length > 0}
                    >
                      {t('parallelLab.design.startComparativeExperiment')}
                    </Button>
                  )}
                </Space>
              </Form.Item>
            )}
          </>
        )}

        {/* 普通任务模式 */}
        {experimentType === 'normal' && !readOnly && (
          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button
                icon={<SettingOutlined />}
                onClick={handleSaveConfig}
                loading={loading}
              >
                {t('parallelLab.design.saveConfig')}
              </Button>
              {handleStartExperiment && (
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={handleStartExperiment}
                  loading={loading}
                >
                  {t('parallelLab.design.startNormalTask')}
                </Button>
              )}
            </Space>
          </Form.Item>
        )}
      </Form>

      {/* 参数组合预览弹窗 */}
      <Modal
        title={t('parallelLab.design.previewModalTitle')}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>{t('parallelLab.design.previewClose')}</Button>
        ]}
        width={700}
      >
        {(() => {
          const combinations = generateCombinations();
          const maxShow = 50;
          const showCombinations = combinations.slice(0, maxShow);
          return (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Text>{t('parallelLab.design.previewTotalLabel')} <Text strong>{combinations.length}</Text></Text>
                {combinations.length > maxShow && (
                  <Text type="secondary">{t('parallelLab.design.previewShowOnlyFirst', { count: maxShow })}</Text>
                )}
              </div>
              <Table
                dataSource={showCombinations.map((combo, idx) => ({ key: idx, index: idx + 1, ...combo }))}
                columns={[
                  { title: '#', dataIndex: 'index', key: 'index', width: 60 },
                  ...variables.map(v => ({
                    title: v.name,
                    dataIndex: v.name,
                    key: v.name,
                    render: (val: any) => <Text code>{JSON.stringify(val)}</Text>
                  }))
                ]}
                pagination={false}
                size="small"
                scroll={{ y: 400 }}
              />
            </div>
          );
        })()}
      </Modal>

      {/* 变量编辑弹窗 */}
      <Modal
        title={t('parallelLab.design.editVariableTitle')}
        open={variableModalVisible}
        onOk={handleSaveVariable}
        onCancel={() => { setVariableModalVisible(false); setEditingVariable(null); }}
      >
        {editingVariable && (
          <Form layout="vertical">
            <Form.Item label={t('parallelLab.design.variableName')}>
              <Input value={editingVariable.name} disabled />
            </Form.Item>
            <Form.Item label={t('parallelLab.design.scanType')}>
              <Select
                value={editingVariable.type}
                onChange={(v) => setEditingVariable({ ...editingVariable, type: v })}
              >
                <Option value="enumerated">{t('parallelLab.design.typeEnumerated')}</Option>
                <Option value="stepped">{t('parallelLab.design.typeStepped')}</Option>
                <Option value="random">{t('parallelLab.design.typeRandom')}</Option>
              </Select>
            </Form.Item>
            {editingVariable.type === 'enumerated' && (
              <Form.Item label={t('parallelLab.design.enumeratedValuesLabel')}>
                <Input
                  value={editingVariable.values?.join(', ')}
                  onChange={(e) => {
                    const vals = e.target.value.split(',').map(v => {
                      const trimmed = v.trim();
                      const num = Number(trimmed);
                      return isNaN(num) ? trimmed : num;
                    });
                    setEditingVariable({ ...editingVariable, values: vals });
                  }}
                />
              </Form.Item>
            )}
            {editingVariable.type === 'stepped' && (
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item label={t('parallelLab.design.startValue')}>
                    <InputNumber
                      value={editingVariable.start}
                      onChange={(v) => setEditingVariable({ ...editingVariable, start: v || 0 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('parallelLab.design.endValue')}>
                    <InputNumber
                      value={editingVariable.end}
                      onChange={(v) => setEditingVariable({ ...editingVariable, end: v || 0 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('parallelLab.design.stepValue')}>
                    <InputNumber
                      value={editingVariable.step}
                      onChange={(v) => setEditingVariable({ ...editingVariable, step: v || 1 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}
            {editingVariable.type === 'random' && (
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item label={t('parallelLab.design.minValue')}>
                    <InputNumber
                      value={editingVariable.min}
                      onChange={(v) => setEditingVariable({ ...editingVariable, min: v || 0 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('parallelLab.design.maxValue')}>
                    <InputNumber
                      value={editingVariable.max}
                      onChange={(v) => setEditingVariable({ ...editingVariable, max: v || 1 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('parallelLab.design.sampleCount')}>
                    <InputNumber
                      value={editingVariable.count}
                      onChange={(v) => setEditingVariable({ ...editingVariable, count: v || 10 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Form>
        )}
      </Modal>

      {/* 添加自定义变量弹窗 */}
      <Modal
        title={t('parallelLab.design.addCustomVariableTitle')}
        open={newVariableModalVisible}
        onOk={handleAddCustomVariable}
        onCancel={() => { setNewVariableModalVisible(false); setNewVariableName(''); }}
        okText={t('parallelLab.design.addOk')}
        cancelText={t('parallelLab.design.addCancel')}
      >
        <Form layout="vertical">
          <Form.Item
            label={
              <span>
                {t('parallelLab.design.variableName')}
                <Tooltip title={t('parallelLab.design.addCustomVariableTooltip')}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1677ff' }} />
                </Tooltip>
              </span>
            }
            required
          >
            <Input
              placeholder={t('parallelLab.design.addCustomVariablePlaceholder')}
              value={newVariableName}
              onChange={(e) => setNewVariableName(e.target.value)}
              onPressEnter={handleAddCustomVariable}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加自定义目标变量弹窗 */}
      <Modal
        title={t('parallelLab.design.newObjectiveVarTitle')}
        open={newObjectiveVarModalVisible}
        onOk={handleAddCustomObjectiveVariable}
        onCancel={() => { setNewObjectiveVarModalVisible(false); setNewObjectiveVarName(''); }}
        okText={t('parallelLab.design.addOk')}
        cancelText={t('parallelLab.design.addCancel')}
      >
        <Form layout="vertical">
          <Form.Item
            label={
              <span>
                {t('parallelLab.design.variableName')}
                <Tooltip title={t('parallelLab.design.newObjectiveVarTooltip')}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1677ff' }} />
                </Tooltip>
              </span>
            }
            required
          >
            <Input
              placeholder={t('parallelLab.design.newObjectiveVarPlaceholder')}
              value={newObjectiveVarName}
              onChange={(e) => setNewObjectiveVarName(e.target.value)}
              onPressEnter={handleAddCustomObjectiveVariable}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 实验协议编辑弹窗 */}
      <Modal
        title={
          <span>
            {t('parallelLab.design.protocolModalTitle')}
            <Tooltip title={t('parallelLab.design.protocolModalTooltip')}>
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#1677ff' }} />
            </Tooltip>
          </span>
        }
        open={protocolModalVisible}
        onOk={() => setProtocolModalVisible(false)}
        onCancel={() => setProtocolModalVisible(false)}
        width={800}
        footer={[
          <Tooltip
            key="generate-tooltip"
            title={getProtocolGenerationDisabledMessage(
              protocolGenerationAvailability.reason
            )}
          >
            <span>
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleGenerateProtocol}
                loading={generatingProtocol}
                disabled={!protocolGenerationAvailability.enabled}
              >
                {t('parallelLab.design.protocolAiGenerate')}
              </Button>
            </span>
          </Tooltip>,
          <Button key="ok" type="primary" onClick={() => setProtocolModalVisible(false)}>
            {t('parallelLab.design.protocolOk')}
          </Button>
        ]}
      >
        <TextArea
          value={experimentProtocol}
          onChange={(e) => setExperimentProtocol(e.target.value)}
          rows={20}
          disabled={readOnly}
          placeholder={t('parallelLab.design.protocolPlaceholder')}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>
    </div>
  );
};

export default ExperimentDesign;
