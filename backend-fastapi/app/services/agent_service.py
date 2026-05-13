import uuid
import yaml
import json
import os
from datetime import datetime
import requests
from typing import List, Dict, Any, Optional
from app.models import Agent as AgentModel, ModelConfig, Role, db
from sqlalchemy.orm import joinedload

import logging
logger = logging.getLogger(__name__)

class AgentService:
    """智能体管理服务"""

    def __init__(self):
        """初始化智能体服务"""
        self.roles_yml_path = 'roles.yml'

    def _load_predefined_roles(self):
        """从roles.yml加载预定义角色到数据库"""
        try:
            if os.path.exists(self.roles_yml_path):
                with open(self.roles_yml_path, 'r', encoding='utf-8') as f:
                    roles_data = yaml.safe_load(f)

                    if not roles_data or 'roles' not in roles_data:
                        return []

                    # 获取默认模型配置
                    default_model = ModelConfig.query.filter_by(is_default_text=True).first()
                    if not default_model:
                        # 如果没有设置默认文本生成模型，查找第一个支持文本输出的模型
                        text_models = ModelConfig.query.filter(
                            ModelConfig.modalities.contains('text_output')
                        ).all()
                        if text_models:
                            default_model = text_models[0]
                        else:
                            # 最后回退到第一个可用模型
                            default_model = ModelConfig.query.first()

                    predefined_agents = []
                    # 处理roles.yml中的数据
                    for role in roles_data['roles']:
                        # 检查数据库中是否已存在该角色（按名称匹配）
                        agent = AgentModel.query.filter_by(name=role.get('name')).first()

                        if not agent:
                            # 如果不存在，创建新的智能体记录
                            settings = {
                                "is_predefined": True,
                                "usage_count": 0
                            }

                            # 如果有默认模型，添加到设置中
                            if default_model:
                                settings["model_id"] = default_model.id
                                settings["temperature"] = 0.7
                                settings["top_p"] = 1.0
                                settings["frequency_penalty"] = 0
                                settings["presence_penalty"] = 0
                                settings["max_tokens"] = default_model.max_output_tokens or 2000

                            agent = AgentModel(
                                name=role.get('name', 'Unknown'),
                                system_prompt=role.get('system_prompt', ''),
                                description=role.get('description', ''),
                                settings=settings
                            )
                            db.session.add(agent)
                        else:
                            # 如果已存在，更新system_prompt和description
                            agent.system_prompt = role.get('system_prompt', agent.system_prompt)
                            agent.description = role.get('description', agent.description)
                            # 确保标记为预定义智能体
                            if not agent.settings:
                                agent.settings = {}
                            agent.settings["is_predefined"] = True

                        predefined_agents.append(agent)

                    # 提交数据库事务
                    db.session.commit()
                    return predefined_agents

            return []
        except Exception as e:
            logger.error(f"Error loading predefined roles: {e}")
            db.session.rollback()
            return []

    def get_all_agents(self):
        """获取所有智能体列表"""
        try:
            # 首先加载预定义角色以确保它们存在于数据库中
            self._load_predefined_roles()

            # 从数据库中获取所有智能体，预加载role和action_task关系
            agents = AgentModel.query.options(
                joinedload(AgentModel.role),
                joinedload(AgentModel.action_task)
            ).all()

            # 转换为API可用的格式
            result = []
            for agent in agents:
                result.append(self.format_agent_for_api(agent))

            return result
        except Exception as e:
            logger.error(f"Error getting all agents: {e}")
            return []

    def get_all_model_configs(self):
        """获取所有模型配置，返回完整信息用于测试"""
        try:
            model_configs = ModelConfig.query.all()
            return [{
                'id': model.id,
                'name': model.name,
                'provider': model.provider,
                'model_id': model.model_id,
                'base_url': model.base_url,
                'api_key': '********',  # 安全起见不返回真实密钥
                'is_default': model.is_default,
                'max_output_tokens': model.max_output_tokens,
                'context_window': model.context_window,
                'additional_params': model.additional_params,
                'request_timeout': model.request_timeout
            } for model in model_configs]
        except Exception as e:
            logger.error(f"Error getting model configs: {e}")
            return []

    def format_agent_for_api(self, agent):
        """格式化智能体数据用于API响应"""
        model_id = agent.settings.get('model_id') if agent.settings else None
        model_config = None

        # 如果有模型ID，获取模型配置
        if model_id:
            model_config = ModelConfig.query.get(model_id)

        # 如果没有找到模型配置，使用默认文本生成模型
        if not model_config:
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

        # 从关联的Role中获取system_prompt
        system_prompt = ""
        if agent.role:
            system_prompt = agent.role.system_prompt

        # 获取关联的行动任务信息
        action_task_info = None
        if agent.action_task:
            action_task_info = {
                'id': agent.action_task.id,
                'name': agent.action_task.title,  # 使用 title 而不是 name
                'is_experiment_clone': agent.action_task.is_experiment_clone or False
            }

        return {
            'id': agent.id,
            'name': agent.name,
            'systemPrompt': system_prompt,  # 使用从Role获取的system_prompt
            'description': agent.description,
            'model': model_config.id if model_config else None,
            'model_name': f"{model_config.name} ({model_config.model_id})" if model_config else "未指定",
            'avatar': agent.avatar,
            'temperature': agent.settings.get('temperature') if agent.settings else 0.7,
            'topP': agent.settings.get('top_p') if agent.settings else 1,
            'frequencyPenalty': agent.settings.get('frequency_penalty') if agent.settings else 0,
            'presencePenalty': agent.settings.get('presence_penalty') if agent.settings else 0,
            'maxTokens': agent.settings.get('max_tokens') if agent.settings else 2000,
            'stopSequences': agent.settings.get('stop_sequences') if agent.settings else [],
            'is_predefined': agent.settings.get('is_predefined') if agent.settings else False,
            'usageCount': agent.settings.get('usage_count') if agent.settings else 0,
            'role_id': agent.role_id,
            'source': agent.source,  # 智能体来源
            'action_task_id': agent.action_task_id,
            'action_task': action_task_info,
            'createdAt': agent.created_at.isoformat() if hasattr(agent, 'created_at') and agent.created_at else None,
            'updatedAt': agent.updated_at.isoformat() if hasattr(agent, 'updated_at') and agent.updated_at else None
        }

    def format_agent_for_list(self, agent):
        """格式化智能体数据用于列表显示（精简版）"""
        role_name = "未知角色"
        action_task_name = "未分配"
        action_task_id = None

        # 获取角色名称
        if agent.role:
            role_name = agent.role.name

        # 获取行动任务名称和ID
        if agent.action_task:
            action_task_name = agent.action_task.title  # 使用 title 而不是 name
            action_task_id = agent.action_task.id

        # 获取智能体的统计信息
        conversation_count = agent.settings.get('conversation_count', 0) if agent.settings else 0
        message_count = agent.settings.get('message_count', 0) if agent.settings else 0
        last_active = agent.updated_at.isoformat() if hasattr(agent, 'updated_at') and agent.updated_at else None
        avg_response_time = agent.settings.get('avg_response_time', 0) if agent.settings else 0

        return {
            'id': agent.id,
            'name': agent.name,
            'role_name': role_name,
            'action_task_name': action_task_name,
            'action_task_id': action_task_id,
            'action_task': {
                'id': action_task_id,
                'name': action_task_name,
                'is_experiment_clone': agent.action_task.is_experiment_clone if agent.action_task else False
            } if action_task_id else None,
            'source': agent.source,  # 智能体来源
            'status': agent.status,  # 智能体状态
            'conversation_count': conversation_count,  # 会话数
            'message_count': message_count,  # 消息数
            'last_active': last_active,  # 最后活动时间
            'avg_response_time': avg_response_time,  # 平均响应时间
            'createdAt': agent.created_at.isoformat() if hasattr(agent, 'created_at') and agent.created_at else None
        }

    def get_agent_by_id(self, agent_id):
        """获取特定智能体详情"""
        agent = AgentModel.query.get(agent_id)
        if not agent:
            return None

        return self.format_agent_for_api(agent)

    def get_agents_by_ids(self, agent_ids):
        """通过ID列表获取多个智能体"""
        agents = AgentModel.query.filter(AgentModel.id.in_(agent_ids)).all()
        return [self.format_agent_for_api(agent) for agent in agents]

    def create_agent(self, data):
        """创建新智能体"""
        try:
            # 准备智能体数据
            settings = {
                'model_id': data.get('model'),
                'temperature': data.get('temperature', 0.7),
                'top_p': data.get('topP', 1),
                'frequency_penalty': data.get('frequencyPenalty', 0),
                'presence_penalty': data.get('presencePenalty', 0),
                'max_tokens': data.get('maxTokens', 2000),
                'stop_sequences': data.get('stopSequences', []),
                'is_predefined': False,
                'usage_count': 0
            }

            # 获取角色信息以确定智能体来源
            role_source = 'internal'  # 默认为内部来源
            if 'role_id' in data:
                role = Role.query.get(data['role_id'])
                if role:
                    role_source = role.source

            # 创建新的智能体记录
            agent = AgentModel(
                name=data.get('name', 'Custom Agent'),
                description=data.get('description', ''),
                avatar=data.get('avatar', ''),
                settings=settings,
                role_id=data.get('role_id', 1),  # 确保有一个默认角色ID
                action_task_id=data.get('action_task_id'),  # 添加 action_task_id
                source=data.get('source', role_source)  # 使用角色来源作为默认值
            )

            # 保存到数据库
            db.session.add(agent)
            db.session.commit()

            return self.format_agent_for_api(agent)
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating agent: {e}")
            raise

    def update_agent(self, agent_id, data):
        """更新智能体"""
        try:
            # 检查智能体是否存在
            agent = AgentModel.query.get(agent_id)
            if not agent:
                return None

            # 如果是预定义智能体，创建一个副本作为自定义智能体
            if agent.settings and agent.settings.get('is_predefined', False):
                # 创建新的智能体记录
                settings = {
                    'model_id': data.get('model'),
                    'temperature': data.get('temperature', 0.7),
                    'top_p': data.get('topP', 1),
                    'frequency_penalty': data.get('frequencyPenalty', 0),
                    'presence_penalty': data.get('presencePenalty', 0),
                    'max_tokens': data.get('maxTokens', 2000),
                    'stop_sequences': data.get('stopSequences', []),
                    'is_predefined': False,
                    'usage_count': 0,
                    'based_on': agent_id
                }

                new_agent = AgentModel(
                    name=data.get('name', agent.name),
                    description=data.get('description', agent.description),
                    avatar=data.get('avatar', agent.avatar),
                    settings=settings,
                    role_id=data.get('role_id', agent.role_id),
                    action_task_id=data.get('action_task_id', agent.action_task_id)  # 添加 action_task_id
                )

                db.session.add(new_agent)
                db.session.commit()

                return self.format_agent_for_api(new_agent)
            else:
                # 更新已有设置或创建新设置
                current_settings = agent.settings or {}

                # 更新设置
                current_settings.update({
                    'model_id': data.get('model', current_settings.get('model_id')),
                    'temperature': data.get('temperature', current_settings.get('temperature', 0.7)),
                    'top_p': data.get('topP', current_settings.get('top_p', 1)),
                    'frequency_penalty': data.get('frequencyPenalty', current_settings.get('frequency_penalty', 0)),
                    'presence_penalty': data.get('presencePenalty', current_settings.get('presence_penalty', 0)),
                    'max_tokens': data.get('maxTokens', current_settings.get('max_tokens', 2000)),
                    'stop_sequences': data.get('stopSequences', current_settings.get('stop_sequences', []))
                })

                # 更新智能体数据
                agent.name = data.get('name', agent.name)
                agent.description = data.get('description', agent.description)
                agent.avatar = data.get('avatar', agent.avatar)
                agent.settings = current_settings
                if 'role_id' in data:
                    agent.role_id = data['role_id']
                if 'action_task_id' in data:  # 添加 action_task_id 的更新
                    agent.action_task_id = data['action_task_id']

                db.session.commit()

                return self.format_agent_for_api(agent)
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating agent: {e}")
            raise

    def delete_agent(self, agent_id):
        """删除智能体"""
        try:
            agent = AgentModel.query.get(agent_id)

            # 检查智能体是否存在
            if not agent:
                return False

            # 检查是否为预定义智能体
            if agent.settings and agent.settings.get('is_predefined', False):
                return False  # 不允许删除预定义智能体

            # 删除智能体的所有变量
            from app.models import AgentVariable
            AgentVariable.query.filter_by(agent_id=agent_id).delete()
            logger.info(f"已删除智能体 {agent_id} 的所有变量")

            # 删除智能体
            db.session.delete(agent)
            db.session.commit()

            return True
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting agent: {e}")
            return False

    def increment_usage_count(self, agent_id):
        """递增智能体使用次数"""
        try:
            agent = AgentModel.query.get(agent_id)
            if not agent:
                return False

            # 更新使用次数
            if not agent.settings:
                agent.settings = {}

            agent.settings['usage_count'] = agent.settings.get('usage_count', 0) + 1
            db.session.commit()

            return True
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error incrementing usage count: {e}")
            return False

    def create_agent_from_role(self, role_id: int, custom_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """从角色创建智能体"""
        try:
            # 获取角色信息
            role = Role.query.get(role_id)
            if not role:
                raise ValueError(f"角色ID {role_id} 不存在")

            # 获取模型配置：优先使用角色指定的模型，否则使用默认模型
            model_config = None
            if role.model:
                # 角色有指定模型，使用角色的模型
                model_config = ModelConfig.query.get(role.model)
                if not model_config:
                    logger.warning(f"警告：角色 {role.name} 指定的模型ID {role.model} 不存在，将使用默认模型")

            if not model_config:
                # 使用默认文本生成模型
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

            # 准备智能体数据
            agent_data = {
                'name': role.name,
                'description': role.description,
                'avatar': role.avatar,
                'role_id': role_id,
                'source': role.source,  # 从角色继承来源
                'settings': {
                    'is_predefined': False,
                    'usage_count': 0
                }
            }

            # 如果有模型配置，添加到设置中
            if model_config:
                agent_data['settings'].update({
                    'model_id': model_config.id,
                    'temperature': role.temperature if role.temperature is not None else 0.7,
                    'top_p': role.top_p if role.top_p is not None else 1.0,
                    'frequency_penalty': role.frequency_penalty if role.frequency_penalty is not None else 0,
                    'presence_penalty': role.presence_penalty if role.presence_penalty is not None else 0,
                    'max_tokens': model_config.max_output_tokens or 2000
                })

            # 合并自定义数据
            if custom_data:
                agent_data['settings'].update(custom_data)

            # 创建智能体
            agent = AgentModel(**agent_data)
            db.session.add(agent)
            db.session.commit()

            # 返回创建的智能体信息
            return self.format_agent_for_api(agent)

        except Exception as e:
            db.session.rollback()
            raise Exception(f"从角色创建智能体失败: {str(e)}")