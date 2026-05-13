# 步骤3: 前端集成

## 📝 创建预加载脚本

创建 `electron/preload.js`:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取后端 URL
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  
  // 文件操作
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  
  // 系统通知
  showNotification: (title, body) => 
    ipcRenderer.invoke('show-notification', { title, body }),
  
  // 平台信息
  platform: process.platform,
  isElectron: true
});

console.log('[Preload] Electron API injected successfully');
```

---

## 🔧 修改前端配置

### 3.1 更新 API 配置

创建或修改 `frontend/src/config/electron.js`:

```javascript
// 检测是否在 Electron 环境中运行
export const isElectron = () => {
  return window.electronAPI?.isElectron || false;
};

// 获取 API 基础 URL
export const getApiBaseUrl = async () => {
  if (isElectron()) {
    // Electron 环境：从主进程获取
    return await window.electronAPI.getBackendUrl();
  } else {
    // Web 环境：使用环境变量或默认值
    return process.env.REACT_APP_API_URL || 'http://localhost:8080';
  }
};

// 文件选择
export const selectFile = async (options = {}) => {
  if (isElectron()) {
    return await window.electronAPI.selectFile({
      properties: ['openFile'],
      ...options
    });
  } else {
    // Web 环境：使用 input[type=file]
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options.filters) {
        input.accept = options.filters.map(f => f.extensions.join(',')).join(',');
      }
      input.onchange = (e) => {
        const files = Array.from(e.target.files).map(f => f.path || f.name);
        resolve(files);
      };
      input.click();
    });
  }
};

// 显示系统通知
export const showNotification = async (title, body) => {
  if (isElectron()) {
    return await window.electronAPI.showNotification(title, body);
  } else {
    // Web 环境：使用浏览器通知 API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
};
```

### 3.2 更新 axios 配置

修改 `frontend/src/services/api.js` (或类似文件):

```javascript
import axios from 'axios';
import { getApiBaseUrl, isElectron } from '../config/electron';

let apiClient = null;

// 初始化 API 客户端
export const initApiClient = async () => {
  const baseURL = await getApiBaseUrl();
  
  apiClient = axios.create({
    baseURL,
    timeout: 120000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // 请求拦截器
  apiClient.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // 响应拦截器
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  console.log(`[API] Initialized with baseURL: ${baseURL}`);
  return apiClient;
};

// 获取 API 客户端
export const getApiClient = async () => {
  if (!apiClient) {
    await initApiClient();
  }
  return apiClient;
};

// 导出便捷方法
export const api = {
  get: async (url, config) => {
    const client = await getApiClient();
    return client.get(url, config);
  },
  post: async (url, data, config) => {
    const client = await getApiClient();
    return client.post(url, data, config);
  },
  put: async (url, data, config) => {
    const client = await getApiClient();
    return client.put(url, data, config);
  },
  delete: async (url, config) => {
    const client = await getApiClient();
    return client.delete(url, config);
  }
};
```

### 3.3 更新 App.js

修改 `frontend/src/App.js`:

```javascript
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { initApiClient, isElectron } from './config/electron';
import { Spin } from 'antd';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 初始化 API 客户端
    initApiClient()
      .then(() => {
        console.log('[App] API client initialized');
        if (isElectron()) {
          console.log('[App] Running in Electron mode');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('[App] Failed to initialize:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" tip="正在连接后端服务..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <h2>连接失败</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>重试</button>
      </div>
    );
  }

  return (
    <Router>
      {/* 你的原有路由和组件 */}
    </Router>
  );
}

export default App;
```

### 3.4 添加 Electron 特定功能

创建 `frontend/src/components/ElectronFeatures.js`:

```javascript
import React from 'react';
import { Button, message } from 'antd';
import { selectFile, showNotification, isElectron } from '../config/electron';

export const FilePickerButton = ({ onFileSelected, ...props }) => {
  const handleClick = async () => {
    try {
      const files = await selectFile({
        filters: [
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (files && files.length > 0) {
        onFileSelected(files);
        message.success('文件选择成功');
      }
    } catch (error) {
      message.error('文件选择失败');
      console.error(error);
    }
  };

  // 只在 Electron 环境显示
  if (!isElectron()) {
    return null;
  }

  return (
    <Button onClick={handleClick} {...props}>
      选择文件
    </Button>
  );
};

export const NotifyButton = ({ title, body, ...props }) => {
  const handleClick = async () => {
    try {
      await showNotification(title, body);
    } catch (error) {
      console.error('Notification failed:', error);
    }
  };

  if (!isElectron()) {
    return null;
  }

  return (
    <Button onClick={handleClick} {...props}>
      发送通知
    </Button>
  );
};
```

---

## 🛠️ 开发环境配置

### 修改 `frontend/package.json`:

```json
{
  "scripts": {
    "start": "craco start",
    "start:electron": "BROWSER=none craco start",
    "build": "craco build",
    "build:electron": "GENERATE_SOURCEMAP=false craco build"
  },
  "homepage": "."
}
```

**注意**: `homepage: "."` 是为了让生产环境使用相对路径。

---

## 🎯 下一步

继续 [04-backend-packaging.md](./04-backend-packaging.md) 打包后端。
