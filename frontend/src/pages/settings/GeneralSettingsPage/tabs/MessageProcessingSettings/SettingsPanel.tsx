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
        <Tooltip title={t('msgProc.disabledInDefaultMode')}>
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
        {t('msgProc.historySection')}
      </div>
      
      <Form.Item
        name="maxHistoryLength"
        label={renderLabel(
          <ClockCircleOutlined />,
          t('msgProc.maxHistoryLength'),
          t('msgProc.maxHistoryLengthTooltip')
        )}
        style={{ marginBottom: '12px' }}
      >
        <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter={t('msgProc.unit.messages')} />
      </Form.Item>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        <Form.Item
          name="autoSummarize"
          label={renderLabel(
            <FileTextOutlined />,
            t('msgProc.autoSummarize'),
            t('msgProc.autoSummarizeTooltip')
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
            t('msgProc.autoSummarizeAutonomous'),
            t('msgProc.autoSummarizeAutonomousTooltip')
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
        {t('msgProc.toolCallSection')}
      </div>

      <Form.Item
        name="toolResultMaxLength"
        label={renderLabel(
          <ToolOutlined />,
          t('msgProc.toolResultMaxLength'),
          t('msgProc.toolResultMaxLengthTooltip')
        )}
        style={{ marginBottom: '12px' }}
      >
        <InputNumber min={0} max={10000} style={{ width: '100%' }} addonAfter={t('msgProc.unit.chars')} />
      </Form.Item>

      <Form.Item
        name="toolCallContextRounds"
        label={renderLabel(
          <ToolOutlined />,
          t('msgProc.toolCallContextRounds'),
          t('msgProc.toolCallContextRoundsTooltip')
        )}
        style={{ marginBottom: '12px' }}
      >
        <InputNumber 
          min={1} 
          max={10} 
          style={{ width: '100%' }} 
          addonAfter={t('msgProc.unit.rounds')} 
        />
      </Form.Item>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        <Form.Item
          name="splitToolCalls"
          label={renderLabel(
            <ToolOutlined />,
            t('msgProc.splitToolCalls'),
            t('msgProc.splitToolCallsTooltip'),
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
            t('msgProc.compressToolDefinitions'),
            t('msgProc.compressToolDefinitionsTooltip')
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
        {t('msgProc.otherSection')}
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <Form.Item
          name="includeThinking"
          label={renderLabel(
            <BulbOutlined />,
            t('msgProc.includeThinking'),
            t('msgProc.includeThinkingTooltip')
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
            t('msgProc.streamingEnabled'),
            t('msgProc.streamingEnabledTooltip')
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
