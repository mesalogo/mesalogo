import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import {
  App as AntdApp,
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  ApiOutlined,
  CloudServerOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import serviceCenterAPI, {
  type LogicalService,
  type ServiceAction,
  type ServiceHealthStatus,
  type ServiceImage,
  type ServiceImageAvailability,
  type ServiceInventory,
  type ServiceRuntimeStatus,
} from '../../../services/api/serviceCenter';
import {
  filterServicesByCategory,
  getCategoryLabel,
  getControlStatusDetailLabel,
  getDeploymentLabel,
  getServiceName,
  getStatusDetailLabel,
  isSafeInternalRoute,
  SERVICE_CATEGORY_ORDER,
  sortServicesByCategory,
} from './serviceCenterView';

const { Title, Text } = Typography;

const SUMMARY_ITEMS = [
  { key: 'total', color: undefined },
  { key: 'healthy', color: '#52c41a' },
  { key: 'degraded', color: '#faad14' },
  { key: 'unhealthy', color: '#ff4d4f' },
  { key: 'disabled', color: '#8c8c8c' },
  { key: 'unknown', color: '#8c8c8c' },
] as const;

const healthColors: Record<ServiceHealthStatus, string> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
  disabled: 'default',
  unknown: 'default',
};

const runtimeColors: Record<ServiceRuntimeStatus, string> = {
  running: 'success',
  stopped: 'default',
  unknown: 'default',
};

const imageColors: Record<ServiceImageAvailability, string> = {
  available: 'success',
  partial: 'warning',
  missing: 'error',
  unknown: 'default',
};

const ServiceCenterPage: React.FC = () => {
  const { t, i18n } = useTranslation('serviceCenter');
  const { message, modal } = AntdApp.useApp();
  const [inventory, setInventory] = useState<ServiceInventory | null>(null);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, ServiceAction>>({});
  const [confirmingServices, setConfirmingServices] = useState<Record<string, boolean>>({});
  const activeActionServicesRef = useRef(new Set<string>());
  const confirmingServicesRef = useRef(new Set<string>());

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await serviceCenterAPI.getServices();
      if (!response.success || !response.data) {
        throw new Error('Invalid service inventory response');
      }
      setInventory(response.data);
    } catch {
      setError(t('serviceCenter.error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const formatTimestamp = useCallback((value: string | null | undefined): string => {
    if (!value) {
      return t('serviceCenter.value.notAvailable');
    }

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      return t('serviceCenter.value.notAvailable');
    }

    return new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(timestamp);
  }, [i18n.language, t]);

  const renderConfiguredState = useCallback((enabled: boolean | null) => {
    if (enabled === true) {
      return <Tag color="processing">{t('serviceCenter.configured.enabled')}</Tag>;
    }
    if (enabled === false) {
      return <Tag>{t('serviceCenter.configured.disabled')}</Tag>;
    }
    return <Tag>{t('serviceCenter.configured.unknown')}</Tag>;
  }, [t]);

  const renderRuntimeState = useCallback((status: ServiceRuntimeStatus) => (
    <Tag color={runtimeColors[status]}>
      {t(`serviceCenter.runtime.${status}`)}
    </Tag>
  ), [t]);

  const renderHealthState = useCallback((status: ServiceHealthStatus) => (
    <Tag color={healthColors[status]}>
      {t(`serviceCenter.health.${status}`)}
    </Tag>
  ), [t]);

  const renderImageState = useCallback((status: ServiceImageAvailability) => (
    <Tag color={imageColors[status]}>
      {t(`serviceCenter.image.${status}`)}
    </Tag>
  ), [t]);

  const renderDependencies = useCallback((dependencies: string[]) => {
    if (dependencies.length === 0) {
      return <Text type="secondary">{t('serviceCenter.value.none')}</Text>;
    }

    return (
      <Space size={[0, 4]} wrap>
        {dependencies.map((dependency) => (
          <Tag key={dependency}>{getServiceName(t, dependency)}</Tag>
        ))}
      </Space>
    );
  }, [t]);

  const renderComponents = useCallback((components: string[]) => {
    if (components.length === 0) {
      return <Text type="secondary">{t('serviceCenter.value.none')}</Text>;
    }

    return (
      <Space size={[0, 4]} wrap>
        {components.map((component) => (
          <Tag key={component}>{component}</Tag>
        ))}
      </Space>
    );
  }, [t]);

  const renderImages = useCallback((images: ServiceImage[]) => {
    if (images.length === 0) {
      return <Text type="secondary">{t('serviceCenter.value.notAvailable')}</Text>;
    }

    return (
      <Space size={[0, 4]} wrap>
        {images.map((item) => (
          <Tag key={item.reference} color={item.present ? 'success' : 'error'}>
            <Space size={4}>
              <Text code>{item.reference}</Text>
              {t(item.present ? 'serviceCenter.image.present' : 'serviceCenter.image.missing')}
            </Space>
          </Tag>
        ))}
      </Space>
    );
  }, [t]);

  const renderConfigLink = useCallback((service: LogicalService) => {
    if (!service.capabilities.configure || !isSafeInternalRoute(service.config_route)) {
      return null;
    }

    return (
      <Link to={service.config_route}>
        <Space size={4}>
          <SettingOutlined />
          {t('serviceCenter.action.configure')}
        </Space>
      </Link>
    );
  }, [t]);

  const executeAction = useCallback(async (
    service: LogicalService,
    action: ServiceAction,
  ): Promise<void> => {
    if (activeActionServicesRef.current.has(service.id)) {
      return;
    }
    activeActionServicesRef.current.add(service.id);
    setPendingActions((current) => ({ ...current, [service.id]: action }));

    try {
      const response = await serviceCenterAPI.runAction(service.id, action);
      if (!response.success || !response.data) {
        throw new Error('Invalid service action response');
      }

      const serviceName = getServiceName(t, service.id);
      if (response.data.changed) {
        message.success(t('serviceCenter.control.actionChanged', {
          action: t(`serviceCenter.action.${action}`),
          service: serviceName,
        }));
      } else {
        message.info(t('serviceCenter.control.noChange', { service: serviceName }));
      }
    } catch {
      message.error(t('serviceCenter.error.actionFailed', {
        action: t(`serviceCenter.action.${action}`),
        service: getServiceName(t, service.id),
      }));
    } finally {
      try {
        // A grouped Docker action can partially succeed before returning an error.
        // Refresh on both success and failure so the inventory reflects actual state.
        await loadServices();
      } finally {
        activeActionServicesRef.current.delete(service.id);
        setPendingActions((current) => {
          const next = { ...current };
          delete next[service.id];
          return next;
        });
      }
    }
  }, [loadServices, message, t]);

  const requestAction = useCallback((service: LogicalService, action: ServiceAction) => {
    if (
      activeActionServicesRef.current.has(service.id)
      || confirmingServicesRef.current.has(service.id)
    ) {
      return;
    }

    if (action === 'start') {
      void executeAction(service, action);
      return;
    }

    confirmingServicesRef.current.add(service.id);
    setConfirmingServices((current) => ({ ...current, [service.id]: true }));

    const clearConfirmation = () => {
      if (!confirmingServicesRef.current.delete(service.id)) {
        return;
      }
      setConfirmingServices((current) => {
        const next = { ...current };
        delete next[service.id];
        return next;
      });
    };

    try {
      modal.confirm({
        title: t(`serviceCenter.confirm.${action}Title`, {
          service: getServiceName(t, service.id),
        }),
        content: t(`serviceCenter.confirm.${action}Description`),
        okText: t(`serviceCenter.action.${action}`),
        cancelText: t('common.cancel'),
        okButtonProps: action === 'stop' ? { danger: true } : undefined,
        onCancel: clearConfirmation,
        afterClose: clearConfirmation,
        onOk: async () => {
          try {
            await executeAction(service, action);
          } finally {
            clearConfirmation();
          }
        },
      });
    } catch {
      clearConfirmation();
      message.error(t('serviceCenter.error.actionFailed', {
        action: t(`serviceCenter.action.${action}`),
        service: getServiceName(t, service.id),
      }));
    }
  }, [executeAction, message, modal, t]);

  const renderActions = useCallback((service: LogicalService) => {
    const configLink = renderConfigLink(service);
    const logsLink = service.capabilities.view_logs ? (
      <Link to="/settings/logs">
        {t('serviceCenter.action.viewLogs')}
      </Link>
    ) : null;
    const pendingAction = pendingActions[service.id];
    const isConfirmationOpen = Boolean(confirmingServices[service.id]);
    const lifecycleActions = (['start', 'stop', 'restart'] as ServiceAction[])
      .filter((action) => service.capabilities[action]);

    if (!configLink && !logsLink && lifecycleActions.length === 0) {
      return <Text type="secondary">{t('serviceCenter.value.notAvailable')}</Text>;
    }

    return (
      <Space size="small" wrap>
        {configLink}
        {logsLink}
        {lifecycleActions.map((action) => (
          <Button
            key={action}
            size="small"
            danger={action === 'stop'}
            disabled={
              !inventory?.control_available
              || Boolean(pendingAction)
              || isConfirmationOpen
            }
            loading={pendingAction === action}
            onClick={() => requestAction(service, action)}
          >
            {t(`serviceCenter.action.${action}`)}
          </Button>
        ))}
      </Space>
    );
  }, [
    confirmingServices,
    inventory?.control_available,
    pendingActions,
    renderConfigLink,
    requestAction,
    t,
  ]);

  const columns = useMemo<TableColumnsType<LogicalService>>(() => [
    {
      title: t('serviceCenter.column.service'),
      key: 'service',
      fixed: 'left',
      width: 210,
      render: (_, service) => (
        <Space direction="vertical" size={0}>
          <Space size={4} wrap>
            <Text strong>{getServiceName(t, service.id)}</Text>
            {service.required && (
              <Tag color="blue">{t('serviceCenter.value.required')}</Tag>
            )}
            {service.installed === false && (
              <Tag>{t('serviceCenter.installed.notInstalled')}</Tag>
            )}
          </Space>
          <Text type="secondary" code>{service.id}</Text>
        </Space>
      ),
    },
    {
      title: t('serviceCenter.column.category'),
      dataIndex: 'category',
      key: 'category',
      width: 140,
      responsive: ['sm'],
      render: (value: string) => getCategoryLabel(t, value),
    },
    {
      title: t('serviceCenter.column.configured'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 120,
      responsive: ['md'],
      render: renderConfiguredState,
    },
    {
      title: t('serviceCenter.column.runtime'),
      dataIndex: 'runtime_status',
      key: 'runtime_status',
      width: 120,
      responsive: ['md'],
      render: renderRuntimeState,
    },
    {
      title: t('serviceCenter.column.images'),
      dataIndex: 'image_status',
      key: 'image_status',
      width: 120,
      responsive: ['lg'],
      render: renderImageState,
    },
    {
      title: t('serviceCenter.column.health'),
      dataIndex: 'health_status',
      key: 'health_status',
      width: 120,
      render: renderHealthState,
    },
    {
      title: t('serviceCenter.column.endpoint'),
      dataIndex: 'endpoint',
      key: 'endpoint',
      width: 240,
      ellipsis: true,
      responsive: ['lg'],
      render: (endpoint: string | null) => endpoint
        ? <Text code copyable ellipsis={{ tooltip: endpoint }}>{endpoint}</Text>
        : <Text type="secondary">{t('serviceCenter.value.notAvailable')}</Text>,
    },
    {
      title: t('serviceCenter.column.dependencies'),
      dataIndex: 'dependencies',
      key: 'dependencies',
      width: 210,
      responsive: ['xl'],
      render: renderDependencies,
    },
    {
      title: t('serviceCenter.column.actions'),
      key: 'actions',
      width: 180,
      responsive: ['md'],
      render: (_, service) => renderActions(service),
    },
  ], [
    renderActions,
    renderConfiguredState,
    renderDependencies,
    renderHealthState,
    renderImageState,
    renderRuntimeState,
    t,
  ]);

  const displayedServices = useMemo(() => {
    if (!inventory) {
      return [];
    }
    return sortServicesByCategory(
      filterServicesByCategory(inventory.services, category),
    );
  }, [category, inventory]);

  const categoryOptions = useMemo(() => {
    const presentCategories = new Set(inventory?.services.map((service) => service.category) ?? []);
    const orderedCategories = [
      ...SERVICE_CATEGORY_ORDER.filter((item) => presentCategories.has(item)),
      ...Array.from(presentCategories).filter(
        (item) => !SERVICE_CATEGORY_ORDER.includes(item as typeof SERVICE_CATEGORY_ORDER[number]),
      ),
    ];

    return [
      { value: 'all', label: t('serviceCenter.category.all') },
      ...orderedCategories.map((value) => ({
        value,
        label: getCategoryLabel(t, value),
      })),
    ];
  }, [inventory, t]);

  const expandedRowRender = useCallback((service: LogicalService) => (
    <div style={{ padding: '4px 12px' }}>
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 2, lg: 3 }}
      >
        <Descriptions.Item label={t('serviceCenter.column.category')}>
          {getCategoryLabel(t, service.category)}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.detail.deployment')}>
          {service.deployment
            ? getDeploymentLabel(t, service.deployment)
            : t('serviceCenter.value.notAvailable')}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.detail.latency')}>
          {service.latency_ms === null
            ? t('serviceCenter.value.notAvailable')
            : t('serviceCenter.value.latency', { value: service.latency_ms })}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.column.configured')}>
          {renderConfiguredState(service.enabled)}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.column.runtime')}>
          {renderRuntimeState(service.runtime_status)}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.column.images')}>
          {renderImageState(service.image_status)}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.detail.checkedAt')}>
          {formatTimestamp(service.checked_at)}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.column.endpoint')} span={3}>
          {service.endpoint
            ? <Text code copyable>{service.endpoint}</Text>
            : <Text type="secondary">{t('serviceCenter.value.notAvailable')}</Text>}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.column.dependencies')} span={2}>
          {renderDependencies(service.dependencies)}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.column.actions')}>
          {renderActions(service)}
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.detail.components')} span={3}>
          <Space direction="vertical" size={4}>
            {renderComponents(service.components)}
            <Text type="secondary">{t('serviceCenter.detail.componentsHint')}</Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.detail.images')} span={3}>
          <Space direction="vertical" size={4}>
            {renderImages(service.images)}
            <Text type="secondary">{t('serviceCenter.detail.imagesHint')}</Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label={t('serviceCenter.detail.statusDetail')} span={3}>
          {getStatusDetailLabel(t, service.status_detail)}
        </Descriptions.Item>
        {service.control_status_detail && (
          <Descriptions.Item label={t('serviceCenter.detail.controlStatus')} span={3}>
            {getControlStatusDetailLabel(t, service.control_status_detail)}
          </Descriptions.Item>
        )}
      </Descriptions>
    </div>
  ), [
    formatTimestamp,
    renderActions,
    renderComponents,
    renderConfiguredState,
    renderDependencies,
    renderImageState,
    renderImages,
    renderRuntimeState,
    t,
  ]);

  return (
    <div className="page-container" data-testid="service-center-page">
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
          <Space>
            <CloudServerOutlined />
            {t('serviceCenter.title')}
          </Space>
        </Title>
        <Text type="secondary">{t('serviceCenter.subtitle')}</Text>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('serviceCenter.error.title')}
          description={error}
          action={(
            <Button size="small" onClick={() => void loadServices()}>
              {t('serviceCenter.action.retry')}
            </Button>
          )}
        />
      )}

      {!inventory && loading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : inventory ? (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {SUMMARY_ITEMS.map(({ key, color }) => (
              <Col xs={12} sm={8} md={4} key={key}>
                <Card size="small">
                  <Statistic
                    title={t(`serviceCenter.summary.${key}`)}
                    value={inventory.summary[key]}
                    valueStyle={color ? { color } : undefined}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {!inventory.control_available && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('serviceCenter.control.unavailableTitle')}
              description={t('serviceCenter.control.unavailableDescription')}
            />
          )}

          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 12]} align="middle" justify="space-between">
              <Col>
                <Space size="large" wrap>
                  <Space>
                    <Text type="secondary">{t('serviceCenter.meta.deploymentMode')}</Text>
                    <Tag color={inventory.deployment_mode === 'docker' ? 'blue' : 'default'}>
                      {t(`serviceCenter.deploymentMode.${inventory.deployment_mode}`)}
                    </Tag>
                  </Space>
                  <Space>
                    <Text type="secondary">{t('serviceCenter.meta.lastChecked')}</Text>
                    <Text>{formatTimestamp(inventory.checked_at)}</Text>
                  </Space>
                </Space>
              </Col>
              <Col>
                <Button
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={() => void loadServices()}
                >
                  {t('serviceCenter.action.refresh')}
                </Button>
              </Col>
            </Row>
          </Card>

          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 12]} align="middle" justify="space-between">
              <Col flex="auto">
                <Space align="start">
                  <ApiOutlined style={{ marginTop: 4 }} />
                  <Space direction="vertical" size={0}>
                    <Text strong>{t('serviceCenter.integration.mcpTitle')}</Text>
                    <Text type="secondary">{t('serviceCenter.integration.mcpDescription')}</Text>
                  </Space>
                </Space>
              </Col>
              <Col>
                <Link to="/settings/mcp-servers">
                  {t('serviceCenter.integration.manageMcp')}
                </Link>
              </Col>
            </Row>
          </Card>

          <Card
            title={t('serviceCenter.table.title')}
            extra={(
              <Select
                aria-label={t('serviceCenter.filter.category')}
                value={category}
                options={categoryOptions}
                style={{ minWidth: 180 }}
                onChange={setCategory}
              />
            )}
          >
            <Table<LogicalService>
              rowKey="id"
              columns={columns}
              dataSource={displayedServices}
              loading={loading}
              pagination={false}
              size="middle"
              scroll={{ x: 1300 }}
              locale={{
                emptyText: <Empty description={t('serviceCenter.table.empty')} />,
              }}
              expandable={{
                expandedRowRender,
                columnTitle: t('serviceCenter.table.details'),
              }}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default ServiceCenterPage;
