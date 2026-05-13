import { Modal, Form, Input, Button, Switch, Typography } from 'antd';
import ImageUploadModal from '../ImageUploadModal';
import AutonomousTaskModal from '../AutonomousTaskModal';

const { Text } = Typography;

/**
 * 对话相关模态框集合
 * 包含创建会话、图像上传、自主任务配置三个模态框
 */
export default function ConversationModals({
  // 创建会话模态框
  showNewConversationModal,
  setShowNewConversationModal,
  newConversationTitle,
  setNewConversationTitle,
  creatingConversation,
  showCreateValidation,
  onCreateConversation,
  enableSummary,
  setEnableSummary,
  hasDefaultModel,
  activeConversationId,
  messages,

  // 图像上传模态框
  showImageUpload,
  setShowImageUpload,
  attachedImages,
  onImageUpload,
  onRemoveImage,
  task,

  // 自主任务模态框
  autoDiscussModalVisible,
  setAutoDiscussModalVisible,
  startingAutoDiscussion,
  onAutoDiscussConfirm,
  onAutoDiscussCancel,
  autoDiscussionOptions,
  setAutoDiscussionOptions,
  environmentVariables,
  agentVariables,

  // 国际化
  t
}) {
  return (
    <>
      {/* 创建会话的模态框 */}
      <Modal
        title={t('conversation.createConversation')}
        open={showNewConversationModal}
        onCancel={() => setShowNewConversationModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowNewConversationModal(false)}>
            {t('button.cancel')}
          </Button>,
          <Button
            key="create"
            type="primary"
            loading={creatingConversation}
            onClick={onCreateConversation}
          >
            {t('button.create')}
          </Button>
        ]}
      >
        <Form layout="vertical">
          <Form.Item
            label={t('conversation.conversationTitle')}
            required
            validateStatus={showCreateValidation && !newConversationTitle.trim() ? 'error' : undefined}
            help={showCreateValidation && !newConversationTitle.trim() ? t('conversation.titleRequired') : undefined}
          >
            <Input
              value={newConversationTitle}
              onChange={(e) => setNewConversationTitle(e.target.value)}
              placeholder={t('conversation.enterTitle')}
              disabled={creatingConversation}
            />
          </Form.Item>

          {/* 总结选项 */}
          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <Switch
                checked={enableSummary && hasDefaultModel && activeConversationId && messages.length > 0}
                onChange={(checked) => {
                  if (activeConversationId && messages.length > 0 && hasDefaultModel) {
                    setEnableSummary(checked);
                  }
                }}
                disabled={!hasDefaultModel || !activeConversationId || messages.length === 0}
                style={{ marginTop: '2px' }}
              />
              <div style={{ flex: 1 }}>
                <Text style={{ display: 'block', marginBottom: '4px' }}>
                  {t('conversation.enableSummary')}
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {!hasDefaultModel
                    ? t('conversation.noDefaultModelHint')
                    : (!activeConversationId || messages.length === 0)
                      ? '当前会话无消息，无法总结'
                      : t('conversation.summaryHint')
                  }
                </Text>
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 图像上传模态框 */}
      <ImageUploadModal
        visible={showImageUpload}
        onCancel={() => setShowImageUpload(false)}
        onConfirm={() => setShowImageUpload(false)}
        attachedImages={attachedImages}
        onImageUpload={onImageUpload}
        onRemoveImage={onRemoveImage}
        disabled={task.status !== 'active'}
      />

      {/* 自主任务配置模态框 */}
      <AutonomousTaskModal
        visible={autoDiscussModalVisible}
        onCancel={onAutoDiscussCancel}
        onConfirm={onAutoDiscussConfirm}
        confirmLoading={startingAutoDiscussion}
        task={task}
        environmentVariables={environmentVariables}
        agentVariables={agentVariables}
        options={autoDiscussionOptions}
        onOptionsChange={setAutoDiscussionOptions}
      />
    </>
  );
}
