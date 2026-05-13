"""
会话总结服务

提供会话内容总结功能，用于在创建新会话时生成上一会话的摘要
支持自动上下文总结功能
"""
import logging
from typing import Optional, Dict, List
from datetime import datetime
from app.models import db, Conversation, Message, ModelConfig, SystemSetting
from app.services.conversation.model_client import ModelClient

logger = logging.getLogger(__name__)

# 总结提示词模板
SUMMARY_PROMPT_TEMPLATE = """你是一个专业的会话总结助手。请仔细阅读以下对话内容，提取关键信息并生成一个简洁的总结。

总结应包括：
1. 主要讨论的话题和目标
2. 已达成的共识或决定
3. 待解决的问题或下一步行动
4. 重要的数据、结论或参考信息

请用 2-3 段文字进行总结，保持专业和客观，总结以“上一次会话”开头。

---
对话历史：

{conversation_messages}

---
请开始总结："""

# 最大总结消息数量
MAX_MESSAGES_FOR_SUMMARY = 100

class SummaryService:
    """会话总结服务"""
    
    @staticmethod
    def get_default_summary_model() -> Optional[ModelConfig]:
        """
        获取默认的总结模型配置
        
        Returns:
            ModelConfig 对象，未配置时返回 None
        """
        try:
            return ModelConfig.query.filter_by(is_default_text=True).first()
        except Exception as e:
            logger.error(f"获取默认模型配置失败: {str(e)}")
            return None
    
    @staticmethod
    def format_messages_for_summary(messages: List[Message]) -> str:
        """
        格式化消息列表为适合总结的文本格式
        
        Args:
            messages: 消息列表
            
        Returns:
            格式化后的文本
        """
        formatted = []
        for msg in messages:
            # 确定发言者
            if msg.role == 'human':
                speaker = "用户"
            elif msg.role == 'agent':
                # 如果有关联的智能体，使用智能体名称
                if msg.agent_id:
                    from app.models import Agent
                    agent = Agent.query.get(msg.agent_id)
                    speaker = agent.name if agent else "智能体"
                else:
                    speaker = "智能体"
            elif msg.role == 'supervisor':
                # 监督者消息
                if msg.agent_id:
                    from app.models import Agent
                    agent = Agent.query.get(msg.agent_id)
                    speaker = f"监督者-{agent.name}" if agent else "监督者"
                else:
                    speaker = "监督者"
            elif msg.role == 'system':
                speaker = "系统"
            elif msg.role == 'tool':
                continue  # 跳过工具消息
            else:
                speaker = msg.role
            
            # 截断过长的内容
            content = msg.content
            if len(content) > 1000:
                content = content[:1000] + "..."
            
            formatted.append(f"[{speaker}]: {content}")
        
        return "\n\n".join(formatted)
    
    @staticmethod
    def summarize_conversation(conversation_id: str, model_config: ModelConfig = None) -> str:
        """
        总结会话内容
        
        Args:
            conversation_id: 会话ID
            model_config: 模型配置（可选，不提供则使用默认）
            
        Returns:
            总结文本
            
        Raises:
            ValueError: 如果会话不存在或无消息
            Exception: 如果总结生成失败
        """
        try:
            # 检查会话是否存在
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                raise ValueError(f"会话不存在: {conversation_id}")
            
            # 获取会话的所有消息
            messages = Message.query.filter_by(
                conversation_id=conversation_id
            ).order_by(Message.created_at.asc()).all()
            
            if not messages:
                raise ValueError(f"会话无消息: {conversation_id}")
            
            # 如果消息数量超过限制，只取最近的消息
            if len(messages) > MAX_MESSAGES_FOR_SUMMARY:
                logger.info(f"会话消息数量 {len(messages)} 超过限制 {MAX_MESSAGES_FOR_SUMMARY}，仅总结最近的消息")
                messages = messages[-MAX_MESSAGES_FOR_SUMMARY:]
            
            # 获取模型配置
            if not model_config:
                model_config = SummaryService.get_default_summary_model()
                if not model_config:
                    raise ValueError("未配置默认总结模型")
            
            # 格式化消息
            formatted_messages = SummaryService.format_messages_for_summary(messages)
            
            # 构建提示词
            prompt = SUMMARY_PROMPT_TEMPLATE.format(
                conversation_messages=formatted_messages
            )
            
            # 构建请求消息
            request_messages = [
                {
                    'role': 'user',
                    'content': prompt
                }
            ]
            
            logger.info(f"开始总结会话 {conversation_id}，消息数量: {len(messages)}")
            
            # 调用模型生成总结
            summary_parts = []
            
            def collect_content(content):
                """收集流式响应内容 - 只接收 content 参数"""
                if content:
                    summary_parts.append(content)
            
            # 创建 ModelClient 实例并发送请求
            model_client = ModelClient()
            model_client.send_request(
                api_url=model_config.base_url,
                api_key=model_config.api_key,
                messages=request_messages,
                model=model_config.model_id,
                is_stream=True,  # 使用流式模式
                callback=collect_content,
                temperature=0.7,
                max_tokens=model_config.max_output_tokens,
                timeout=model_config.request_timeout,
                **(model_config.additional_params or {})
            )
            
            summary = ''.join(summary_parts).strip()
            
            if not summary:
                raise Exception("模型返回空总结")
            
            logger.info(f"会话 {conversation_id} 总结完成，长度: {len(summary)}")
            return summary
            
        except ValueError as e:
            # 重新抛出值错误（会话不存在等）
            raise
        except Exception as e:
            logger.error(f"总结会话失败: {str(e)}")
            raise Exception(f"总结会话失败: {str(e)}")

    @staticmethod
    def check_need_summarize(conversation_id: str, is_autonomous: bool = False) -> bool:
        """
        检查是否需要触发上下文总结
        
        Args:
            conversation_id: 会话ID
            is_autonomous: 是否为自主任务
            
        Returns:
            bool: 是否需要触发总结
        """
        try:
            # 根据任务类型检查对应的开关
            if is_autonomous:
                auto_summarize = SystemSetting.get('auto_summarize_context_autonomous', False)
            else:
                auto_summarize = SystemSetting.get('auto_summarize_context', False)
            if not auto_summarize:
                return False
            
            # 获取上下文消息数量限制
            max_history = SystemSetting.get('max_conversation_history_length', 10)
            if max_history == 0:  # 0表示不限制
                return False
            
            # 查找最近一次上下文总结消息
            # 先查询所有system消息，再在Python中过滤（兼容SQLite）
            system_messages = Message.query.filter(
                Message.conversation_id == conversation_id,
                Message.role == 'system'
            ).order_by(Message.created_at.desc()).all()
            
            last_summary = None
            for msg in system_messages:
                if msg.meta and msg.meta.get('type') == 'context_summary':
                    last_summary = msg
                    break
            
            if last_summary:
                # 统计自上次总结后的新消息数（只统计agent和human角色）
                new_message_count = Message.query.filter(
                    Message.conversation_id == conversation_id,
                    Message.role.in_(['agent', 'human']),
                    Message.created_at > last_summary.created_at
                ).count()
                
                need_summarize = new_message_count >= max_history
                if need_summarize:
                    logger.info(f"会话 {conversation_id} 自上次总结后新消息数 {new_message_count} 达到限制 {max_history}，需要触发总结")
                return need_summarize
            else:
                # 没有历史总结，统计全部消息数
                message_count = Message.query.filter(
                    Message.conversation_id == conversation_id,
                    Message.role.in_(['agent', 'human'])
                ).count()
                
                need_summarize = message_count > max_history
                if need_summarize:
                    logger.info(f"会话 {conversation_id} 消息数 {message_count} 超过限制 {max_history}，需要触发总结")
                return need_summarize
            
        except Exception as e:
            logger.error(f"检查是否需要总结时出错: {str(e)}")
            return False

    @staticmethod
    def summarize_context(conversation_id: str) -> dict:
        """
        总结会话的上下文消息（滚动总结）
        
        只总结最近 max_conversation_history_length 条消息，
        形成滚动摘要效果。
        
        Redis 缓存策略：
        - 读消息：优先从 Redis 读取（避免 scoped_session 脏快照触发 MySQL 1020）
        - 写总结：commit 后写入 Redis 缓存
        - Redis 不可用时自动 fallback 到 DB（保留 rollback+retry 作为兜底）
        
        Args:
            conversation_id: 会话ID
            
        Returns:
            dict: {'message_id': id, 'summary': content}
        """
        try:
            # 获取上下文消息数量限制
            max_history = SystemSetting.get('max_conversation_history_length', 10)
            
            # ── 优先从 Redis 读取消息（核心改进：绕过 scoped_session 脏快照）──
            messages = None
            _from_redis = False
            try:
                from core.model_cache import get_conversation_messages_cached
                cached_msgs = get_conversation_messages_cached(
                    conversation_id,
                    roles=['agent', 'human', 'system'],
                    limit=max_history,
                    order_desc=False,
                )
                if cached_msgs:
                    # 将 dict 转为轻量代理对象，兼容 format_messages_for_summary
                    class _MsgProxy:
                        def __init__(self, d):
                            self.__dict__.update(d)
                        def __getattr__(self, name):
                            return self.__dict__.get(name)
                    messages = [_MsgProxy(m) for m in cached_msgs]
                    _from_redis = True
                    logger.debug(f"从 Redis 获取 {len(messages)} 条消息用于总结")
            except Exception as _cache_err:
                logger.debug(f"Redis 读取消息失败（fallback DB）: {_cache_err}")
            
            # Redis 未命中 → 从 DB 查询（原始逻辑）
            if messages is None:
                messages = Message.query.filter(
                    Message.conversation_id == conversation_id,
                    Message.role.in_(['agent', 'human', 'system'])
                ).order_by(Message.created_at.desc()).limit(max_history).all()
                messages.reverse()
            
            if not messages:
                raise ValueError(f"会话 {conversation_id} 无消息可总结")
            
            # 获取默认模型
            model_config = SummaryService.get_default_summary_model()
            if not model_config:
                raise ValueError("未配置默认总结模型")
            
            # 格式化消息
            formatted_messages = SummaryService.format_messages_for_summary(messages)
            
            # 构建上下文总结提示词
            context_summary_prompt = f"""请仔细阅读以下对话内容，生成一个简洁的上下文总结。

总结应包括：
1. 对话的主要话题和进展
2. 已达成的共识或决定
3. 重要的数据、结论或待处理事项

请用1-2段文字进行总结，保持简洁客观。

---
对话历史：

{formatted_messages}

---
请开始总结："""
            
            # 构建请求消息
            request_messages = [
                {
                    'role': 'user',
                    'content': context_summary_prompt
                }
            ]
            
            logger.info(f"开始总结会话 {conversation_id} 的上下文，消息数量: {len(messages)}，来源: {'Redis' if _from_redis else 'DB'}")
            
            # 调用模型生成总结
            summary_parts = []
            
            def collect_content(content):
                if content:
                    summary_parts.append(content)
            
            model_client = ModelClient()
            model_client.send_request(
                api_url=model_config.base_url,
                api_key=model_config.api_key,
                messages=request_messages,
                model=model_config.model_id,
                is_stream=True,
                callback=collect_content,
                temperature=0.7,
                max_tokens=model_config.max_output_tokens,
                timeout=model_config.request_timeout,
                **(model_config.additional_params or {})
            )
            
            summary = ''.join(summary_parts).strip()
            
            if not summary:
                raise Exception("模型返回空总结")
            
            # ── 写入总结消息 ──
            # 如果消息来自 Redis，session 是干净的（没有旧的 SELECT 快照），
            # 直接 INSERT 不会触发 MySQL 1020。
            # 保留 rollback+retry 作为兜底（应对 Redis 不可用时的 DB fallback 场景）。
            import time
            from app.utils.datetime_utils import get_current_time_with_timezone
            
            max_retries = 3 if not _from_redis else 1  # Redis 命中时只需 1 次
            for attempt in range(max_retries):
                try:
                    # rollback 确保 session 干净
                    try:
                        db.session.rollback()
                    except Exception:
                        pass
                    
                    # 重新查询会话（获取 action_task_id）
                    conversation = Conversation.query.get(conversation_id)
                    if not conversation:
                        raise ValueError(f"会话不存在: {conversation_id}")
                    
                    summary_message = Message(
                        role='system',
                        content=f'[上下文总结]\n\n{summary}',
                        conversation_id=conversation_id,
                        action_task_id=conversation.action_task_id,
                        meta={
                            'type': 'context_summary',
                            'summarized_at': get_current_time_with_timezone().isoformat(),
                            'message_count': len(messages)
                        }
                    )
                    db.session.add(summary_message)
                    db.session.commit()
                    
                    # 写入 Redis 消息缓存
                    try:
                        from core.model_cache import cache_message
                        cache_message(summary_message)
                    except Exception as _cache_err:
                        logger.debug(f"Redis 缓存总结消息失败（不影响业务）: {_cache_err}")
                    
                    logger.info(f"会话 {conversation_id} 上下文总结完成，总结消息ID: {summary_message.id}")
                    
                    return {
                        'message_id': summary_message.id,
                        'summary': summary
                    }
                except Exception as retry_err:
                    err_str = str(retry_err)
                    if attempt < max_retries - 1 and ('1020' in err_str or 'has been rolled back' in err_str):
                        logger.warning(f"上下文总结写入重试 {attempt + 1}/{max_retries}: {err_str}")
                        try:
                            db.session.rollback()
                        except Exception:
                            pass
                        time.sleep(0.3 * (attempt + 1))
                        continue
                    else:
                        raise
            
        except ValueError as e:
            raise
        except Exception as e:
            try:
                db.session.rollback()
            except Exception:
                pass
            logger.error(f"上下文总结失败: {str(e)}")
            raise Exception(f"上下文总结失败: {str(e)}")
