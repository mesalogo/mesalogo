/**
 * API工具函数
 */

/**
 * 构建查询参数字符串
 * @param {Object} params - 参数对象
 * @returns {string} 查询字符串
 */
export const buildQueryString = (params) => {
  if (!params || Object.keys(params).length === 0) return '';
  
  const queryParts = [];
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        // 处理数组参数
        value.forEach(item => {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
        });
      } else {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
  });
  
  return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
};

/**
 * 从API响应中提取错误信息
 * @param {Error} error - 错误对象
 * @returns {string} 格式化的错误消息
 */
export const extractErrorMessage = (error) => {
  if (!error) return '未知错误';
  
  if (error.response) {
    // 服务器响应了，但状态码不在2xx范围内
    const { status, data } = error.response;
    
    if (data && typeof data === 'object') {
      if (data.message) return `${status}: ${data.message}`;
      if (data.error) return `${status}: ${data.error}`;
      if (data.detail) return `${status}: ${data.detail}`;
    }
    
    return `${status}: ${error.message || '服务器错误'}`;
  } else if (error.request) {
    // 请求已发送但未收到响应
    return '请求超时或服务器无响应';
  } else {
    // 请求设置时出错
    return error.message || '请求设置错误';
  }
};

/**
 * 判断API响应是否成功
 * @param {Object} response - API响应对象
 * @returns {boolean} 响应是否成功
 */
export const isSuccessResponse = (response) => {
  return response && response.success !== false;
};

/**
 * 附加授权令牌到请求头
 * @param {Object} headers - 原始请求头
 * @returns {Object} 带有授权令牌的请求头
 */
export const addAuthHeaders = (headers = {}) => {
  const token = localStorage.getItem('authToken');
  
  if (!token) return headers;
  
  return {
    ...headers,
    Authorization: `Bearer ${token}`
  };
};

/**
 * 格式化API响应数据
 * @param {Object} data - 原始响应数据
 * @param {string} defaultKey - 默认数据键名
 * @returns {Object} 格式化后的响应数据
 */
export const formatApiResponse = (data, defaultKey = 'items') => {
  if (!data) return { items: [] };
  
  // 如果响应已经格式化，直接返回
  if (data.items || data[defaultKey]) return data;
  
  // 尝试找到包含数据的键
  const keys = Object.keys(data);
  const dataKey = keys.find(key => Array.isArray(data[key])) || defaultKey;
  
  return {
    items: data[dataKey] || [],
    total: data.total || data.count || (data[dataKey] ? data[dataKey].length : 0),
    page: data.page || 1,
    limit: data.limit || data.per_page || 10
  };
}; 