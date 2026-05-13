"""
用户权限管理服务

提供用户权限检查、角色管理等功能
"""
from typing import List, Dict, Any, Optional
from app.models import User
from app.models import UserRole, UserPermission, UserRoleAssignment, UserRolePermission, UserPermissionConstants, DefaultUserRoles
from app.extensions import db
from sqlalchemy import and_

class UserPermissionService:
    """用户权限管理服务"""
    
    @staticmethod
    def get_user_permissions(user: User) -> List[str]:
        """获取用户的所有权限"""
        if not user:
            return []
        
        # 如果是超级管理员（兼容旧系统）
        if user.is_admin:
            return UserPermissionService.get_all_permission_names()
        
        # 通过用户角色获取权限
        permissions = db.session.query(UserPermission.name).join(
            UserRolePermission, UserPermission.id == UserRolePermission.user_permission_id
        ).join(
            UserRole, UserRolePermission.user_role_id == UserRole.id
        ).join(
            UserRoleAssignment, UserRole.id == UserRoleAssignment.user_role_id
        ).filter(
            and_(
                UserRoleAssignment.user_id == user.id,
                UserRole.is_active == True
            )
        ).distinct().all()
        
        return [p.name for p in permissions]
    
    @staticmethod
    def has_permission(user: User, permission_name: str) -> bool:
        """检查用户是否有指定权限"""
        if not user:
            return False
        
        # 超级管理员拥有所有权限
        if user.is_admin:
            return True
        
        user_permissions = UserPermissionService.get_user_permissions(user)
        return permission_name in user_permissions
    
    @staticmethod
    def has_any_permission(user: User, permission_names: List[str]) -> bool:
        """检查用户是否有任意一个权限"""
        if not user:
            return False
        
        if user.is_admin:
            return True
        
        user_permissions = UserPermissionService.get_user_permissions(user)
        return any(perm in user_permissions for perm in permission_names)
    
    @staticmethod
    def has_all_permissions(user: User, permission_names: List[str]) -> bool:
        """检查用户是否有所有权限"""
        if not user:
            return False
        
        if user.is_admin:
            return True
        
        user_permissions = UserPermissionService.get_user_permissions(user)
        return all(perm in user_permissions for perm in permission_names)
    
    @staticmethod
    def get_user_roles(user: User) -> List[Dict[str, Any]]:
        """获取用户的角色列表"""
        if not user:
            return []
        
        user_role_assignments = db.session.query(UserRoleAssignment).filter_by(user_id=user.id).all()
        return [ura.to_dict() for ura in user_role_assignments]
    
    @staticmethod
    def get_user_roles_by_user_id(user_id: int) -> List[Dict[str, Any]]:
        """根据用户ID获取用户的角色列表"""
        user_role_assignments = db.session.query(UserRoleAssignment).filter_by(user_id=user_id).all()
        return [ura.to_dict() for ura in user_role_assignments]
    
    @staticmethod
    def assign_role_to_user(user_id: int, user_role_id: int, assigned_by: int) -> bool:
        """为用户分配角色"""
        try:
            # 检查是否已经有该角色
            existing = UserRoleAssignment.query.filter_by(user_id=user_id, user_role_id=user_role_id).first()
            if existing:
                return True
            
            user_role_assignment = UserRoleAssignment(
                user_id=user_id,
                user_role_id=user_role_id,
                assigned_by=assigned_by
            )
            db.session.add(user_role_assignment)
            db.session.commit()
            return True
        except Exception:
            db.session.rollback()
            return False
    
    @staticmethod
    def remove_role_from_user(user_id: int, user_role_id: int) -> bool:
        """移除用户的角色"""
        try:
            user_role_assignment = UserRoleAssignment.query.filter_by(user_id=user_id, user_role_id=user_role_id).first()
            if user_role_assignment:
                db.session.delete(user_role_assignment)
                db.session.commit()
            return True
        except Exception:
            db.session.rollback()
            return False
    
    @staticmethod
    def get_menu_permissions(user: User) -> List[str]:
        """获取用户的菜单权限"""
        user_permissions = UserPermissionService.get_user_permissions(user)
        menu_permissions = [p for p in user_permissions if p.startswith('menu:')]
        return menu_permissions
    
    @staticmethod
    def can_access_menu(user: User, menu_name: str) -> bool:
        """检查用户是否可以访问指定菜单"""
        menu_permission = f'menu:{menu_name}'
        return UserPermissionService.has_permission(user, menu_permission)
    
    @staticmethod
    def get_all_permission_names() -> List[str]:
        """获取所有权限名称 - 与 seed_data_user_role_permission.json 保持一致"""
        return [
            # 菜单权限
            UserPermissionConstants.MENU_ACTION_TASKS,
            UserPermissionConstants.MENU_AGENTS,
            UserPermissionConstants.MENU_ACTION_SPACES,
            UserPermissionConstants.MENU_SETTINGS,
            UserPermissionConstants.MENU_SETTINGS_ADMIN,
            UserPermissionConstants.MENU_SETTINGS_GENERAL,
            UserPermissionConstants.MENU_SETTINGS_MODEL,
            UserPermissionConstants.MENU_SETTINGS_USERS,
            UserPermissionConstants.MENU_SETTINGS_MCP,
            UserPermissionConstants.MENU_SETTINGS_GRAPH,
            UserPermissionConstants.MENU_SETTINGS_LOGS,
            UserPermissionConstants.MENU_SETTINGS_ABOUT,
            UserPermissionConstants.MENU_USERS,
            UserPermissionConstants.MENU_LOGS,
            
            # 任务权限
            UserPermissionConstants.TASK_VIEW_ALL,
            UserPermissionConstants.TASK_VIEW_OWN,
            UserPermissionConstants.TASK_CREATE,
            UserPermissionConstants.TASK_EDIT,
            UserPermissionConstants.TASK_DELETE,
            UserPermissionConstants.TASK_ASSIGN,
            
            # 用户权限
            UserPermissionConstants.USER_VIEW,
            UserPermissionConstants.USER_CREATE,
            UserPermissionConstants.USER_EDIT,
            UserPermissionConstants.USER_DELETE,
            UserPermissionConstants.USER_MANAGE,
            
            # 智能体权限
            UserPermissionConstants.AGENT_VIEW,
            UserPermissionConstants.AGENT_CREATE,
            UserPermissionConstants.AGENT_EDIT,
            UserPermissionConstants.AGENT_DELETE,
            UserPermissionConstants.AGENT_MANAGE,
            
            # 行动空间权限
            UserPermissionConstants.SPACE_VIEW,
            UserPermissionConstants.SPACE_CREATE,
            UserPermissionConstants.SPACE_EDIT,
            UserPermissionConstants.SPACE_DELETE,
            UserPermissionConstants.SPACE_MANAGE,
            
            # 系统设置权限
            UserPermissionConstants.SETTINGS_VIEW,
            UserPermissionConstants.SETTINGS_EDIT,
            UserPermissionConstants.SETTINGS_MANAGE,
        ]
    
    @staticmethod
    def initialize_default_permissions():
        """初始化默认权限 - 与 seed_data_user_role_permission.json 保持一致"""
        permissions_data = [
            # 菜单权限
            {'name': UserPermissionConstants.MENU_ACTION_TASKS, 'display_name': '行动任务菜单', 'description': '访问行动任务菜单', 'category': 'menu', 'resource': 'tasks', 'action': 'view'},
            {'name': UserPermissionConstants.MENU_AGENTS, 'display_name': '智能体菜单', 'description': '访问智能体菜单', 'category': 'menu', 'resource': 'agents', 'action': 'view'},
            {'name': UserPermissionConstants.MENU_ACTION_SPACES, 'display_name': '行动空间菜单', 'description': '访问行动空间菜单', 'category': 'menu', 'resource': 'spaces', 'action': 'view'},
            {'name': UserPermissionConstants.MENU_SETTINGS, 'display_name': '系统设置菜单', 'description': '访问系统设置菜单', 'category': 'menu', 'resource': 'settings', 'action': 'view'},
            {'name': UserPermissionConstants.MENU_SETTINGS_ADMIN, 'display_name': '系统设置管理', 'description': '访问系统设置管理功能（超级管理员）', 'category': 'menu', 'resource': 'settings', 'action': 'admin'},
            {'name': UserPermissionConstants.MENU_SETTINGS_GENERAL, 'display_name': '基本配置菜单', 'description': '访问系统设置-基本配置子菜单', 'category': 'menu', 'resource': 'settings', 'action': 'view-general'},
            {'name': UserPermissionConstants.MENU_SETTINGS_MODEL, 'display_name': '模型配置菜单', 'description': '访问系统设置-模型配置子菜单', 'category': 'menu', 'resource': 'settings', 'action': 'view-model'},
            {'name': UserPermissionConstants.MENU_SETTINGS_USERS, 'display_name': '用户管理菜单', 'description': '访问系统设置-用户管理子菜单', 'category': 'menu', 'resource': 'settings', 'action': 'view-users'},
            {'name': UserPermissionConstants.MENU_SETTINGS_MCP, 'display_name': 'MCP服务器菜单', 'description': '访问系统设置-MCP服务器子菜单', 'category': 'menu', 'resource': 'settings', 'action': 'view-mcp'},
            {'name': UserPermissionConstants.MENU_SETTINGS_GRAPH, 'display_name': '图增强菜单', 'description': '访问系统设置-图增强子菜单', 'category': 'menu', 'resource': 'settings', 'action': 'view-graph'},
            {'name': UserPermissionConstants.MENU_SETTINGS_LOGS, 'display_name': '系统日志菜单', 'description': '访问系统设置-系统日志子菜单', 'category': 'menu', 'resource': 'settings', 'action': 'view-logs'},
            {'name': UserPermissionConstants.MENU_SETTINGS_ABOUT, 'display_name': '关于系统菜单', 'description': '访问系统设置-关于系统子菜单', 'category': 'menu', 'resource': 'settings', 'action': 'view-about'},
            {'name': UserPermissionConstants.MENU_USERS, 'display_name': '用户管理菜单', 'description': '访问用户管理菜单', 'category': 'menu', 'resource': 'users', 'action': 'view'},
            {'name': UserPermissionConstants.MENU_LOGS, 'display_name': '系统日志菜单', 'description': '访问系统日志菜单', 'category': 'menu', 'resource': 'logs', 'action': 'view'},
            
            # 任务权限
            {'name': UserPermissionConstants.TASK_VIEW_ALL, 'display_name': '查看所有任务', 'description': '查看系统中所有用户的任务', 'category': 'feature', 'resource': 'tasks', 'action': 'view-all'},
            {'name': UserPermissionConstants.TASK_VIEW_OWN, 'display_name': '查看自己的任务', 'description': '只能查看自己创建的任务', 'category': 'feature', 'resource': 'tasks', 'action': 'view-own'},
            {'name': UserPermissionConstants.TASK_CREATE, 'display_name': '创建任务', 'description': '创建新的行动任务', 'category': 'feature', 'resource': 'tasks', 'action': 'create'},
            {'name': UserPermissionConstants.TASK_EDIT, 'display_name': '编辑任务', 'description': '编辑现有任务', 'category': 'feature', 'resource': 'tasks', 'action': 'edit'},
            {'name': UserPermissionConstants.TASK_DELETE, 'display_name': '删除任务', 'description': '删除任务', 'category': 'feature', 'resource': 'tasks', 'action': 'delete'},
            {'name': UserPermissionConstants.TASK_ASSIGN, 'display_name': '分配任务', 'description': '将任务分配给其他用户', 'category': 'feature', 'resource': 'tasks', 'action': 'assign'},
            
            # 用户权限
            {'name': UserPermissionConstants.USER_VIEW, 'display_name': '查看用户', 'description': '查看用户信息', 'category': 'data', 'resource': 'users', 'action': 'view'},
            {'name': UserPermissionConstants.USER_CREATE, 'display_name': '创建用户', 'description': '创建新用户', 'category': 'data', 'resource': 'users', 'action': 'create'},
            {'name': UserPermissionConstants.USER_EDIT, 'display_name': '编辑用户', 'description': '编辑用户信息', 'category': 'data', 'resource': 'users', 'action': 'edit'},
            {'name': UserPermissionConstants.USER_DELETE, 'display_name': '删除用户', 'description': '删除用户', 'category': 'data', 'resource': 'users', 'action': 'delete'},
            {'name': UserPermissionConstants.USER_MANAGE, 'display_name': '用户管理', 'description': '完整的用户管理权限', 'category': 'data', 'resource': 'users', 'action': 'manage'},
            
            # 智能体权限
            {'name': UserPermissionConstants.AGENT_VIEW, 'display_name': '查看智能体', 'description': '查看智能体信息', 'category': 'feature', 'resource': 'agents', 'action': 'view'},
            {'name': UserPermissionConstants.AGENT_CREATE, 'display_name': '创建智能体', 'description': '创建新智能体', 'category': 'feature', 'resource': 'agents', 'action': 'create'},
            {'name': UserPermissionConstants.AGENT_EDIT, 'display_name': '编辑智能体', 'description': '编辑智能体配置', 'category': 'feature', 'resource': 'agents', 'action': 'edit'},
            {'name': UserPermissionConstants.AGENT_DELETE, 'display_name': '删除智能体', 'description': '删除智能体', 'category': 'feature', 'resource': 'agents', 'action': 'delete'},
            {'name': UserPermissionConstants.AGENT_MANAGE, 'display_name': '智能体管理', 'description': '完整的智能体管理权限', 'category': 'feature', 'resource': 'agents', 'action': 'manage'},
            
            # 行动空间权限
            {'name': UserPermissionConstants.SPACE_VIEW, 'display_name': '查看行动空间', 'description': '查看行动空间信息', 'category': 'feature', 'resource': 'spaces', 'action': 'view'},
            {'name': UserPermissionConstants.SPACE_CREATE, 'display_name': '创建行动空间', 'description': '创建新行动空间', 'category': 'feature', 'resource': 'spaces', 'action': 'create'},
            {'name': UserPermissionConstants.SPACE_EDIT, 'display_name': '编辑行动空间', 'description': '编辑行动空间配置', 'category': 'feature', 'resource': 'spaces', 'action': 'edit'},
            {'name': UserPermissionConstants.SPACE_DELETE, 'display_name': '删除行动空间', 'description': '删除行动空间', 'category': 'feature', 'resource': 'spaces', 'action': 'delete'},
            {'name': UserPermissionConstants.SPACE_MANAGE, 'display_name': '行动空间管理', 'description': '完整的行动空间管理权限', 'category': 'feature', 'resource': 'spaces', 'action': 'manage'},
            
            # 系统设置权限
            {'name': UserPermissionConstants.SETTINGS_VIEW, 'display_name': '查看系统设置', 'description': '查看系统设置', 'category': 'feature', 'resource': 'settings', 'action': 'view'},
            {'name': UserPermissionConstants.SETTINGS_EDIT, 'display_name': '编辑系统设置', 'description': '编辑系统设置', 'category': 'feature', 'resource': 'settings', 'action': 'edit'},
            {'name': UserPermissionConstants.SETTINGS_MANAGE, 'display_name': '系统设置管理', 'description': '完整的系统设置管理权限', 'category': 'feature', 'resource': 'settings', 'action': 'manage'},
        ]
        
        for perm_data in permissions_data:
            existing = UserPermission.query.filter_by(name=perm_data['name']).first()
            if not existing:
                permission = UserPermission(
                    name=perm_data['name'],
                    display_name=perm_data['display_name'],
                    description=perm_data.get('description', ''),
                    category=perm_data['category'],
                    resource=perm_data['resource'],
                    action=perm_data['action'],
                    is_system=True
                )
                db.session.add(permission)
        
        db.session.commit()
    
    @staticmethod
    def initialize_default_roles():
        """初始化默认角色 - 简化为三种核心角色"""
        roles_data = [
            DefaultUserRoles.SUPER_ADMIN,
            DefaultUserRoles.REGULAR_USER,
            DefaultUserRoles.VIEWER
        ]

        for role_data in roles_data:
            existing = UserRole.query.filter_by(name=role_data['name']).first()
            if not existing:
                role = UserRole(**role_data)
                db.session.add(role)

        db.session.commit()

    @staticmethod
    def initialize_default_role_permissions():
        """为默认角色分配权限"""
        # 获取所有权限
        all_permissions = UserPermission.query.all()
        permission_map = {p.name: p.id for p in all_permissions}

        # 角色权限配置 - 简化为三种核心角色
        role_permissions = {
            'super_admin': list(permission_map.keys()),  # 超级管理员拥有所有权限
            'regular_user': [
                # 菜单权限 - 可以访问系统设置查看"关于系统"，但不能访问管理功能
                UserPermissionConstants.MENU_ACTION_TASKS,
                UserPermissionConstants.MENU_AGENTS,
                UserPermissionConstants.MENU_ACTION_SPACES,
                UserPermissionConstants.MENU_SETTINGS,
                # 任务权限 - 可以创建和管理自己创建的任务
                UserPermissionConstants.TASK_VIEW_OWN,
                UserPermissionConstants.TASK_CREATE,
                UserPermissionConstants.TASK_EDIT,
                UserPermissionConstants.TASK_DELETE,
                # 智能体权限 - 可以查看租户内智能体，创建和管理自己的智能体
                UserPermissionConstants.AGENT_VIEW,
                UserPermissionConstants.AGENT_CREATE,
                UserPermissionConstants.AGENT_EDIT,
                UserPermissionConstants.AGENT_DELETE,
                # 行动空间权限 - 可以创建和管理自己创建的行动空间
                UserPermissionConstants.SPACE_VIEW,
                UserPermissionConstants.SPACE_CREATE,
                UserPermissionConstants.SPACE_EDIT,
                UserPermissionConstants.SPACE_DELETE,
            ],
            'viewer': [
                # 菜单权限 - 只能查看
                UserPermissionConstants.MENU_ACTION_TASKS,
                UserPermissionConstants.MENU_AGENTS,
                UserPermissionConstants.MENU_ACTION_SPACES,
                UserPermissionConstants.MENU_SETTINGS,
                # 任务权限 - 只能查看自己的任务
                UserPermissionConstants.TASK_VIEW_OWN,
                # 智能体权限 - 只能查看
                UserPermissionConstants.AGENT_VIEW,
                # 行动空间权限 - 只能查看
                UserPermissionConstants.SPACE_VIEW,
            ]
        }

        for role_name, permissions in role_permissions.items():
            role = UserRole.query.filter_by(name=role_name).first()
            if role:
                # 清除现有权限
                UserRolePermission.query.filter_by(user_role_id=role.id).delete()

                # 分配新权限
                for perm_name in permissions:
                    if perm_name in permission_map:
                        role_perm = UserRolePermission(
                            user_role_id=role.id,
                            user_permission_id=permission_map[perm_name]
                        )
                        db.session.add(role_perm)

        db.session.commit()

    @staticmethod
    def can_edit_user_role(current_user: User, target_user: User) -> bool:
        """检查是否可以编辑用户角色"""
        # 超级管理员不能修改自己的角色，防止误操作
        if current_user.is_admin and current_user.id == target_user.id:
            return False
        # 只有超级管理员可以修改其他用户的角色
        return current_user.is_admin

    @staticmethod
    def can_delete_user(current_user: User, target_user: User) -> bool:
        """检查是否可以删除用户"""
        # 不能删除自己
        if current_user.id == target_user.id:
            return False
        # 只有超级管理员可以删除用户
        return current_user.is_admin

    @staticmethod
    def can_edit_content(current_user: User, content_owner_id: str, permission_name: str) -> bool:
        """检查是否可以编辑内容（基于所有权的权限控制）"""
        # 超级管理员可以编辑租户内所有内容
        if current_user.is_admin:
            return True
        # 普通用户只能编辑自己创建的内容
        if current_user.id == content_owner_id and UserPermissionService.has_permission(current_user, permission_name):
            return True
        return False

    @staticmethod
    def can_view_content(current_user: User, content_owner_id: str, is_public: bool = False) -> bool:
        """检查是否可以查看内容"""
        # 超级管理员可以查看租户内所有内容
        if current_user.is_admin:
            return True
        # 可以查看自己创建的内容
        if current_user.id == content_owner_id:
            return True
        # 可以查看公开内容
        if is_public:
            return True
        return False

    # ==================== 多租户资源权限控制 ====================

    @staticmethod
    def can_view_resource(current_user: User, resource) -> bool:
        """检查是否可以查看资源

        Args:
            current_user: 当前用户
            resource: 资源对象（需要有 created_by 和 is_shared 属性）

        Returns:
            bool: 是否可以查看
        """
        # 超级管理员可以查看所有资源
        if current_user.is_admin:
            return True

        # 共享资源所有人可见
        if hasattr(resource, 'is_shared') and resource.is_shared:
            return True

        # 自己创建的资源可见
        if hasattr(resource, 'created_by') and resource.created_by == current_user.id:
            return True

        # ActionTask 使用 user_id
        if hasattr(resource, 'user_id') and resource.user_id == current_user.id:
            return True

        return False

    @staticmethod
    def can_edit_resource(current_user: User, resource) -> bool:
        """检查是否可以编辑资源

        Args:
            current_user: 当前用户
            resource: 资源对象（需要有 created_by 属性）

        Returns:
            bool: 是否可以编辑
        """
        # 超级管理员可以编辑所有资源
        if current_user.is_admin:
            return True

        # 只能编辑自己创建的资源
        if hasattr(resource, 'created_by') and resource.created_by == current_user.id:
            return True

        # ActionTask 使用 user_id
        if hasattr(resource, 'user_id') and resource.user_id == current_user.id:
            return True

        return False

    @staticmethod
    def can_delete_resource(current_user: User, resource) -> bool:
        """检查是否可以删除资源

        Args:
            current_user: 当前用户
            resource: 资源对象

        Returns:
            bool: 是否可以删除
        """
        # 删除权限与编辑权限相同
        return UserPermissionService.can_edit_resource(current_user, resource)

    @staticmethod
    def can_share_resource(current_user: User, resource) -> bool:
        """检查是否可以共享资源

        Args:
            current_user: 当前用户
            resource: 资源对象

        Returns:
            bool: 是否可以共享
        """
        # 只有创建者和超级管理员可以共享资源
        return UserPermissionService.can_edit_resource(current_user, resource)

    @staticmethod
    def filter_viewable_resources(query, model_class, current_user: User):
        """过滤用户可见的资源

        Args:
            query: SQLAlchemy 查询对象
            model_class: 模型类
            current_user: 当前用户

        Returns:
            过滤后的查询对象
        """
        if current_user.is_admin:
            # 超级管理员可以看到所有资源
            return query

        # 普通用户可以看到：
        # 1. 共享资源（is_shared = True）
        # 2. 自己创建的资源（created_by = current_user.id）
        from sqlalchemy import or_

        filters = []

        # 共享资源
        if hasattr(model_class, 'is_shared'):
            filters.append(model_class.is_shared == True)

        # 自己创建的资源
        if hasattr(model_class, 'created_by'):
            filters.append(model_class.created_by == current_user.id)

        # ActionTask 使用 user_id
        if hasattr(model_class, 'user_id'):
            filters.append(model_class.user_id == current_user.id)

        if filters:
            return query.filter(or_(*filters))

        return query
