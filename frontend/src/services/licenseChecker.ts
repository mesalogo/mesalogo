/**
 * 许可证检查服务
 *
 * 用于定期检查许可证状态，在许可证过期时重定向到授权页面
 *
 * 注意：此服务主要作为备用机制，因为：
 * 1. 后端中间件已经对所有API请求进行license检查
 * 2. 前端axios拦截器会处理license过期的403错误
 * 3. 用户在正常使用时会频繁调用API，能及时发现license问题
 * 4. 因此前端定期检查的频率可以较低，主要用于长时间无操作的场景
 */
import { licenseAPI } from './api/license';

// 检查间隔（毫秒）- 大幅增加间隔，减少不必要的检查
const CHECK_INTERVAL = 30 * 60 * 1000; // 30分钟（从5分钟改为30分钟）

// 存储检查器实例
let checkerInstance = null;

// 存储上次检查时间
let lastCheckTime = 0;

// 存储许可证状态
let licenseStatus: {
  isValid: boolean;
  data: any;
  lastChecked: number;
  error?: string;
} = {
  isValid: false,
  data: null,
  lastChecked: 0
};

// 存储是否已执行初始检查的标志
let hasPerformedInitialCheck = false;

/**
 * 许可证检查器类
 */
class LicenseChecker {
  intervalId: any;
  redirected: boolean;
  
  constructor() {
    this.intervalId = null;
    this.redirected = false;
  }

  /**
   * 启动许可证检查
   */
  start() {
    if (this.intervalId) {
      return; // 已经启动
    }

    // 不立即执行检查，因为后端中间件已经提供了保护
    // 只设置定期检查作为备用机制
    this.intervalId = setInterval(() => {
      this.checkLicense();
    }, CHECK_INTERVAL);

    console.log(`许可证检查服务已启动，检查间隔: ${CHECK_INTERVAL / 60000}分钟`);
  }

  /**
   * 停止许可证检查
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('许可证检查服务已停止');
    }
  }

  /**
   * 检查许可证状态
   * @param {boolean} forceCheck 是否强制检查，忽略缓存
   * @returns {Promise<boolean>} 许可证是否有效
   */
  async checkLicense(forceCheck = false) {
    // 检查用户是否已登录，如果未登录则不检查license
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      console.log('License检查器: 用户未登录，跳过许可证检查');
      return true; // 返回true避免触发license过期逻辑
    }

    // 检查当前是否在登录页面，如果是则不检查license
    const currentPath = window.location.pathname;
    if (currentPath === '/login') {
      console.log('License检查器: 当前在登录页面，跳过许可证检查');
      return true; // 返回true避免触发license过期逻辑
    }

    // 如果距离上次检查不到10分钟且不是强制检查，使用缓存结果
    const now = Date.now();
    if (!forceCheck && now - lastCheckTime < 600000 && licenseStatus.lastChecked > 0) {
      console.log('License检查器: 使用缓存的许可证状态');
      return licenseStatus.isValid;
    }

    try {
      // 获取当前许可证信息
      const licenseData = await licenseAPI.getCurrentLicense();

      // 更新许可证状态
      licenseStatus = {
        isValid: true,
        data: licenseData,
        lastChecked: now
      };

      lastCheckTime = now;
      this.redirected = false; // 重置重定向标志

      return true;
    } catch (error) {
      console.error('许可证检查失败:', error);

      // 更新许可证状态
      licenseStatus = {
        isValid: false,
        data: null,
        lastChecked: now,
        error: error.response?.data?.message || '许可证无效或已过期'
      };

      lastCheckTime = now;

      // 检查是否需要重定向到授权页面
      // 注意：首次访问时，由LicenseChecker组件处理弹窗和跳转
      // 只有在定期检查时才自动重定向
      if (!this.redirected && error.response?.data?.code === 'LICENSE_EXPIRED' && !forceCheck) {
        // 使用对话框管理器检查是否已经显示对话框
        import('./licenseDialogManager').then(({ isLicenseDialogShowing }) => {
          if (!isLicenseDialogShowing()) {
            this.redirectToLicensePage();
          }
        }).catch(() => {
          // 如果导入失败，使用原始方法
          this.redirectToLicensePage();
        });
      }

      return false;
    }
  }

  /**
   * 重定向到许可证授权页面
   */
  redirectToLicensePage() {
    // 检查当前是否已经在授权页面或登录页面
    const currentPath = window.location.pathname;
    if (currentPath === '/settings/about' || currentPath === '/login') {
      return; // 已经在授权页面或登录页面，不需要重定向
    }

    // 设置重定向标志，防止重复提示
    this.redirected = true;

    // 使用对话框管理器显示提示对话框
    import('../services/licenseDialogManager').then(({ showLicenseExpiredDialog }) => {
      showLicenseExpiredDialog(() => {
        window.location.href = '/settings/about';
      });
    });
  }

  /**
   * 获取当前许可证状态
   * @returns {Object} 许可证状态
   */
  getLicenseStatus() {
    return licenseStatus;
  }

  /**
   * 强制刷新许可证状态
   * @returns {Promise<boolean>} 许可证是否有效
   */
  async refreshLicense() {
    return await this.checkLicense(true); // 使用强制检查参数
  }
}

/**
 * 获取许可证检查器实例
 * @returns {LicenseChecker} 许可证检查器实例
 */
export const getLicenseChecker = () => {
  if (!checkerInstance) {
    checkerInstance = new LicenseChecker();
  }
  return checkerInstance;
};

/**
 * 启动许可证检查服务
 * @param {boolean} performInitialCheck 是否执行初始检查
 */
export const startLicenseChecker = (performInitialCheck = true) => {
  const checker = getLicenseChecker();
  checker.start();

  // 执行初始检查
  if (performInitialCheck && !hasPerformedInitialCheck) {
    // 延迟执行初始检查，确保应用已完全加载
    setTimeout(async () => {
      try {
        // 检查当前是否在授权页面或登录页面
        const currentPath = window.location.pathname;
        if (currentPath === '/settings/about' || currentPath === '/login') {
          console.log('License检查器: 当前在授权页面或登录页面，跳过初始检查');
          return; // 已经在授权页面或登录页面，不需要检查
        }

        // 检查是否有认证token，如果没有token说明用户未登录，不需要检查license
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
          console.log('License检查器: 用户未登录，跳过初始检查');
          return;
        }

        console.log('License检查器: 执行初始许可证检查');
        // 使用强制检查参数，确保获取最新的许可证状态
        const isValid = await checker.checkLicense(true);

        // 如果许可证无效，显示对话框
        if (!isValid) {
          import('./licenseDialogManager').then(({ showLicenseExpiredDialog, isLicenseDialogShowing }) => {
            // 检查是否已经显示对话框
            if (!isLicenseDialogShowing()) {
              showLicenseExpiredDialog(() => {
                window.location.href = '/settings/about';
              });
            }
          });
        }
      } catch (error) {
        console.error('初始许可证检查失败:', error);
      } finally {
        // 标记为已执行初始检查
        hasPerformedInitialCheck = true;
      }
    }, 2000); // 增加延迟时间，确保路由和认证状态完全加载
  }
};

/**
 * 停止许可证检查服务
 */
export const stopLicenseChecker = () => {
  if (checkerInstance) {
    checkerInstance.stop();
  }
};

/**
 * 检查许可证状态
 * @param {boolean} forceCheck 是否强制检查，忽略缓存
 * @returns {Promise<boolean>} 许可证是否有效
 */
export const checkLicense = async (forceCheck = false) => {
  const checker = getLicenseChecker();
  return await checker.checkLicense(forceCheck);
};

/**
 * 获取当前许可证状态
 * @returns {Object} 许可证状态
 */
export const getLicenseStatus = () => {
  const checker = getLicenseChecker();
  return checker.getLicenseStatus();
};

/**
 * 强制刷新许可证状态
 * @returns {Promise<boolean>} 许可证是否有效
 */
export const refreshLicense = async () => {
  const checker = getLicenseChecker();
  return await checker.refreshLicense();
};

const licenseChecker = {
  startLicenseChecker,
  stopLicenseChecker,
  checkLicense,
  getLicenseStatus,
  refreshLicense
};

export default licenseChecker;
