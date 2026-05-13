"""
RagFlow知识库适配器

实现与RagFlow平台的知识库API集成
"""

import time
import json
from typing import Dict, List, Any, Optional
from .base_adapter import ExternalKnowledgeAdapter
import logging

logger = logging.getLogger(__name__)

class RagFlowAdapter(ExternalKnowledgeAdapter):
    """RagFlow知识库适配器"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        super().__init__(provider_config)
        
        # RagFlow特定配置
        self.user_id = self.config.get('user_id', '')
        
    def test_connection(self) -> Dict[str, Any]:
        """测试RagFlow连接"""
        start_time = time.time()

        try:
            # 验证必需配置
            if not self._validate_config([]):
                return {
                    'success': False,
                    'message': '配置验证失败',
                    'response_time': 0
                }

            # 测试API连接 - 获取知识库列表
            url = f"{self.base_url}/api/v1/datasets"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            # 添加查询参数
            params = {
                'page': 1,
                'page_size': 1  # 只获取一个结果用于测试
            }

            response = self._make_request('GET', url, headers=headers, params=params)
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)

            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get('code') == 0:
                        return {
                            'success': True,
                            'message': 'RagFlow连接测试成功',
                            'response_time': response_time
                        }
                    else:
                        return {
                            'success': False,
                            'message': f'RagFlow API返回错误: {data.get("message", "未知错误")}',
                            'response_time': response_time
                        }
                except:
                    return {
                        'success': False,
                        'message': f'RagFlow API响应格式错误: {response.status_code}',
                        'response_time': response_time
                    }
            else:
                return {
                    'success': False,
                    'message': f'RagFlow API返回HTTP错误: {response.status_code}',
                    'response_time': response_time
                }

        except Exception as e:
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)
            logger.error(f"RagFlow连接测试失败: {e}")
            return {
                'success': False,
                'message': f'连接测试失败: {str(e)}',
                'response_time': response_time
            }
    
    def query_knowledge(self, knowledge_config: Dict[str, Any], query_text: str) -> Dict[str, Any]:
        """查询RagFlow知识库 - 使用chunks检索API"""
        start_time = time.time()

        try:
            external_kb_id = knowledge_config.get('external_kb_id')
            query_config = knowledge_config.get('query_config', {})

            if not external_kb_id:
                return self._format_error_result("缺少external_kb_id")

            # 使用RagFlow的正确检索API
            url = f"{self.base_url}/api/v1/retrieval"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            # 构建基础查询参数
            payload = {
                'question': query_text,
                'dataset_ids': [external_kb_id],  # 数据集ID数组
            }

            # 构建基本参数，然后合并用户配置的额外参数
            basic_params = {
                'top_k': 5,
                'similarity_threshold': 0.7,
                'vector_similarity_weight': 0.3,
                'keywords_similarity_weight': 0.7,
                'rerank': True
            }

            # 合并用户配置的额外参数（覆盖基本参数）
            final_params = {}
            final_params.update(basic_params)    # 基本参数
            final_params.update(query_config)    # 用户配置的额外参数

            # 合并到payload
            payload.update(final_params)

            response = self._make_request('POST', url, headers=headers, json=payload)
            end_time = time.time()
            query_time = end_time - start_time

            if response.status_code == 200:
                result_data = response.json()

                # 检查RagFlow响应格式 - 根据官方文档
                if result_data.get('code') == 0:
                    # 转换RagFlow结果格式为标准格式
                    results = []
                    chunks = result_data.get('data', {}).get('chunks', [])

                    for chunk in chunks:
                        results.append({
                            'content': chunk.get('content_with_weight', chunk.get('content', '')),
                            'score': chunk.get('similarity', 0),
                            'metadata': {
                                'chunk_id': chunk.get('id'),
                                'document_id': chunk.get('document_id'),
                                'document_name': chunk.get('document_name'),
                                'dataset_id': chunk.get('dataset_id'),
                                'vector_similarity': chunk.get('vector_similarity'),
                                'term_similarity': chunk.get('term_similarity'),
                                'positions': chunk.get('positions', []),
                                'image_id': chunk.get('image_id', ''),
                                'important_keywords': chunk.get('important_kwd', [])
                            }
                        })

                    return self._format_query_result({
                        'results': results,
                        'total_count': len(results),
                        'metadata': {
                            'total_chunks': result_data.get('data', {}).get('total', len(results)),
                            'doc_aggs': result_data.get('data', {}).get('doc_aggs', []),
                            'ragflow_response': result_data
                        }
                    }, query_time)
                else:
                    error_msg = f"RagFlow API返回错误: {result_data.get('message', '未知错误')}"
                    return self._format_error_result(error_msg, query_time)
            else:
                error_msg = f"RagFlow API HTTP错误: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('message', error_data.get('error', ''))}"
                except:
                    pass
                return self._format_error_result(error_msg, query_time)

        except Exception as e:
            end_time = time.time()
            query_time = end_time - start_time
            logger.error(f"RagFlow知识库查询失败: {e}")
            return self._format_error_result(f"查询失败: {str(e)}", query_time)
    
    def get_knowledge_info(self, external_kb_id: str) -> Dict[str, Any]:
        """获取RagFlow知识库信息"""
        try:
            url = f"{self.base_url}/api/v1/datasets/{external_kb_id}"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            response = self._make_request('GET', url, headers=headers)
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                return {
                    'success': True,
                    'info': {
                        'id': data.get('id'),
                        'name': data.get('name'),
                        'description': data.get('description'),
                        'provider': 'ragflow',
                        'chunk_count': data.get('chunk_num', 0),
                        'document_count': data.get('document_num', 0),
                        'token_count': data.get('token_num', 0),
                        'created_at': data.get('create_time'),
                        'updated_at': data.get('update_time'),
                        'language': data.get('language'),
                        'embedding_model': data.get('embd_id'),
                        'parser_config': data.get('parser_config', {}),
                        'avatar': data.get('avatar'),
                        'tenant_id': data.get('tenant_id')
                    }
                }
            else:
                error_msg = f"获取知识库信息失败: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('message', error_data.get('error', ''))}"
                except:
                    pass
                return {
                    'success': False,
                    'error_message': error_msg
                }
                
        except Exception as e:
            logger.error(f"获取RagFlow知识库信息失败: {e}")
            return {
                'success': False,
                'error_message': f"获取知识库信息失败: {str(e)}"
            }
    
    def list_datasets(self) -> Dict[str, Any]:
        """获取RagFlow数据集列表"""
        try:
            url = f"{self.base_url}/api/v1/datasets"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            # 支持分页参数
            params = {
                'page': 1,
                'page_size': 100
            }

            response = self._make_request('GET', url, headers=headers, params=params)

            if response.status_code == 200:
                result_data = response.json()

                # 检查RagFlow响应格式
                if result_data.get('code') == 0:
                    datasets = []

                    for item in result_data.get('data', []):
                        datasets.append({
                            'id': item.get('id'),
                            'name': item.get('name'),
                            'description': item.get('description'),
                            'chunk_count': item.get('chunk_count', 0),
                            'document_count': item.get('document_count', 0),
                            'token_count': item.get('token_num', 0),
                            'created_at': item.get('create_date'),
                            'updated_at': item.get('update_date'),
                            'language': item.get('language'),
                            'embedding_model': item.get('embedding_model'),
                            'chunk_method': item.get('chunk_method'),
                            'status': item.get('status')
                        })

                    return {
                        'success': True,
                        'datasets': datasets,
                        'total': len(datasets)
                    }
                else:
                    return {
                        'success': False,
                        'error_message': f"RagFlow API返回错误: {result_data.get('message', '未知错误')}"
                    }
            else:
                return {
                    'success': False,
                    'error_message': f"获取数据集列表失败: HTTP {response.status_code}"
                }

        except Exception as e:
            logger.error(f"获取RagFlow数据集列表失败: {e}")
            return {
                'success': False,
                'error_message': f"获取数据集列表失败: {str(e)}"
            }
    
    def create_conversation(self, dataset_id: str, name: str = None) -> Dict[str, Any]:
        """创建RagFlow对话会话"""
        try:
            url = f"{self.base_url}/api/v1/conversations"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'name': name or f"Conversation_{int(time.time())}",
                'dataset_ids': [dataset_id]
            }
            
            response = self._make_request('POST', url, headers=headers, json=payload)
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                return {
                    'success': True,
                    'conversation_id': data.get('id'),
                    'name': data.get('name')
                }
            else:
                return {
                    'success': False,
                    'error_message': f"创建对话失败: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"创建RagFlow对话失败: {e}")
            return {
                'success': False,
                'error_message': f"创建对话失败: {str(e)}"
            }
    
    def get_adapter_info(self) -> Dict[str, Any]:
        """获取RagFlow适配器信息"""
        info = super().get_adapter_info()
        info.update({
            'provider_type': 'ragflow',
            'supported_features': [
                'vector_search',
                'keyword_search',
                'hybrid_search',
                'reranking',
                'conversation',
                'knowledge_graph'
            ],
            'api_version': 'v1'
        })
        return info
