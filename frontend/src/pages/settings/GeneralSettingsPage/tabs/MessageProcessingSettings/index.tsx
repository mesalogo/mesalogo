import React, { useState, useEffect } from 'react';
import { Form, Select, Button, Space, Divider, App, Card } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../../../services/api/settings';
import MessagePreview from './MessagePreview';
import SettingsPanel from './SettingsPanel';

interface MessageProcessingSettingsProps {
  color: string;
  initialValues: any;
}

const MessageProcessingSettings: React.FC<MessageProcessingSettingsProps> = ({ color, initialValues }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'default' | 'isolation'>('default');
  const [previewSettings, setPreviewSettings] = useState({
    maxHistoryLength: 30,
    toolResultMaxLength: 2000,
    toolCallContextRounds: 5,
    splitToolCalls: true,
    compressToolDefinitions: false,
    includeThinking: false,
    autoSummarize: true
  });

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      const values = {
        maxHistoryLength: initialValues.max_conversation_history_length ?? 30,
        autoSummarize: initialValues.auto_summarize_context ?? true,
        autoSummarizeAutonomous: initialValues.auto_summarize_context_autonomous ?? true,
        toolResultMaxLength: initialValues.tool_result_max_length ?? 2000,
        toolCallContextRounds: initialValues.tool_call_context_rounds ?? 5,
        splitToolCalls: initialValues.split_tool_calls_in_history ?? true,
        compressToolDefinitions: initialValues.compress_tool_definitions ?? false,
        includeThinking: initialValues.include_thinking_content_in_context ?? false,
        streamingEnabled: initialValues.streaming_enabled ?? true,
        toolCallCorrection: initialValues.tool_call_correction ?? false,
        toolCallCorrectionThreshold: initialValues.tool_call_correction_threshold ?? 5
      };
      form.setFieldsValue(values);
      setPreviewSettings({
        maxHistoryLength: values.maxHistoryLength,
        toolResultMaxLength: values.toolResultMaxLength,
        toolCallContextRounds: values.toolCallContextRounds,
        splitToolCalls: values.splitToolCalls,
        compressToolDefinitions: values.compressToolDefinitions,
        includeThinking: values.includeThinking,
        autoSummarize: values.autoSummarize
      });
    }
  }, [initialValues, form]);

  const handleValuesChange = (_: any, allValues: any) => {
    setPreviewSettings({
      maxHistoryLength: allValues.maxHistoryLength ?? 30,
      toolResultMaxLength: allValues.toolResultMaxLength ?? 2000,
      toolCallContextRounds: allValues.toolCallContextRounds ?? 5,
      splitToolCalls: allValues.splitToolCalls ?? true,
      compressToolDefinitions: allValues.compressToolDefinitions ?? false,
      includeThinking: allValues.includeThinking ?? false,
      autoSummarize: allValues.autoSummarize ?? true
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await settingsAPI.updateSettings({
        max_conversation_history_length: values.maxHistoryLength,
        auto_summarize_context: values.autoSummarize,
        auto_summarize_context_autonomous: values.autoSummarizeAutonomous,
        streaming_enabled: values.streamingEnabled,
        include_thinking_content_in_context: values.includeThinking,
        split_tool_calls_in_history: values.splitToolCalls,
        tool_call_context_rounds: values.toolCallContextRounds,
        tool_result_max_length: values.toolResultMaxLength,
        compress_tool_definitions: values.compressToolDefinitions,
        tool_call_correction: values.toolCallCorrection,
        tool_call_correction_threshold: values.toolCallCorrectionThreshold
      });

      message.success(t('settings.saveSuccess'));
    } catch (error: any) {
      console.error('Save message processing settings failed:', error);
      message.error(t('message.operationFailed') + ': ' + (error.message || t('message.unknownError')));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (initialValues) {
      const values = {
        maxHistoryLength: initialValues.max_conversation_history_length ?? 30,
        autoSummarize: initialValues.auto_summarize_context ?? true,
        autoSummarizeAutonomous: initialValues.auto_summarize_context_autonomous ?? true,
        toolResultMaxLength: initialValues.tool_result_max_length ?? 2000,
        toolCallContextRounds: initialValues.tool_call_context_rounds ?? 5,
        splitToolCalls: initialValues.split_tool_calls_in_history ?? true,
        compressToolDefinitions: initialValues.compress_tool_definitions ?? false,
        includeThinking: initialValues.include_thinking_content_in_context ?? false,
        streamingEnabled: initialValues.streaming_enabled ?? true,
        toolCallCorrection: initialValues.tool_call_correction ?? false,
        toolCallCorrectionThreshold: initialValues.tool_call_correction_threshold ?? 5
      };
      form.setFieldsValue(values);
      handleValuesChange(null, values);
      message.success(t('settings.resetSuccess'));
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: '100%' }}>
      {/* 左侧：实时预览 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>实时预览</span>
            <Select
              value={mode}
              onChange={setMode}
              size="small"
              style={{ width: 180 }}
              options={[
                { value: 'default', label: '默认模式' },
                { value: 'isolation', label: '隔离模式 (isolation)' }
              ]}
            />
          </div>
        }
        style={{ flex: 1, minWidth: 360 }}
        bodyStyle={{ padding: '12px 16px', height: 'calc(100% - 57px)', overflow: 'auto' }}
      >
        <MessagePreview 
          mode={mode} 
          settings={previewSettings} 
          color={color}
        />
      </Card>

      {/* 右侧：参数设置 */}
      <Card
        title="参数设置"
        style={{ flex: 1, minWidth: 320 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <SettingsPanel 
          form={form} 
          mode={mode} 
          color={color}
          onValuesChange={handleValuesChange}
        />

        <Divider style={{ margin: '16px 0' }} />

        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={loading}
          >
            {t('settings.save')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
          >
            {t('settings.reset')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default MessageProcessingSettings;
