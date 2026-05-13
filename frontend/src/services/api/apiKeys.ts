import api from './axios';

const apiKeysAPI = {
  async getKeys() {
    const response = await api.get('/openai-export/api-keys');
    return response.data;
  },

  async createKey(name: string) {
    const response = await api.post('/openai-export/api-keys', { name });
    return response.data;
  },

  async deleteKey(id: string) {
    const response = await api.delete(`/openai-export/api-keys/${id}`);
    return response.data;
  },
};

export default apiKeysAPI;
