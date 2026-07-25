import React from 'react';
import {
  BarChartOutlined,
  ExperimentOutlined,
  MonitorOutlined
} from '@ant-design/icons';
import { Card, Col, Row, Segmented, Space, Tag, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

type WorkspaceKey = 'studies' | 'monitoring' | 'analysis';

interface ParallelLabWorkspaceHeaderProps {
  activeKey: WorkspaceKey;
  extra?: React.ReactNode;
  showWorkflow?: boolean;
}

const WORKSPACE_PATHS: Record<WorkspaceKey, string> = {
  studies: '/parallel-lab/list',
  monitoring: '/parallel-lab/monitoring',
  analysis: '/parallel-lab/analysis'
};

const ParallelLabWorkspaceHeader: React.FC<ParallelLabWorkspaceHeaderProps> = ({
  activeKey,
  extra,
  showWorkflow = false
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const workflowItems = [
    t('parallelLab.workbench.workflow.question'),
    t('parallelLab.workbench.workflow.design'),
    t('parallelLab.workbench.workflow.run'),
    t('parallelLab.workbench.workflow.analyze'),
    t('parallelLab.workbench.workflow.evidence')
  ];

  return (
    <Card
      data-testid="parallel-lab-workbench-header"
      style={{
        marginBottom: 20,
        borderRadius: 14,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 62%)`
      }}
      styles={{ body: { padding: 22 } }}
    >
      <Row gutter={[20, 16]} align="middle" justify="space-between">
        <Col flex="auto">
          <Space direction="vertical" size={7}>
            <Tag color="blue" style={{ margin: 0 }}>
              {t('parallelLab.workbench.badge')}
            </Tag>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {t('parallelLab.workbench.title')}
              </Title>
              <Text type="secondary">
                {t('parallelLab.workbench.subtitle')}
              </Text>
            </div>
          </Space>
        </Col>
        {extra && <Col>{extra}</Col>}
      </Row>

      <div style={{ marginTop: 18 }}>
        <Segmented
          block
          value={activeKey}
          onChange={value => navigate(WORKSPACE_PATHS[value as WorkspaceKey])}
          options={[
            {
              value: 'studies',
              icon: <ExperimentOutlined />,
              label: t('parallelLab.workbench.nav.studies')
            },
            {
              value: 'monitoring',
              icon: <MonitorOutlined />,
              label: t('parallelLab.workbench.nav.monitoring')
            },
            {
              value: 'analysis',
              icon: <BarChartOutlined />,
              label: t('parallelLab.workbench.nav.analysis')
            }
          ]}
        />
      </div>

      {showWorkflow && (
        <div style={{ marginTop: 20 }}>
          <Text strong>{t('parallelLab.workbench.workflow.title')}</Text>
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {t('parallelLab.workbench.workflow.subtitle')}
          </Text>
          <Row gutter={[8, 8]} style={{ marginTop: 10 }}>
            {workflowItems.map((label, index) => (
              <Col
                xs={12}
                md={index === workflowItems.length - 1 ? 24 : 6}
                lg={index === workflowItems.length - 1 ? 8 : 4}
                key={label}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 42,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: token.colorBgElevated,
                    border: `1px solid ${token.colorBorderSecondary}`
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      color: token.colorPrimary,
                      background: token.colorPrimaryBg
                    }}
                  >
                    {index + 1}
                  </span>
                  <Text style={{ fontSize: 12 }}>{label}</Text>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </Card>
  );
};

export default ParallelLabWorkspaceHeader;
