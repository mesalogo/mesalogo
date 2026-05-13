import React from 'react';
import { Card, Row, Col, Statistic, Descriptions } from 'antd';
import { MessageOutlined, TeamOutlined } from '@ant-design/icons';

/**
 * 任务信息 Tab
 */
const InfoTab = ({ task, messages, t }) => {
  return (
    <>
      <Card className="task-detail-tab-card" title={t('actionTaskDetail.statisticsOverview')} style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title={t('actionTaskDetail.messageCount')}
              value={messages.length}
              prefix={<MessageOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title={t('actionTaskDetail.agents')}
              value={task.agents?.length || 0}
              prefix={<TeamOutlined />}
            />
          </Col>
        </Row>
      </Card>

      <Card className="task-detail-tab-card" title={t('actionTaskDetail.taskInfo')} style={{ marginBottom: 16 }}>
        <Descriptions column={1}>
          <Descriptions.Item label={t('actionTaskDetail.taskId')}>
            {task.id}
          </Descriptions.Item>
          <Descriptions.Item label={t('actionTaskDetail.actionSpace')}>
            {task.action_space ? task.action_space.name : (task.action_space_name || t('actionTaskDetail.unspecified'))}
          </Descriptions.Item>
          <Descriptions.Item label={t('actionTaskDetail.taskDescription')}>
            {task.description || t('actionTaskDetail.noDescription')}
          </Descriptions.Item>
          <Descriptions.Item label={t('actionTaskDetail.createdAt')}>
            {new Date(task.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label={t('actionTaskDetail.lastUpdated')}>
            {new Date(task.updated_at).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </>
  );
};

export default InfoTab;
