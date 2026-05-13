const { app, BrowserWindow, BrowserView, ipcMain, shell, net, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');

// 忽略 SSL 证书验证错误
app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow = null;
let statusBarView = null;
let localServer = null;
let localServerPort = null;
let networkMonitorInterval = null;
let statusBarEnabled = true;
let isCheckingUpdate = false;

const PROTOCOL_NAME = 'mesalogo';
const UPDATE_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 每周检查一次
const LAST_UPDATE_CHECK_KEY = 'lastUpdateCheck';
const STATUS_BAR_HEIGHT = 24;

// 加载配置文件
function loadConfig() {
  const configPath = path.join(app.getAppPath(), 'config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    console.log('Config loaded from:', configPath);
    return config;
  } catch (error) {
    console.error('Failed to load config from:', configPath, error.message);
    return { backend: { url: 'http://localhost:8000' } };
  }
}

// 注册自定义协议
function registerProtocol() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME);
  }
}

// 处理自定义协议 URL
function handleProtocolUrl(url) {
  console.log('Received protocol URL:', url);
  if (!url || !url.startsWith(`${PROTOCOL_NAME}://`)) return;
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname || urlObj.hostname;
    
    if (pathname === 'oauth/callback' || pathname === '/oauth/callback' || urlObj.hostname === 'oauth') {
      const token = urlObj.searchParams.get('token');
      const error = urlObj.searchParams.get('error');
      const isNewUser = urlObj.searchParams.get('is_new_user');
      
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        // 发送到 mainView 的 webContents，因为主内容加载在 BrowserView 中
        const targetWebContents = mainWindow.mainView?.webContents || mainWindow.webContents;
        targetWebContents.send('oauth-protocol-callback', {
          token, error, isNewUser: isNewUser === 'true'
        });
      }
    }
  } catch (err) {
    console.error('Failed to parse protocol URL:', err);
  }
}

// 启动本地 HTTP 服务器
function startLocalServer() {
  return new Promise((resolve, reject) => {
    const server = express();
    const distPath = path.join(__dirname, 'dist');
    
    server.use(express.static(distPath));
    
    server.get('/oauth/callback', (req, res) => {
      const { code, state, error } = req.query;
      console.log('OAuth callback received:', { code: code ? 'yes' : 'no', state: state ? 'yes' : 'no', error });
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>OAuth 登录中...</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .spinner { width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #1890ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <p>正在完成登录，请稍候...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'oauth-callback', code: '${code || ''}', state: '${state || ''}', error: '${error || ''}' }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              window.location.href = '/?oauth_code=${code || ''}&oauth_state=${state || ''}&oauth_error=${error || ''}';
            }
          </script>
        </body>
        </html>
      `);
    });
    
    server.use((req, res, next) => {
      if (req.path.match(/\.(js|css|map|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/)) {
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
    
    localServer = server.listen(0, '127.0.0.1', () => {
      localServerPort = localServer.address().port;
      console.log(`Local server started on http://127.0.0.1:${localServerPort}`);
      resolve(localServerPort);
    });
    
    localServer.on('error', reject);
  });
}

async function createWindow() {
  await startLocalServer();
  const config = loadConfig();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MesaLogo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 使用 BrowserView 加载主内容，便于与状态栏共存
  const mainView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  mainWindow.setBrowserView(mainView);
  mainWindow.mainView = mainView;
  
  updateMainViewBounds();
  mainView.webContents.loadURL(`http://127.0.0.1:${localServerPort}`);

  // 默认创建状态栏
  if (statusBarEnabled) {
    createStatusBar(config);
  }

  mainView.webContents.on('before-input-event', (event, input) => {
    if ((input.meta && input.alt && input.key === 'i') || input.key === 'F12') {
      mainView.webContents.toggleDevTools();
    }
  });

  mainWindow.on('resize', () => {
    updateMainViewBounds();
    if (statusBarEnabled) updateStatusBarBounds();
  });

  mainWindow.on('closed', () => { mainWindow = null; statusBarView = null; });
}

// 更新主内容区域位置
function updateMainViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.mainView) return;
  const [width, height] = mainWindow.getContentSize();
  const statusBarHeight = statusBarEnabled ? STATUS_BAR_HEIGHT : 0;
  mainWindow.mainView.setBounds({ x: 0, y: 0, width: width, height: height - statusBarHeight });
}

// 更新状态栏位置
function updateStatusBarBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !statusBarView) return;
  const [width, height] = mainWindow.getContentSize();
  statusBarView.setBounds({ x: 0, y: height - STATUS_BAR_HEIGHT, width: width, height: STATUS_BAR_HEIGHT });
}

// 创建状态栏 BrowserView
function createStatusBar(config) {
  if (statusBarView) return;
  
  const version = app.getVersion();
  const backendUrl = config.backend?.url || 'http://localhost:8000';
  
  statusBarView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  
  mainWindow.addBrowserView(statusBarView);
  updateStatusBarBounds();
  
  const statusBarHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          height: ${STATUS_BAR_HEIGHT}px;
          background: linear-gradient(to bottom, #2d2d2d, #252525);
          border-top: 1px solid #3d3d3d;
          display: flex; align-items: center; padding: 0 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
          font-size: 12px; color: #a0a0a0; user-select: none; gap: 16px;
          overflow: hidden;
        }
        .status-item { display: flex; align-items: center; gap: 6px; }
        .status-connection { min-width: 90px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #666; transition: background 0.3s; }
        .status-dot.online { background: #4caf50; box-shadow: 0 0 4px #4caf50; }
        .status-dot.offline { background: #f44336; box-shadow: 0 0 4px #f44336; }
        .status-label { color: #707070; }
        .status-version { margin-left: auto; color: #606060; }
        #status-backend { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: help; }
        .status-update { color: #1890ff; cursor: pointer; margin-left: 8px; }
        .status-update:hover { color: #40a9ff; }
      </style>
    </head>
    <body>
      <div class="status-item status-connection">
        <span class="status-dot" id="status-dot"></span>
        <span id="status-text">Connecting...</span>
      </div>
      <div class="status-item">
        <span class="status-label">Latency:</span>
        <span id="status-latency">--</span>
      </div>
      <div class="status-item">
        <span class="status-label">Backend:</span>
        <span id="status-backend" title="${backendUrl}">${new URL(backendUrl).host}</span>
      </div>
      <div class="status-item status-version">v${version}</div>
      <div class="status-item status-update" id="status-update-container" style="display: none;">
        <span id="status-update-text"></span>
      </div>
      <script>
        let updateDownloadUrl = '';
        if (window.electronAPI && window.electronAPI.onNetworkStatus) {
          window.electronAPI.onNetworkStatus((data) => {
            const dot = document.getElementById('status-dot');
            const text = document.getElementById('status-text');
            const latency = document.getElementById('status-latency');
            if (data.online) {
              dot.className = 'status-dot online';
              text.textContent = 'Connected';
              latency.textContent = data.latency + 'ms';
              latency.style.color = data.latency < 100 ? '#4caf50' : data.latency < 300 ? '#ff9800' : '#f44336';
            } else {
              dot.className = 'status-dot offline';
              text.textContent = 'Offline';
              latency.textContent = '--';
              latency.style.color = '#a0a0a0';
            }
          });
        }
        if (window.electronAPI && window.electronAPI.onUpdateStatus) {
          window.electronAPI.onUpdateStatus((data) => {
            const container = document.getElementById('status-update-container');
            const text = document.getElementById('status-update-text');
            if (!container) return;
            if (data.type === 'available') {
              container.style.display = 'flex';
              text.textContent = '新版本 ' + data.version;
              updateDownloadUrl = data.downloadUrl || '';
              container.onclick = () => {
                if (updateDownloadUrl && window.electronAPI.openExternal) {
                  window.electronAPI.openExternal(updateDownloadUrl);
                }
              };
            } else if (data.type === 'none') {
              container.style.display = 'none';
            }
          });
        }
      </script>
    </body>
    </html>
  `;
  
  statusBarView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(statusBarHtml));
}

// 移除状态栏 BrowserView
function removeStatusBarView() {
  if (mainWindow && !mainWindow.isDestroyed() && statusBarView) {
    mainWindow.removeBrowserView(statusBarView);
    statusBarView = null;
  }
}

// 切换状态栏显示
function toggleStatusBar(enabled, config) {
  statusBarEnabled = enabled;
  if (enabled) {
    createStatusBar(config);
  } else {
    removeStatusBarView();
  }
  updateMainViewBounds();
}

// 单实例锁定
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const protocolUrl = commandLine.find(arg => arg.startsWith(`${PROTOCOL_NAME}://`));
    if (protocolUrl) handleProtocolUrl(protocolUrl);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

registerProtocol();

// 网络状态监控
function measureLatency() {
  const config = loadConfig();
  const backendUrl = config.backend?.url || 'http://localhost:8000';
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const request = net.request({ method: 'GET', url: `${backendUrl}/health`, session: null });
    
    request.on('response', (response) => {
      resolve({ online: true, latency: Date.now() - startTime, statusCode: response.statusCode });
    });
    request.on('error', (error) => {
      resolve({ online: false, latency: null, error: error.message });
    });
    
    setTimeout(() => { request.abort(); resolve({ online: false, latency: null, error: 'timeout' }); }, 5000);
    request.end();
  });
}

function startNetworkMonitor() {
  const sendStatus = async () => {
    const status = await measureLatency();
    const config = loadConfig();
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.mainView) {
      mainWindow.mainView.webContents.send('network-status', { ...status, backendUrl: config.backend?.url, timestamp: Date.now() });
    }
    // 同时发送到状态栏 BrowserView
    if (statusBarView && !statusBarView.webContents.isDestroyed()) {
      statusBarView.webContents.send('network-status', { ...status, backendUrl: config.backend?.url, timestamp: Date.now() });
    }
  };
  sendStatus();
  networkMonitorInterval = setInterval(sendStatus, 5000);
}

function stopNetworkMonitor() {
  if (networkMonitorInterval) {
    clearInterval(networkMonitorInterval);
    networkMonitorInterval = null;
  }
}

// IPC 处理
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('open-external', (event, url) => shell.openExternal(url));
ipcMain.handle('get-network-status', async () => await measureLatency());

// ==================== 更新检查功能 ====================

// 发送更新状态到状态栏
function sendUpdateStatus(data) {
  if (statusBarView && !statusBarView.webContents.isDestroyed()) {
    statusBarView.webContents.send('update-status', data);
  }
}

function compareVersions(v1, v2) {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

function getLatestYmlName() {
  switch (process.platform) {
    case 'darwin': return 'latest-mac.yml';
    case 'win32': return 'latest.yml';
    case 'linux': return 'latest-linux.yml';
    default: return 'latest.yml';
  }
}

function parseSimpleYaml(yamlText) {
  const result = {};
  for (const line of yamlText.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      let value = match[2].trim();
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      result[match[1]] = value;
    }
  }
  return result;
}

async function checkForUpdates(silent = false) {
  if (isCheckingUpdate) return;
  isCheckingUpdate = true;
  
  const config = loadConfig();
  const updateUrl = config.update?.url;
  
  if (!updateUrl) {
    if (!silent) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error', title: '检查更新', message: '更新服务器未配置', buttons: ['确定']
      });
    }
    isCheckingUpdate = false;
    return;
  }
  
  try {
    const ymlUrl = `${updateUrl}/${getLatestYmlName()}`;
    
    const updateInfo = await new Promise((resolve) => {
      const request = net.request(ymlUrl);
      let data = '';
      
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          resolve({ hasUpdate: false, error: `HTTP ${response.statusCode}` });
          return;
        }
        response.on('data', (chunk) => { data += chunk.toString(); });
        response.on('end', () => {
          try {
            const info = parseSimpleYaml(data);
            const currentVersion = app.getVersion();
            const latestVersion = info.version;
            
            if (compareVersions(latestVersion, currentVersion) > 0) {
              resolve({
                hasUpdate: true, currentVersion, latestVersion,
                releaseDate: info.releaseDate,
                downloadUrl: `${updateUrl}/${info.path}`,
                size: parseInt(info.size) || 0
              });
            } else {
              resolve({ hasUpdate: false, currentVersion, latestVersion });
            }
          } catch (err) {
            resolve({ hasUpdate: false, error: err.message });
          }
        });
      });
      
      request.on('error', (error) => resolve({ hasUpdate: false, error: error.message }));
      request.end();
    });
    
    console.log('Update check result:', updateInfo);
    
    if (updateInfo.error && !silent) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error', title: '检查更新失败', message: '无法检查更新', detail: updateInfo.error, buttons: ['确定']
      });
    } else if (updateInfo.hasUpdate) {
      // 在状态栏显示新版本提示
      sendUpdateStatus({ type: 'available', version: updateInfo.latestVersion, downloadUrl: updateInfo.downloadUrl });
      
      const sizeInMB = updateInfo.size > 0 ? (updateInfo.size / 1024 / 1024).toFixed(1) : '未知';
      const sizeText = updateInfo.size > 0 ? `大小: ${sizeInMB} MB` : '';
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: '发现新版本', message: `发现新版本 ${updateInfo.latestVersion}`,
        detail: `当前版本: ${updateInfo.currentVersion}\n新版本: ${updateInfo.latestVersion}${sizeText ? '\n' + sizeText : ''}`,
        buttons: ['前往下载', '稍后提醒'], defaultId: 0, cancelId: 1
      });
      if (response === 0) {
        await shell.openExternal(updateInfo.downloadUrl);
      }
    } else if (!silent) {
      await dialog.showMessageBox(mainWindow, {
        type: 'info', title: '检查更新', message: '当前已是最新版本', detail: `当前版本: ${updateInfo.currentVersion}\n服务器版本: ${updateInfo.latestVersion}`, buttons: ['确定']
      });
    }
  } catch (error) {
    console.error('Update check failed:', error);
    if (!silent) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error', title: '检查更新失败', message: '无法检查更新', detail: error.message, buttons: ['确定']
      });
    }
  } finally {
    isCheckingUpdate = false;
  }
}

// 创建应用菜单
function createAppMenu() {
  const isMac = process.platform === 'darwin';
  const config = loadConfig();
  
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 MesaLogo' },
        { label: '检查更新...', click: () => checkForUpdates(false) },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 MesaLogo' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 MesaLogo' }
      ]
    }] : []),
    {
      label: '文件',
      submenu: [
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { 
          label: '重新加载', 
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow && mainWindow.mainView) {
              mainWindow.mainView.webContents.reload();
            }
          }
        },
        { 
          label: '强制重新加载', 
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow && mainWindow.mainView) {
              mainWindow.mainView.webContents.reloadIgnoringCache();
            }
          }
        },
        { 
          label: '开发者工具',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            if (mainWindow && mainWindow.mainView) {
              mainWindow.mainView.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { type: 'separator' },
        {
          label: '显示状态栏', type: 'checkbox', checked: statusBarEnabled,
          click: (menuItem) => {
            statusBarEnabled = menuItem.checked;
            if (mainWindow && !mainWindow.isDestroyed()) {
              toggleStatusBar(statusBarEnabled, config);
            }
          }
        }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front', label: '前置全部窗口' }] : [{ role: 'close', label: '关闭' }])
      ]
    },
    {
      label: '帮助',
      submenu: [
        ...(!isMac ? [{ label: '检查更新...', click: () => checkForUpdates(false) }, { type: 'separator' }] : []),
        { label: '了解更多', click: async () => await shell.openExternal('https://mesalogo.com') }
      ]
    }
  ];
  
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// 应用生命周期
app.whenReady().then(() => {
  createAppMenu();
  createWindow();
  startNetworkMonitor();
  scheduleUpdateCheck();
});

// 获取应用数据目录 ~/.mesalogo
function getAppDataPath() {
  const homedir = require('os').homedir();
  const appDataPath = path.join(homedir, '.mesalogo');
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }
  return appDataPath;
}

// 定时检查更新（每周一次）
function scheduleUpdateCheck() {
  const settingsPath = path.join(getAppDataPath(), 'settings.json');
  let lastCheck = 0;
  
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      lastCheck = settings[LAST_UPDATE_CHECK_KEY] || 0;
    }
  } catch (e) {
    console.error('Failed to read settings:', e);
  }
  
  const now = Date.now();
  if (now - lastCheck >= UPDATE_CHECK_INTERVAL) {
    // 延迟 10 秒后静默检查，避免启动时卡顿
    setTimeout(() => {
      checkForUpdates(true);
      saveLastUpdateCheck(now);
    }, 10000);
  }
}

function saveLastUpdateCheck(timestamp) {
  const settingsPath = path.join(getAppDataPath(), 'settings.json');
  try {
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
    settings[LAST_UPDATE_CHECK_KEY] = timestamp;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopNetworkMonitor();
  if (localServer) { localServer.close(); localServer = null; }
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
