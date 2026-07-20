import api from './axios';
import { actionTaskAPI } from './actionTask';

jest.mock('./axios', () => ({
  __esModule: true,
  default: {
    put: jest.fn(),
  },
}));

test('updateStatus uses the registered action-task update endpoint', async () => {
  (api.put as jest.Mock).mockResolvedValue({
    data: { id: 'task-1', status: 'terminated' },
  });

  const result = await actionTaskAPI.updateStatus('task-1', 'terminated');

  expect(api.put).toHaveBeenCalledWith(
    '/action-tasks/task-1',
    { status: 'terminated' }
  );
  expect(result.status).toBe('terminated');
});
