/**
 * API URL验证和处理工具
 */

/**
 * 验证API URL的格式
 * @param {string} url - 要验证的URL
 * @param {Object} options - 验证选项
 * @returns {Object} 验证结果
 */
export const validateApiUrl = (url: any, options: any = {}) => {
  const { throwOnError = true } = options;
  
  const result = {
    isValid: false,
    normalizedUrl: '',
    error: '',
    warnings: []
  };
  
  if (!url || typeof url !== 'string') {
    result.error = 'URL不能为空';
    if (throwOnError) throw new Error(result.error);
    return result;
  }
  
  // 基本格式验证：必须以http或https开头
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    result.error = 'URL必须以http://或https://开头';
    if (throwOnError) throw new Error(result.error);
    return result;
  }
  
  // 尝试规范化URL
  try {
    // 尝试创建URL对象来验证格式
    const urlObj = new URL(url);
    result.normalizedUrl = url;
    
    // HTTPS警告
    if (urlObj.protocol === 'http:') {
      result.warnings.push('建议使用HTTPS以确保安全通信');
    }
    
    result.isValid = true;
    return result;
  } catch (e) {
    result.error = `URL格式不正确: ${e.message}`;
    if (throwOnError) throw new Error(result.error);
    return result;
  }
};

/**
 * 构建API端点URL
 * @param {string} baseUrl - 基础URL
 * @param {string} endpoint - API端点
 * @returns {string} - 完整的API URL
 */
export const buildApiUrl = (baseUrl, endpoint) => {
  if (!baseUrl) return endpoint;
  if (!endpoint) return baseUrl;
  
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  return `${normalizedBase}${normalizedEndpoint}`;
};

/**
 * 检查URL是否包含特定路径
 * @param {string} url - 要检查的URL
 * @param {string} path - 要查找的路径
 * @returns {boolean} 是否包含路径
 */
export const urlContainsPath = (url, path) => {
  try {
    return url.includes(path);
  } catch {
    return false;
  }
};

/**
 * 添加查询参数到URL
 * @param {string} url - 基础URL
 * @param {Object} params - 查询参数对象
 * @returns {string} - 带查询参数的URL
 */
export const addQueryParams = (url, params = {}) => {
  if (!url) return '';
  if (!params || Object.keys(params).length === 0) return url;
  
  const urlObj = new URL(url);
  
  Object.entries(params).forEach(([key, value]: [string, any]) => {
    if (value !== undefined && value !== null) {
      urlObj.searchParams.append(key, String(value));
    }
  });
  
  return urlObj.toString();
}; 