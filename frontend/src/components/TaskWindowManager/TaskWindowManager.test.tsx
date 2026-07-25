import { configure, fireEvent, render, screen } from '@testing-library/react';
import TaskWindowManager, { useTaskWindow } from './TaskWindowManager';

let mockCurrentPath = '/action-tasks/overview';
const mockNavigate = jest.fn((path: string) => {
  mockCurrentPath = path;
});

jest.mock(
  'react-router-dom',
  () => ({
    useLocation: () => ({ pathname: mockCurrentPath }),
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

const Overview = () => {
  const { openTaskWindow } = useTaskWindow();
  return (
    <div>
      <button onClick={() => openTaskWindow('task-2')}>open task</button>
    </div>
  );
};

const renderManager = (initialPath = '/action-tasks/overview') => {
  mockCurrentPath = initialPath;
  mockNavigate.mockClear();
  return render(
    <TaskWindowManager
      renderTaskDetail={(taskId) => <div data-testid={`detail-${taskId}`} />}
    >
      <Overview />
    </TaskWindowManager>
  );
};

test('opening a task keeps React Router and the visible task in sync', async () => {
  renderManager();

  fireEvent.click(screen.getByRole('button', { name: 'open task' }));

  expect(await screen.findByTestId('detail-task-2')).toBeInTheDocument();
  expect(mockNavigate).toHaveBeenCalledWith('/action-tasks/detail/task-2');
});

test('a direct task-detail URL creates and renders its task window', async () => {
  renderManager('/action-tasks/detail/task-7');

  expect(await screen.findByTestId('detail-task-7')).toBeInTheDocument();
});

test('a task window keeps its natural height inside the page layout', async () => {
  renderManager('/action-tasks/detail/task-7');

  await screen.findByTestId('detail-task-7');
  configure({ testIdAttribute: 'data-task-window' });

  try {
    expect(screen.getByTestId('task-7').style.height).toBe('');
  } finally {
    configure({ testIdAttribute: 'data-testid' });
  }
});
