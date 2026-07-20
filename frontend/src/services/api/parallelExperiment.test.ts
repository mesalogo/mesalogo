import request from './axios';
import { listAllExperiments } from './parallelExperiment';

jest.mock('./axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

test('listAllExperiments loads every server page', async () => {
  (request.get as jest.Mock)
    .mockResolvedValueOnce({
      data: {
        success: true,
        experiments: [{ id: 'experiment-1' }],
        total: 3,
        page: 1,
        limit: 2,
        total_pages: 2,
      },
    })
    .mockResolvedValueOnce({
      data: {
        success: true,
        experiments: [
          { id: 'experiment-2' },
          { id: 'experiment-3' },
        ],
        total: 3,
        page: 2,
        limit: 2,
        total_pages: 2,
      },
    });

  const response = await listAllExperiments({
    include_templates: false,
    limit: 2,
  });

  expect(request.get).toHaveBeenNthCalledWith(1, '/parallel-experiments', {
    params: { include_templates: false, limit: 2, page: 1 },
  });
  expect(request.get).toHaveBeenNthCalledWith(2, '/parallel-experiments', {
    params: { include_templates: false, limit: 2, page: 2 },
  });
  expect(response.experiments.map(experiment => experiment.id)).toEqual([
    'experiment-1',
    'experiment-2',
    'experiment-3',
  ]);
});
