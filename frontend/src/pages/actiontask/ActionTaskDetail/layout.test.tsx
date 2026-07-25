import { fireEvent, render, screen } from '@testing-library/react';
import { useTaskWindow } from '../../../components/TaskWindowManager';
import { actionTaskAPI } from '../../../services/api/actionTask';
import { useAppTabManager } from '../components/AppTabManager';
import ActionTaskDetail from './index';
import LoadingSkeleton from './components/LoadingSkeleton';
import useTaskData from './hooks/useTaskData';
import useVariablesRefresh from './hooks/useVariablesRefresh';

jest.mock(
  'react-router-dom',
  () => ({
    useNavigate: () => jest.fn(),
    useParams: () => ({ taskId: 'task-1' }),
  }),
  { virtual: true }
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../components/TaskWindowManager', () => ({
  useTaskWindow: jest.fn(),
}));

jest.mock('./hooks/useTaskData', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./hooks/useVariablesRefresh', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../components/AppTabManager', () => ({
  useAppTabManager: jest.fn(),
}));

jest.mock('../components/ActionTaskConversation', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/AppRenderer', () => ({
  __esModule: true,
  default: () => 'embedded app',
}));

jest.mock('../components/ExportModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/PublishModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./components/tabs/InfoTab', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./components/tabs/MonitorTab', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./components/tabs/SimpleTabs', () => ({
  MemoryTab: () => null,
  AuditTab: () => null,
  AppsTab: () => null,
}));

jest.mock('../../../services/api/actionTask', () => ({
  actionTaskAPI: {
    getAll: jest.fn(() => new Promise(() => undefined)),
  },
}));

jest.mock('@ant-design/icons', () =>
  new Proxy(
    { __esModule: true },
    {
      get: (target, property) =>
        property in target ? target[property as keyof typeof target] : () => null,
    }
  )
);

jest.mock('antd', () => {
  const React = jest.requireActual('react');

  const Element: any = ({ children, style, className }: any) =>
    React.createElement('div', { className, style }, children);
  const Text: any = ({ children, style }: any) =>
    React.createElement('span', { style }, children);
  const Button: any = ({ children, disabled, onClick, style }: any) =>
    React.createElement('button', { disabled, onClick, style }, children);
  const Space = Element;
  Space.Compact = Element;
  const Card: any = ({ children, style, styles }: any) =>
    React.createElement(
      'section',
      { 'data-testid': 'mock-card', className: 'ant-card', style },
      React.createElement(
        'div',
        {
          'data-testid': 'mock-card-body',
          className: 'ant-card-body',
          style: styles?.body,
        },
        children
      )
    );
  const Tabs: any = ({ items = [], onChange, style }: any) =>
    React.createElement(
      'div',
      { style },
      items.map((item: any) =>
        React.createElement(
          'button',
          { key: item.key, onClick: () => onChange(item.key) },
          item.label
        )
      )
    );
  const Row: any = ({ children, style }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'mock-row', className: 'ant-row', style },
      children
    );
  const Skeleton = Element;
  Skeleton.Input = Element;
  Skeleton.Button = Element;

  const Splitter: any = ({ children, className, style }: any) =>
    React.createElement('div', { className, style }, children);

  Splitter.Panel = ({ children, style }: any) =>
    React.createElement('div', { 'data-testid': 'splitter-panel', style }, children);

  return {
    Badge: ({ text }: any) => React.createElement('span', null, text),
    Button,
    Card,
    Col: Element,
    Dropdown: Element,
    Result: Element,
    Row,
    Skeleton,
    Space,
    Splitter,
    Tabs,
    Tag: Element,
    Typography: { Text, Title: Text },
    message: { error: jest.fn(), success: jest.fn() },
  };
});

const mockUseTaskWindow = useTaskWindow as jest.Mock;
const mockUseTaskData = useTaskData as jest.Mock;
const mockUseVariablesRefresh = useVariablesRefresh as jest.Mock;
const mockUseAppTabManager = useAppTabManager as jest.Mock;
const mockGetAllTasks = actionTaskAPI.getAll as jest.Mock;

const expectViewportFlexShell = (shell: HTMLElement) => {
  expect(shell.style.height).toBe('calc(100dvh - 104px)');
  expect(shell.style.minHeight).toBe('0');
  expect(shell.style.display).toBe('flex');
  expect(shell.style.flexDirection).toBe('column');

  const header = screen.getByTestId('action-task-detail-header');
  expect(header.style.flexShrink).toBe('0');

  const card = screen.getAllByTestId('mock-card')[0];
  const cardBody = screen.getAllByTestId('mock-card-body')[0];

  expect(card).toHaveStyle({
    display: 'flex',
    flex: '1',
    flexDirection: 'column',
    minHeight: '0',
    overflow: 'hidden',
  });
  expect(cardBody).toHaveStyle({
    flex: '1',
    minHeight: '0',
    overflow: 'hidden',
  });
};

beforeEach(() => {
  mockGetAllTasks.mockImplementation(() => new Promise(() => undefined));
  mockUseTaskWindow.mockReturnValue({
    windows: new Map(),
    activeTaskId: 'task-1',
    updateTaskInfo: jest.fn(),
  });
  mockUseTaskData.mockReturnValue({
    task: {
      id: 'task-1',
      title: 'Layout task',
      status: 'active',
      action_space_id: 'space-1',
      action_space: { name: 'Layout space' },
    },
    messages: [],
    loading: false,
    loadError: null,
    refreshKey: 0,
    activeConversationId: null,
    setTask: jest.fn(),
    setMessages: jest.fn(),
    setRefreshKey: jest.fn(),
    fetchTaskData: jest.fn(),
  });
  mockUseVariablesRefresh.mockReturnValue({
    variablesRefreshKey: 0,
    refreshVariables: jest.fn(),
  });
  mockUseAppTabManager.mockReturnValue({
    generateAppTabItems: () => [{ key: 'app-gis', label: 'GIS' }],
    getOpenApp: () => ({ id: 'gis-mapping', name: 'GIS' }),
  });
});

test('loaded task detail keeps viewport sizing on the outer flex shell', () => {
  render(<ActionTaskDetail taskIdProp="task-1" />);
  const shell = screen.getByTestId('action-task-detail-shell');

  expectViewportFlexShell(shell);

  const splitterContainer = screen.getByTestId('task-detail-splitter-container');
  expect(splitterContainer.style.height).toBe('100%');
  expect(splitterContainer.style.minHeight).toBe('0');
});

test('loading skeleton mirrors the loaded task detail flex shell', () => {
  render(
    <LoadingSkeleton
      onBack={jest.fn()}
      onExport={jest.fn()}
      t={(key: string) => key}
      customStyles=""
      variableFlashStyle=""
    />
  );
  const shell = screen.getByTestId('action-task-detail-shell');

  expectViewportFlexShell(shell);

  const row = screen.getByTestId('mock-row');
  expect(row.style.height).toBe('100%');
  expect(row.style.minHeight).toBe('0');
});

test('embedded app uses the remaining panel height without another viewport calculation', () => {
  render(<ActionTaskDetail taskIdProp="task-1" />);

  fireEvent.click(screen.getByText('GIS'));

  const appContainer = screen.getByText('embedded app');
  expect(appContainer.style.height).toBe('');
  expect(appContainer).toHaveStyle({
    flex: '1',
    minHeight: '0',
    overflow: 'hidden',
  });

  const panelContent = screen.getByTestId('task-sidebar-content');
  const panel = screen.getAllByTestId('splitter-panel')[1];
  expect(panelContent).toHaveStyle({ minHeight: '0', overflow: 'hidden' });
  expect(panel).toHaveStyle({ minHeight: '0', overflowY: 'hidden' });
});
