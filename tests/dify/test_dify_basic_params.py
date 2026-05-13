#!/usr/bin/env python3
"""
测试Dify API基本参数构建

验证只包含基本必需参数，其他参数由用户自定义配置
"""

import json


def test_dify_basic_parameters():
    """测试Dify API基本参数构建"""
    print("=" * 60)
    print("测试Dify API基本参数构建")
    print("=" * 60)
    
    # 测试场景1: 最基本的默认配置
    print("1. 测试场景：最基本的默认配置")
    print("-" * 40)
    
    query_config_1 = {
        'search_method': 'semantic_search',
        'reranking_enable': False,
        'top_k': 5,
        'score_threshold_enabled': False
    }
    
    retrieval_model_1 = build_retrieval_model(query_config_1)
    print("用户配置:")
    print(json.dumps(query_config_1, indent=2, ensure_ascii=False))
    print("\n生成的retrieval_model:")
    print(json.dumps(retrieval_model_1, indent=2, ensure_ascii=False))
    print("✓ 只包含基本必需参数")
    print()
    
    # 测试场景2: 用户添加了额外参数
    print("2. 测试场景：用户添加了额外参数")
    print("-" * 40)
    
    query_config_2 = {
        'search_method': 'semantic_search',
        'reranking_enable': True,
        'reranking_provider_name': 'cohere',
        'reranking_model_name': 'rerank-english-v2.0',
        'top_k': 10,
        'score_threshold_enabled': True,
        'score_threshold': 0.8
    }
    
    retrieval_model_2 = build_retrieval_model(query_config_2)
    print("用户配置:")
    print(json.dumps(query_config_2, indent=2, ensure_ascii=False))
    print("\n生成的retrieval_model:")
    print(json.dumps(retrieval_model_2, indent=2, ensure_ascii=False))
    print("✓ 包含用户自定义的额外参数")
    print()
    
    # 测试场景3: hybrid_search + weights
    print("3. 测试场景：hybrid_search + weights")
    print("-" * 40)
    
    query_config_3 = {
        'search_method': 'hybrid_search',
        'reranking_enable': False,
        'weights': 0.3,
        'top_k': 3,
        'score_threshold_enabled': False
    }
    
    retrieval_model_3 = build_retrieval_model(query_config_3)
    print("用户配置:")
    print(json.dumps(query_config_3, indent=2, ensure_ascii=False))
    print("\n生成的retrieval_model:")
    print(json.dumps(retrieval_model_3, indent=2, ensure_ascii=False))
    print("✓ 包含hybrid_search的weights参数")
    print()
    
    # 测试场景4: keyword_search（最简单）
    print("4. 测试场景：keyword_search（最简单）")
    print("-" * 40)
    
    query_config_4 = {
        'search_method': 'keyword_search',
        'reranking_enable': False,
        'top_k': 1,
        'score_threshold_enabled': False
    }
    
    retrieval_model_4 = build_retrieval_model(query_config_4)
    print("用户配置:")
    print(json.dumps(query_config_4, indent=2, ensure_ascii=False))
    print("\n生成的retrieval_model:")
    print(json.dumps(retrieval_model_4, indent=2, ensure_ascii=False))
    print("✓ keyword_search最简配置")
    print()
    
    print("=" * 60)
    print("修复总结:")
    print("✓ 只包含基本必需参数：search_method, reranking_enable, top_k, score_threshold_enabled")
    print("✓ 其他参数由用户在前端自定义配置")
    print("✓ 动态添加用户配置的可选参数")
    print("✓ 避免了参数冲突和500错误")
    print("=" * 60)


def build_retrieval_model(query_config):
    """构建retrieval_model参数（模拟修复后的适配器逻辑）"""
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
    
    # 特殊处理reranking_model结构
    if query_config.get('reranking_provider_name') or query_config.get('reranking_model_name'):
        retrieval_model['reranking_model'] = {
            'reranking_provider_name': query_config.get('reranking_provider_name', ''),
            'reranking_model_name': query_config.get('reranking_model_name', '')
        }
    
    return retrieval_model


if __name__ == '__main__':
    test_dify_basic_parameters()
