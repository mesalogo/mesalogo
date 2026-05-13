import api from './axios';

export interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  email: string;
  avatar_url: string;
  created_at: string;
}

// 检测是否在 Electron 桌面应用中运行
const isElectron = (): boolean => {
  return !!(window as any).electronAPI;
};

export const oauthAPI = {
  /**
   * 获取可用的 OAuth 提供商列表
   */
  getProviders: async (): Promise<OAuthProvider[]> => {
    try {
      const response = await api.get('/oauth/providers');
      return response.data.providers || [];
    } catch (error) {
      console.error('获取OAuth提供商列表失败:', error);
      return [];
    }
  },

  /**
   * 获取 OAuth 授权 URL
   * Web 应用：使用当前页面的 origin 作为回调地址
   * 桌面应用：使用后端回调地址，后端处理后重定向到 mesalogo://
   */
  getAuthorizationUrl: async (provider: string): Promise<string | null> => {
    try {
      const params: Record<string, string> = {};
      
      if (isElectron()) {
        // 桌面应用：标记为桌面请求，后端会使用配置的 OAUTH_DESKTOP_REDIRECT_URI
        params.is_desktop = 'true';
      } else {
        // Web 应用：使用当前页面的 origin 作为回调地址
        params.redirect_uri = `${window.location.origin}/oauth/callback`;
      }
      
      const response = await api.get(`/oauth/${provider}/authorize`, { params });
      return response.data.auth_url;
    } catch (error) {
      console.error('获取OAuth授权URL失败:', error);
      return null;
    }
  },

  /**
   * 处理 OAuth 回调
   */
  handleCallback: async (provider: string, code: string, state: string) => {
    try {
      const response = await api.post(`/oauth/${provider}/callback`, {
        code,
        state
      });
      return response.data;
    } catch (error: any) {
      console.error('OAuth回调处理失败:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'OAuth认证失败'
      };
    }
  },

  /**
   * 获取已绑定的 OAuth 账户
   */
  getLinkedAccounts: async (): Promise<OAuthAccount[]> => {
    try {
      const response = await api.get('/oauth/accounts');
      return response.data.accounts || [];
    } catch (error) {
      console.error('获取已绑定OAuth账户失败:', error);
      return [];
    }
  },

  /**
   * 解绑 OAuth 账户
   */
  unlinkAccount: async (provider: string) => {
    try {
      const response = await api.delete(`/oauth/${provider}/unlink`);
      return {
        success: response.data.status === 'success',
        message: response.data.message
      };
    } catch (error: any) {
      console.error('解绑OAuth账户失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '解绑失败'
      };
    }
  }
};

export default oauthAPI;
