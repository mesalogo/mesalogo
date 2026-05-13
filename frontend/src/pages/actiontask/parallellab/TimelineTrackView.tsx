import React, { useRef, useEffect, useState } from 'react';
import { Card, Tag, Tooltip, Avatar, Typography, Space, Badge, Modal } from 'antd';
import { RobotOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getAgentAvatarStyle } from '../../../utils/colorUtils';
import ConversationExtraction from '../components/ConversationExtraction';

const { Text } = Typography;

interface RunMessage {
  id: number | string;
  agent_name: string | null;
  content: string | any[];  // 支持多模态内容
  role: string;
  created_at: string;
  agent?: {
    id: string;
    name: string;
    description?: string;
    avatar?: string;
  };
  meta?: Record<string, any>;
  source?: string;
}

interface RunData {
  key: string;
  experimentName: string;
  runNumber: number;
  parameters: Record<string, any>;
  progress: number;
  status: string;
  startTime: string;
  messages: RunMessage[];
}

interface TimelineMessage {
  id: string;
  agentName: string;
  agentId: string;
  content: string;
  fullContent: string;
  timestamp: string;
  type: string;
  intervalSeconds: number;
}

interface TimelineTrackViewProps {
  runningRuns: RunData[];
  autoScroll?: boolean;
}

/**
 * TimelineTrackView - 多轨道时间线视图
 * 每条轨道代表一个实验运行实例（对照组），显示其中agent的发言序列
 */
const TimelineTrackView: React.FC<TimelineTrackViewProps> = ({ runningRuns, autoScroll = true }) => {
  const { t } = useTranslation();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<TimelineMessage | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // 自动滚动到最新消息
  useEffect(() => {
    if (autoScroll && timelineRef.current) {
      timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
    }
  }, [runningRuns, autoScroll]);

  // 提取消息的文本内容（支持多模态）
  const extractMessageContent = (content: string | any[]): string => {
    if (typeof content === 'string') {
      return content;
    }
    // 多模态内容：提取文本部分
    if (Array.isArray(content)) {
      return content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text || '')
        .join('\n');
    }
    return '';
  };

  // 将API返回的消息转换为时间线消息格式
  const convertMessagesToTimeline = (run: RunData): TimelineMessage[] => {
    const apiMessages = run.messages || [];
    
    // 如果有真实消息数据，直接使用
    if (apiMessages.length > 0) {
      return apiMessages.map((msg, index) => {
        const prevMsg = index > 0 ? apiMessages[index - 1] : null;
        const currentTime = new Date(msg.created_at).getTime();
        const prevTime = prevMsg ? new Date(prevMsg.created_at).getTime() : currentTime;
        const intervalSeconds = (currentTime - prevTime) / 1000;
        
        const fullContent = extractMessageContent(msg.content);
        const agentName = msg.agent?.name || msg.agent_name || (msg.role === 'human' ? t('parallelLab.timeline.user') : msg.role === 'system' ? t('parallelLab.timeline.system') : t('parallelLab.timeline.unknown'));
        
        return {
          id: String(msg.id),
          agentName: agentName,
          agentId: msg.agent?.id || `agent-${agentName}`,
          content: fullContent.slice(0, 50),
          fullContent: fullContent,
          timestamp: msg.created_at,
          type: msg.role === 'agent' ? 'response' : msg.role === 'tool' ? 'tool' : 'action',
          intervalSeconds: index > 0 ? intervalSeconds : 0
        };
      });
    }
    
    // 如果没有真实消息，生成模拟数据（用于演示）
    return generateMockMessages(run);
  };

  // 生成模拟消息（当没有真实数据时使用）
  const generateMockMessages = (run: RunData): TimelineMessage[] => {
    const messageCount = Math.max(1, Math.floor(run.progress / 10));
    const agents = ['Agent-A', 'Agent-B', 'Agent-C', 'Agent-D'];
    const messages: TimelineMessage[] = [];
    let currentTime = new Date(run.startTime).getTime();

    for (let i = 0; i < messageCount; i++) {
      const seed = parseInt(run.key.replace(/\D/g, '') || '0') + i * 1000;
      const randomInterval = (30 + (Math.sin(seed) * 10000 - Math.floor(Math.sin(seed) * 10000)) * 150) * 1000;
      currentTime += randomInterval;

      messages.push({
        id: `${run.key}-msg-${i}`,
        agentName: agents[i % agents.length],
        agentId: `agent-${i % agents.length}`,
        content: t('parallelLab.timeline.message', { number: i + 1 }),
        fullContent: `${t('parallelLab.timeline.messageDetail')} ${agents[i % agents.length]}.\n\n${t('parallelLab.timeline.messageLabel', { number: i + 1 })}\n${new Date(currentTime).toLocaleString()}`,
        timestamp: new Date(currentTime).toISOString(),
        type: i % 3 === 0 ? 'action' : 'response',
        intervalSeconds: i > 0 ? randomInterval / 1000 : 0
      });
    }

    return messages;
  };

  // 计算所有运行实例中最大的消息数量（用于压缩时间轴）
  const calculateMaxMessageCount = (runs: RunData[]) => {
    if (!runs || runs.length === 0) return 0;
    let maxCount = 0;
    runs.forEach(run => {
      const messages = convertMessagesToTimeline(run);
      maxCount = Math.max(maxCount, messages.length);
    });
    return maxCount;
  };

  const maxMessageCount = calculateMaxMessageCount(runningRuns);
  // 动态计算时间轴宽度：每个消息占50px，最小400px，最大1200px
  const dynamicWidth = Math.min(1200, Math.max(400, maxMessageCount * 50));
  const timelineWidth = dynamicWidth;
  const timelineStartPadding = 20; // 时间轴左侧起始边距

  // 生成消息序号刻度（压缩时间轴，按消息序号对齐）
  const generateTimeMarkers = () => {
    if (maxMessageCount === 0) return [];

    const markers = [];
    // 根据消息数量动态调整刻度间隔
    const interval = maxMessageCount > 20 ? 5 : maxMessageCount > 10 ? 2 : 1;

    for (let i = 0; i <= maxMessageCount; i += interval) {
      const progress = maxMessageCount > 1 ? i / (maxMessageCount - 1) : 0;
      const leftPosition = timelineStartPadding + progress * timelineWidth;
      markers.push({
        position: leftPosition,
        label: i === 0 ? t('parallelLab.timeline.messageLabel', { number: 1 }) : t('parallelLab.timeline.messageLabel', { number: i + 1 })
      });
    }

    return markers;
  };

  const timeMarkers = generateTimeMarkers();

  // 渲染单条轨道
  const renderTrack = (run: RunData, index: number) => {
    const messages = convertMessagesToTimeline(run);
    const isRunning = run.status === 'running';
    const messageCount = messages.length;

    return (
      <div
        key={run.key}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 0',
          borderBottom: index < runningRuns.length - 1 ? '1px solid var(--custom-border)' : 'none',
          minHeight: '100px'
        }}
      >
        {/* 轨道标签 - 固定在左侧 */}
        <div
          style={{
            width: '216px',
            minWidth: '216px',
            boxSizing: 'border-box',
            flexShrink: 0,
            paddingLeft: '16px',
            paddingRight: '16px',
            position: 'sticky',
            left: 0,
            backgroundColor: 'var(--custom-card-bg)',
            zIndex: 2,
            boxShadow: '4px 0 8px -2px rgba(0, 0, 0, 0.06)'
          }}
        >
          <div style={{ marginBottom: '4px' }}>
            <Text strong style={{ fontSize: '13px' }}>
              {run.experimentName}
            </Text>
          </div>
          <div style={{ marginBottom: '4px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {t('parallelLab.timeline.run', { number: run.runNumber })}
            </Text>
          </div>
          <div>
            <Space size={4} wrap>
              {Object.entries(run.parameters).slice(0, 2).map(([key, value]) => (
                <Tag key={key} style={{ fontSize: '11px', margin: '2px 0' }}>
                  {key}: {String(value)}
                </Tag>
              ))}
            </Space>
          </div>
          <div style={{ marginTop: '4px' }}>
            <Badge
              status={isRunning ? 'processing' : run.status === 'completed' ? 'success' : 'error'}
              text={
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {run.progress}%
                </Text>
              }
            />
          </div>
        </div>

        {/* 时间线轨道 */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '8px',
            minWidth: `${timelineWidth + timelineStartPadding}px`
          }}
        >
          {/* 轨道背景线 */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '2px',
              backgroundColor: isRunning ? '#1677ff' : 'var(--custom-border)',
              opacity: 0.3,
              transform: 'translateY(-50%)'
            }}
          />

          {/* Agent消息气泡 - 按消息序号等距定位（压缩时间轴） */}
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {messages.map((message, msgIndex) => {
              // 按消息序号等距分布，而不是按真实时间
              // 这样可以压缩时间轴，让所有消息均匀分布
              const progress = maxMessageCount > 1 ? msgIndex / (maxMessageCount - 1) : 0;
              const leftPosition = timelineStartPadding + progress * timelineWidth;

              return (
              <Tooltip
                key={message.id}
                title={
                  <div>
                    <div><strong>{message.agentName}</strong></div>
                    <div style={{ fontSize: '11px' }}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                    {msgIndex > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--custom-text-secondary)' }}>
                        {t('parallelLab.timeline.interval')}: {Math.floor(message.intervalSeconds / 60)}{t('parallelLab.timeline.minutes')}{Math.floor(message.intervalSeconds % 60)}{t('parallelLab.timeline.seconds')}
                      </div>
                    )}
                    <div style={{ marginTop: '4px' }}>{message.content}</div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#1677ff', borderTop: '1px solid var(--custom-border)', paddingTop: '6px' }}>
                      {t('parallelLab.timeline.clickToView')}
                    </div>
                  </div>
                }
                placement="top"
              >
                <div
                  onMouseEnter={() => setHoveredMessage(message.id)}
                  onMouseLeave={() => setHoveredMessage(null)}
                  onClick={() => {
                    setSelectedMessage(message);
                    setModalVisible(true);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${leftPosition}px`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer'
                  }}
                >
                  <Avatar
                    size={32}
                    icon={<RobotOutlined />}
                    style={{
                      ...getAgentAvatarStyle(message.agentId),
                      boxShadow: message.type === 'action' ? '0 2px 8px rgba(22, 119, 255, 0.3)' : 'none',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      transform: hoveredMessage === message.id ? 'scale(1.15)' : 'scale(1)'
                    }}
                  />
                  {/* 消息序号 */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      backgroundColor: 'var(--custom-card-bg)',
                      border: '1px solid var(--custom-border)',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: 'var(--custom-text-secondary)'
                    }}
                  >
                    {msgIndex + 1}
                  </div>
                </div>
              </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (!runningRuns || runningRuns.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--custom-text-secondary)' }}>
        {t('parallelLab.monitor.noRunData')}
      </div>
    );
  }

  return (
    <div>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.5;
              transform: scale(1.3);
            }
          }
        `}
      </style>

      {/* 时间轴说明 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: 'var(--md-code-bg)',
          borderRadius: '4px',
          marginBottom: '16px'
        }}
      >
        <ClockCircleOutlined style={{ marginRight: '8px', color: '#1677ff' }} />
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {t('parallelLab.timeline.description')}
        </Text>
      </div>

      {/* 轨道容器 */}
      <Card bodyStyle={{ padding: '0' }}>
        <div
          ref={timelineRef}
          style={{
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: '600px',
            position: 'relative'
          }}
        >
          <div style={{ minWidth: '800px' }}>
            {/* 时间刻度标尺 */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                display: 'flex',
                alignItems: 'center',
                height: '40px',
                backgroundColor: 'var(--custom-header-bg)',
                borderBottom: '1px solid var(--custom-border)',
                zIndex: 5
              }}
            >
              {/* 左侧固定区域占位 - sticky 遮挡滚过来的刻度 */}
              <div style={{
                width: '216px',
                minWidth: '216px',
                flexShrink: 0,
                position: 'sticky',
                left: 0,
                backgroundColor: 'var(--custom-header-bg)',
                zIndex: 6,
                height: '100%'
              }} />
              
              {/* 时间刻度 */}
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  height: '100%',
                  minWidth: `${timelineWidth + timelineStartPadding}px`
                }}
              >
                {timeMarkers.map((marker, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${marker.position}px`,
                      top: 0,
                      height: '100%',
                      borderLeft: '1px dashed var(--custom-border)',
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {marker.label}
                    </Text>
                  </div>
                ))}
              </div>
            </div>

            {/* 轨道列表 */}
            {runningRuns.map((run, index) => renderTrack(run, index))}
          </div>
        </div>
      </Card>

      {/* 消息详情弹窗 */}
      <Modal
        title={
          <div>
            <Avatar
              size={24}
              icon={<RobotOutlined />}
              style={{
                ...getAgentAvatarStyle(selectedMessage?.agentId),
                marginRight: '8px',
                verticalAlign: 'middle'
              }}
            />
            <span style={{ verticalAlign: 'middle' }}>{selectedMessage?.agentName} - {t('parallelLab.timeline.messageDetail')}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedMessage(null);
        }}
        footer={null}
        width={800}
      >
        {selectedMessage && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Space style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">{t('parallelLab.timeline.sendTime')}：</Text>
                  <Text>{new Date(selectedMessage.timestamp).toLocaleString()}</Text>
                </div>
                <div>
                  <Text type="secondary">{t('parallelLab.timeline.messageType')}：</Text>
                  <Tag color={selectedMessage.type === 'action' ? 'blue' : 'default'}>
                    {selectedMessage.type === 'action' ? t('parallelLab.timeline.actionMessage') : t('parallelLab.timeline.responseMessage')}
                  </Tag>
                </div>
              </Space>
            </div>
            <div
              style={{
                backgroundColor: 'var(--md-code-bg)',
                padding: '16px',
                borderRadius: '4px',
                maxHeight: '500px',
                overflowY: 'auto'
              }}
            >
              <ConversationExtraction content={selectedMessage.fullContent} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TimelineTrackView;
