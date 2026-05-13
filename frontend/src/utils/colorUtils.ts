/**
 * 颜色工具函数
 * 提供与颜色相关的工具函数，包括智能体颜色样式生成
 */

/**
 * 预定义的颜色列表，用于智能体头像和卡片样式
 * 这些颜色经过精心挑选，确保最大的视觉区分度
 * 使用红橙黄绿青蓝紫等高对比度颜色
 */
const AGENT_COLORS = [
  '#f5222d', // 红色
  '#fa8c16', // 橙色
  '#fadb14', // 黄色
  '#52c41a', // 绿色
  '#13c2c2', // 青色
  '#1677ff', // 蓝色
  '#722ed1', // 紫色
  '#eb2f96', // 粉色
  '#fa541c', // 火红色
  '#ffa940', // 亮橙色
  '#ffec3d', // 亮黄色
  '#73d13d', // 亮绿色
  '#36cfc9', // 亮青色
  '#40a9ff', // 亮蓝色
  '#9254de', // 亮紫色
  '#f759ab', // 亮粉色
  '#ff4d4f', // 亮红色
  '#ff7a45', // 珊瑚色
  '#ffc53d', // 金黄色
  '#bae637', // 酸橙色
];

/**
 * 已分配的颜色索引缓存，用于跟踪已使用的颜色
 * 键为智能体ID或名称，值为颜色索引
 */
const assignedColorIndices = new Map();

/**
 * 获取下一个可用的颜色索引，尽量避免相邻智能体使用相似颜色
 * @param {string|number} agentIdOrName - 智能体ID或名称
 * @returns {number} 颜色索引
 */
const getNextColorIndex = () => {
  // 如果所有颜色都已分配，则重新开始循环使用
  if (assignedColorIndices.size >= AGENT_COLORS.length) {
    // 找出使用次数最少的颜色索引
    const colorUsageCounts = new Array(AGENT_COLORS.length).fill(0);

    for (const colorIndex of assignedColorIndices.values()) {
      colorUsageCounts[colorIndex]++;
    }

    // 返回使用次数最少的颜色索引
    return colorUsageCounts.indexOf(Math.min(...colorUsageCounts));
  }

  // 找出尚未使用的颜色索引
  for (let i = 0; i < AGENT_COLORS.length; i++) {
    if (![...assignedColorIndices.values()].includes(i)) {
      return i;
    }
  }

  // 默认返回第一个颜色索引（理论上不会执行到这里）
  return 0;
};

/**
 * 根据智能体ID或名称获取一致的颜色
 * @param {string|number} agentIdOrName - 智能体ID或名称
 * @returns {string} 颜色代码
 */
export const getAgentColor = (agentIdOrName) => {
  if (!agentIdOrName) return AGENT_COLORS[0]; // 默认颜色

  const agentKey = String(agentIdOrName);

  // 如果该智能体已分配颜色，则返回已分配的颜色
  if (assignedColorIndices.has(agentKey)) {
    return AGENT_COLORS[assignedColorIndices.get(agentKey)];
  }

  // 分配新的颜色索引
  const newColorIndex = getNextColorIndex();
  assignedColorIndices.set(agentKey, newColorIndex);

  return AGENT_COLORS[newColorIndex];
};

/**
 * 获取与背景色对应的文本颜色（黑色或白色）
 * @param {string} backgroundColor - 背景颜色（十六进制格式）
 * @returns {string} 文本颜色（黑色或白色）
 */
export const getContrastTextColor = (backgroundColor) => {
  // 移除#前缀并转换为RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 计算亮度 (基于WCAG标准)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // 亮度大于128返回黑色，否则返回白色
  return brightness > 128 ? '#000000' : '#ffffff';
};

/**
 * 将十六进制颜色转换为RGB值
 * @param {string} hex - 十六进制颜色代码
 * @returns {string} 逗号分隔的RGB值
 */
export const hexToRgb = (hex) => {
  // 移除#前缀
  const cleanHex = hex.replace('#', '');

  // 解析RGB值
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `${r}, ${g}, ${b}`;
};

/**
 * 获取智能体的完整样式对象
 * @param {string|number} agentIdOrName - 智能体ID或名称
 * @param {boolean} isResponding - 是否正在响应
 * @param {boolean} isObserver - 是否为监督者
 * @returns {Object} 样式对象
 */
export const getAgentAvatarStyle = (agentIdOrName, isResponding = false, isObserver = false) => {
  // 所有智能体（包括监督者）都使用动态颜色分配，通过图标来区分身份
  const backgroundColor = getAgentColor(agentIdOrName);
  const rgbColor = hexToRgb(backgroundColor);

  return {
    backgroundColor,
    color: getContrastTextColor(backgroundColor),
    ...(isResponding && {
      animation: 'pulse 1.5s infinite',
      '--pulse-color': rgbColor // 设置CSS变量用于动画
    })
  };
};

/**
 * 获取监督者智能体的完整样式对象（便捷函数）
 * 监督者和普通智能体使用相同的颜色分配逻辑，通过图标区分身份
 * @param {string|number} agentIdOrName - 智能体ID或名称
 * @param {boolean} isResponding - 是否正在响应
 * @returns {Object} 样式对象
 */
export const getObserverAvatarStyle = (agentIdOrName, isResponding = false) => {
  return getAgentAvatarStyle(agentIdOrName, isResponding, true);
};

/**
 * 获取智能体卡片的样式对象
 * @param {string|number} agentIdOrName - 智能体ID或名称
 * @returns {Object} 样式对象
 */
export const getAgentCardStyle = (agentIdOrName) => {
  const borderColor = getAgentColor(agentIdOrName);

  return {
    borderLeft: `4px solid ${borderColor}`,
    transition: 'all 0.3s ease'
  };
};
