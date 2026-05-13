import {
  DashboardOutlined,
  GlobalOutlined,
  SettingOutlined,
  HomeOutlined,
  MonitorOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  EnvironmentOutlined,
  BarChartOutlined,
  OrderedListOutlined,
  ShopOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  DatabaseOutlined,
  ToolOutlined,
  RobotOutlined,
  PartitionOutlined,
  FolderOutlined,
  ControlOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  CodeOutlined,
  ShareAltOutlined,
  ApiOutlined,
  ProjectOutlined,
  CloudServerOutlined,
  StarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  CrownOutlined,
  MessageOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';

// 图标映射 - 存储组件引用而不是实例
export const iconMap = {
  DashboardOutlined,
  GlobalOutlined,
  SettingOutlined,
  HomeOutlined,
  MonitorOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  EnvironmentOutlined,
  BarChartOutlined,
  OrderedListOutlined,
  ShopOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  DatabaseOutlined,
  ToolOutlined,
  RobotOutlined,
  PartitionOutlined,
  FolderOutlined,
  ControlOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  CodeOutlined,
  ShareAltOutlined,
  ApiOutlined,
  ProjectOutlined,
  CloudServerOutlined,
  StarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  CrownOutlined,
  MessageOutlined,
  ThunderboltOutlined
};

/**
 * 统一的菜单配置
 * 供经典布局和现代布局共享
 */
export const menuConfig = [
  // 工作台
  {
    key: 'dashboard',
    icon: 'DashboardOutlined',
    labelKey: 'menu.systemOverview',
    path: '/home',
    children: null
  },
  
  // 任务管理
  {
    key: 'tasks',
    icon: 'ProjectOutlined',
    labelKey: 'menu.actionCenter',
    path: null,
    children: [
      {
        key: 'tasks-overview',
        labelKey: 'menu.taskManagement',
        path: '/action-tasks/overview',
        icon: 'OrderedListOutlined'
      },
      {
        key: 'tasks-monitoring',
        labelKey: 'menu.actionMonitoring',
        path: '/action-tasks/monitoring',
        icon: 'MonitorOutlined'
      },
      {
        key: 'tasks-workspace',
        labelKey: 'menu.workspaceBrowser',
        path: '/workspace/browser',
        icon: 'FolderOutlined'
      }
    ]
  },
  
  // 并行实验室
  {
    key: 'parallel-lab',
    icon: 'ExperimentOutlined',
    labelKey: 'menu.parallelLab',
    path: null,
    children: [
      {
        key: 'parallel-lab-list',
        labelKey: 'menu.experimentList',
        path: '/parallel-lab/list',
        icon: 'OrderedListOutlined'
      },
      {
        key: 'parallel-lab-monitoring',
        labelKey: 'menu.executionMonitoring',
        path: '/parallel-lab/monitoring',
        icon: 'MonitorOutlined'
      },
      {
        key: 'parallel-lab-analysis',
        labelKey: 'menu.analysisReport',
        path: '/parallel-lab/analysis',
        icon: 'BarChartOutlined'
      }
    ]
  },
  
  // 智能体
  {
    key: 'agents',
    icon: 'RobotOutlined',
    labelKey: 'menu.rolesAndAgents',
    path: null,
    children: [
      {
        key: 'agents-roles',
        labelKey: 'menu.roleManagement',
        path: '/roles/management',
        icon: 'UserOutlined'
      },
      {
        key: 'agents-tools',
        labelKey: 'menu.capabilitiesAndTools',
        path: '/roles/tools',
        icon: 'ToolOutlined'
      },
      {
        key: 'agents-skills',
        labelKey: 'menu.skillManagement',
        path: '/roles/skills',
        icon: 'ThunderboltOutlined'
      },
      {
        key: 'agents-memory',
        labelKey: 'menu.memoryManagement',
        path: '/memory',
        icon: 'PartitionOutlined'
      }
    ]
  },
  
  // 知识库管理
  {
    key: 'knowledge',
    icon: 'DatabaseOutlined',
    labelKey: 'menu.knowledgeBaseManagement',
    path: null,
    children: [
      {
        key: 'knowledge-internal',
        labelKey: 'menu.knowledgeInternal',
        path: '/knowledges/internal',
        icon: 'DatabaseOutlined'
      },
      {
        key: 'knowledge-external',
        labelKey: 'menu.knowledgeExternal',
        path: '/knowledges/external',
        icon: 'LinkOutlined'
      },
      {
        key: 'knowledge-bindings',
        labelKey: 'menu.knowledgeBindings',
        path: '/knowledges/bindings',
        icon: 'TeamOutlined'
      },
      {
        key: 'knowledge-evaluation',
        labelKey: 'menu.knowledgeEvaluation',
        path: '/knowledges/evaluation',
        icon: 'ExperimentOutlined'
      }
    ]
  },
  
  // 行动空间
  {
    key: 'spaces',
    icon: 'GlobalOutlined',
    labelKey: 'menu.actionSpaceManagement',
    path: null,
    children: [
      {
        key: 'spaces-overview',
        labelKey: 'menu.actionSpace',
        path: '/action-spaces/overview',
        icon: 'AppstoreOutlined'
      },
      {
        key: 'spaces-joint',
        labelKey: 'menu.jointSpace',
        path: '/action-spaces/joint',
        icon: 'LinkOutlined'
      },
      {
        key: 'spaces-rules',
        labelKey: 'menu.actionRules',
        path: '/action-spaces/rules',
        icon: 'ApartmentOutlined'
      },
      {
        key: 'spaces-env',
        labelKey: 'menu.environmentVariables',
        path: '/action-spaces/environment',
        icon: 'EnvironmentOutlined'
      },
      {
        key: 'spaces-market',
        labelKey: 'menu.entityMarket',
        path: '/action-spaces/market',
        icon: 'ShopOutlined'
      }
    ]
  },
  
  // 账户中心
  {
    key: 'account',
    icon: 'UserOutlined',
    labelKey: 'menu.account',
    path: null,
    adminOnly: false,
    children: [
      {
        key: 'account-profile',
        labelKey: 'menu.profile',
        path: '/account/profile',
        icon: 'UserOutlined',
        adminOnly: false
      },
      {
        key: 'account-subscription',
        labelKey: 'menu.mySubscription',
        path: '/account/subscription',
        icon: 'CrownOutlined',
        adminOnly: false
      },
      {
        key: 'account-team',
        labelKey: 'menu.teamSettings',
        path: '/account/team',
        icon: 'TeamOutlined',
        adminOnly: false
      },
      {
        key: 'account-im',
        labelKey: 'menu.imIntegration',
        path: '/account/im-integration',
        icon: 'MessageOutlined',
        adminOnly: false
      }
    ]
  },

  // 系统设置
  {
    key: 'settings',
    icon: 'SettingOutlined',
    labelKey: 'menu.systemSettings',
    path: null,
    adminOnly: true,
    children: [
      {
        key: 'settings-general',
        labelKey: 'menu.basicConfiguration',
        path: '/settings/general',
        icon: 'SafetyCertificateOutlined',
        adminOnly: true
      },
      {
        key: 'settings-model',
        labelKey: 'menu.modelConfiguration',
        path: '/settings/model-configs',
        icon: 'ApiOutlined',
        adminOnly: true
      },
      {
        key: 'settings-users',
        labelKey: 'menu.userManagement',
        path: '/settings/users',
        icon: 'UserOutlined',
        adminOnly: true
      },
      {
        key: 'settings-subscription-management',
        labelKey: 'menu.subscriptionManagement',
        path: '/settings/subscription-management',
        icon: 'CrownOutlined',
        adminOnly: true
      },
      {
        key: 'settings-mcp',
        labelKey: 'menu.mcpServers',
        path: '/settings/mcp-servers',
        icon: 'ControlOutlined',
        adminOnly: true
      },

      {
        key: 'settings-graph',
        labelKey: 'menu.graphEnhancement',
        path: '/settings/graph-enhancement',
        icon: 'ShareAltOutlined',
        adminOnly: true
      },
      {
        key: 'settings-logs',
        labelKey: 'menu.runningLogs',
        path: '/settings/logs',
        icon: 'CodeOutlined',
        adminOnly: true
      },
      {
        key: 'settings-about',
        labelKey: 'menu.aboutSystem',
        path: '/settings/about',
        icon: 'InfoCircleOutlined',
        adminOnly: false
      }
    ]
  }
];

/**
 * 获取图标组件
 */
export const getIcon = (iconName) => {
  const IconComponent = iconMap[iconName];
  return IconComponent ? IconComponent : null;
};

/**
 * 多列布局配置
 * 用于现代样式的多列抽屉
 * 3列布局
 */
export const multiColumnConfig: Array<{
  key: string;
  titleKey: string;
  sections: string[];
  type?: string;
}> = [
  {
    key: 'col-main',
    titleKey: 'menu.mainMenu',
    sections: ['dashboard', 'tasks', 'parallel-lab']
  },
  {
    key: 'col-templates',
    titleKey: 'menu.taskTemplates',
    sections: ['agents', 'knowledge', 'spaces']
  },
  {
    key: 'col-settings',
    titleKey: 'menu.systemSettings',
    sections: ['account', 'settings']
  }
];

/**
 * 根据路径查找菜单项
 */
export const findMenuItemByPath = (path, menus = menuConfig) => {
  for (const menu of menus) {
    if (menu.path === path) {
      return menu;
    }
    if (menu.children) {
      const found = menu.children.find(child => child.path === path);
      if (found) {
        return { parent: menu, item: found };
      }
    }
  }
  return null;
};

/**
 * 路径别名映射
 * 处理路由路径和菜单路径不一致的情况
 */
const pathAliasMap = {
  'action-space': 'action-spaces',  // /action-space/detail/* -> /action-spaces/*
  'action-task': 'action-tasks',    // 如果有的话
  'knowledge': 'knowledges',        // /knowledge/* -> /knowledges/*
  'parallel-lab': 'parallel-lab',   // /parallel-lab/* -> /parallel-lab/*
};

/**
 * 根据路径推断当前Section（一级菜单）
 * 例如：/action-tasks/detail/123 -> tasks section
 *       /action-space/detail/123 -> spaces section
 */
export const inferSectionFromPath = (pathname, menus = menuConfig) => {
  // 提取路径的第一段，如 /action-tasks, /action-space, /roles, /memory 等
  let firstSegment = pathname.split('/').filter(Boolean)[0];
  if (!firstSegment) return null;
  
  // 检查是否有路径别名
  if (pathAliasMap[firstSegment]) {
    firstSegment = pathAliasMap[firstSegment];
  }
  
  const pathPrefix = `/${firstSegment}`;
  
  // 查找包含匹配路径的section
  for (const section of menus) {
    // 检查一级菜单自身的路径
    if (section.path && section.path.startsWith(pathPrefix)) {
      return section;
    }
    
    // 检查子菜单的路径
    if (section.children) {
      const matched = section.children.find(child => 
        child.path && child.path.startsWith(pathPrefix)
      );
      if (matched) {
        return section;
      }
    }
  }
  
  return null;
};

/**
 * 过滤需要管理员权限的菜单
 */
export const filterMenuByPermission = (menus, isAdmin) => {
  return menus
    .filter(menu => !menu.adminOnly || isAdmin)
    .map(menu => ({
      ...menu,
      children: menu.children?.filter(child => !child.adminOnly || isAdmin)
    }));
};
