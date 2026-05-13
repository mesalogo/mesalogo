import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

// 共享的 Token（亮色和暗色通用）
const sharedToken = {
  colorPrimary: '#1677ff',
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,
  fontWeightStrong: 600,
};

// 共享的组件配置
const sharedComponents = {
  Button: {
    borderRadius: 8,
    fontWeight: 500,
    // 统一移除所有按钮阴影，保持简洁风格
    primaryShadow: 'none',
    defaultShadow: 'none',
    dangerShadow: 'none',
    // 设置 default 按钮边框颜色，使其更明显
    defaultBorderColor: '#d9d9d9',
  },
  Table: {
    borderRadius: 10,
    borderRadiusLG: 10,
    headerBorderRadius: 0,
    cellPaddingBlock: 18,
    cellPaddingInline: 24,
    fontSize: 14,
    fontWeightStrong: 600,
  },
  Menu: {
    itemBorderRadius: 6,
    itemHeight: 40,
    itemMarginBlock: 4,
    itemMarginInline: 0,
    itemSelectedBg: 'rgba(22, 119, 255, 0.08)',
    itemSelectedColor: '#1677ff',
    itemHoverBg: 'rgba(22, 119, 255, 0.04)',
    itemHoverColor: '#1677ff',
    // 一级菜单背景色（较浅）
    itemBg: 'transparent',
    // 二级子菜单背景色（较深）
    subMenuItemBg: 'rgba(0, 0, 0, 0.02)',
  },
  Modal: {
    borderRadiusLG: 16,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
  },
  Tabs: {
    itemActiveColor: '#2563eb',
    itemHoverColor: '#2563eb',
    itemSelectedColor: '#2563eb',
    inkBarColor: '#2563eb',
    titleFontSize: 14,
    titleFontSizeLG: 16,
    cardPadding: '12px 4px',
  },
  Slider: {
    trackBg: '#3b82f6',
    trackHoverBg: '#3b82f6',
    handleColor: '#3b82f6',
    handleActiveColor: '#3b82f6',
  },
  Switch: {
    colorPrimary: '#3b82f6',
    colorPrimaryHover: '#2563eb',
  },
  Pagination: {
    itemActiveBg: '#e6f4ff',
  },
  Form: {
    labelFontSize: 14,
    labelRequiredMarkColor: '#ff4d4f',
    verticalLabelPadding: '0 0 8px',
  },
  Divider: {
    marginLG: 28,
    textPaddingInline: 16,
    orientationMargin: 0.05,
    fontWeightStrong: 600,
  },
  Tag: {
    borderRadiusSM: 4,
  },
  Empty: {
    fontSize: 14,
  },
};

// 亮色主题
export const lightTheme: ThemeConfig = {
  cssVar: { key: 'app' },
  token: {
    ...sharedToken,
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f0f2f5',
    colorText: 'rgba(0, 0, 0, 0.85)',
    colorTextSecondary: 'rgba(0, 0, 0, 0.45)',
    colorBorder: '#f0f0f0',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
    boxShadowSecondary: '0 4px 20px rgba(0, 0, 0, 0.05)',
  },
  components: {
    ...sharedComponents,
    Table: {
      ...sharedComponents.Table,
      headerBg: '#f8fafd',
      headerColor: '#0f172a',
    },
    Modal: {
      ...sharedComponents.Modal,
      headerBg: '#ffffff',
      contentBg: '#ffffff',
      footerBg: '#ffffff',
    },
    Form: {
      ...sharedComponents.Form,
      labelColor: '#334155',
    },
    Tag: {
      ...sharedComponents.Tag,
      defaultBg: '#f5f5f5',
      defaultColor: '#666',
    },
  },
};

// 暗色主题
export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  cssVar: { key: 'app' },
  token: {
    ...sharedToken,
    colorBgContainer: '#141414',
    colorBgLayout: '#0a0a0a',
    colorText: 'rgba(255, 255, 255, 0.85)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.45)',
    colorBorder: '#303030',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
    boxShadowSecondary: '0 4px 20px rgba(0, 0, 0, 0.2)',
  },
  components: {
    ...sharedComponents,
    Table: {
      ...sharedComponents.Table,
      headerBg: '#1f1f1f',
      headerColor: '#ffffff',
    },
    Modal: {
      ...sharedComponents.Modal,
      headerBg: '#1f1f1f',
      contentBg: '#1f1f1f',
      footerBg: '#1f1f1f',
    },
    Form: {
      ...sharedComponents.Form,
      labelColor: '#e2e8f0',
    },
    Tag: {
      ...sharedComponents.Tag,
      defaultBg: '#303030',
      defaultColor: '#d9d9d9',
    },
    Button: {
      ...sharedComponents.Button,
      defaultBorderColor: '#424242',
    },
    Menu: {
      ...sharedComponents.Menu,
      // 暗色主题：二级子菜单背景色（较深）
      subMenuItemBg: 'rgba(255, 255, 255, 0.04)',
    },
  },
};

// 保持向后兼容
export const theme = lightTheme;
