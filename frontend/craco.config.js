const path = require('path');
const dotenv = require('dotenv');

// 加载.env环境变量
const env = dotenv.config().parsed || {};
// 开发服务器 /api 代理的后端目标。
// 优先使用 BACKEND_PROXY_TARGET；REACT_APP_API_URL 现为浏览器内相对地址(/api)，
// 不能再用它推导代理目标（strip 后会得到空字符串导致代理失效）。
const BACKEND_URL =
  env.BACKEND_PROXY_TARGET ||
  process.env.BACKEND_PROXY_TARGET ||
  'http://localhost:8080';

module.exports = {
  devServer: {
    allowedHosts: ['localhost', '127.0.0.1', '.vercel.app'],
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 3000,
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        pathRewrite: {
          '^/api': '/api' // 保持API路径不变
        },
        logLevel: 'debug' // 添加调试日志
      },
    },
  },
};
