import { useState, useEffect, useCallback } from 'react';
import { Button, App } from 'antd';
import { CloseOutlined, FullscreenOutlined } from '@ant-design/icons';
import i18n from '../../../locales';
import { marketService } from '../../../services/marketService';
import { getAppIconWithColor } from '../../../utils/appUtils';

/**
 * 应用Tab管理器
 * 负责管理动态应用tab的注册、加载和卸载
 */
class AppTabManager {
  enabledApps: any[];
  openApps: Map<any, any>;
  listeners: Set<any>;
  messageApi: any;
  actionSpaceId: any;
  taskId: any;

  constructor() {
    this.enabledApps = [];
    this.openApps = new Map(); // 使用Map存储打开的应用实例
    this.listeners = new Set(); // 状态变化监听器
    this.messageApi = null; // message API实例
    this.actionSpaceId = null; // 当前行动空间ID
    this.taskId = null; // 当前任务ID
  }

  // 设置message API
  setMessageApi(messageApi) {
    this.messageApi = messageApi;
  }

  // 添加状态变化监听器
  addListener(listener) {
    this.listeners.add(listener);
  }

  // 移除状态变化监听器
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  // 通知所有监听器状态变化
  notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // 加载启用的应用列表
  async loadEnabledApps(actionSpaceId = null, taskId = null) {
    try {
      // 如果传入了actionSpaceId，更新存储的ID
      if (actionSpaceId !== null) {
        this.actionSpaceId = actionSpaceId;
      }
      // 如果传入了taskId，更新存储的ID
      if (taskId !== null) {
        this.taskId = taskId;
      }

      let response;

      if (!this.actionSpaceId) {
        // 如果行动空间ID不存在，静默返回空数组，不显示错误信息
        // 这通常发生在组件初始化时，任务数据还未加载完成
        console.log('AppTabManager: action space ID missing, waiting for task data to load...');
        this.enabledApps = [];
        this.notifyListeners();
        return [];
      }

      console.log('AppTabManager: loading apps bound to action space, space_id:', this.actionSpaceId);
      // 严格按照行动空间绑定关系获取应用
      response = await marketService.getActionSpaceApps(this.actionSpaceId);
      console.log('AppTabManager: bound apps received:', response);

      this.enabledApps = response.apps || [];
      this.notifyListeners();
      return this.enabledApps;
    } catch (error) {
      console.error('Failed to load enabled apps:', error);
      if (this.messageApi) {
        this.messageApi.error(i18n.t('appTab.loadAppsFailed'));
      }
      return [];
    }
  }

  // 获取启用的应用列表
  getEnabledApps() {
    return this.enabledApps;
  }

  // 启动应用
  async launchApp(app) {
    try {
      const response = await marketService.launchApp(app.id);

      if (response.success) {
        const launchConfig = response.launch_config;

        if (launchConfig.type === 'tab' && launchConfig.url) {
          // 特殊处理 VSCode 应用
          if (app.id === 'vscode-server') {
            const vscodeUrl = `http://localhost:11443/?folder=/config/workspace/ActionTask-${this.taskId}`;
            window.open(vscodeUrl, '_blank');
            if (this.messageApi) {
              this.messageApi.success(i18n.t('appTab.launchedInNewTab', { name: app.name }));
            }
          } else {
            // 其他应用使用原有逻辑
            window.open(launchConfig.url, '_blank');
            if (this.messageApi) {
              this.messageApi.success(i18n.t('appTab.launchedInNewTab', { name: app.name }));
            }
          }
        } else if (launchConfig.type === 'iframe' || launchConfig.type === 'component') {
          // 对于iframe和组件类型，添加到打开的应用列表
          const appInstance = {
            ...app,
            tabKey: `app-${app.id}`,
            launchConfig,
            launchedAt: Date.now()
          };

          this.openApps.set(app.id, appInstance);
          this.notifyListeners();
          if (this.messageApi) {
            this.messageApi.success(i18n.t('appTab.launched', { name: app.name }));
          }
          return appInstance;
        } else {
          if (this.messageApi) {
            this.messageApi.warning(i18n.t('appTab.configError'));
          }
        }
      }
    } catch (error) {
      console.error('Failed to launch app:', error);
      if (this.messageApi) {
        this.messageApi.error(i18n.t('appTab.launchFailed'));
      }
    }
    return null;
  }

  // 关闭应用
  closeApp(appId, onClosed) {
    const app = this.openApps.get(appId);
    if (app) {
      this.openApps.delete(appId);
      this.notifyListeners();
      if (this.messageApi) {
        this.messageApi.success(i18n.t('appTab.closed', { name: app.name }));
      }

      // 调用关闭回调
      if (onClosed) {
        onClosed(appId);
      }

      return true;
    }
    return false;
  }

  // 获取打开的应用列表
  getOpenApps() {
    return Array.from(this.openApps.values());
  }

  // 检查应用是否已打开
  isAppOpen(appId) {
    return this.openApps.has(appId);
  }

  // 获取特定的打开应用
  getOpenApp(appId) {
    return this.openApps.get(appId);
  }

  // 生成应用tab配置
  generateAppTabItems(onCloseApp, onFullscreenApp) {
    const openApps = this.getOpenApps();

    return openApps.map(app => {
      const { icon: appIcon } = getAppIconWithColor(app, '16px');

      return {
        key: app.tabKey,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {appIcon}
            <span>{app.name}</span>
            <Button
              type="text"
             
              icon={<FullscreenOutlined />}
              style={{
                marginLeft: '4px',
                padding: '0 4px',
                height: '16px',
                width: '16px',
                fontSize: '10px'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onFullscreenApp) {
                  onFullscreenApp(app);
                }
              }}
              title={i18n.t('appTab.fullscreen')}
            />
            <Button
              type="text"
             
              icon={<CloseOutlined />}
              style={{
                marginLeft: '2px',
                padding: '0 4px',
                height: '16px',
                width: '16px',
                fontSize: '10px'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onCloseApp) {
                  onCloseApp(app.id);
                }
              }}
              title={i18n.t('appTab.closeApp')}
            />
          </span>
        ),
        app: app // 保存应用信息以便渲染内容
      };
    });
  }

  // 清理所有打开的应用
  clearAllApps() {
    this.openApps.clear();
    this.notifyListeners();
  }
}

// 创建全局单例实例
const appTabManager = new AppTabManager();

/**
 * React Hook for using AppTabManager
 */
export const useAppTabManager = (onAppClosed, onAppFullscreen, actionSpaceId = null, taskId = null) => {
  const [, forceUpdate] = useState({});
  const { message } = App.useApp();

  // 强制组件重新渲染
  const refresh = useCallback(() => {
    forceUpdate({});
  }, []);

  useEffect(() => {
    // 设置message API
    appTabManager.setMessageApi(message);

    // 添加监听器
    appTabManager.addListener(refresh);

    // 初始加载应用列表，传入行动空间ID和任务ID
    appTabManager.loadEnabledApps(actionSpaceId, taskId);

    // 清理函数
    return () => {
      appTabManager.removeListener(refresh);
    };
  }, [refresh, message, actionSpaceId, taskId]);

  const closeApp = (appId) => {
    return appTabManager.closeApp(appId, onAppClosed);
  };

  const generateAppTabItems = () => {
    return appTabManager.generateAppTabItems(closeApp, onAppFullscreen);
  };

  return {
    enabledApps: appTabManager.getEnabledApps(),
    openApps: appTabManager.getOpenApps(),
    launchApp: appTabManager.launchApp.bind(appTabManager),
    closeApp,
    isAppOpen: appTabManager.isAppOpen.bind(appTabManager),
    getOpenApp: appTabManager.getOpenApp.bind(appTabManager),
    generateAppTabItems,
    loadEnabledApps: appTabManager.loadEnabledApps.bind(appTabManager),
    clearAllApps: appTabManager.clearAllApps.bind(appTabManager)
  };
};

export default appTabManager;
