export const actionTaskDetailPath = (taskId: string | number): string =>
  `/action-tasks/detail/${encodeURIComponent(String(taskId))}`;
