"""
消息同步到图谱记忆服务

负责在智能体回复完成后，将完整的对话轮次同步到图谱记忆系统
支持不同图谱框架的消息同步机制
"""

import json
import uuid
import asyncio
import threading
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import requests

from app.models import GraphEnhancement, Message, Conversation, ActionTask, Agent, Role, db
from app.services.memory_partition_service import memory_partition_service
import logging

logger = logging.getLogger(__name__)

class MemorySyncService:
    """消息同步到图谱记忆服务类"""
    
    def __init__(self):
        self.sync_enabled = True
    
    def is_graph_enhancement_enabled(self) -> bool:
        """检查图谱增强是否启用"""
        try:
            config = GraphEnhancement.query.filter_by(framework='graphiti').first()
            return config and config.enabled
        except Exception as e:
            logger.error(f"检查图谱增强状态失败: {e}")
            return False
    
    def get_graph_enhancement_config(self) -> Optional[GraphEnhancement]:
        """获取图谱增强配置"""
        try:
            return GraphEnhancement.query.filter_by(framework='graphiti').first()
        except Exception as e:
            logger.error(f"获取图谱增强配置失败: {e}")
            return None
    
    def sync_conversation_round_async(self, conversation_id: int, agent_message_id: int,
                                    human_message_id: Optional[int] = None) -> None:
        """异步同步对话轮次到图谱记忆"""
        logger.info(f"[消息同步至图谱] 开始异步同步: 会话={conversation_id}, 智能体消息={agent_message_id}, 用户消息={human_message_id}")

        # 检查同步功能是否启用
        if not self.sync_enabled:
            logger.debug(f"[消息同步至图谱] 同步功能已禁用，跳过同步")
            return

        # 检查消息同步策略
        sync_strategy = self._get_message_sync_strategy()
        if sync_strategy == 'disabled':
            logger.debug(f"[消息同步至图谱] 消息同步策略为关闭，跳过同步")
            return

        # 在后台线程中执行同步
        def sync_worker():
            try:
                self.sync_conversation_round(conversation_id, agent_message_id, human_message_id)
            except Exception as e:
                logger.error(f"异步同步消息到图谱记忆失败: {e}")
                import traceback
                logger.debug(f"异步同步异常详情: {traceback.format_exc()}")

        thread = threading.Thread(target=sync_worker, daemon=True)
        thread.start()
    
    def sync_conversation_round(self, conversation_id: int, agent_message_id: int, 
                              human_message_id: Optional[int] = None) -> Tuple[bool, str]:
        """同步完整对话轮次到图谱记忆"""
        try:
            # 检查图谱增强是否启用
            if not self.is_graph_enhancement_enabled():
                logger.debug("图谱增强未启用，跳过消息同步")
                return True, "图谱增强未启用"
            
            # 获取配置
            config = self.get_graph_enhancement_config()
            if not config:
                return False, "未找到图谱增强配置"

            logger.debug(f"[消息同步至图谱] 图谱增强配置: enabled={config.enabled}, framework={config.framework}")
            logger.debug(f"[消息同步至图谱] framework_config类型: {type(config.framework_config)}")
            logger.debug(f"[消息同步至图谱] framework_config内容: {config.framework_config}")

            # 获取service_url (在数据库中存储为service_url而不是server_url)
            framework_config = config.framework_config or {}
            server_url = framework_config.get('service_url', '') or framework_config.get('server_url', '')

            logger.debug(f"[消息同步至图谱] 解析的service_url: '{server_url}'")

            if not server_url:
                logger.debug("未配置service_url，跳过消息同步")
                return True, "未配置service_url"
            
            # 获取会话信息
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                return False, f"会话 {conversation_id} 不存在"
            
            # 获取行动任务信息
            action_task = ActionTask.query.get(conversation.action_task_id)
            if not action_task:
                return False, f"行动任务不存在"
            
            # 构建上下文信息用于生成分区标识符
            context = {
                'action_space_id': action_task.action_space_id,
                'action_task_id': action_task.id,
                'role_id': 'default',  # 可以根据需要从智能体获取
                'agent_id': 'default'  # 可以根据需要从智能体获取
            }
            
            logger.info(f"[消息同步至图谱] 上下文信息: action_space_id={action_task.action_space_id}, action_task_id={action_task.id}")
            
            # 获取分区配置并生成分区标识符
            partition_config = memory_partition_service.get_partition_config()
            strategy = partition_config.get('partition_strategy', 'by_space')
            logger.info(f"[消息同步至图谱] 分区策略: {strategy}")
            
            group_id = memory_partition_service.generate_partition_identifier(strategy, context)
            logger.info(f"[消息同步至图谱] 生成的group_id: {group_id}")
            
            # 收集对话轮次中的消息
            messages = []
            
            # 生成实体UUID，用于关联消息和实体
            entity_uuid = str(uuid.uuid4())

            # 添加用户消息（如果存在）
            if human_message_id:
                human_message = Message.query.get(human_message_id)
                if human_message:
                    messages.append(self._format_message_for_sync(human_message, 'user', entity_uuid))

            # 添加智能体回复
            agent_message = Message.query.get(agent_message_id)
            if agent_message:
                messages.append(self._format_message_for_sync(agent_message, 'assistant', entity_uuid))
            
            if not messages:
                return False, "没有找到要同步的消息"
            
            # 生成对话总结和实体名称
            entity_name, summary = self._generate_conversation_summary(messages, config)

            # 先创建实体节点（使用已生成的entity_uuid）
            entity_success, entity_message = self._create_entity_node(
                server_url, entity_uuid, group_id, entity_name, summary
            )

            if not entity_success:
                logger.error(f"创建实体节点失败: {entity_message}")
                return False, f"创建实体节点失败: {entity_message}"

            # 构建同步数据
            sync_data = {
                'group_id': group_id,
                'messages': messages
            }

            # 发送消息到图谱记忆服务
            success, message = self._send_messages_to_graph_memory(server_url, sync_data)
            
            if success:
                logger.info(f"[消息同步至图谱] 成功同步对话轮次: 会话={conversation_id}, group_id={group_id}, 实体={entity_name}")
                return True, f"成功同步 {len(messages)} 条消息到实体 {entity_name}"
            else:
                logger.error(f"[消息同步至图谱] 同步对话轮次失败: {message}")
                return False, message

        except Exception as e:
            logger.error(f"同步对话轮次到图谱记忆时出错: {e}")
            import traceback
            logger.debug(f"同步异常详情: {traceback.format_exc()}")
            return False, f"同步失败: {str(e)}"
    
    def _format_message_for_sync(self, message: Message, role_type: str, entity_uuid: str) -> Dict[str, Any]:
        """格式化消息为同步格式"""
        try:
            # 获取智能体信息
            agent_name = "用户"
            if message.agent_id:
                agent = Agent.query.get(message.agent_id)
                if agent:
                    agent_name = agent.name

            # 格式化时间戳
            timestamp = message.created_at.isoformat() if message.created_at else datetime.now().isoformat()

            formatted_message = {
                'content': message.content or '',
                'uuid': entity_uuid,  # 使用实体的UUID，确保消息与实体关联
                'name': agent_name,
                'role_type': role_type,
                'role': role_type,
                'timestamp': timestamp,
                'source_description': f"{agent_name}的{'回复' if role_type == 'assistant' else '输入'}"
            }

            return formatted_message

        except Exception as e:
            logger.error(f"格式化消息失败: {e}")
            return {
                'content': message.content or '',
                'uuid': entity_uuid,  # 即使出错也使用实体UUID
                'name': '未知',
                'role_type': role_type,
                'role': role_type,
                'timestamp': datetime.now().isoformat(),
                'source_description': '消息'
            }

    def _generate_conversation_summary(self, messages: List[Dict[str, Any]], config: GraphEnhancement) -> Tuple[str, str]:
        """生成对话总结和实体名称"""
        try:
            # 构建对话内容
            conversation_text = ""
            for msg in messages:
                role = "用户" if msg['role_type'] == 'user' else msg['name']
                conversation_text += f"{role}: {msg['content']}\n"

            # 生成实体名称（基于时间戳）
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            entity_name = f"对话_{timestamp}"

            # 使用配置的模型生成总结
            summary = self._generate_summary_with_model(conversation_text, config)

            logger.debug(f"[消息同步至图谱] 生成实体名称: {entity_name}")
            logger.debug(f"[消息同步至图谱] 生成总结: {summary[:100]}...")

            return entity_name, summary

        except Exception as e:
            logger.error(f"生成对话总结失败: {e}")
            # 返回默认值
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            return f"对话_{timestamp}", "对话总结生成失败"

    def _get_message_sync_strategy(self) -> str:
        """获取当前的消息同步策略"""
        try:
            config = self.get_graph_enhancement_config()
            if not config:
                return 'disabled'

            framework_config = config.framework_config or {}
            return framework_config.get('message_sync_strategy', 'disabled')

        except Exception as e:
            logger.error(f"获取消息同步策略失败: {e}")
            return 'disabled'

    def _generate_summary_with_model(self, conversation_text: str, config: GraphEnhancement) -> str:
        """使用配置的模型生成对话总结"""
        try:
            # 获取文本模型配置
            framework_config = config.framework_config or {}
            text_model_config = framework_config.get('text_model', {})

            if not text_model_config:
                logger.warning("未找到文本模型配置，使用默认总结")
                return "这是一段用户与智能体的对话记录。"

            # 构建总结提示词
            prompt = f"""请为以下对话生成一个简洁的总结（不超过100字）：

{conversation_text}

总结："""

            # 构建请求消息
            messages = [
                {"role": "user", "content": prompt}
            ]

            # 发送请求到模型
            summary = self._call_text_model(messages, text_model_config)

            return summary.strip() if summary else "对话总结生成失败"

        except Exception as e:
            logger.error(f"使用模型生成总结失败: {e}")
            return "对话总结生成失败"

    def _call_text_model(self, messages: List[Dict[str, str]], model_config: Dict[str, Any]) -> str:
        """调用文本模型生成内容"""
        try:
            # 获取模型配置信息
            base_url = model_config.get('base_url', '')
            api_key = model_config.get('api_key', '')
            model_id = model_config.get('model_id', '')

            if not all([base_url, model_id]):
                logger.warning("模型配置不完整")
                return "配置不完整，无法生成总结"

            # 构建请求
            request_data = {
                "model": model_id,
                "messages": messages,
                "max_tokens": 150,
                "temperature": 0.7
            }

            headers = {
                "Content-Type": "application/json"
            }

            # 添加API密钥（如果不是no-api-key）
            if api_key and api_key != "no-api-key":
                headers["Authorization"] = f"Bearer {api_key}"

            # 发送请求
            response = requests.post(
                f"{base_url}/chat/completions",
                json=request_data,
                headers=headers,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                if 'choices' in result and len(result['choices']) > 0:
                    return result['choices'][0]['message']['content']
                else:
                    logger.warning("模型响应格式异常")
                    return "模型响应格式异常"
            else:
                logger.error(f"模型请求失败: {response.status_code} - {response.text}")
                return "模型请求失败"

        except Exception as e:
            logger.error(f"调用文本模型失败: {e}")
            return "模型调用失败"

    def _create_entity_node(self, server_url: str, entity_uuid: str, group_id: str,
                           entity_name: str, summary: str) -> Tuple[bool, str]:
        """创建实体节点"""
        try:
            # 构建完整的API端点
            if not server_url.endswith('/'):
                server_url += '/'
            api_url = f"{server_url}entity-node"

            # 构建请求数据
            entity_data = {
                "uuid": entity_uuid,
                "group_id": group_id,
                "name": entity_name,
                "summary": summary
            }

            logger.info(f"[消息同步至图谱] 创建实体节点: {api_url}")
            logger.debug(f"[消息同步至图谱] 实体数据: {json.dumps(entity_data, ensure_ascii=False, indent=2)}")

            # 发送POST请求
            response = requests.post(
                api_url,
                json=entity_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )

            if response.status_code in [200, 201]:
                logger.info(f"[消息同步至图谱] 实体节点创建成功: {entity_uuid}")
                return True, "实体节点创建成功"
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"[消息同步至图谱] 实体节点创建失败: {error_msg}")
                return False, error_msg

        except requests.exceptions.Timeout:
            return False, "创建实体节点请求超时"
        except requests.exceptions.ConnectionError:
            return False, "连接失败，请检查图谱服务是否运行"
        except Exception as e:
            return False, f"创建实体节点失败: {str(e)}"

    def _send_messages_to_graph_memory(self, server_url: str, sync_data: Dict[str, Any]) -> Tuple[bool, str]:
        """发送消息数据到图谱记忆服务"""
        try:
            # 构建完整的API端点
            if not server_url.endswith('/'):
                server_url += '/'
            api_url = f"{server_url}messages"
            
            logger.info(f"[消息同步至图谱] 发送消息到图谱记忆: {api_url}")
            logger.debug(f"[消息同步至图谱] 消息数据: {json.dumps(sync_data, ensure_ascii=False, indent=2)}")
            
            # 发送POST请求
            response = requests.post(
                api_url,
                json=sync_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                return True, "同步成功"
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                return False, error_msg
                
        except requests.exceptions.Timeout:
            return False, "请求超时"
        except requests.exceptions.ConnectionError:
            return False, "连接失败，请检查图谱服务是否运行"
        except Exception as e:
            return False, f"发送请求失败: {str(e)}"
    
    def enable_sync(self) -> None:
        """启用消息同步"""
        self.sync_enabled = True
        logger.info("消息同步已启用")
    
    def disable_sync(self) -> None:
        """禁用消息同步"""
        self.sync_enabled = False
        logger.info("消息同步已禁用")
    
    def get_sync_status(self) -> Dict[str, Any]:
        """获取同步状态"""
        config = self.get_graph_enhancement_config()
        service_url_configured = False
        if config and config.framework_config:
            service_url_configured = bool(config.framework_config.get('service_url') or config.framework_config.get('server_url'))

        return {
            'sync_enabled': self.sync_enabled,
            'graph_enhancement_enabled': self.is_graph_enhancement_enabled(),
            'framework': config.framework if config else None,
            'service_url_configured': service_url_configured
        }

# 创建全局服务实例
memory_sync_service = MemorySyncService()
