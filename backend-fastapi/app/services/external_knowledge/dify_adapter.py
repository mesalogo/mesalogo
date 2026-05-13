"""
Dify知识库适配器

实现与Dify.AI平台的知识库API集成
"""

import time
import json
from typing import Dict, List, Any, Optional
from .base_adapter import ExternalKnowledgeAdapter
import logging

logger = logging.getLogger(__name__)

class DifyAdapter(ExternalKnowledgeAdapter):
    """Dify知识库适配器"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        super().__init__(provider_config)
        
        # Dify特定配置
        self.app_id = self.config.get('app_id', '')
        self.dataset_id = self.config.get('dataset_id', '')
        
    def test_connection(self) -> Dict[str, Any]:
        """测试Dify连接"""
        start_time = time.time()
        
        try:
            # 验证必需配置
            if not self._validate_config([]):
                return {
                    'success': False,
                    'message': '配置验证失败',
                    'response_time': 0
                }
            
            # 测试API连接 - 获取应用信息
            url = f"{self.base_url}/v1/parameters"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            response = self._make_request('GET', url, headers=headers)
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'message': 'Dify连接测试成功',
                    'response_time': response_time
                }
            else:
                return {
                    'success': False,
                    'message': f'Dify API返回错误: {response.status_code}',
                    'response_time': response_time
                }
                
        except Exception as e:
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)
            logger.error(f"Dify连接测试失败: {e}")
            return {
                'success': False,
                'message': f'连接测试失败: {str(e)}',
                'response_time': response_time
            }
    
    def query_knowledge(self, knowledge_config: Dict[str, Any], query_text: str) -> Dict[str, Any]:
        """查询Dify知识库"""
        start_time = time.time()
        
        try:
            external_kb_id = knowledge_config.get('external_kb_id')
            query_config = knowledge_config.get('query_config', {})
            
            if not external_kb_id:
                return self._format_error_result("缺少external_kb_id")
            
            # 构建查询请求 - 使用正确的Dify检索API端点
            url = f"{self.base_url}/v1/datasets/{external_kb_id}/retrieve"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            # 构建查询参数 - 只包含基本必需参数，其他参数由用户在前端配置
            retrieval_model = {
                'search_method': query_config.get('search_method', 'semantic_search'),
                'reranking_enable': query_config.get('reranking_enable', False),
                'top_k': query_config.get('top_k', 5),
                'score_threshold_enabled': query_config.get('score_threshold_enabled', False)
            }

            # 动态添加用户配置的其他参数
            optional_params = [
                'reranking_mode', 'reranking_model', 'weights',
                'score_threshold', 'reranking_provider_name', 'reranking_model_name'
            ]

            for param in optional_params:
                if param in query_config and query_config[param] is not None:
                    retrieval_model[param] = query_config[param]

            # 不再处理动态查询参数，只使用用户配置的额外参数

            payload = {
                'query': query_text,
                'retrieval_model': retrieval_model
            }
            
            response = self._make_request('POST', url, headers=headers, json=payload)
            end_time = time.time()
            query_time = end_time - start_time

            if response.status_code == 200:
                result_data = response.json()

                # 转换Dify结果格式为标准格式 - 根据新的API响应结构
                results = []
                if 'records' in result_data:
                    for record in result_data['records']:
                        segment = record.get('segment', {})
                        document = segment.get('document', {})
                        results.append({
                            'content': segment.get('content', ''),
                            'score': record.get('score', 0),
                            'metadata': {
                                'document_id': segment.get('document_id'),
                                'document_name': document.get('name'),
                                'document_type': document.get('doc_type'),
                                'segment_id': segment.get('id'),
                                'position': segment.get('position'),
                                'word_count': segment.get('word_count'),
                                'tokens': segment.get('tokens'),
                                'keywords': segment.get('keywords', []),
                                'hit_count': segment.get('hit_count'),
                                'status': segment.get('status'),
                                'created_at': segment.get('created_at'),
                                'indexing_at': segment.get('indexing_at'),
                                'completed_at': segment.get('completed_at'),
                                'tsne_position': record.get('tsne_position')
                            }
                        })

                return self._format_query_result({
                    'results': results,
                    'total_count': len(results),
                    'metadata': {
                        'query_content': result_data.get('query', {}).get('content'),
                        'dify_response': result_data
                    }
                }, query_time)
            else:
                error_msg = f"Dify API错误: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('message', '')}"
                except:
                    pass
                return self._format_error_result(error_msg, query_time)
                
        except Exception as e:
            end_time = time.time()
            query_time = end_time - start_time
            logger.error(f"Dify知识库查询失败: {e}")
            return self._format_error_result(f"查询失败: {str(e)}", query_time)
    
    def get_knowledge_info(self, external_kb_id: str) -> Dict[str, Any]:
        """获取Dify知识库信息"""
        try:
            url = f"{self.base_url}/v1/datasets/{external_kb_id}"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            response = self._make_request('GET', url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'info': {
                        'id': data.get('id'),
                        'name': data.get('name'),
                        'description': data.get('description'),
                        'provider': 'dify',
                        'document_count': data.get('document_count', 0),
                        'word_count': data.get('word_count', 0),
                        'created_at': data.get('created_at'),
                        'updated_at': data.get('updated_at'),
                        'indexing_technique': data.get('indexing_technique'),
                        'embedding_model': data.get('embedding_model'),
                        'embedding_model_provider': data.get('embedding_model_provider'),
                        'retrieval_model_dict': data.get('retrieval_model_dict', {}),
                        'tags': data.get('tags', [])
                    }
                }
            else:
                error_msg = f"获取知识库信息失败: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('message', '')}"
                except:
                    pass
                return {
                    'success': False,
                    'error_message': error_msg
                }
                
        except Exception as e:
            logger.error(f"获取Dify知识库信息失败: {e}")
            return {
                'success': False,
                'error_message': f"获取知识库信息失败: {str(e)}"
            }
    
    def list_datasets(self) -> Dict[str, Any]:
        """获取Dify数据集列表"""
        try:
            url = f"{self.base_url}/v1/datasets"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            response = self._make_request('GET', url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                datasets = []
                
                for item in data.get('data', []):
                    datasets.append({
                        'id': item.get('id'),
                        'name': item.get('name'),
                        'description': item.get('description'),
                        'document_count': item.get('document_count', 0),
                        'word_count': item.get('word_count', 0),
                        'created_at': item.get('created_at'),
                        'updated_at': item.get('updated_at')
                    })
                
                return {
                    'success': True,
                    'datasets': datasets,
                    'total': data.get('total', len(datasets)),
                    'page': data.get('page', 1),
                    'limit': data.get('limit', 20)
                }
            else:
                return {
                    'success': False,
                    'error_message': f"获取数据集列表失败: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"获取Dify数据集列表失败: {e}")
            return {
                'success': False,
                'error_message': f"获取数据集列表失败: {str(e)}"
            }
    
    def get_adapter_info(self) -> Dict[str, Any]:
        """获取Dify适配器信息"""
        info = super().get_adapter_info()
        info.update({
            'provider_type': 'dify',
            'supported_features': [
                'semantic_search',
                'keyword_search', 
                'hybrid_search',
                'reranking',
                'hit_testing'
            ],
            'api_version': 'v1'
        })
        return info
