"""
智能分发服务

根据消息内容自动选择最合适的智能体进行响应
"""
import logging
from typing import Optional, List
from app.models import db, Conversation, Message, Agent, Role, ModelConfig, ConversationAgent

logger = logging.getLogger(__name__)

# 智能分发提示词模板
DISPATCH_PROMPT_TEMPLATE = """You are a smart dispatch system. Select the most suitable agent to respond based on the conversation context and user's latest message.

## Available Agents
{agent_descriptions}

## Recent Conversation Context
{recent_context}

## User's Latest Message
{message_content}

## Selection Rules
1. Match the agent's expertise with the domain of user's question
2. If user is following up on a specific agent's response, prefer that agent
3. If the question spans multiple domains, select the most relevant agent

Return ONLY the agent ID, e.g.: 6290bbc9-7a54-490c-9570-f4a13ac99a13"""


class SmartDispatchService:
    """智能分发服务"""
    
    @staticmethod
    def get_available_agents(task_id: int, conversation_id: int) -> List[Agent]:
        """
        获取会话中可用的智能体列表（排除观察者，优先 Redis 缓存）
        """
        try:
            # 优先从 Redis 获取 conversation_agents 关系
            agent_ids = None
            try:
                from core.model_cache import get_conversation_agents_cached, get_agent_cached
                cached_cas = get_conversation_agents_cached(conversation_id)
                if cached_cas:
                    agent_ids = [ca['agent_id'] for ca in cached_cas if ca.get('agent_id')]
            except Exception:
                pass

            if agent_ids is None:
                conv_agents = ConversationAgent.query.filter_by(
                    conversation_id=conversation_id
                ).all()
                agent_ids = [ca.agent_id for ca in conv_agents]

            # 获取 Agent 对象（优先缓存）
            agents = []
            for aid in agent_ids:
                try:
                    from core.model_cache import get_agent_cached
                    agent_dict = get_agent_cached(aid)
                    if agent_dict:
                        class _AgentProxy:
                            def __init__(self, d):
                                self.__dict__.update(d)
                            def __getattr__(self, name):
                                return self.__dict__.get(name)
                        agents.append(_AgentProxy(agent_dict))
                        continue
                except Exception:
                    pass
                agent = Agent.query.get(aid)
                if agent:
                    agents.append(agent)
            
            # 过滤掉观察者
            available_agents = [
                agent for agent in agents 
                if not getattr(agent, 'is_observer', False) and getattr(agent, 'type', '') != 'observer'
            ]
            
            return available_agents
        except Exception as e:
            logger.error(f"获取可用智能体失败: {str(e)}")
            return []
    
    @staticmethod
    def format_agent_descriptions(agents: List[Agent]) -> str:
        """
        格式化智能体描述信息（带 Redis 缓存）
        """
        descriptions = []
        for i, agent in enumerate(agents, 1):
            # 优先从 Redis 缓存读取 Role
            role = None
            if agent.role_id:
                try:
                    from core.model_cache import get_role_cached
                    role_dict = get_role_cached(agent.role_id)
                    if role_dict:
                        class _RoleProxy:
                            def __init__(self, d):
                                self.__dict__.update(d)
                        role = _RoleProxy(role_dict)
                except Exception:
                    pass
                if role is None:
                    role = Role.query.get(agent.role_id)

            role_name = role.name if role else "通用助手"
            role_desc = getattr(role, 'description', None) or "无特定描述"
            
            desc = f"{i}. **{agent.name}** (ID: {agent.id})\n   Expertise: {role_desc[:100]}"
            descriptions.append(desc)
        
        return "\n".join(descriptions)
    
    @staticmethod
    def get_recent_context(conversation_id: int, limit: int = 2) -> str:
        """
        获取最近的对话上下文（优先从 Redis 缓存读取）
        
        Args:
            conversation_id: 会话ID
            limit: 获取最近几轮对话
            
        Returns:
            格式化的上下文字符串
        """
        try:
            recent_messages = None

            # 优先从 Redis 读取
            try:
                from core.model_cache import get_conversation_messages_cached
                cached_msgs = get_conversation_messages_cached(
                    conversation_id,
                    roles=['human', 'agent'],
                    limit=limit * 2,
                    order_desc=False,
                )
                if cached_msgs:
                    # 取最后 limit*2 条（最近的）
                    recent_messages = cached_msgs[-(limit * 2):]
            except Exception:
                pass

            # Redis 未命中 → DB 查询
            if recent_messages is None:
                db_msgs = Message.query.filter(
                    Message.conversation_id == conversation_id,
                    Message.role.in_(['human', 'agent'])
                ).order_by(Message.created_at.desc()).limit(limit * 2).all()
                
                if not db_msgs:
                    return "(No conversation history)"
                
                recent_messages = list(reversed(db_msgs))
                # 转为 dict 格式统一处理
                recent_messages = [
                    {'role': m.role, 'content': m.content, 'agent_id': str(m.agent_id) if m.agent_id else None}
                    for m in recent_messages
                ]
            
            if not recent_messages:
                return "(No conversation history)"
            
            context_parts = []
            for msg in recent_messages:
                role = msg.get('role') if isinstance(msg, dict) else getattr(msg, 'role', None)
                content = msg.get('content', '') if isinstance(msg, dict) else getattr(msg, 'content', '')
                agent_id = msg.get('agent_id') if isinstance(msg, dict) else getattr(msg, 'agent_id', None)

                if role == 'human':
                    context_parts.append(f"User: {content[:200]}")
                elif role == 'agent' and agent_id:
                    # 从缓存获取 agent 名称
                    agent_name = "Agent"
                    try:
                        from core.model_cache import get_agent_cached
                        agent_dict = get_agent_cached(agent_id)
                        if agent_dict:
                            agent_name = agent_dict.get('name', 'Agent')
                        else:
                            agent_obj = Agent.query.get(agent_id)
                            agent_name = agent_obj.name if agent_obj else "Agent"
                    except Exception:
                        agent_obj = Agent.query.get(agent_id)
                        agent_name = agent_obj.name if agent_obj else "Agent"
                    context_parts.append(f"{agent_name}: {content[:200]}")
            
            return "\n".join(context_parts) if context_parts else "(No conversation history)"
        except Exception as e:
            logger.error(f"获取对话上下文失败: {str(e)}")
            return "(No conversation history)"
    
    @staticmethod
    def select_best_agent(task_id: int, conversation_id: int, message_content: str) -> Optional[int]:
        """
        根据消息内容选择最佳智能体
        
        Args:
            task_id: 行动任务ID
            conversation_id: 会话ID
            message_content: 用户消息内容
            
        Returns:
            最佳智能体ID，如果选择失败返回None
        """
        try:
            # 获取可用智能体
            agents = SmartDispatchService.get_available_agents(task_id, conversation_id)
            
            if not agents:
                logger.warning(f"[智能分发] 没有可用智能体")
                return None
            
            # 如果只有一个智能体，直接返回
            if len(agents) == 1:
                logger.info(f"[智能分发] 只有一个智能体，直接选择: {agents[0].id}")
                return agents[0].id
            
            # 获取默认模型
            model_config = ModelConfig.query.filter_by(is_default_text=True).first()
            if not model_config:
                logger.warning(f"[智能分发] 未配置默认文本模型，使用第一个智能体")
                return agents[0].id
            
            # 获取最近对话上下文
            recent_context = SmartDispatchService.get_recent_context(conversation_id, limit=2)
            
            # 构建提示词
            agent_descriptions = SmartDispatchService.format_agent_descriptions(agents)
            prompt = DISPATCH_PROMPT_TEMPLATE.format(
                message_content=message_content[:500],
                agent_descriptions=agent_descriptions,
                recent_context=recent_context
            )
            
            # 调用模型
            from app.services.conversation.model_client import ModelClient
            
            messages = [{"role": "user", "content": prompt}]
            
            response_content = []
            def collect_response(content):
                if content:
                    response_content.append(content)
            
            # 创建 ModelClient 实例并发送请求
            model_client = ModelClient()
            model_client.send_request(
                api_url=model_config.base_url,
                api_key=model_config.api_key,
                messages=messages,
                model=model_config.model_id,
                is_stream=True,
                callback=collect_response,
                temperature=0,
                max_tokens=10
            )
            
            # 解析响应，提取智能体ID (UUID格式)
            response_text = ''.join(response_content).strip()
            logger.debug(f"[智能分发] 模型响应: {response_text}")
            
            # 尝试从响应中提取UUID格式的ID
            import re
            uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
            match = re.search(uuid_pattern, response_text, re.IGNORECASE)
            if match:
                selected_id = match.group()
                # 验证ID是否在可用智能体列表中
                valid_ids = [str(agent.id) for agent in agents]
                if selected_id in valid_ids:
                    logger.info(f"[智能分发] 选择智能体: {selected_id}")
                    return selected_id
                else:
                    logger.warning(f"[智能分发] 模型返回的ID {selected_id} 不在可用列表中: {valid_ids}")
            
            # 如果解析失败，返回第一个智能体
            logger.warning(f"[智能分发] 无法解析模型响应，使用第一个智能体")
            return agents[0].id
            
        except Exception as e:
            logger.error(f"[智能分发] 选择智能体失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
