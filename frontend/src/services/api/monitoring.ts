import api from './axios';

export const monitoringAPI = {
  getDashboard: () => api.get('/monitoring/dashboard').then(r => r.data),

  getRuleLogs: (params: Record<string, any> = {}) =>
    api.get('/monitoring/rule-logs', { params }).then(r => r.data),

  exportRuleLogs: async (params: Record<string, any> = {}) => {
    const response = await api.get('/monitoring/rule-logs/export', { params, responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8-sig' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rule_logs_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  getActionSpaces: () => api.get('/monitoring/action-spaces').then(r => r.data),
};

export default monitoringAPI;
