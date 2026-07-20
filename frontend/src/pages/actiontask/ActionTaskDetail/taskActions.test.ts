import { archiveTask } from './taskActions';

test('archiving a task persists the terminated status before updating the UI', async () => {
  const updateStatus = jest.fn().mockResolvedValue({ status: 'terminated' });

  const result = await archiveTask('task-9', updateStatus);

  expect(updateStatus).toHaveBeenCalledWith('task-9', 'terminated');
  expect(result).toEqual({ status: 'terminated' });
});
