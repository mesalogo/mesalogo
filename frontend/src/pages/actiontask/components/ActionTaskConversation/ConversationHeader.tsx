import { Row, Col, Select, Button, Tooltip, Typography, Badge } from 'antd';
import {
  PlusOutlined,
  TeamOutlined,
  ReloadOutlined,
  SyncOutlined,
  InfoCircleOutlined,
  MessageOutlined
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * 对话头部组件
 * 包含会话选择器、操作按钮和进度Banner
 */
export default function ConversationHeader({
  // 会话数据
  conversations,
  activeConversationId,
  conversationsLoading,
  onChangeConversation,

  // 刷新功能
  refreshingMessages,
  onRefresh,

  // 创建会话
  onCreateClick,

  // 自主任务
  onStartAutoDiscuss,
  onStopAutoDiscuss,
  isAutoDiscussing,
  startingAutoDiscussion,
  stoppingDiscussion,

  // 状态控制
  isResponding,
  sendingMessage,

  // 进度信息
  currentDiscussionRound,
  currentDiscussionTotalRounds,
  discussionAgentInfo,

  // 外部传入（公开访问模式）
  externalConversations,

  // 国际化
  t
}) {
  return (
    <>
      {/* 会话选择器和操作按钮 */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--custom-border)', backgroundColor: 'var(--custom-header-bg)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
        <Row gutter={[8, 8]} align="middle">
          <Col flex="auto">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Select
                loading={conversationsLoading}
                placeholder={t('conversation.selectOrCreate')}
                style={{ width: 180 }}
                value={activeConversationId}
                onChange={onChangeConversation}
                disabled={isResponding || sendingMessage || isAutoDiscussing}
              >
                {conversations.map(conversation => (
                  <Select.Option key={conversation.id} value={conversation.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {conversation.title}
                      </span>
                      <Badge 
                        count={conversation.message_count} 
                        showZero
                        style={{ 
                          backgroundColor: 'var(--custom-primary-bg, #e6f4ff)', 
                          color: 'var(--custom-primary, #1677ff)',
                          fontSize: '11px',
                          marginLeft: 8,
                          boxShadow: 'none'
                        }} 
                      />
                    </div>
                  </Select.Option>
                ))}
              </Select>
              <Tooltip title={t('conversation.newConversation')}>
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={onCreateClick}
                  disabled={isResponding || sendingMessage || isAutoDiscussing}
                  style={{ padding: '0 8px', marginLeft: 4, color: 'var(--custom-text-secondary)' }}
                />
              </Tooltip>
              <Tooltip title={t('conversation.refreshTooltip')}>
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={onRefresh}
                  disabled={isResponding || sendingMessage || isAutoDiscussing || !activeConversationId}
                  loading={refreshingMessages}
                  style={{ color: 'var(--custom-text-secondary)' }}
                />
              </Tooltip>
            </div>
          </Col>
          <Col>
            <Tooltip title={t('autoTask.startTooltip')}>
              <Button
                type="primary"
                icon={<TeamOutlined />}
                onClick={onStartAutoDiscuss}
                disabled={isResponding || sendingMessage || !activeConversationId || isAutoDiscussing}
                loading={startingAutoDiscussion}
              >
                {t('autoTask.start')}
              </Button>
            </Tooltip>
          </Col>
          {isAutoDiscussing && (
            <Col>
              <Button
                danger
                onClick={onStopAutoDiscuss}
                loading={stoppingDiscussion}
              >
                {t('autoTask.stop')}
              </Button>
            </Col>
          )}
        </Row>
      </div>

      {/* 临时会话提示 Banner */}
      {externalConversations !== null && (
        <div style={{
          backgroundColor: 'var(--msg-human-bg)',
          borderBottom: '1px solid var(--tree-selected-border)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <InfoCircleOutlined style={{ color: '#1677ff', fontSize: '14px', marginRight: '8px' }} />
          <Text style={{ fontSize: '13px' }}>
            <Text strong>{t('autoTask.tempMode')}：</Text>
            {t('autoTask.tempConversationBanner')}
          </Text>
        </div>
      )}

      {/* 自主任务进度提示 Banner */}
      {isAutoDiscussing && (
        <div style={{
          backgroundColor: 'var(--msg-human-bg)',
          borderBottom: '1px solid var(--tree-selected-border)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <SyncOutlined spin style={{ color: '#1677ff', fontSize: '14px', marginRight: '8px' }} />
          <div style={{ flex: 1 }}>
            <Text style={{ fontSize: '13px' }}>
              <Text strong>{t('autoTask.progressTitle')}：</Text>
              {currentDiscussionRound > 0 && (
                <span>{t('autoTask.roundProgress', { current: currentDiscussionRound, total: currentDiscussionTotalRounds })}</span>
              )}
              {discussionAgentInfo && (
                <>
                  {!discussionAgentInfo.isSummarizing ? (
                    <span>
                      {' '}- {discussionAgentInfo.name}
                      {discussionAgentInfo.turnPrompt
                        ? ` ${discussionAgentInfo.turnPrompt}`
                        : ` 正在思考 (${discussionAgentInfo.responseOrder}/${discussionAgentInfo.totalAgents})`}
                    </span>
                  ) : (
                    <span>
                      {' '}- {discussionAgentInfo.name}
                      {discussionAgentInfo.turnPrompt ? ` ${discussionAgentInfo.turnPrompt}` : ` 正在总结讨论结果`}
                    </span>
                  )}
                </>
              )}
            </Text>
          </div>
        </div>
      )}
    </>
  );
}
