/**
 * 后台任务管理 API
 */

import axios from './axios';

const jobsAPI = {
  submitJob: async (jobType, params, priority = 'medium') => {
    const response = await axios.post('/jobs', {
      job_type: jobType,
      params,
      priority
    });
    return response.data;
  },

  getJobStatus: async (jobId) => {
    const response = await axios.get(`/jobs/${jobId}`);
    return response.data;
  },

  cancelJob: async (jobId) => {
    const response = await axios.post(`/jobs/${jobId}/cancel`);
    return response.data;
  },

  listJobs: async (filters = {}) => {
    const response = await axios.get('/jobs', { params: filters });
    return response.data;
  },

  getStats: async () => {
    const response = await axios.get('/jobs/stats');
    return response.data;
  }
};

export default jobsAPI;
