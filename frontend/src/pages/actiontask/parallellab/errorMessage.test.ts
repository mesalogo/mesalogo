import { getParallelExperimentError } from './errorMessage';

test('extracts FastAPI nested detail errors', () => {
  const error = {
    response: {
      data: {
        detail: {
          error: 'Experiment cannot be paused',
        },
      },
    },
  };

  expect(getParallelExperimentError(error, 'Fallback')).toBe(
    'Experiment cannot be paused'
  );
});

test('uses a localized fallback when the response has no useful detail', () => {
  expect(getParallelExperimentError({}, 'Fallback')).toBe('Fallback');
});
