import React, { useState } from 'react';
import { Typography, Card, Tabs, App } from 'antd';
import {
  SettingOutlined,
  DatabaseOutlined,
  RobotOutlined,

  FieldTimeOutlined,
  FileTextOutlined,
  ControlOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { vectorDatabaseAPI, validateProviderConfig, getProviderDisplayName } from '../../../services/api/vectorDatabase';

// 导入数据管理Hook
import { useGeneralSettings } from './useGeneralSettings';

// 导入Modal组件
import { VectorDBConfigModal } from './VectorDBConfigModal';
import { PromptTemplateModal } from './PromptTemplateModal';
import { VectorDBTestModal, getTestSteps, showDetailedTestResult } from './VectorDBTestModal';

// 导入tab组件
import BasicSettings from './tabs/BasicSettings';
import MessageProcessingSettings from './tabs/MessageProcessingSettings';

import VectorDBSettings from './tabs/VectorDBSettings';
import AssistantSettings from './tabs/AssistantSettings';
import TimeoutSettings from './tabs/TimeoutSettings';
import DocumentParsersSettings from './tabs/DocumentParsersSettings';

const { Title, Text } = Typography;

const GeneralSettingsPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();

  // 使用统一的数据管理Hook
  const {
    settings,
    modelConfigs,
    defaultModels,
    useBuiltinVectorDB,
    currentVectorDBConfig,
    setUseBuiltinVectorDB,
    setCurrentVectorDBConfig
  } = useGeneralSettings();

  // Modal显示状态
  const [vectorDBConfigVisible, setVectorDBConfigVisible] = useState(false);
  const [promptTemplateVisible, setPromptTemplateVisible] = useState(false);
  const [testConnectionLoading, setTestConnectionLoading] = useState(false);

  // 测试步骤Modal状态
  const [testStepsModal, setTestStepsModal] = useState({
    visible: false,
    currentStep: 0,
    stepsData: [],
    result: null,
    providerName: ''
  });

  // 打开向量数据库配置modal
  const handleOpenVectorDBConfigModal = () => {
    setVectorDBConfigVisible(true);
  };

  // 打开提示词模板管理modal
  const handleOpenPromptTemplateModal = () => {
    setPromptTemplateVisible(true);
  };

  // 初始化测试步骤
  const initializeTestSteps = (providerName) => {
    const steps = getTestSteps(t).map(step => ({
      ...step,
      status: 'wait',
      message: '',
      duration: null
    }));

    setTestStepsModal({
      visible: true,
      currentStep: 0,
      stepsData: steps,
      result: null,
      providerName
    });
  };

  // 更新测试步骤状态
  const updateTestStep = (stepIndex, status, message = '', duration = null) => {
    setTestStepsModal(prev => {
      const newSteps = [...prev.stepsData];
      newSteps[stepIndex] = {
        ...newSteps[stepIndex],
        status,
        message,
        duration
      };

      let newCurrentStep = prev.currentStep;
      if (status === 'process') {
        newCurrentStep = stepIndex;
      } else if (status === 'finish' && stepIndex < getTestSteps(t).length - 1) {
        newCurrentStep = stepIndex + 1;
      }

      return {
        ...prev,
        stepsData: newSteps,
        currentStep: newCurrentStep
      };
    });
  };

  // 完成测试
  const finishTest = (success, finalMessage, testInfo) => {
    setTestStepsModal(prev => ({
      ...prev,
      result: {
        success,
        message: finalMessage,
        info: testInfo
      }
    }));
  };

  // 测试向量数据库连接（使用步骤Modal）
  const handleTestVectorDBConnectionWithSteps = async () => {
    try {
      const currentProvider = settings?.vector_db_provider || 'aliyun';
      const currentConfig = currentVectorDBConfig[currentProvider] || {};

      // 验证配置完整性
      const validation = validateProviderConfig(currentProvider, currentConfig);
      if (!validation.valid) {
        message.warning(`配置不完整：${validation.error}`);
        return;
      }

      const providerDisplayName = getProviderDisplayName(currentProvider);

      // 初始化测试步骤Modal
      initializeTestSteps(providerDisplayName);

      // 开始测试
      setTestConnectionLoading(true);

      console.log(`开始测试${providerDisplayName}连接...`, { provider: currentProvider, config: currentConfig });

      // 模拟步骤进度（因为后端是一次性返回结果）
      updateTestStep(0, 'process', '正在验证配置参数...');

      // 短暂延迟以显示步骤
      await new Promise(resolve => setTimeout(resolve, 500));

      updateTestStep(0, 'finish', '配置验证完成', 0.5);
      updateTestStep(1, 'process', '正在连接数据库...');

      await new Promise(resolve => setTimeout(resolve, 300));

      // 调用统一的向量数据库测试API
      const result = await vectorDatabaseAPI.testConnection(currentProvider, currentConfig);

      // 根据返回结果更新步骤状态
      if (result.info && result.info.test_levels) {
        const levels = result.info.test_levels;

        // 更新配置验证步骤
        const configResult = levels.config_validation;
        if (configResult) {
          updateTestStep(0, configResult.passed ? 'finish' : 'error', configResult.message);
        }

        // 更新连接测试步骤
        const connResult = levels.connection_test;
        if (connResult) {
          updateTestStep(1, connResult.passed ? 'finish' : 'error', connResult.message);
          if (connResult.passed) {
            updateTestStep(2, 'process', '正在测试向量操作...');
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        // 更新向量操作步骤
        const vectorResult = levels.vector_operations;
        if (vectorResult) {
          updateTestStep(2, vectorResult.passed ? 'finish' : 'error', vectorResult.message);
        }
      }

      // 完成测试
      finishTest(result.success, result.message, result.info);

      console.log(`${providerDisplayName}测试结果:`, result);

    } catch (error) {
      const currentProvider = settings?.vector_db_provider || 'aliyun';
      const providerDisplayName = getProviderDisplayName(currentProvider);
      console.error(`Failed to test ${providerDisplayName} connection:`, error);

      // 更新当前步骤为错误状态
      updateTestStep(testStepsModal.currentStep, 'error', `${t('vectorDB.test.failed')}: ${error.message || t('vectorDB.test.networkError')}`);
      finishTest(false, t('vectorDB.test.connectionFailed'), {});

    } finally {
      setTestConnectionLoading(false);
    }
  };

  // 设置项配置
  const settingGroups = [
    {
      title: t('settings.group.basic'),
      icon: <SettingOutlined />,
      color: '#1677ff',
      component: BasicSettings
    },
    {
      title: t('settings.group.messageProcessing'),
      icon: <ControlOutlined />,
      color: '#52c41a',
      component: MessageProcessingSettings
    },

    {
      title: t('settings.group.vectorDB'),
      icon: <DatabaseOutlined />,
      color: '#722ed1',
      component: VectorDBSettings,
      props: {
        useBuiltinVectorDB,
        setUseBuiltinVectorDB,
        handleOpenVectorDBConfigModal,
        handleTestVectorDBConnectionWithSteps,
        testConnectionLoading
      }
    },
    {
      title: t('settings.group.assistant'),
      icon: <RobotOutlined />,
      color: '#eb2f96',
      component: AssistantSettings,
      props: {
        modelConfigs,
        defaultModels,
        handleOpenPromptTemplateModal
      }
    },
    {
      title: t('settings.group.timeout'),
      icon: <FieldTimeOutlined />,
      color: '#f5222d',
      component: TimeoutSettings
    },
    {
      title: t('settings.group.documentParsers'),
      icon: <FileTextOutlined />,
      color: '#9254de',
      component: DocumentParsersSettings
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('settings.title')}</Title>
            <Text type="secondary">
              {t('settings.subtitle')}
            </Text>
          </div>
        </div>
      </div>

      <Tabs
        defaultActiveKey="0"
        items={settingGroups.map((group, groupIndex) => ({
          key: groupIndex.toString(),
          label: (
            <span>
              {group.icon}
              {group.title}
            </span>
          ),
          children: (
            <Card
              style={{
                borderRadius: '12px',
                boxShadow: 'var(--custom-shadow)'
              }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: `${group.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px',
                    color: group.color,
                    fontSize: '16px'
                  }}>
                    {group.icon}
                  </div>
                  <Title level={5} style={{ margin: 0, color: group.color }}>
                    {group.title}
                  </Title>
                </div>
              </div>

              {/* 渲染对应的tab组件，传递initialValues */}
              {React.createElement(group.component, {
                color: group.color,
                initialValues: settings,
                ...(group.props || {})
              })}
            </Card>
          )
        }))}
      />

      {/* 向量数据库配置Modal */}
      <VectorDBConfigModal
        visible={vectorDBConfigVisible}
        onClose={() => setVectorDBConfigVisible(false)}
        settings={settings}
        currentVectorDBConfig={currentVectorDBConfig}
        onConfigUpdate={setCurrentVectorDBConfig}
      />

      {/* 提示词模板管理Modal */}
      <PromptTemplateModal
        visible={promptTemplateVisible}
        onClose={() => setPromptTemplateVisible(false)}
        modelConfigs={modelConfigs}
        defaultModels={defaultModels}
        initialValues={settings}
      />

      {/* 测试步骤Modal */}
      <VectorDBTestModal
        visible={testStepsModal.visible}
        providerName={testStepsModal.providerName}
        stepsData={testStepsModal.stepsData}
        currentStep={testStepsModal.currentStep}
        result={testStepsModal.result}
        onClose={() => setTestStepsModal(prev => ({ ...prev, visible: false }))}
        onShowDetail={() => {
          setTestStepsModal(prev => ({ ...prev, visible: false }));
          showDetailedTestResult(testStepsModal.providerName, testStepsModal.result, t);
        }}
      />
    </div>
  );
};

export default GeneralSettingsPage;
