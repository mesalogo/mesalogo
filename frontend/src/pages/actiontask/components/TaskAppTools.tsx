import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Tag,
  message,
  Empty,
  Spin
} from 'antd';
import {
  PlayCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { marketService } from '../../../services/marketService';
import { getAppIcon } from '../../../utils/iconMapper';

const { Title, Text } = Typography;



const TaskAppTools = ({ task, appTabManager, onAppLaunched }) => {
  const { t } = useTranslation();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  // 加载应用列表
  useEffect(() => {
    console.log('TaskAppTools useEffect triggered, task:', task);
    if (task) {
      loadApps();
    }
  }, [task]);

  const loadApps = async () => {
    try {
      setLoading(true);

      if (!task) {
        console.error(t('appManagement.taskInfoMissing'));
        message.error(t('appManagement.loadFailed'));
        setApps([]);
        return;
      }

      if (!task.action_space_id) {
        console.error('Task not associated with an action space, cannot load bound apps');
        message.error(t('taskApp.noActionSpace'));
        setApps([]);
        return;
      }

      console.log('Loading apps bound to action space, space_id:', task.action_space_id);
      // 严格按照行动空间绑定关系获取应用
      const response = await marketService.getActionSpaceApps(task.action_space_id);
      console.log('Bound apps list received:', response);

      setApps(response.apps || []);
    } catch (error) {
      console.error('Failed to load app list:', error);
      message.error(t('taskApp.loadAppsFailed', { error: error.message }));
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  // 过滤出已启用的应用（已经在API调用中过滤了，这里保留作为双重保险）
  const availableApps = apps.filter(app => app.enabled);

  // 启动应用
  const handleLaunchApp = async (app) => {
    // 使用AppTabManager启动应用
    const appInstance = await appTabManager.launchApp(app);
    if (appInstance && onAppLaunched) {
      onAppLaunched(appInstance);
    }
  };





  // 渲染应用卡片
  const renderAppCard = (app) => {
    const category = app.basic?.category || t('taskApp.uncategorized');
    const iconColorMap = {
      '开发工具': '#007ACC',
      '建模工具': '#52C41A',
      '数据分析': '#1677ff',
      '地理工具': '#722ED1',
      '系统工具': '#FA8C16'
    };
    const iconColor = iconColorMap[category] || '#1677ff';
    const appIcon = getAppIcon(app.basic?.icon || 'appstore', iconColor, '20px');
    const description = app.basic?.description || t('taskApp.noDescription');

    return (
      <Col xs={24} sm={12} lg={12} key={app.id}>
        <Card
          hoverable
          style={{ height: '180px' }}
          styles={{ body: { padding: '12px', height: '100%', display: 'flex', flexDirection: 'column' } }}
        >
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {appIcon}
          </div>
          <div style={{ flex: 1 }}>
            <Title level={5} style={{ margin: 0, marginBottom: 6, textAlign: 'center', fontSize: '14px' }}>
              {app.name}
            </Title>
            <Text
              type="secondary"
              style={{
                fontSize: '12px',
                display: 'block',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={description}
            >
              {description.length > 20 ? `${description.substring(0, 20)}...` : description}
            </Text>
          </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handleLaunchApp(app)}
           
          >
            {t('taskApp.launch')}
          </Button>
        </div>
      </Card>
    </Col>
    );
  };

  // 显示应用管理界面（应用卡片列表）
  return (
    <Card
      className="task-detail-tab-card"
      title={t('appManagement.title')}
      style={{ marginBottom: 16 }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {t('appManagement.description')}
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: '11px', color: 'var(--custom-text-secondary)' }}>
          {t('appManagement.note')}
        </Text>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">{t('appManagement.loading')}</Text>
          </div>
        </div>
      ) : apps.length > 0 ? (
        <Row gutter={[12, 12]}>
          {apps.map(renderAppCard)}
        </Row>
      ) : (
        <Empty
          description={t('appManagement.noApps')}
          style={{ margin: '40px 0' }}
        />
      )}
    </Card>
  );
};

export default TaskAppTools;
