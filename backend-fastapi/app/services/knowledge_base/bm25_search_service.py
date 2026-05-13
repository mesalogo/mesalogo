"""
BM25关键字检索服务
"""
import logging
from typing import List, Dict, Any, Tuple
import hanlp
from rank_bm25 import BM25Okapi
from app.models import KnowledgeFileChunk, KnowledgeDocument

logger = logging.getLogger(__name__)

# 初始化HanLP分词器（使用粗粒度分词，更好地识别专业术语）
try:
    _hanlp_tokenizer = hanlp.load(hanlp.pretrained.mtl.CLOSE_TOK_POS_NER_SRL_DEP_SDP_CON_ELECTRA_BASE_ZH)
    logger.info("HanLP分词器加载成功")
except Exception as e:
    logger.error(f"HanLP分词器加载失败: {e}")
    _hanlp_tokenizer = None


class BM25SearchService:
    """BM25关键字检索服务"""
    
    @staticmethod
    def search_knowledge(
        knowledge_id: str,
        query_text: str,
        top_k: int = 5,
        score_threshold: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        使用BM25算法搜索知识库
        
        Args:
            knowledge_id: 知识库ID
            query_text: 查询文本
            top_k: 返回结果数
            score_threshold: 分数阈值
            
        Returns:
            List[Dict]: 搜索结果列表
        """
        try:
            # 1. 从数据库加载所有chunk
            chunks = KnowledgeFileChunk.query.filter_by(
                knowledge_id=knowledge_id
            ).all()
            
            if not chunks:
                logger.warning(f"知识库 {knowledge_id} 没有文档块")
                return []
            
            logger.info(f"加载了 {len(chunks)} 个文档块进行BM25搜索")
            
            # 2. 分词（使用HanLP粗粒度分词，适合关键字检索）
            if _hanlp_tokenizer is None:
                logger.error("HanLP分词器未初始化，无法进行BM25搜索")
                return []
            
            # MTL模型返回字典格式，需要提取tok/coarse
            tokenized_corpus = []
            for chunk in chunks:
                result = _hanlp_tokenizer(chunk.content, tasks='tok/coarse')
                # 提取分词结果
                tokens = result.get('tok/coarse', []) if isinstance(result, dict) else result
                tokenized_corpus.append(tokens)
            
            query_result = _hanlp_tokenizer(query_text, tasks='tok/coarse')
            tokenized_query = query_result.get('tok/coarse', []) if isinstance(query_result, dict) else query_result
            
            logger.info(f"查询分词结果: {tokenized_query}")
            
            # 调试：检查查询词在文档中的分布
            query_word_counts = {}
            for word in tokenized_query:
                count = sum(1 for doc_tokens in tokenized_corpus if word in doc_tokens)
                query_word_counts[word] = count
            
            logger.info(f"查询词在文档中的分布: {query_word_counts}")
            
            # 3. 构建BM25索引
            bm25 = BM25Okapi(tokenized_corpus)
            
            # 4. 计算分数
            scores = bm25.get_scores(tokenized_query)
            
            # 5. 分数处理和归一化
            if len(scores) > 0:
                max_score = float(max(scores))
                min_score = float(min(scores))
                
                # 检查是否有匹配
                if max_score == 0.0:
                    logger.warning(
                        f"BM25搜索未找到匹配项！查询词: {tokenized_query}, "
                        f"文档数: {len(chunks)}. 可能原因: 1)文档不包含查询词 2)分词不一致"
                    )
                    # 保持原始分数（全0），不做归一化
                    normalized_scores = [float(s) for s in scores]
                else:
                    # 【优化】使用软上限归一化（对齐Weaviate等业界最佳实践）
                    # 除以最大值的1.5倍作为上限，这样：
                    # 1. 最高分约为0.67，避免总是100%
                    # 2. 保留分数区分度
                    # 3. 不同查询间分数更具可比性
                    normalization_ceiling = max_score * 1.5
                    
                    if normalization_ceiling > 0:
                        # 软上限归一化：score / (max * 1.5)
                        normalized_scores = [
                            min(float(score) / normalization_ceiling, 1.0)
                            for score in scores
                        ]
                        top_norm_score = max(normalized_scores)
                        logger.info(
                            f"BM25分数范围: {min_score:.4f} ~ {max_score:.4f}, "
                            f"软上限归一化后: 0 ~ {top_norm_score:.4f} "
                            f"(避免最高分总是1.0)"
                        )
                    else:
                        # 边界情况：所有分数相同且非零
                        normalized_scores = [0.6 for _ in scores]
                        logger.info(f"BM25所有文档得分相同: {max_score:.4f}, 统一设为 0.6")
            else:
                normalized_scores = []
                logger.warning("BM25返回空分数列表")
            
            # 排序
            chunk_scores = list(zip(chunks, normalized_scores))
            chunk_scores.sort(key=lambda x: x[1], reverse=True)
            
            # 记录top结果用于调试
            if chunk_scores:
                top_scores = [s for _, s in chunk_scores[:3]]
                logger.debug(f"BM25 Top3分数: {top_scores}")
            
            # 6. 格式化结果
            results = []
            for chunk, score in chunk_scores[:top_k]:
                if score < score_threshold:
                    continue
                
                # 获取文档信息
                document = KnowledgeDocument.query.get(chunk.document_id)
                    
                results.append({
                    'id': chunk.id,
                    'content': chunk.content,
                    'score': float(score),
                    'chunk_index': chunk.chunk_index,
                    'document_id': chunk.document_id,
                    'document_name': document.file_name if document else '未知文档',
                    'search_method': 'bm25',
                    'metadata': {
                        'document_id': chunk.document_id,
                        'document_name': document.file_name if document else '',
                        'chunk_index': chunk.chunk_index,
                        'file_path': document.file_path if document else '',
                    }
                })
            
            logger.info(f"BM25搜索完成，返回 {len(results)} 条结果")
            return results
            
        except Exception as e:
            logger.error(f"BM25搜索失败: {e}", exc_info=True)
            return []


def weighted_fusion(
    results_list: List[List[Dict[str, Any]]],
    vector_weight: float = 0.7
) -> List[Dict[str, Any]]:
    """
    加权融合算法：基于分数的加权融合
    
    Args:
        results_list: 多个检索结果列表 [[向量检索结果], [BM25检索结果]]
        vector_weight: 向量检索权重（0-1），BM25权重 = 1 - vector_weight
        
    Returns:
        融合后的结果列表
    """
    if not results_list:
        return []
    
    # 如果只有一个结果列表，直接返回
    if len(results_list) == 1:
        return results_list[0]
    
    # 收集所有唯一文档
    doc_scores = {}
    
    # 按检索方法分组并处理分数
    vector_results = {}
    bm25_results = {}
    
    for results in results_list:
        if not results:
            continue
        
        # 判断是哪种检索方法
        method = results[0].get('search_method', 'unknown')
        
        # 直接使用已归一化的分数（BM25搜索时已经归一化，向量检索本身就是0-1）
        for result in results:
            doc_id = result['id']
            score = result.get('score', 0.0)
            
            if method == 'vector':
                vector_results[doc_id] = {'result': result, 'score': score}
            elif method == 'bm25':
                bm25_results[doc_id] = {'result': result, 'score': score}
    
    # 计算加权融合分数
    all_doc_ids = set(vector_results.keys()) | set(bm25_results.keys())
    
    # 调试日志：记录融合前的数据
    logger.debug(
        f"融合分析: 向量{len(vector_results)}条, BM25{len(bm25_results)}条, "
        f"并集{len(all_doc_ids)}条, 交集{len(set(vector_results.keys()) & set(bm25_results.keys()))}条"
    )
    
    for doc_id in all_doc_ids:
        vector_score = vector_results.get(doc_id, {}).get('score', 0.0)
        bm25_score = bm25_results.get(doc_id, {}).get('score', 0.0)
        
        # 加权融合
        weighted_score = vector_weight * vector_score + (1 - vector_weight) * bm25_score
        
        # 使用优先级：向量检索结果 > BM25结果
        result_doc = vector_results.get(doc_id, {}).get('result') or bm25_results.get(doc_id, {}).get('result')
        
        if result_doc:
            doc_scores[doc_id] = {
                'doc': result_doc,
                'weighted_score': weighted_score,
                'vector_score': vector_score,
                'bm25_score': bm25_score
            }
    
    # 按加权分数排序
    sorted_docs = sorted(
        doc_scores.values(),
        key=lambda x: x['weighted_score'],
        reverse=True
    )
    
    # 格式化结果
    final_results = []
    for item in sorted_docs:
        result = item['doc'].copy()
        result['fusion_score'] = item['weighted_score']
        result['vector_score'] = item['vector_score']
        result['bm25_score'] = item['bm25_score']
        result['search_method'] = 'hybrid'
        final_results.append(result)
    
    logger.info(
        f"加权融合完成，融合了 {len(results_list)} 个结果列表，"
        f"权重配比: 向量={vector_weight:.0%} BM25={1-vector_weight:.0%}，"
        f"共 {len(final_results)} 条结果"
    )
    return final_results


def reciprocal_rank_fusion(
    results_list: List[List[Dict[str, Any]]],
    k: int = 60
) -> List[Dict[str, Any]]:
    """
    RRF（Reciprocal Rank Fusion）算法融合多个检索结果
    
    Args:
        results_list: 多个检索结果列表 [[结果1], [结果2], ...]
        k: RRF常数（通常取60）
        
    Returns:
        融合后的结果列表
    """
    if not results_list:
        return []
    
    # 如果只有一个结果列表，直接返回
    if len(results_list) == 1:
        return results_list[0]
    
    # 收集所有唯一文档
    doc_scores = {}
    
    for results in results_list:
        for rank, result in enumerate(results, start=1):
            doc_id = result['id']
            # RRF公式: 1 / (k + rank)
            rrf_score = 1.0 / (k + rank)
            
            if doc_id not in doc_scores:
                doc_scores[doc_id] = {
                    'doc': result,
                    'rrf_score': 0.0,
                    'original_scores': []
                }
            
            doc_scores[doc_id]['rrf_score'] += rrf_score
            doc_scores[doc_id]['original_scores'].append({
                'method': result.get('search_method', 'unknown'),
                'score': result.get('score', 0.0),
                'rank': rank
            })
    
    # 按RRF分数排序
    sorted_docs = sorted(
        doc_scores.values(),
        key=lambda x: x['rrf_score'],
        reverse=True
    )
    
    # 格式化结果
    final_results = []
    for item in sorted_docs:
        result = item['doc'].copy()
        result['fusion_score'] = item['rrf_score']
        result['original_scores'] = item['original_scores']
        result['search_method'] = 'hybrid'
        final_results.append(result)
    
    logger.info(f"RRF融合完成，融合了 {len(results_list)} 个结果列表，共 {len(final_results)} 条结果")
    return final_results
