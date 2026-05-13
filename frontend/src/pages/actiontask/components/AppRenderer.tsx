import React from 'react';
import { Typography, Modal, Button, Space } from 'antd';
import { FullscreenExitOutlined } from '@ant-design/icons';
import { getAppIconWithColor } from '../../../utils/appUtils';
import { getAppIcon } from '../../../utils/iconMapper';
import GISApp from '../../actionspace/AppMarket/GISApp';
import NextRPATab from '../../actionspace/AppMarket/NextRPATab';

const { Text } = Typography;

/**
 * 应用组件渲染器
 * 根据应用类型渲染对应的组件
 * @param {Object} app - 应用对象
 * @param {boolean} fullscreen - 是否全屏模式
 * @param {Function} onExitFullscreen - 退出全屏回调
 */
const AppRenderer = ({ app, fullscreen = false, onExitFullscreen = null }: any) => {
  if (!app) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Text type="secondary">应用加载中...</Text>
      </div>
    );
  }

  // 根据应用ID渲染对应的组件
  const renderAppComponent = () => {
    switch (app.id) {
      case 'gis-mapping':
        return <GISApp />;
      
      case 'next-rpa':
        return <NextRPATab appConfig={app} />;
      
      default:
        // 对于其他应用，显示提示信息
        // 大部分应用使用 tab 或 iframe 模式，不会走到这里
        return (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            {getAppIcon(app.basic?.icon || 'appstore', '#1677ff', '64px')}
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">{app.name}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                此应用应在新标签页中打开，如果您看到此页面，请检查应用配置。
              </Text>
            </div>
          </div>
        );
    }
  };

  // 渲染应用内容
  const renderAppContent = () => (
    <div style={{
      height: '100%',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0
      }}>
        {renderAppComponent()}
      </div>
    </div>
  );

  // 如果是全屏模式，渲染Modal
  if (fullscreen) {
    return (
      <Modal
        title={
          <Space>
            {getAppIconWithColor(app, '16px').icon}
            <span>{app.name}</span>
            <Button
              type="text"
              icon={<FullscreenExitOutlined />}
              onClick={onExitFullscreen}
            >
              退出全屏
            </Button>
          </Space>
        }
        open={true}
        onCancel={onExitFullscreen}
        footer={null}
        width="95vw"
        style={{ top: 20 }}
        styles={{
          body: {
            height: '85vh',
            padding: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <div style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0
        }}>
          {renderAppComponent()}
        </div>
      </Modal>
    );
  }

  // 普通模式渲染
  return renderAppContent();
};

export default AppRenderer;
