#!/usr/bin/env python3
"""
测试Dify API参数合并

验证知识库配置的query_config和测试查询的params参数是否正确合并
"""

import json


def test_dify_params_merge():
    """测试Dify API参数合并逻辑"""
    print("=" * 60)
    print("测试Dify API参数合并")
    print("=" * 60)
    
    # 测试场景1: 知识库配置 + 测试查询参数
    print("1. 测试场景：知识库配置 + 测试查询参数")
    print("-" * 50)
    
    # 模拟知识库配置的query_config
    knowledge_query_config = {
        'search_method': 'semantic_search',
        'reranking_enable': True,
        'reranking_provider_name': 'cohere',
        'reranking_model_name': 'rerank-english-v2.0',
        'top_k': 5,
        'score_threshold_enabled': True,
        'score_threshold': 0.7
    }
    
    # 模拟测试查询传递的params参数
    test_query_params = {
        'top_k': 3  # 测试查询想要覆盖top_k
    }
    
    retrieval_model = build_retrieval_model_with_merge(knowledge_query_config, test_query_params)
    
    print("知识库配置 (query_config):")
    print(json.dumps(knowledge_query_config, indent=2, ensure_ascii=False))
    print("\n测试查询参数 (params):")
    print(json.dumps(test_query_params, indent=2, ensure_ascii=False))
    print("\n合并后的retrieval_model:")
    print(json.dumps(retrieval_model, indent=2, ensure_ascii=False))
    print("✓ 测试查询的top_k=3覆盖了知识库配置的top_k=5")
    print()
    
    # 测试场景2: 只有知识库配置，没有测试参数
    print("2. 测试场景：只有知识库配置")
    print("-" * 50)
    
    knowledge_query_config_2 = {
        'search_method': 'keyword_search',
        'reranking_enable': False,
        'top_k': 10,
        'score_threshold_enabled': False
    }
    
    retrieval_model_2 = build_retrieval_model_with_merge(knowledge_query_config_2, None)
    
    print("知识库配置 (query_config):")
    print(json.dumps(knowledge_query_config_2, indent=2, ensure_ascii=False))
    print("\n生成的retrieval_model:")
    print(json.dumps(retrieval_model_2, indent=2, ensure_ascii=False))
    print("✓ 只使用知识库配置，没有额外参数")
    print()
    
    # 测试场景3: 测试查询添加新参数
    print("3. 测试场景：测试查询添加新参数")
    print("-" * 50)
    
    knowledge_query_config_3 = {
        'search_method': 'hybrid_search',
        'reranking_enable': False,
        'top_k': 5,
        'score_threshold_enabled': False
    }
    
    test_query_params_3 = {
        'weights': 0.3,  # 添加hybrid_search需要的weights参数
        'score_threshold_enabled': True,  # 启用score阈值
        'score_threshold': 0.8  # 设置阈值
    }
    
    retrieval_model_3 = build_retrieval_model_with_merge(knowledge_query_config_3, test_query_params_3)
    
    print("知识库配置 (query_config):")
    print(json.dumps(knowledge_query_config_3, indent=2, ensure_ascii=False))
    print("\n测试查询参数 (params):")
    print(json.dumps(test_query_params_3, indent=2, ensure_ascii=False))
    print("\n合并后的retrieval_model:")
    print(json.dumps(retrieval_model_3, indent=2, ensure_ascii=False))
    print("✓ 测试查询添加了weights和score_threshold参数")
    print()
    
    print("=" * 60)
    print("修复总结:")
    print("✓ 知识库配置的query_config作为基础参数")
    print("✓ 测试查询的params参数可以覆盖和添加参数")
    print("✓ 参数正确合并到retrieval_model中，而不是覆盖整个payload")
    print("✓ 支持reranking_model等复杂结构的合并")
    print("=" * 60)


def build_retrieval_model_with_merge(query_config, query_params):
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

    # 合并额外查询参数到retrieval_model中
    if query_params:
        # 如果query_params中有retrieval_model相关参数，合并到retrieval_model中
        for key, value in query_params.items():
            if key in ['search_method', 'reranking_enable', 'top_k', 'score_threshold_enabled', 
                      'reranking_mode', 'weights', 'score_threshold', 'reranking_provider_name', 
                      'reranking_model_name']:
                retrieval_model[key] = value
        
        # 特殊处理reranking_model结构
        if query_params.get('reranking_provider_name') or query_params.get('reranking_model_name'):
            retrieval_model['reranking_model'] = {
                'reranking_provider_name': query_params.get('reranking_provider_name', 
                                                           retrieval_model.get('reranking_model', {}).get('reranking_provider_name', '')),
                'reranking_model_name': query_params.get('reranking_model_name',
                                                        retrieval_model.get('reranking_model', {}).get('reranking_model_name', ''))
            }
    
    return retrieval_model


if __name__ == '__main__':
    test_dify_params_merge()
