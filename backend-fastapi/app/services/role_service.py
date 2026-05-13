import yaml
from typing import List, Dict, Any, Optional
from app.models import db, Role, Agent, Knowledge, Tool, Capability, RoleCapability, RoleKnowledge, RoleExternalKnowledge, ExternalKnowledge, ExternalKnowledgeProvider, User, Skill, RoleSkill
from app.services.user_permission_service import UserPermissionService

import logging
logger = logging.getLogger(__name__)

class RoleService:
    """角色服务"""

    @staticmethod
    def get_all_roles(current_user: Optional[User] = None):
        """获取所有角色，按创建时间倒序排列（最新的在前）

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            角色列表（已根据权限过滤）
        """
        query = Role.query.order_by(Role.created_at.desc())

        # 如果提供了当前用户，应用权限过滤
        if current_user:
            query = UserPermissionService.filter_viewable_resources(query, Role, current_user)

        return query.all()

    @staticmethod
    def get_all_roles_with_details(current_user: Optional[User] = None):
        """获取所有角色及其关联的能力和知识库信息

        Args:
            current_user: 当前用户，用于权限过滤

        Returns:
            角色详细信息列表（已根据权限过滤）
        """
        try:
            # 获取所有角色（应用权限过滤）
            query = Role.query.order_by(Role.created_at.desc())
            if current_user:
                query = UserPermissionService.filter_viewable_resources(query, Role, current_user)
            roles = query.all()

            # 批量获取所有角色的能力关联
            role_capabilities_query = db.session.query(
                RoleCapability.role_id,
                Capability.id,
                Capability.name,
                Capability.description,
                Capability.type,
                Capability.provider
            ).join(Capability, RoleCapability.capability_id == Capability.id)

            role_capabilities_data = role_capabilities_query.all()

            # 按角色ID组织能力数据
            capabilities_by_role = {}
            for rc in role_capabilities_data:
                role_id = rc.role_id
                if role_id not in capabilities_by_role:
                    capabilities_by_role[role_id] = []
                capabilities_by_role[role_id].append({
                    'id': rc.id,
                    'name': rc.name,
                    'description': rc.description,
                    'type': rc.type,
                    'provider': rc.provider
                })

            # 批量获取所有角色的内部知识库关联
            role_internal_kb_query = db.session.query(
                RoleKnowledge.role_id,
                Knowledge.id,
                Knowledge.name,
                Knowledge.description,
                Knowledge.type
            ).join(Knowledge, RoleKnowledge.knowledge_id == Knowledge.id)

            role_internal_kb_data = role_internal_kb_query.all()

            # 按角色ID组织内部知识库数据
            internal_kb_by_role = {}
            for rk in role_internal_kb_data:
                role_id = rk.role_id
                if role_id not in internal_kb_by_role:
                    internal_kb_by_role[role_id] = []
                internal_kb_by_role[role_id].append({
                    'id': rk.id,
                    'name': rk.name,
                    'description': rk.description,
                    'type': rk.type,
                    'status': 'active'  # 内部知识库默认为活跃状态
                })

            # 批量获取所有角色的外部知识库关联
            role_external_kb_query = db.session.query(
                RoleExternalKnowledge.role_id,
                ExternalKnowledge.id,
                ExternalKnowledge.name,
                ExternalKnowledge.description,
                ExternalKnowledgeProvider.name.label('provider_name')
            ).join(
                ExternalKnowledge, RoleExternalKnowledge.external_knowledge_id == ExternalKnowledge.id
            ).join(
                ExternalKnowledgeProvider, ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
            )

            role_external_kb_data = role_external_kb_query.all()

            # 按角色ID组织外部知识库数据
            external_kb_by_role = {}
            for rek in role_external_kb_data:
                role_id = rek.role_id
                if role_id not in external_kb_by_role:
                    external_kb_by_role[role_id] = []
                external_kb_by_role[role_id].append({
                    'id': rek.id,
                    'name': rek.name,
                    'description': rek.description,
                    'provider_name': rek.provider_name
                })

            # 批量获取所有角色的技能关联
            role_skills_query = db.session.query(
                RoleSkill.role_id,
                Skill.id,
                Skill.name,
                Skill.display_name,
                Skill.description
            ).join(Skill, RoleSkill.skill_id == Skill.id)

            role_skills_data = role_skills_query.all()

            # 按角色ID组织技能数据
            skills_by_role = {}
            for rs in role_skills_data:
                role_id = rs.role_id
                if role_id not in skills_by_role:
                    skills_by_role[role_id] = []
                skills_by_role[role_id].append({
                    'id': rs.id,
                    'name': rs.name,
                    'display_name': rs.display_name or rs.name,
                    'description': rs.description
                })

            # 组装最终结果
            result = []
            for role in roles:
                # 获取基本角色信息
                role_data = RoleService.format_role_for_api(role)

                # 添加能力信息
                role_data['capabilities'] = capabilities_by_role.get(role.id, [])

                # 添加内部知识库信息
                role_data['internalKnowledges'] = internal_kb_by_role.get(role.id, [])

                # 添加外部知识库信息
                role_data['externalKnowledges'] = external_kb_by_role.get(role.id, [])

                # 添加所有知识库信息（合并内部和外部）
                role_data['allKnowledges'] = role_data['internalKnowledges'] + role_data['externalKnowledges']

                # 添加技能信息
                role_data['skills'] = skills_by_role.get(role.id, [])

                result.append(role_data)

            return result

        except Exception as e:
            logger.error(f"获取角色详细信息失败: {e}")
            raise e

    @staticmethod
    def get_all_roles_knowledge_bindings():
        """获取所有角色的知识库绑定关系（内部和外部）"""
        try:
            # 获取所有角色的基本信息
            roles = Role.query.order_by(Role.created_at.desc()).all()

            # 批量获取所有角色的内部知识库绑定
            internal_bindings_query = db.session.query(
                RoleKnowledge.role_id,
                RoleKnowledge.id.label('binding_id'),
                RoleKnowledge.created_at,
                Knowledge.id.label('knowledge_id'),
                Knowledge.name.label('knowledge_name'),
                Knowledge.description.label('knowledge_description'),
                Knowledge.type.label('knowledge_type')
            ).join(Knowledge, RoleKnowledge.knowledge_id == Knowledge.id)

            internal_bindings_data = internal_bindings_query.all()

            # 批量获取所有角色的外部知识库绑定
            external_bindings_query = db.session.query(
                RoleExternalKnowledge.role_id,
                RoleExternalKnowledge.id.label('binding_id'),
                RoleExternalKnowledge.created_at,
                RoleExternalKnowledge.config,
                ExternalKnowledge.id.label('external_knowledge_id'),
                ExternalKnowledge.name.label('knowledge_name'),
                ExternalKnowledge.description.label('knowledge_description'),
                ExternalKnowledgeProvider.id.label('provider_id'),
                ExternalKnowledgeProvider.name.label('provider_name'),
                ExternalKnowledgeProvider.type.label('provider_type')
            ).join(
                ExternalKnowledge, RoleExternalKnowledge.external_knowledge_id == ExternalKnowledge.id
            ).join(
                ExternalKnowledgeProvider, ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
            )

            external_bindings_data = external_bindings_query.all()

            # 按角色ID组织绑定数据
            bindings_by_role = {}

            # 处理内部知识库绑定
            for binding in internal_bindings_data:
                role_id = binding.role_id
                if role_id not in bindings_by_role:
                    bindings_by_role[role_id] = []

                bindings_by_role[role_id].append({
                    'id': binding.binding_id,
                    'type': 'internal',
                    'knowledge_id': binding.knowledge_id,
                    'knowledge_name': binding.knowledge_name,
                    'knowledge_description': binding.knowledge_description,
                    'knowledge_type': binding.knowledge_type,
                    'status': 'active',  # 内部知识库默认为活跃状态
                    'created_at': binding.created_at.isoformat() if binding.created_at else None,
                    'provider': {
                        'id': 'internal',
                        'name': '内部知识库',
                        'type': 'INTERNAL'
                    }
                })

            # 处理外部知识库绑定
            for binding in external_bindings_data:
                role_id = binding.role_id
                if role_id not in bindings_by_role:
                    bindings_by_role[role_id] = []

                bindings_by_role[role_id].append({
                    'id': binding.binding_id,
                    'type': 'external',
                    'external_knowledge_id': binding.external_knowledge_id,
                    'knowledge_name': binding.knowledge_name,
                    'knowledge_description': binding.knowledge_description,
                    'config': binding.config,
                    'created_at': binding.created_at.isoformat() if binding.created_at else None,
                    'provider': {
                        'id': binding.provider_id,
                        'name': binding.provider_name,
                        'type': binding.provider_type
                    }
                })

            # 组装最终结果
            result = {}
            for role in roles:
                result[role.id] = {
                    'role_id': role.id,
                    'role_name': role.name,
                    'bindings': bindings_by_role.get(role.id, [])
                }

            return result

        except Exception as e:
            logger.error(f"获取所有角色知识库绑定关系失败: {e}")
            raise e

    @staticmethod
    def get_role_by_id(role_id):
        """根据ID获取角色"""
        return Role.query.get(role_id)

    @staticmethod
    def get_roles_by_action_space(action_space_id):
        """根据行动空间ID获取关联的角色列表"""
        from app.models import ActionSpaceRole

        # 通过关联表查询该行动空间的所有角色
        role_ids = db.session.query(ActionSpaceRole.role_id).filter_by(
            action_space_id=action_space_id
        ).all()

        if not role_ids:
            return []

        # 提取角色ID列表
        role_id_list = [role_id[0] for role_id in role_ids]

        # 查询角色详情
        roles = Role.query.filter(Role.id.in_(role_id_list)).all()
        return roles

    @staticmethod
    def create_role(data, current_user: Optional[User] = None):
        """创建新角色

        Args:
            data: 角色数据
            current_user: 当前用户

        Returns:
            创建的角色对象
        
        Raises:
            ValueError: 配额超限时抛出
        """
        # 配额检查
        if current_user:
            from app.services.subscription_service import SubscriptionService
            quota_result = SubscriptionService.check_quota(current_user.id, 'agents')
            if not quota_result['allowed']:
                raise ValueError(f'已达到计划限额，您的计划最多可创建 {quota_result["limit"]} 个智能体')

        settings = data.get('settings', {})
        if 'personality' in data:
            settings['personality'] = data['personality']

        # 处理外部角色配置
        if data.get('source') == 'external':
            external_config = {
                'platform': data.get('external_type', 'custom'),
                'external_id': data.get('external_id', ''),
                'api_config': {},
                'platform_specific': {}
            }

            # 从 external_config 字段获取配置
            if 'external_config' in data and isinstance(data['external_config'], dict):
                config = data['external_config']

                # API配置
                api_config = {}
                if 'api_key' in config:
                    api_config['api_key'] = config['api_key']
                if 'base_url' in config:
                    api_config['base_url'] = config['base_url']
                if 'model' in config:
                    api_config['model'] = config['model']
                if 'timeout' in config:
                    api_config['timeout'] = config['timeout']
                if 'headers' in config:
                    api_config['headers'] = config['headers']

                external_config['api_config'] = api_config

                # 平台特定配置
                platform_specific = {}
                if 'instructions' in config:
                    platform_specific['instructions'] = config['instructions']
                if 'tools' in config:
                    platform_specific['tools'] = config['tools']
                if 'plugins' in config:
                    platform_specific['plugins'] = config['plugins']
                if 'application_type' in config:
                    platform_specific['application_type'] = config['application_type']
                if 'platform_name' in config:
                    platform_specific['platform_name'] = config['platform_name']

                external_config['platform_specific'] = platform_specific

            # 将外部配置存储到settings中
            settings['external_config'] = external_config

            logger.info(f"创建外部角色，配置: {external_config}")

        # 设置多租户字段
        created_by = None
        is_shared = False

        if current_user:
            if current_user.is_admin:
                # 超级管理员可以选择创建系统资源或私有资源
                created_by = data.get('created_by', None)  # None = 系统资源
                is_shared = data.get('is_shared', True if created_by is None else False)
            else:
                # 普通用户创建的资源
                created_by = current_user.id
                is_shared = data.get('is_shared', False)  # 默认私有，可勾选共享

        # 创建角色基本信息
        role = Role(
            name=data.get('name', '新角色'),
            description=data.get('description', ''),
            system_prompt=data.get('system_prompt', ''),
            avatar=data.get('avatar', 'default.png'),
            settings=settings,
            is_predefined=data.get('is_predefined', False),
            model=data.get('model') if data.get('model') != '' else None,
            source=data.get('source', 'internal'),  # 默认为内部角色
            # 设置角色级别的模型参数
            temperature=data.get('temperature', 0.7),
            top_p=data.get('topP', 1.0),
            frequency_penalty=data.get('frequencyPenalty', 0.0),
            presence_penalty=data.get('presencePenalty', 0.0),
            stop_sequences=data.get('stopSequences', []),
            # 多租户字段
            created_by=created_by,
            is_shared=is_shared
        )

        # 保存角色级别的模型参数到settings以保持向后兼容
        role_params = ['temperature', 'topP', 'frequencyPenalty', 'presencePenalty', 'stopSequences']
        for param in role_params:
            if param in data and data[param] is not None:
                role.settings[param] = data[param]

        db.session.add(role)
        db.session.flush()  # 获取角色ID

        # 自动绑定默认启用的能力
        from app.models import Capability, RoleCapability
        default_capabilities = Capability.query.filter_by(default_enabled=True).all()
        for capability in default_capabilities:
            role_capability = RoleCapability(
                role_id=role.id,
                capability_id=capability.id
            )
            db.session.add(role_capability)
            logger.info(f"为角色 {role.name} 自动绑定默认能力: {capability.name}")

        db.session.commit()

        return role

    @staticmethod
    def update_role(role_id, data, current_user: Optional[User] = None):
        """更新角色信息

        Args:
            role_id: 角色ID
            data: 更新数据
            current_user: 当前用户

        Returns:
            更新后的角色对象，如果无权限或不存在则返回None
        """
        role = Role.query.get(role_id)
        if not role:
            return None

        # 检查编辑权限
        if current_user and not UserPermissionService.can_edit_resource(current_user, role):
            return None

        # 记录更新数据，帮助调试
        logger.info(f"收到更新数据: {data}")

        # 基本字段
        if 'name' in data:
            role.name = data['name']
        if 'description' in data:
            role.description = data['description']
        if 'system_prompt' in data:
            role.system_prompt = data['system_prompt']
        if 'avatar' in data:
            role.avatar = data['avatar']
        if 'model' in data:
            # 将空字符串转换为None，表示使用默认模型
            role.model = data['model'] if data['model'] != '' else None
        if 'source' in data:
            role.source = data['source']

        # 多租户字段：只有创建者可以修改 is_shared 状态
        if 'is_shared' in data and current_user and UserPermissionService.can_share_resource(current_user, role):
            role.is_shared = data['is_shared']

        # 初始化settings
        if role.settings is None:
            role.settings = {}

        # 处理角色级别的模型参数
        role_params = ['temperature', 'topP', 'frequencyPenalty', 'presencePenalty', 'stopSequences']

        for param in role_params:
            if param in data and data[param] is not None:
                # 更新数据库字段
                if param == 'topP':
                    role.top_p = float(data[param])
                elif param == 'frequencyPenalty':
                    role.frequency_penalty = float(data[param])
                elif param == 'presencePenalty':
                    role.presence_penalty = float(data[param])
                elif param == 'stopSequences':
                    role.stop_sequences = data[param]
                elif param == 'temperature':
                    role.temperature = float(data[param])

                # 同时存储在settings中以保持向后兼容
                role.settings[param] = data[param]

        # 处理外部角色配置更新
        if role.source == 'external' and data.get('source') == 'external':
            external_config = {
                'platform': data.get('external_type', 'custom'),
                'external_id': data.get('external_id', ''),
                'api_config': {},
                'platform_specific': {}
            }

            # 从 external_config 字段获取配置
            if 'external_config' in data and isinstance(data['external_config'], dict):
                config = data['external_config']

                # API配置
                api_config = {}
                if 'api_key' in config:
                    api_config['api_key'] = config['api_key']
                if 'base_url' in config:
                    api_config['base_url'] = config['base_url']
                if 'model' in config:
                    api_config['model'] = config['model']
                if 'timeout' in config:
                    api_config['timeout'] = config['timeout']
                if 'headers' in config:
                    api_config['headers'] = config['headers']

                external_config['api_config'] = api_config

                # 平台特定配置
                platform_specific = {}
                if 'instructions' in config:
                    platform_specific['instructions'] = config['instructions']
                if 'application_type' in config:
                    platform_specific['application_type'] = config['application_type']
                if 'platform_name' in config:
                    platform_specific['platform_name'] = config['platform_name']
                if 'response_mode' in config:
                    platform_specific['response_mode'] = config['response_mode']
                if 'user_identifier' in config:
                    platform_specific['user_identifier'] = config['user_identifier']

                external_config['platform_specific'] = platform_specific

            # 更新外部配置
            # 为了确保SQLAlchemy检测到JSON字段的变化，我们需要标记字段为dirty
            role.settings['external_config'] = external_config

            # 标记settings字段已修改，强制SQLAlchemy更新
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(role, 'settings')

            logger.info(f"更新外部角色配置: {external_config}")

        # 处理personality和其他settings
        if 'personality' in data:
            role.settings['personality'] = data['personality']

        # 对于外部角色，不要用传入的settings覆盖我们刚设置的external_config
        if 'settings' in data and isinstance(data['settings'], dict):
            if role.source == 'external' and data.get('source') == 'external':
                # 外部角色：只更新非external_config的settings
                for key, value in data['settings'].items():
                    if key != 'external_config':
                        role.settings[key] = value
                logger.info(f"外部角色：跳过settings中的external_config覆盖")
            else:
                # 内部角色：正常更新所有settings
                role.settings.update(data['settings'])

        # 提交并返回
        try:
            # 在提交前打印settings内容
            logger.info(f"提交前的settings: {role.settings}")

            db.session.commit()

            # 提交后重新查询验证数据是否保存
            updated_role = Role.query.get(role.id)
            logger.info(f"提交后重新查询的settings: {updated_role.settings}")
            logger.info(f"角色更新成功: {role.id} - {role.name}")
            return role
        except Exception as e:
            db.session.rollback()
            logger.error(f"角色更新失败: {e}")
            return None

    @staticmethod
    def delete_role(role_id, current_user: Optional[User] = None):
        """删除角色

        Args:
            role_id: 角色ID
            current_user: 当前用户

        Returns:
            是否删除成功
        """
        from app.models import ConversationAgent, Message

        role = Role.query.get(role_id)
        if not role:
            return False

        # 检查删除权限
        if current_user and not UserPermissionService.can_delete_resource(current_user, role):
            return False

        # 检查是否有智能体正在使用这个角色
        if Agent.query.filter_by(role_id=role_id).first():
            return False

        # 删除角色
        db.session.delete(role)
        db.session.commit()

        return True

    @staticmethod
    def format_role_for_api(role):
        """格式化角色数据用于API响应"""
        if not role:
            return None

        # 查询关联的模型信息
        model_name = None
        model_id = None
        if role.model:
            from app.models import ModelConfig
            model_config = ModelConfig.query.get(role.model)
            if model_config:
                model_name = model_config.name
                model_id = model_config.model_id

        # 基本角色信息
        role_data = {
            'id': role.id,
            'name': role.name,
            'description': role.description,
            'system_prompt': role.system_prompt,
            'avatar': role.avatar,
            'settings': role.settings,
            'is_predefined': role.is_predefined,
            'model': role.model,
            'model_name': model_name,
            'model_id': model_id,
            'source': role.source,  # 添加角色类型
            'knowledge_bases': [kb.id for kb in role.knowledge_bases],
            'tools': [tool.id for tool in role.tools],
            # 多租户字段
            'created_by': role.created_by,
            'is_shared': role.is_shared
        }

        # 添加角色级别的模型参数
        role_data['temperature'] = role.temperature
        role_data['topP'] = role.top_p
        role_data['frequencyPenalty'] = role.frequency_penalty
        role_data['presencePenalty'] = role.presence_penalty
        role_data['stopSequences'] = role.stop_sequences

        # 如果是外部角色，添加外部配置信息
        if role.source == 'external' and role.settings and 'external_config' in role.settings:
            external_config = role.settings['external_config']
            role_data['external_type'] = external_config.get('platform', 'custom')
            role_data['external_id'] = external_config.get('external_id', '')
            role_data['external_config'] = external_config

        return role_data

    @staticmethod
    def load_roles(roles_file: str = "roles.yml") -> List[Dict[str, Any]]:
        try:
            with open(roles_file, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Error loading roles: {e}")
            return []

    @staticmethod
    def create_roles_from_config(roles: List[Dict[str, Any]], num_roles: int = 3) -> List[Role]:
        roles_list = []
        for role_data in roles[:num_roles]:
            settings = role_data.get('settings', {})

            # 处理旧版本中的 debate_side 字段
            if 'debate_side' in role_data:
                settings['debate_side'] = role_data['debate_side']

            role = Role(
                name=role_data.get('name', f"Role_{len(roles_list)}"),
                system_prompt=role_data.get('system_prompt'),
                description=role_data.get('description'),
                avatar=role_data.get('avatar'),
                settings=settings,
                is_predefined=True
            )
            roles_list.append(role)
        return roles_list

    @staticmethod
    def create_default_roles(num_roles: int = 3) -> List[Role]:
        default_roles = [
            {
                'name': '专家',
                'system_prompt': '你是一位经验丰富的专家，擅长分析和解决问题。',
                'description': '一位经验丰富的专家，擅长分析和解决问题。'
            },
            {
                'name': '评论家',
                'system_prompt': '你是一位敏锐的评论家，善于发现问题和提出改进建议。',
                'description': '一位敏锐的评论家，善于发现问题和提出改进建议。'
            },
            {
                'name': '创新者',
                'system_prompt': '你是一位富有创造力的创新者，善于提出新颖的想法和解决方案。',
                'description': '一位富有创造力的创新者，善于提出新颖的想法和解决方案。'
            }
        ]
        return RoleService.create_roles_from_config(default_roles, num_roles)

    @staticmethod
    def get_role_model_configs():
        """获取角色可用的模型配置列表"""
        from app.models import ModelConfig

        # 获取所有可用的模型配置
        configs = ModelConfig.query.all()

        # 格式化返回数据
        result = []
        for config in configs:
            result.append({
                'id': config.id,
                'name': config.name,
                'provider': config.provider,
                'model_id': config.model_id,
                'base_url': config.base_url,
                'is_default': config.is_default,
                'modalities': config.modalities or [],
                'capabilities': config.capabilities or []
            })

        return result

    @staticmethod
    def get_predefined_roles():
        """获取预定义角色列表"""
        roles = Role.query.filter_by(is_predefined=True).all()
        return [RoleService.format_role_for_api(role) for role in roles]

    @staticmethod
    def get_recent_roles(limit=5):
        """获取最近创建的角色列表"""
        roles = Role.query.order_by(Role.created_at.desc()).limit(limit).all()
        return [RoleService.format_role_for_api(role) for role in roles]

    @staticmethod
    def get_most_used_roles(limit=5):
        """获取最常用的角色列表"""
        # 这里可以基于使用次数排序，暂时用创建时间代替
        roles = Role.query.order_by(Role.created_at.asc()).limit(limit).all()
        return [RoleService.format_role_for_api(role) for role in roles]

    @staticmethod
    def create_agent_from_role(role_id, data=None):
        """从角色创建智能体"""
        if data is None:
            data = {}

        role = Role.query.get(role_id)
        if not role:
            return None

        # 创建智能体
        agent = Agent(
            name=data.get('name', role.name),
            role_id=role.id,
            settings=data.get('settings', {})
        )

        db.session.add(agent)
        db.session.commit()

        return {
            'id': agent.id,
            'name': agent.name,
            'role_id': agent.role_id,
            'settings': agent.settings
        }

    @staticmethod
    def test_role(role_id, prompt, system_prompt=None, **advanced_params):
        """测试角色响应"""
        from app.services.conversation.model_client import ModelClient
        from app.models import SystemSetting

        # 获取角色信息
        role = Role.query.get(role_id)
        if not role:
            return {"error": "角色不存在"}

        # 获取统一模型客户端实例
        model_client = ModelClient()

        # 判断是否应该使用流式响应
        should_use_streaming = RoleService._should_use_streaming_for_role(role)

        # 如果是外部角色，使用外部角色测试逻辑
        if role.source == 'external':
            return RoleService._test_external_role(role, prompt, system_prompt, should_use_streaming, **advanced_params)

        # 内部角色的测试逻辑
        # 获取关联的模型配置
        model_config = None
        if role.model:
            # 通过关联的模型ID获取模型配置
            from app.models import ModelConfig
            model_config = ModelConfig.query.get(role.model)

        if not model_config:
            # 如果角色没有关联模型，则使用默认文本生成模型
            from app.models import ModelConfig
            model_config = ModelConfig.query.filter_by(is_default_text=True).first()
            if not model_config:
                # 如果没有设置默认文本生成模型，查找第一个支持文本输出的模型
                text_models = ModelConfig.query.filter(
                    ModelConfig.modalities.contains('text_output')
                ).all()
                if text_models:
                    model_config = text_models[0]
                else:
                    # 最后回退到第一个可用模型
                    model_config = ModelConfig.query.first()

        if not model_config:
            return {"error": "未找到可用的模型配置"}

        # 使用传入的系统提示或角色的系统提示
        if system_prompt is None:
            system_prompt = role.system_prompt or "你是一个有用的AI助手。"

        # 准备角色级别的模型参数 - 优先使用传入的参数，否则使用角色的参数
        # max_tokens从模型配置中获取
        model_params = {
            "temperature": advanced_params.get('temperature', role.temperature),
            "top_p": advanced_params.get('top_p', role.top_p),
            "frequency_penalty": advanced_params.get('frequency_penalty', role.frequency_penalty),
            "presence_penalty": advanced_params.get('presence_penalty', role.presence_penalty),
            "max_tokens": advanced_params.get('max_tokens', model_config.max_output_tokens),
            "stop": advanced_params.get('stop_sequences', role.stop_sequences)  # OpenAI API使用'stop'参数名
        }

        logger.info(f"使用以下参数测试角色 {role_id}: {model_params}, 流式响应: {should_use_streaming}")

        # 根据流式响应设置选择测试方法
        if should_use_streaming:
            # 使用流式测试
            result = model_client.test_model_stream(
                config=model_config,
                prompt=prompt,
                system_prompt=system_prompt,
                **model_params  # 传递最终的模型参数
            )
        else:
            # 使用非流式测试
            result = model_client.test_model(
                config=model_config,
                prompt=prompt,
                system_prompt=system_prompt,
                use_stream=False,
                **model_params  # 传递最终的模型参数
            )

        return result

    @staticmethod
    def _should_use_streaming_for_role(role):
        """判断角色是否应该使用流式响应"""
        from app.models import SystemSetting

        # 获取全局流式响应设置
        global_streaming_enabled = SystemSetting.get('streaming_enabled', True)

        # 如果是外部角色，检查角色的响应模式设置
        if role.source == 'external':
            # 从角色的外部配置中获取响应模式
            external_config = role.settings.get('external_config', {}) if role.settings else {}
            api_config = external_config.get('api_config', {})
            platform_specific = external_config.get('platform_specific', {})

            # 优先从api_config中获取，然后从platform_specific中获取
            response_mode = api_config.get('response_mode') or platform_specific.get('response_mode')

            if response_mode == 'streaming':
                return True
            elif response_mode == 'blocking':
                return False
            else:
                # 如果没有明确设置，使用全局设置
                return global_streaming_enabled
        else:
            # 内部角色使用全局设置
            return global_streaming_enabled

    @staticmethod
    def _test_external_role(role, prompt, system_prompt, should_use_streaming, **advanced_params):
        """测试外部角色"""
        try:
            # 构建消息
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # 构建角色配置
            role_config = {
                'source': 'external',
                'settings': role.settings or {}
            }

            # 构建agent_info
            agent_info = {
                'id': f'test_role_{role.id}',
                'name': role.name,
                'role_id': role.id,
                'role_name': role.name,
                'is_external': True,
                'platform': role.settings.get('external_config', {}).get('platform') if role.settings else None
            }

            # 使用外部模型客户端
            from app.services.conversation.external_model_client import external_model_client

            response = external_model_client.send_request_with_adapter(
                role_config=role_config,
                model_config=None,
                messages=messages,
                model='test-model',
                is_stream=should_use_streaming,
                agent_info=agent_info
            )

            # 检查响应是否包含错误
            if response.startswith('Error:'):
                return {
                    'success': False,
                    'message': response
                }
            else:
                return {
                    'success': True,
                    'response': response,
                    'message': '外部角色测试成功'
                }

        except Exception as e:
            return {
                'success': False,
                'message': f'外部角色测试失败: {str(e)}'
            }