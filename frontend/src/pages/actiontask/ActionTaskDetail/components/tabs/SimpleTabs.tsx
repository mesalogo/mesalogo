import React, { useRef } from 'react';
import { Card, Typography, Button, Tooltip } from 'antd';
import { ApartmentOutlined, ExperimentOutlined } from '@ant-design/icons';
import ActionTaskWorkspace from '../../../../actiontask/components/ActionTaskWorkspace';
import ActionTaskSupervisor from '../../../../actiontask/components/ActionTaskSupervisor';
import ActionTaskRules, { ActionTaskRulesRef } from '../../../../actiontask/components/ActionTaskRules';
import TaskAppTools from '../../../../actiontask/components/TaskAppTools';

const { Text } = Typography;

/**
 * 工作空间Tab - 简单引用
 */
export const MemoryTab = ({ task, respondingAgentId }) => (
  <div style={{ marginBottom: 16 }}>
    {task && <ActionTaskWorkspace 
      task={task} 
      respondingAgentId={respondingAgentId}
      key={`workspace-card-${task.id}`} 
    />}
  </div>
);

/**
 * 审计Tab - 包含规则和监督会话
 */
export const AuditTab = ({ task, activeConversationId, refreshKey, onTaskMessagesRefresh, onSupervisorIntervention, t }) => {
  const rulesRef = useRef<ActionTaskRulesRef>(null);

  return (
    <>
      <Card
        className="task-detail-tab-card"
        title={<><ApartmentOutlined /> {t('actionTaskDetail.rules')}</>}
        style={{ marginBottom: 16 }}
        extra={
          <Tooltip title={!task?.id ? t('rules.card.manualCheckTooltipNoTask') : !activeConversationId ? t('rules.card.manualCheckTooltipNoConversation') : t('rules.card.manualCheckTooltip')}>
            <Button
              type="primary"
              size="small"
              icon={<ExperimentOutlined />}
              onClick={() => rulesRef.current?.openManualCheck()}
              disabled={!task?.id}
            >
              {t('rules.card.manualCheck')}
            </Button>
          </Tooltip>
        }
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {t('actionTaskDetail.rulesDesc')}
          </Text>
        </div>
        {task && <ActionTaskRules
          ref={rulesRef}
          task={{...task, conversation_id: activeConversationId}}
          key={`rules-${refreshKey}`}
        />}
      </Card>

      {task && <ActionTaskSupervisor
        task={{...task, conversation_id: activeConversationId}}
        onTaskMessagesRefresh={onTaskMessagesRefresh}
        onSupervisorIntervention={onSupervisorIntervention}
        key={`supervisor-${refreshKey}`}
      />}
    </>
  );
};

/**
 * 应用管理Tab
 */
export const AppsTab = ({ task, appTabManager, onAppLaunched }) => (
  <div style={{ marginBottom: 16 }}>
    {task && <TaskAppTools
      task={task}
      appTabManager={appTabManager}
      onAppLaunched={onAppLaunched}
    />}
  </div>
);
