/**
 * 图标映射工具
 * 将后端返回的图标字符串映射为React图标组件
 */
import React from 'react';
import {
  CodeOutlined,
  PartitionOutlined,
  GlobalOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  ToolOutlined,
  FileTextOutlined,
  SettingOutlined,
  CloudOutlined,
  ApiOutlined,
  BugOutlined,
  ExperimentOutlined,
  FundOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  AreaChartOutlined,
  TableOutlined,
  FileSearchOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  MonitorOutlined,
  DesktopOutlined,
  MobileOutlined,
  TabletOutlined,
  AppstoreOutlined,
  ShopOutlined,
  GiftOutlined,
  StarOutlined,
  HeartOutlined,
  LikeOutlined,
  DislikeOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  ReloadOutlined,
  SyncOutlined,
  DownloadOutlined,
  UploadOutlined,
  ShareAltOutlined,
  LinkOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MinusOutlined,
  CheckOutlined,
  CloseOutlined,
  QuestionOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';

// 图标映射表
const iconMap = {
  // 开发工具类
  'code': CodeOutlined,
  'api': ApiOutlined,
  'bug': BugOutlined,
  'tool': ToolOutlined,
  'desktop': DesktopOutlined,
  'monitor': MonitorOutlined,
  
  // 建模工具类
  'partition': PartitionOutlined,
  'experiment': ExperimentOutlined,
  'robot': RobotOutlined,
  
  // 数据分析类
  'bar-chart': BarChartOutlined,
  'line-chart': LineChartOutlined,
  'pie-chart': PieChartOutlined,
  'dot-chart': DotChartOutlined,
  'area-chart': AreaChartOutlined,
  'fund': FundOutlined,
  'table': TableOutlined,
  
  // 地图和地理类
  'global': GlobalOutlined,
  
  // 数据库类
  'database': DatabaseOutlined,
  
  // 文档类
  'file-text': FileTextOutlined,
  'file-search': FileSearchOutlined,
  
  // 系统类
  'setting': SettingOutlined,
  'cloud': CloudOutlined,
  'safety-certificate': SafetyCertificateOutlined,
  'thunderbolt': ThunderboltOutlined,
  
  // 移动设备类
  'mobile': MobileOutlined,
  'tablet': TabletOutlined,
  
  // 应用商店类
  'appstore': AppstoreOutlined,
  'shop': ShopOutlined,
  'gift': GiftOutlined,
  
  // 交互类
  'star': StarOutlined,
  'heart': HeartOutlined,
  'like': LikeOutlined,
  'dislike': DislikeOutlined,
  'eye': EyeOutlined,
  
  // 操作类
  'search': SearchOutlined,
  'filter': FilterOutlined,
  'sort-ascending': SortAscendingOutlined,
  'sort-descending': SortDescendingOutlined,
  'reload': ReloadOutlined,
  'sync': SyncOutlined,
  'download': DownloadOutlined,
  'upload': UploadOutlined,
  'share': ShareAltOutlined,
  'link': LinkOutlined,
  'copy': CopyOutlined,
  'edit': EditOutlined,
  'delete': DeleteOutlined,
  'plus': PlusOutlined,
  'minus': MinusOutlined,
  
  // 状态类
  'check': CheckOutlined,
  'close': CloseOutlined,
  'question': QuestionOutlined,
  'info': InfoCircleOutlined,
  'warning': WarningOutlined,
  'exclamation': ExclamationCircleOutlined,
  'check-circle': CheckCircleOutlined,
  'close-circle': CloseCircleOutlined
};

/**
 * 根据图标名称获取对应的React图标组件
 * @param {string} iconName - 图标名称
 * @param {Object} props - 图标属性
 * @returns {React.Component} 图标组件
 */
export const getIcon = (iconName, props = {}) => {
  const IconComponent = iconMap[iconName];
  
  if (!IconComponent) {
    // 如果找不到对应图标，返回默认图标
    console.warn(`未找到图标: ${iconName}，使用默认图标`);
    return <AppstoreOutlined {...props} />;
  }
  
  return <IconComponent {...props} />;
};

/**
 * 获取应用图标，带有默认样式
 * @param {string} iconName - 图标名称
 * @param {string} color - 图标颜色
 * @param {string} size - 图标大小
 * @returns {React.Component} 图标组件
 */
export const getAppIcon = (iconName, color = '#1677ff', size = '32px') => {
  return getIcon(iconName, {
    style: {
      fontSize: size,
      color: color
    }
  });
};

/**
 * 获取分类图标
 * @param {string} category - 分类名称
 * @returns {React.Component} 图标组件
 */
export const getCategoryIcon = (category) => {
  const categoryIconMap = {
    '开发工具': 'code',
    '建模工具': 'partition',
    '数据分析': 'bar-chart',
    '地理信息': 'global',
    '系统工具': 'setting',
    '文档管理': 'file-text',
    '数据库': 'database',
    '网络工具': 'cloud',
    '安全工具': 'safety-certificate',
    '移动应用': 'mobile'
  };
  
  const iconName = categoryIconMap[category] || 'appstore';
  return getIcon(iconName, {
    style: {
      fontSize: '16px',
      marginRight: '8px'
    }
  });
};

/**
 * 获取所有可用的图标名称列表
 * @returns {Array} 图标名称数组
 */
export const getAvailableIcons = () => {
  return Object.keys(iconMap);
};

const iconMapper = {
  getIcon,
  getAppIcon,
  getCategoryIcon,
  getAvailableIcons
};

export default iconMapper;
