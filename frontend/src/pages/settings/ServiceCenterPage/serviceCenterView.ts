import type { LogicalService } from '../../../services/api/serviceCenter';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const SERVICE_CATEGORY_ORDER = [
  'core',
  'infrastructure',
  'data',
  'knowledge',
  'capability',
  'integration',
] as const;

const SERVICE_NAME_KEYS: Record<string, string> = {
  backend: 'serviceCenter.services.backend',
  frontend: 'serviceCenter.services.frontend',
  database: 'serviceCenter.services.database',
  redis: 'serviceCenter.services.redis',
  milvus: 'serviceCenter.services.milvus',
  graphiti: 'serviceCenter.services.graphiti',
  lightrag: 'serviceCenter.services.lightrag',
  onlyoffice: 'serviceCenter.services.onlyoffice',
  galapagos: 'serviceCenter.services.galapagos',
  'paddleocr-vl': 'serviceCenter.services.paddleocrVl',
  'code-server': 'serviceCenter.services.codeServer',
};

const CATEGORY_KEYS: Record<string, string> = {
  core: 'serviceCenter.category.core',
  infrastructure: 'serviceCenter.category.infrastructure',
  data: 'serviceCenter.category.data',
  knowledge: 'serviceCenter.category.knowledge',
  capability: 'serviceCenter.category.capability',
  integration: 'serviceCenter.category.integration',
};

const DEPLOYMENT_KEYS: Record<string, string> = {
  embedded: 'serviceCenter.deployment.embedded',
  native: 'serviceCenter.deployment.native',
  'docker-compose': 'serviceCenter.deployment.dockerCompose',
  external: 'serviceCenter.deployment.external',
};

export const getServiceName = (t: Translate, id: string): string => {
  const key = SERVICE_NAME_KEYS[id];
  return key
    ? t(key)
    : t('serviceCenter.services.unknown', { id });
};

export const getCategoryLabel = (t: Translate, category: string): string => {
  const key = CATEGORY_KEYS[category];
  return key
    ? t(key)
    : t('serviceCenter.category.other', { category });
};

export const getDeploymentLabel = (t: Translate, deployment: string): string => {
  const key = DEPLOYMENT_KEYS[deployment];
  return key
    ? t(key)
    : t('serviceCenter.deployment.other', { deployment });
};

const STATUS_DETAIL_KEYS: Record<string, string> = {
  timeout: 'serviceCenter.statusDetail.timeout',
  probe_error: 'serviceCenter.statusDetail.probeError',
  not_configured: 'serviceCenter.statusDetail.notConfigured',
  config_unavailable: 'serviceCenter.statusDetail.configUnavailable',
  invalid_probe_target: 'serviceCenter.statusDetail.invalidProbeTarget',
  http_client_error: 'serviceCenter.statusDetail.httpClientError',
  http_server_error: 'serviceCenter.statusDetail.httpServerError',
};

export const getStatusDetailLabel = (
  t: Translate,
  statusDetail: string | null,
): string => {
  if (!statusDetail) {
    return t('serviceCenter.value.none');
  }

  const key = STATUS_DETAIL_KEYS[statusDetail];
  if (key) {
    return t(key);
  }

  const httpStatus = /^http_(\d{3})$/.exec(statusDetail)?.[1];
  if (httpStatus) {
    return t('serviceCenter.statusDetail.httpError', { status: httpStatus });
  }

  if (statusDetail.startsWith('http_')) {
    return t('serviceCenter.statusDetail.httpUnknownError');
  }

  return t('serviceCenter.statusDetail.other');
};

const CONTROL_STATUS_DETAIL_KEYS: Record<string, string> = {
  not_installed: 'serviceCenter.controlStatusDetail.notInstalled',
  partially_installed: 'serviceCenter.controlStatusDetail.partiallyInstalled',
  foreign_container: 'serviceCenter.controlStatusDetail.foreignContainer',
  mixed_runtime: 'serviceCenter.controlStatusDetail.mixedRuntime',
  external_service: 'serviceCenter.controlStatusDetail.externalService',
};

export const getControlStatusDetailLabel = (
  t: Translate,
  statusDetail: string | null,
): string => {
  if (!statusDetail) {
    return t('serviceCenter.value.none');
  }

  const key = CONTROL_STATUS_DETAIL_KEYS[statusDetail];
  return key
    ? t(key)
    : t('serviceCenter.controlStatusDetail.other');
};

const SAFE_CONFIG_ROUTES = new Set([
  '/settings/general',
  '/settings/graph-enhancement',
  '/action-spaces/market',
]);

export const isSafeInternalRoute = (route: string | null): route is string =>
  Boolean(route && SAFE_CONFIG_ROUTES.has(route));

export const filterServicesByCategory = (
  services: LogicalService[],
  category: string,
): LogicalService[] => {
  if (category === 'all') {
    return services;
  }
  return services.filter((service) => service.category === category);
};

export const sortServicesByCategory = (services: LogicalService[]): LogicalService[] => {
  const order = new Map<string, number>(
    SERVICE_CATEGORY_ORDER.map((category, index) => [category, index]),
  );

  return [...services].sort((left, right) => {
    const categoryDelta =
      (order.get(left.category) ?? SERVICE_CATEGORY_ORDER.length) -
      (order.get(right.category) ?? SERVICE_CATEGORY_ORDER.length);

    return categoryDelta || left.id.localeCompare(right.id);
  });
};
