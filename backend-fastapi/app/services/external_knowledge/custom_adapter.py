"""
自定义API知识库适配器

实现与自定义REST API的知识库集成
支持标准的REST API接口规范
"""

import time
import json
from typing import Dict, List, Any, Optional
from .base_adapter import ExternalKnowledgeAdapter
import logging

logger = logging.getLogger(__name__)

class CustomAdapter(ExternalKnowledgeAdapter):
    """自定义API知识库适配器"""
    
    def __init__(self, provider_config: Dict[str, Any]):
        super().__init__(provider_config)
        
        # 自定义API特定配置
        self.auth_type = self.config.get('auth_type', 'bearer')  # bearer, api_key, basic
        self.auth_header = self.config.get('auth_header', 'Authorization')
        self.query_endpoint = self.config.get('query_endpoint', '/api/v1/query')
        self.info_endpoint = self.config.get('info_endpoint', '/api/v1/info')
        self.test_endpoint = self.config.get('test_endpoint', '/api/v1/health')
        
    def test_connection(self) -> Dict[str, Any]:
        """测试自定义API连接"""
        start_time = time.time()
        
        try:
            # 验证必需配置
            if not self._validate_config([]):
                return {
                    'success': False,
                    'message': '配置验证失败',
                    'response_time': 0
                }
            
            # 测试API连接
            url = f"{self.base_url}{self.test_endpoint}"
            headers = self._build_auth_headers()
            
            response = self._make_request('GET', url, headers=headers)
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'message': '自定义API连接测试成功',
                    'response_time': response_time
                }
            else:
                return {
                    'success': False,
                    'message': f'自定义API返回错误: {response.status_code}',
                    'response_time': response_time
                }
                
        except Exception as e:
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000, 2)
            logger.error(f"自定义API连接测试失败: {e}")
            return {
                'success': False,
                'message': f'连接测试失败: {str(e)}',
                'response_time': response_time
            }
    
    def query_knowledge(self, knowledge_config: Dict[str, Any], query_text: str) -> Dict[str, Any]:
        """查询自定义API知识库"""
        start_time = time.time()
        
        try:
            external_kb_id = knowledge_config.get('external_kb_id')
            query_config = knowledge_config.get('query_config', {})
            
            if not external_kb_id:
                return self._format_error_result("缺少external_kb_id")
            
            # 构建查询请求
            url = f"{self.base_url}{self.query_endpoint}"
            headers = self._build_auth_headers()
            
            # 构建基本参数
            basic_params = {
                'top_k': 5,
                'similarity_threshold': 0.7,
                'max_tokens': 4000,
                'include_metadata': True
            }

            # 合并用户配置的额外参数
            final_params = {}
            final_params.update(basic_params)
            final_params.update(query_config)

            # 构建最终payload
            payload = {
                'knowledge_base_id': external_kb_id,
                'query': query_text,
                **final_params
            }
            
            response = self._make_request('POST', url, headers=headers, json=payload)
            end_time = time.time()
            query_time = end_time - start_time
            
            if response.status_code == 200:
                result_data = response.json()
                
                # 处理标准响应格式
                if self._is_standard_response(result_data):
                    return self._format_query_result(result_data, query_time)
                else:
                    # 尝试转换非标准格式
                    converted_result = self._convert_to_standard_format(result_data)
                    return self._format_query_result(converted_result, query_time)
                    
            else:
                error_msg = f"自定义API错误: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('message', error_data.get('error', ''))}"
                except:
                    pass
                return self._format_error_result(error_msg, query_time)
                
        except Exception as e:
            end_time = time.time()
            query_time = end_time - start_time
            logger.error(f"自定义API知识库查询失败: {e}")
            return self._format_error_result(f"查询失败: {str(e)}", query_time)
    
    def get_knowledge_info(self, external_kb_id: str) -> Dict[str, Any]:
        """获取自定义API知识库信息"""
        try:
            url = f"{self.base_url}{self.info_endpoint}"
            headers = self._build_auth_headers()
            
            # 支持两种方式：查询参数或路径参数
            if '{id}' in self.info_endpoint:
                url = url.replace('{id}', external_kb_id)
                response = self._make_request('GET', url, headers=headers)
            else:
                params = {'knowledge_base_id': external_kb_id}
                response = self._make_request('GET', url, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                
                # 处理标准信息格式
                if 'info' in data:
                    info = data['info']
                else:
                    info = data
                
                return {
                    'success': True,
                    'info': {
                        'id': info.get('id', external_kb_id),
                        'name': info.get('name', ''),
                        'description': info.get('description', ''),
                        'provider': 'custom',
                        'document_count': info.get('document_count', 0),
                        'chunk_count': info.get('chunk_count', 0),
                        'created_at': info.get('created_at'),
                        'updated_at': info.get('updated_at'),
                        'status': info.get('status', 'active'),
                        'metadata': info.get('metadata', {}),
                        'custom_fields': {k: v for k, v in info.items() 
                                        if k not in ['id', 'name', 'description', 'document_count', 
                                                   'chunk_count', 'created_at', 'updated_at', 'status', 'metadata']}
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
            logger.error(f"获取自定义API知识库信息失败: {e}")
            return {
                'success': False,
                'error_message': f"获取知识库信息失败: {str(e)}"
            }
    
    def _build_auth_headers(self) -> Dict[str, str]:
        """构建认证头"""
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'ABM-LLM-ExternalKnowledge/1.0'
        }
        
        if self.auth_type == 'bearer':
            headers[self.auth_header] = f'Bearer {self.api_key}'
        elif self.auth_type == 'api_key':
            headers[self.auth_header] = self.api_key
        elif self.auth_type == 'basic':
            import base64
            # 假设api_key格式为 "username:password"
            encoded = base64.b64encode(self.api_key.encode()).decode()
            headers[self.auth_header] = f'Basic {encoded}'
        
        return headers
    
    def _is_standard_response(self, data: Dict[str, Any]) -> bool:
        """检查是否为标准响应格式"""
        required_fields = ['results', 'total_count']
        return all(field in data for field in required_fields)
    
    def _convert_to_standard_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """将非标准格式转换为标准格式"""
        # 尝试识别常见的响应格式
        results = []
        total_count = 0
        
        # 格式1: {data: [{content, score}]}
        if 'data' in data and isinstance(data['data'], list):
            for item in data['data']:
                results.append({
                    'content': item.get('content', item.get('text', str(item))),
                    'score': item.get('score', item.get('similarity', 1.0)),
                    'metadata': {k: v for k, v in item.items() 
                               if k not in ['content', 'text', 'score', 'similarity']}
                })
            total_count = len(results)
        
        # 格式2: {items: [{text, relevance}]}
        elif 'items' in data and isinstance(data['items'], list):
            for item in data['items']:
                results.append({
                    'content': item.get('text', item.get('content', str(item))),
                    'score': item.get('relevance', item.get('score', 1.0)),
                    'metadata': {k: v for k, v in item.items() 
                               if k not in ['text', 'content', 'relevance', 'score']}
                })
            total_count = len(results)
        
        # 格式3: 直接是列表
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    results.append({
                        'content': item.get('content', item.get('text', str(item))),
                        'score': item.get('score', item.get('similarity', 1.0)),
                        'metadata': {k: v for k, v in item.items() 
                                   if k not in ['content', 'text', 'score', 'similarity']}
                    })
                else:
                    results.append({
                        'content': str(item),
                        'score': 1.0,
                        'metadata': {}
                    })
            total_count = len(results)
        
        # 格式4: 单个结果
        else:
            results.append({
                'content': data.get('content', data.get('text', str(data))),
                'score': data.get('score', data.get('similarity', 1.0)),
                'metadata': {k: v for k, v in data.items() 
                           if k not in ['content', 'text', 'score', 'similarity']}
            })
            total_count = 1
        
        return {
            'results': results,
            'total_count': total_count,
            'metadata': {
                'original_format': 'converted',
                'conversion_note': 'Converted from non-standard format'
            }
        }
    
    def get_adapter_info(self) -> Dict[str, Any]:
        """获取自定义适配器信息"""
        info = super().get_adapter_info()
        info.update({
            'provider_type': 'custom',
            'supported_features': [
                'custom_query',
                'flexible_auth',
                'format_conversion',
                'configurable_endpoints'
            ],
            'auth_type': self.auth_type,
            'endpoints': {
                'query': self.query_endpoint,
                'info': self.info_endpoint,
                'test': self.test_endpoint
            }
        })
        return info
