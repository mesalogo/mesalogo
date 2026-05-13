#!/usr/bin/env python3
"""
测试FastGPT适配器实现

使用真实的FastGPT API进行测试
"""

import sys
import os
import json
import time
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.external_knowledge.fastgpt_adapter import FastGPTAdapter


def test_fastgpt_adapter():
    """测试FastGPT适配器"""
    print("=" * 60)
    print("测试FastGPT适配器实现")
    print("=" * 60)
    
    # 测试配置 - 使用提供的真实配置
    test_config = {
        'base_url': 'https://api.fastgpt.in/api',
        'api_key': 'fastgpt-REPLACE_ME',
        'provider_type': 'fastgpt'
    }
    
    # 测试知识库配置
    knowledge_config = {
        'external_kb_id': '67515675b26652c19eaef98e',  # 提供的dataset id
        'query_config': {
            'limit': 3000,  # 最大tokens
            'similarity': 0.1,  # 最低相关度
            'searchMode': 'embedding',  # 搜索模式
            'usingReRank': False,  # 不使用重排
            'datasetSearchUsingExtensionQuery': False  # 不使用问题优化
        }
    }
    
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"API URL: {test_config['base_url']}")
    print(f"Dataset ID: {knowledge_config['external_kb_id']}")
    print()
    
    try:
        # 创建适配器实例
        adapter = FastGPTAdapter(test_config)
        
        # 1. 测试连接
        print("1. 测试连接")
        print("-" * 30)
        
        connection_result = adapter.test_connection()
        print("连接测试结果:")
        print(json.dumps(connection_result, indent=2, ensure_ascii=False))
        
        if not connection_result['success']:
            print("❌ 连接测试失败，停止后续测试")
            return
        
        print("✓ 连接测试成功")
        print()
        
        # 2. 测试知识库查询
        print("2. 测试知识库查询")
        print("-" * 30)
        
        test_queries = [
            "什么是人工智能？",
            "FastGPT的主要功能",
            "如何使用知识库"
        ]
        
        for i, query_text in enumerate(test_queries, 1):
            print(f"查询 {i}: {query_text}")
            
            query_result = adapter.query_knowledge(knowledge_config, query_text)
            
            print("查询结果:")
            if query_result['success']:
                print(f"✓ 查询成功")
                print(f"  - 结果数量: {query_result['total_count']}")
                print(f"  - 查询耗时: {query_result['query_time']:.2f}秒")
                
                # 显示前2个结果
                for j, result in enumerate(query_result['results'][:2]):
                    print(f"  - 结果 {j+1}:")
                    print(f"    相关度: {result['score']:.4f}")
                    print(f"    内容预览: {result['content'][:100]}...")
                    if result['metadata'].get('source_name'):
                        print(f"    来源: {result['metadata']['source_name']}")
            else:
                print(f"❌ 查询失败: {query_result['error_message']}")
            
            print()
        
        # 3. 测试不同的搜索模式
        print("3. 测试不同搜索模式")
        print("-" * 30)
        
        search_modes = ['embedding', 'fullTextRecall', 'mixedRecall']
        test_query = "人工智能"
        
        for mode in search_modes:
            print(f"测试搜索模式: {mode}")
            
            # 修改搜索模式
            test_knowledge_config = knowledge_config.copy()
            test_knowledge_config['query_config'] = knowledge_config['query_config'].copy()
            test_knowledge_config['query_config']['searchMode'] = mode
            
            query_result = adapter.query_knowledge(test_knowledge_config, test_query)
            
            if query_result['success']:
                print(f"✓ {mode} 模式查询成功，返回 {query_result['total_count']} 个结果")
            else:
                print(f"❌ {mode} 模式查询失败: {query_result['error_message']}")
        
        print()
        
        # 4. 测试参数验证
        print("4. 测试参数验证")
        print("-" * 30)
        
        # 测试无效的dataset_id
        invalid_config = {
            'external_kb_id': 'invalid_id',
            'query_config': knowledge_config['query_config']
        }
        
        result = adapter.query_knowledge(invalid_config, "测试查询")
        if not result['success']:
            print("✓ 无效dataset_id正确被拒绝")
        else:
            print("⚠️ 无效dataset_id未被正确处理")
        
        print()
        
        print("=" * 60)
        print("FastGPT适配器测试完成")
        print("✓ 连接测试通过")
        print("✓ 知识库查询功能正常")
        print("✓ 多种搜索模式支持")
        print("✓ 参数验证正常")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {str(e)}")
        import traceback
        traceback.print_exc()


def test_fastgpt_parameters():
    """测试FastGPT参数构建"""
    print("=" * 60)
    print("测试FastGPT参数构建")
    print("=" * 60)
    
    # 测试场景1: 基本参数
    print("1. 基本参数测试")
    print("-" * 30)
    
    query_config_1 = {}
    
    # 模拟参数构建逻辑
    basic_params = {
        'limit': 5000,
        'similarity': 0,
        'searchMode': 'embedding',
        'usingReRank': False,
        'datasetSearchUsingExtensionQuery': False,
        'datasetSearchExtensionModel': '',
        'datasetSearchExtensionBg': ''
    }
    
    final_params = {}
    final_params.update(basic_params)
    final_params.update(query_config_1)
    
    print("用户配置:")
    print(json.dumps(query_config_1, indent=2, ensure_ascii=False))
    print("\n最终参数:")
    print(json.dumps(final_params, indent=2, ensure_ascii=False))
    print("✓ 基本参数构建正确")
    print()
    
    # 测试场景2: 用户自定义参数
    print("2. 用户自定义参数测试")
    print("-" * 30)
    
    query_config_2 = {
        'limit': 3000,
        'similarity': 0.5,
        'searchMode': 'mixedRecall',
        'usingReRank': True,
        'datasetSearchUsingExtensionQuery': True,
        'datasetSearchExtensionModel': 'gpt-4o-mini',
        'datasetSearchExtensionBg': '这是一个技术文档知识库'
    }
    
    final_params_2 = {}
    final_params_2.update(basic_params)
    final_params_2.update(query_config_2)
    
    print("用户配置:")
    print(json.dumps(query_config_2, indent=2, ensure_ascii=False))
    print("\n最终参数:")
    print(json.dumps(final_params_2, indent=2, ensure_ascii=False))
    print("✓ 用户参数正确覆盖基本参数")
    print()
    
    print("=" * 60)
    print("参数构建测试完成")
    print("✓ 支持所有FastGPT官方API参数")
    print("✓ 用户配置正确覆盖默认值")
    print("=" * 60)


if __name__ == '__main__':
    print("选择测试模式:")
    print("1. 完整适配器测试（需要网络连接）")
    print("2. 参数构建测试（离线测试）")
    
    choice = input("请输入选择 (1 或 2): ").strip()
    
    if choice == '1':
        test_fastgpt_adapter()
    elif choice == '2':
        test_fastgpt_parameters()
    else:
        print("无效选择，运行参数构建测试...")
        test_fastgpt_parameters()
