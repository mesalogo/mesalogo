import React, { useMemo } from 'react';
import { Tag, Typography, Alert, Avatar, Button, App, Spin } from 'antd';
import { RobotOutlined, EyeOutlined, CopyOutlined, UserOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ConversationExtraction from './ConversationExtraction';
import { getAgentAvatarStyle, getAgentColor } from '../../../utils/colorUtils';

const { Text } = Typography;

/**
 * 消息项组件 - 使用React.memo优化渲染
 * 负责消息的整体布局和样式，内容渲染委托给ConversationExtraction组件
 */
const MessageItem = React.memo(({
  message,
  index,
  task,
  isObserving = false,
  streamingAgentId = null
}: any) => {
  // 获取 Ant Design App 上下文中的 message 实例
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();

  // 复制消息内容到剪贴板
  const handleCopyMessage = () => {
    let textToCopy = '';

    // 提取消息的纯文本内容
    if (typeof message.content === 'string') {
      textToCopy = message.content;
    } else if (Array.isArray(message.content)) {
      // 处理多模态内容，只提取文本部分
      textToCopy = message.content
        .filter(item => item.type === 'text')
        .map(item => item.text || '')
        .join('');
    }

    // 如果有思考内容，也包含进去
    if (message.thinking && typeof message.thinking === 'string') {
      textToCopy = `${message.thinking}\n\n${textToCopy}`;
    }

    if (textToCopy.trim()) {
      navigator.clipboard.writeText(textToCopy.trim()).then(() => {
        messageApi.success('消息内容已复制到剪贴板');
      }).catch(() => {
        messageApi.error('复制失败');
      });
    } else {
      messageApi.warning('没有可复制的文本内容');
    }
  };

  // 使用useMemo优化性能，避免不必要的重新渲染
  // 但不再创建一个变量来存储组件实例，而是直接在JSX中使用

  // 使用useMemo缓存目标智能体标签
  const TargetAgentTags = useMemo(() => {
    // 智能分发模式：正在选择中（smart_dispatch=true 且还没有 target_agent_ids）
    if (message.smart_dispatch && (!message.target_agent_ids || message.target_agent_ids.length === 0)) {
      return (
        <div style={{ marginTop: '5px' }}>
          <Tag 
            icon={<Spin size="small" style={{ marginRight: 4 }} />}
            color="processing"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            <ApartmentOutlined style={{ marginRight: 4 }} />
            {t('conversation.smartDispatching')}
          </Tag>
        </div>
      );
    }

    // 智能分发已选中（smart_dispatch=true 且有 target_agent_ids）
    if (message.smart_dispatch && message.target_agent_ids && message.target_agent_ids.length > 0) {
      return (
        <div style={{ marginTop: '5px' }}>
          {message.target_agent_ids.map(agentId => {
            const agent = task.agents?.find(a => a.id === agentId || String(a.id) === String(agentId));
            return (
              <Tag
                color={message.isVirtual ? 'default' : getAgentColor(agentId)}
                key={agentId}
                icon={<ApartmentOutlined />}
                style={{ marginRight: '5px' }}
              >
                {agent ? `@${agent.name}` : `@智能体-${agentId}`}
              </Tag>
            );
          })}
        </div>
      );
    }

    // 普通模式：无指定目标 → 所有智能体
    if (!message.target_agent_ids || message.target_agent_ids.length === 0) {
      return (
        <div style={{ marginTop: '5px' }}>
          <Tag color={message.isVirtual ? 'default' : 'blue'}>@{t('conversation.allAgents')}</Tag>
        </div>
      );
    }

    // 普通模式：有指定目标
    return (
      <div style={{ marginTop: '5px' }}>
        {message.target_agent_ids.map(agentId => {
          const agent = task.agents?.find(a => a.id === agentId || String(a.id) === String(agentId));
          return (
            <Tag
              color={message.isVirtual ? 'default' : getAgentColor(agentId)}
              key={agentId}
              style={{ marginRight: '5px' }}
            >
              {agent ? `@${agent.name}` : `@智能体-${agentId}`}
            </Tag>
          );
        })}
      </div>
    );
  }, [message.target_agent_ids, message.smart_dispatch, message.isVirtual, task.agents, t]);

  // 思考内容现在由ConversationExtraction组件处理

  // 检查是否是总结消息（作为 human message 存储）
  const isSummaryMessage = message.role === 'human' && 
    message.content && 
    typeof message.content === 'string' && 
    message.content.includes('[上一会话总结]');

  // 检查是否是上下文总结消息（通过 meta.type 判断）
  const isContextSummaryMessage = message.role === 'system' && 
    message.meta?.type === 'context_summary';

  // 检查是否是 SubAgent 调用记录消息
  const isSubAgentInvocation = message.role === 'system' &&
    message.meta?.type === 'subagent_invocation';

  // 渲染消息
  return (
    <div
      key={message.id || index}
      className={`message-item ${message.role === 'human' ? 'sent' : 'received'}`}
      style={{
        marginBottom: '16px',
        alignSelf: message.role === 'human' ? 'flex-end' : 'flex-start',
        width: message.role === 'human' ? '' : '80%',
        maxWidth: '80%',
        padding: '10px 16px',
        borderRadius: message.role === 'human' ? '10px 10px 0 10px' : '10px 10px 10px 0',
        backgroundColor: message.isVirtual ? 'var(--custom-hover-bg)' : (message.role === 'human' ? 'var(--msg-human-bg)' : 'var(--custom-card-bg)'),
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      {isSummaryMessage ? (
        // 会话总结特殊样式
        <div>
          {/* 时间戳 */}
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {new Date(message.timestamp || message.created_at).toLocaleString()}
            </Text>
          </div>
          {/* 总结内容卡片 */}
          <div style={{
            background: 'var(--md-code-bg)',
            borderLeft: '4px solid #1677ff',
            padding: '16px',
            borderRadius: '4px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#1677ff',
              fontWeight: 500
            }}>
              <EyeOutlined />
              <Text strong style={{ color: '#1677ff' }}>上一会话总结</Text>
            </div>
            <div style={{ color: 'var(--custom-text-secondary)', lineHeight: 1.6 }}>
              <ConversationExtraction 
                message={{
                  ...message,
                  content: message.content.replace('**[上一会话总结]**\n\n', '')
                }} 
              />
            </div>
          </div>
        </div>
      ) : isContextSummaryMessage ? (
        // 上下文总结特殊样式（绿色边框）
        <div>
          {/* 时间戳 */}
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {new Date(message.timestamp || message.created_at).toLocaleString()}
            </Text>
          </div>
          {/* 总结内容卡片 */}
          <div style={{
            background: 'var(--md-code-bg)',
            borderLeft: '4px solid #52c41a',
            padding: '16px',
            borderRadius: '4px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#52c41a',
              fontWeight: 500
            }}>
              <EyeOutlined />
              <Text strong style={{ color: '#52c41a' }}>{t('conversation.contextSummary')}</Text>
            </div>
            <div style={{ color: 'var(--custom-text-secondary)', lineHeight: 1.6 }}>
              <ConversationExtraction 
                message={message} 
              />
            </div>
          </div>
        </div>
      ) : isSubAgentInvocation ? (
        // SubAgent 调用记录（紫色边框）
        <div>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {new Date(message.timestamp || message.created_at).toLocaleString()}
            </Text>
          </div>
          <div style={{
            background: 'var(--md-code-bg)',
            borderLeft: '4px solid #722ed1',
            padding: '12px 16px',
            borderRadius: '4px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              color: '#722ed1',
              fontWeight: 500,
              fontSize: '13px'
            }}>
              <span>🔗</span>
              <Text strong style={{ color: '#722ed1' }}>
                SubAgent 调用
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {message.meta?.caller_agent_name} → {message.meta?.target_agent_name}
              </Text>
              <Tag
                color={message.meta?.status === 'success' ? 'success' : 'error'}
                style={{ fontSize: '11px', lineHeight: '18px', padding: '0 4px', marginLeft: 'auto' }}
              >
                {message.meta?.status === 'success' ? '成功' : '失败'}
              </Tag>
              {message.meta?.elapsed_seconds && (
                <Tag style={{ fontSize: '11px', lineHeight: '18px', padding: '0 4px' }}>
                  {message.meta.elapsed_seconds}s
                </Tag>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)', marginBottom: '8px' }}>
              任务: {message.meta?.task_description?.substring(0, 150)}{message.meta?.task_description?.length > 150 ? '...' : ''}
            </div>
            {message.meta?.response_summary && (
              <div style={{
                fontSize: '12px',
                color: 'var(--custom-text)',
                lineHeight: 1.6,
                padding: '8px',
                background: 'var(--custom-card-bg)',
                borderRadius: '4px',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {message.meta.response_summary}
              </div>
            )}
          </div>
        </div>
      ) : message.role === 'system' ? (
        // 系统消息样式
        <div style={{ alignSelf: 'flex-end', width: 'auto', maxWidth: '100%' }}>
          <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {(() => {
              // 检查是否有智能体信息
              const agentId = message.agent_id || (message.agent && message.agent.id);
              const agentName = message.agent_name || (message.agent && message.agent.name);
              const roleName = message.role_name || (message.agent && message.agent.role_name);

              // 如果有智能体信息，显示智能体名称和角色
              if (agentId && agentName) {
                return (
                  <Tag color={getAgentColor(agentId || agentName)}>
                    {roleName ? `${agentName} [${roleName}]` : agentName}
                  </Tag>
                );
              }

              // 检查消息内容是否包含错误信息
              const content = message.content || '';
              const isErrorMessage = typeof content === 'string' &&
                (content.includes('API请求失败') ||
                 content.includes('智能体处理失败') ||
                 content.includes('错误原因'));

              // 如果是错误消息，尝试从内容中提取智能体名称
              if (isErrorMessage) {
                // 尝试从错误消息中提取智能体名称和角色 - 多种格式匹配
                let errorMatch = content.match(/智能体\s+([^(]+)\(([^)]+)\)\s+处理失败/);
                if (!errorMatch) {
                  errorMatch = content.match(/智能体处理失败[：:]\s*([^(]+)\(([^)]+)\)/);
                }
                if (!errorMatch) {
                  errorMatch = content.match(/智能体\s+([^\[]+)\[([^\]]+)\]\s+处理失败/);
                }
                if (!errorMatch) {
                  errorMatch = content.match(/警告: 智能体\s+([^,]+),\s+([^,]+)/);
                }

                if (errorMatch && errorMatch.length >= 3) {
                  const extractedName = errorMatch[1].trim();
                  const extractedRole = errorMatch[2].trim();
                  return (
                    <Tag color="red">
                      {`${extractedName} [${extractedRole}]`}
                    </Tag>
                  );
                }

                // 尝试匹配 "Input data may contain inappropriate content" 错误
                if (content.includes('Input data may contain inappropriate content')) {
                  // 查找前面的智能体名称
                  const aliyunMatch = content.match(/\[流式API\] 警告: 智能体 ([^(]+)\(([^)]+)\) 处理失败/);
                  if (aliyunMatch && aliyunMatch.length >= 3) {
                    const extractedName = aliyunMatch[1].trim();
                    const extractedRole = aliyunMatch[2].trim();
                    return (
                      <Tag color="red">
                        {`${extractedName} [${extractedRole}]`}
                      </Tag>
                    );
                  }
                }
              }

              // 否则显示默认的"系统"标签
              return <Tag color="purple">系统</Tag>;
            })()}
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {new Date(message.timestamp || message.created_at).toLocaleString()}
            </Text>
          </div>
          <Alert
            type={message.content && typeof message.content === 'string' && (
              message.content.includes('错误') ||
              message.content.includes('失败') ||
              message.content.includes('API请求') ||
              message.content.includes('Input data may contain inappropriate content')
            ) ? "error" : "info"}
            message={<ConversationExtraction message={message} task={task} />}
            style={{ textAlign: 'left' }}
          />
        </div>
      ) : message.role === 'human' ? (
        // 人类用户消息样式
        <>
          <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar
                icon={<UserOutlined style={{ color: '#ffffff' }} />}
                style={{
                  backgroundColor: '#1677ff',
                  marginRight: '4px'
                }}
                size="small"
              />
              <Text strong>用户</Text>
              {message.isVirtual && <Tag color="orange">虚拟消息</Tag>}
              {/* 检查是否为监督者干预消息 */}
              {message.source === 'supervisorConversation' && message.meta?.type === 'info' && (
                <Tag color="purple">干预</Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {new Date(message.timestamp || message.created_at).toLocaleString()}
            </Text>
          </div>
          <div style={{
            margin: 0,
            color: message.isVirtual ? 'var(--custom-text-secondary)' : 'inherit'
          }}>
            <ConversationExtraction message={message} task={task} />
          </div>
          {TargetAgentTags}
        </>
      ) : (
        // 智能体消息样式
        <>
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
            {(() => {
              // 检查是否为监督者智能体
              const agentId = message.agent_id || (message.agent && message.agent.id);
              const agent = task.agents?.find(a => a.id === agentId || String(a.id) === String(agentId));
              const isObserver = agent && (agent.is_observer || agent.type === 'observer');

              return (
                <Avatar
                  icon={isObserver ?
                    <EyeOutlined style={{ color: '#ffffff' }} /> :
                    <RobotOutlined style={{ color: '#ffffff' }} />
                  }
                 
                  style={{
                    ...getAgentAvatarStyle(
                      message.agent_id || message.agent_name,
                      message.agent_id === streamingAgentId && isObserving,
                      isObserver
                    ),
                    marginRight: '8px'
                  }}
                />
              );
            })()}
            <Text strong>
              {(() => {
                // 获取智能体信息
                const agentId = message.agent_id || (message.agent && message.agent.id);
                let agentName = message.agent_name || (message.agent && message.agent.name);
                let roleName = message.role_name || (message.agent && message.agent.role_name);

                // 优先从task.agents中查找完整的智能体信息
                if (task.agents && agentId) {
                  const agent = task.agents.find(a => a.id === agentId || String(a.id) === String(agentId));
                  if (agent) {
                    // 使用task.agents中的名称和角色信息（优先级更高）
                    agentName = agent.name || agentName;
                    roleName = agent.role_name || roleName;

                    // 如果还没有角色名称，尝试从role_id查询
                    if (!roleName && agent.role_id && task.roles) {
                      const role = task.roles.find(r => r.id === agent.role_id || String(r.id) === String(agent.role_id));
                      if (role) {
                        roleName = role.name;
                      }
                    }
                  }
                }

                // 如果还是没有智能体名称，使用默认值
                if (!agentName) {
                  agentName = '智能体';
                }

                // 组合显示
                if (roleName) {
                  return `${agentName} [${roleName}]`;
                }

                return agentName;
              })()}
            </Text>

            {message.agent_id === streamingAgentId && isObserving && (
              <Tag color="orange" style={{ marginLeft: '8px' }}>回应中...</Tag>
            )}

            {/* 检查是否为监督者干预回复 */}
            {message.source === 'supervisorConversation' && message.meta?.type === 'info' && (
              <Tag color="purple" style={{ marginLeft: '8px' }}>干预</Tag>
            )}

            {message.response_order && (
              <Tag color="cyan" style={{ marginLeft: '8px' }}>响应顺序: {message.response_order}</Tag>
            )}

            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 'auto' }}>
              {new Date(message.timestamp || message.created_at).toLocaleString()}
            </Text>
          </div>

          {/* 消息内容 - 使用ConversationExtraction组件渲染 */}
          <div style={{ margin: 0, paddingBottom: '0px' }}>
            <ConversationExtraction message={message} task={task} />
          </div>

          {/* 复制按钮 - 位于消息左下角，独立于内容区域 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginTop: '4px',
            marginLeft: '-4px'
          }}>
            <Button
              type="text"
             
              icon={<CopyOutlined />}
              onClick={handleCopyMessage}
              style={{
                opacity: 0.6,
                fontSize: '16px',
                padding: '2px 4px',
                height: '20px',
                minWidth: 'auto',
                color: 'var(--custom-text-secondary)',
                border: 'none',
                boxShadow: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.color = '#1677ff';
                e.currentTarget.style.backgroundColor = 'var(--custom-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.color = 'var(--custom-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="复制消息内容"
            />
          </div>
        </>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只有在关键属性变化时才重新渲染

  // 检查流式响应状态是否变化
  if (prevProps.isObserving !== nextProps.isObserving) return false;
  if (prevProps.streamingAgentId !== nextProps.streamingAgentId) return false;

  // 检查消息本身是否变化
  if (prevProps.message.id !== nextProps.message.id) return false;
  if (prevProps.message.content !== nextProps.message.content) return false;
  if (prevProps.message.thinking !== nextProps.message.thinking) return false;
  if (prevProps.message.timestamp !== nextProps.message.timestamp) return false;
  if (prevProps.message.isVirtual !== nextProps.message.isVirtual) return false;

  // 检查智能体ID是否变化
  if (prevProps.message.agent_id !== nextProps.message.agent_id) return false;

  // 检查目标智能体数组是否变化
  if (JSON.stringify(prevProps.message.target_agent_ids) !== JSON.stringify(nextProps.message.target_agent_ids)) return false;

  // 如果所有关键属性都相同，则不需要重新渲染
  return true;
});

export default MessageItem;
