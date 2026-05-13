import axios from 'axios';
import { getElectronApiUrl, isElectron } from '../config/electronConfig';

/**
 * 获取 API 基础 URL
 * 优先使用 Electron 配置，否则使用环境变量
 */
function getBaseURL(): string {
  if (isElectron()) {
    const electronUrl = getElectronApiUrl();
    if (electronUrl) {
      return electronUrl;
    }
  }
  return process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
}

/**
 * 创建并配置全局axios实例
 */
const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 60000, // 60秒超时，适应大模型处理的时间需求
});

/**
 * 更新 axios baseURL（在 Electron 配置加载后调用）
 */
export function updateAxiosBaseURL(): void {
  const newBaseURL = getBaseURL();
  api.defaults.baseURL = newBaseURL;
  console.log('[axios] baseURL 已更新为:', newBaseURL);
}

// 请求拦截器
api.interceptors.request.use(
  config => {
    // 从localStorage获取认证令牌
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 调试信息
    console.log(`API请求: ${config.method.toUpperCase()} ${config.url}`, config);

    return config;
  },
  error => {
    console.error('请求配置错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => {
    // 调试信息
    console.log(`API响应: ${response.config.method.toUpperCase()} ${response.config.url}`, response.data);
    return response;
  },
  error => {
    // 处理常见错误
    if (error.response) {
      // 服务器响应错误
      console.error('API Error:', error.response.status, error.response.data);
      console.error(`请求失败: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);

      // 处理身份验证失败
      if (error.response.status === 401) {
        // 登录接口的 401 不自动跳转，让登录页面自己处理错误显示
        const isLoginRequest = error.config?.url?.includes('/auth/login');
        // 以下请求的 401 是第三方 API 密钥错误，不是用户登录失效
        const isThirdPartyApiRequest = 
          error.config?.url?.includes('/model-configs/') ||
          error.config?.url?.includes('/test-external-connection') ||
          error.config?.url?.includes('/external-kb/') ||
          error.config?.url?.includes('/vector-db/');
        if (!isLoginRequest && !isThirdPartyApiRequest) {
          window.location.href = '/login';
        }
      } else if (error.response.status === 403) {
        // 检查是否是许可证过期错误
        if (error.response.data?.code === 'LICENSE_EXPIRED') {
          console.warn('许可证已过期或无效，跳转到授权页面');

          // 如果不在授权页面和登录页面，直接跳转
          const currentPath = window.location.pathname;
          if (currentPath !== '/settings/about' && currentPath !== '/login') {
            // 简单直接：立即跳转到授权页面
            window.location.href = '/settings/about';
          }
        }
      } else if (error.response.status === 404) {
        // 检查是否是plans相关的404错误（新会话没有计划是正常情况）
        if (error.config?.url?.includes('/plans/active')) {
          // 静默处理，不记录日志，这是正常情况
          return Promise.reject(error);
        }
        
        console.warn(`资源不存在: ${error.config?.url}`);

        // 检查是否是license相关的404错误
        if (error.config?.url?.includes('/license')) {
          console.warn('License相关资源不存在，这是正常情况（系统未激活）');
          // 对于license 404错误，我们让它正常传播，不做特殊处理
          // 这样前端可以正确处理license未激活的情况
        }
      }
    } else if (error.request) {
      // 请求已发送但未收到响应
      console.error('API Error: 请求未得到响应', error.request);
      console.error(`请求无响应: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);

      // 显示服务器连接问题的详细信息
      if (error.code === 'ECONNABORTED') {
        console.error('请求超时，服务器响应时间过长');
      } else {
        console.error('无法连接到服务器，请检查网络连接或服务器状态');
      }
    } else {
      // 请求设置出错
      console.error('API Error:', error.message);
      console.error(`请求配置错误: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    }

    return Promise.reject(error);
  }
);

// 开发环境模拟请求延迟
if (process.env.NODE_ENV === 'development') {
  api.interceptors.request.use(async (config) => {
    // 添加随机延迟以模拟网络延迟
    const delay = Math.floor(Math.random() * 800) + 200; // 200-1000ms
    await new Promise(resolve => setTimeout(resolve, delay));
    return config;
  });
}

export default api;