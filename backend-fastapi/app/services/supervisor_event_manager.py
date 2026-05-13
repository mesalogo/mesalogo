"""
监督者事件管理器
负责在关键节点触发监督者检查和规则检查
"""

import logging
from typing import List, Dict, Any, Optional
from app.models import ActionSpaceObserver, Conversation, ActionTask, db
from app.services.supervisor_rule_checker import SupervisorRuleChecker

logger = logging.getLogger(__name__)

class SupervisorEventManager:
    """监督者事件管理器"""
    
    def __init__(self):
        self.rule_checker = SupervisorRuleChecker()
    
    def on_agent_response_completed(self, conversation_id: int, agent_id: int, 
                                  message_id: int, is_last_agent: bool = False) -> None:
        """
        智能体回复完成事件处理
        
        Args:
            conversation_id: 会话ID
            agent_id: 智能体ID
            message_id: 消息ID
            is_last_agent: 是否是最后一个智能体
        """
        try:
            logger.info(f"[监督者事件] 智能体回复完成事件 - 会话: {conversation_id}, 智能体: {agent_id}, 是否最后一个: {is_last_agent}")

            # 首先检查会话中是否真的配置了监督者智能体
            if not self._has_supervisor_agents(conversation_id):
                logger.debug(f"会话 {conversation_id} 中没有配置监督者智能体，跳过规则监督")
                return

            # 获取会话信息
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                logger.error(f"会话 {conversation_id} 不存在")
                return
            
            # 获取行动任务
            action_task = ActionTask.query.get(conversation.action_task_id)
            if not action_task:
                logger.error(f"行动任务不存在，会话ID: {conversation_id}")
                return
            
            # 获取监督者列表
            supervisors = self._get_conversation_supervisors(conversation_id)
            if not supervisors:
                logger.debug(f"会话 {conversation_id} 没有配置监督者")
                return
            
            # 处理每个监督者的检查
            for supervisor in supervisors:
                settings = supervisor.get_supervision_settings()
                supervision_mode = settings.get('supervision_mode', 'round_based')
                triggers = settings.get('triggers', {})
                
                # 即时监督：每个智能体回复后都检查
                if supervision_mode == 'immediate' and triggers.get('after_each_agent', False):
                    logger.info(f"触发即时监督检查 - 会话: {conversation_id}, 智能体: {agent_id}")
                    self._trigger_rule_check(
                        supervisor=supervisor,
                        conversation_id=conversation_id,
                        trigger_type='automatic',
                        trigger_source='immediate_supervision',
                        context_type='agent_response'
                    )
                
                # 轮次监督：最后一个智能体回复后检查
                elif supervision_mode == 'round_based' and triggers.get('after_each_round', True) and is_last_agent:
                    logger.info(f"触发轮次监督检查 - 会话: {conversation_id}")
                    self._trigger_rule_check(
                        supervisor=supervisor,
                        conversation_id=conversation_id,
                        trigger_type='automatic',
                        trigger_source='round_supervision',
                        context_type='round_completion'
                    )
                    
        except Exception as e:
            logger.error(f"处理智能体回复完成事件时出错: {str(e)}")
    
    def on_round_completed(self, conversation_id: int, round_number: int) -> None:
        """
        轮次完成事件处理
        
        Args:
            conversation_id: 会话ID
            round_number: 轮次编号
        """
        try:
            # 首先检查会话中是否真的配置了监督者智能体
            if not self._has_supervisor_agents(conversation_id):
                logger.debug(f"会话 {conversation_id} 中没有配置监督者智能体，跳过规则监督")
                return
            
            # 获取监督者列表
            supervisors = self._get_conversation_supervisors(conversation_id)
            if not supervisors:
                return
            
            # 处理每个监督者的轮次检查
            for supervisor in supervisors:
                settings = supervisor.get_supervision_settings()
                supervision_mode = settings.get('supervision_mode', 'round_based')
                triggers = settings.get('triggers', {})
                
                if supervision_mode == 'round_based' and triggers.get('after_each_round', True):
                    logger.info(f"触发轮次完成检查 - 会话: {conversation_id}, 轮次: {round_number}")
                    self._trigger_rule_check(
                        supervisor=supervisor,
                        conversation_id=conversation_id,
                        trigger_type='automatic',
                        trigger_source='round_completion',
                        context_type='round_completion',
                        round_number=round_number
                    )
                    
        except Exception as e:
            logger.error(f"处理轮次完成事件时出错: {str(e)}")
    
    def _has_supervisor_agents(self, conversation_id: int) -> bool:
        """检查会话中是否配置了监督者智能体"""
        try:
            from app.models import ConversationAgent, Agent
            
            # 获取会话中的所有智能体
            conv_agents = ConversationAgent.query.filter_by(
                conversation_id=conversation_id
            ).all()
            
            if not conv_agents:
                return False
            
            # 检查是否有监督者智能体
            for conv_agent in conv_agents:
                agent = Agent.query.get(conv_agent.agent_id)
                if agent and agent.is_observer:
                    logger.debug(f"会话 {conversation_id} 中找到监督者智能体: {agent.name} (ID: {agent.id})")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"检查会话监督者智能体时出错: {str(e)}")
            return False
    
    def _get_conversation_supervisors(self, conversation_id: int) -> List[ActionSpaceObserver]:
        """获取会话的监督者列表"""
        try:
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                return []
            
            action_task = ActionTask.query.get(conversation.action_task_id)
            if not action_task:
                return []
            
            # 获取行动空间的监督者
            supervisors = ActionSpaceObserver.query.filter_by(
                action_space_id=action_task.action_space_id
            ).all()
            
            return supervisors
            
        except Exception as e:
            logger.error(f"获取会话监督者时出错: {str(e)}")
            return []
    
    def _trigger_rule_check(self, supervisor: ActionSpaceObserver, conversation_id: int,
                           trigger_type: str, trigger_source: str, context_type: str,
                           round_number: int = None) -> None:
        """
        触发规则检查
        
        Args:
            supervisor: 监督者对象
            conversation_id: 会话ID
            trigger_type: 触发类型
            trigger_source: 触发源
            context_type: 上下文类型
            round_number: 轮次编号（可选）
        """
        try:
            # 获取行动空间关联的规则集
            rule_set_ids = []
            try:
                from app.models import ActionSpaceRuleSet
                space_rule_sets = ActionSpaceRuleSet.query.filter_by(
                    action_space_id=supervisor.action_space_id
                ).all()
                rule_set_ids = [srs.rule_set_id for srs in space_rule_sets]
            except Exception as e:
                logger.error(f"获取行动空间规则集时出错: {str(e)}")

            if not rule_set_ids:
                logger.debug(f"行动空间 {supervisor.action_space_id} 没有关联规则集，跳过规则检查")
                return
            
            # 构建检查上下文
            context = self._build_check_context(conversation_id, context_type, round_number)
            
            # 执行规则检查
            check_result = self.rule_checker.check_conversation_rules(
                conversation_id=conversation_id,
                rule_set_ids=rule_set_ids,
                role_id=supervisor.role_id
            )
            
            if check_result.get('success'):
                # 保存触发记录
                self.rule_checker.save_rule_trigger_logs(
                    conversation_id=conversation_id,
                    check_results=check_result.get('results', []),
                    context=context,
                    trigger_type=trigger_type,
                    trigger_source=trigger_source
                )
                
                logger.info(f"规则检查完成 - 监督者: {supervisor.id}, 会话: {conversation_id}, "
                          f"通过: {check_result.get('passed_rules', 0)}, "
                          f"未通过: {check_result.get('failed_rules', 0)}")
                
                # 如果有规则违规，可以在这里触发监督者干预
                if check_result.get('failed_rules', 0) > 0:
                    self._handle_rule_violations(supervisor, conversation_id, check_result)
            else:
                logger.error(f"规则检查失败 - 监督者: {supervisor.id}, 错误: {check_result.get('error')}")
                
        except Exception as e:
            logger.error(f"触发规则检查时出错: {str(e)}")
    
    def _build_check_context(self, conversation_id: int, context_type: str, 
                           round_number: int = None) -> str:
        """构建检查上下文"""
        try:
            from app.models import Message
            
            # 获取最近的消息作为上下文
            messages = Message.query.filter_by(
                conversation_id=conversation_id
            ).order_by(Message.created_at.desc()).limit(10).all()
            
            if not messages:
                return f"[{context_type}] 会话暂无消息内容"
            
            # 构建上下文字符串
            context_parts = []
            if round_number:
                context_parts.append(f"[轮次 {round_number} 完成检查]")
            else:
                context_parts.append(f"[{context_type} 检查]")
            
            context_parts.append("最近的会话内容：")
            
            for msg in reversed(messages):  # 按时间正序显示
                role_display = {
                    'user': '用户',
                    'agent': '智能体',
                    'supervisor': '监督者'
                }.get(msg.role, msg.role)
                
                content = msg.content[:200] + "..." if len(msg.content) > 200 else msg.content
                context_parts.append(f"{role_display}: {content}")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"构建检查上下文时出错: {str(e)}")
            return f"[{context_type}] 构建上下文失败: {str(e)}"
    
    def _handle_rule_violations(self, supervisor: ActionSpaceObserver, 
                              conversation_id: int, check_result: Dict[str, Any]) -> None:
        """处理规则违规情况"""
        try:
            settings = supervisor.get_supervision_settings()
            intervention_settings = settings.get('intervention_settings', {})
            
            # 检查是否需要监督者干预
            threshold = intervention_settings.get('threshold', 0.7)
            failed_rules = check_result.get('failed_rules', 0)
            total_rules = check_result.get('total_rules', 1)
            violation_rate = failed_rules / total_rules
            
            if violation_rate >= threshold:
                logger.info(f"规则违规率 {violation_rate:.2f} 超过阈值 {threshold}，"
                          f"监督者 {supervisor.id} 可能需要干预")
                
                # TODO: 这里可以实现监督者自动干预逻辑
                # 例如：自动发送监督消息、记录干预日志等
                
        except Exception as e:
            logger.error(f"处理规则违规时出错: {str(e)}")

# 全局事件管理器实例
supervisor_event_manager = SupervisorEventManager()
