import { render, screen, waitFor } from '@testing-library/react';
import SetupGate from './SetupGate';
import { setupAPI } from '../../services/api/setup';

jest.mock('antd', () => {
  const React = jest.requireActual('react');
  const Box: any = (props: any) => React.createElement('div', {
    style: props.style,
  }, props.children ?? props.title);
  const Button: any = (props: any) => React.createElement('button', {
    onClick: props.onClick,
  }, props.children);
  const Result: any = (props: any) => React.createElement('div', {
    'data-testid': 'setup-gate-error',
  }, props.title);
  const Spin: any = (props: any) => React.createElement('div', {
    'data-testid': 'setup-gate-spin',
  }, props.children);

  return { Result, Button, Spin, Box };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../pages/setup/SetupWizard', () => ({
  __esModule: true,
  default: () => <div data-testid="setup-wizard" />,
}));

jest.mock('../../services/api/setup', () => ({
  setupAPI: { getStatus: jest.fn() },
}));

const mockGetStatus = setupAPI.getStatus as jest.Mock;

beforeEach(() => {
  mockGetStatus.mockReset();
});

test('renders the app when setup is already done', async () => {
  mockGetStatus.mockResolvedValue({ setup_mode: false });

  render(<SetupGate><div data-testid="app-shell" /></SetupGate>);

  expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
});

test('renders the wizard when the backend is in setup mode', async () => {
  mockGetStatus.mockResolvedValue({ setup_mode: true, defaults: undefined });

  render(<SetupGate><div data-testid="app-shell" /></SetupGate>);

  expect(await screen.findByTestId('setup-wizard')).toBeInTheDocument();
});

test('lets the app render when the probe fails with an expired license', async () => {
  mockGetStatus.mockRejectedValue({
    response: { status: 403, data: { code: 'LICENSE_EXPIRED' } },
  });

  render(<SetupGate><div data-testid="app-shell" /></SetupGate>);

  expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
  expect(screen.queryByTestId('setup-gate-error')).not.toBeInTheDocument();
});

test('shows the unreachable screen only when no response came back', async () => {
  mockGetStatus.mockRejectedValue({ request: {}, message: 'Network Error' });

  render(<SetupGate><div data-testid="app-shell" /></SetupGate>);

  expect(await screen.findByTestId('setup-gate-error')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument());
});
