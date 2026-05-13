"""
嵌入模型服务

提供文本到向量的转换服务，集成现有的嵌入模型配置
"""

import logging
import time
import json
from typing import List, Dict, Any, Optional, Union, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SentenceTransformer = None
    SENTENCE_TRANSFORMERS_AVAILABLE = False

from app.models import ModelConfig
from app.services.conversation.model_client import ModelClient

logger = logging.getLogger(__name__)


class EmbeddingService:
    """嵌入模型服务"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._model_cache = {}  # 模型缓存
        self._model_client = ModelClient()
    
    def get_default_embedding_model(self) -> Optional[ModelConfig]:
        """获取默认嵌入模型配置"""
        try:
            # 查询默认嵌入模型
            default_model = ModelConfig.query.filter_by(is_default_embedding=True).first()
            
            if default_model:
                self.logger.debug(f"使用默认嵌入模型: {default_model.name}")
                return default_model
            
            # 如果没有默认模型，返回None（不再fallback到第一个）
            self.logger.warning("未配置默认嵌入模型")
            return None
            
        except Exception as e:
            self.logger.error(f"获取默认嵌入模型失败: {e}")
            return None
    
    def get_embedding_model_by_id(self, model_id: int) -> Optional[ModelConfig]:
        """根据ID获取嵌入模型配置"""
        try:
            model = ModelConfig.query.get(model_id)
            
            if not model:
                return None
            
            # 检查模型是否支持向量输出
            modalities = model.modalities or []
            if 'vector_output' not in modalities:
                self.logger.warning(f"模型 {model.name} 不支持向量输出")
                return None
            
            return model
            
        except Exception as e:
            self.logger.error(f"获取嵌入模型失败: {e}")
            return None
    
    def _load_sentence_transformer_model(self, model_id: str) -> Optional[Any]:
        """加载SentenceTransformer模型"""
        try:
            if not SENTENCE_TRANSFORMERS_AVAILABLE:
                raise ImportError("sentence-transformers库不可用")
            
            # 检查缓存
            if model_id in self._model_cache:
                return self._model_cache[model_id]
            
            # 加载模型
            self.logger.info(f"加载SentenceTransformer模型: {model_id}")
            model = SentenceTransformer(model_id, trust_remote_code=True)
            
            # 缓存模型
            self._model_cache[model_id] = model
            
            return model
            
        except Exception as e:
            self.logger.error(f"加载SentenceTransformer模型失败: {e}")
            return None
    
    def _generate_embeddings_with_sentence_transformer(
        self, 
        texts: List[str], 
        model_config: ModelConfig
    ) -> Tuple[bool, Union[List[List[float]], str]]:
        """使用SentenceTransformer生成嵌入向量"""
        try:
            model = self._load_sentence_transformer_model(model_config.model_id)
            if not model:
                return False, f"无法加载模型: {model_config.model_id}"
            
            # 生成嵌入向量
            embeddings = model.encode(texts, convert_to_tensor=False, show_progress_bar=False)
            
            # 转换为列表格式
            if isinstance(embeddings, np.ndarray):
                embeddings = embeddings.tolist()
            
            return True, embeddings
            
        except Exception as e:
            error_msg = f"SentenceTransformer生成嵌入向量失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def _generate_embeddings_with_api(
        self,
        texts: List[str],
        model_config: ModelConfig
    ) -> Tuple[bool, Union[List[List[float]], str]]:
        """使用API生成嵌入向量"""
        try:
            # 构建API请求
            provider = model_config.provider.lower()
            
            if provider == 'ollama':
                return self._generate_embeddings_ollama_api(texts, model_config)
            else:
                # 默认使用OpenAI兼容格式（大多数提供商都兼容）
                return self._generate_embeddings_openai_api(texts, model_config)

        except Exception as e:
            error_msg = f"API生成嵌入向量失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def _generate_embeddings_openai_api(
        self, 
        texts: List[str], 
        model_config: ModelConfig
    ) -> Tuple[bool, Union[List[List[float]], str]]:
        """使用OpenAI API生成嵌入向量"""
        try:
            import requests
            
            # 准备请求数据
            headers = {
                'Authorization': f'Bearer {model_config.api_key}',
                'Content-Type': 'application/json'
            }
            
            url = f"{model_config.base_url.rstrip('/')}/embeddings"
            
            # 阿里云 DashScope 限制 batch size 为 10
            is_dashscope = 'dashscope' in model_config.base_url.lower()
            batch_size = 10 if is_dashscope else len(texts)
            
            all_embeddings = []
            
            # 分批处理
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                
                data = {
                    'input': batch_texts,
                    'model': model_config.model_id
                }
                
                # 添加额外参数
                additional_params = model_config.additional_params or {}
                if 'dimensions' in additional_params:
                    data['dimensions'] = additional_params['dimensions']
                
                # 发送请求
                response = requests.post(
                    url, 
                    headers=headers, 
                    json=data, 
                    timeout=model_config.request_timeout or 30
                )
                
                if response.status_code != 200:
                    error_detail = f"API请求失败: {response.status_code} - {response.text}"
                    self.logger.error(error_detail)
                    return False, error_detail
                
                # 解析响应
                result = response.json()
                
                for item in result.get('data', []):
                    all_embeddings.append(item.get('embedding', []))
            
            if len(all_embeddings) != len(texts):
                return False, f"返回的嵌入向量数量不匹配: 期望{len(texts)}, 实际{len(all_embeddings)}"
            
            return True, all_embeddings
            
        except Exception as e:
            error_msg = f"OpenAI API生成嵌入向量失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg

    def _generate_embeddings_ollama_api(
        self,
        texts: List[str],
        model_config: ModelConfig
    ) -> Tuple[bool, Union[List[List[float]], str]]:
        """使用Ollama API生成嵌入向量"""
        try:
            import requests

            # 构建Ollama API URL
            base_url = model_config.base_url.rstrip('/')

            # 移除可能存在的/v1后缀，因为Ollama API不需要v1
            if base_url.endswith('/v1'):
                base_url = base_url[:-3]

            # 确保以/api结尾
            if not base_url.endswith('/api'):
                base_url = base_url + '/api'

            url = f"{base_url}/embed"

            self.logger.debug(f"Ollama API URL: {url}")
            self.logger.debug(f"使用模型: {model_config.model_id}")

            # 准备所有嵌入向量
            all_embeddings = []

            # Ollama API通常一次处理一个文本，所以我们逐个处理
            for text in texts:
                # 准备请求数据
                data = {
                    'model': model_config.model_id,
                    'input': text
                }

                # 准备请求头
                headers = {
                    'Content-Type': 'application/json'
                }

                # 如果有API密钥，添加到请求头
                if model_config.api_key:
                    headers['Authorization'] = f'Bearer {model_config.api_key}'

                # 发送请求
                response = requests.post(
                    url,
                    headers=headers,
                    json=data,
                    timeout=model_config.request_timeout or 30
                )

                if response.status_code != 200:
                    error_msg = f"Ollama API请求失败: HTTP {response.status_code}"
                    try:
                        error_detail = response.json()
                        if 'error' in error_detail:
                            error_msg += f" - {error_detail['error']}"
                    except:
                        error_msg += f" - {response.text}"

                    self.logger.error(error_msg)
                    return False, error_msg

                # 解析响应
                try:
                    result = response.json()

                    # Ollama API返回格式: {"embeddings": [vector]}
                    if 'embeddings' in result:
                        embeddings = result['embeddings']
                        if isinstance(embeddings, list) and len(embeddings) > 0:
                            # 取第一个嵌入向量
                            embedding = embeddings[0]
                            if isinstance(embedding, list):
                                all_embeddings.append(embedding)
                            else:
                                return False, f"Ollama API返回的嵌入向量格式不正确: {type(embedding)}"
                        else:
                            return False, "Ollama API返回的嵌入向量为空"
                    else:
                        return False, f"Ollama API响应中缺少embeddings字段: {result}"

                except json.JSONDecodeError as e:
                    return False, f"Ollama API响应JSON解析失败: {str(e)}"

            if len(all_embeddings) != len(texts):
                return False, f"嵌入向量数量不匹配: 期望{len(texts)}, 实际{len(all_embeddings)}"

            self.logger.debug(f"Ollama API成功生成{len(all_embeddings)}个嵌入向量")
            return True, all_embeddings

        except requests.exceptions.RequestException as e:
            error_msg = f"Ollama API网络请求失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"Ollama API生成嵌入向量失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg
    
    def generate_embeddings(
        self, 
        texts: Union[str, List[str]], 
        model_config: Optional[ModelConfig] = None
    ) -> Tuple[bool, Union[List[List[float]], str], Dict[str, Any]]:
        """
        生成嵌入向量
        
        Args:
            texts: 文本或文本列表
            model_config: 嵌入模型配置，如果为None则使用默认模型
            
        Returns:
            (成功标志, 嵌入向量列表或错误信息, 元信息)
        """
        try:
            start_time = time.time()
            
            # 标准化输入
            if isinstance(texts, str):
                texts = [texts]
            
            if not texts:
                return False, "文本列表不能为空", {}
            
            # 获取模型配置
            if model_config is None:
                model_config = self.get_default_embedding_model()
                if not model_config:
                    error_msg = "未配置默认嵌入模型，请在系统设置中配置默认的向量模型"
                    self.logger.error(error_msg)
                    return False, error_msg, {}
            
            # 根据提供商选择生成方法
            if model_config.provider.lower() == 'builtin':
                # 内置模型，使用SentenceTransformer
                success, result = self._generate_embeddings_with_sentence_transformer(texts, model_config)
            else:
                # 外部API模型
                success, result = self._generate_embeddings_with_api(texts, model_config)
            
            processing_time = time.time() - start_time
            
            # 构建元信息
            meta_info = {
                'model_name': model_config.name,
                'model_id': model_config.model_id,
                'provider': model_config.provider,
                'text_count': len(texts),
                'processing_time': round(processing_time, 3),
                'timestamp': time.time()
            }
            
            if success:
                # 添加向量维度信息
                if result and len(result) > 0:
                    meta_info['vector_dimension'] = len(result[0])
                
                self.logger.info(f"生成嵌入向量成功: {len(texts)}个文本, 用时{processing_time:.3f}秒")
            
            return success, result, meta_info
            
        except Exception as e:
            error_msg = f"生成嵌入向量失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def generate_single_embedding(
        self, 
        text: str, 
        model_config: Optional[ModelConfig] = None
    ) -> Tuple[bool, Union[List[float], str], Dict[str, Any]]:
        """
        生成单个文本的嵌入向量
        
        Args:
            text: 文本内容
            model_config: 嵌入模型配置
            
        Returns:
            (成功标志, 嵌入向量或错误信息, 元信息)
        """
        success, result, meta_info = self.generate_embeddings([text], model_config)
        
        if success and result:
            return True, result[0], meta_info
        else:
            return success, result, meta_info
    
    def batch_generate_embeddings(
        self, 
        texts: List[str], 
        model_config: Optional[ModelConfig] = None,
        batch_size: int = 32,
        max_workers: int = 4
    ) -> Tuple[bool, Union[List[List[float]], str], Dict[str, Any]]:
        """
        批量生成嵌入向量（支持并行处理）
        
        Args:
            texts: 文本列表
            model_config: 嵌入模型配置
            batch_size: 批处理大小
            max_workers: 最大并行工作线程数
            
        Returns:
            (成功标志, 嵌入向量列表或错误信息, 元信息)
        """
        try:
            start_time = time.time()
            
            if not texts:
                return False, "文本列表不能为空", {}
            
            # 获取模型配置
            if model_config is None:
                model_config = self.get_default_embedding_model()
                if not model_config:
                    error_msg = "未配置默认嵌入模型，请在系统设置中配置默认的向量模型"
                    self.logger.error(error_msg)
                    return False, error_msg, {}
            
            # 分批处理
            batches = [texts[i:i + batch_size] for i in range(0, len(texts), batch_size)]
            all_embeddings = []
            failed_batches = []
            
            # 并行处理批次
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_batch = {
                    executor.submit(self.generate_embeddings, batch, model_config): i 
                    for i, batch in enumerate(batches)
                }
                
                for future in as_completed(future_to_batch):
                    batch_idx = future_to_batch[future]
                    try:
                        success, result, _ = future.result()
                        if success:
                            all_embeddings.extend(result)
                        else:
                            failed_batches.append((batch_idx, result))
                    except Exception as e:
                        failed_batches.append((batch_idx, str(e)))
            
            processing_time = time.time() - start_time
            
            # 构建元信息
            meta_info = {
                'model_name': model_config.name,
                'model_id': model_config.model_id,
                'provider': model_config.provider,
                'total_texts': len(texts),
                'batch_count': len(batches),
                'batch_size': batch_size,
                'max_workers': max_workers,
                'processing_time': round(processing_time, 3),
                'failed_batches': len(failed_batches),
                'success_rate': round((len(batches) - len(failed_batches)) / len(batches) * 100, 2),
                'timestamp': time.time()
            }
            
            if all_embeddings:
                meta_info['vector_dimension'] = len(all_embeddings[0])
            
            if failed_batches:
                error_msg = f"部分批次处理失败: {failed_batches}"
                self.logger.warning(error_msg)
                meta_info['errors'] = failed_batches
                
                if len(failed_batches) == len(batches):
                    return False, "所有批次处理失败", meta_info
            
            self.logger.info(f"批量生成嵌入向量完成: {len(all_embeddings)}/{len(texts)}个成功, 用时{processing_time:.3f}秒")
            return True, all_embeddings, meta_info
            
        except Exception as e:
            error_msg = f"批量生成嵌入向量失败: {str(e)}"
            self.logger.error(error_msg)
            return False, error_msg, {}
    
    def get_model_info(self, model_config: ModelConfig) -> Dict[str, Any]:
        """获取模型信息"""
        try:
            info = {
                'id': model_config.id,
                'name': model_config.name,
                'model_id': model_config.model_id,
                'provider': model_config.provider,
                'modalities': model_config.modalities or [],
                'capabilities': model_config.capabilities or [],
                'additional_params': model_config.additional_params or {},
                'is_default_embedding': model_config.is_default_embedding
            }
            
            # 尝试获取向量维度
            additional_params = model_config.additional_params or {}
            if 'dimensions' in additional_params:
                info['vector_dimension'] = additional_params['dimensions']
            
            return info
            
        except Exception as e:
            self.logger.error(f"获取模型信息失败: {e}")
            return {}
    
    def clear_model_cache(self):
        """清理模型缓存"""
        self._model_cache.clear()
        self.logger.info("嵌入模型缓存已清理")


# 全局嵌入服务实例
embedding_service = EmbeddingService()
