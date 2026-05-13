/**
 * 权限常量定义 - 遵循KISS原则，简化权限体系
 * 基于租户的多租户系统，只保留三种核心角色：超级管理员、普通用户、只读用户
 *
 * 重要说明：
 * 1. 超级管理员不可以修改自己的角色，以防改错了
 * 2. 普通用户除了系统设置，拥有其他大部分查看自己创建内容的权限
 * 3. 基于租户的系统，数据完全隔离
 * 4. 权限名称与后端 UserPermissionConstants 保持一致
 */

// 用户角色常量
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  REGULAR_USER: 'regular_user', 
  VIEWER: 'viewer'
};

// 权限常量 - 与后端 UserPermissionConstants 保持一致
export const PERMISSIONS = {
  // 菜单权限
  MENU_ACTION_TASKS: 'menu:action-tasks',
  MENU_AGENTS: 'menu:agents',
  MENU_ACTION_SPACES: 'menu:action-spaces',
  MENU_SETTINGS: 'menu:settings',
  MENU_SETTINGS_ADMIN: 'menu:settings-admin',
  MENU_SETTINGS_GENERAL: 'menu:settings-general',
  MENU_SETTINGS_MODEL: 'menu:settings-model',
  MENU_SETTINGS_USERS: 'menu:settings-users',
  MENU_SETTINGS_MCP: 'menu:settings-mcp',
  MENU_SETTINGS_GRAPH: 'menu:settings-graph',
  MENU_SETTINGS_LOGS: 'menu:settings-logs',
  MENU_SETTINGS_ABOUT: 'menu:settings-about',
  MENU_USERS: 'menu:users',
  MENU_LOGS: 'menu:logs',

  // 任务权限
  TASK_VIEW_ALL: 'task:view-all',
  TASK_VIEW_OWN: 'task:view-own',
  TASK_CREATE: 'task:create',
  TASK_EDIT: 'task:edit',
  TASK_DELETE: 'task:delete',
  TASK_ASSIGN: 'task:assign',

  // 用户权限
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',

  // 智能体权限
  AGENT_VIEW: 'agent:view',
  AGENT_CREATE: 'agent:create',
  AGENT_EDIT: 'agent:edit',
  AGENT_DELETE: 'agent:delete',
  AGENT_MANAGE: 'agent:manage',

  // 行动空间权限
  SPACE_VIEW: 'space:view',
  SPACE_CREATE: 'space:create',
  SPACE_EDIT: 'space:edit',
  SPACE_DELETE: 'space:delete',
  SPACE_MANAGE: 'space:manage',

  // 系统设置权限
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  SETTINGS_MANAGE: 'settings:manage',
};

// 角色权限映射 - 与后端 seed_data_user_role_permission.json 保持一致
export const ROLE_PERMISSIONS = {
  [USER_ROLES.SUPER_ADMIN]: [
    // 超级管理员拥有所有权限
    ...Object.values(PERMISSIONS)
  ],

  [USER_ROLES.REGULAR_USER]: [
    // 菜单权限
    PERMISSIONS.MENU_ACTION_TASKS,
    PERMISSIONS.MENU_AGENTS,
    PERMISSIONS.MENU_ACTION_SPACES,
    PERMISSIONS.MENU_SETTINGS,
    PERMISSIONS.MENU_SETTINGS_ABOUT,
    // 任务权限
    PERMISSIONS.TASK_VIEW_OWN,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_EDIT,
    PERMISSIONS.TASK_DELETE,
    // 智能体权限
    PERMISSIONS.AGENT_VIEW,
    PERMISSIONS.AGENT_CREATE,
    PERMISSIONS.AGENT_EDIT,
    PERMISSIONS.AGENT_DELETE,
    // 行动空间权限
    PERMISSIONS.SPACE_VIEW,
    PERMISSIONS.SPACE_CREATE,
    PERMISSIONS.SPACE_EDIT,
    PERMISSIONS.SPACE_DELETE,
  ],

  [USER_ROLES.VIEWER]: [
    // 菜单权限
    PERMISSIONS.MENU_ACTION_TASKS,
    PERMISSIONS.MENU_AGENTS,
    PERMISSIONS.MENU_ACTION_SPACES,
    PERMISSIONS.MENU_SETTINGS,
    PERMISSIONS.MENU_SETTINGS_ABOUT,
    // 任务权限
    PERMISSIONS.TASK_VIEW_OWN,
    // 智能体权限
    PERMISSIONS.AGENT_VIEW,
    // 行动空间权限
    PERMISSIONS.SPACE_VIEW,
  ]
};

// 获取用户的权限列表
export const getUserPermissions = (user) => {
  if (!user) return [];

  // 获取用户角色
  const userRole = user.roles && user.roles.length > 0
    ? user.roles[0].user_role?.name
    : null;

  // 根据角色返回权限列表
  if (userRole && ROLE_PERMISSIONS[userRole]) {
    return ROLE_PERMISSIONS[userRole];
  }

  return [];
};

// 权限检查辅助函数
export const hasPermission = (userPermissions, requiredPermission) => {
  if (!requiredPermission) return true;
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  return userPermissions.includes(requiredPermission);
};

export const hasAnyPermission = (userPermissions, requiredPermissions) => {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  return requiredPermissions.some(permission => userPermissions.includes(permission));
};

export const hasAllPermissions = (userPermissions, requiredPermissions) => {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  return requiredPermissions.every(permission => userPermissions.includes(permission));
};

// 角色显示名称
export const ROLE_DISPLAY_NAMES = {
  [USER_ROLES.SUPER_ADMIN]: '超级管理员',
  [USER_ROLES.REGULAR_USER]: '普通用户',
  [USER_ROLES.VIEWER]: '只读用户'
};

// 角色描述
export const ROLE_DESCRIPTIONS = {
  [USER_ROLES.SUPER_ADMIN]: '拥有租户内所有权限的超级管理员',
  [USER_ROLES.REGULAR_USER]: '普通用户，可以创建和管理自己的任务、行动空间',
  [USER_ROLES.VIEWER]: '只读用户，只能查看自己创建的内容，不能进行修改操作'
};

// 特殊权限控制辅助函数
export const canEditUserRole = (currentUser, targetUser) => {
  // 超级管理员不能修改自己的角色
  if (currentUser.is_admin && currentUser.id === targetUser.id) {
    return false;
  }
  // 只有超级管理员可以修改其他用户的角色
  return currentUser.is_admin;
};

export const canDeleteUser = (currentUser, targetUser) => {
  // 不能删除自己
  if (currentUser.id === targetUser.id) {
    return false;
  }
  // 只有超级管理员可以删除用户
  return currentUser.is_admin;
};

export const canEditContent = (currentUser, contentOwnerId, permission) => {
  // 超级管理员可以编辑所有内容
  if (currentUser.is_admin) {
    return true;
  }
  // 普通用户只能编辑自己创建的内容
  if (currentUser.id === contentOwnerId && hasPermission(currentUser.permissions, permission)) {
    return true;
  }
  return false;
};

export const canViewContent = (currentUser, contentOwnerId, isPublic = false) => {
  // 超级管理员可以查看所有内容
  if (currentUser.is_admin) {
    return true;
  }
  // 可以查看自己创建的内容
  if (currentUser.id === contentOwnerId) {
    return true;
  }
  // 可以查看公开内容
  if (isPublic) {
    return true;
  }
  return false;
};
