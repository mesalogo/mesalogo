import React, { useState, useEffect } from 'react';
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
  Divider,
  Table,
  Tooltip,
  Typography,
  Tag,
  Statistic,
  Modal,
  Empty,
  Alert,
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
  ThunderboltOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { modelConfigAPI } from '../../../services/api/model';
import { settingsAPI } from '../../../services/api/settings';
import { getAssistantGenerationModelId } from '../../../utils/modelUtils';
import { replaceTemplateVariables } from '../../../utils/templateUtils';

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
      console.error('加载行动空间变量失败:', error);
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
      message.info(`已添加变量 ${spaceVar.name}，请点击编辑按钮配置扫描值`);
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
      message.warning('请输入变量名称');
      return;
    }
    const varName = newObjectiveVarName.trim();
    // 检查是否已存在
    if (spaceVariables.find(v => v.name === varName) || customVariables.includes(varName)) {
      message.warning('变量名称已存在');
      return;
    }
    // 检查是否是扫描参数
    if (variables.find(v => v.name === varName)) {
      message.warning('该变量已作为扫描参数，不能同时作为目标变量');
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
    message.success(`已添加目标变量 "${varName}"`);
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
          errors.push(`变量 "${v.name}": 枚举值数量不足，至少需要 2 个值`);
        }
      } else if (v.type === 'stepped') {
        if (v.start === undefined || v.end === undefined || v.step === undefined) {
          errors.push(`变量 "${v.name}": 步进配置不完整，请设置起始值、结束值和步长`);
        } else {
          if (v.start >= v.end) {
            errors.push(`变量 "${v.name}": 起始值必须小于结束值`);
          }
          if (v.step <= 0) {
            errors.push(`变量 "${v.name}": 步长必须为正数`);
          }
        }
      } else if (v.type === 'random') {
        if (v.min === undefined || v.max === undefined || v.count === undefined) {
          errors.push(`变量 "${v.name}": 随机配置不完整，请设置最小值、最大值和采样数`);
        } else {
          if (v.min >= v.max) {
            errors.push(`变量 "${v.name}": 最小值必须小于最大值`);
          }
          if (v.count < 1) {
            errors.push(`变量 "${v.name}": 采样数至少为 1`);
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
      message.warning('请先选择行动空间');
      return;
    }

    if (!globalSettings?.enableAssistantGeneration) {
      message.warning('辅助生成功能未启用，请在系统设置中开启');
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
          throw new Error('未获取到实验协议生成模板');
        }
      } catch (error) {
        console.error('获取提示词模板失败:', error);
        message.error('获取提示词模板失败，请检查系统设置');
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
        experiment_name: experimentConfig.name || '未命名实验',
        action_space_name: currentSpace?.name || '',
        action_space_description: currentSpace?.description || '',
        roles: currentSpace?.variables?.join(', ') || '无',
        topic: taskConfig.topic || '无特定主题',
        variables_json: JSON.stringify(variablesConfig, null, 2),
        objectives_json: JSON.stringify(objectives.map(o => ({
          variable: o.variable,
          type: o.type,
          weight: o.weight
        })), null, 2)
      });

      // 获取模型
      const modelToUse = await getAssistantGenerationModelId(models, globalSettings?.assistantGenerationModel || 'default');

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
        "你是一个专业的实验协议生成助手，擅长为多智能体模拟实验设计清晰的行为协议。请直接输出Markdown格式的协议内容。",
        { temperature: 0.7, max_tokens: 2000 }
      );

      setExperimentProtocol(generatedProtocol.trim());
      message.success('实验协议生成成功');
    } catch (error: any) {
      console.error('生成实验协议失败:', error);
      message.error(error.message || '生成实验协议失败');
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
      title: '变量名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text code>{text}</Text>
    },
    {
      title: '扫描类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'enumerated' ? 'blue' : type === 'stepped' ? 'green' : 'orange'}>
          {type === 'enumerated' ? '枚举值' : type === 'stepped' ? '步进值' : '随机'}
        </Tag>
      )
    },
    {
      title: '配置',
      key: 'config',
      render: (_: any, record: Variable) => {
        if (record.type === 'enumerated') {
          return <Text code>{JSON.stringify(record.values)}</Text>;
        } else if (record.type === 'stepped') {
          return <Text code>{`${record.start} → ${record.end} (步长${record.step})`}</Text>;
        } else if (record.type === 'random') {
          return <Text code>{`${record.min} ~ ${record.max} (${record.count}个)`}</Text>;
        }
        return '-';
      }
    },
    {
      title: '组合数',
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
      title: '操作',
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
      message.warning('请输入变量名称');
      return;
    }
    const varName = newVariableName.trim();
    if (spaceVariables.find(v => v.name === varName) || customVariables.includes(varName)) {
      message.warning('变量名称已存在');
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
    message.success(`已添加自定义变量 "${varName}"，请编辑配置扫描值`);
  };

  return (
    <div>
      <Form layout="vertical">
        {/* 基础配置 - 可隐藏 */}
        {!hideBasicInfo && (
          <Card size="small" title="基础信息" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="实验名称" required>
                  <Input
                    placeholder="输入实验名称"
                    value={experimentConfig.name}
                    onChange={(e) => setExperimentConfig({ ...experimentConfig, name: e.target.value })}
                    disabled={readOnly}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="行动空间" required>
                  <Select
                    placeholder="选择行动空间"
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
                <Form.Item label="实验描述">
                  <Input
                    placeholder="描述实验目的"
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
            实验类型
            <Tooltip title="选择实验类型：对比实验会扫描多个参数值并行运行，普通任务只运行一次">
              <InfoCircleOutlined style={{ marginLeft: 4 }} />
            </Tooltip>
          </span>
        } style={{ marginBottom: 16 }}>

          <Form.Item label="实验类型">
            <Select
              value={experimentType}
              onChange={(value) => setExperimentType(value)}
              disabled={readOnly}
              style={{ width: '100%' }}
            >
              <Option value="comparative">
                <Space>
                  <ExperimentOutlined />
                  <span>对比实验</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    - 扫描多个参数值，并行运行多个实例进行对比
                  </Text>
                </Space>
              </Option>
              <Option value="normal">
                <Space>
                  <ThunderboltOutlined />
                  <span>普通任务</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    - 使用指定参数运行一次任务
                  </Text>
                </Space>
              </Option>
            </Select>
          </Form.Item>

        </Card>

        {/* 任务执行配置 - 移到顶部 */}
        <Card size="small" title="任务执行配置" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="讨论主题"
                required
                tooltip="智能体将围绕此主题进行讨论，请详细描述讨论的背景、目标和要求"
              >
                <TextArea
                  placeholder="请输入讨论主题，例如：讨论如何提升用户满意度，需要考虑服务质量、响应速度、价格因素等方面..."
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
              <Form.Item label="执行轮数" tooltip="每个任务内部讨论的轮数">
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
                        总任务数
                        <Tooltip title="要创建的行动任务总数">
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
                        最大并发
                        <Tooltip title="同时运行的最大任务数，其余任务排队等待。注意：并发数过高可能触发模型API限流（limit_burst_rate），建议根据API配额合理设置">
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
                      最大并发
                      <Tooltip title="同时运行的最大任务数，其余任务排队等待">
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
                    单任务超时
                    <Tooltip title="每个实验任务的最大运行时间（分钟）。设置为 0 表示不限制，任务将一直运行直到自行完成或失败">
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
                  addonAfter="分钟"
                  placeholder="0 表示不限制"
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
                  可用变量（点击添加到扫描列表）
                  {customVariables.length > 0 && (
                    <Tooltip title='标记为"新建"的变量不在当前行动空间中，启动实验时将自动在行动空间中创建这些变量'>
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
                        {name} <Text type="warning" style={{ fontSize: 10 }}>(新建)</Text>
                        {!variables.find(vv => vv.name === name) && <PlusOutlined style={{ marginLeft: 4 }} />}
                      </Tag>
                    ))}
                    {/* 添加自定义变量按钮 */}
                    <Tag
                      style={{ cursor: 'pointer', padding: '4px 8px', borderStyle: 'dashed' }}
                      onClick={() => setNewVariableModalVisible(true)}
                    >
                      <PlusOutlined /> 添加自定义变量
                    </Tag>
                  </Space>
                </div>
              </Card>
            )}

            {/* 参数配置 - 仅对比实验显示 */}
            <Card size="small" title={
              <span>
                参数扫描配置
                <Tooltip title="配置要扫描的变量及其取值范围">
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
                <Empty description="请从上方选择要扫描的变量" style={{ margin: '16px 0' }} />
              )}

              {/* 验证错误提示 */}
              {!readOnly && validationErrors.length > 0 && (
                <div style={{ marginBottom: 16, padding: '8px 16px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 8 }}>
                  <Space align="start">
                    <WarningOutlined style={{ color: '#ff4d4f', marginTop: 4 }} />
                    <div>
                      <Text strong style={{ color: '#cf1322' }}>配置验证失败</Text>
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
                <Card title="目标变量" size="small" extra={
                  <Tooltip title="选择要优化的输出指标，不能与扫描参数相同">
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
                            placeholder="选择变量"
                          >
                            {optionsToShow.map(v => (
                              <Option key={v.name} value={v.name}>
                                {v.name}
                                {v.isCustom && (
                                  <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>新建</Tag>
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
                            <Option value="maximize">最大化</Option>
                            <Option value="minimize">最小化</Option>
                          </Select>
                          {!readOnly && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setObjectives(objectives.filter(o => o.key !== obj.key))} />}
                        </div>
                        <Input
                          placeholder="目标说明（可选，如：用户满意度评分）"
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
                        添加目标
                      </Button>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => setNewObjectiveVarModalVisible(true)}
                      >
                        新建目标变量
                      </Button>
                    </Space>
                  )}
                  {!readOnly && getAvailableObjectiveVariables().length === 0 && objectives.length === 0 && (
                    <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                      所有变量都已作为扫描参数，请新建目标变量
                    </Text>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card title="停止条件（可选）" size="small">
                  {stopConditions.map(cond => (
                    <div key={cond.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <Input
                        placeholder="如: customer_satisfaction > 0.9"
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
                      添加条件
                    </Button>
                  )}
                </Card>
              </Col>
            </Row>

            {/* 实验行为协议 */}
            <Card size="small" title={
              <span>
                实验行为协议
                <Tooltip title="行为协议告诉智能体如何根据扫描参数调整行为，以及如何评估和更新目标变量。这是确保实验科学性和可复现性的关键。">
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
                  {experimentProtocol ? '编辑协议' : '配置协议'}
                </Button>
                {experimentProtocol ? (
                  <Tag color="green">已配置协议</Tag>
                ) : (
                  <Text type="secondary">建议在启动实验前配置行为协议</Text>
                )}
              </Space>
            </Card>

            {/* 实验预览 */}
            <Card
              size="small"
              title="实验预览"
              extra={
                !readOnly && variables.length > 0 && (
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewModalVisible(true)}
                    size="small"
                  >
                    预览参数组合
                  </Button>
                )
              }
              style={{ backgroundColor: 'var(--custom-header-bg)', marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="参数组合数" value={calculateCombinations()} />
                </Col>
                <Col span={8}>
                  <Statistic title="目标变量数" value={objectives.length} />
                </Col>
                <Col span={8}>
                  <Statistic title="停止条件数" value={stopConditions.length} />
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
                    保存配置
                  </Button>
                  {handleStartExperiment && (
                    <Button
                      type="primary"
                      icon={<ExperimentOutlined />}
                      onClick={handleStartExperiment}
                      loading={loading}
                      disabled={variables.length === 0 || validationErrors.length > 0}
                    >
                      启动对比实验
                    </Button>
                  )}
                </Space>
              </Form.Item>
            )}
          </>
        )}

        {/* 普通任务模式 - 简化的操作按钮 */}
        {experimentType === 'normal' && !readOnly && (
          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button
                icon={<SettingOutlined />}
                onClick={handleSaveConfig}
                loading={loading}
              >
                保存配置
              </Button>
              {handleStartExperiment && (
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={handleStartExperiment}
                  loading={loading}
                >
                  启动普通任务
                </Button>
              )}
            </Space>
          </Form.Item>
        )}
      </Form>

      {/* 参数组合预览弹窗 */}
      <Modal
        title="参数组合预览"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>关闭</Button>
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
                <Text>共 <Text strong>{combinations.length}</Text> 个参数组合</Text>
                {combinations.length > maxShow && (
                  <Text type="secondary">（仅显示前 {maxShow} 个）</Text>
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
        title="编辑变量配置"
        open={variableModalVisible}
        onOk={handleSaveVariable}
        onCancel={() => { setVariableModalVisible(false); setEditingVariable(null); }}
      >
        {editingVariable && (
          <Form layout="vertical">
            <Form.Item label="变量名">
              <Input value={editingVariable.name} disabled />
            </Form.Item>
            <Form.Item label="扫描类型">
              <Select
                value={editingVariable.type}
                onChange={(v) => setEditingVariable({ ...editingVariable, type: v })}
              >
                <Option value="enumerated">枚举值</Option>
                <Option value="stepped">步进值</Option>
                <Option value="random">随机值</Option>
              </Select>
            </Form.Item>
            {editingVariable.type === 'enumerated' && (
              <Form.Item label="枚举值（逗号分隔）">
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
                  <Form.Item label="起始值">
                    <InputNumber
                      value={editingVariable.start}
                      onChange={(v) => setEditingVariable({ ...editingVariable, start: v || 0 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="结束值">
                    <InputNumber
                      value={editingVariable.end}
                      onChange={(v) => setEditingVariable({ ...editingVariable, end: v || 0 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="步长">
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
                  <Form.Item label="最小值">
                    <InputNumber
                      value={editingVariable.min}
                      onChange={(v) => setEditingVariable({ ...editingVariable, min: v || 0 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="最大值">
                    <InputNumber
                      value={editingVariable.max}
                      onChange={(v) => setEditingVariable({ ...editingVariable, max: v || 1 })}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="采样数">
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
        title="添加自定义变量"
        open={newVariableModalVisible}
        onOk={handleAddCustomVariable}
        onCancel={() => { setNewVariableModalVisible(false); setNewVariableName(''); }}
        okText="添加"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item
            label={
              <span>
                变量名称
                <Tooltip title="自定义变量不在当前行动空间中，启动实验时将自动在行动空间中创建该变量">
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1677ff' }} />
                </Tooltip>
              </span>
            }
            required
          >
            <Input
              placeholder="输入变量名称（如：temperature）"
              value={newVariableName}
              onChange={(e) => setNewVariableName(e.target.value)}
              onPressEnter={handleAddCustomVariable}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加自定义目标变量弹窗 */}
      <Modal
        title="新建目标变量"
        open={newObjectiveVarModalVisible}
        onOk={handleAddCustomObjectiveVariable}
        onCancel={() => { setNewObjectiveVarModalVisible(false); setNewObjectiveVarName(''); }}
        okText="添加"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item
            label={
              <span>
                变量名称
                <Tooltip title="目标变量是实验要优化的输出指标，如满意度、转化率等。新建的目标变量将在实验运行时由系统记录其值。">
                  <InfoCircleOutlined style={{ marginLeft: 4, color: '#1677ff' }} />
                </Tooltip>
              </span>
            }
            required
          >
            <Input
              placeholder="输入变量名称（如：customer_satisfaction）"
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
            实验行为协议
            <Tooltip title="此协议将注入到智能体的系统提示词中，指导其在实验中的行为。您可以手动编辑或使用AI生成。">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#1677ff' }} />
            </Tooltip>
          </span>
        }
        open={protocolModalVisible}
        onOk={() => setProtocolModalVisible(false)}
        onCancel={() => setProtocolModalVisible(false)}
        width={800}
        footer={[
          <Button
            key="generate"
            icon={<ThunderboltOutlined />}
            onClick={handleGenerateProtocol}
            loading={generatingProtocol}
            disabled={readOnly || !selectedSpace || variables.length === 0}
          >
            AI 生成
          </Button>,
          <Button key="ok" type="primary" onClick={() => setProtocolModalVisible(false)}>
            确定
          </Button>
        ]}
      >
        <TextArea
          value={experimentProtocol}
          onChange={(e) => setExperimentProtocol(e.target.value)}
          rows={20}
          disabled={readOnly}
          placeholder="请输入实验行为协议，或点击下方「AI 生成」按钮自动生成..."
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>
    </div>
  );
};

export default ExperimentDesign;
