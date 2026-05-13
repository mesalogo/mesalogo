import React, { useState, useEffect } from 'react';
import {
  Modal,
  Steps,
  Card,
  Input,
  Button,
  Space,
  Typography,
  Descriptions,
  message,
  Alert
} from 'antd';
import {
  EditOutlined,
  RedoOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import oneClickGenerationAPI from '../../services/api/oneClickGeneration';
import settingsAPI from '../../services/api/settings';
import EditModal from './EditModal';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const OneClickModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  // 状态管理
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [requirement, setRequirement] = useState('');
  const [generatedData, setGeneratedData] = useState({
    roles: null,  // 改为复数形式
    actionSpace: null,
    rules: null,
    task: null
  });

  // 编辑状态管理
  const [editingStates, setEditingStates] = useState({
    roles: false,
    actionSpace: false,
    rules: false,
    task: false
  });

  const [currentEditType, setCurrentEditType] = useState(null);
  const [currentEditData, setCurrentEditData] = useState(null);
  const [error, setError] = useState(null);
  const [globalSettings, setGlobalSettings] = useState({
    enableAssistantGeneration: true,
    assistantGenerationModel: 'default'
  });

  // 步骤配置
  const steps = [
    {
      title: t('oneClick.step.requirement'),
      description: t('oneClick.step.requirementDesc')
    },
    {
      title: t('oneClick.step.role'),
      description: t('oneClick.step.roleDesc')
    },
    {
      title: t('oneClick.step.actionSpace'),
      description: t('oneClick.step.actionSpaceDesc')
    },
    {
      title: t('oneClick.step.rules'),
      description: t('oneClick.step.rulesDesc')
    },
    {
      title: t('oneClick.step.task'),
      description: t('oneClick.step.taskDesc')
    }
  ];

  // 获取全局设置
  const fetchGlobalSettings = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      console.log('获取到的设置:', settings); // 调试日志
      setGlobalSettings({
        enableAssistantGeneration: settings.enable_assistant_generation !== undefined ? settings.enable_assistant_generation : true,
        assistantGenerationModel: settings.assistant_generation_model || 'default'
      });
    } catch (error) {
      console.error('获取全局设置失败:', error);
      // 使用默认值
      setGlobalSettings({
        enableAssistantGeneration: true,
        assistantGenerationModel: 'default'
      });
    }
  };

  // 组件挂载时获取全局设置
  useEffect(() => {
    if (visible) {
      fetchGlobalSettings();
    }
  }, [visible]);

  // 重置状态
  const resetState = () => {
    setCurrentStep(0);
    setLoading(false);
    setRequirement('');
    setGeneratedData({
      roles: null,  // 改为复数形式
      actionSpace: null,
      rules: null,
      task: null
    });
    setEditingStates({
      roles: false,
      actionSpace: false,
      rules: false,
      task: false
    });
    setError(null);
  };

  // 编辑功能
  const handleEdit = (type) => {
    setCurrentEditType(type);
    setCurrentEditData(generatedData[type]);
    setEditingStates(prev => ({ ...prev, [type]: true }));
  };

  const handleSaveEdit = (newData) => {
    setGeneratedData(prev => ({ ...prev, [currentEditType]: newData }));
    setEditingStates(prev => ({ ...prev, [currentEditType]: false }));
    setCurrentEditType(null);
    setCurrentEditData(null);
    message.success(t('oneClick.edit.saveSuccess'));
  };

  const handleCancelEdit = () => {
    setEditingStates(prev => ({ ...prev, [currentEditType]: false }));
    setCurrentEditType(null);
    setCurrentEditData(null);
  };

  // 删除角色功能
  const handleDeleteRole = (roleIndex) => {
    const newRoles = generatedData.roles.filter((_, index) => index !== roleIndex);
    if (newRoles.length === 0) {
      setGeneratedData(prev => ({ ...prev, roles: null }));
    } else {
      setGeneratedData(prev => ({ ...prev, roles: newRoles }));
    }
    message.success(t('oneClick.role.deleteSuccess'));
  };

  // 删除规则功能
  const handleDeleteRule = (ruleIndex) => {
    const newRules = generatedData.rules.filter((_, index) => index !== ruleIndex);
    if (newRules.length === 0) {
      setGeneratedData(prev => ({ ...prev, rules: null }));
    } else {
      setGeneratedData(prev => ({ ...prev, rules: newRules }));
    }
    message.success(t('oneClick.rules.deleteSuccess'));
  };

  // 处理取消
  const handleCancel = () => {
    resetState();
    onCancel();
  };



  // 生成角色
  const generateRole = async () => {
    try {
      setLoading(true);
      setError(null);

      // 调用一键生成API
      const response = await oneClickGenerationAPI.generateRole(requirement);

      if (response.success) {
        setGeneratedData(prev => ({ ...prev, roles: response.data }));
        message.success(t('oneClick.role.generateSuccess', { count: response.data.length }));
      } else {
        throw new Error(response.error || t('oneClick.role.generateFailed'));
      }
    } catch (error) {
      console.error('角色生成失败:', error);
      const errorMessage = error.response?.data?.error || error.message || t('oneClick.role.generateFailed');
      setError(errorMessage);
      message.error(`${t('oneClick.role.generateFailed')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 生成行动空间
  const generateActionSpace = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await oneClickGenerationAPI.generateActionSpace(requirement, generatedData.roles);

      if (response.success) {
        setGeneratedData(prev => ({ ...prev, actionSpace: response.data }));
        message.success(t('oneClick.actionSpace.generateSuccess'));
      } else {
        throw new Error(response.error || t('oneClick.actionSpace.generateFailed'));
      }
    } catch (error) {
      console.error('行动空间生成失败:', error);
      const errorMessage = error.response?.data?.error || error.message || t('oneClick.actionSpace.generateFailed');
      setError(errorMessage);
      message.error(`${t('oneClick.actionSpace.generateFailed')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 生成规则
  const generateRules = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await oneClickGenerationAPI.generateRules(
        requirement,
        generatedData.roles,
        generatedData.actionSpace
      );

      if (response.success) {
        setGeneratedData(prev => ({ ...prev, rules: response.data }));
        message.success(t('oneClick.rules.generateSuccess'));
      } else {
        throw new Error(response.error || t('oneClick.rules.generateFailed'));
      }
    } catch (error) {
      console.error('规则生成失败:', error);
      const errorMessage = error.response?.data?.error || error.message || t('oneClick.rules.generateFailed');
      setError(errorMessage);
      message.error(`${t('oneClick.rules.generateFailed')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 生成任务
  const generateTask = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await oneClickGenerationAPI.generateTask(
        requirement,
        generatedData.roles,
        generatedData.actionSpace,
        generatedData.rules
      );

      if (response.success) {
        setGeneratedData(prev => ({ ...prev, task: response.data }));
        message.success(t('oneClick.task.generateSuccess'));
      } else {
        throw new Error(response.error || t('oneClick.task.generateFailed'));
      }
    } catch (error) {
      console.error('任务生成失败:', error);
      const errorMessage = error.response?.data?.error || error.message || t('oneClick.task.generateFailed');
      setError(errorMessage);
      message.error(`${t('oneClick.task.generateFailed')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 创建所有内容
  const createAllContent = async () => {
    try {
      setLoading(true);
      setError(null);

      // 转换字段名以匹配后端期望的格式
      const dataToSend = {
        roles: generatedData.roles,
        action_space: generatedData.actionSpace,  // 转换为下划线命名
        rules: generatedData.rules,
        task: generatedData.task
      };

      console.log('发送的数据结构:', dataToSend);

      const response = await oneClickGenerationAPI.createAll(dataToSend);

      if (response.success) {
        message.success(t('oneClick.createSuccess'));
        onSuccess(response.data);
        handleCancel();
      } else {
        throw new Error(response.error || t('oneClick.createFailed'));
      }
    } catch (error) {
      console.error('创建失败:', error);
      const errorMessage = error.response?.data?.error || error.message || t('oneClick.createFailed');
      setError(errorMessage);
      message.error(`${t('oneClick.createFailed')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 处理下一步
  const handleNext = async () => {
    if (currentStep === 0) {
      // 验证需求输入
      if (!requirement.trim()) {
        message.warning(t('oneClick.requirementRequired'));
        return;
      }

      // 检查辅助生成功能是否启用
      if (!globalSettings.enableAssistantGeneration) {
        message.warning('辅助生成功能未启用，请在系统设置中开启');
        return;
      }

      // 进入角色生成步骤
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!generatedData.roles) {
        // 生成角色
        await generateRole();
      } else {
        // 用户确认角色后，进入行动空间生成步骤
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (!generatedData.actionSpace) {
        // 生成行动空间
        await generateActionSpace();
      } else {
        // 用户确认行动空间后，进入规则生成步骤
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      if (!generatedData.rules) {
        // 生成规则
        await generateRules();
      } else {
        // 用户确认规则后，进入任务生成步骤
        setCurrentStep(4);
      }
    } else if (currentStep === 4) {
      if (!generatedData.task) {
        // 生成任务
        await generateTask();
      } else {
        // 用户确认任务后，创建所有内容
        await createAllContent();
      }
    }
  };

  // 处理上一步
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 渲染需求输入步骤
  const renderRequirementStep = () => (
    <Card title={t('oneClick.requirementTitle')}>
      <TextArea
        placeholder={t('oneClick.requirementExample')}
        rows={6}
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
        showCount
        maxLength={1000}
      />
      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          {t('oneClick.requirementHint')}
        </Text>
      </div>
    </Card>
  );

  // 渲染角色生成步骤
  const renderRoleStep = () => {
    if (!generatedData.roles && !loading) {
      return (
        <Card title={t('oneClick.role.multiGeneration')}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">{t('oneClick.role.generationHint')}</Text>
          </div>
        </Card>
      );
    }

    if (loading && !generatedData.roles) {
      return (
        <Card title={t('oneClick.role.generating')} loading={loading}>
          <Text type="secondary">{t('oneClick.role.generatingHint')}</Text>
        </Card>
      );
    }

    return (
      <Card
        title={`${t('oneClick.role.generated')} (${generatedData.roles.length}个)`}
        extra={
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
             
              onClick={() => handleEdit('roles')}
            >
              编辑
            </Button>
            <Button type="link" icon={<RedoOutlined />} onClick={() => {
              setGeneratedData(prev => ({ ...prev, roles: null }));
            }}>
              重新生成
            </Button>
          </Space>
        }
      >
        {generatedData.roles.map((role, index) => (
          <Card
            key={index}
            type="inner"
            title={role.name}
            extra={
              generatedData.roles.length > 1 && (
                <Button
                  type="link"
                  icon={<DeleteOutlined />}
                 
                  danger
                  onClick={() => handleDeleteRole(index)}
                  title={t('oneClick.role.delete')}
                />
              )
            }
           
            style={{ marginBottom: 12 }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label={t('oneClick.role.description')}>
                {role.description}
              </Descriptions.Item>
              <Descriptions.Item label="系统提示词">
                <div style={{
                  maxHeight: 120,
                  overflow: 'auto',
                  padding: 8,
                  backgroundColor: 'var(--custom-header-bg)',
                  borderRadius: 4,
                  fontSize: '12px'
                }}>
                  {role.system_prompt}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ))}
      </Card>
    );
  };

  // 渲染行动空间生成步骤
  const renderActionSpaceStep = () => {
    if (!generatedData.actionSpace && !loading) {
      return (
        <Card title={t('oneClick.actionSpace.generation')}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">{t('oneClick.actionSpace.generationHint')}</Text>
          </div>
        </Card>
      );
    }

    if (loading && !generatedData.actionSpace) {
      return (
        <Card title={t('oneClick.actionSpace.generating')} loading={loading}>
          <Text type="secondary">{t('oneClick.actionSpace.generatingHint')}</Text>
        </Card>
      );
    }

    return (
      <Card
        title={t('oneClick.actionSpace.generated')}
        extra={
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
             
              onClick={() => handleEdit('actionSpace')}
            >
              编辑
            </Button>
            <Button type="link" icon={<RedoOutlined />} onClick={() => {
              setGeneratedData(prev => ({ ...prev, actionSpace: null }));
            }}>
              重新生成
            </Button>
          </Space>
        }
      >
        <Descriptions bordered column={1}>
          <Descriptions.Item label="空间名称">
            {generatedData.actionSpace.name}
          </Descriptions.Item>
          <Descriptions.Item label="空间描述">
            {generatedData.actionSpace.description}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  // 渲染规则生成步骤
  const renderRulesStep = () => {
    if (!generatedData.rules && !loading) {
      return (
        <Card title={t('oneClick.rules.generation')}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">{t('oneClick.rules.generationHint')}</Text>
          </div>
        </Card>
      );
    }

    if (loading && !generatedData.rules) {
      return (
        <Card title={t('oneClick.rules.generating')} loading={loading}>
          <Text type="secondary">{t('oneClick.rules.generatingHint')}</Text>
        </Card>
      );
    }

    return (
      <Card
        title={`${t('oneClick.rules.generated')} (${generatedData.rules.length}个)`}
        extra={
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
             
              onClick={() => handleEdit('rules')}
            >
              编辑
            </Button>
            <Button type="link" icon={<RedoOutlined />} onClick={() => {
              setGeneratedData(prev => ({ ...prev, rules: null }));
            }}>
              重新生成
            </Button>
          </Space>
        }
      >
        {generatedData.rules.map((rule, index) => (
          <Card
            key={index}
            type="inner"
            title={rule.name}
            extra={
              generatedData.rules.length > 1 && (
                <Button
                  type="link"
                  icon={<DeleteOutlined />}
                 
                  danger
                  onClick={() => handleDeleteRule(index)}
                  title={t('oneClick.rules.delete')}
                />
              )
            }
           
            style={{ marginBottom: 8 }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label="类型">
{t('oneClick.rules.type')}
              </Descriptions.Item>
              <Descriptions.Item label="内容">
                <div style={{
                  maxHeight: 100,
                  overflow: 'auto',
                  padding: 8,
                  backgroundColor: 'var(--custom-header-bg)',
                  borderRadius: 4
                }}>
                  {rule.content}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ))}
      </Card>
    );
  };

  // 渲染任务生成步骤
  const renderTaskStep = () => {
    if (!generatedData.task && !loading) {
      return (
        <Card title={t('oneClick.task.generation')}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">{t('oneClick.task.generationHint')}</Text>
          </div>
        </Card>
      );
    }

    if (loading && !generatedData.task) {
      return (
        <Card title={t('oneClick.task.generating')} loading={loading}>
          <Text type="secondary">{t('oneClick.task.generatingHint')}</Text>
        </Card>
      );
    }

    return (
      <Card
        title={t('oneClick.task.generated')}
        extra={
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
             
              onClick={() => handleEdit('task')}
            >
              编辑
            </Button>
            <Button type="link" icon={<RedoOutlined />} onClick={() => {
              setGeneratedData(prev => ({ ...prev, task: null }));
            }}>
              重新生成
            </Button>
          </Space>
        }
      >
        <Descriptions bordered column={1}>
          <Descriptions.Item label={t('oneClick.task.title')}>
            {generatedData.task.title}
          </Descriptions.Item>

          <Descriptions.Item label={t('oneClick.task.description')}>
            <div style={{
              maxHeight: 150,
              overflow: 'auto',
              padding: 8,
              backgroundColor: 'var(--custom-header-bg)',
              borderRadius: 4
            }}>
              {generatedData.task.description}
            </div>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  return (
    <Modal
      title="一键创建"
      open={visible}
      onCancel={handleCancel}
      width={900}
      footer={null}

    >
      {/* 步骤指示器 */}
      <Steps
        current={currentStep}
        status={error ? 'error' : 'process'}
        items={steps}
        style={{ marginBottom: 32 }}
      />

      {/* 错误提示 */}
      {error && (
        <Alert
          message="生成失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 内容区域 */}
      <div style={{ minHeight: 400 }}>
        {currentStep === 0 && renderRequirementStep()}
        {currentStep === 1 && renderRoleStep()}
        {currentStep === 2 && renderActionSpaceStep()}
        {currentStep === 3 && renderRulesStep()}
        {currentStep === 4 && renderTaskStep()}
      </div>

      {/* 底部按钮 */}
      <div style={{
        textAlign: 'right',
        marginTop: 24,
        paddingTop: 16,
        borderTop: '1px solid var(--custom-border)'
      }}>
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          <Button
            onClick={handlePrev}
            disabled={currentStep === 0 || loading}
          >
            上一步
          </Button>
          <Button
            type="primary"
            onClick={handleNext}
            loading={loading}
            disabled={currentStep === 0 && !requirement.trim()}
          >
            {currentStep === 0 && t('oneClick.startGeneration')}
            {currentStep === 1 && (generatedData.roles ? t('oneClick.confirmAndContinue') : t('oneClick.role.generate'))}
            {currentStep === 2 && (generatedData.actionSpace ? t('oneClick.confirmAndContinue') : t('oneClick.actionSpace.generate'))}
            {currentStep === 3 && (generatedData.rules ? t('oneClick.confirmAndContinue') : t('oneClick.rules.generate'))}
            {currentStep === 4 && (generatedData.task ? t('oneClick.createAllContent') : t('oneClick.task.generate'))}
          </Button>
        </Space>
      </div>

      {/* 编辑模态框 */}
      <EditModal
        visible={currentEditType !== null}
        type={currentEditType}
        data={currentEditData}
        onSave={handleSaveEdit}
        onCancel={handleCancelEdit}
      />
    </Modal>
  );
};

export default OneClickModal;
