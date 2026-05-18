"""
TiDB向量数据库表管理模块

提供向量表的创建、删除、管理功能
"""

import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from .models import VectorCollection, VectorDistanceMetric, VectorTableSchema
from .tidb_connection import tidb_connection_manager

logger = logging.getLogger(__name__)


class VectorTableManager:
    """向量表管理器"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def create_table(self, collection: VectorCollection) -> Tuple[bool, str]:
        """创建向量表"""
        try:
            # 验证集合配置
            is_valid, message = collection.validate()
            if not is_valid:
                return False, message
            
            # 生成创建表的SQL
            create_sql = VectorTableSchema.get_create_table_sql(
                table_name=collection.name,
                vector_dimension=collection.dimension,
                distance_metric=collection.distance_metric
            )
            
            # 执行SQL
            tidb_connection_manager.execute_sql(create_sql)
            
            self.logger.info(f"创建向量表成功: {collection.name}")
            return True, f"向量表 '{collection.name}' 创建成功"
            
        except Exception as e:
            error_msg = f"创建向量表失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def drop_table(self, table_name: str) -> Tuple[bool, str]:
        """删除向量表"""
        try:
            # 生成删除表的SQL
            drop_sql = VectorTableSchema.get_drop_table_sql(table_name)
            
            # 执行SQL
            tidb_connection_manager.execute_sql(drop_sql)
            
            self.logger.info(f"删除向量表成功: {table_name}")
            return True, f"向量表 '{table_name}' 删除成功"
            
        except Exception as e:
            error_msg = f"删除向量表失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def table_exists(self, table_name: str) -> bool:
        """检查表是否存在"""
        try:
            sql = """
            SELECT COUNT(*) as count
            FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = :table_name
            """

            result = tidb_connection_manager.execute_sql(sql, {'table_name': table_name})
            return result[0]['count'] > 0

        except Exception as e:
            self.logger.error(f"检查表存在性失败: {e}")
            return False
    
    def get_table_info(self, table_name: str) -> Optional[Dict[str, Any]]:
        """获取表信息"""
        try:
            if not self.table_exists(table_name):
                return None
            
            # 获取表结构信息
            describe_sql = VectorTableSchema.get_table_info_sql(table_name)
            columns = tidb_connection_manager.execute_sql(describe_sql)
            
            # 获取记录数量
            count_sql = VectorTableSchema.get_count_sql(table_name)
            count_result = tidb_connection_manager.execute_sql(count_sql)
            record_count = count_result[0]['count']
            
            # 获取向量维度（从embedding列的类型中解析）
            vector_dimension = None
            for col in columns:
                if col['Field'] == 'embedding':
                    # 解析VECTOR(dimension)格式
                    type_str = col['Type']
                    if 'vector(' in type_str.lower():
                        try:
                            start = type_str.lower().find('vector(') + 7
                            end = type_str.find(')', start)
                            vector_dimension = int(type_str[start:end])
                        except (ValueError, IndexError):
                            pass
                    break
            
            # 获取索引信息
            index_sql = f"SHOW INDEX FROM `{table_name}` WHERE Key_name LIKE 'idx_%_embedding'"
            try:
                indexes = tidb_connection_manager.execute_sql(index_sql)
            except Exception:
                indexes = []
            
            table_info = {
                'name': table_name,
                'exists': True,
                'record_count': record_count,
                'vector_dimension': vector_dimension,
                'columns': columns,
                'indexes': indexes,
                'created_at': datetime.utcnow().isoformat()
            }
            
            return table_info
            
        except Exception as e:
            self.logger.error(f"获取表信息失败: {e}")
            return None
    
    def list_tables(self) -> List[Dict[str, Any]]:
        """列出所有向量表"""
        try:
            # 查询所有包含向量列的表
            sql = """
            SELECT 
                t.table_name,
                t.table_rows,
                t.create_time,
                t.update_time
            FROM information_schema.tables t
            WHERE t.table_schema = DATABASE()
            AND EXISTS (
                SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = t.table_schema 
                AND c.table_name = t.table_name
                AND c.data_type = 'vector'
            )
            ORDER BY t.table_name;
            """
            
            tables = tidb_connection_manager.execute_sql(sql)
            
            # 为每个表获取详细信息
            table_list = []
            for table in tables:
                table_info = self.get_table_info(table['table_name'])
                if table_info:
                    table_list.append(table_info)
            
            return table_list
            
        except Exception as e:
            self.logger.error(f"列出向量表失败: {e}")
            return []
    
    def optimize_table(self, table_name: str) -> Tuple[bool, str]:
        """优化向量表"""
        try:
            if not self.table_exists(table_name):
                return False, f"表 '{table_name}' 不存在"
            
            # 执行表优化
            optimize_sql = f"OPTIMIZE TABLE `{table_name}`"
            tidb_connection_manager.execute_sql(optimize_sql)
            
            self.logger.info(f"优化向量表成功: {table_name}")
            return True, f"向量表 '{table_name}' 优化成功"
            
        except Exception as e:
            error_msg = f"优化向量表失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def analyze_table(self, table_name: str) -> Tuple[bool, str, Dict[str, Any]]:
        """分析向量表"""
        try:
            if not self.table_exists(table_name):
                return False, f"表 '{table_name}' 不存在", {}
            
            # 获取表统计信息
            stats_sql = f"""
            SELECT 
                COUNT(*) as total_records,
                AVG(CHAR_LENGTH(text)) as avg_text_length,
                MIN(created_at) as earliest_record,
                MAX(created_at) as latest_record
            FROM `{table_name}`
            """
            
            stats = tidb_connection_manager.execute_sql(stats_sql)
            
            # 获取数据类型分布
            type_dist_sql = f"""
            SELECT 
                data_type,
                COUNT(*) as count
            FROM `{table_name}`
            GROUP BY data_type
            ORDER BY count DESC
            """
            
            type_distribution = tidb_connection_manager.execute_sql(type_dist_sql)
            
            # 获取元数据键分布（如果有的话）
            try:
                metadata_keys_sql = f"""
                SELECT 
                    JSON_KEYS(metadata) as keys,
                    COUNT(*) as count
                FROM `{table_name}`
                WHERE metadata IS NOT NULL
                GROUP BY JSON_KEYS(metadata)
                ORDER BY count DESC
                LIMIT 10
                """
                metadata_keys = tidb_connection_manager.execute_sql(metadata_keys_sql)
            except Exception:
                metadata_keys = []
            
            analysis_result = {
                'table_name': table_name,
                'statistics': stats[0] if stats else {},
                'data_type_distribution': type_distribution,
                'metadata_keys': metadata_keys,
                'analyzed_at': datetime.utcnow().isoformat()
            }
            
            self.logger.info(f"分析向量表成功: {table_name}")
            return True, f"向量表 '{table_name}' 分析完成", analysis_result
            
        except Exception as e:
            error_msg = f"分析向量表失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def create_default_collections(self) -> List[Tuple[bool, str]]:
        """创建默认的向量集合"""
        try:
            # 定义默认集合
            default_collections = [
                VectorCollection(
                    name="documents",
                    dimension=1024,  # 适配bge-large-zh-v1.5模型
                    distance_metric=VectorDistanceMetric.COSINE,
                    description="文档向量存储"
                ),
                VectorCollection(
                    name="knowledge_base",
                    dimension=1536,  # 适配OpenAI embedding模型
                    distance_metric=VectorDistanceMetric.COSINE,
                    description="知识库向量存储"
                ),
                VectorCollection(
                    name="conversations",
                    dimension=1024,
                    distance_metric=VectorDistanceMetric.COSINE,
                    description="对话历史向量存储"
                )
            ]
            
            results = []
            for collection in default_collections:
                # 检查表是否已存在
                if not self.table_exists(collection.name):
                    success, message = self.create_table(collection)
                    results.append((success, f"{collection.name}: {message}"))
                else:
                    results.append((True, f"{collection.name}: 表已存在，跳过创建"))
            
            return results
            
        except Exception as e:
            error_msg = f"创建默认集合失败: {str(e)}"
            self.logger.error(error_msg)
            return [(False, error_msg)]


# 全局表管理器实例
vector_table_manager = VectorTableManager()
