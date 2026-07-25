import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { marketService } from '../../../services/marketService';
import MarketPage from './MarketPage';

jest.mock('antd', () => {
  const React = jest.requireActual('react');
  const Box: any = (props: any) => React.createElement('div', {
    style: props.style,
    className: props.className,
    'data-testid': props['data-testid'],
  }, props.children);
  const Card: any = (props: any) => {
    const actions = (props.actions || []).map((action: any, index: number) => (
      React.createElement('div', { key: index }, action)
    ));
    return React.createElement('section', {
      className: 'ant-card',
      style: props.style,
    },
    React.createElement('div', { key: 'cover' }, props.cover),
    React.createElement('div', { key: 'content' }, props.children),
    React.createElement('div', { key: 'actions' }, actions));
  };
  const Button: any = (props: any) => React.createElement('button', {
    onClick: props.onClick,
    disabled: props.disabled,
  }, props.children);
  const Input: any = (props: any) => React.createElement('input', {
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    style: props.style,
  });
  Input.Search = Input;
  const Select: any = Box;
  Select.Option = Box;
  const Checkbox: any = Box;
  Checkbox.Group = Box;
  const AntdApp: any = Box;
  AntdApp.useApp = () => ({
    message: {
      success: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    },
  });

  return {
    App: AntdApp,
    Card,
    Row: Box,
    Col: Box,
    Input,
    Select,
    Button,
    Space: Box,
    Typography: { Title: Box, Text: Box, Paragraph: Box },
    Tag: Box,
    Empty: Box,
    Skeleton: Box,
    Modal: () => null,
    Tooltip: ({ children }: any) => children,
    Switch: Box,
    Checkbox,
    Pagination: Box,
    message: {
      success: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    },
  };
});

jest.mock('@ant-design/icons', () => {
  const React = jest.requireActual('react');
  const Icon = (props: any) => React.createElement('span', props);
  const LaunchIcon = (props: any) => React.createElement('button', {
    ...props,
    'aria-label': 'launch-app',
  });

  return {
    SearchOutlined: Icon,
    PlayCircleOutlined: LaunchIcon,
    InfoCircleOutlined: Icon,
    ArrowLeftOutlined: Icon,
    LinkOutlined: Icon,
    SettingOutlined: Icon,
    FullscreenOutlined: Icon,
    FullscreenExitOutlined: Icon,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../services/marketService', () => ({
  marketService: {
    getApps: jest.fn(),
    getCategories: jest.fn(),
    launchApp: jest.fn(),
  },
  vncProxyService: {},
}));

jest.mock('../../../utils/iconMapper', () => ({
  getAppIcon: () => null,
  getCategoryIcon: () => null,
}));

jest.mock('./GISApp', () => ({ __esModule: true, default: () => null }));
jest.mock('./NextRPAApp', () => ({ __esModule: true, default: () => null }));
jest.mock('./OnlyOfficeApp', () => ({ __esModule: true, default: () => null }));
jest.mock('./VSCodeApp', () => ({ __esModule: true, default: () => null }));
jest.mock('react-vnc', () => ({ VncScreen: () => null }), { virtual: true });

const gisApp = {
  id: 'gis-mapping',
  name: 'GIS Mapping',
  enabled: true,
  launchable: true,
  scope: 'global',
  basic: {
    category: 'Geographic tools',
    description: 'Map annotations',
    tags: [],
    version: '1.0.0',
  },
  launch: { type: 'component' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (marketService.getApps as jest.Mock).mockResolvedValue({ apps: [gisApp] });
  (marketService.getCategories as jest.Mock).mockResolvedValue({ categories: [] });
  (marketService.launchApp as jest.Mock).mockResolvedValue({
    success: true,
    launch_config: { type: 'component' },
  });
});

test('gives a running app a bounded flex layout', async () => {
  render(<MarketPage />);
  await screen.findByText('GIS Mapping');
  fireEvent.click(screen.getByRole('button', { name: 'launch-app' }));

  await waitFor(() => {
    expect(marketService.launchApp).toHaveBeenCalledWith('gis-mapping');
  });

  const shell = await screen.findByTestId('market-running-app');
  const header = screen.getByTestId('market-running-app-header');
  const content = screen.getByTestId('market-running-app-content');

  expect(shell).toHaveStyle({
    height: 'calc(100dvh - 104px)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '0',
    overflow: 'hidden',
  });
  expect(header).toHaveStyle({ flexShrink: '0' });
  expect(content).toHaveStyle({
    flex: '1',
    minHeight: '0',
    overflow: 'auto',
  });
});
