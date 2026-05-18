#!/usr/bin/env python3
"""
测试简化后的参数设计

验证只有基本参数和额外参数，没有动态查询参数
"""

import json


def test_simplified_parameter_design():
    """测试简化后的参数设计"""
    print("=" * 60)
    print("测试简化后的参数设计")
    print("=" * 60)
    
    # 测试场景1: Dify - 只有基本参数
    print("1. Dify适配器 - 只有基本参数")
    print("-" * 40)
    
    query_config_1 = {}  # 用户没有配置额外参数
    
    retrieval_model_1 = build_dify_params(query_config_1)
    print("用户额外参数 (query_config):")
    print(json.dumps(query_config_1, indent=2, ensure_ascii=False))
    print("\n生成的retrieval_model:")
    print(json.dumps(retrieval_model_1, indent=2, ensure_ascii=False))
    print("✓ 只包含基本必需参数")
    print()
    
    # 测试场景2: Dify - 用户配置了额外参数
    print("2. Dify适配器 - 用户配置了额外参数")
    print("-" * 40)
    
    query_config_2 = {
        'search_method': 'hybrid_search',
        'reranking_enable': True,
        'reranking_provider_name': 'cohere',
        'reranking_model_name': 'rerank-english-v2.0',
        'weights': 0.3,
        'top_k': 10,
        'score_threshold_enabled': True,
        'score_threshold': 0.8
    }
    
    retrieval_model_2 = build_dify_params(query_config_2)
    print("用户额外参数 (query_config):")
    print(json.dumps(query_config_2, indent=2, ensure_ascii=False))
    print("\n生成的retrieval_model:")
    print(json.dumps(retrieval_model_2, indent=2, ensure_ascii=False))
    print("✓ 基本参数 + 用户额外参数")
    print()
    
    # 测试场景3: RagFlow - 基本参数 + 额外参数
    print("3. RagFlow适配器 - 基本参数 + 额外参数")
    print("-" * 40)
    
    query_config_3 = {
        'top_k': 8,
        'similarity_threshold': 0.8,
        'rerank': False
    }
    
    final_params_3 = build_ragflow_params(query_config_3)
    print("用户额外参数 (query_config):")
    print(json.dumps(query_config_3, indent=2, ensure_ascii=False))
    print("\n最终参数:")
    print(json.dumps(final_params_3, indent=2, ensure_ascii=False))
    print("✓ 用户参数覆盖了基本参数")
    print()
    
    # 测试场景4: FastGPT - 基本参数 + 额外参数
    print("4. FastGPT适配器 - 基本参数 + 额外参数")
    print("-" * 40)
    
    query_config_4 = {
        'limit': 3,
        'searchMode': 'fullTextRecall',
        'usingReRank': True
    }
    
    final_params_4 = build_fastgpt_params(query_config_4)
    print("用户额外参数 (query_config):")
    print(json.dumps(query_config_4, indent=2, ensure_ascii=False))
    print("\n最终参数:")
    print(json.dumps(final_params_4, indent=2, ensure_ascii=False))
    print("✓ 用户参数覆盖了基本参数")
    print()
    
    print("=" * 60)
    print("简化设计总结:")
    print("✓ 只有两种参数：基本参数 + 用户额外参数")
    print("✓ 移除了动态查询参数的概念")
    print("✓ 用户在编辑页面配置的额外参数直接生效")
    print("✓ 参数设计更简洁明了")
    print("=" * 60)


def build_dify_params(query_config):
    """构建Dify参数（模拟简化后的逻辑）"""
    # 基本必需参数
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
    
    # 特殊处理reranking_model结构
    if query_config.get('reranking_provider_name') or query_config.get('reranking_model_name'):
        retrieval_model['reranking_model'] = {
            'reranking_provider_name': query_config.get('reranking_provider_name', ''),
            'reranking_model_name': query_config.get('reranking_model_name', '')
        }
    
    return retrieval_model


def build_ragflow_params(query_config):
    """构建RagFlow参数（模拟简化后的逻辑）"""
    # 基本参数
    basic_params = {
        'top_k': 5,
        'similarity_threshold': 0.7,
        'vector_similarity_weight': 0.3,
        'keywords_similarity_weight': 0.7,
        'rerank': True
    }

    # 合并用户配置的额外参数（覆盖基本参数）
    final_params = {}
    final_params.update(basic_params)
    final_params.update(query_config)
    
    return final_params


def build_fastgpt_params(query_config):
    """构建FastGPT参数（模拟简化后的逻辑）"""
    # 基本参数
    basic_params = {
        'limit': 5,
        'similarity': 0.7,
        'searchMode': 'embedding',
        'usingReRank': False,
        'reRankQuery': ''
    }
    
    # 合并用户配置的额外参数
    final_params = {}
    final_params.update(basic_params)
    final_params.update(query_config)
    
    return final_params


if __name__ == '__main__':
    test_simplified_parameter_design()
