import React from 'react';
import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import {
  Alert,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Tag,
  Typography,
  theme
} from 'antd';
import { useTranslation } from 'react-i18next';
import { getEvidenceChecks } from './researchWorkbench';

const { Text } = Typography;

interface ExperimentEvidencePanelProps {
  experiment: any;
}

const ExperimentEvidencePanel: React.FC<ExperimentEvidencePanelProps> = ({ experiment }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const checks = getEvidenceChecks(experiment);
  const readyCount = checks.filter(check => check.ready).length;
  const progress = Math.round((readyCount / checks.length) * 100);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        showIcon
        type="info"
        message={t('parallelLab.evidence.scopeTitle')}
        description={t('parallelLab.evidence.scopeDescription')}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                {t('parallelLab.evidence.checklistTitle')}
              </Space>
            }
          >
            <div style={{ marginBottom: 16 }}>
              <Progress
                percent={progress}
                format={() => t('parallelLab.evidence.checklistProgress', {
                  ready: readyCount,
                  total: checks.length
                })}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('parallelLab.evidence.checklistHint')}
              </Text>
            </div>

            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {checks.map(check => (
                <div
                  key={check.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '9px 10px',
                    borderRadius: 8,
                    background: token.colorFillQuaternary
                  }}
                >
                  <Space>
                    {check.ready
                      ? <CheckCircleFilled style={{ color: token.colorSuccess }} />
                      : <ExclamationCircleFilled style={{ color: token.colorWarning }} />}
                    <Text>{t(`parallelLab.evidence.check.${check.key}`)}</Text>
                  </Space>
                  <Tag color={check.ready ? 'success' : 'warning'} style={{ margin: 0 }}>
                    {t(check.ready
                      ? 'parallelLab.evidence.ready'
                      : 'parallelLab.evidence.incomplete')}
                  </Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title={t('parallelLab.evidence.provenanceTitle')}>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={t('parallelLab.evidence.experimentId')}>
                <Text code copyable>{experiment.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.actionSpace')}>
                {experiment.source_action_space_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.currentRound')}>
                {t('parallelLab.list.roundFormat', { round: experiment.current_iteration || 0 })}
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.status')}>
                {t(`parallelLab.list.status.${experiment.status}`, { defaultValue: experiment.status })}
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.totalRuns')}>
                {experiment.total_runs || 0}
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.completed')}>
                {experiment.completed_runs || 0}
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.failed')}>
                {experiment.failed_runs || 0}
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.createdAt')}>
                {experiment.created_at ? new Date(experiment.created_at).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.list.startTime')}>
                {experiment.start_time ? new Date(experiment.start_time).toLocaleString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('parallelLab.evidence.endTime')}>
                {experiment.end_time ? new Date(experiment.end_time).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default ExperimentEvidencePanel;
