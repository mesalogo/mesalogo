import React, { useState, useEffect } from 'react';
import { Form, InputNumber, Switch, Space, Tooltip, Button, Divider, App } from 'antd';
import {
  ClockCircleOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  ReloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../../../../services/api/settings';

const ConversationSettings = ({ color, initialValues }: any) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 初始化表单值
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        max_conversation_history_length: initialValues.max_conversation_history_length ?? 30,
        auto_summarize_context: initialValues.auto_summarize_context !== undefined ? initialValues.auto_summarize_context : true,
        auto_summarize_context_autonomous: initialValues.auto_summarize_context_autonomous !== undefined ? initialValues.auto_summarize_context_autonomous : true,
        streaming_enabled: initialValues.streaming_enabled !== undefined ? initialValues.streaming_enabled : true,
        include_thinking_content_in_context: initialValues.include_thinking_content_in_context !== undefined ? initialValues.include_thinking_content_in_context : false,
        split_tool_calls_in_history: initialValues.split_tool_calls_in_history !== undefined ? initialValues.split_tool_calls_in_history : true,
        create_agent_workspace: initialValues.create_agent_workspace !== undefined ? initialValues.create_agent_workspace : false,
        tool_call_context_rounds: initialValues.tool_call_context_rounds ?? 5,
        tool_result_max_length: initialValues.tool_result_max_length ?? 2000,
        compress_tool_definitions: initialValues.compress_tool_definitions !== undefined ? initialValues.compress_tool_definitions : false
      });
    }
  }, [initialValues, form]);

  const renderLabel = (icon, label, tooltip) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ color, marginRight: '8px', fontSize: '14px' }}>
        {icon}
      </span>
      <span style={{ fontSize: '14px', fontWeight: '500' }}>
        {label}
      </span>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined
          style={{
            marginLeft: '6px',
            color: 'var(--custom-text-secondary)',
            fontSize: '12px'
          }}
        />
      </Tooltip>
    </div>
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 只保存对话设置相关的字段
      await settingsAPI.updateSettings({
        max_conversation_history_length: values.max_conversation_history_length,
        auto_summarize_context: values.auto_summarize_context,
        auto_summarize_context_autonomous: values.auto_summarize_context_autonomous,
        streaming_enabled: values.streaming_enabled,
        include_thinking_content_in_context: values.include_thinking_content_in_context,
        split_tool_calls_in_history: values.split_tool_calls_in_history,
        create_agent_workspace: values.create_agent_workspace,
        tool_call_context_rounds: values.tool_call_context_rounds,
        tool_result_max_length: values.tool_result_max_length,
        compress_tool_definitions: values.compress_tool_definitions
      });

      message.success(t('settings.saveSuccess'));
      setLoading(false);
    } catch (error) {
      console.error('Save conversation settings failed:', error);
      if (error.errorFields) {
        message.error(t('message.validationFailed'));
      } else {
        message.error(t('message.operationFailed') + ': ' + (error.message || t('message.unknownError')));
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (initialValues) {
      form.setFieldsValue({
        max_conversation_history_length: initialValues.max_conversation_history_length ?? 30,
        auto_summarize_context: initialValues.auto_summarize_context !== undefined ? initialValues.auto_summarize_context : true,
        auto_summarize_context_autonomous: initialValues.auto_summarize_context_autonomous !== undefined ? initialValues.auto_summarize_context_autonomous : true,
        streaming_enabled: initialValues.streaming_enabled !== undefined ? initialValues.streaming_enabled : true,
        include_thinking_content_in_context: initialValues.include_thinking_content_in_context !== undefined ? initialValues.include_thinking_content_in_context : false,
        split_tool_calls_in_history: initialValues.split_tool_calls_in_history !== undefined ? initialValues.split_tool_calls_in_history : true,
        create_agent_workspace: initialValues.create_agent_workspace !== undefined ? initialValues.create_agent_workspace : false,
        tool_call_context_rounds: initialValues.tool_call_context_rounds ?? 5,
        tool_result_max_length: initialValues.tool_result_max_length ?? 2000,
        compress_tool_definitions: initialValues.compress_tool_definitions !== undefined ? initialValues.compress_tool_definitions : false
      });
      message.success(t('settings.resetSuccess'));
    }
  };

  return (
    <Form form={form} layout="vertical">
      <div style={{ display: 'flex', gap: '24px' }}>
        {/* 左侧：基础对话设置 */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color, marginBottom: '16px' }}>基础设置</div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' }}>
            <Form.Item
              name="max_conversation_history_length"
              label={renderLabel(
                <ClockCircleOutlined />,
                t('settings.maxHistoryLength'),
                t('settings.maxHistoryLength.tooltip')
              )}
              rules={[{ required: true, message: `请输入${t('settings.maxHistoryLength')}` }]}
              style={{ marginBottom: 0, minWidth: 120 }}
            >
              <InputNumber min={0} max={500} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="auto_summarize_context"
              label={renderLabel(
                <FileTextOutlined />,
                t('settings.autoSummarizeContext'),
                t('settings.autoSummarizeContext.tooltip')
              )}
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="auto_summarize_context_autonomous"
              label={renderLabel(
                <FileTextOutlined />,
                t('settings.autoSummarizeContextAutonomous'),
                t('settings.autoSummarizeContextAutonomous.tooltip')
              )}
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </div>

          <Form.Item
            name="streaming_enabled"
            label={renderLabel(
              <ThunderboltOutlined />,
              t('settings.streamingEnabled'),
              t('settings.streamingEnabled.tooltip')
            )}
            valuePropName="checked"
            style={{ marginBottom: '16px' }}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="include_thinking_content_in_context"
            label={renderLabel(
              <BulbOutlined />,
              t('settings.includeThinking'),
              t('settings.includeThinking.tooltip')
            )}
            valuePropName="checked"
            style={{ marginBottom: '16px' }}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="create_agent_workspace"
            label={renderLabel(
              <ToolOutlined />,
              t('settings.createAgentWorkspace'),
              t('settings.createAgentWorkspace.tooltip')
            )}
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch />
          </Form.Item>
        </div>

        <Divider type="vertical" style={{ height: 'auto', alignSelf: 'stretch' }} />

        {/* 右侧：工具调用优化 */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color, marginBottom: '16px' }}>工具调用优化</div>
          
          <Form.Item
            name="split_tool_calls_in_history"
            label={renderLabel(
              <ToolOutlined />,
              t('settings.splitToolCalls'),
              '[仅隔离模式生效] 格式化历史消息时，将工具调用拆分为独立的assistant+tool消息。多Agent模式下历史消息在system prompt中以文本形式存在'
            )}
            valuePropName="checked"
            style={{ marginBottom: '16px' }}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="tool_call_context_rounds"
            label={renderLabel(
              <ToolOutlined />,
              '工具调用上下文轮数',
              '[仅隔离模式生效] 工具执行后再次调用LLM时，保留的工具调用历史轮数（每轮=1次tool_call+tool_result）。多Agent模式下历史已在system prompt中压缩。[建议] 3-5轮'
            )}
            rules={[{ required: true, message: '请输入工具调用上下文轮数' }]}
            style={{ marginBottom: '16px' }}
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="轮" />
          </Form.Item>

          <Form.Item
            name="tool_result_max_length"
            label={renderLabel(
              <ToolOutlined />,
              '工具结果最大长度',
              '[两种模式都生效] 格式化历史消息时，截断工具返回结果的长度。0表示不截断。太短会丢失关键信息（代码、错误堆栈等）。[建议] 1500-3000字符'
            )}
            rules={[{ required: true, message: '请输入工具结果最大长度' }]}
            style={{ marginBottom: '16px' }}
          >
            <InputNumber min={0} max={10000} style={{ width: '100%' }} addonAfter="字符" />
          </Form.Item>

          <Form.Item
            name="compress_tool_definitions"
            label={renderLabel(
              <ThunderboltOutlined />,
              '压缩工具定义',
              '[两种模式都生效] 压缩tools字段中的工具Schema（截断描述到80字符、移除参数说明）。可节省约70% Token，但会影响LLM对工具的理解。[建议] 关闭'
            )}
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch />
          </Form.Item>
        </div>
      </div>

      <Divider />

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
    </Form>
  );
};

export default ConversationSettings;

