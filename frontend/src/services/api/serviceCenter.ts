import api from './axios';

export type ServiceRuntimeStatus = 'running' | 'stopped' | 'unknown';

export type ServiceImageAvailability =
  | 'available'
  | 'partial'
  | 'missing'
  | 'unknown';

export type ServiceAction = 'start' | 'stop' | 'restart';

export type ServiceHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'disabled'
  | 'unknown';

export interface ServiceCapabilities {
  configure: boolean;
  view_logs: boolean;
  start: boolean;
  stop: boolean;
  restart: boolean;
}

export interface ServiceImage {
  reference: string;
  present: boolean;
}

export interface LogicalService {
  id: string;
  category: string;
  deployment: string;
  required: boolean;
  enabled: boolean | null;
  installed: boolean | null;
  image_status: ServiceImageAvailability;
  images: ServiceImage[];
  runtime_status: ServiceRuntimeStatus;
  health_status: ServiceHealthStatus;
  endpoint: string | null;
  latency_ms: number | null;
  status_detail: string | null;
  control_status_detail: string | null;
  dependencies: string[];
  components: string[];
  config_route: string | null;
  capabilities: ServiceCapabilities;
  checked_at: string;
}

export interface ServiceHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  disabled: number;
  unknown: number;
}

export interface ServiceInventory {
  checked_at: string;
  deployment_mode: 'docker' | 'native';
  control_available: boolean;
  control_status_detail: string | null;
  summary: ServiceHealthSummary;
  services: LogicalService[];
}

export interface ServiceInventoryResponse {
  success: boolean;
  data: ServiceInventory;
}

export interface ServiceActionResult {
  service_id: string;
  action: ServiceAction;
  changed: boolean;
  installed: boolean;
  runtime_status: ServiceRuntimeStatus;
  checked_at: string;
}

export interface ServiceActionResponse {
  success: boolean;
  data: ServiceActionResult;
}

export const serviceCenterAPI = {
  getServices: async (): Promise<ServiceInventoryResponse> => {
    const response = await api.get<ServiceInventoryResponse>('/system/services');
    return response.data;
  },
  runAction: async (
    serviceId: string,
    action: ServiceAction,
  ): Promise<ServiceActionResponse> => {
    const response = await api.post<ServiceActionResponse>(
      `/system/services/${encodeURIComponent(serviceId)}/actions/${action}`,
      undefined,
      { timeout: 240_000 },
    );
    return response.data;
  },
};

export default serviceCenterAPI;
