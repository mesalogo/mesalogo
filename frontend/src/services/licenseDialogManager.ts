/**
 * 许可证对话框管理器
 *
 * 用于管理许可证过期对话框的显示，确保同一时间只显示一个对话框
 */
import { Modal } from 'antd';

// 存储当前对话框状态
let dialogState = {
  isShowing: false,
  modalInstance: null,
  lastShownTime: 0,
  pendingRedirect: null
};

/**
 * 显示许可证过期对话框
 * @param {Function} onOk 确认按钮回调函数
 * @returns {boolean} 是否成功显示对话框
 */
export const showLicenseExpiredDialog = (onOk) => {
  // 如果当前已有对话框显示，保存回调但不显示新对话框
  if (dialogState.isShowing) {
    console.log('许可证过期对话框已在显示中，保存回调但不显示新对话框');
    if (typeof onOk === 'function') {
      dialogState.pendingRedirect = onOk;
    }
    return false;
  }

  // 如果距离上次显示不到10秒，不再显示新对话框
  const now = Date.now();
  if (now - dialogState.lastShownTime < 10000) {
    console.log('距离上次显示许可证过期对话框时间过短，忽略新的显示请求');
    // 如果有回调函数，直接执行跳转
    if (typeof onOk === 'function') {
      console.log('直接执行跳转回调...');
      onOk();
    }
    return false;
  }

  // 保存回调函数
  if (typeof onOk === 'function') {
    dialogState.pendingRedirect = onOk;
  }

  // 更新对话框状态
  dialogState.isShowing = true;
  dialogState.lastShownTime = now;

  try {
    // 创建并显示对话框
    const modal = Modal.error({
      title: '许可证已过期',
      content: '您的许可证已过期或无效，系统功能将受到限制。请前往授权页面激活系统。',
      okText: '前往授权页面',
      onOk: () => {
        // 获取并清除回调函数
        const callback = dialogState.pendingRedirect;
        dialogState.pendingRedirect = null;

        // 重置对话框状态
        dialogState.isShowing = false;
        dialogState.modalInstance = null;

        // 调用回调函数
        if (typeof callback === 'function') {
          callback();
        }
      },
      maskClosable: false,
      closable: false,
      centered: true,
      afterClose: () => {
        // 确保对话框关闭后重置状态
        dialogState.isShowing = false;
        dialogState.modalInstance = null;
        dialogState.pendingRedirect = null;
      }
    });

    // 存储对话框实例
    dialogState.modalInstance = modal;
    
    console.log('许可证过期对话框已创建');
  } catch (error) {
    console.error('创建对话框失败:', error);
    // 如果对话框创建失败，直接执行跳转
    dialogState.isShowing = false;
    if (typeof onOk === 'function') {
      console.log('对话框创建失败，直接跳转...');
      onOk();
    }
  }

  return true;
};

/**
 * 关闭当前显示的许可证过期对话框
 */
export const closeLicenseExpiredDialog = () => {
  if (dialogState.isShowing && dialogState.modalInstance) {
    // 销毁对话框
    dialogState.modalInstance.destroy();

    // 重置对话框状态
    dialogState.isShowing = false;
    dialogState.modalInstance = null;
    dialogState.pendingRedirect = null;
  }
};

/**
 * 检查许可证过期对话框是否正在显示
 * @returns {boolean} 对话框是否正在显示
 */
export const isLicenseDialogShowing = () => {
  return dialogState.isShowing;
};

const licenseDialogManager = {
  showLicenseExpiredDialog,
  closeLicenseExpiredDialog,
  isLicenseDialogShowing
};

export default licenseDialogManager;
