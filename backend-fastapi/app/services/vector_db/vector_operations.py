"""
TiDB向量数据库操作模块

提供向量数据的存储、检索、更新、删除等核心功能
"""

import logging
import json
import time
from typing import Dict, Any, List, Optional, Union, Tuple
from datetime import datetime

from .models import (
    VectorRecord, VectorSearchResult, VectorCollection, 
    VectorDistanceMetric, VectorDataType, VectorTableSchema
)
from .tidb_connection import tidb_connection_manager
from .table_manager import vector_table_manager
from .embedding_service import embedding_service

logger = logging.getLogger(__name__)


class VectorOperations:
    """向量操作类"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def insert_records(
        self, 
        table_name: str, 
        records: List[VectorRecord]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """插入向量记录"""
        try:
            if not records:
                return False, "记录列表不能为空", {}
            
            # 验证表是否存在
            if not vector_table_manager.table_exists(table_name):
                return False, f"表 '{table_name}' 不存在", {}
            
            start_time = time.time()
            
            # 验证所有记录
            for i, record in enumerate(records):
                is_valid, message = record.validate()
                if not is_valid:
                    return False, f"记录 {i} 验证失败: {message}", {}
            
            # 准备插入数据
            insert_sql = VectorTableSchema.get_insert_sql(table_name)
            insert_data = []
            
            for record in records:
                # 序列化向量和元数据
                embedding_json = json.dumps(record.embedding)
                metadata_json = json.dumps(record.metadata) if record.metadata else None
                
                insert_data.append({
                    'id': record.id,
                    'text': record.text,
                    'embedding': embedding_json,
                    'metadata': metadata_json,
                    'data_type': record.data_type.value,
                    'source': record.source,
                    'created_at': record.created_at,
                    'updated_at': record.updated_at
                })
            
            # 批量插入
            from sqlalchemy import text
            with tidb_connection_manager.get_session() as session:
                for data in insert_data:
                    session.execute(text(insert_sql), data)
            
            processing_time = time.time() - start_time
            
            info = {
                'table_name': table_name,
                'inserted_count': len(records),
                'processing_time': round(processing_time, 3),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            self.logger.info(f"插入向量记录成功: {len(records)}条记录到表 {table_name}")
            return True, f"成功插入 {len(records)} 条记录", info
            
        except Exception as e:
            error_msg = f"插入向量记录失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def search_vectors(
        self, 
        table_name: str, 
        query_vector: List[float],
        limit: int = 10,
        distance_metric: VectorDistanceMetric = VectorDistanceMetric.COSINE,
        filters: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Union[List[VectorSearchResult], str], Dict[str, Any]]:
        """向量相似度搜索"""
        try:
            if not query_vector:
                return False, "查询向量不能为空", {}
            
            if not vector_table_manager.table_exists(table_name):
                return False, f"表 '{table_name}' 不存在", {}
            
            start_time = time.time()
            
            # 构建搜索SQL
            search_sql = VectorTableSchema.get_search_sql(table_name, distance_metric)
            
            # 构建WHERE子句
            where_conditions = []
            params = {
                'query_vector': json.dumps(query_vector),
                'limit': limit
            }
            
            # 添加过滤条件
            if filters:
                for key, value in filters.items():
                    if key == 'data_type':
                        where_conditions.append("data_type = :filter_data_type")
                        params['filter_data_type'] = value
                    elif key == 'source':
                        where_conditions.append("source = :filter_source")
                        params['filter_source'] = value
                    elif key.startswith('metadata.'):
                        # JSON路径查询
                        json_path = key.replace('metadata.', '$.')
                        condition_index = len(where_conditions)
                        where_conditions.append(f"JSON_EXTRACT(metadata, :json_path_{condition_index}) = :json_value_{condition_index}")
                        params[f'json_path_{condition_index}'] = json_path
                        params[f'json_value_{condition_index}'] = json.dumps(value)
            
            # 组装完整SQL
            where_clause = ""
            if where_conditions:
                where_clause = "AND " + " AND ".join(where_conditions)
            
            final_sql = search_sql.format(where_clause=where_clause)
            
            # 执行搜索
            results = tidb_connection_manager.execute_sql(final_sql, params)
            
            # 转换结果
            search_results = []
            for row in results:
                # 解析向量和元数据
                embedding = json.loads(row['embedding']) if row['embedding'] else []
                metadata = json.loads(row['metadata']) if row['metadata'] else {}
                
                # 创建记录对象
                record = VectorRecord(
                    id=row['id'],
                    text=row['text'],
                    embedding=embedding,
                    metadata=metadata,
                    data_type=VectorDataType(row['data_type']) if row['data_type'] else VectorDataType.TEXT,
                    source=row['source'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at']
                )
                
                # 创建搜索结果
                search_result = VectorSearchResult(
                    record=record,
                    distance=float(row['distance']),
                    score=1.0 - float(row['distance'])  # 转换为相似度分数
                )
                
                search_results.append(search_result)
            
            processing_time = time.time() - start_time
            
            info = {
                'table_name': table_name,
                'query_vector_dimension': len(query_vector),
                'distance_metric': distance_metric.value,
                'limit': limit,
                'filters': filters,
                'result_count': len(search_results),
                'processing_time': round(processing_time, 3),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            self.logger.info(f"向量搜索完成: 表 {table_name}, 返回 {len(search_results)} 条结果")
            return True, search_results, info
            
        except Exception as e:
            error_msg = f"向量搜索失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def delete_records(
        self, 
        table_name: str, 
        record_ids: List[str]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """删除向量记录"""
        try:
            if not record_ids:
                return False, "记录ID列表不能为空", {}
            
            if not vector_table_manager.table_exists(table_name):
                return False, f"表 '{table_name}' 不存在", {}
            
            start_time = time.time()
            
            # 批量删除
            delete_sql = VectorTableSchema.get_delete_sql(table_name)
            deleted_count = 0
            
            with tidb_connection_manager.get_session() as session:
                for record_id in record_ids:
                    result = session.execute(delete_sql, {'id': record_id})
                    deleted_count += result.rowcount
            
            processing_time = time.time() - start_time
            
            info = {
                'table_name': table_name,
                'requested_count': len(record_ids),
                'deleted_count': deleted_count,
                'processing_time': round(processing_time, 3),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            self.logger.info(f"删除向量记录完成: 表 {table_name}, 删除 {deleted_count} 条记录")
            return True, f"成功删除 {deleted_count} 条记录", info
            
        except Exception as e:
            error_msg = f"删除向量记录失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def get_record_by_id(
        self, 
        table_name: str, 
        record_id: str
    ) -> Tuple[bool, Union[VectorRecord, str], Dict[str, Any]]:
        """根据ID获取向量记录"""
        try:
            if not record_id:
                return False, "记录ID不能为空", {}
            
            if not vector_table_manager.table_exists(table_name):
                return False, f"表 '{table_name}' 不存在", {}
            
            # 查询记录
            sql = f"""
            SELECT id, text, embedding, metadata, data_type, source, created_at, updated_at
            FROM `{table_name}`
            WHERE id = :record_id
            """

            results = tidb_connection_manager.execute_sql(sql, {'record_id': record_id})
            
            if not results:
                return False, f"记录 '{record_id}' 不存在", {}
            
            row = results[0]
            
            # 解析数据
            embedding = json.loads(row['embedding']) if row['embedding'] else []
            metadata = json.loads(row['metadata']) if row['metadata'] else {}
            
            # 创建记录对象
            record = VectorRecord(
                id=row['id'],
                text=row['text'],
                embedding=embedding,
                metadata=metadata,
                data_type=VectorDataType(row['data_type']) if row['data_type'] else VectorDataType.TEXT,
                source=row['source'],
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )
            
            info = {
                'table_name': table_name,
                'record_id': record_id,
                'found': True,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            return True, record, info
            
        except Exception as e:
            error_msg = f"获取向量记录失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def update_record(
        self, 
        table_name: str, 
        record: VectorRecord
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """更新向量记录"""
        try:
            # 验证记录
            is_valid, message = record.validate()
            if not is_valid:
                return False, f"记录验证失败: {message}", {}
            
            if not vector_table_manager.table_exists(table_name):
                return False, f"表 '{table_name}' 不存在", {}
            
            start_time = time.time()
            
            # 更新时间戳
            record.updated_at = datetime.utcnow()
            
            # 准备更新数据
            update_sql = f"""
            UPDATE `{table_name}`
            SET text = :text,
                embedding = :embedding,
                metadata = :metadata,
                data_type = :data_type,
                source = :source,
                updated_at = :updated_at
            WHERE id = :id
            """
            
            update_data = {
                'id': record.id,
                'text': record.text,
                'embedding': json.dumps(record.embedding),
                'metadata': json.dumps(record.metadata) if record.metadata else None,
                'data_type': record.data_type.value,
                'source': record.source,
                'updated_at': record.updated_at
            }
            
            # 执行更新
            result = tidb_connection_manager.execute_sql(update_sql, update_data)
            updated_count = result[0].get('affected_rows', 0)
            
            processing_time = time.time() - start_time
            
            info = {
                'table_name': table_name,
                'record_id': record.id,
                'updated': updated_count > 0,
                'processing_time': round(processing_time, 3),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if updated_count > 0:
                self.logger.info(f"更新向量记录成功: {record.id}")
                return True, "记录更新成功", info
            else:
                return False, f"记录 '{record.id}' 不存在", info
            
        except Exception as e:
            error_msg = f"更新向量记录失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}


    def batch_insert_with_embeddings(
        self,
        table_name: str,
        texts: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        data_type: VectorDataType = VectorDataType.TEXT,
        source: Optional[str] = None,
        model_config_id: Optional[int] = None
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """批量插入文本并自动生成嵌入向量"""
        try:
            if not texts:
                return False, "文本列表不能为空", {}

            start_time = time.time()

            # 生成嵌入向量
            success, embeddings, embed_info = embedding_service.generate_embeddings(
                texts,
                embedding_service.get_embedding_model_by_id(model_config_id) if model_config_id else None
            )

            if not success:
                return False, f"生成嵌入向量失败: {embeddings}", {}

            # 准备记录
            records = []
            for i, (text, embedding) in enumerate(zip(texts, embeddings)):
                record_id = f"{table_name}_{int(time.time() * 1000)}_{i}"
                metadata = metadatas[i] if metadatas and i < len(metadatas) else {}

                record = VectorRecord(
                    id=record_id,
                    text=text,
                    embedding=embedding,
                    metadata=metadata,
                    data_type=data_type,
                    source=source
                )
                records.append(record)

            # 插入记录
            success, message, insert_info = self.insert_records(table_name, records)

            processing_time = time.time() - start_time

            # 合并信息
            info = {
                'table_name': table_name,
                'text_count': len(texts),
                'embedding_info': embed_info,
                'insert_info': insert_info,
                'total_processing_time': round(processing_time, 3),
                'timestamp': datetime.utcnow().isoformat()
            }

            if success:
                self.logger.info(f"批量插入文本和向量成功: {len(texts)}条记录")

            return success, message, info

        except Exception as e:
            error_msg = f"批量插入文本和向量失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}

    def semantic_search(
        self,
        table_name: str,
        query_text: str,
        limit: int = 10,
        distance_metric: VectorDistanceMetric = VectorDistanceMetric.COSINE,
        filters: Optional[Dict[str, Any]] = None,
        model_config_id: Optional[int] = None
    ) -> Tuple[bool, Union[List[VectorSearchResult], str], Dict[str, Any]]:
        """语义搜索（自动生成查询向量）"""
        try:
            if not query_text:
                return False, "查询文本不能为空", {}

            start_time = time.time()

            # 生成查询向量
            success, query_vector, embed_info = embedding_service.generate_single_embedding(
                query_text,
                embedding_service.get_embedding_model_by_id(model_config_id) if model_config_id else None
            )

            if not success:
                return False, f"生成查询向量失败: {query_vector}", {}

            # 执行向量搜索
            success, results, search_info = self.search_vectors(
                table_name, query_vector, limit, distance_metric, filters
            )

            processing_time = time.time() - start_time

            # 合并信息
            info = {
                'table_name': table_name,
                'query_text': query_text,
                'embedding_info': embed_info,
                'search_info': search_info,
                'total_processing_time': round(processing_time, 3),
                'timestamp': datetime.utcnow().isoformat()
            }

            if success:
                self.logger.info(f"语义搜索完成: 查询'{query_text}', 返回{len(results)}条结果")

            return success, results, info

        except Exception as e:
            error_msg = f"语义搜索失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}

    def get_table_statistics(self, table_name: str) -> Tuple[bool, Union[Dict[str, Any], str]]:
        """获取表统计信息"""
        try:
            if not vector_table_manager.table_exists(table_name):
                return False, f"表 '{table_name}' 不存在"

            # 基础统计
            stats_sql = f"""
            SELECT
                COUNT(*) as total_records,
                COUNT(DISTINCT data_type) as data_type_count,
                COUNT(DISTINCT source) as source_count,
                AVG(CHAR_LENGTH(text)) as avg_text_length,
                MIN(created_at) as earliest_record,
                MAX(created_at) as latest_record,
                MAX(updated_at) as last_updated
            FROM `{table_name}`
            """

            stats = tidb_connection_manager.execute_sql(stats_sql)

            # 数据类型分布
            type_dist_sql = f"""
            SELECT data_type, COUNT(*) as count
            FROM `{table_name}`
            GROUP BY data_type
            ORDER BY count DESC
            """

            type_distribution = tidb_connection_manager.execute_sql(type_dist_sql)

            # 来源分布
            source_dist_sql = f"""
            SELECT source, COUNT(*) as count
            FROM `{table_name}`
            WHERE source IS NOT NULL
            GROUP BY source
            ORDER BY count DESC
            LIMIT 10
            """

            source_distribution = tidb_connection_manager.execute_sql(source_dist_sql)

            statistics = {
                'table_name': table_name,
                'basic_stats': stats[0] if stats else {},
                'data_type_distribution': type_distribution,
                'source_distribution': source_distribution,
                'generated_at': datetime.utcnow().isoformat()
            }

            return True, statistics

        except Exception as e:
            error_msg = f"获取表统计信息失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg


# 全局向量操作实例
vector_operations = VectorOperations()
