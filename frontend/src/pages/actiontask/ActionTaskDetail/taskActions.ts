export const archiveTask = async (
  taskId: string,
  updateStatus: (id: string, status: string) => Promise<any>
) => updateStatus(taskId, 'terminated');
