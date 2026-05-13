from app.models import db, Message, Agent
from typing import Union, Dict, Any
import logging
import json
from app.utils.datetime_utils import get_current_time_with_timezone

logger = logging.getLogger(__name__)

class MessageService:
    """消息处理服务"""

    @staticmethod
    def create_message(content, role='user', agent_id=None, task_id=None, user_id=None, conversation_id=None):
        """
        创建新消息

        参数:
            content: 消息内容（字符串或多模态数组）
            role: 消息角色（human/agent）
            agent_id: 智能体ID（如果是智能体消息）
            task_id: 行动任务ID
            user_id: 用户ID
            conversation_id: 会话ID
        """
        # 获取当前时间（使用系统时区）
        current_time = get_current_time_with_timezone()

        # 处理多模态内容：如果content是list，序列化为JSON字符串
        if isinstance(content, list):
            content_str = json.dumps(content, ensure_ascii=False)
            logger.info(f"多模态消息内容已序列化，长度: {len(content_str)}")
        else:
            content_str = content

        message = Message(
            content=content_str,
            role=role,
            agent_id=agent_id,
            action_task_id=task_id,
            user_id=user_id,
            conversation_id=conversation_id,
            created_at=current_time,
            updated_at=current_time
        )

        try:
            db.session.add(message)

            # 如果消息关联了行动任务，更新行动任务的updated_at时间
            if task_id:
                from app.models import ActionTask
                action_task = ActionTask.query.get(task_id)
                if action_task:
                    action_task.updated_at = current_time
                    logger.debug(f"更新行动任务的updated_at时间: 任务ID={task_id}")

            db.session.commit()
            logger.info(f"创建消息成功: ID={message.id}, 行动任务ID={task_id}, 会话ID={conversation_id}")
            return message
        except Exception as e:
            db.session.rollback()
            logger.error(f"创建消息失败: {str(e)}")
            raise

    @staticmethod
    def get_message(message_id):
        """根据ID获取消息"""
        return Message.query.get(message_id)

    @staticmethod
    def get_action_task_messages(task_id):
        """获取行动任务的所有消息"""
        return Message.query.filter_by(action_task_id=task_id).order_by(Message.created_at).all()

    @staticmethod
    def update_message(message_id, data):
        """更新消息内容"""
        message = Message.query.get(message_id)
        if not message:
            return None

        if 'content' in data:
            message.content = data['content']

        db.session.commit()
        return message

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
    def format_message_for_api(message) -> Dict[str, Any]:
        """格式化消息用于API响应"""
        # 处理消息内容：尝试反序列化JSON格式的多模态内容
        content = message.content
        try:
            # 尝试解析为JSON（多模态内容）
            if content and content.strip().startswith('['):
                content = json.loads(content)
        except (json.JSONDecodeError, AttributeError):
            # 如果不是JSON格式，保持原始字符串
            pass

        result = {
            'id': message.id,
            'content': content,
            'role': message.role,
            'created_at': message.created_at.isoformat(),
            'updated_at': message.updated_at.isoformat() if message.updated_at else None
        }

        # 添加智能体信息
        if message.agent_id:
            agent = Agent.query.get(message.agent_id)
            if agent:
                result['agent'] = {
                    'id': agent.id,
                    'name': agent.name,
                    'description': agent.description,
                    'avatar': agent.avatar
                }

        return result