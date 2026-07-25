import api from './axios';
import { serviceCenterAPI, type ServiceInventoryResponse } from './serviceCenter';

jest.mock('./axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

test('loads the administrator service inventory endpoint without reshaping it', async () => {
  const payload: ServiceInventoryResponse = {
    success: true,
    data: {
      checked_at: '2026-07-21T00:00:00Z',
      deployment_mode: 'docker',
      control_available: false,
      control_status_detail: 'not_configured',
      summary: {
        total: 1,
        healthy: 1,
        degraded: 0,
        unhealthy: 0,
        disabled: 0,
        unknown: 0,
      },
      services: [],
    },
  };
  (api.get as jest.Mock).mockResolvedValue({ data: payload });

  await expect(serviceCenterAPI.getServices()).resolves.toEqual(payload);
  expect(api.get).toHaveBeenCalledWith('/system/services');
});

test('posts a lifecycle action to the allowlisted service endpoint', async () => {
  const payload = {
    success: true,
    data: {
      service_id: 'milvus',
      action: 'restart' as const,
      changed: true,
      installed: true,
      runtime_status: 'running' as const,
      checked_at: '2026-07-21T00:00:00Z',
    },
  };
  (api.post as jest.Mock).mockResolvedValue({ data: payload });

  await expect(serviceCenterAPI.runAction('milvus', 'restart')).resolves.toEqual(payload);
  expect(api.post).toHaveBeenCalledWith(
    '/system/services/milvus/actions/restart',
    undefined,
    { timeout: 240_000 },
  );
});
