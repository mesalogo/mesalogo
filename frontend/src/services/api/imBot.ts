import api from './axios';

export interface IMBotConfig {
  id: string;
  name: string;
  platform: string;
  credentials?: Record<string, string>;
  agent_id: string | null;
  agent_name: string | null;
  user_id: string;
  config: Record<string, any>;
  is_active: boolean;
  webhook_registered: boolean;
  created_at: string;
  updated_at: string;
}

const imBotAPI = {
  async list() {
    const response = await api.get('/im-bots');
    return response.data;
  },

  async get(id: string) {
    const response = await api.get(`/im-bots/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    platform: string;
    credentials: Record<string, string>;
    agent_id?: string;
    config?: Record<string, any>;
  }) {
    const response = await api.post('/im-bots', data);
    return response.data;
  },

  async update(id: string, data: Partial<{
    name: string;
    credentials: Record<string, string>;
    agent_id: string | null;
    config: Record<string, any>;
    is_active: boolean;
  }>) {
    const response = await api.put(`/im-bots/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await api.delete(`/im-bots/${id}`);
    return response.data;
  },

  async test(id: string) {
    const response = await api.post(`/im-bots/${id}/test`);
    return response.data;
  },

  async registerWebhook(id: string) {
    const response = await api.post(`/im-bots/${id}/register-webhook`);
    return response.data;
  },
};

export default imBotAPI;
