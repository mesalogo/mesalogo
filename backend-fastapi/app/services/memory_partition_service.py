"""
记忆分区管理服务

负责管理记忆分区的配置、数据查询和可视化
支持不同图谱框架的分区机制：
- Graphiti: 使用group_id进行分区
- LightRAG: 使用workspace进行分区 (TBD)
"""

from typing import Dict, List, Tuple, Any, Optional
from app.models import GraphEnhancement, ActionSpace, ActionTask, Role, Agent, db
from app.services.graph_enhancement import GraphEnhancementService
import logging

logger = logging.getLogger(__name__)

class MemoryPartitionService:
    """记忆分区管理服务类"""
    
    def __init__(self):
        self.graph_service = GraphEnhancementService()
        
        # 分区策略定义
        self.PARTITION_STRATEGIES = {
            "by_space": {
                "name": "按行动空间分区",
                "description": "同一行动空间内的所有任务和智能体共享记忆",
                "graphiti_template": "actionspace-{action_space_id}",
                "lightrag_template": "actionspace-{action_space_id}",  # TBD
                "default": True
            },
            "global": {
                "name": "全局分区",
                "description": "所有智能体和任务共享同一个全局记忆空间",
                "graphiti_template": "default",
                "lightrag_template": "default",  # TBD
                "default": False
            },
            "by_task": {
                "name": "按行动任务分区",
                "description": "每个任务独立的记忆空间",
                "graphiti_template": "actiontask-{action_task_id}",
                "lightrag_template": "actiontask-{action_task_id}",  # TBD
                "default": False
            },
            "by_role": {
                "name": "按角色分区",
                "description": "同一角色的所有智能体共享记忆",
                "graphiti_template": "role-{role_id}",
                "lightrag_template": "role-{role_id}",  # TBD
                "default": False
            },
            "by_agent": {
                "name": "按智能体分区",
                "description": "每个智能体独立的记忆空间",
                "graphiti_template": "agent-{agent_id}",
                "lightrag_template": "agent-{agent_id}",  # TBD
                "default": False
            }
        }
    
    def get_graph_enhancement_config(self) -> Optional[GraphEnhancement]:
        """获取图谱增强配置"""
        return GraphEnhancement.query.filter_by(framework='graphiti').first()
    
    def get_partition_config(self) -> Dict[str, Any]:
        """获取当前分区配置"""
        try:
            config = self.get_graph_enhancement_config()
            
            if not config:
                # 返回默认配置
                return {
                    'enabled': False,
                    'framework': 'graphiti',
                    'partition_strategy': 'by_space',
                    'server_url': '',
                    'message_sync_strategy': 'disabled',
                    'message': '图谱增强未配置，使用默认设置'
                }
            
            # 从framework_config中获取分区策略和消息同步策略
            framework_config = config.framework_config or {}
            partition_strategy = framework_config.get('memory_partition_strategy', 'by_space')
            server_url = framework_config.get('service_url', '') or framework_config.get('server_url', '')
            message_sync_strategy = framework_config.get('message_sync_strategy', 'disabled')

            return {
                'enabled': config.enabled,
                'framework': config.framework,
                'partition_strategy': partition_strategy,
                'server_url': server_url,
                'message_sync_strategy': message_sync_strategy,
                'updated_at': config.updated_at.isoformat() if config.updated_at else None
            }
            
        except Exception as e:
            logger.error(f"获取分区配置失败: {e}")
            raise
    
    def update_partition_config(self, data: Dict[str, Any]) -> Tuple[bool, str]:
        """更新分区配置"""
        try:
            partition_strategy = data.get('partition_strategy')
            message_sync_strategy = data.get('message_sync_strategy', 'disabled')

            # 验证分区策略
            if partition_strategy not in self.PARTITION_STRATEGIES:
                return False, f"无效的分区策略: {partition_strategy}"

            # 验证消息同步策略
            valid_sync_strategies = ['disabled', 'message_complete', 'round_complete']
            if message_sync_strategy not in valid_sync_strategies:
                return False, f"无效的消息同步策略: {message_sync_strategy}"

            # 获取或创建图谱增强配置
            config = self.get_graph_enhancement_config()
            if not config:
                config = GraphEnhancement(
                    name='默认图谱增强配置',
                    description='系统默认的图谱增强配置',
                    enabled=False,
                    framework='graphiti'
                )
                db.session.add(config)

            # 更新framework_config中的配置
            framework_config = config.framework_config or {}
            framework_config['memory_partition_strategy'] = partition_strategy
            framework_config['message_sync_strategy'] = message_sync_strategy

            # 如果提供了其他配置，也一并更新
            if 'server_url' in data:
                framework_config['server_url'] = data['server_url']

            # 强制SQLAlchemy检测到JSON字段的变化
            config.framework_config = framework_config
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(config, 'framework_config')
            db.session.commit()

            # 根据消息同步策略更新memory_sync_service的状态
            self._update_memory_sync_service_status(message_sync_strategy)

            logger.info(f"记忆配置已更新: 分区策略={partition_strategy}, 消息同步={message_sync_strategy}")
            return True, f"记忆配置已更新: 分区策略={self.PARTITION_STRATEGIES[partition_strategy]['name']}, 消息同步={self._get_sync_strategy_name(message_sync_strategy)}"

        except Exception as e:
            db.session.rollback()
            logger.error(f"更新分区配置失败: {e}")
            return False, f"更新分区配置失败: {str(e)}"

    def _update_memory_sync_service_status(self, message_sync_strategy: str) -> None:
        """根据消息同步策略更新memory_sync_service的状态"""
        try:
            from app.services.memory_sync_service import memory_sync_service

            if message_sync_strategy == 'disabled':
                memory_sync_service.disable_sync()
                logger.info("消息同步已禁用")
            else:
                memory_sync_service.enable_sync()
                logger.info(f"消息同步已启用: {message_sync_strategy}")

        except Exception as e:
            logger.error(f"更新消息同步服务状态失败: {e}")

    def _get_sync_strategy_name(self, strategy: str) -> str:
        """获取消息同步策略的显示名称"""
        strategy_names = {
            'disabled': '关闭',
            'message_complete': '消息完成',
            'round_complete': '轮次完成'
        }
        return strategy_names.get(strategy, strategy)
    
    def get_available_strategies(self) -> List[Dict[str, Any]]:
        """获取可用的分区策略列表"""
        strategies = []
        for key, strategy in self.PARTITION_STRATEGIES.items():
            strategies.append({
                'key': key,
                'name': strategy['name'],
                'description': strategy['description'],
                'default': strategy['default']
            })
        return strategies
    
    def generate_partition_identifier(self, strategy: str, context: Dict[str, Any]) -> str:
        """根据分区策略和上下文生成分区标识符"""
        try:
            if strategy not in self.PARTITION_STRATEGIES:
                strategy = 'by_space'  # 默认策略
            
            config = self.get_graph_enhancement_config()
            framework = config.framework if config else 'graphiti'
            
            strategy_config = self.PARTITION_STRATEGIES[strategy]
            
            if framework == 'graphiti':
                template = strategy_config['graphiti_template']
            elif framework == 'lightrag':
                template = strategy_config['lightrag_template']  # TBD
            else:
                template = strategy_config['graphiti_template']  # 默认使用graphiti格式
            
            # 使用context中的值替换模板变量
            return template.format(**context)
            
        except KeyError as e:
            logger.error(f"生成分区标识符时缺少必要参数: {e}")
            # 返回默认分区标识符
            return f"default-{context.get('action_space_id', 'unknown')}"
        except Exception as e:
            logger.error(f"生成分区标识符失败: {e}")
            return "default-error"
    
    def list_partitions(self) -> List[Dict[str, Any]]:
        """获取所有可用的记忆分区列表"""
        try:
            config = self.get_graph_enhancement_config()
            if not config or not config.enabled:
                return []
            
            partitions = []
            
            if config.framework == 'graphiti':
                # 从Graphiti获取分区列表
                partitions = self._list_graphiti_partitions()
            elif config.framework == 'lightrag':
                # TBD: 从LightRAG获取分区列表
                partitions = self._list_lightrag_partitions()
            
            return partitions
            
        except Exception as e:
            logger.error(f"获取分区列表失败: {e}")
            return []
    
    def _list_graphiti_partitions(self) -> List[Dict[str, Any]]:
        """从Graphiti获取分区列表"""
        try:
            # 导入图谱增强服务来获取真实的统计数据
            from app.services.graph_enhancement import GraphEnhancementService

            partitions = []
            graph_service = GraphEnhancementService()
            
            # 基于行动空间生成分区
            action_spaces = ActionSpace.query.all()
            for space in action_spaces:
                partition_id = f"actionspace-{space.id}"
                stats = self._get_partition_stats(partition_id)

                partitions.append({
                    'id': partition_id,
                    'name': f"行动空间: {space.name}",
                    'type': 'action_space',
                    'entity_id': space.id,
                    'entity_name': space.name,
                    'description': space.description or '',
                    'node_count': stats['node_count'],
                    'edge_count': stats['edge_count']
                })
            
            # 基于任务生成分区（如果使用任务分区策略）
            current_strategy = self.get_partition_config().get('partition_strategy', 'by_space')
            if current_strategy == 'by_task':
                action_tasks = ActionTask.query.all()
                for task in action_tasks:
                    partition_id = f"actiontask-{task.id}"
                    stats = self._get_partition_stats(partition_id)

                    partitions.append({
                        'id': partition_id,
                        'name': f"任务: {task.name}",
                        'type': 'action_task',
                        'entity_id': task.id,
                        'entity_name': task.name,
                        'description': task.description or '',
                        'node_count': stats['node_count'],
                        'edge_count': stats['edge_count']
                    })

            # 全局分区（如果使用全局分区策略）
            if current_strategy == 'global':
                partition_id = 'default'
                stats = self._get_partition_stats(partition_id)

                partitions.append({
                    'id': partition_id,
                    'name': '全局记忆空间',
                    'type': 'global',
                    'entity_id': None,
                    'entity_name': '全局',
                    'description': '所有智能体和任务共享的全局记忆空间',
                    'node_count': stats['node_count'],
                    'edge_count': stats['edge_count']
                })
            
            return partitions

        except Exception as e:
            logger.error(f"获取Graphiti分区列表失败: {e}")
            return []

    def _get_partition_stats(self, partition_id: str) -> Dict[str, int]:
        """获取分区的统计数据"""
        try:
            from app.services.graph_enhancement import GraphEnhancementService

            config = self.get_graph_enhancement_config()
            if not config:
                return {'node_count': 0, 'edge_count': 0}

            graph_service = GraphEnhancementService()

            # 获取可视化数据来计算统计信息
            success, data = graph_service.get_visualization_data(config, partition_id)

            if success and data:
                node_count = len(data.get('nodes', []))
                edge_count = len(data.get('edges', []))

                # 如果有stats字段，优先使用
                if 'stats' in data:
                    stats = data['stats']
                    node_count = stats.get('entity_count', node_count)
                    edge_count = stats.get('relationship_count', edge_count)

                return {'node_count': node_count, 'edge_count': edge_count}
            else:
                return {'node_count': 0, 'edge_count': 0}

        except Exception as e:
            logger.error(f"获取分区统计数据失败: {e}")
            return {'node_count': 0, 'edge_count': 0}
    
    def _list_lightrag_partitions(self) -> List[Dict[str, Any]]:
        """从LightRAG获取分区列表"""
        # TBD: 实现LightRAG分区列表查询
        logger.info("LightRAG分区列表查询功能待实现")
        return []
    
    def get_partition_graph(self, partition_id: str, limit: int = 100, node_types: List[str] = None) -> Dict[str, Any]:
        """获取指定分区的记忆图谱数据"""
        try:
            config = self.get_graph_enhancement_config()
            if not config or not config.enabled:
                return {'nodes': [], 'edges': [], 'message': '图谱增强未启用'}
            
            if config.framework == 'graphiti':
                return self._get_graphiti_partition_graph(partition_id, limit, node_types)
            elif config.framework == 'lightrag':
                return self._get_lightrag_partition_graph(partition_id, limit, node_types)
            else:
                return {'nodes': [], 'edges': [], 'message': f'不支持的框架: {config.framework}'}
                
        except Exception as e:
            logger.error(f"获取分区图谱数据失败: {e}")
            return {'nodes': [], 'edges': [], 'error': str(e)}
    
    def _get_graphiti_partition_graph(self, partition_id: str, limit: int, node_types: List[str]) -> Dict[str, Any]:
        """从Graphiti获取分区图谱数据"""
        try:
            # TBD: 实现Graphiti图谱数据查询
            # 这里需要调用Graphiti的API来获取指定group_id的节点和边
            
            # 暂时返回模拟数据
            return {
                'nodes': [
                    {
                        'id': f'node_{i}',
                        'label': f'节点 {i}',
                        'type': 'Entity',
                        'properties': {'partition_id': partition_id}
                    } for i in range(min(5, limit))
                ],
                'edges': [
                    {
                        'source': 'node_0',
                        'target': 'node_1',
                        'relationship': '关联',
                        'properties': {}
                    }
                ],
                'partition_id': partition_id,
                'total_nodes': 5,
                'total_edges': 1,
                'message': 'Graphiti图谱数据查询功能待完善'
            }
            
        except Exception as e:
            logger.error(f"获取Graphiti分区图谱失败: {e}")
            return {'nodes': [], 'edges': [], 'error': str(e)}
    
    def _get_lightrag_partition_graph(self, partition_id: str, limit: int, node_types: List[str]) -> Dict[str, Any]:
        """从LightRAG获取分区图谱数据"""
        # TBD: 实现LightRAG图谱数据查询
        return {
            'nodes': [],
            'edges': [],
            'message': 'LightRAG图谱数据查询功能待实现'
        }
    
    def search_partition(self, partition_id: str, query: str, **kwargs) -> Dict[str, Any]:
        """在指定分区中搜索记忆内容"""
        try:
            config = self.get_graph_enhancement_config()
            if not config or not config.enabled:
                return {'results': [], 'message': '图谱增强未启用'}
            
            if config.framework == 'graphiti':
                return self._search_graphiti_partition(partition_id, query, **kwargs)
            elif config.framework == 'lightrag':
                return self._search_lightrag_partition(partition_id, query, **kwargs)
            else:
                return {'results': [], 'message': f'不支持的框架: {config.framework}'}
                
        except Exception as e:
            logger.error(f"搜索分区记忆失败: {e}")
            return {'results': [], 'error': str(e)}
    
    def _search_graphiti_partition(self, partition_id: str, query: str, **kwargs) -> Dict[str, Any]:
        """在Graphiti分区中搜索"""
        # TBD: 实现Graphiti分区搜索
        return {
            'results': [],
            'query': query,
            'partition_id': partition_id,
            'message': 'Graphiti分区搜索功能待实现'
        }
    
    def _search_lightrag_partition(self, partition_id: str, query: str, **kwargs) -> Dict[str, Any]:
        """在LightRAG分区中搜索"""
        # TBD: 实现LightRAG分区搜索
        return {
            'results': [],
            'query': query,
            'partition_id': partition_id,
            'message': 'LightRAG分区搜索功能待实现'
        }
    
    def get_partition_stats(self, partition_id: str) -> Dict[str, Any]:
        """获取分区统计信息"""
        try:
            # TBD: 实现分区统计查询
            return {
                'partition_id': partition_id,
                'node_count': 0,
                'edge_count': 0,
                'last_updated': None,
                'message': '分区统计功能待实现'
            }
        except Exception as e:
            logger.error(f"获取分区统计失败: {e}")
            return {'error': str(e)}
    
    def get_memory_overview(self) -> Dict[str, Any]:
        """获取记忆系统总览"""
        try:
            config = self.get_partition_config()
            partitions = self.list_partitions()
            
            return {
                'enabled': config['enabled'],
                'framework': config['framework'],
                'partition_strategy': config['partition_strategy'],
                'total_partitions': len(partitions),
                'partitions': partitions[:10],  # 只返回前10个分区
                'strategy_info': self.PARTITION_STRATEGIES.get(config['partition_strategy'], {})
            }
        except Exception as e:
            logger.error(f"获取记忆系统总览失败: {e}")
            return {'error': str(e)}
    
    def clear_partition(self, partition_id: str) -> Tuple[bool, str]:
        """清空指定分区的记忆数据"""
        try:
            config = self.get_graph_enhancement_config()
            if not config or not config.enabled:
                return False, "图谱增强未启用"
            
            # TBD: 实现分区数据清空
            logger.info(f"清空分区 {partition_id} 的数据（功能待实现）")
            return True, f"分区 {partition_id} 数据清空功能待实现"
            
        except Exception as e:
            logger.error(f"清空分区数据失败: {e}")
            return False, f"清空分区数据失败: {str(e)}"

# 创建全局服务实例
memory_partition_service = MemoryPartitionService()
