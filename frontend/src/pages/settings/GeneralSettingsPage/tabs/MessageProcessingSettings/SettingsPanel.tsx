import React from 'react';
import { Form, InputNumber, Switch, Tooltip, Divider } from 'antd';
import {
  ClockCircleOutlined,
  ToolOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface SettingsPanelProps {
  form: any;
  mode: 'default' | 'isolation';
  color: string;
  onValuesChange: (changedValues: any, allValues: any) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ form, mode, color, onValuesChange }) => {
  const { t } = useTranslation();

  const renderLabel = (icon: React.ReactNode, label: string, tooltip: string, disabled?: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ color: disabled ? 'var(--custom-text-tertiary)' : color, marginRight: '8px', fontSize: '14px' }}>
        {icon}
      </span>
      <span style={{ 
        fontSize: '13px', 
        fontWeight: '500',
        color: disabled ? 'var(--custom-text-tertiary)' : 'inherit'
      }}>
        {label}
      </span>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined
          style={{
            marginLeft: '6px',
            color: 'var(--custom-text-tertiary)',
            fontSize: '12px'
          }}
        />
      </Tooltip>
      {disabled && (
        <Tooltip title="此参数仅在隔离模式下生效">
          <ExclamationCircleOutlined
            style={{
              marginLeft: '6px',
              color: '#faad14',
              fontSize: '12px'
            }}
          />
        </Tooltip>
      )}
    </div>
  );

  const isIsolationOnly = mode === 'default';

  return (
    <Form 
      form={form} 
      layout="vertical" 
      onValuesChange={onValuesChange}
      size="small"
    >
      {/* 历史消息设置 */}
      <div style={{ fontSize: '13px', fontWeight: 500, color, marginBottom: '12px' }}>
        历史消息
      </div>
      
      <Form.Item
        name="maxHistoryLength"
        label={renderLabel(
          <ClockCircleOutlined />,
          '历史消息长度',
          '控制从数据库获取的历史消息条数。建议：20-50条'
        )}
        style={{ marginBottom: '12px' }}
      >
        <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="条" />
      </Form.Item>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        <Form.Item
          name="autoSummarize"
          label={renderLabel(
            <FileTextOutlined />,
            '自动总结',
            '消息数超限时自动总结上下文，避免硬截断丢失信息'
          )}
          valuePropName="checked"
          style={{ marginBottom: 0, flex: 1 }}
        >
          <Switch size="small" />
        </Form.Item>

        <Form.Item
          name="autoSummarizeAutonomous"
          label={renderLabel(
            <FileTextOutlined />,
            '自主任务总结',
            '自主任务中是否自动总结上下文'
          )}
          valuePropName="checked"
          style={{ marginBottom: 0, flex: 1 }}
        >
          <Switch size="small" />
        </Form.Item>
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* 工具调用设置 */}
      <div style={{ fontSize: '13px', fontWeight: 500, color, marginBottom: '12px' }}>
        工具调用
      </div>

      <Form.Item
        name="toolResultMaxLength"
        label={renderLabel(
          <ToolOutlined />,
          '工具结果最大长度',
          '截断历史消息中的工具返回结果。0表示不截断。建议：1500-3000字符'
        )}
        style={{ marginBottom: '12px' }}
      >
        <InputNumber min={0} max={10000} style={{ width: '100%' }} addonAfter="字符" />
      </Form.Item>

      <Form.Item
        name="toolCallContextRounds"
        label={renderLabel(
          <ToolOutlined />,
          '工具上下文轮数',
          '工具执行后再次调用LLM时，保留的工具调用历史轮数。每轮=1次tool_call+tool_result'
        )}
        style={{ marginBottom: '12px' }}
      >
        <InputNumber 
          min={1} 
          max={10} 
          style={{ width: '100%' }} 
          addonAfter="轮" 
        />
      </Form.Item>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        <Form.Item
          name="splitToolCalls"
          label={renderLabel(
            <ToolOutlined />,
            '拆分工具调用',
            '将工具调用拆分为独立的assistant+tool消息（仅隔离模式生效）',
            isIsolationOnly
          )}
          valuePropName="checked"
          style={{ marginBottom: 0, flex: 1 }}
        >
          <Switch size="small" disabled={isIsolationOnly} />
        </Form.Item>

        <Form.Item
          name="compressToolDefinitions"
          label={renderLabel(
            <ThunderboltOutlined />,
            '压缩工具定义',
            '压缩工具Schema以节省Token（约70%），但会影响LLM对工具的理解'
          )}
          valuePropName="checked"
          style={{ marginBottom: 0, flex: 1 }}
        >
          <Switch size="small" />
        </Form.Item>
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* 工具调用纠正 */}
      <div style={{ fontSize: '13px', fontWeight: 500, color, marginBottom: '12px' }}>
        {t('settings.toolCallCorrection.title')}
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        <Form.Item
          name="toolCallCorrection"
          label={renderLabel(
            <SafetyOutlined />,
            t('settings.toolCallCorrection'),
            t('settings.toolCallCorrection.tooltip')
          )}
          valuePropName="checked"
          style={{ marginBottom: 0, flex: 1 }}
        >
          <Switch size="small" />
        </Form.Item>

        <Form.Item
          name="toolCallCorrectionThreshold"
          label={renderLabel(
            <SafetyOutlined />,
            t('settings.toolCallCorrectionThreshold'),
            t('settings.toolCallCorrectionThreshold.tooltip')
          )}
          style={{ marginBottom: 0, flex: 1 }}
        >
          <InputNumber min={1} max={20} style={{ width: '100%' }} addonAfter={t('settings.toolCallCorrectionThreshold.unit')} />
        </Form.Item>
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* 其他设置 */}
      <div style={{ fontSize: '13px', fontWeight: 500, color, marginBottom: '12px' }}>
        其他
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <Form.Item
          name="includeThinking"
          label={renderLabel(
            <BulbOutlined />,
            '包含思考内容',
            '是否在上下文中包含LLM的思考过程（<thinking>标签内容）'
          )}
          valuePropName="checked"
          style={{ marginBottom: 0 }}
        >
          <Switch size="small" />
        </Form.Item>

        <Form.Item
          name="streamingEnabled"
          label={renderLabel(
            <ThunderboltOutlined />,
            '流式输出',
            '是否启用流式输出，实时显示LLM响应'
          )}
          valuePropName="checked"
          style={{ marginBottom: 0 }}
        >
          <Switch size="small" />
        </Form.Item>
      </div>
    </Form>
  );
};

export default SettingsPanel;
