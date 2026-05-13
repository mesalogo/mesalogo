# 步骤2: 主进程开发

## 📝 创建主进程文件

创建 `electron/main.js`:

```javascript
const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const Store = require('electron-store');

// 配置存储
const store = new Store();

// 全局变量
let mainWindow;
let flaskProcess;
let tray;
const FLASK_PORT = store.get('flaskPort', 8080);
const FLASK_URL = `http://127.0.0.1:${FLASK_PORT}`;
const isDev = !app.isPackaged;

//=============================================================================
// Flask 后端管理
//=============================================================================

/**
 * 启动 Flask 服务器
 */
function startFlaskServer() {
  console.log('[Flask] Starting server...');
  
  if (isDev) {
    // 开发环境：使用系统 Python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const backendPath = path.join(__dirname, '..', 'backend', 'run_app.py');
    
    flaskProcess = spawn(pythonCmd, [backendPath], {
      env: { 
        ...process.env, 
        FLASK_ENV: 'development',
        FLASK_PORT: FLASK_PORT.toString()
      },
      cwd: path.join(__dirname, '..', 'backend')
    });
  } else {
    // 生产环境：使用打包的可执行文件
    const exeName = process.platform === 'win32' ? 'run_app.exe' : 'run_app';
    const flaskExe = path.join(process.resourcesPath, 'backend', exeName);
    
    flaskProcess = spawn(flaskExe, [], {
      env: { 
        ...process.env, 
        FLASK_ENV: 'production',
        FLASK_PORT: FLASK_PORT.toString()
      }
    });
  }

  // 输出日志
  flaskProcess.stdout.on('data', (data) => {
    console.log(`[Flask] ${data.toString().trim()}`);
  });

  flaskProcess.stderr.on('data', (data) => {
    console.error(`[Flask Error] ${data.toString().trim()}`);
  });

  flaskProcess.on('close', (code) => {
    console.log(`[Flask] Process exited with code ${code}`);
    flaskProcess = null;
  });
}

/**
 * 等待 Flask 启动完成
 */
async function waitForFlask(maxRetries = 30, interval = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(`${FLASK_URL}/health`, { timeout: 2000 });
      if (response.data.status === 'ok') {
        console.log('[Flask] Server is ready!');
        return true;
      }
    } catch (error) {
      console.log(`[Flask] Waiting... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  throw new Error('Flask server failed to start within timeout');
}

/**
 * 停止 Flask 服务器
 */
function stopFlaskServer() {
  if (flaskProcess) {
    console.log('[Flask] Stopping server...');
    flaskProcess.kill();
    flaskProcess = null;
  }
}

//=============================================================================
// 窗口管理
//=============================================================================

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'resources', 'icon.png'),
    show: false // 等待加载完成再显示
  });

  // 加载前端
  if (isDev) {
    // 开发环境：加载 dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
  }

  // 窗口加载完成后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 窗口关闭事件
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    }
    return false;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

//=============================================================================
// 系统托盘
//=============================================================================

/**
 * 创建系统托盘
 */
function createTray() {
  const iconPath = path.join(__dirname, 'resources', 
    process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  );
  
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow.show();
        if (process.platform === 'darwin') {
          app.dock.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: '后端状态',
      click: async () => {
        try {
          const response = await axios.get(`${FLASK_URL}/health`);
          dialog.showMessageBox({
            type: 'info',
            title: '后端状态',
            message: `Flask 服务运行正常\n端口: ${FLASK_PORT}\nPID: ${flaskProcess?.pid || 'N/A'}`
          });
        } catch (error) {
          dialog.showMessageBox({
            type: 'error',
            title: '后端状态',
            message: 'Flask 服务未响应'
          });
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('ABM LLM Desktop');
  tray.setContextMenu(contextMenu);
  
  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    mainWindow.show();
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  });
}

//=============================================================================
// IPC 通信
//=============================================================================

// 获取后端 URL
ipcMain.handle('get-backend-url', () => {
  return FLASK_URL;
});

// 选择文件
ipcMain.handle('select-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result.filePaths;
});

// 选择目录
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.filePaths[0];
});

// 保存文件
ipcMain.handle('save-file', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result.filePath;
});

// 显示通知
ipcMain.handle('show-notification', (event, { title, body }) => {
  new Notification({ title, body }).show();
});

//=============================================================================
// 应用生命周期
//=============================================================================

// 应用准备完成
app.whenReady().then(async () => {
  try {
    // 启动 Flask
    startFlaskServer();
    
    // 等待 Flask 就绪
    await waitForFlask();
    
    // 创建窗口和托盘
    createWindow();
    createTray();
    
    console.log('[App] Application started successfully');
  } catch (error) {
    console.error('[App] Failed to start:', error);
    dialog.showErrorBox('启动失败', '无法启动后端服务，请检查日志');
    app.quit();
  }
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  // macOS 上保持应用运行
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 重新激活（macOS）
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  }
});

// 应用退出前
app.on('before-quit', () => {
  app.isQuitting = true;
  stopFlaskServer();
});

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error('[App] Uncaught Exception:', error);
  dialog.showErrorBox('应用错误', error.message);
});
```

---

## 🎯 下一步

继续 [03-frontend-integration.md](./03-frontend-integration.md) 进行前端集成。
