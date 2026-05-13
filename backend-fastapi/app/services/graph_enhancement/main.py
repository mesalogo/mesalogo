"""
图谱增强服务主入口

整合 Graphiti 记忆系统的主服务类

注意：LightRAG 知识库系统已独立到 app/services/lightrag/ 模块
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List
from .base import BaseGraphEnhancementFramework
from .graphiti_service import GraphitiService
from .graphrag_service import GraphRAGService
import logging

logger = logging.getLogger(__name__)

class GraphEnhancementService:
    """图谱增强服务主类（主要用于 Graphiti 记忆系统）"""

    def __init__(self):
        self.frameworks = {}  # 存储已初始化的框架实例
        # 注意：LightRAG 已独立，不再通过此服务管理
        self.supported_frameworks = ['graphiti', 'graphrag']

        # 分区策略配置（用于 Graphiti）
        self.PARTITION_STRATEGIES = {
            "by_space": {
                "graphiti_template": "actionspace-{action_space_id}",
                "graphrag_template": "actionspace-{action_space_id}"
            },
            "global": {
                "graphiti_template": "default",
                "graphrag_template": "default"
            },
            "by_task": {
                "graphiti_template": "actiontask-{action_task_id}",
                "graphrag_template": "actiontask-{action_task_id}"
            },
            "by_role": {
                "graphiti_template": "role-{role_id}",
                "graphrag_template": "role-{role_id}"
            },
            "by_agent": {
                "graphiti_template": "agent-{agent_id}",
                "graphrag_template": "agent-{agent_id}"
            }
        }

        # MCP服务器映射
        self.GRAPH_MCP_MAPPING = {
            'graphiti': 'graphiti-server',  # 已实现
            'graphrag': None,  # 待实现
        }

    def get_partition_identifier(self, strategy: str, framework: str, context: dict) -> str:
        """根据分区策略和框架类型生成分区标识符"""
        try:
            if strategy not in self.PARTITION_STRATEGIES:
                strategy = 'by_space'  # 默认策略

            strategy_config = self.PARTITION_STRATEGIES[strategy]

            if framework in strategy_config:
                template = strategy_config[framework]
            else:
                template = strategy_config['graphiti_template']  # 默认使用graphiti格式

            # 使用上下文信息格式化模板
            try:
                partition_id = template.format(**context)
                logger.debug(f"生成分区标识符: {partition_id} (策略: {strategy}, 框架: {framework})")
                return partition_id
            except KeyError as e:
                logger.warning(f"分区模板格式化失败，缺少参数: {e}，使用默认值")
                return "default"

        except Exception as e:
            logger.error(f"生成分区标识符失败: {e}")
            return "default"

    def _create_framework_instance(self, config) -> BaseGraphEnhancementFramework:
        """创建框架实例"""
        framework = config.framework.lower()
        
        if framework == 'graphiti':
            return GraphitiService(config)
        elif framework == 'graphrag':
            return GraphRAGService(config)
        else:
            raise ValueError(f"不支持的框架: {framework}")

    def initialize(self, config) -> Tuple[bool, str]:
        """初始化图谱增强框架"""
        try:
            framework_instance = self._create_framework_instance(config)
            success, message = framework_instance.initialize()
            
            if success:
                self.frameworks[config.id] = {
                    'instance': framework_instance,
                    'type': config.framework,
                    'config': config,
                    'initialized_at': datetime.now()
                }
                logger.info(f"图谱增强框架初始化成功: {config.framework}")
            
            return success, message

        except Exception as e:
            logger.error(f"初始化图谱增强框架失败: {e}")
            return False, f"初始化失败: {str(e)}"

    def get_status(self, config) -> Dict[str, Any]:
        """获取图谱增强状态"""
        try:
            # 如果框架未初始化，先创建实例获取状态
            if config.id not in self.frameworks:
                framework_instance = self._create_framework_instance(config)
                return framework_instance.get_status()
            
            framework_info = self.frameworks[config.id]
            return framework_info['instance'].get_status()

        except Exception as e:
            logger.error(f"获取图谱增强状态失败: {e}")
            return {
                'framework': config.framework,
                'status': 'error',
                'message': f'获取状态失败: {str(e)}'
            }

    def query(self, config, query: str, params: Dict[str, Any]) -> Tuple[bool, Any]:
        """执行图谱增强查询"""
        try:
            # 如果框架未初始化，先创建实例
            if config.id not in self.frameworks:
                framework_instance = self._create_framework_instance(config)
                return framework_instance.query(query, params)
            
            framework_info = self.frameworks[config.id]
            return framework_info['instance'].query(query, params)

        except Exception as e:
            logger.error(f"执行图谱增强查询失败: {e}")
            return False, f"查询失败: {str(e)}"

    def query_advanced(self, config, query: str, params: Dict[str, Any]) -> Tuple[bool, Any]:
        """执行高级图谱增强查询"""
        try:
            # 如果框架未初始化，先创建实例
            if config.id not in self.frameworks:
                framework_instance = self._create_framework_instance(config)
                return framework_instance.query_advanced(query, params)
            
            framework_info = self.frameworks[config.id]
            return framework_info['instance'].query_advanced(query, params)

        except Exception as e:
            logger.error(f"执行高级图谱增强查询失败: {e}")
            return False, f"高级查询失败: {str(e)}"

    def insert_documents(self, config, documents: List[str], partition_id: str) -> Tuple[bool, str]:
        """插入文档到图谱增强系统"""
        try:
            # 如果框架未初始化，先初始化
            if config.id not in self.frameworks:
                success, message = self.initialize(config)
                if not success:
                    return False, f"初始化失败: {message}"
            
            framework_info = self.frameworks[config.id]
            return framework_info['instance'].insert_documents(documents, partition_id)

        except Exception as e:
            logger.error(f"插入文档到图谱增强系统失败: {e}")
            return False, f"插入文档失败: {str(e)}"

    def rebuild_index(self, config) -> Tuple[bool, str]:
        """重建图谱增强索引"""
        try:
            # 如果框架未初始化，先创建实例
            if config.id not in self.frameworks:
                framework_instance = self._create_framework_instance(config)
                return framework_instance.rebuild_index()
            
            framework_info = self.frameworks[config.id]
            return framework_info['instance'].rebuild_index()

        except Exception as e:
            logger.error(f"重建图谱增强索引失败: {e}")
            return False, f"重建索引失败: {str(e)}"

    def clear_data(self, config) -> Tuple[bool, str]:
        """清空图谱增强数据"""
        try:
            # 如果框架未初始化，先创建实例
            if config.id not in self.frameworks:
                framework_instance = self._create_framework_instance(config)
                return framework_instance.clear_data()
            
            framework_info = self.frameworks[config.id]
            return framework_info['instance'].clear_data()

        except Exception as e:
            logger.error(f"清空图谱增强数据失败: {e}")
            return False, f"清空数据失败: {str(e)}"

    def get_visualization_data(self, config, group_id: Optional[str] = None) -> Tuple[bool, Any]:
        """获取图谱可视化数据"""
        try:
            # 如果框架未初始化，先创建实例
            if config.id not in self.frameworks:
                framework_instance = self._create_framework_instance(config)
                return framework_instance.get_visualization_data(group_id)
            
            framework_info = self.frameworks[config.id]
            return framework_info['instance'].get_visualization_data(group_id)

        except Exception as e:
            logger.error(f"获取可视化数据失败: {e}")
            return False, f"获取可视化数据失败: {str(e)}"

    def get_visualization_info(self, config) -> Tuple[bool, Any]:
        """获取图谱数据库信息"""
        try:
            # 如果框架未初始化，先创建实例
            if config.id not in self.frameworks:
                framework_instance = self._create_framework_instance(config)
                return framework_instance.get_database_info()
            
            framework_info = self.frameworks[config.id]
            return framework_info['instance'].get_database_info()

        except Exception as e:
            logger.error(f"获取数据库信息失败: {e}")
            return False, f"获取数据库信息失败: {str(e)}"

    # ==================== 环境变量生成 ====================
    
    def generate_env_vars_for_graphiti(self) -> Dict[str, str]:
        """为Graphiti容器化服务生成环境变量"""
        try:
            from app.models import GraphEnhancement, ModelConfig

            # 获取图谱增强配置（通常只有一个配置）
            config = GraphEnhancement.query.filter_by(framework='graphiti').first()
            if not config:
                raise Exception("未找到图谱增强配置")

            logger.info(f"使用配置: ID={config.id}, Framework={config.framework}, Name={config.name}")

            framework_config = config.framework_config or {}
            logger.info(f"读取到的Framework配置: {framework_config}")
            env_vars = {}

            # 检查配置是否为空
            if not framework_config:
                logger.warning("Framework配置为空，可能配置没有正确保存")
                raise Exception("图谱增强配置为空，请先在界面中配置并保存")

            # Neo4j数据库配置 - 直接从数据库配置中读取
            env_vars.update({
                "NEO4J_URI": framework_config.get('neo4j_uri', "bolt://neo4j:7687"),
                "NEO4J_USER": framework_config.get('neo4j_user', "neo4j"),
                "NEO4J_PASSWORD": framework_config.get('neo4j_password', "password")
            })

            # 动态获取文本生成模型配置
            text_model_id = framework_config.get('text_model_id', 'default')
            text_model = None

            if text_model_id == 'default':
                # 使用默认文本生成模型
                text_model = ModelConfig.query.filter_by(is_default_text=True).first()
                if not text_model:
                    logger.warning("未找到默认文本生成模型")
            else:
                # 使用指定的文本生成模型
                text_model = ModelConfig.query.get(text_model_id)
                if not text_model:
                    logger.warning(f"文本生成模型ID {text_model_id} 不存在，尝试使用默认模型")
                    text_model = ModelConfig.query.filter_by(is_default_text=True).first()

            if text_model:
                env_vars.update({
                    "OPENAI_API_KEY": text_model.api_key or '',
                    "OPENAI_BASE_URL": text_model.base_url or '',
                    "MODEL_NAME": text_model.model_id or '',
                    "SMALL_MODEL_NAME": text_model.model_id or ''
                })
                logger.info(f"使用文本生成模型: {text_model.name} ({text_model.provider})")
            else:
                logger.error("无法找到可用的文本生成模型")
                raise Exception("无法找到可用的文本生成模型，请先配置默认文本生成模型")

            # 动态获取嵌入模型配置
            embedding_model_id = framework_config.get('embedding_model_id', 'default')
            embedding_model = None

            if embedding_model_id == 'default':
                # 使用默认嵌入模型
                embedding_model = ModelConfig.query.filter_by(is_default_embedding=True).first()
                if not embedding_model:
                    logger.warning("未找到默认嵌入模型")
            else:
                # 使用指定的嵌入模型
                embedding_model = ModelConfig.query.get(embedding_model_id)
                if not embedding_model:
                    logger.warning(f"嵌入模型ID {embedding_model_id} 不存在，尝试使用默认模型")
                    embedding_model = ModelConfig.query.filter_by(is_default_embedding=True).first()

            if embedding_model:
                embedder_api_key = embedding_model.api_key or ''
                embedder_model_id = embedding_model.model_id or ''
                embedder_base_url = embedding_model.base_url or ''

                # 如果嵌入模型没有base_url，使用文本模型的base_url
                if not embedder_base_url:
                    embedder_base_url = env_vars.get("OPENAI_BASE_URL", "")

                env_vars.update({
                    "OPENAI_EMBEDDER_API_KEY": embedder_api_key,
                    "OPENAI_EMBEDDER_MODEL_ID": embedder_model_id,
                    "OPENAI_EMBEDDER_API_URL": embedder_base_url
                })
                logger.info(f"使用嵌入模型: {embedding_model.name} ({embedding_model.provider})")
            else:
                logger.error("无法找到可用的嵌入模型")
                raise Exception("无法找到可用的嵌入模型，请先配置默认嵌入模型")

            # 设置嵌入维度 - 优先使用配置中的值，否则根据模型ID智能判断
            dimension = framework_config.get('embedding_dimension')
            if dimension:
                env_vars["OPENAI_EMBEDDER_DIMENSION"] = str(dimension)
            else:
                # 根据模型ID智能判断维度
                embedder_model_id = env_vars.get("OPENAI_EMBEDDER_MODEL_ID", "")
                if 'nomic-embed' in embedder_model_id:
                    env_vars["OPENAI_EMBEDDER_DIMENSION"] = '768'
                elif 'bge-m3' in embedder_model_id:
                    env_vars["OPENAI_EMBEDDER_DIMENSION"] = '1024'
                elif 'text-embedding-3-large' in embedder_model_id:
                    env_vars["OPENAI_EMBEDDER_DIMENSION"] = '3072'
                elif 'text-embedding-3-small' in embedder_model_id:
                    env_vars["OPENAI_EMBEDDER_DIMENSION"] = '1536'
                else:
                    env_vars["OPENAI_EMBEDDER_DIMENSION"] = '1536'

            # 动态获取重排序模型配置
            rerank_type = framework_config.get('rerank_type', 'reranker')
            rerank_model_id = framework_config.get('rerank_model_id', 'default')
            rerank_model = None

            if rerank_model_id == 'default':
                # 根据重排序类型使用相应的默认模型
                if rerank_type == 'llm':
                    # 使用默认文本生成模型
                    rerank_model = ModelConfig.query.filter_by(is_default_text=True).first()
                else:
                    # 使用默认重排序模型
                    rerank_model = ModelConfig.query.filter_by(is_default_rerank=True).first()
            else:
                # 使用指定的重排序模型
                rerank_model = ModelConfig.query.get(rerank_model_id)
                if not rerank_model:
                    logger.warning(f"重排序模型ID {rerank_model_id} 不存在，尝试使用默认模型")
                    if rerank_type == 'llm':
                        rerank_model = ModelConfig.query.filter_by(is_default_text=True).first()
                    else:
                        rerank_model = ModelConfig.query.filter_by(is_default_rerank=True).first()

            env_vars.update({
                "RERANKER_TYPE": str(rerank_type or ''),
                "RERANK_MODEL_ID": str((rerank_model.model_id if rerank_model else '') or ''),
                "RERANK_MODEL_API_KEY": str((rerank_model.api_key if rerank_model else '') or ''),
                "RERANK_MODEL_API_URL": str((rerank_model.base_url if rerank_model else '') or '')
            })

            if rerank_model:
                logger.info(f"使用重排序模型: {rerank_model.name} ({rerank_model.provider})")
            else:
                logger.warning("未找到可用的重排序模型")

            # OpenAI兼容性配置 - 严格按照数据库保存的配置
            openai_compatible = framework_config.get('openai_compatible', False)
            env_vars["OPENAI_COMPATIBLE"] = "true" if openai_compatible else "false"

            # 并发限制配置
            semaphore_limit = framework_config.get('semaphore_limit', 10)
            env_vars["SEMAPHORE_LIMIT"] = str(semaphore_limit)

            # 社区配置 - 从framework_config.community_config中读取
            community_config = framework_config.get('community_config', {})
            auto_build_enabled = community_config.get('auto_build_enabled', False)
            env_vars["AUTO_BUILD_COMMUNITY"] = "true" if auto_build_enabled else "false"
            
            # 返回社区摘要配置
            return_community_summaries = community_config.get('return_community_summaries', False)
            env_vars["RETURN_COMMUNITY_SUMMARIES"] = "true" if return_community_summaries else "false"

            logger.info(f"生成的环境变量: {list(env_vars.keys())}")
            return env_vars

        except Exception as e:
            logger.error(f"生成Graphiti环境变量失败: {e}")
            raise
