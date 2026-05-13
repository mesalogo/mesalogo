"""
外部知识库服务

提供外部知识库的统一服务接口
"""

import time
import logging
from typing import Dict, List, Any, Optional
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models import (
    ExternalKnowledgeProvider, ExternalKnowledge, 
    RoleExternalKnowledge, ExternalKnowledgeQueryLog
)
from .adapter_factory import AdapterFactory

logger = logging.getLogger(__name__)

class ExternalKnowledgeService:
    """外部知识库服务类"""
    
    @staticmethod
    def query_knowledge_for_role(role_id: int, query_text: str, 
                                query_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        为指定角色查询外部知识库
        
        Args:
            role_id: 角色ID
            query_text: 查询文本
            query_params: 额外查询参数
            
        Returns:
            Dict: 查询结果
        """
        start_time = time.time()
        
        try:
            # 获取角色绑定的外部知识库
            bindings = db.session.query(
                RoleExternalKnowledge, ExternalKnowledge, ExternalKnowledgeProvider
            ).join(
                ExternalKnowledge,
                RoleExternalKnowledge.external_knowledge_id == ExternalKnowledge.id
            ).join(
                ExternalKnowledgeProvider,
                ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
            ).filter(
                RoleExternalKnowledge.role_id == role_id,
                ExternalKnowledge.status == 'active',
                ExternalKnowledgeProvider.status == 'active'
            ).all()
            
            if not bindings:
                return {
                    'success': True,
                    'results': [],
                    'total_count': 0,
                    'query_time': time.time() - start_time,
                    'message': '该角色没有绑定任何外部知识库'
                }
            
            all_results = []
            query_logs = []
            
            # 并行查询所有绑定的知识库
            for binding, knowledge, provider in bindings:
                try:
                    # 创建适配器
                    adapter = AdapterFactory.create_adapter(
                        provider.type,
                        {
                            'base_url': provider.base_url,
                            'api_key': provider.api_key,
                            'config': provider.config or {}
                        }
                    )
                    
                    # 合并查询配置
                    knowledge_config = {
                        'external_kb_id': knowledge.external_kb_id,
                        'query_config': {
                            **(knowledge.query_config or {}),
                            **(binding.config or {})
                        }
                    }
                    
                    # 执行查询
                    query_result = adapter.query_knowledge(
                        knowledge_config,
                        query_text
                    )
                    
                    # 记录查询日志
                    log_entry = ExternalKnowledgeQueryLog(
                        external_knowledge_id=knowledge.id,
                        role_id=role_id,
                        query_text=query_text,
                        response_data=query_result if query_result['success'] else None,
                        query_time=query_result.get('query_time', 0),
                        status='success' if query_result['success'] else 'error',
                        error_message=query_result.get('error_message') if not query_result['success'] else None
                    )
                    query_logs.append(log_entry)
                    
                    # 添加知识库信息到结果中
                    if query_result['success']:
                        for result in query_result['results']:
                            result['knowledge_source'] = {
                                'knowledge_id': knowledge.id,
                                'knowledge_name': knowledge.name,
                                'provider_name': provider.name,
                                'provider_type': provider.type
                            }
                        all_results.extend(query_result['results'])
                    
                except Exception as e:
                    logger.error(f"查询知识库 {knowledge.name} 失败: {e}")
                    
                    # 记录错误日志
                    error_log = ExternalKnowledgeQueryLog(
                        external_knowledge_id=knowledge.id,
                        role_id=role_id,
                        query_text=query_text,
                        response_data=None,
                        query_time=0,
                        status='error',
                        error_message=str(e)
                    )
                    query_logs.append(error_log)
            
            # 批量保存查询日志
            try:
                for log in query_logs:
                    db.session.add(log)
                db.session.commit()
            except SQLAlchemyError as e:
                logger.error(f"保存查询日志失败: {e}")
                db.session.rollback()
            
            # 按相关性排序结果
            all_results.sort(key=lambda x: x.get('score', 0), reverse=True)
            
            end_time = time.time()
            
            return {
                'success': True,
                'results': all_results,
                'total_count': len(all_results),
                'query_time': end_time - start_time,
                'queried_knowledge_bases': len(bindings),
                'metadata': {
                    'role_id': role_id,
                    'query_text': query_text,
                    'knowledge_sources': [
                        {
                            'knowledge_id': knowledge.id,
                            'knowledge_name': knowledge.name,
                            'provider_name': provider.name,
                            'provider_type': provider.type
                        }
                        for _, knowledge, provider in bindings
                    ]
                }
            }
            
        except Exception as e:
            logger.error(f"角色知识库查询失败: {e}")
            return {
                'success': False,
                'results': [],
                'total_count': 0,
                'query_time': time.time() - start_time,
                'error_message': f'查询失败: {str(e)}'
            }
    
    @staticmethod
    def test_knowledge_connection(knowledge_id: int) -> Dict[str, Any]:
        """
        测试外部知识库连接
        
        Args:
            knowledge_id: 外部知识库ID
            
        Returns:
            Dict: 测试结果
        """
        try:
            # 获取知识库和提供商信息
            result = db.session.query(ExternalKnowledge, ExternalKnowledgeProvider).join(
                ExternalKnowledgeProvider,
                ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
            ).filter(ExternalKnowledge.id == knowledge_id).first()
            
            if not result:
                return {
                    'success': False,
                    'message': '知识库不存在',
                    'response_time': 0
                }
            
            knowledge, provider = result
            
            # 创建适配器并测试连接
            adapter = AdapterFactory.create_adapter(
                provider.type,
                {
                    'base_url': provider.base_url,
                    'api_key': provider.api_key,
                    'config': provider.config or {}
                }
            )
            
            # 测试基本连接
            connection_result = adapter.test_connection()
            
            if connection_result['success']:
                # 测试知识库查询
                try:
                    knowledge_config = {
                        'external_kb_id': knowledge.external_kb_id,
                        'query_config': knowledge.query_config or {}
                    }
                    
                    query_result = adapter.query_knowledge(
                        knowledge_config,
                        "测试查询",
                        {'top_k': 1}
                    )
                    
                    if query_result['success']:
                        connection_result['message'] += ' - 知识库查询测试成功'
                    else:
                        connection_result['message'] += f' - 知识库查询测试失败: {query_result.get("error_message", "")}'
                        
                except Exception as e:
                    connection_result['message'] += f' - 知识库查询测试异常: {str(e)}'
            
            return connection_result
            
        except Exception as e:
            logger.error(f"测试知识库连接失败: {e}")
            return {
                'success': False,
                'message': f'测试失败: {str(e)}',
                'response_time': 0
            }
    
    @staticmethod
    def get_knowledge_info(knowledge_id: int) -> Dict[str, Any]:
        """
        获取外部知识库详细信息
        
        Args:
            knowledge_id: 外部知识库ID
            
        Returns:
            Dict: 知识库信息
        """
        try:
            # 获取知识库和提供商信息
            result = db.session.query(ExternalKnowledge, ExternalKnowledgeProvider).join(
                ExternalKnowledgeProvider,
                ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
            ).filter(ExternalKnowledge.id == knowledge_id).first()
            
            if not result:
                return {
                    'success': False,
                    'error_message': '知识库不存在'
                }
            
            knowledge, provider = result
            
            # 创建适配器并获取详细信息
            adapter = AdapterFactory.create_adapter(
                provider.type,
                {
                    'base_url': provider.base_url,
                    'api_key': provider.api_key,
                    'config': provider.config or {}
                }
            )
            
            # 获取外部知识库信息
            external_info = adapter.get_knowledge_info(knowledge.external_kb_id)
            
            if external_info['success']:
                # 合并本地和外部信息
                combined_info = {
                    'local_info': {
                        'id': knowledge.id,
                        'name': knowledge.name,
                        'description': knowledge.description,
                        'external_kb_id': knowledge.external_kb_id,
                        'query_config': knowledge.query_config,
                        'status': knowledge.status,
                        'created_at': knowledge.created_at.isoformat() if knowledge.created_at else None,
                        'updated_at': knowledge.updated_at.isoformat() if knowledge.updated_at else None
                    },
                    'provider_info': {
                        'id': provider.id,
                        'name': provider.name,
                        'type': provider.type,
                        'base_url': provider.base_url,
                        'status': provider.status
                    },
                    'external_info': external_info['info']
                }
                
                return {
                    'success': True,
                    'info': combined_info
                }
            else:
                return external_info
                
        except Exception as e:
            logger.error(f"获取知识库信息失败: {e}")
            return {
                'success': False,
                'error_message': f'获取信息失败: {str(e)}'
            }
    
    @staticmethod
    def get_query_statistics(knowledge_id: Optional[int] = None, 
                           role_id: Optional[int] = None,
                           days: int = 30) -> Dict[str, Any]:
        """
        获取查询统计信息
        
        Args:
            knowledge_id: 知识库ID（可选）
            role_id: 角色ID（可选）
            days: 统计天数
            
        Returns:
            Dict: 统计信息
        """
        try:
            from datetime import datetime, timedelta
            
            # 构建查询条件
            query = ExternalKnowledgeQueryLog.query
            
            # 时间范围过滤
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(ExternalKnowledgeQueryLog.created_at >= start_date)
            
            # 知识库过滤
            if knowledge_id:
                query = query.filter(ExternalKnowledgeQueryLog.external_knowledge_id == knowledge_id)
            
            # 角色过滤
            if role_id:
                query = query.filter(ExternalKnowledgeQueryLog.role_id == role_id)
            
            logs = query.all()
            
            # 计算统计信息
            total_queries = len(logs)
            success_queries = len([log for log in logs if log.status == 'success'])
            error_queries = total_queries - success_queries
            
            success_rate = (success_queries / total_queries * 100) if total_queries > 0 else 0
            
            # 计算平均响应时间
            success_logs = [log for log in logs if log.status == 'success' and log.query_time]
            avg_response_time = sum(log.query_time for log in success_logs) / len(success_logs) if success_logs else 0
            
            return {
                'success': True,
                'statistics': {
                    'total_queries': total_queries,
                    'success_queries': success_queries,
                    'error_queries': error_queries,
                    'success_rate': round(success_rate, 2),
                    'avg_response_time': round(avg_response_time, 3),
                    'period_days': days
                }
            }
            
        except Exception as e:
            logger.error(f"获取查询统计失败: {e}")
            return {
                'success': False,
                'error_message': f'获取统计失败: {str(e)}'
            }
