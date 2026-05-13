import { Empty, Avatar, Tag, Typography } from 'antd';
import { RobotOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import MessageItem from '../MessageItem';
import ConversationExtraction from '../ConversationExtraction';
import { getAgentAvatarStyle, getAgentColor, hexToRgb } from '../../../../utils/colorUtils';
import Minimap from '../../../../components/Minimap';

const { Text } = Typography;

/**
 * 消息列表组件
 * 显示历史消息和流式响应
 */
export default function MessageList({
  // 消息数据
  messages,

  // 流式状态
  isResponding,
  streamingAgentId,
  currentStreamingResponse,
  isObserving,

  // 任务信息
  task,

  // 滚动引用
  messagesEndRef,
  messageContainerRef,

  // 国际化
  t
}) {
  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div ref={messageContainerRef} className="message-history hide-scrollbar" style={{
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        paddingRight: '16px', 
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
      {messages.length === 0 ? (
        <Empty
          description="暂无消息"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: 'auto' }}
        />
      ) : (
        messages.map((msg, index) => (
          <MessageItem
            key={msg.id || index}
            message={msg}
            index={index}
            task={task}
            isVirtual={msg.isVirtual}
            isObserving={isObserving}
            streamingAgentId={streamingAgentId}
          />
        ))
      )}

      {/* 显示当前正在生成的流式响应 */}
      {isResponding && (
        <div
          className="message-item received streaming-message-container active"
          style={{
            marginBottom: '16px',
            alignSelf: 'flex-start',
            width: '80%',
            padding: '10px 16px',
            borderRadius: '10px 10px 10px 0',
            backgroundColor: 'var(--custom-card-bg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            // 设置智能体颜色的 CSS 变量，用于脉冲动画
            '--streaming-pulse-color': streamingAgentId 
              ? hexToRgb(getAgentColor(streamingAgentId))
              : '22, 119, 255'
          } as React.CSSProperties}
        >
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
            {(() => {
              // 检查当前流式智能体是否为监督者
              const streamingAgent = task.agents?.find(agent =>
                agent.id === Number(streamingAgentId) || String(agent.id) === String(streamingAgentId)
              );
              const isObserverAgent = streamingAgent && (streamingAgent.is_observer || streamingAgent.type === 'observer');

              return (
                <Avatar
                  icon={isObserverAgent ?
                    <EyeOutlined style={{ color: '#ffffff' }} /> :
                    <RobotOutlined style={{ color: '#ffffff' }} />
                  }
                 
                  style={{
                    ...getAgentAvatarStyle(streamingAgentId, isObserving, isObserverAgent),
                    marginRight: '8px'
                  }}
                />
              );
            })()}
            <Text strong>
              {(() => {
                if (streamingAgentId) {
                  const numericId = Number(streamingAgentId);
                  const agent = task.agents?.find(a => a.id === numericId) 
                    || task.agents?.find(a => String(a.id) === String(streamingAgentId));
                  if (agent) {
                    return agent.role_name ? `${agent.name} [${agent.role_name}]` : agent.name;
                  }
                  return `智能体-${streamingAgentId}`;
                }
                return '系统';
              })()}
            </Text>

            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8px' }}>
              {isResponding && (
                <Tag color="red">可随时中断</Tag>
              )}
            </div>

            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 'auto' }}>
              {new Date().toLocaleString()}
            </Text>
          </div>
          <div style={{ margin: 0 }}>
            {/* 如果有流式内容，显示内容；否则显示响应中状态 */}
            {currentStreamingResponse ? (
              <ConversationExtraction
                content={currentStreamingResponse}
                task={task}
              />
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                color: 'grey'
              }}>
                <SyncOutlined spin style={{ marginRight: '8px' }} />
                等待回应...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 消息列表末尾的引用，用于滚动 */}
      <div ref={messagesEndRef} />
      </div>

      {/* Minimap 缩略图导航 */}
      <Minimap
        containerRef={messageContainerRef}
        messages={messages}
        width={40}
      />
    </div>
  );
}
