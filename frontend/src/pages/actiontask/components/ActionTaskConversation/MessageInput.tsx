import { Input, Button, Select, Space, Avatar, Dropdown, Switch, Tooltip, Mentions } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  EyeOutlined,
  StopOutlined,
  ExpandAltOutlined,
  EditOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  UserOutlined,
  PictureOutlined,
  InfoCircleOutlined,
  VerticalAlignBottomOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import { getAgentAvatarStyle } from '../../../../utils/colorUtils';

const { TextArea } = Input;

/**
 * 消息输入组件
 * 包含文本输入、智能体选择、图像上传、发送按钮等
 */
export default function MessageInput({
  // 任务信息
  task,

  // 输入状态
  userMessage,
  setUserMessage,

  // 智能体选择
  targetAgentIds,
  setTargetAgentIds,

  // 图像附件
  attachedImages,
  showImageUpload,
  setShowImageUpload,

  // 发送控制
  sendingMessage,
  isResponding,
  isSummarizing = false,
  onSendMessage,

  // 消息辅助
  assistingMessage,
  globalSettings,
  onMessageAssist,

  // 隔离模式
  isolationMode,
  setIsolationMode,

  // 智能分发模式
  smartDispatchEnabled = false,
  setSmartDispatchEnabled,

  // 自动滚动控制
  autoScrollEnabled,
  onToggleAutoScroll,

  // SubAgent 协作开关
  subAgentEnabled = false,
  onToggleSubAgent,

  // 自主任务状态
  isAutoDiscussing,

  // 只读模式
  readOnly,

  // 国际化
  t
}) {
  // 如果是只读模式，不渲染输入区域
  if (readOnly) {
    return null;
  }

  // 准备智能体选项列表（用于 @ 提及）
  const agentOptions = task.agents?.filter(agent => !agent.is_observer && agent.type !== 'observer').map((agent) => {
    const isObserver = agent.is_observer || agent.type === 'observer';
    const displayName = agent.role_name ? `${agent.name}[${agent.role_name}]` : agent.name;
    
    return {
      value: displayName, // 显示智能体名称
      label: (
        <Space>
          <Avatar
            icon={isObserver ?
              <EyeOutlined style={{ color: '#ffffff' }} /> :
              <RobotOutlined style={{ color: '#ffffff' }} />
            }
           
            style={getAgentAvatarStyle(agent.id || agent.name, false, isObserver)}
          />
          <span>{displayName}</span>
        </Space>
      ),
      key: String(agent.id),
      agentId: agent.id // 保存智能体 ID 用于添加到目标列表
    };
  }) || [];

  // 处理 @ 选中智能体
  const handleMentionSelect = (option) => {
    const agentId = option.agentId;
    // 如果该智能体尚未在目标列表中，则添加
    if (agentId && !targetAgentIds.includes(agentId)) {
      setTargetAgentIds([...targetAgentIds, agentId]);
    }
  };

  return (
    <div className="message-input-area" style={{
      padding: '16px',
      borderTop: '1px solid var(--custom-border)',
      backgroundColor: 'var(--custom-header-bg)',
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.06)',
      marginTop: 'auto'
    }}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {/* 智能分发开关 + 智能体选择器 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 智能分发开关 - 仅在多智能体时显示 */}
          {task.agents?.filter(a => !a.is_observer && a.type !== 'observer').length > 1 && (
            <Tooltip title={t('conversation.smartDispatchTooltip')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <Switch
                  size="small"
                  checked={smartDispatchEnabled}
                  onChange={(checked) => {
                    setSmartDispatchEnabled(checked);
                    if (checked) {
                      setTargetAgentIds([]);
                    }
                  }}
                  disabled={task.status !== 'active'}
                />
                <ApartmentOutlined style={{ 
                  color: smartDispatchEnabled ? '#1677ff' : 'var(--custom-text-secondary)',
                  fontSize: '14px'
                }} />
              </div>
            </Tooltip>
          )}
          <Select
            placeholder={smartDispatchEnabled ? t('conversation.smartDispatchActive') : t('conversation.selectTargetAgents')}
            style={{ flex: 1, backgroundColor: 'var(--custom-bg)' }}
            allowClear
            mode="multiple"
            value={targetAgentIds}
            onChange={setTargetAgentIds}
            disabled={task.status !== 'active' || smartDispatchEnabled}
            optionLabelProp="label"
          >
          {task.agents?.filter(agent => !agent.is_observer && agent.type !== 'observer').map((agent) => {
            const isObserver = agent.is_observer || agent.type === 'observer';
            return (
              <Select.Option
                key={agent.id}
                value={agent.id}
                label={agent.role_name ? `${agent.name} [${agent.role_name}]` : agent.name}
              >
                <Space>
                  <Avatar
                    icon={isObserver ?
                      <EyeOutlined style={{ color: '#ffffff' }} /> :
                      <RobotOutlined style={{ color: '#ffffff' }} />
                    }
                   
                    style={getAgentAvatarStyle(agent.id || agent.name, false, isObserver)}
                  />
                  {agent.role_name ? `${agent.name} [${agent.role_name}]` : agent.name}
                </Space>
              </Select.Option>
            );
          })}
          </Select>
        </div>

        {/* 输入框和按钮 */}
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Mentions
              value={userMessage}
              onChange={setUserMessage}
              placeholder={isSummarizing ? t('conversation.summarizing') : (isResponding ? "当前智能体正在响应中..." : "输入消息，使用 @ 提及智能体...")}
              autoSize={{ minRows: 3, maxRows: 6 }}
              disabled={task.status !== 'active' || isSummarizing}
              options={agentOptions}
              onSelect={handleMentionSelect}
              prefix="@"
              onPressEnter={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  if (!isSummarizing) {
                    onSendMessage();
                  }
                }
              }}
              style={{
                backgroundColor: 'var(--custom-bg)',
                paddingRight: '40px'
              }}
            />
            {/* 图像上传按钮 - 只在非自主任务时显示 */}
            {!isAutoDiscussing && (
              <Button
                type="text"
                icon={<PictureOutlined />}
               
                onClick={() => setShowImageUpload(!showImageUpload)}
                disabled={task.status !== 'active'}
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  color: showImageUpload ? '#1677ff' : 'var(--custom-text-secondary)',
                  backgroundColor: showImageUpload ? 'var(--msg-human-bg)' : 'transparent',
                  border: 'none',
                  boxShadow: 'none'
                }}
                title={t('conversation.uploadImage')}
              />
            )}
          </div>
          <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* 消息辅助按钮 */}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'expand',
                    label: t('assistant.menu.expand'),
                    icon: <ExpandAltOutlined />,
                    onClick: () => onMessageAssist('expand')
                  },
                  {
                    key: 'optimize',
                    label: t('assistant.menu.optimize'),
                    icon: <EditOutlined />,
                    onClick: () => onMessageAssist('optimize')
                  },
                  {
                    key: 'rewrite',
                    label: t('assistant.menu.rewrite'),
                    icon: <ReloadOutlined />,
                    onClick: () => onMessageAssist('rewrite')
                  },
                  {
                    key: 'professional',
                    label: t('assistant.menu.professional'),
                    icon: <ThunderboltOutlined />,
                    onClick: () => onMessageAssist('professional')
                  },
                  {
                    key: 'casual',
                    label: t('assistant.menu.casual'),
                    icon: <UserOutlined />,
                    onClick: () => onMessageAssist('casual')
                  }
                ]
              }}
              trigger={['hover', 'click']}
              disabled={task.status !== 'active' || !userMessage.trim() || assistingMessage || !globalSettings.enableAssistantGeneration}
            >
              <Button
                type="default"
                icon={<RobotOutlined />}
                disabled={task.status !== 'active' || !userMessage.trim() || !globalSettings.enableAssistantGeneration}
                loading={assistingMessage}
               
                title={!globalSettings.enableAssistantGeneration ? t('conversation.assistantDisabled') : t('conversation.assistantGenerate')}
                style={{
                  fontSize: '12px',
                  height: '32px',
                  borderColor: '#1677ff',
                  color: '#1677ff'
                }}
              >
                {t('assistant.assist')}
              </Button>
            </Dropdown>
            {/* 发送/中断按钮 */}
            <Button
              type={isResponding ? "primary" : "primary"}
              danger={isResponding}
              icon={isResponding ? <StopOutlined /> : <SendOutlined />}
              onClick={onSendMessage}
              loading={sendingMessage || isSummarizing}
              disabled={task.status !== 'active' || isSummarizing || (!isResponding && !userMessage.trim() && attachedImages.length === 0)}
              style={{ height: 'auto', flex: 1 }}
              title={isSummarizing ? t('conversation.summarizing') : (isResponding ? (isAutoDiscussing ? t('conversation.interruptAutoTooltip') : t('conversation.interruptTooltip')) : t('conversation.sendTooltip'))}
            >
              {isSummarizing ? t('conversation.summarizing') : (isResponding ? (isAutoDiscussing ? t('conversation.interruptAgent') : t('conversation.stopResponse')) : t('button.send'))}
            </Button>
          </div>
        </div>

        {/* 状态提示行 */}
        <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* 左侧：隔离模式开关和自动滚动开关 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Switch
              size="small"
              checked={isolationMode}
              onChange={setIsolationMode}
              disabled={task.status !== 'active'}
            />
            <span style={{ fontSize: '12px' }}>
              {t('conversation.isolationMode')}
            </span>
            <Tooltip title={t('conversation.isolationTooltip')}>
              <InfoCircleOutlined style={{ cursor: 'help', color: 'var(--custom-text-secondary)', fontSize: '12px' }} />
            </Tooltip>
            <span style={{ margin: '0 8px', color: 'var(--custom-border)' }}>|</span>
            <Switch
              size="small"
              checked={autoScrollEnabled}
              onChange={onToggleAutoScroll}
            />
            <span style={{ fontSize: '12px' }}>
              {t('conversation.autoScroll')}
            </span>
            <span style={{ margin: '0 8px', color: 'var(--custom-border)' }}>|</span>
            <Switch
              size="small"
              checked={subAgentEnabled}
              onChange={onToggleSubAgent}
              disabled={task.status !== 'active'}
            />
            <Tooltip title={t('conversation.subAgentTooltip')}>
              <span style={{ fontSize: '12px', cursor: 'help' }}>
                🔗 SubAgent
              </span>
            </Tooltip>
          </div>

          {/* 右侧：状态提示和快捷键 */}
          <div style={{ textAlign: 'right' }}>
            {isAutoDiscussing && t('conversation.autoTaskRunning')}
            {isAutoDiscussing && ' | '}
            {t('conversation.shortcutHint', { modifier: navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl' })}
            {attachedImages.length > 0 && (
              <span style={{ color: '#1677ff', marginLeft: '8px' }}>
                • {t('conversation.imagesAttached', { count: attachedImages.length })}
              </span>
            )}
          </div>
        </div>
      </Space>
    </div>
  );
}
