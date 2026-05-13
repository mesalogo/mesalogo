const path = require('path');
const dotenv = require('dotenv');

// 加载.env环境变量
const env = dotenv.config().parsed || {};
// 从环境变量中获取后端URL
const BACKEND_URL = env.REACT_APP_API_URL ? env.REACT_APP_API_URL.replace('/api', '') : 'http://localhost:8080';

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