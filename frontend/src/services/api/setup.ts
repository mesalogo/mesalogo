import api from './axios';

/**
 * 首启引导（Setup）相关 API
 *
 * 仅在系统未完成连接级配置时使用。后端 /api/setup/status 常驻，
 * 写接口（test-db / test-redis / save）仅在 Setup 模式下存在。
 */

export interface SetupDefaults {
  in_docker: boolean;
  db_type: string;
  db_host: string;
  db_port: string;
  db_name: string;
  db_user: string;
  redis_url: string;
}

export interface SetupStatus {
  setup_mode: boolean;
  defaults?: SetupDefaults;
}

export interface TestResult {
  success: boolean;
  error?: string;
}

export interface SetupPayload {
  database_uri: string;
  redis_url?: string;
  host?: string;
  port?: string;
}

export const setupAPI = {
  /** 探活：系统是否处于 Setup 模式 */
  getStatus: async (): Promise<SetupStatus> => {
    const res = await api.get('/setup/status');
    return res.data;
  },

  /** 测试数据库连接（不持久化） */
  testDb: async (database_uri: string): Promise<TestResult> => {
    try {
      const res = await api.post('/setup/test-db', { database_uri });
      return { success: !!res.data?.success };
    } catch (error: any) {
      return { success: false, error: error?.response?.data?.error || error?.message || '连接失败' };
    }
  },

  /** 测试 Redis 连接（不持久化） */
  testRedis: async (redis_url: string): Promise<TestResult> => {
    try {
      const res = await api.post('/setup/test-redis', { redis_url });
      return { success: !!res.data?.success };
    } catch (error: any) {
      return { success: false, error: error?.response?.data?.error || error?.message || '连接失败' };
    }
  },

  /** 保存配置并触发后端自重启 */
  save: async (payload: SetupPayload): Promise<TestResult> => {
    try {
      const res = await api.post('/setup/save', payload);
      return { success: !!res.data?.success };
    } catch (error: any) {
      return { success: false, error: error?.response?.data?.error || error?.message || '保存失败' };
    }
  },
};

export default setupAPI;
