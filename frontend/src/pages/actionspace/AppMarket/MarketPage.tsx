import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Empty,
  Skeleton,
  Modal,
  Tooltip,
  Switch,
  App,
  Checkbox,
  Pagination,
  message as antdMessage
} from 'antd';
import {
  SearchOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined,
  LinkOutlined,
  SettingOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import GISApp from './GISApp';
import NextRPAApp from './NextRPAApp';
import OnlyOfficeApp from './OnlyOfficeApp';
import VSCodeApp from './VSCodeApp';
import { VncScreen } from 'react-vnc';
import { marketService, vncProxyService } from '../../../services/marketService';
import { getAppIcon, getCategoryIcon } from '../../../utils/iconMapper';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

// app icon color map (keyed by backend category strings, unchanged for compat)
const iconColorMap = {
  '开发工具': '#007ACC',
  '建模工具': '#52C41A',
  '数据分析': '#1677ff',
  '地理工具': '#722ED1',
  '系统管理': '#FA8C16'
};

// sentinel value for "all categories" filter
const ALL_CATEGORY = '__all__';

const MarketPageContent = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [apps, setApps] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  const [categories, setCategories] = useState([ALL_CATEGORY]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [runningApp, setRunningApp] = useState(null);

  // 绑定行动空间相关状态
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [bindingApp, setBindingApp] = useState(null);
  const [actionSpaces, setActionSpaces] = useState([]);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState([]);
  const [boundSpaces, setBoundSpaces] = useState([]);
  const [bindLoading, setBindLoading] = useState(false);
  const [spaceFilterQuery, setSpaceFilterQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // 应用设置相关状态
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settingsApp, setSettingsApp] = useState(null);

  // VNC 代理相关状态
  const [vncToken, setVncToken] = useState<string | null>(null);
  const [vncWsPort, setVncWsPort] = useState<number | null>(null);

  // 初始化数据
  useEffect(() => {
    loadApps();
    loadCategories();
  }, []);

  // 搜索和筛选逻辑
  useEffect(() => {
    filterApps();
  }, [apps, searchQuery, selectedCategory]);

  // 加载应用列表
  const loadApps = async () => {
    try {
      setInitialLoading(true);
      const response = await marketService.getApps({
        enabled_only: false // 获取所有应用，包括禁用的
      });
      setApps(response.apps || []);
    } catch (error) {
      console.error('load apps failed:', error);
      message.error(t('marketPage.loadAppsFailed') + ': ' + error.message);
    } finally {
      setInitialLoading(false);
    }
  };

  // load category list (keep `__all__` sentinel + backend categories)
  const loadCategories = async () => {
    try {
      const response = await marketService.getCategories();
      // backend returns categories with optional Chinese '全部' as first item;
      // we drop that label and rely on our local sentinel + i18n label.
      const backendCats = (response.categories || []).filter(
        c => c !== '全部' && c !== ALL_CATEGORY
      );
      setCategories([ALL_CATEGORY, ...backendCats]);
    } catch (error) {
      console.error('load categories failed:', error);
      message.error(t('marketPage.loadCategoriesFailed') + ': ' + error.message);
    }
  };

  // filter apps
  const filterApps = () => {
    let filtered = apps;

    if (selectedCategory !== ALL_CATEGORY) {
      filtered = filtered.filter(app =>
        app.basic?.category === selectedCategory
      );
    }

    // 按搜索关键词筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
        app.name.toLowerCase().includes(query) ||
        (app.basic?.description || '').toLowerCase().includes(query) ||
        (app.basic?.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredApps(filtered);
  };

  // 处理搜索
  const handleSearch = (value) => {
    setSearchQuery(value);
  };

  // 处理分类选择
  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
  };

  // launch an app
  const handleLaunchApp = async (app) => {
    if (!app.enabled) {
      message.warning(t('marketPage.appDisabledCannotLaunch'));
      return;
    }

    // NextRPA local mode: start VNC desktop
    if (app.id === 'next-rpa') {
      const connectionMode = app.connection?.mode || 'local';
      const vncUrl = app.connection?.localConfig?.vncUrl;

      if (connectionMode === 'local' && vncUrl) {
        try {
          let vncTarget = vncUrl.replace(/^wss?:\/\//, '');
          const { token, ws_port } = await vncProxyService.start(vncTarget);
          setVncToken(token);
          setVncWsPort(ws_port);
          setRunningApp(app);
          message.success(t('marketPage.vncStarted', { name: app.name }));
        } catch (error: any) {
          message.error(t('marketPage.vncProxyFailed') + ': ' + error.message);
        }
        return;
      } else if (connectionMode === 'local' && !vncUrl) {
        message.warning(t('marketPage.configureVncFirst'));
        return;
      } else {
        message.info(t('marketPage.cloudComingSoon'));
        return;
      }
    }

    try {
      setLoading(true);
      const response = await marketService.launchApp(app.id);

      if (response.success) {
        const launchConfig = response.launch_config;

        if (launchConfig.type === 'tab' && launchConfig.url) {
          if (app.id === 'vscode-server') {
            const configuredUrl = app.launch?.url || launchConfig.url || '/vscode';
            window.open(configuredUrl, '_blank');
            message.success(t('marketPage.launchedNewTab', { name: app.name }));
          } else {
            window.open(launchConfig.url, '_blank');
            message.success(t('marketPage.launchedNewTab', { name: app.name }));
          }
        } else if (launchConfig.type === 'iframe' || launchConfig.type === 'component') {
          setRunningApp(app);
          message.success(t('marketPage.launched', { name: app.name }));
        } else {
          message.warning(t('marketPage.launchConfigError'));
        }

        loadApps();
      }
    } catch (error) {
      console.error('launch app failed:', error);
      message.error(t('marketPage.launchFailed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // back to market
  const handleBackToMarket = async () => {
    if (vncToken) {
      try {
        await vncProxyService.stop(vncToken);
      } catch (error) {
        console.error('stop VNC session failed:', error);
      }
      setVncToken(null);
      setVncWsPort(null);
    }
    setRunningApp(null);
  };

  // toggle app enabled
  const handleToggleAppEnabled = async (appId, enabled) => {
    try {
      const response = await marketService.toggleAppEnabled(appId, enabled);

      if (response.success) {
        setApps(prev => prev.map(app =>
          app.id === appId ? { ...app, enabled } : app
        ));
        message.success(response.message);
      }
    } catch (error) {
      console.error('toggle app status failed:', error);
      message.error(t('marketPage.toggleStatusFailed') + ': ' + error.message);
    }
  };

  // 显示应用详情
  const handleShowDetail = (app) => {
    setSelectedApp(app);
    setDetailModalVisible(true);
  };

  // 显示应用设置Modal
  const handleShowSettingsModal = (app) => {
    setSettingsApp(app);
    setSettingsModalVisible(true);
  };

  // save app settings
  const handleSaveSettings = async (newConfig) => {
    if (!settingsApp) return;
    try {
      await marketService.updateAppConfig(settingsApp.id, newConfig);
      message.success(t('marketPage.configSaved'));
      setSettingsModalVisible(false);
      loadApps();
    } catch (error) {
      message.error(t('marketPage.saveConfigFailed') + ': ' + error.message);
    }
  };

  // 显示绑定行动空间Modal
  const handleShowBindModal = async (app) => {
    setBindingApp(app);
    setBindModalVisible(true);
    setBindLoading(true);

    try {
      const spacesResponse = await marketService.getActionSpaces();
      if (spacesResponse.success) {
        setActionSpaces(spacesResponse.action_spaces);
      }

      const boundResponse = await marketService.getAppBoundSpaces(app.id);
      if (boundResponse.success) {
        setBoundSpaces(boundResponse.bound_spaces);
        setSelectedSpaceIds(boundResponse.bound_spaces.map(space => space.id));
      }
    } catch (error) {
      console.error('load bind data failed:', error);
      message.error(t('marketPage.loadBindFailed') + ': ' + error.message);
    } finally {
      setBindLoading(false);
    }
  };

  // 处理绑定行动空间
  const handleBindSpaces = async () => {
    if (!bindingApp) return;

    setBindLoading(true);
    try {
      const response = await marketService.bindAppToSpaces(bindingApp.id, selectedSpaceIds);

      if (response.success) {
        message.success(response.message);
        setBindModalVisible(false);
        loadApps();
      }
    } catch (error) {
      console.error('bind action space failed:', error);
      message.error(t('marketPage.bindFailed') + ': ' + error.message);
    } finally {
      setBindLoading(false);
    }
  };

  // 处理空间选择变化
  const handleSpaceSelectionChange = (checkedValues) => {
    setSelectedSpaceIds(checkedValues);
  };

  // render app card
  const renderAppCard = (app) => {
    const category = app.basic?.category || t('marketPage.uncategorized');
    const iconColor = iconColorMap[app.basic?.category] || '#1677ff';
    const appIcon = getAppIcon(app.basic?.icon || 'appstore', iconColor);

    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={app.id}>
        <Card
          hoverable
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
          styles={{
            body: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px'
            }
          }}
          cover={
            <div style={{
              padding: '24px',
              textAlign: 'center',
              background: 'var(--custom-card-cover-bg)',
              height: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {appIcon}
            </div>
          }
          actions={(() => {
            const hasSettings = ['next-rpa', 'online-office', 'vscode-server'].includes(app.id) || app.launch?.url;
            return [
              <Tooltip title={app.scope === 'global' ? t('marketPage.tooltip.globalNoBind') : t('marketPage.tooltip.bindSpace')}>
                <LinkOutlined
                  style={{
                    color: app.scope === 'global' ? '#d9d9d9' : '#1677ff',
                    cursor: app.scope === 'global' ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => {
                    if (app.scope !== 'global') handleShowBindModal(app);
                  }}
                />
              </Tooltip>,
              <Tooltip title={hasSettings ? t('marketPage.tooltip.appSettings') : t('marketPage.tooltip.noSettings')}>
                <SettingOutlined
                  style={{
                    color: hasSettings ? '#722ed1' : '#d9d9d9',
                    cursor: hasSettings ? 'pointer' : 'not-allowed'
                  }}
                  onClick={() => {
                    if (hasSettings) handleShowSettingsModal(app);
                  }}
                />
              </Tooltip>,
              <Tooltip title={t('marketPage.tooltip.viewDetail')}>
                <InfoCircleOutlined
                  style={{ color: '#faad14' }}
                  onClick={() => handleShowDetail(app)}
                />
              </Tooltip>,
              <Tooltip title={app.launchable === false ? t('marketPage.tooltip.featureToggle') : (app.enabled ? t('marketPage.tooltip.launchApp') : t('marketPage.tooltip.appDisabled'))}>
                <PlayCircleOutlined
                  style={{
                    color: (!app.enabled || app.launchable === false) ? '#d9d9d9' : '#52c41a',
                    cursor: (!app.enabled || app.launchable === false) ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => {
                    if (app.enabled && app.launchable !== false) handleLaunchApp(app);
                  }}
                />
              </Tooltip>
            ];
          })()}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 12 }}>
              <Space>
                <Text strong style={{ fontSize: '16px' }}>{app.name}</Text>
                <Tag color={app.scope === 'global' ? 'blue' : 'orange'}>
                  {app.scope === 'global' ? t('marketPage.scope.global') : t('marketPage.scope.space')}
                </Tag>
              </Space>
            </div>

            <div style={{ flex: 1 }}>
              <Paragraph
                ellipsis={{ rows: 3 }}
                style={{ marginBottom: 12, color: 'var(--custom-text-secondary)' }}
              >
                {app.basic?.description || t('marketPage.noDescription')}
              </Paragraph>
            </div>

            <div style={{ marginTop: 'auto' }}>
              <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {(app.basic?.tags || []).slice(0, 2).map(tag => (
                  <Tag key={tag} style={{ marginRight: 0 }}>{tag}</Tag>
                ))}
                {(app.basic?.tags || []).length > 2 &&
                  <Tag style={{ marginRight: 0 }}>+{(app.basic?.tags || []).length - 2}</Tag>
                }
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {category} • v{app.basic?.version || '1.0.0'}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '11px' }}>{t('marketPage.enabledLabel')}</Text>
                  <Switch
                    checked={app.enabled}
                    onChange={(checked) => handleToggleAppEnabled(app.id, checked)}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Col>
    );
  };

  // 如果有运行中的应用，显示应用界面
  if (runningApp) {
    return (
      <div>
        {/* 应用运行时的标题栏 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBackToMarket}
            >
              {t('marketPage.backToMarket')}
            </Button>
            <Title level={4} style={{ margin: 0 }}>{runningApp.name}</Title>
          </Space>
        </div>

        {runningApp.id === 'gis-mapping' && <GISApp />}
        {runningApp.id === 'next-rpa' && runningApp.connection?.mode === 'local' && runningApp.connection?.localConfig?.vncUrl && vncToken && vncWsPort && (() => {
          const proxyUrl = vncProxyService.getProxyUrl(vncWsPort, vncToken);
          return (
          <Card
            title={t('marketPage.remoteDesktopVnc')}
            extra={
              <Space>
                <Text type="secondary">
                  {runningApp.connection.localConfig.vncUrl}
                </Text>
              </Space>
            }
            style={{ height: 'calc(100vh - 200px)' }}
            styles={{ body: { height: 'calc(100% - 57px)', padding: 0 } }}
          >
            <VncScreen
              url={proxyUrl}
              scaleViewport
              background="#000000"
              style={{
                width: '100%',
                height: '100%'
              }}
              rfbOptions={{
                credentials: {
                  password: runningApp.connection.localConfig.vncPassword || ''
                }
              }}
              onConnect={() => {
                message.success(t('marketPage.vncConnected'));
              }}
              onDisconnect={(e) => {
                if (e?.detail?.clean === false || e?.detail?.code === 1011) {
                  message.error(t('marketPage.vncFailed') + ': ' + (e?.detail?.reason || t('marketPage.vncTargetUnreachable')));
                }
              }}
              onSecurityFailure={(e) => {
                message.error(t('marketPage.vncSecurityFailed') + ': ' + (e?.detail?.reason || t('marketPage.unknownError')));
              }}
            />
          </Card>
          );
        })()}
        {runningApp.id === 'next-rpa' && !(runningApp.connection?.mode === 'local' && runningApp.connection?.localConfig?.vncUrl) && (
          <NextRPAApp
            appConfig={runningApp}
            onConfigChange={async (newConfig) => {
              try {
                await marketService.updateAppConfig(runningApp.id, newConfig);
                message.success(t('marketPage.configSaved'));
                loadApps();
              } catch (error) {
                message.error(t('marketPage.saveConfigFailed') + ': ' + error.message);
              }
            }}
            onClose={handleBackToMarket}
          />
        )}
        {runningApp.id === 'data-visualization' && (
          <div style={{ height: '100%', width: '100%' }}>
            <iframe
              src={runningApp.launch?.url || '/visualization'}
              style={{
                width: '100%',
                height: '800px',
                border: 'none',
                borderRadius: '8px'
              }}
              title={t('marketPage.dataVizTitle')}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        )}
      </div>
    );
  }

  // 如果正在初始加载，显示加载状态
  if (initialLoading) {
    return (
      <Row gutter={[16, 16]} style={{ padding: '24px 0' }}>
        {[1, 2, 3, 4, 5, 6].map(item => (
          <Col xs={24} sm={12} md={8} lg={6} key={item}>
            <Card
              style={{
                height: '100%',
                borderRadius: '8px'
              }}
            >
              <Skeleton active avatar paragraph={{ rows: 4 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <div>
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>{t('marketPage.title')}</Title>
          <Text type="secondary">
            {t('marketPage.subtitle')}
          </Text>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Space>
          <Search
            placeholder={t('marketPage.searchPlaceholder')}
            allowClear
            onSearch={handleSearch}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            value={selectedCategory}
            onChange={handleCategoryChange}
            style={{ width: 120 }}
          >
            {categories.map(category => (
              <Option key={category} value={category}>
                {category === ALL_CATEGORY ? t('marketPage.allCategories') : category}
              </Option>
            ))}
          </Select>
        </Space>
      </div>

      {/* 应用列表 */}
      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map(item => (
            <Col xs={24} sm={12} md={8} lg={6} key={item}>
              <Card
                style={{
                  height: '100%',
                  borderRadius: '8px'
                }}
              >
                <Skeleton active avatar paragraph={{ rows: 4 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        filteredApps.length > 0 ? (
          <Row gutter={[16, 16]}>
            {filteredApps.map(renderAppCard)}
          </Row>
        ) : (
          <Empty
            description={t('marketPage.noMatchingApp')}
            style={{ margin: '64px 0' }}
          />
        )
      )}

      <Modal
        title={selectedApp?.name}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDetailModalVisible(false)}>
            {t('marketPage.close')}
          </Button>,
          <Button
            key="launch"
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => {
              handleLaunchApp(selectedApp);
              setDetailModalVisible(false);
            }}
            disabled={!selectedApp?.enabled}
          >
            {selectedApp?.enabled ? t('marketPage.launchApp') : t('marketPage.appDisabled')}
          </Button>
        ]}
        width={800}
      >
        {selectedApp && (
          <div>
            {/* 应用图标和基本信息 */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {getAppIcon(
                selectedApp.basic?.icon || 'appstore',
                iconColorMap[selectedApp.basic?.category] || '#1677ff',
                '48px'
              )}

            </div>

            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: '16px' }}>{t('marketPage.detail.appDescription')}</Text>
              <Paragraph style={{ marginTop: 8 }}>
                {selectedApp.basic?.description || t('marketPage.noDescription')}
              </Paragraph>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: '16px' }}>{t('marketPage.detail.basicInfo')}</Text>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={8}>
                  <Text strong>{t('marketPage.detail.category')}</Text>
                  <br />
                  <Tag color="blue">{selectedApp.basic?.category || t('marketPage.uncategorized')}</Tag>
                </Col>
                <Col span={8}>
                  <Text strong>{t('marketPage.detail.version')}</Text>
                  <br />
                  <Text>{selectedApp.basic?.version || '1.0.0'}</Text>
                </Col>
                <Col span={8}>
                  <Text strong>{t('marketPage.detail.author')}</Text>
                  <br />
                  <Text>{selectedApp.basic?.author || t('marketPage.unknown')}</Text>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <Text strong>{t('marketPage.detail.enabledStatus')}</Text>
                  <br />
                  <Tag color={selectedApp.enabled ? 'green' : 'default'}>
                    {selectedApp.enabled ? t('marketPage.detail.enabled') : t('marketPage.detail.disabled')}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text strong>{t('marketPage.detail.sortOrder')}</Text>
                  <br />
                  <Text>{selectedApp.sort_order || 0}</Text>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: '16px' }}>{t('marketPage.detail.appTags')}</Text>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {(selectedApp.basic?.tags || []).map(tag => (
                  <Tag key={tag} style={{ marginRight: 0 }}>{tag}</Tag>
                ))}
                {(!selectedApp.basic?.tags || selectedApp.basic.tags.length === 0) && (
                  <Text type="secondary">{t('marketPage.detail.noTags')}</Text>
                )}
              </div>
            </div>

            {selectedApp.launch && (
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ fontSize: '16px' }}>{t('marketPage.detail.launchConfig')}</Text>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col span={8}>
                    <Text strong>{t('marketPage.detail.launchType')}</Text>
                    <br />
                    <Tag color="purple">
                      {selectedApp.launch.type === 'tab' ? t('marketPage.launchType.tab') :
                       selectedApp.launch.type === 'iframe' ? t('marketPage.launchType.iframe') :
                       selectedApp.launch.type === 'component' ? t('marketPage.launchType.component') :
                       selectedApp.launch.type === 'external' ? t('marketPage.launchType.external') : selectedApp.launch.type}
                    </Tag>
                  </Col>
                  {selectedApp.launch.url && (
                    <Col span={16}>
                      <Text strong>{t('marketPage.detail.accessUrl')}</Text>
                      <br />
                      <Text code>{selectedApp.launch.url}</Text>
                    </Col>
                  )}
                  {selectedApp.launch.component && (
                    <Col span={16}>
                      <Text strong>{t('marketPage.detail.componentName')}</Text>
                      <br />
                      <Text code>{selectedApp.launch.component}</Text>
                    </Col>
                  )}
                </Row>

                {selectedApp.launch.settings && Object.keys(selectedApp.launch.settings).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text strong>{t('marketPage.detail.launchSettings')}</Text>
                    <div style={{ marginTop: 8, background: 'var(--custom-hover-bg)', padding: 12, borderRadius: 4 }}>
                      {Object.entries(selectedApp.launch.settings).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 4 }}>
                          <Text strong>{key}:</Text> <Text code>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedApp.metadata?.documentation && (
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ fontSize: '16px' }}>{t('marketPage.detail.relatedDocs')}</Text>
                <div style={{ marginTop: 12 }}>
                  {selectedApp.metadata.documentation.userGuide && (
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>{t('marketPage.detail.userGuide')}</Text>
                      <br />
                      <Text code>{selectedApp.metadata.documentation.userGuide}</Text>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedApp.stats && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: '16px' }}>{t('marketPage.detail.usageStats')}</Text>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col span={12}>
                    <Text strong>{t('marketPage.detail.installCount')}</Text>
                    <br />
                    <Text type="secondary">{t('marketPage.detail.countTimes', { count: selectedApp.stats.install_count || 0 })}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>{t('marketPage.detail.launchCount')}</Text>
                    <br />
                    <Text type="secondary">{t('marketPage.detail.countTimes', { count: selectedApp.stats.launch_count || 0 })}</Text>
                  </Col>
                </Row>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={t('marketPage.bindModal.title', { name: bindingApp?.name || '' })}
        open={bindModalVisible}
        onCancel={() => {
          setBindModalVisible(false);
          setSpaceFilterQuery('');
          setCurrentPage(1);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setBindModalVisible(false);
            setSpaceFilterQuery('');
            setCurrentPage(1);
          }}>
            {t('marketPage.cancel')}
          </Button>,
          <Button
            key="bind"
            type="primary"
            loading={bindLoading}
            onClick={handleBindSpaces}
          >
            {t('marketPage.bindModal.confirm')}
          </Button>
        ]}
        width={900}
      >
        <div>
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">
              {t('marketPage.bindModal.hint')}
            </Typography.Text>
          </div>

          {bindLoading ? (
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              {[1, 2, 3, 4].map(item => (
                <Card key={item}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              ))}
            </Space>
          ) : (
            <div>
              {actionSpaces.length > 0 ? (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text strong>{t('marketPage.bindModal.availableSpaces')}</Typography.Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <Search
                      placeholder={t('marketPage.bindModal.searchSpacePlaceholder')}
                      allowClear
                      value={spaceFilterQuery}
                      onChange={(e) => {
                        setSpaceFilterQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <Checkbox.Group
                    value={selectedSpaceIds}
                    onChange={handleSpaceSelectionChange}
                    style={{ width: '100%' }}
                  >
                    <Row gutter={[16, 16]}>
                      {(() => {
                        const filteredSpaces = actionSpaces.filter(space => {
                          if (!spaceFilterQuery) return true;
                          const query = spaceFilterQuery.toLowerCase();
                          return (
                            space.name.toLowerCase().includes(query) ||
                            (space.description || '').toLowerCase().includes(query)
                          );
                        });
                        const startIndex = (currentPage - 1) * pageSize;
                        const endIndex = startIndex + pageSize;
                        const paginatedSpaces = filteredSpaces.slice(startIndex, endIndex);
                        
                        return (
                          <>
                            {paginatedSpaces.map(space => (
                              <Col span={12} key={space.id}>
                                <Card hoverable>
                                  <Checkbox value={space.id} style={{ width: '100%' }}>
                                    <div>
                                      <div style={{ fontWeight: 'bold' }}>{space.name}</div>
                                      {space.description && (
                                        <div style={{ color: 'var(--custom-text-secondary)', fontSize: '12px', marginTop: 4 }}>
                                          {space.description}
                                        </div>
                                      )}
                                    </div>
                                  </Checkbox>
                                </Card>
                              </Col>
                            ))}
                          </>
                        );
                      })()}
                    </Row>
                  </Checkbox.Group>
                  
                  {(() => {
                    const filteredSpaces = actionSpaces.filter(space => {
                      if (!spaceFilterQuery) return true;
                      const query = spaceFilterQuery.toLowerCase();
                      return (
                        space.name.toLowerCase().includes(query) ||
                        (space.description || '').toLowerCase().includes(query)
                      );
                    });
                    
                    if (filteredSpaces.length > pageSize) {
                      return (
                        <div style={{ marginTop: 16, textAlign: 'center' }}>
                          <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={filteredSpaces.length}
                            onChange={(page) => setCurrentPage(page)}
                            showSizeChanger={false}
                            showTotal={(total) => t('marketPage.bindModal.totalSpaces', { count: total })}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {boundSpaces.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <Typography.Text strong>{t('marketPage.bindModal.currentlyBound')}</Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        {boundSpaces.map(space => (
                          <Tag key={space.id} color="blue" style={{ marginBottom: 4 }}>
                            {space.name}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Empty
                  description={t('marketPage.bindModal.noSpaces')}
                  style={{ margin: '40px 0' }}
                />
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={t('marketPage.settingsModal.title', { name: settingsApp?.name || '' })}
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        footer={null}
        width={900}
        destroyOnHidden
      >
        {settingsApp && (
          settingsApp.id === 'next-rpa' ? (
            <NextRPAApp
              appConfig={settingsApp}
              onConfigChange={handleSaveSettings}
              onClose={() => setSettingsModalVisible(false)}
            />
          ) : settingsApp.id === 'online-office' ? (
            <OnlyOfficeApp
              appConfig={settingsApp}
              onConfigChange={handleSaveSettings}
              onClose={() => setSettingsModalVisible(false)}
            />
          ) : settingsApp.id === 'vscode-server' ? (
            <VSCodeApp
              appConfig={settingsApp}
              onConfigChange={handleSaveSettings}
              onClose={() => setSettingsModalVisible(false)}
            />
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">{t('marketPage.settingsModal.configFor', { name: settingsApp.name })}</Text>
              </div>

              {settingsApp.launch?.url && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>{t('marketPage.settingsModal.launchUrl')}</Text>
                  <Input
                    defaultValue={settingsApp.launch.url}
                    style={{ marginTop: 8 }}
                    onChange={(e) => {
                      settingsApp.launch.url = e.target.value;
                    }}
                  />
                </div>
              )}

              {!settingsApp.launch?.url && (
                <Empty description={t('marketPage.settingsModal.noConfigItems')} />
              )}

              <div style={{ marginTop: 24, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setSettingsModalVisible(false)}>{t('marketPage.cancel')}</Button>
                  <Button type="primary" onClick={() => handleSaveSettings(settingsApp)}>
                    {t('marketPage.settingsModal.saveConfig')}
                  </Button>
                </Space>
              </div>
            </div>
          )
        )}
      </Modal>
    </div>
  );
};

const MarketPage = () => {
  return (
    <App>
      <MarketPageContent />
    </App>
  );
};

export default MarketPage;
