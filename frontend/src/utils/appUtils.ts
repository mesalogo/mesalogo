/**
 * 应用相关的工具函数
 */

/**
 * 获取应用分类对应的图标颜色
 * @param {string} category - 应用分类
 * @returns {string} 对应的颜色值
 */
export const getAppCategoryColor = (category) => {
  const iconColorMap = {
    '开发工具': '#007ACC',
    '建模工具': '#52C41A',
    '数据分析': '#1890FF',
    '地理工具': '#722ED1',
    '系统工具': '#FA8C16'
  };
  
  return iconColorMap[category] || '#1677ff';
};

/**
 * 获取应用的图标和颜色
 * @param {Object} app - 应用对象
 * @param {string} size - 图标大小，默认'16px'
 * @returns {Object} 包含图标组件和颜色的对象
 */
export const getAppIconWithColor = (app, size = '16px') => {
  const category = app.basic?.category || '未分类';
  const iconColor = getAppCategoryColor(category);
  const { getAppIcon } = require('./iconMapper');
  
  return {
    icon: getAppIcon(app.basic?.icon || 'appstore', iconColor, size),
    color: iconColor,
    category
  };
};
