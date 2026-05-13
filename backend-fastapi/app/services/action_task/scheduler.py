"""
会话调度器模块

提供以下功能：
1. 向所有智能体同时发送消息
2. 向特定智能体发送消息
3. 向一组智能体发送消息
4. 向随机智能体发送消息
5. 以轮询方式向智能体发送消息
6. 智能体可以在对话页面打开时以流模式回应
7. 支持等待发言列表，自动继续对话
"""
import threading
import time
import queue
import logging
import random
import json
from typing import List, Dict, Any, Optional, Union, Callable

from app.models import db, Conversation, ConversationAgent, Agent, Message
from app.services.conversation_service import ConversationService

logger = logging.getLogger(__name__)

class ConversationScheduler:
    """会话调度器类，管理智能体之间的对话流程"""
    
    def __init__(self, conversation_id: int):
        """
        初始化调度器
        
        Args:
            conversation_id: 会话ID
        """
        self.conversation_id = conversation_id
        self.speaking_queue = queue.Queue()  # 等待发言队列
        self.is_running = False  # 调度器运行状态
        self.conversation_thread = None  # 对话线程
        self.speaking_lock = threading.Lock()  # 发言锁，确保同一时间只有一个智能体在处理
        # 存储处理中的流式响应队列
        self.stream_queues = {}
        
    def start(self):
        """启动调度器"""
        if self.is_running:
            logger.warning(f"调度器已经在运行中，会话ID: {self.conversation_id}")
            return False
            
        self.is_running = True
            
        self.conversation_thread = threading.Thread(target=self._conversation_loop)
        self.conversation_thread.daemon = True
        self.conversation_thread.start()
        logger.info(f"调度器已启动，会话ID: {self.conversation_id}")
        return True
        
    def stop(self):
        """停止调度器"""
        if not self.is_running:
            logger.warning(f"调度器未运行，会话ID: {self.conversation_id}")
            return False
            
        self.is_running = False
        # 清空队列
        while not self.speaking_queue.empty():
            try:
                self.speaking_queue.get_nowait()
            except queue.Empty:
                break
                
        logger.info(f"调度器已停止，会话ID: {self.conversation_id}")
        return True
        
    def reset(self):
        """重置调度器"""
        self.stop()
        # 清空队列
        while not self.speaking_queue.empty():
            try:
                self.speaking_queue.get_nowait()
            except queue.Empty:
                break
        logger.info(f"调度器已重置，会话ID: {self.conversation_id}")
        return True
    
    def _process_stream_message(self, agent_id: int, content: str, callback=None):
        """处理流式消息
        
        Args:
            agent_id: 智能体ID
            content: 消息内容
            callback: 可选的回调函数
        """
        try:
            # 创建结果队列
            result_queue = queue.Queue()
            
            # 存储队列以允许取消操作
            stream_id = f"{agent_id}_{int(time.time())}"
            self.stream_queues[stream_id] = result_queue
            
            # 获取会话对象以获取任务ID
            conversation = Conversation.query.get(self.conversation_id)
            if not conversation:
                logger.error(f"会话不存在: {self.conversation_id}")
                return
            
            # 获取action_task_id
            action_task_id = conversation.action_task_id
            if not action_task_id:
                logger.error(f"会话没有关联的行动任务: {self.conversation_id}")
                return
            
            # 准备消息数据
            message_data = {
                'content': content,
                'target_agent_id': agent_id
            }
            
            logger.info(f"开始处理流式消息: 会话ID={self.conversation_id}, 任务ID={action_task_id}, 智能体ID={agent_id}")
            
            # 启动新线程处理流式请求
            thread = threading.Thread(
                target=ConversationService.process_stream_message,
                args=(None, action_task_id, self.conversation_id, message_data, result_queue)
            )
            thread.daemon = True
            thread.start()
            
            # 等待处理完成
            result = None
            while True:
                try:
                    msg = result_queue.get(timeout=120)  # 设置超时，避免无限等待
                    if msg is None:  # 结束信号
                        break
                    
                    # 如果是完成事件，存储响应对象
                    if isinstance(msg, dict) and msg.get('connectionStatus') == 'done':
                        result = msg.get('responseObj')
                    
                except queue.Empty:
                    logger.warning(f"等待流式处理结果超时，agent_id={agent_id}")
                    break
            
            # 清理
            if stream_id in self.stream_queues:
                del self.stream_queues[stream_id]
            
            # 返回最终结果
            if result and callback:
                agent_message = None
                if result.get('response') and result['response'].get('id'):
                    # 尝试从数据库获取消息对象
                    agent_message = Message.query.get(result['response']['id'])
                
                if callback and callable(callback):
                    callback(agent_message)
            
        except Exception as e:
            logger.error(f"处理流式消息时出错: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
                
    def _conversation_loop(self):
        """对话循环，处理等待队列中的消息"""
        while self.is_running:
            try:
                # 从队列中获取下一个要处理的项目
                next_item = self.speaking_queue.get(timeout=1)
                
                # 如果获取到有效的项目，则处理它
                if next_item:
                    agent_id = next_item.get('agent_id')
                    message_content = next_item.get('content')
                    callback = next_item.get('callback')
                    
                    logger.info(f"处理队列消息: agent_id={agent_id}, content={message_content[:50]}...")
                    
                    # 发送消息
                    with self.speaking_lock:
                        try:
                            # 使用流式处理
                            self._process_stream_message(agent_id, message_content, callback)
                        except Exception as e:
                            logger.error(f"处理队列消息时出错: {str(e)}")
                
                self.speaking_queue.task_done()
                
            except queue.Empty:
                # 队列为空，等待新消息
                pass
            except Exception as e:
                logger.error(f"对话循环中发生错误: {str(e)}")
                time.sleep(1)  # 避免CPU过度使用
                
    def send_to_all_agents(self, content: str, callback: Callable = None) -> bool:
        """
        向所有智能体发送相同的消息
        
        Args:
            content: 要发送的消息内容
            callback: 可选的回调函数，当消息处理完成时调用
            
        Returns:
            bool: 是否成功添加到队列
        """
        if not self.is_running:
            logger.warning(f"调度器未运行，无法发送消息，会话ID: {self.conversation_id}")
            return False
            
        try:
            # 获取会话中的所有智能体
            conversation_agents = ConversationAgent.query.filter_by(conversation_id=self.conversation_id).all()
            
            if not conversation_agents:
                logger.warning(f"会话中没有智能体，会话ID: {self.conversation_id}")
                return False
                
            # 向每个智能体添加一个消息到队列
            for conv_agent in conversation_agents:
                self.speaking_queue.put({
                    'agent_id': conv_agent.agent_id,
                    'content': content,
                    'callback': callback
                })
                    
            logger.info(f"已将消息添加到所有智能体的队列中，会话ID: {self.conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"向所有智能体发送消息时出错: {str(e)}")
            return False
            
    def send_to_agent(self, agent_id: int, content: str, callback: Callable = None) -> bool:
        """
        向特定智能体发送消息
        
        Args:
            agent_id: 智能体ID
            content: 要发送的消息内容
            callback: 可选的回调函数，当消息处理完成时调用
            
        Returns:
            bool: 是否成功添加到队列
        """
        if not self.is_running:
            logger.warning(f"调度器未运行，无法发送消息，会话ID: {self.conversation_id}")
            return False
            
        try:
            # 检查该智能体是否属于此会话
            conv_agent = ConversationAgent.query.filter_by(
                conversation_id=self.conversation_id,
                agent_id=agent_id
            ).first()
            
            if not conv_agent:
                logger.warning(f"智能体不属于此会话，agent_id={agent_id}, conversation_id={self.conversation_id}")
                return False
                    
            # 添加消息到队列
            self.speaking_queue.put({
                'agent_id': agent_id,
                'content': content,
                'callback': callback
            })
            
            logger.info(f"已将消息添加到智能体的队列中，agent_id={agent_id}, conversation_id={self.conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"向特定智能体发送消息时出错: {str(e)}")
            return False
            
    def send_to_group(self, agent_ids: List[int], content: str, callback: Callable = None) -> bool:
        """
        向一组智能体发送相同的消息
        
        Args:
            agent_ids: 智能体ID列表
            content: 要发送的消息内容
            callback: 可选的回调函数，当消息处理完成时调用
            
        Returns:
            bool: 是否成功添加到队列
        """
        if not self.is_running:
            logger.warning(f"调度器未运行，无法发送消息，会话ID: {self.conversation_id}")
            return False
            
        try:
            success_count = 0
            
            for agent_id in agent_ids:
                # 检查该智能体是否属于此会话
                conv_agent = ConversationAgent.query.filter_by(
                    conversation_id=self.conversation_id,
                    agent_id=agent_id
                ).first()
                
                if not conv_agent:
                    logger.warning(f"智能体不属于此会话，跳过，agent_id={agent_id}")
                    continue
                    
                # 添加消息到队列
                self.speaking_queue.put({
                    'agent_id': agent_id,
                    'content': content,
                    'callback': callback
                })
                success_count += 1
                    
            logger.info(f"已将消息添加到{success_count}个智能体的队列中，会话ID: {self.conversation_id}")
            return success_count > 0
            
        except Exception as e:
            logger.error(f"向一组智能体发送消息时出错: {str(e)}")
            return False
            
    def send_to_random_agent(self, content: str, callback: Callable = None) -> bool:
        """
        向随机选择的智能体发送消息
        
        Args:
            content: 要发送的消息内容
            callback: 可选的回调函数，当消息处理完成时调用
            
        Returns:
            bool: 是否成功添加到队列
        """
        if not self.is_running:
            logger.warning(f"调度器未运行，无法发送消息，会话ID: {self.conversation_id}")
            return False
            
        try:
            # 获取会话中的所有非监督者智能体
            conversation_agents = ConversationAgent.query.join(Agent).filter(
                ConversationAgent.conversation_id == self.conversation_id,
                Agent.is_observer == False  # 过滤掉监督者智能体
            ).all()

            if not conversation_agents:
                logger.warning(f"会话中没有可用的任务智能体（监督者智能体不参与随机发言），会话ID: {self.conversation_id}")
                return False
                
            # 随机选择一个智能体
            random_agent = random.choice(conversation_agents)
            
            # 添加消息到队列
            self.speaking_queue.put({
                'agent_id': random_agent.agent_id,
                'content': content,
                'callback': callback
            })
                
            logger.info(f"已将消息添加到随机智能体的队列中，agent_id={random_agent.agent_id}, conversation_id={self.conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"向随机智能体发送消息时出错: {str(e)}")
            return False
            
    def send_in_round_robin(self, content: str, callback: Callable = None) -> bool:
        """
        以轮询方式向智能体发送消息，每次调用会选择下一个智能体
        
        Args:
            content: 要发送的消息内容
            callback: 可选的回调函数，当消息处理完成时调用
            
        Returns:
            bool: 是否成功添加到队列
        """
        if not self.is_running:
            logger.warning(f"调度器未运行，无法发送消息，会话ID: {self.conversation_id}")
            return False
            
        try:
            # 获取会话中的所有非监督者智能体
            conversation_agents = ConversationAgent.query.join(Agent).filter(
                ConversationAgent.conversation_id == self.conversation_id,
                Agent.is_observer == False  # 过滤掉监督者智能体
            ).all()

            if not conversation_agents:
                logger.warning(f"会话中没有可用的任务智能体（监督者智能体不参与顺序发言），会话ID: {self.conversation_id}")
                return False
                
            # 获取最后一条消息的智能体
            last_message = Message.query.filter_by(
                conversation_id=self.conversation_id,
                role='agent'
            ).order_by(Message.created_at.desc()).first()
            
            next_agent = None
            
            if last_message and last_message.agent_id:
                # 找到最后发言智能体在列表中的位置
                agent_ids = [ca.agent_id for ca in conversation_agents]
                try:
                    last_index = agent_ids.index(last_message.agent_id)
                    # 选择下一个智能体
                    next_index = (last_index + 1) % len(agent_ids)
                    next_agent_id = agent_ids[next_index]
                    next_agent = ConversationAgent.query.filter_by(
                        conversation_id=self.conversation_id,
                        agent_id=next_agent_id
                    ).first()
                except ValueError:
                    # 如果最后发言的智能体不在当前会话中，选择第一个
                    next_agent = conversation_agents[0]
            else:
                # 如果没有最后发言的智能体，选择第一个
                next_agent = conversation_agents[0]
                
            if not next_agent:
                logger.warning(f"无法确定下一个发言的智能体，会话ID: {self.conversation_id}")
                return False
                
            # 添加消息到队列
            self.speaking_queue.put({
                'agent_id': next_agent.agent_id,
                'content': content,
                'callback': callback
            })
                
            logger.info(f"已将消息添加到轮询智能体的队列中，agent_id={next_agent.agent_id}, conversation_id={self.conversation_id}")
            return True
            
        except Exception as e:
            logger.error(f"以轮询方式向智能体发送消息时出错: {str(e)}")
            return False


# 调度器实例字典，用于在不同会话之间共享
_scheduler_instances = {}

def get_scheduler(conversation_id: int) -> ConversationScheduler:
    """
    获取或创建指定会话的调度器实例
    
    Args:
        conversation_id: 会话ID
        
    Returns:
        ConversationScheduler: 调度器实例
    """
    global _scheduler_instances
    
    if conversation_id not in _scheduler_instances:
        _scheduler_instances[conversation_id] = ConversationScheduler(conversation_id)
        
    return _scheduler_instances[conversation_id]
