import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import './index.css';
import './locales'; // 导入i18n配置
import App from './App';
import { theme } from './theme'; // 导入主题配置
import { initElectronConfig } from './services/config/electronConfig';

async function bootstrap() {
  // 在 Electron 环境中先加载配置
  await initElectronConfig();

  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <ConfigProvider theme={theme}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </React.StrictMode>
  );
}

bootstrap();

// 许可证检查由axios拦截器统一处理，无需额外的定时检查