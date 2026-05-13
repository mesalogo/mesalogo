"""
FastGPT知识库适配器

实现与FastGPT平台的知识库API集成
"""

import time
import json
from typing import Dict, List, Any, Optional
from .base_adapter import ExternalKnowledgeAdapter
import logging

logger = logging.getLogger(__name__)

class FastGPTAdapter(ExternalKnowledgeAdapter):
    """FastGPT知识库适配器"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        super().__init__(provider_config)
        
        # FastGPT特定配置
        self.team_id = self.config.get('team_id', '')
        
    def test_connection(self) -> Dict[str, Any]:
        """测试FastGPT连接"""
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
            url = f"{self.base_url}/core/dataset/list"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            # 添加team_id参数（如果有）
            params = {}
            if self.team_id:
                params['teamId'] = self.team_id
            
            response = self._make_request('GET', url, headers=headers, params=params)
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'message': 'FastGPT连接测试成功',
                    'response_time': response_time
                }
            else:
                return {
                    'success': False,
                    'message': f'FastGPT API返回错误: {response.status_code}',
                    'response_time': response_time
                }
                
        except Exception as e:
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)
            logger.error(f"FastGPT连接测试失败: {e}")
            return {
                'success': False,
                'message': f'连接测试失败: {str(e)}',
                'response_time': response_time
            }

    def query_knowledge(self, knowledge_config: Dict[str, Any], query_text: str) -> Dict[str, Any]:
        """查询FastGPT知识库"""
        start_time = time.time()
        
        try:
            external_kb_id = knowledge_config.get('external_kb_id')
            query_config = knowledge_config.get('query_config', {})
            
            if not external_kb_id:
                return self._format_error_result("缺少external_kb_id")
            
            # 构建查询请求 - 使用正确的FastGPT搜索测试API
            url = f"{self.base_url}/core/dataset/searchTest"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            # 构建基本参数 - 根据FastGPT官方文档
            basic_params = {
                'limit': 5000,  # 最大tokens数量，默认5000
                'similarity': 0,  # 最低相关度(0~1)，默认0
                'searchMode': 'embedding',  # embedding, fullTextRecall, mixedRecall
                'usingReRank': False,  # 是否使用重排
                'datasetSearchUsingExtensionQuery': False,  # 是否使用问题优化
                'datasetSearchExtensionModel': '',  # 问题优化模型
                'datasetSearchExtensionBg': ''  # 问题优化背景描述
            }

            # 合并用户配置的额外参数
            final_params = {}
            final_params.update(basic_params)
            final_params.update(query_config)

            # 构建最终payload
            payload = {
                'datasetId': external_kb_id,
                'text': query_text,
                **final_params
            }
            
            response = self._make_request('POST', url, headers=headers, json=payload)
            end_time = time.time()
            query_time = end_time - start_time
            
            if response.status_code == 200:
                result_data = response.json()

                # 转换FastGPT结果格式为标准格式 - 基于实际返回格式
                results = []

                # 处理实际的FastGPT响应格式: {code: 200, data: {list: [...]}}
                if isinstance(result_data, dict) and result_data.get('code') == 200:
                    data_section = result_data.get('data', {})
                    if isinstance(data_section, dict) and 'list' in data_section:
                        for item in data_section['list']:
                            content = item.get('q', '')
                            if item.get('a'):
                                content += '\n' + item.get('a')

                            # 从实际测试看，FastGPT可能没有返回score字段，使用默认值
                            score = item.get('score', 0.0)
                            if isinstance(score, (int, float)):
                                score = float(score)
                            else:
                                score = 0.0

                            results.append({
                                'content': content,
                                'score': score,
                                'metadata': {
                                    'id': item.get('id'),
                                    'dataset_id': item.get('datasetId'),
                                    'collection_id': item.get('collectionId'),
                                    'source_name': item.get('sourceName'),
                                    'source_id': item.get('sourceId'),
                                    'question': item.get('q'),
                                    'answer': item.get('a'),
                                    'update_time': item.get('updateTime')
                                }
                            })

                return self._format_query_result({
                    'results': results,
                    'total_count': len(results),
                    'metadata': {
                        'search_mode': payload.get('searchMode'),
                        'using_rerank': payload.get('usingReRank'),
                        'fastgpt_response': result_data
                    }
                }, query_time)
            else:
                error_msg = f"FastGPT API错误: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('message', error_data.get('error', ''))}"
                except:
                    pass
                return self._format_error_result(error_msg, query_time)
                
        except Exception as e:
            end_time = time.time()
            query_time = end_time - start_time
            logger.error(f"FastGPT知识库查询失败: {e}")
            return self._format_error_result(f"查询失败: {str(e)}", query_time)
    
    def get_knowledge_info(self, external_kb_id: str) -> Dict[str, Any]:
        """获取FastGPT知识库信息"""
        try:
            url = f"{self.base_url}/api/core/dataset/detail"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            params = {'id': external_kb_id}
            if self.team_id:
                params['teamId'] = self.team_id
            
            response = self._make_request('GET', url, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'info': {
                        'id': data.get('_id'),
                        'name': data.get('name'),
                        'description': data.get('intro'),
                        'provider': 'fastgpt',
                        'vector_model': data.get('vectorModel', {}).get('model'),
                        'agent_model': data.get('agentModel', {}).get('model'),
                        'created_at': data.get('createTime'),
                        'updated_at': data.get('updateTime'),
                        'avatar': data.get('avatar'),
                        'type': data.get('type'),
                        'status': data.get('status'),
                        'team_id': data.get('teamId'),
                        'team_tags': data.get('teamTags', []),
                        'default_permission': data.get('defaultPermission'),
                        'websiteConfig': data.get('websiteConfig', {}),
                        'externalReadUrl': data.get('externalReadUrl')
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
            logger.error(f"获取FastGPT知识库信息失败: {e}")
            return {
                'success': False,
                'error_message': f"获取知识库信息失败: {str(e)}"
            }
    
    def list_datasets(self) -> Dict[str, Any]:
        """获取FastGPT数据集列表"""
        try:
            url = f"{self.base_url}/api/core/dataset/list"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            params = {}
            if self.team_id:
                params['teamId'] = self.team_id
            
            response = self._make_request('GET', url, headers=headers, params=params)
            
            if response.status_code == 200:
                result_data = response.json()
                datasets = []
                
                for item in result_data.get('data', []):
                    datasets.append({
                        'id': item.get('_id'),
                        'name': item.get('name'),
                        'description': item.get('intro'),
                        'vector_model': item.get('vectorModel', {}).get('model'),
                        'created_at': item.get('createTime'),
                        'updated_at': item.get('updateTime'),
                        'avatar': item.get('avatar'),
                        'type': item.get('type'),
                        'status': item.get('status'),
                        'team_id': item.get('teamId')
                    })
                
                return {
                    'success': True,
                    'datasets': datasets,
                    'total': len(datasets)
                }
            else:
                return {
                    'success': False,
                    'error_message': f"获取数据集列表失败: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"获取FastGPT数据集列表失败: {e}")
            return {
                'success': False,
                'error_message': f"获取数据集列表失败: {str(e)}"
            }
    
    def get_collection_list(self, dataset_id: str) -> Dict[str, Any]:
        """获取FastGPT知识库的集合列表"""
        try:
            url = f"{self.base_url}/api/core/dataset/collection/list"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            params = {
                'datasetId': dataset_id,
                'pageNum': 1,
                'pageSize': 100
            }
            if self.team_id:
                params['teamId'] = self.team_id
            
            response = self._make_request('GET', url, headers=headers, params=params)
            
            if response.status_code == 200:
                result_data = response.json()
                collections = []
                
                for item in result_data.get('data', []):
                    collections.append({
                        'id': item.get('_id'),
                        'name': item.get('name'),
                        'type': item.get('type'),
                        'create_time': item.get('createTime'),
                        'update_time': item.get('updateTime'),
                        'file_id': item.get('fileId'),
                        'raw_link': item.get('rawLink'),
                        'training_type': item.get('trainingType'),
                        'chunk_size': item.get('chunkSize'),
                        'chunk_splitter': item.get('chunkSplitter'),
                        'qa_prompt': item.get('qaPrompt')
                    })
                
                return {
                    'success': True,
                    'collections': collections,
                    'total': result_data.get('total', len(collections))
                }
            else:
                return {
                    'success': False,
                    'error_message': f"获取集合列表失败: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"获取FastGPT集合列表失败: {e}")
            return {
                'success': False,
                'error_message': f"获取集合列表失败: {str(e)}"
            }
    
    def get_adapter_info(self) -> Dict[str, Any]:
        """获取FastGPT适配器信息"""
        info = super().get_adapter_info()
        info.update({
            'provider_type': 'fastgpt',
            'supported_features': [
                'embedding_search',
                'full_text_recall',
                'mixed_recall',
                'rerank',
                'qa_split',
                'manual_input',
                'csv_import',
                'multimodal'
            ],
            'api_version': 'core'
        })
        return info
