import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import ServiceCenterPage from './ServiceCenterPage';
import {
  filterServicesByCategory,
  getCategoryLabel,
  getControlStatusDetailLabel,
  getDeploymentLabel,
  getServiceName,
  getStatusDetailLabel,
  isSafeInternalRoute,
} from './serviceCenterView';
import serviceCenterAPI, {
  type LogicalService,
  type ServiceActionResponse,
  type ServiceInventoryResponse,
} from '../../../services/api/serviceCenter';

const mockModalConfirm = jest.fn();
const mockMessageSuccess = jest.fn();
const mockMessageInfo = jest.fn();
const mockMessageError = jest.fn();

jest.mock('../../../services/api/serviceCenter', () => ({
  __esModule: true,
  default: {
    getServices: jest.fn(),
    runAction: jest.fn(),
  },
}));

jest.mock('react-router-dom', () => {
  const React = jest.requireActual('react');
  return {
    Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
      React.createElement('a', { href: to }, children),
  };
}, { virtual: true });

jest.mock('@ant-design/icons', () => {
  const React = jest.requireActual('react');
  const Icon = () => React.createElement('span');
  return {
    ApiOutlined: Icon,
    CloudServerOutlined: Icon,
    ReloadOutlined: Icon,
    SettingOutlined: Icon,
  };
});

jest.mock('react-i18next', () => {
  const translate = (key: string, options?: Record<string, unknown>) => {
    if (options?.id) return `${key}:${options.id}`;
    if (options?.category) return `${key}:${options.category}`;
    if (options?.status) return `${key}:${options.status}`;
    if (options?.value !== undefined) return `${key}:${options.value}`;
    return key;
  };

  return {
    useTranslation: () => ({
      t: translate,
      i18n: { language: 'en-US' },
    }),
  };
});

jest.mock('antd', () => {
  const React = jest.requireActual('react');

  const Box = ({ children, title, extra, style, 'data-testid': testId }: any) => React.createElement(
    'div',
    { style, 'data-testid': testId },
    title,
    extra,
    children,
  );
  const Inline = ({ children }: any) => React.createElement('span', null, children);
  const Button = ({ children, disabled, icon, loading, onClick }: any) => React.createElement(
    'button',
    { disabled: disabled || loading, onClick },
    icon,
    children,
  );
  const Select = ({ options, onChange, ...props }: any) => React.createElement(
    'select',
    {
      ...props,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
    },
    options.map((option: { value: string; label: string }) => React.createElement(
      'option',
      { key: option.value, value: option.value },
      option.label,
    )),
  );
  const Statistic = ({ title, value }: any) => React.createElement(
    'div',
    { 'data-testid': `summary-${title}` },
    `${title}:${value}`,
  );
  const Table = ({ columns, dataSource, expandable, loading }: any) => React.createElement(
    'div',
    { 'data-testid': 'service-table', 'data-loading': String(Boolean(loading)) },
    dataSource.map((record: LogicalService, rowIndex: number) => React.createElement(
      'div',
      { key: record.id, 'data-testid': `service-row-${record.id}` },
      columns.map((column: any, columnIndex: number) => React.createElement(
        'div',
        { key: column.key ?? columnIndex },
        column.render
          ? column.render(column.dataIndex ? record[column.dataIndex as keyof LogicalService] : undefined, record, rowIndex)
          : String(record[column.dataIndex as keyof LogicalService] ?? ''),
      )),
      expandable?.expandedRowRender(record),
    )),
  );
  const Alert = ({ message, description, action }: any) => React.createElement(
    'div',
    { role: 'alert' },
    message,
    description,
    action,
  );
  const Descriptions = Box as any;
  Descriptions.Item = ({ label, children }: any) => React.createElement(
    'div',
    null,
    React.createElement('span', null, label),
    children,
  );
  const AntdApp: any = Box;
  AntdApp.useApp = () => ({
    message: {
      success: mockMessageSuccess,
      info: mockMessageInfo,
      error: mockMessageError,
    },
    modal: { confirm: mockModalConfirm },
  });

  return {
    App: AntdApp,
    Alert,
    Button,
    Card: Box,
    Col: Box,
    Descriptions,
    Empty: ({ description }: any) => React.createElement('div', null, description),
    Row: Box,
    Select,
    Skeleton: () => React.createElement('div', { 'data-testid': 'loading-skeleton' }),
    Space: Box,
    Statistic,
    Table,
    Tag: Inline,
    Typography: { Title: Box, Text: Inline },
  };
});

const makeService = (overrides: Partial<LogicalService> = {}): LogicalService => ({
  id: 'backend',
  category: 'core',
  deployment: 'docker-compose',
  required: true,
  enabled: true,
  installed: true,
  image_status: 'unknown',
  images: [],
  runtime_status: 'running',
  health_status: 'healthy',
  endpoint: 'http://backend:8080/api/health',
  latency_ms: 2.4,
  status_detail: null,
  control_status_detail: null,
  dependencies: [],
  components: ['abm-backend'],
  config_route: null,
  capabilities: {
    configure: false,
    view_logs: false,
    start: false,
    stop: false,
    restart: false,
  },
  checked_at: '2026-07-21T00:00:00Z',
  ...overrides,
});

const response: ServiceInventoryResponse = {
  success: true,
  data: {
    checked_at: '2026-07-21T00:00:00Z',
    deployment_mode: 'docker',
    control_available: true,
    control_status_detail: null,
    summary: {
      total: 2,
      healthy: 1,
      degraded: 0,
      unhealthy: 1,
      disabled: 0,
      unknown: 0,
    },
    services: [
      makeService({
        capabilities: {
          configure: false,
          view_logs: true,
          start: false,
          stop: false,
          restart: false,
        },
      }),
      makeService({
        id: 'redis',
        category: 'infrastructure',
        required: false,
        runtime_status: 'running',
        health_status: 'unhealthy',
        endpoint: 'redis://redis:6379/0',
        components: ['abm-redis'],
      }),
    ],
  },
};

const renderPage = () => render(<ServiceCenterPage />);

beforeEach(() => {
  jest.clearAllMocks();
  (serviceCenterAPI.getServices as jest.Mock).mockReset();
  (serviceCenterAPI.runAction as jest.Mock).mockReset();
});

test('renders the health summary, keeps MCP separate, and filters by category', async () => {
  (serviceCenterAPI.getServices as jest.Mock).mockResolvedValue(response);
  renderPage();

  expect(await screen.findByTestId('summary-serviceCenter.summary.total')).toHaveTextContent(':2');
  expect(screen.getByTestId('summary-serviceCenter.summary.healthy')).toHaveTextContent(':1');
  expect(screen.getByTestId('service-row-backend')).toBeInTheDocument();
  expect(screen.getByTestId('service-row-redis')).toBeInTheDocument();
  expect(screen.getByTestId('service-row-redis')).toHaveTextContent('serviceCenter.runtime.running');
  expect(screen.getByTestId('service-row-redis')).toHaveTextContent('serviceCenter.health.unhealthy');
  expect(screen.getByTestId('service-row-redis')).toHaveTextContent('abm-redis');
  expect(screen.getByRole('link', { name: 'serviceCenter.integration.manageMcp' })).toHaveAttribute(
    'href',
    '/settings/mcp-servers',
  );
  expect(screen.getAllByRole('link', { name: 'serviceCenter.action.viewLogs' })[0]).toHaveAttribute(
    'href',
    '/settings/logs',
  );

  fireEvent.change(
    screen.getByLabelText('serviceCenter.filter.category'),
    { target: { value: 'infrastructure' } },
  );

  expect(screen.queryByTestId('service-row-backend')).not.toBeInTheDocument();
  expect(screen.getByTestId('service-row-redis')).toBeInTheDocument();
});

test('shows aggregate image availability and each missing image reference', async () => {
  (serviceCenterAPI.getServices as jest.Mock).mockResolvedValue({
    ...response,
    data: {
      ...response.data,
      services: [makeService({
        id: 'graphiti',
        image_status: 'partial',
        images: [
          { reference: 'neo4j:5.26.2', present: true },
          { reference: 'graphiti:latest', present: false },
        ],
      })],
    },
  });
  renderPage();

  const row = await screen.findByTestId('service-row-graphiti');
  expect(row).toHaveTextContent('serviceCenter.image.partial');
  expect(row).toHaveTextContent('neo4j:5.26.2');
  expect(row).toHaveTextContent('graphiti:latest');
  expect(row).toHaveTextContent('serviceCenter.image.present');
  expect(row).toHaveTextContent('serviceCenter.image.missing');
});

test('refreshes the inventory and presents a retryable load failure', async () => {
  (serviceCenterAPI.getServices as jest.Mock)
    .mockResolvedValueOnce(response)
    .mockRejectedValueOnce(new Error('network unavailable'))
    .mockResolvedValueOnce(response);
  renderPage();

  await screen.findByTestId('service-row-backend');
  fireEvent.click(screen.getByRole('button', { name: 'serviceCenter.action.refresh' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('serviceCenter.error.loadFailed');
  expect(screen.getByTestId('service-row-backend')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'serviceCenter.action.retry' }));
  await waitFor(() => expect(serviceCenterAPI.getServices).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('deduplicates stop confirmation, clears its lock, and refreshes after the action', async () => {
  const controlledResponse: ServiceInventoryResponse = {
    ...response,
    data: {
      ...response.data,
      services: [makeService({
        id: 'milvus',
        category: 'data',
        required: false,
        capabilities: {
          configure: false,
          view_logs: false,
          start: false,
          stop: true,
          restart: true,
        },
      })],
    },
  };
  let resolveAction!: (value: ServiceActionResponse) => void;
  const actionResponse = new Promise<ServiceActionResponse>((resolve) => {
    resolveAction = resolve;
  });
  (serviceCenterAPI.getServices as jest.Mock).mockResolvedValue(controlledResponse);
  (serviceCenterAPI.runAction as jest.Mock).mockReturnValue(actionResponse);
  renderPage();

  const row = await screen.findByTestId('service-row-milvus');
  const stopButton = within(row).getAllByRole('button', {
    name: 'serviceCenter.action.stop',
  })[0];
  act(() => {
    stopButton.click();
    stopButton.click();
  });

  expect(mockModalConfirm).toHaveBeenCalledTimes(1);
  expect(serviceCenterAPI.runAction).not.toHaveBeenCalled();

  act(() => {
    mockModalConfirm.mock.calls[0][0].afterClose();
  });
  await waitFor(() => expect(stopButton).toBeEnabled());
  act(() => {
    stopButton.click();
    stopButton.click();
  });
  expect(mockModalConfirm).toHaveBeenCalledTimes(2);

  act(() => {
    mockModalConfirm.mock.calls[1][0].onCancel();
  });
  await waitFor(() => expect(stopButton).toBeEnabled());
  fireEvent.click(stopButton);
  expect(mockModalConfirm).toHaveBeenCalledTimes(3);

  let confirmationPromise!: Promise<void>;
  act(() => {
    confirmationPromise = mockModalConfirm.mock.calls[2][0].onOk();
  });
  await waitFor(() => expect(stopButton).toBeDisabled());
  expect(serviceCenterAPI.runAction).toHaveBeenCalledWith('milvus', 'stop');

  await act(async () => {
    resolveAction({
      success: true,
      data: {
        service_id: 'milvus',
        action: 'stop',
        changed: true,
        installed: true,
        runtime_status: 'stopped',
        checked_at: '2026-07-21T00:00:01Z',
      },
    });
    await confirmationPromise;
  });

  await waitFor(() => expect(serviceCenterAPI.getServices).toHaveBeenCalledTimes(2));
  expect(mockMessageSuccess).toHaveBeenCalledWith('serviceCenter.control.actionChanged');
});

test('starts immediately and reports an idempotent no-change result', async () => {
  const controlledResponse: ServiceInventoryResponse = {
    ...response,
    data: {
      ...response.data,
      services: [makeService({
        id: 'lightrag',
        category: 'knowledge',
        required: false,
        runtime_status: 'stopped',
        capabilities: {
          configure: false,
          view_logs: false,
          start: true,
          stop: false,
          restart: false,
        },
      })],
    },
  };
  (serviceCenterAPI.getServices as jest.Mock).mockResolvedValue(controlledResponse);
  (serviceCenterAPI.runAction as jest.Mock).mockResolvedValue({
    success: true,
    data: {
      service_id: 'lightrag',
      action: 'start',
      changed: false,
      installed: true,
      runtime_status: 'running',
      checked_at: '2026-07-21T00:00:01Z',
    },
  });
  renderPage();

  const row = await screen.findByTestId('service-row-lightrag');
  fireEvent.click(within(row).getAllByRole('button', {
    name: 'serviceCenter.action.start',
  })[0]);

  await waitFor(() => expect(serviceCenterAPI.runAction).toHaveBeenCalledWith('lightrag', 'start'));
  await waitFor(() => expect(serviceCenterAPI.getServices).toHaveBeenCalledTimes(2));
  expect(mockModalConfirm).not.toHaveBeenCalled();
  expect(mockMessageInfo).toHaveBeenCalledWith('serviceCenter.control.noChange');
});

test('refreshes after an action failure and keeps the localized failure visible', async () => {
  const controlledResponse: ServiceInventoryResponse = {
    ...response,
    data: {
      ...response.data,
      services: [makeService({
        id: 'graphiti',
        category: 'knowledge',
        required: false,
        runtime_status: 'stopped',
        capabilities: {
          configure: false,
          view_logs: false,
          start: true,
          stop: false,
          restart: false,
        },
      })],
    },
  };
  (serviceCenterAPI.getServices as jest.Mock)
    .mockResolvedValueOnce(controlledResponse)
    .mockRejectedValueOnce(new Error('refresh unavailable'));
  (serviceCenterAPI.runAction as jest.Mock).mockRejectedValue(
    new Error('partial grouped action failure'),
  );
  renderPage();

  const row = await screen.findByTestId('service-row-graphiti');
  fireEvent.click(within(row).getAllByRole('button', {
    name: 'serviceCenter.action.start',
  })[0]);

  await waitFor(() => expect(serviceCenterAPI.getServices).toHaveBeenCalledTimes(2));
  expect(mockMessageError).toHaveBeenCalledWith('serviceCenter.error.actionFailed');
  expect(await screen.findByRole('alert')).toHaveTextContent('serviceCenter.error.loadFailed');
});

test('explains the Docker socket opt-in when lifecycle control is unavailable', async () => {
  (serviceCenterAPI.getServices as jest.Mock).mockResolvedValue({
    ...response,
    data: {
      ...response.data,
      control_available: false,
      control_status_detail: 'docker_socket_unavailable',
    },
  });
  renderPage();

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('serviceCenter.control.unavailableTitle');
  expect(alert).toHaveTextContent('serviceCenter.control.unavailableDescription');
});

test('uses localized fallbacks and only accepts safe internal configuration routes', () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    `${key}:${options?.id ?? options?.category ?? options?.status ?? ''}`;
  const services = response.data.services;

  expect(getServiceName(t, 'future-service')).toContain('serviceCenter.services.unknown');
  expect(getCategoryLabel(t, 'future-category')).toContain('serviceCenter.category.other');
  expect(getDeploymentLabel(t, 'external')).toContain('serviceCenter.deployment.external');
  expect(getStatusDetailLabel(t, 'http_503')).toContain('serviceCenter.statusDetail.httpError');
  expect(getStatusDetailLabel(t, 'http_client_error')).toContain('serviceCenter.statusDetail.httpClientError');
  expect(getStatusDetailLabel(t, 'http_server_error')).toContain('serviceCenter.statusDetail.httpServerError');
  expect(getStatusDetailLabel(t, 'unexpected_detail')).toContain('serviceCenter.statusDetail.other');
  expect(getControlStatusDetailLabel(t, 'not_installed')).toContain(
    'serviceCenter.controlStatusDetail.notInstalled',
  );
  expect(getControlStatusDetailLabel(t, 'unexpected_detail')).toContain(
    'serviceCenter.controlStatusDetail.other',
  );
  expect(filterServicesByCategory(services, 'core')).toEqual([services[0]]);
  expect(isSafeInternalRoute('/settings/general')).toBe(true);
  expect(isSafeInternalRoute('/settings/future-route')).toBe(false);
  expect(isSafeInternalRoute('//external.example/path')).toBe(false);
  expect(isSafeInternalRoute('https://external.example/path')).toBe(false);
});
