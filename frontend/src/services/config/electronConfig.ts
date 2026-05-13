/**
 * Electron 桌面应用配置初始化
 * 在 Electron 环境中从 config.json 获取后端 URL
 */

interface ElectronAPI {
  getConfig: () => Promise<{
    backend: {
      url: string;
      wsUrl?: string;
    };
  }>;
  getVersion: () => Promise<string>;
  platform: string;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

let cachedConfig: { apiUrl: string; wsUrl?: string } | null = null;

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

export async function initElectronConfig(): Promise<void> {
  if (!isElectron()) {
    return;
  }

  try {
    const config = await window.electronAPI!.getConfig();
    if (config?.backend?.url) {
      cachedConfig = {
        apiUrl: config.backend.url,
        wsUrl: config.backend.wsUrl,
      };
      console.log('[Electron] 已加载后端配置:', cachedConfig.apiUrl);
      
      // 动态更新 axios baseURL
      const { updateAxiosBaseURL } = await import('../api/axios');
      updateAxiosBaseURL();
    }
  } catch (error) {
    console.error('[Electron] 加载配置失败:', error);
  }
}

export function getElectronApiUrl(): string | null {
  return cachedConfig?.apiUrl || null;
}

export function getElectronWsUrl(): string | null {
  return cachedConfig?.wsUrl || null;
}
