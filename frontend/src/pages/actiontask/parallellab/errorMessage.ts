export const getParallelExperimentError = (
  error: any,
  fallback: string
): string => {
  const data = error?.response?.data;
  const detail = data?.detail;

  if (typeof detail === 'string') return detail;
  if (typeof detail?.error === 'string') return detail.error;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
};
