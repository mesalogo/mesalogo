"""
Reranker服务 - 支持多种reranker模型
通过ModelConfig动态加载模型
"""

from typing import List, Dict, Optional
import logging
from app.models import ModelConfig, db

logger = logging.getLogger(__name__)

class RerankerService:
    """
    Reranker服务 - 支持多种reranker模型
    通过ModelConfig动态加载模型，支持本地模型（BGE/Jina）和API服务（Cohere）
    """
    
    _model_cache = {}  # 模型缓存 {model_id: reranker_instance}
    
    @classmethod
    def get_reranker(cls, model_config: ModelConfig):
        """
        根据ModelConfig获取或创建reranker实例（带缓存）
        支持两种模式：
        1. 有base_url: 通过OpenAI-compatible API调用
        2. 无base_url: 加载本地模型（HuggingFace）
        
        Args:
            model_config: 模型配置对象
            
        Returns:
            Reranker实例（字典，包含type和实例）
        """
        model_id = model_config.id
        
        # 检查缓存
        if model_id in cls._model_cache:
            logger.info(f"Using cached reranker: {model_config.name}")
            return cls._model_cache[model_id]
        
        model_name = model_config.model_id
        base_url = model_config.base_url
        additional_params = model_config.additional_params or {}
        
        logger.info(f"Loading reranker: {model_config.name} (model_id={model_name}, base_url={base_url or 'None(local)'})")
        
        try:
            if base_url:
                # API模式：通过OpenAI-compatible API调用
                # 返回配置信息，实际调用在rerank方法中
                reranker = {
                    'type': 'api',
                    'base_url': base_url,
                    'api_key': model_config.api_key,
                    'model_id': model_name
                }
                logger.info(f"Reranker configured for API mode: {base_url}")
            else:
                # 本地模式：加载HuggingFace模型
                from FlagEmbedding import FlagReranker
                reranker = {
                    'type': 'local',
                    'instance': FlagReranker(
                        model_name,
                        use_fp16=additional_params.get('use_fp16', True),
                        cache_dir='./models',
                        batch_size=additional_params.get('batch_size', 32)
                    )
                }
                logger.info(f"Reranker loaded as local model: {model_name}")
            
            # 缓存
            cls._model_cache[model_id] = reranker
            return reranker
            
        except Exception as e:
            logger.error(f"Failed to load reranker {model_config.name}: {str(e)}")
            raise
    
    @classmethod
    def rerank(cls, query: str, documents: List[Dict], model_id: str, top_n: int = 5) -> List[Dict]:
        """
        对文档进行重排序
        
        Args:
            query: 查询文本
            documents: 候选文档列表 [{content, similarity, ...}]
            model_id: Reranker模型ID（从ModelConfig表）
            top_n: 返回前N个结果
            
        Returns:
            重排序后的文档列表（包含rerank_score字段）
        """
        if not documents:
            return []
        
        # 获取模型配置
        model_config = ModelConfig.query.get(model_id)
        if not model_config:
            logger.error(f"Reranker model not found: {model_id}")
            return documents[:top_n]  # 降级处理
        
        # 检查模型是否支持rerank
        if 'rerank_output' not in (model_config.modalities or []):
            logger.error(f"Model {model_config.name} does not support reranking")
            return documents[:top_n]  # 降级处理
        
        try:
            # 获取reranker实例
            reranker = cls.get_reranker(model_config)
            
            logger.info(f"Reranking {len(documents)} documents with model {model_config.name}")
            
            if reranker['type'] == 'api':
                # API模式：调用OpenAI-compatible API
                scores = cls._rerank_with_api(
                    query, 
                    documents, 
                    reranker['base_url'],
                    reranker['api_key'],
                    reranker['model_id']
                )
            else:
                # 本地模式：使用FlagReranker
                pairs = [[query, doc['content']] for doc in documents]
                scores = reranker['instance'].compute_score(pairs, normalize=True)
            
            # 将分数添加到文档中
            for doc, score in zip(documents, scores):
                doc['rerank_score'] = float(score)
            
            # 按rerank_score降序排序
            reranked_docs = sorted(documents, key=lambda x: x['rerank_score'], reverse=True)
            
            logger.info(f"Reranking completed. Top score: {reranked_docs[0]['rerank_score']:.4f}, Bottom score: {reranked_docs[-1]['rerank_score']:.4f}")
            
            # 返回TopN
            return reranked_docs[:top_n]
            
        except Exception as e:
            logger.error(f"Reranker error: {str(e)}", exc_info=True)
            # 降级处理：返回原始排序的TopN
            logger.warning("Falling back to original ranking")
            return documents[:top_n]
    
    @classmethod
    def _rerank_with_api(cls, query: str, documents: List[Dict], base_url: str, api_key: str, model_id: str) -> List[float]:
        """
        通过OpenAI-compatible API调用rerank
        
        Args:
            query: 查询文本
            documents: 文档列表
            base_url: API base URL
            api_key: API key
            model_id: 模型ID
            
        Returns:
            分数列表
        """
        import requests
        
        # 构建API请求
        # 注意：直接在base_url后加/rerank，用户的base_url应该已经包含版本路径（如/v1）
        url = f"{base_url.rstrip('/')}/rerank"
        
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'model': model_id,
            'query': query,
            'documents': [doc['content'] for doc in documents]
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        # 假设返回格式: {"results": [{"index": 0, "relevance_score": 0.95}, ...]}
        scores = [0.0] * len(documents)
        for item in result.get('results', []):
            idx = item.get('index', 0)
            score = item.get('relevance_score', 0.0)
            if 0 <= idx < len(scores):
                scores[idx] = score
        
        return scores
