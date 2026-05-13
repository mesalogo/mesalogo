import React from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Badge,
  Row,
  Col,
  Tabs,
  Skeleton
} from 'antd';
import {
  LeftOutlined,
  ExportOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  EyeOutlined,
  MessageOutlined,
  MenuFoldOutlined,
  ApartmentOutlined,
  BookOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 任务详情页面的 Loading 骨架屏
 */
const LoadingSkeleton = ({ onBack, onExport, t, customStyles, variableFlashStyle }) => {
  return (
    <div className="action-task-detail-page">
      <style>{customStyles}</style>
      <style>{variableFlashStyle}</style>
      
      {/* 显示与实际页面一致的页面头部 */}
      <div className="page-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button
            icon={<LeftOutlined />}
            onClick={onBack}
            disabled={true}
          >
            {t('actionTaskDetail.backToList')}
          </Button>
          <Title level={3} style={{ margin: 0 }}>{t('actionTaskDetail.loading')}</Title>
          <Space>
            <Tag color="blue" icon={<GlobalOutlined />}>
              {t('actionTaskDetail.status.loading')}
            </Tag>
            <Badge status="processing" text={t('actionTaskDetail.status.loading')} />
          </Space>
        </Space>
        <Space>
          <Button
            icon={<ExportOutlined />}
            onClick={onExport}
          >
            {t('actionTaskDetail.exportData')}
          </Button>
        </Space>
      </div>

      <Card>
        <Row gutter={16} style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
          {/* 左侧：交互记录骨架屏 */}
          <Col
            span={16}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <MessageOutlined style={{ marginRight: 8 }} />
              <Text strong style={{ fontSize: '16px' }}>{t('actionTask.interactionRecord')}</Text>
            </div>
            
            {/* 消息列表骨架屏 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Space orientation="vertical" style={{ width: '100%' }} size="large">
                {[1, 2, 3, 4].map(item => (
                  <Card key={item}>
                    <Skeleton active avatar paragraph={{ rows: 2 }} />
                  </Card>
                ))}
              </Space>
            </div>
            
            {/* 输入框骨架屏 */}
            <div style={{ marginTop: 16, borderTop: '1px solid var(--custom-border)', paddingTop: 16 }}>
              <Skeleton.Input active block style={{ height: 80 }} />
            </div>
          </Col>

          {/* 右侧：信息面板骨架屏 */}
          <Col
            span={8}
            style={{
              height: '100%',
              overflowY: 'auto',
              borderLeft: '1px solid var(--custom-border)',
              position: 'relative'
            }}
          >
            {/* 标签栏骨架屏 */}
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Skeleton.Button active style={{ width: 80 }} />
                <Skeleton.Button active style={{ width: 80 }} />
                <Skeleton.Button active style={{ width: 80 }} />
                <Skeleton.Button active style={{ width: 80 }} />
              </Space>
            </div>
            
            {/* 信息卡片骨架屏 */}
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              <Card title={t('actionTaskDetail.taskInfo')}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
              <Card title={t('actionTaskDetail.statisticsOverview')}>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
              <Card title={t('actionTaskDetail.environment')}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default LoadingSkeleton;
