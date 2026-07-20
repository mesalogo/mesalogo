import { actionTaskDetailPath } from './routes';

test('Parallel Lab links a run to the registered task-detail route', () => {
  expect(actionTaskDetailPath('task/with spaces')).toBe(
    '/action-tasks/detail/task%2Fwith%20spaces'
  );
});
