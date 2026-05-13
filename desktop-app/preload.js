const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // OAuth 协议回调监听
  onOAuthProtocolCallback: (callback) => {
    ipcRenderer.on('oauth-protocol-callback', (event, data) => callback(data));
  },
  removeOAuthProtocolCallback: () => {
    ipcRenderer.removeAllListeners('oauth-protocol-callback');
  },
  // 网络状态监听
  getNetworkStatus: () => ipcRenderer.invoke('get-network-status'),
  onNetworkStatus: (callback) => {
    ipcRenderer.on('network-status', (event, data) => callback(data));
  },
  removeNetworkStatusListener: () => {
    ipcRenderer.removeAllListeners('network-status');
  },
  // 更新状态监听
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  removeUpdateStatusListener: () => {
    ipcRenderer.removeAllListeners('update-status');
  },
  // 重启安装更新
  restartToUpdate: () => ipcRenderer.invoke('restart-to-update')
});
