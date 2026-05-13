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

// 应用图标颜色映射
const iconColorMap = {
  '开发工具': '#007ACC',
  '建模工具': '#52C41A',
  '数据分析': '#1677ff',
  '地理工具': '#722ED1',
  '系统管理': '#FA8C16'
};

const MarketPageContent = () => {
  const { message } = App.useApp();
  const [apps, setApps] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  const [categories, setCategories] = useState(['全部']);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
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
      console.error('加载应用列表失败:', error);
      message.error('加载应用列表失败: ' + error.message);
    } finally {
      setInitialLoading(false);
    }
  };

  // 加载分类列表
  const loadCategories = async () => {
    try {
      const response = await marketService.getCategories();
      setCategories(response.categories || ['全部']);
    } catch (error) {
      console.error('加载分类列表失败:', error);
      message.error('加载分类列表失败: ' + error.message);
    }
  };

  // 筛选应用
  const filterApps = () => {
    let filtered = apps;

    // 按分类筛选
    if (selectedCategory !== '全部') {
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

  // 处理应用启动
  const handleLaunchApp = async (app) => {
    if (!app.enabled) {
      message.warning('应用已禁用，无法启动');
      return;
    }

    // NextRPA 主机模式下启动VNC桌面
    if (app.id === 'next-rpa') {
      const connectionMode = app.connection?.mode || 'local';
      const vncUrl = app.connection?.localConfig?.vncUrl;
      
      if (connectionMode === 'local' && vncUrl) {
        // 主机模式且配置了VNC地址，通过代理启动VNC桌面
        try {
          // 从 vncUrl 提取 host:port (去掉 ws:// 或 wss:// 前缀)
          let vncTarget = vncUrl.replace(/^wss?:\/\//, '');
          const { token, ws_port } = await vncProxyService.start(vncTarget);
          setVncToken(token);
          setVncWsPort(ws_port);
          setRunningApp(app);
          message.success(`已启动 ${app.name} - VNC 桌面`);
        } catch (error: any) {
          message.error('启动 VNC 代理失败: ' + error.message);
        }
        return;
      } else if (connectionMode === 'local' && !vncUrl) {
        message.warning('请先在应用设置中配置 VNC 地址');
        return;
      } else {
        message.info('云端模式功能正在开发中，敬请期待');
        return;
      }
    }

    try {
      setLoading(true);
      const response = await marketService.launchApp(app.id);

      if (response.success) {
        const launchConfig = response.launch_config;

        if (launchConfig.type === 'tab' && launchConfig.url) {
          // 特殊处理 VSCode 应用 - 使用用户配置的URL
          if (app.id === 'vscode-server') {
            const configuredUrl = app.launch?.url || launchConfig.url || '/vscode';
            window.open(configuredUrl, '_blank');
            message.success(`已在新标签页中启动 ${app.name}`);
          } else {
            // 其他应用使用原有逻辑
            window.open(launchConfig.url, '_blank');
            message.success(`已在新标签页中启动 ${app.name}`);
          }
        } else if (launchConfig.type === 'iframe' || launchConfig.type === 'component') {
          // 对于iframe和组件类型，在当前页面中启动
          setRunningApp(app);
          message.success(`已启动 ${app.name}`);
        } else {
          message.warning('应用配置错误，无法启动');
        }

        // 刷新应用列表以更新统计信息
        loadApps();
      }
    } catch (error) {
      console.error('启动应用失败:', error);
      message.error('启动应用失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 返回应用市场
  const handleBackToMarket = async () => {
    // 如果有 VNC 会话，先停止
    if (vncToken) {
      try {
        await vncProxyService.stop(vncToken);
      } catch (error) {
        console.error('停止 VNC 会话失败:', error);
      }
      setVncToken(null);
      setVncWsPort(null);
    }
    setRunningApp(null);
  };

  // 切换应用启用状态
  const handleToggleAppEnabled = async (appId, enabled) => {
    try {
      const response = await marketService.toggleAppEnabled(appId, enabled);

      if (response.success) {
        // 更新本地状态
        setApps(prev => prev.map(app =>
          app.id === appId ? { ...app, enabled } : app
        ));
        message.success(response.message);
      }
    } catch (error) {
      console.error('切换应用状态失败:', error);
      message.error('切换应用状态失败: ' + error.message);
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

  // 保存应用设置
  const handleSaveSettings = async (newConfig) => {
    if (!settingsApp) return;
    try {
      await marketService.updateAppConfig(settingsApp.id, newConfig);
      message.success('配置已保存');
      setSettingsModalVisible(false);
      loadApps();
    } catch (error) {
      message.error('保存配置失败: ' + error.message);
    }
  };

  // 显示绑定行动空间Modal
  const handleShowBindModal = async (app) => {
    setBindingApp(app);
    setBindModalVisible(true);
    setBindLoading(true);

    try {
      // 加载所有行动空间
      const spacesResponse = await marketService.getActionSpaces();
      if (spacesResponse.success) {
        setActionSpaces(spacesResponse.action_spaces);
      }

      // 加载当前应用已绑定的空间
      const boundResponse = await marketService.getAppBoundSpaces(app.id);
      if (boundResponse.success) {
        setBoundSpaces(boundResponse.bound_spaces);
        setSelectedSpaceIds(boundResponse.bound_spaces.map(space => space.id));
      }
    } catch (error) {
      console.error('加载绑定数据失败:', error);
      message.error('加载绑定数据失败: ' + error.message);
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
        // 重新加载应用列表以更新绑定状态
        loadApps();
      }
    } catch (error) {
      console.error('绑定行动空间失败:', error);
      message.error('绑定行动空间失败: ' + error.message);
    } finally {
      setBindLoading(false);
    }
  };

  // 处理空间选择变化
  const handleSpaceSelectionChange = (checkedValues) => {
    setSelectedSpaceIds(checkedValues);
  };

  // 渲染应用卡片
  const renderAppCard = (app) => {
    const category = app.basic?.category || '未分类';
    const iconColor = iconColorMap[category] || '#1677ff';
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
            // 判断是否有可配置项
            const hasSettings = ['next-rpa', 'online-office', 'vscode-server'].includes(app.id) || app.launch?.url;
            return [
              <Tooltip title={app.scope === 'global' ? '全局应用无需绑定' : '绑定行动空间'}>
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
              <Tooltip title={hasSettings ? '应用设置' : '暂无可配置项'}>
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
              <Tooltip title="查看详情">
                <InfoCircleOutlined
                  style={{ color: '#faad14' }}
                  onClick={() => handleShowDetail(app)}
                />
              </Tooltip>,
              <Tooltip title={app.launchable === false ? '此应用为功能开关，无需启动' : (app.enabled ? '启动应用' : '应用已禁用')}>
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
                  {app.scope === 'global' ? '全局' : '空间'}
                </Tag>
              </Space>
            </div>

            <div style={{ flex: 1 }}>
              <Paragraph
                ellipsis={{ rows: 3 }}
                style={{ marginBottom: 12, color: 'var(--custom-text-secondary)' }}
              >
                {app.basic?.description || '暂无描述'}
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
                  <Text type="secondary" style={{ fontSize: '11px' }}>启用</Text>
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
              返回应用市场
            </Button>
            <Title level={4} style={{ margin: 0 }}>{runningApp.name}</Title>
          </Space>
        </div>

        {/* 渲染对应的应用组件 */}
        {runningApp.id === 'gis-mapping' && <GISApp />}
        {runningApp.id === 'next-rpa' && runningApp.connection?.mode === 'local' && runningApp.connection?.localConfig?.vncUrl && vncToken && vncWsPort && (() => {
          // 使用 websockify 代理 URL (单端口 + token 路由)
          const proxyUrl = vncProxyService.getProxyUrl(vncWsPort, vncToken);
          return (
          <Card 
            title="远程桌面 - VNC"
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
                message.success('VNC 连接成功');
              }}
              onDisconnect={(e) => {
                // 检查是否是连接失败
                if (e?.detail?.clean === false || e?.detail?.code === 1011) {
                  message.error('VNC 连接失败: ' + (e?.detail?.reason || '无法连接到目标服务器'));
                }
              }}
              onSecurityFailure={(e) => {
                message.error('VNC 安全验证失败: ' + (e?.detail?.reason || '未知错误'));
              }}
            />
          </Card>
          );
        })()}
        {runningApp.id === 'next-rpa' && !(runningApp.connection?.mode === 'local' && runningApp.connection?.localConfig?.vncUrl) && (
          <NextRPAApp
            appConfig={runningApp}
            onConfigChange={async (newConfig) => {
              // 保存配置到后端
              try {
                await marketService.updateAppConfig(runningApp.id, newConfig);
                message.success('配置已保存');
                // 重新加载应用列表
                loadApps();
              } catch (error) {
                message.error('保存配置失败: ' + error.message);
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
              title="数据可视化工具"
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
          <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>实体应用市场</Title>
          <Text type="secondary">
            发现和使用各种实体操作插件，提升工作效率
          </Text>
        </div>
      </div>

      {/* 搜索和筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Space>
          <Search
            placeholder="搜索应用名称、描述或标签"
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
              <Option key={category} value={category}>{category}</Option>
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
            description="没有找到匹配的应用"
            style={{ margin: '64px 0' }}
          />
        )
      )}

      {/* 应用详情Modal */}
      <Modal
        title={selectedApp?.name}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDetailModalVisible(false)}>
            关闭
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
            {selectedApp?.enabled ? '启动应用' : '应用已禁用'}
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

            {/* 应用描述 */}
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: '16px' }}>应用描述</Text>
              <Paragraph style={{ marginTop: 8 }}>
                {selectedApp.basic?.description || '暂无描述'}
              </Paragraph>
            </div>

            {/* 基本信息 */}
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: '16px' }}>基本信息</Text>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={8}>
                  <Text strong>分类：</Text>
                  <br />
                  <Tag color="blue">{selectedApp.basic?.category || '未分类'}</Tag>
                </Col>
                <Col span={8}>
                  <Text strong>版本：</Text>
                  <br />
                  <Text>{selectedApp.basic?.version || '1.0.0'}</Text>
                </Col>
                <Col span={8}>
                  <Text strong>作者：</Text>
                  <br />
                  <Text>{selectedApp.basic?.author || '未知'}</Text>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <Text strong>启用状态：</Text>
                  <br />
                  <Tag color={selectedApp.enabled ? 'green' : 'default'}>
                    {selectedApp.enabled ? '已启用' : '已禁用'}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text strong>排序权重：</Text>
                  <br />
                  <Text>{selectedApp.sort_order || 0}</Text>
                </Col>
              </Row>
            </div>

            {/* 标签 */}
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: '16px' }}>应用标签</Text>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {(selectedApp.basic?.tags || []).map(tag => (
                  <Tag key={tag} style={{ marginRight: 0 }}>{tag}</Tag>
                ))}
                {(!selectedApp.basic?.tags || selectedApp.basic.tags.length === 0) && (
                  <Text type="secondary">暂无标签</Text>
                )}
              </div>
            </div>

            {/* 启动配置 */}
            {selectedApp.launch && (
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ fontSize: '16px' }}>启动配置</Text>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col span={8}>
                    <Text strong>启动类型：</Text>
                    <br />
                    <Tag color="purple">
                      {selectedApp.launch.type === 'tab' ? '新标签页' :
                       selectedApp.launch.type === 'iframe' ? 'iframe嵌入' :
                       selectedApp.launch.type === 'component' ? '组件模式' :
                       selectedApp.launch.type === 'external' ? '外部链接' : selectedApp.launch.type}
                    </Tag>
                  </Col>
                  {selectedApp.launch.url && (
                    <Col span={16}>
                      <Text strong>访问地址：</Text>
                      <br />
                      <Text code>{selectedApp.launch.url}</Text>
                    </Col>
                  )}
                  {selectedApp.launch.component && (
                    <Col span={16}>
                      <Text strong>组件名称：</Text>
                      <br />
                      <Text code>{selectedApp.launch.component}</Text>
                    </Col>
                  )}
                </Row>



                {/* 启动设置 */}
                {selectedApp.launch.settings && Object.keys(selectedApp.launch.settings).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text strong>启动设置：</Text>
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



            {/* 文档链接 */}
            {selectedApp.metadata?.documentation && (
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ fontSize: '16px' }}>相关文档</Text>
                <div style={{ marginTop: 12 }}>
                  {selectedApp.metadata.documentation.userGuide && (
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>用户指南：</Text>
                      <br />
                      <Text code>{selectedApp.metadata.documentation.userGuide}</Text>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 使用统计 */}
            {selectedApp.stats && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: '16px' }}>使用统计</Text>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col span={12}>
                    <Text strong>安装次数：</Text>
                    <br />
                    <Text type="secondary">{selectedApp.stats.install_count || 0} 次</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>启动次数：</Text>
                    <br />
                    <Text type="secondary">{selectedApp.stats.launch_count || 0} 次</Text>
                  </Col>
                </Row>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 绑定行动空间Modal */}
      <Modal
        title={`绑定应用到行动空间 - ${bindingApp?.name}`}
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
            取消
          </Button>,
          <Button
            key="bind"
            type="primary"
            loading={bindLoading}
            onClick={handleBindSpaces}
          >
            确认绑定
          </Button>
        ]}
        width={900}
      >
        <div>
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">
              选择要绑定的行动空间。应用将只在绑定的行动空间中显示和可用。
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
                    <Typography.Text strong>可用的行动空间：</Typography.Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <Search
                      placeholder="搜索行动空间名称或描述"
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
                            showTotal={(total) => `共 ${total} 个行动空间`}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {boundSpaces.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <Typography.Text strong>当前已绑定的空间：</Typography.Text>
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
                  description="暂无可用的行动空间"
                  style={{ margin: '40px 0' }}
                />
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 应用设置Modal */}
      <Modal
        title={`应用设置 - ${settingsApp?.name}`}
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
                <Text type="secondary">配置 {settingsApp.name} 的相关设置</Text>
              </div>
              
              {/* 通用设置：启动URL */}
              {settingsApp.launch?.url && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>启动地址：</Text>
                  <Input 
                    defaultValue={settingsApp.launch.url}
                    style={{ marginTop: 8 }}
                    onChange={(e) => {
                      settingsApp.launch.url = e.target.value;
                    }}
                  />
                </div>
              )}

              {/* 没有可配置项的提示 */}
              {!settingsApp.launch?.url && (
                <Empty description="该应用暂无可配置项" />
              )}

              <div style={{ marginTop: 24, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setSettingsModalVisible(false)}>取消</Button>
                  <Button type="primary" onClick={() => handleSaveSettings(settingsApp)}>
                    保存配置
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
