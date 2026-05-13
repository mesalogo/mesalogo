"""
数据库服务模块
提供数据库操作的通用服务功能
"""

from app.models import db, Conversation, Agent, Message, ConversationAgent
from sqlalchemy.orm import joinedload
from datetime import datetime
import json
import os
from app.utils.datetime_utils import get_current_time_with_timezone

import logging
logger = logging.getLogger(__name__)

class DatabaseService:
    @staticmethod
    def get_conversations(limit=None):
        """获取会话列表"""
        query = Conversation.query.order_by(Conversation.updated_at.desc())
        if limit:
            query = query.limit(limit)
        return query.all()

    @staticmethod
    def get_conversation_with_details(conversation_id):
        """获取会话详情，包括相关的智能体"""
        return Conversation.query.options(
            joinedload(Conversation.agents)
        ).filter_by(id=conversation_id).first()

    @staticmethod
    def get_conversation_messages(conversation_id):
        """获取会话的所有消息"""
        return Message.query.filter_by(conversation_id=conversation_id).order_by(Message.created_at).all()

    @classmethod
    def create_conversation(cls, data):
        """创建新的会话"""
        try:
            # 创建会话记录
            conversation = Conversation(
                title=data['title'],
                description=data.get('description', ''),
                status='active',  # 默认状态为"进行中"
                mode=data.get('mode', 'sequential'),  # 默认为顺序模式
                rule_set_id=data.get('rule_set_id')  # 添加规则集ID
            )

            db.session.add(conversation)
            db.session.flush()  # 获取会话ID

            # 如果提供了智能体ID列表，创建会话与智能体的关联
            agent_ids = data.get('agent_ids', [])
            if agent_ids:
                for i, agent_id in enumerate(agent_ids):
                    # 第一个智能体设为默认智能体
                    is_default = (i == 0)

                    # 创建关联记录
                    conv_agent = ConversationAgent(
                        conversation_id=conversation.id,
                        agent_id=agent_id,
                        is_default=is_default
                    )
                    db.session.add(conv_agent)

            # 提交事务
            db.session.commit()
            return conversation

        except Exception as e:
            db.session.rollback()
            logger.error(f"创建会话失败: {str(e)}")
            raise

    @staticmethod
    def add_message(conversation_id, data, agent_id=None):
        """向会话添加消息"""
        message = Message(
            content=data['content'],
            role=data.get('role', 'human'),
            conversation_id=conversation_id
        )

        # 设置智能体ID
        if agent_id:
            message.agent_id = agent_id

        db.session.add(message)
        db.session.commit()
        return message

    @staticmethod
    def update_conversation_status(conversation_id, status):
        """更新会话状态"""
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return None

        conversation.status = status
        db.session.commit()
        return conversation

    @staticmethod
    def get_default_agent_for_conversation(conversation_id):
        """获取会话的默认智能体"""
        default_agent = db.session.query(Agent).join(ConversationAgent).filter(
            ConversationAgent.conversation_id == conversation_id,
            ConversationAgent.is_default == True
        ).first()

        if not default_agent:
            # 如果没有默认智能体，返回第一个可用的智能体
            agent_relation = ConversationAgent.query.filter_by(conversation_id=conversation_id).first()
            if agent_relation:
                default_agent = Agent.query.get(agent_relation.agent_id)

        return default_agent

    @staticmethod
    def get_agents_for_conversation(conversation_id):
        """获取会话的所有智能体"""
        return db.session.query(Agent).join(ConversationAgent).filter(
            ConversationAgent.conversation_id == conversation_id
        ).all()

    @staticmethod
    def get_all_agents():
        """获取所有智能体"""
        return Agent.query.all()

    @staticmethod
    def get_conversation_detail(conversation_id):
        """获取会话详情"""
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return None

        # 获取相关的智能体
        conv_agents = ConversationAgent.query.filter_by(conversation_id=conversation_id).all()
        agents = []

        for conv_agent in conv_agents:
            agent = Agent.query.get(conv_agent.agent_id)
            if agent:
                agents.append({
                    'id': agent.id,
                    'name': agent.name,
                    'role': agent.role,
                    'description': agent.description,
                    'avatar': agent.avatar,
                    'is_default': conv_agent.is_default
                })

        # 构建响应
        result = {
            'id': conversation.id,
            'title': conversation.title,
            'description': conversation.description,
            'status': conversation.status,
            'mode': conversation.mode,
            'created_at': conversation.created_at.isoformat(),
            'updated_at': conversation.updated_at.isoformat(),
            'agents': agents
        }

        return result

    @staticmethod
    def update_conversation(conversation_id, data):
        """更新会话"""
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return None

        if 'title' in data:
            conversation.title = data['title']
        if 'description' in data:
            conversation.description = data['description']
        if 'status' in data:
            conversation.status = data['status']
        if 'mode' in data:
            conversation.mode = data['mode']
        if 'rule_set_id' in data:
            conversation.rule_set_id = data['rule_set_id']

        conversation.updated_at = datetime.utcnow()
        db.session.commit()

        return DatabaseService.get_conversation_detail(conversation_id)

    @staticmethod
    def add_agent_to_conversation(conversation_id, agent_id, is_default=False):
        """向会话添加智能体"""
        # 检查会话和智能体是否存在
        conversation = Conversation.query.get(conversation_id)
        agent = Agent.query.get(agent_id)

        if not conversation or not agent:
            return False

        # 检查智能体是否已在会话中
        existing = ConversationAgent.query.filter_by(
            conversation_id=conversation_id,
            agent_id=agent_id
        ).first()

        if existing:
            # 如果已存在，可以更新is_default
            if is_default and not existing.is_default:
                # 如果设为默认，需要将其他智能体的默认状态取消
                ConversationAgent.query.filter_by(
                    conversation_id=conversation_id,
                    is_default=True
                ).update({'is_default': False})

                existing.is_default = True
                db.session.commit()

            return True

        # 如果要添加的智能体设为默认，需要将其他智能体的默认状态取消
        if is_default:
            ConversationAgent.query.filter_by(
                conversation_id=conversation_id,
                is_default=True
            ).update({'is_default': False})

        # 创建新的会话-智能体关系
        conv_agent = ConversationAgent(
            conversation_id=conversation_id,
            agent_id=agent_id,
            is_default=is_default
        )

        db.session.add(conv_agent)
        db.session.commit()

        return True

    @staticmethod
    def remove_agent_from_conversation(conversation_id, agent_id):
        """从会话中移除智能体"""
        conv_agent = ConversationAgent.query.filter_by(
            conversation_id=conversation_id,
            agent_id=agent_id
        ).first()

        if not conv_agent:
            return False

        # 如果移除的是默认智能体，需要重新指定默认智能体
        if conv_agent.is_default:
            other_agent = ConversationAgent.query.filter(
                ConversationAgent.conversation_id == conversation_id,
                ConversationAgent.agent_id != agent_id
            ).first()

            if other_agent:
                other_agent.is_default = True

        db.session.delete(conv_agent)
        db.session.commit()

        return True

    @staticmethod
    def get_message_by_id(message_id):
        """根据ID获取消息"""
        message = Message.query.get(message_id)
        if not message:
            return None

        message_data = {
            'id': message.id,
            'conversation_id': message.conversation_id,
            'content': message.content,
            'role': message.role,
            'created_at': message.created_at.isoformat()
        }

        if message.agent_id:
            agent = Agent.query.get(message.agent_id)
            if agent:
                message_data['agent'] = {
                    'id': agent.id,
                    'name': agent.name,
                    'role': agent.role
                }

        return message_data

    @staticmethod
    def update_message(message_id, data):
        """更新消息"""
        message = Message.query.get(message_id)
        if not message:
            return None

        if 'content' in data:
            message.content = data['content']

        db.session.commit()

        return DatabaseService.get_message_by_id(message_id)

    @staticmethod
    def delete_message(message_id):
        """删除消息"""
        message = Message.query.get(message_id)
        if not message:
            return False

        db.session.delete(message)
        db.session.commit()

        return True

    @staticmethod
    def delete_conversation(conversation_id):
        """删除会话"""
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return False

        # 删除关联的消息
        Message.query.filter_by(conversation_id=conversation_id).delete()

        # 删除关联的智能体关系
        ConversationAgent.query.filter_by(conversation_id=conversation_id).delete()

        # 删除会话
        db.session.delete(conversation)
        db.session.commit()

        return True

    @staticmethod
    def create_message(conversation_id, content, role='user', agent_id=None):
        """创建新消息"""
        current_time = get_current_time_with_timezone()

        message = Message(
            conversation_id=conversation_id,
            content=content,
            role=role,
            created_at=current_time,
            updated_at=current_time
        )

        if agent_id:
            message.agent_id = agent_id

        db.session.add(message)
        db.session.commit()
        return message

    @staticmethod
    def get_agent_by_id(agent_id):
        """根据ID获取智能体"""
        agent = Agent.query.get(agent_id)
        if not agent:
            return None

        return {
            'id': agent.id,
            'name': agent.name,
            'role': agent.role,
            'description': agent.description,
            'personality': agent.personality,
            'system_prompt': agent.system_prompt,
            'avatar': agent.avatar
        }

    @staticmethod
    def create_agent(data):
        """创建智能体"""
        agent = Agent(
            name=data.get('name', '新智能体'),
            role=data.get('role', '助手'),
            description=data.get('description', ''),
            personality=data.get('personality', ''),
            system_prompt=data.get('system_prompt', ''),
            avatar=data.get('avatar', 'default.png')
        )

        db.session.add(agent)
        db.session.commit()

        return {
            'id': agent.id,
            'name': agent.name,
            'role': agent.role,
            'description': agent.description,
            'personality': agent.personality,
            'system_prompt': agent.system_prompt,
            'avatar': agent.avatar
        }

    @staticmethod
    def update_agent(agent_id, data):
        """更新智能体"""
        agent = Agent.query.get(agent_id)
        if not agent:
            return None

        if 'name' in data:
            agent.name = data['name']
        if 'role' in data:
            agent.role = data['role']
        if 'description' in data:
            agent.description = data['description']
        if 'personality' in data:
            agent.personality = data['personality']
        if 'system_prompt' in data:
            agent.system_prompt = data['system_prompt']
        if 'avatar' in data:
            agent.avatar = data['avatar']

        db.session.commit()

        return {
            'id': agent.id,
            'name': agent.name,
            'role': agent.role,
            'description': agent.description,
            'personality': agent.personality,
            'system_prompt': agent.system_prompt,
            'avatar': agent.avatar
        }

    @staticmethod
    def delete_agent(agent_id):
        """删除智能体"""
        agent = Agent.query.get(agent_id)
        if not agent:
            return False

        # 删除智能体的所有变量
        from app.models import AgentVariable
        AgentVariable.query.filter_by(agent_id=agent_id).delete()

        # 删除与此智能体相关的会话关系
        ConversationAgent.query.filter_by(agent_id=agent_id).delete()

        # 更新相关消息的agent_id为None
        Message.query.filter_by(agent_id=agent_id).update({'agent_id': None})

        db.session.delete(agent)
        db.session.commit()

        return True