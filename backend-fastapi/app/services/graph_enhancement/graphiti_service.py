"""
Graphiti 图谱增强服务实现

基于Neo4j的图谱增强框架服务
"""

import asyncio
import requests
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List
from .base import BaseGraphEnhancementFramework
import logging

logger = logging.getLogger(__name__)

class GraphitiService(BaseGraphEnhancementFramework):
    """Graphiti框架服务实现"""
    
    def __init__(self, config):
        super().__init__(config)
        self.service_url = self.framework_config.get('service_url', 'http://localhost:8000')
    
    def initialize(self) -> Tuple[bool, str]:
        """初始化Graphiti框架 - 容器化版本（无需实际初始化）"""
        try:
            # 直接存储框架信息，不进行连接测试（延迟到实际使用时）
            self.initialized_at = datetime.now()
            logger.info(f"Graphiti容器化服务配置完成，服务地址: {self.service_url}")
            return True, "Graphiti容器化服务配置成功"

        except Exception as e:
            logger.error(f"配置Graphiti容器化服务失败: {e}")
            return False, f"配置Graphiti容器化服务失败: {str(e)}"
    
    def get_status(self) -> Dict[str, Any]:
        """获取Graphiti状态（直接方式）"""
        try:
            # 尝试健康检查
            connected = False
            try:
                response = requests.get(f"{self.service_url}/healthcheck", timeout=5)
                if response.status_code == 200:
                    service_status = "running"
                    connected = True
                    message = "Graphiti服务运行正常"
                else:
                    service_status = "error"
                    connected = False
                    message = f"Graphiti服务响应异常: {response.status_code}"
            except requests.exceptions.RequestException as e:
                service_status = "unavailable"
                connected = False
                message = f"Graphiti服务不可用: {str(e)}"

            return {
                'framework': 'graphiti',
                'status': service_status,
                'connected': connected,
                'service_url': self.service_url,
                'initialized': self.initialized_at is not None,
                'initialized_at': self.initialized_at.isoformat() if self.initialized_at else None,
                'message': message
            }

        except Exception as e:
            logger.error(f"获取Graphiti状态失败: {e}")
            return {
                'framework': 'graphiti',
                'status': 'error',
                'message': f'获取状态失败: {str(e)}'
            }
    
    def query(self, query: str, params: Dict[str, Any]) -> Tuple[bool, Any]:
        """执行Graphiti查询（直接方式）"""
        try:
            # 构建查询请求
            search_payload = {
                "query": query,
                "max_facts": params.get('max_facts', 10),
                "group_ids": params.get('group_ids', [])
            }

            response = requests.post(
                f"{self.service_url}/search",
                json=search_payload,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                logger.info(f"Graphiti查询成功: {query}")
                return True, result
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"Graphiti查询失败: {error_msg}")
                return False, error_msg

        except requests.exceptions.RequestException as e:
            error_msg = f"请求失败: {str(e)}"
            logger.error(f"Graphiti查询请求失败: {error_msg}")
            return False, error_msg
        except Exception as e:
            error_msg = f"查询失败: {str(e)}"
            logger.error(f"Graphiti查询失败: {error_msg}")
            return False, error_msg
    
    def query_advanced(self, query: str, params: Dict[str, Any]) -> Tuple[bool, Any]:
        """执行Graphiti高级查询"""
        try:
            # 使用Graphiti的高级搜索端点与请求模型字段
            search_payload = {
                "query": query,
                "search_mode": params.get('search_mode', 'cross_encoder'),
                "max_facts": params.get('max_facts', 15),
                "group_ids": params.get('group_ids', []),
                "reranker_min_score": params.get('reranker_min_score', 0.6),
                "sim_min_score": params.get('sim_min_score', 0.5),
                "enable_filters": params.get('enable_filters', False),
                "node_labels": params.get('node_labels', []),
                "edge_types": params.get('edge_types', []),
            }
            # 可选字段：自定义限制
            if 'custom_limit' in params and params.get('custom_limit'):
                search_payload["custom_limit"] = params.get('custom_limit')

            response = requests.post(
                f"{self.service_url}/search_advanced",
                json=search_payload,
                timeout=60  # 高级查询允许更长时间
            )

            if response.status_code == 200:
                result = response.json()
                logger.info(f"Graphiti高级查询成功: {query}")
                return True, result
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"Graphiti高级查询失败: {error_msg}")
                return False, error_msg

        except Exception as e:
            error_msg = f"高级查询失败: {str(e)}"
            logger.error(f"Graphiti高级查询失败: {error_msg}")
            return False, error_msg
    
    def insert_documents(self, documents: List[str], partition_id: str) -> Tuple[bool, str]:
        """向Graphiti插入文档"""
        try:
            success_count = 0
            error_messages = []

            for doc in documents:
                try:
                    payload = {
                        "text": doc,
                        "group_id": partition_id
                    }

                    response = requests.post(
                        f"{self.service_url}/add_nodes",
                        json=payload,
                        timeout=30
                    )

                    if response.status_code == 200:
                        success_count += 1
                        logger.debug(f"成功插入文档到Graphiti: {doc[:100]}...")
                    else:
                        error_msg = f"HTTP {response.status_code}: {response.text}"
                        error_messages.append(error_msg)
                        logger.error(f"插入文档失败: {error_msg}")

                except requests.exceptions.RequestException as e:
                    error_msg = f"请求失败: {str(e)}"
                    error_messages.append(error_msg)
                    logger.error(f"插入文档请求失败: {error_msg}")

            if success_count > 0:
                message = f"成功插入 {success_count}/{len(documents)} 个文档到Graphiti"
                if error_messages:
                    message += f"，{len(error_messages)} 个失败"
                logger.info(message)
                return True, message
            else:
                message = f"所有文档插入失败: {'; '.join(error_messages[:3])}"
                return False, message

        except Exception as e:
            error_msg = f"插入文档失败: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def rebuild_index(self) -> Tuple[bool, str]:
        """重建Graphiti索引"""
        # Graphiti通常不需要手动重建索引，Neo4j会自动管理
        logger.info("Graphiti使用Neo4j自动索引管理，无需手动重建")
        return True, "Graphiti使用Neo4j自动索引管理，无需手动重建"
    
    def clear_data(self) -> Tuple[bool, str]:
        """清空Graphiti数据"""
        try:
            # 注意：这是一个危险操作，需要谨慎使用
            # 这里可能需要调用特定的清空API或直接操作Neo4j
            logger.warning("Graphiti数据清空功能尚未实现，需要直接操作Neo4j数据库")
            return False, "Graphiti数据清空功能尚未实现，请直接操作Neo4j数据库"
            
        except Exception as e:
            error_msg = f"清空Graphiti数据失败: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def get_visualization_data(self, group_id: Optional[str] = None) -> Tuple[bool, Any]:
        """获取Graphiti的可视化数据（通过Neo4j直接查询）"""
        try:
            # 导入Neo4j查询模块
            from app.utils.direct_neo4j_query import DirectNeo4jQuery
            
            # 从配置创建Neo4j客户端，使用浏览器访问地址（宿主机可访问）
            neo4j_client = DirectNeo4jQuery.from_config(
                {'framework_config': self.framework_config},
                use_browser_uri=True  # 使用 neo4j_browser_uri 而不是 neo4j_uri
            )
            
            # 运行异步查询
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # 连接并获取数据
                loop.run_until_complete(neo4j_client.connect())
                graph_data = loop.run_until_complete(neo4j_client.get_graph_data(group_id))
                
                logger.info(f"成功获取Graphiti可视化数据: {len(graph_data.get('nodes', []))} 节点, {len(graph_data.get('edges', []))} 边")
                return True, graph_data
                
            finally:
                loop.run_until_complete(neo4j_client.close())
                loop.close()
                
        except ImportError as e:
            logger.error(f"导入Neo4j查询模块失败: {e}")
            return False, "Neo4j查询模块不可用，请检查依赖安装"
        except Exception as e:
            logger.error(f"获取Graphiti可视化数据失败: {e}")
            return False, f"获取Graphiti可视化数据失败: {str(e)}"
    
    def get_database_info(self) -> Tuple[bool, Any]:
        """获取Graphiti数据库信息"""
        try:
            # 导入Neo4j查询模块
            from app.utils.direct_neo4j_query import DirectNeo4jQuery
            
            # 从配置创建Neo4j客户端，使用浏览器访问地址（宿主机可访问）
            neo4j_client = DirectNeo4jQuery.from_config(
                {'framework_config': self.framework_config},
                use_browser_uri=True  # 使用 neo4j_browser_uri 而不是 neo4j_uri
            )
            
            # 运行异步查询
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # 连接并获取信息
                loop.run_until_complete(neo4j_client.connect())
                db_info = loop.run_until_complete(neo4j_client.get_database_info())
                
                logger.info(f"成功获取Graphiti数据库信息: {db_info}")
                return True, db_info
                
            finally:
                loop.run_until_complete(neo4j_client.close())
                loop.close()
                
        except ImportError as e:
            logger.error(f"导入Neo4j查询模块失败: {e}")
            return False, "Neo4j查询模块不可用，请检查依赖安装"
        except Exception as e:
            logger.error(f"获取Graphiti数据库信息失败: {e}")
            return False, f"获取Graphiti数据库信息失败: {str(e)}"
