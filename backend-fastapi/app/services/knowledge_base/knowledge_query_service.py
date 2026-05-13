"""
统一知识库查询服务

提供内部和外部知识库的统一查询入口
支持向量知识库和 LightRAG 知识库
"""

import time
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

from app.extensions import db
from app.models import (
    Role, Knowledge, RoleKnowledge, KnowledgeDocument, KnowledgeFileChunk
)
from app.services.vector_db_service import get_vector_db_service, get_collection_name
from app.services.external_knowledge import ExternalKnowledgeService
from app.services.knowledge_base.bm25_search_service import BM25SearchService, reciprocal_rank_fusion, weighted_fusion
from app.services.knowledge_base.reranker_service import RerankerService
from app.services.lightrag import LightRAGService, LightRAGConfigService


class KnowledgeQueryService:
    """统一知识库查询服务"""
    
    @staticmethod
    def query_knowledge_for_role(
        role_id: str, 
        query_text: str, 
        query_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        统一查询角色绑定的内部和外部知识库
        
        Args:
            role_id: 角色ID
            query_text: 查询文本
            query_params: 查询参数
                - max_results: 最大返回结果数（默认20）
                - top_k: 每个知识库返回的结果数（默认5）
                - score_threshold: 相似度阈值（默认0.0）
                
        Returns:
            Dict: 统一格式的查询结果
                - success: bool
                - results: List[Dict] 搜索结果列表
                - total_count: int 返回结果数量
                - query_time: float 查询耗时
                - metadata: Dict 查询元数据
        """
        start_time = time.time()
        
        if query_params is None:
            query_params = {}
        
        # 提取查询参数
        score_threshold = query_params.get('score_threshold', 0.0)
        knowledge_id = query_params.get('knowledge_id')  # 可选：指定查询的知识库ID
        # 注意：top_k 从每个知识库的配置中读取，不从参数传入
        # 最终返回结果数 = 所有知识库的 top_k 之和
        
        try:
            # 验证角色是否存在
            role = Role.query.get(role_id)
            if not role:
                return {
                    'success': False,
                    'error_message': f'角色不存在: {role_id}',
                    'results': [],
                    'total_count': 0,
                    'query_time': time.time() - start_time
                }
            
            # 1. 查询内部知识库
            internal_results, internal_kb_count = KnowledgeQueryService._query_internal_knowledges(
                role_id, query_text, score_threshold, knowledge_id
            )
            
            # 2. 查询外部知识库（如果没有指定knowledge_id，或knowledge_id不在内部知识库中）
            # 如果指定了knowledge_id且查到了内部知识库结果，就不查外部了
            if knowledge_id and internal_kb_count > 0:
                external_results, external_kb_count = [], 0
            else:
                external_results, external_kb_count = KnowledgeQueryService._query_external_knowledges(
                    role_id, query_text, query_params
                )
            
            # 3. 合并结果
            all_results = internal_results + external_results
            
            logger.info(
                f"知识库查询完成 - 角色: {role.name}, "
                f"内部: {internal_kb_count}个/{len(internal_results)}条, "
                f"外部: {external_kb_count}个/{len(external_results)}条"
            )
            
            # 4. 按相关度排序（使用relevance_score，内部知识库必须有此字段）
            all_results.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
            
            end_time = time.time()
            
            return {
                'success': True,
                'results': all_results,
                'total_count': len(all_results),
                'query_time': end_time - start_time,
                'queried_knowledge_bases': internal_kb_count + external_kb_count,
                'metadata': {
                    'role_id': role_id,
                    'role_name': role.name,
                    'query_text': query_text,
                    'internal_knowledge_bases': internal_kb_count,
                    'external_knowledge_bases': external_kb_count,
                    'query_params': {
                        'score_threshold': score_threshold
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"统一知识库查询失败: {e}", exc_info=True)
            return {
                'success': False,
                'error_message': f'查询失败: {str(e)}',
                'results': [],
                'total_count': 0,
                'query_time': time.time() - start_time
            }
    
    @staticmethod
    def _query_internal_knowledges(
        role_id: str,
        query_text: str,
        score_threshold: float = 0.0,
        knowledge_id: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """查询角色绑定的内部知识库（支持向量和 LightRAG 两种类型）"""
        try:
            # 获取角色绑定的内部知识库
            query = db.session.query(RoleKnowledge, Knowledge).join(
                Knowledge, RoleKnowledge.knowledge_id == Knowledge.id
            ).filter(RoleKnowledge.role_id == role_id)
            
            # 如果指定了knowledge_id，只查询该知识库
            if knowledge_id:
                query = query.filter(Knowledge.id == knowledge_id)
            
            bindings = query.all()
            
            if not bindings:
                return [], 0
            
            # 分离向量知识库和 LightRAG 知识库
            vector_knowledges = []
            lightrag_knowledges = []
            
            for binding, knowledge in bindings:
                kb_type = knowledge.kb_type or 'vector'
                if kb_type == 'lightrag':
                    lightrag_knowledges.append((binding, knowledge))
                else:
                    vector_knowledges.append((binding, knowledge))
            
            all_results = []
            
            # 1. 查询向量知识库
            if vector_knowledges:
                vector_db_service = get_vector_db_service()
                if vector_db_service.is_available():
                    for binding, knowledge in vector_knowledges:
                        try:
                            results = KnowledgeQueryService._search_single_knowledge(
                                knowledge, query_text, score_threshold, vector_db_service
                            )
                            all_results.extend(results)
                        except Exception as e:
                            logger.error(f"查询向量知识库 {knowledge.name} 失败: {e}")
                else:
                    logger.warning("向量数据库服务不可用")
            
            # 2. 查询 LightRAG 知识库
            if lightrag_knowledges:
                for binding, knowledge in lightrag_knowledges:
                    try:
                        results = KnowledgeQueryService._search_lightrag_knowledge(
                            knowledge, query_text
                        )
                        all_results.extend(results)
                    except Exception as e:
                        logger.error(f"查询 LightRAG 知识库 {knowledge.name} 失败: {e}")
            
            return all_results, len(bindings)
        except Exception as e:
            logger.error(f"查询内部知识库失败: {e}")
            return [], 0
    
    @staticmethod
    def _search_single_knowledge(
        knowledge: Knowledge,
        query_text: str,
        score_threshold: float,
        vector_db_service
    ) -> List[Dict[str, Any]]:
        """搜索单个知识库并格式化结果（支持混合检索）"""
        
        # 从知识库配置获取检索参数
        search_config = knowledge.get_search_config()
        top_k = search_config.get('top_k', 5)
        search_mode = search_config.get('search_mode', 'vector')
        logger.info(f"知识库 {knowledge.name} 使用检索模式: {search_mode}, top_k: {top_k}")
        
        results_list = []
        
        # 1. 向量检索
        if search_mode in ['vector', 'hybrid']:
            kb_collection_name = get_collection_name(knowledge.id)
            success, search_results, _ = vector_db_service.search(
                kb_collection_name, query_text, top_k
            )
            
            if success:
                vector_results = []
                for result in search_results:
                    score = result.get('score', 0.0)
                    if score < score_threshold:
                        continue
                    
                    result['search_method'] = 'vector'
                    formatted = KnowledgeQueryService._format_internal_result(result, knowledge)
                    if formatted:
                        vector_results.append(formatted)
                
                if vector_results:
                    logger.info(f"向量检索返回 {len(vector_results)} 条结果")
                    results_list.append(vector_results)
        
        # 2. BM25检索
        if search_mode in ['bm25', 'hybrid']:
            bm25_results = BM25SearchService.search_knowledge(
                knowledge.id, query_text, top_k, score_threshold
            )
            
            if bm25_results:
                # BM25结果已经格式化，添加knowledge_source信息
                for result in bm25_results:
                    result['knowledge_source'] = {
                        'type': 'internal',
                        'knowledge_id': knowledge.id,
                        'knowledge_name': knowledge.name
                    }
                
                logger.info(f"BM25检索返回 {len(bm25_results)} 条结果")
                results_list.append(bm25_results)
        
        # 3. 结果融合
        if search_mode == 'hybrid' and len(results_list) > 1:
            fusion_method = search_config.get('fusion_method', 'weighted')
            
            if fusion_method == 'weighted':
                # 使用加权融合
                vector_weight = search_config.get('vector_weight', 0.7)
                final_results = weighted_fusion(results_list, vector_weight=vector_weight)
                logger.info(
                    f"加权融合返回 {len(final_results)} 条结果 "
                    f"(向量权重: {vector_weight:.0%})"
                )
            else:
                # 使用RRF融合
                rrf_k = search_config.get('rrf_k', 60)
                final_results = reciprocal_rank_fusion(results_list, k=rrf_k)
                logger.info(f"RRF融合返回 {len(final_results)} 条结果")
            
            # 4. 可选Reranker重排序
            enable_reranker = search_config.get('enable_reranker', False)
            reranker_model_id = search_config.get('reranker_model_id')
            
            # 校验：如果启用Reranker但未配置模型ID，记录警告并跳过
            if enable_reranker and not reranker_model_id:
                logger.warning(
                    f"Reranker已启用但未配置模型ID，跳过重排序（知识库ID: {knowledge.id}）"
                )
            
            if enable_reranker and reranker_model_id and final_results:
                try:
                    # 候选文档数量 = top_k * 2
                    candidate_multiplier = 2
                    candidates = final_results[:top_k * candidate_multiplier]
                    
                    logger.info(
                        f"启用Reranker: 从{len(candidates)}个候选中选择Top{top_k}"
                    )
                    
                    # 使用Reranker重排序，输出数量等于top_k
                    reranked_results = RerankerService.rerank(
                        query=query_text,
                        documents=candidates,
                        model_id=reranker_model_id,
                        top_n=top_k
                    )
                    
                    # 更新search_method标签
                    for doc in reranked_results:
                        original_method = doc.get('search_method', '混合检索')
                        doc['search_method'] = f"{original_method}+Reranker"
                    
                    return reranked_results
                    
                except Exception as e:
                    logger.error(f"Reranker failed: {str(e)}")
                    raise
            
            return final_results[:top_k]
        elif results_list:
            # 单一检索模式或只有一个结果列表
            single_results = results_list[0] if results_list else []
            
            # 5. 单一检索模式也可能使用Reranker
            enable_reranker = search_config.get('enable_reranker', False)
            reranker_model_id = search_config.get('reranker_model_id')
            
            # 校验：如果启用Reranker但未配置模型ID，记录警告并跳过
            if enable_reranker and not reranker_model_id:
                logger.warning(
                    f"Reranker已启用但未配置模型ID，跳过重排序（知识库ID: {knowledge.id}）"
                )
            
            if enable_reranker and reranker_model_id and single_results:
                try:
                    candidate_multiplier = 2
                    candidates = single_results[:top_k * candidate_multiplier]
                    
                    logger.info(
                        f"启用Reranker (单一检索): 从{len(candidates)}个候选中选择Top{top_k}"
                    )
                    
                    reranked_results = RerankerService.rerank(
                        query=query_text,
                        documents=candidates,
                        model_id=reranker_model_id,
                        top_n=top_k
                    )
                    
                    # 更新search_method标签
                    for doc in reranked_results:
                        original_method = doc.get('search_method', search_mode)
                        doc['search_method'] = f"{original_method}+Reranker"
                    
                    return reranked_results
                    
                except Exception as e:
                    logger.error(f"Reranker failed: {str(e)}")
                    raise
            
            return single_results[:top_k]
        
        return []
    
    @staticmethod
    def _format_internal_result(result: Dict[str, Any], knowledge: Knowledge) -> Optional[Dict[str, Any]]:
        """格式化内部知识库搜索结果"""
        chunk_id = result.get('id', '')
        chunk = KnowledgeFileChunk.query.filter_by(id=chunk_id).first()
        
        # 计算统一的相关度分数（优先级：rerank_score > fusion_score > score）
        relevance_score = result.get('rerank_score')
        if relevance_score is not None:
            # Rerank分数在0-1范围，转换为0-100
            relevance_score = relevance_score * 100
        else:
            # 使用fusion_score或原始score
            relevance_score = result.get('fusion_score') or result.get('score', 0.0)
        
        if not chunk:
            # chunk不存在，跳过此结果
            return None
        
        document = KnowledgeDocument.query.get(chunk.document_id)
        formatted_result = {
            'id': chunk_id,
            'content': chunk.content,
            'relevance_score': relevance_score,  # 统一的相关度分数（0-100）
            'chunk_index': chunk.chunk_index,
            'document_id': chunk.document_id,
            'document_name': document.file_name if document else '未知文档',
            'source': document.file_name if document else '',
            'knowledge_source': {
                'type': 'internal',
                'knowledge_id': knowledge.id,
                'knowledge_name': knowledge.name
            }
        }
        # 保留search_method和score等元数据（用于融合判断）
        for key in ['search_method', 'score', 'fusion_score', 'vector_score', 'bm25_score']:
            if key in result:
                formatted_result[key] = result[key]
        
        return formatted_result
    
    @staticmethod
    def _search_lightrag_knowledge(
        knowledge: Knowledge,
        query_text: str
    ) -> List[Dict[str, Any]]:
        """
        搜索 LightRAG 知识库
        
        Args:
            knowledge: 知识库对象
            query_text: 查询文本
            
        Returns:
            格式化的搜索结果列表
        """
        try:
            # 获取 LightRAG 查询配置
            lightrag_config = knowledge.get_lightrag_search_config()
            mode = lightrag_config.get('query_mode', 'hybrid')
            top_k = lightrag_config.get('top_k', 10)
            response_type = lightrag_config.get('response_type', 'Multiple Paragraphs')
            
            # 获取 workspace
            workspace = knowledge.lightrag_workspace or knowledge.id
            
            # 获取 LightRAG 服务配置
            config = LightRAGConfigService.get_lightrag_config()
            if not config or not config.enabled:
                logger.warning(f"LightRAG 服务未启用，跳过知识库 {knowledge.name}")
                return []
            
            service_url = LightRAGConfigService.DEFAULT_SERVICE_URL
            if config.framework_config:
                service_url = config.framework_config.get('service_url', service_url)
            
            # 创建服务实例并查询
            service = LightRAGService(service_url)
            success, result = service.query(
                query=query_text,
                workspace=workspace,
                mode=mode,
                top_k=top_k,
                response_type=response_type
            )
            
            if not success:
                logger.error(f"LightRAG 查询失败: {result}")
                return []
            
            logger.info(
                f"LightRAG 知识库 {knowledge.name} 查询成功, mode={mode}, workspace={workspace}"
            )
            
            # 格式化结果
            # LightRAG 返回的是生成式回答，需要转换为统一格式
            formatted_results = []
            
            # LightRAG 返回格式可能是字符串或字典
            if isinstance(result, str):
                # 直接返回文本结果
                formatted_results.append({
                    'id': f"lightrag_{knowledge.id}_{hash(query_text) % 10000}",
                    'content': result,
                    'relevance_score': 100.0,  # LightRAG 不返回分数，默认最高
                    'document_name': f'LightRAG ({mode})',
                    'source': f'LightRAG/{workspace}',
                    'search_method': f'lightrag_{mode}',
                    'knowledge_source': {
                        'type': 'lightrag',
                        'knowledge_id': knowledge.id,
                        'knowledge_name': knowledge.name,
                        'workspace': workspace,
                        'query_mode': mode
                    }
                })
            elif isinstance(result, dict):
                # 处理字典格式的返回
                response_text = result.get('response', result.get('result', str(result)))
                references = result.get('references', [])
                
                # 构建引用信息
                reference_files = []
                if references:
                    reference_files = [ref.get('file_path', '') for ref in references if ref.get('file_path')]
                
                formatted_results.append({
                    'id': f"lightrag_{knowledge.id}_{hash(query_text) % 10000}",
                    'content': response_text,
                    'relevance_score': 100.0,
                    'document_name': f'LightRAG ({mode})',
                    'source': f'LightRAG/{workspace}',
                    'search_method': f'lightrag_{mode}',
                    'references': reference_files,  # 添加引用文件列表
                    'knowledge_source': {
                        'type': 'lightrag',
                        'knowledge_id': knowledge.id,
                        'knowledge_name': knowledge.name,
                        'workspace': workspace,
                        'query_mode': mode
                    }
                })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"LightRAG 知识库查询异常: {e}", exc_info=True)
            return []
    
    @staticmethod
    def _query_external_knowledges(
        role_id: str,
        query_text: str,
        query_params: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """查询角色绑定的外部知识库"""
        try:
            external_result = ExternalKnowledgeService.query_knowledge_for_role(
                role_id, query_text, query_params
            )
            
            if not external_result.get('success'):
                return [], 0
            
            return external_result.get('results', []), external_result.get('queried_knowledge_bases', 0)
        except Exception as e:
            logger.error(f"查询外部知识库失败: {e}")
            return [], 0
