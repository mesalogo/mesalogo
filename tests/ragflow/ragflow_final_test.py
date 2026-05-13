#!/usr/bin/env python3
"""
RagFlow最终测试脚本
确保使用真实API并成功测试
"""

import sys
import os
import json
import time
import requests
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# RagFlow配置
RAGFLOW_BASE_URL = "http://localhost:7080"
RAGFLOW_API_KEY = "ragflow-REPLACE_ME"
RAGFLOW_DATASET_ID = "f9b0243836bc11f096a90242c0a81006"

def test_ragflow_direct_api():
    """直接测试RagFlow API"""
    print("=== 直接测试RagFlow API ===")
    
    success_count = 0
    total_tests = 3
    
    # 测试1: 获取数据集列表
    print("\n1. 测试获取数据集列表")
    try:
        url = f"{RAGFLOW_BASE_URL}/api/v1/datasets"
        headers = {'Authorization': f'Bearer {RAGFLOW_API_KEY}'}
        params = {'page': 1, 'page_size': 1}
        
        response = requests.get(url, headers=headers, params=params, timeout=30)
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("   ✓ 获取数据集列表成功")
            success_count += 1
        else:
            print(f"   ✗ 失败: {response.text[:200]}")
            
    except Exception as e:
        print(f"   ✗ 异常: {e}")
    
    # 测试2: 获取指定数据集
    print(f"\n2. 测试获取数据集 {RAGFLOW_DATASET_ID}")
    try:
        url = f"{RAGFLOW_BASE_URL}/api/v1/datasets"
        headers = {'Authorization': f'Bearer {RAGFLOW_API_KEY}'}
        params = {'id': RAGFLOW_DATASET_ID}
        
        response = requests.get(url, headers=headers, params=params, timeout=30)
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("   ✓ 获取指定数据集成功")
            success_count += 1
        else:
            print(f"   ✗ 失败: {response.text[:200]}")
            
    except Exception as e:
        print(f"   ✗ 异常: {e}")
    
    # 测试3: chunks检索
    print(f"\n3. 测试chunks检索")
    try:
        url = f"{RAGFLOW_BASE_URL}/api/v1/datasets/{RAGFLOW_DATASET_ID}/chunks/retrieval"
        headers = {
            'Authorization': f'Bearer {RAGFLOW_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'question': '什么是人工智能？',
            'top_k': 3,
            'similarity_threshold': 0.7,
            'vector_similarity_weight': 0.3,
            'keywords_similarity_weight': 0.7,
            'rerank': True
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("   ✓ chunks检索成功")
            if 'data' in data and 'chunks' in data['data']:
                chunks = data['data']['chunks']
                print(f"   检索到 {len(chunks)} 个结果")
            success_count += 1
        else:
            print(f"   ✗ 失败: {response.text[:200]}")
            
    except Exception as e:
        print(f"   ✗ 异常: {e}")
    
    print(f"\n直接API测试结果: {success_count}/{total_tests} 通过")
    return success_count == total_tests

def test_ragflow_adapter():
    """测试RagFlow适配器"""
    print("\n=== 测试RagFlow适配器 ===")
    
    try:
        from app.services.external_knowledge import RagFlowAdapter
        
        # 创建适配器
        config = {
            'base_url': RAGFLOW_BASE_URL,
            'api_key': RAGFLOW_API_KEY,
            'config': {'timeout': 30, 'max_retries': 3}
        }
        
        adapter = RagFlowAdapter(config)
        print("✓ 适配器创建成功")
        
        # 测试连接
        connection_result = adapter.test_connection()
        print(f"连接测试: {connection_result['success']} - {connection_result['message']}")
        
        if connection_result['success']:
            # 测试查询
            knowledge_config = {
                'external_kb_id': RAGFLOW_DATASET_ID,
                'query_config': {
                    'top_k': 3,
                    'similarity_threshold': 0.7,
                    'vector_similarity_weight': 0.3,
                    'keywords_similarity_weight': 0.7,
                    'rerank': True
                }
            }
            
            query_result = adapter.query_knowledge(knowledge_config, '什么是人工智能？')
            print(f"查询测试: {query_result['success']} - 结果数量: {query_result['total_count']}")
            
            if query_result['success']:
                print("✓ RagFlow适配器测试成功")
                return True
        
        print("✗ RagFlow适配器测试失败")
        return False
        
    except Exception as e:
        print(f"✗ 适配器测试异常: {e}")
        return False

def test_backend_integration():
    """测试后端集成"""
    print("\n=== 测试后端集成 ===")
    
    try:
        from app import create_app
        from app.extensions import db
        from app.models import ExternalKnowledgeProvider, ExternalKnowledge
        
        app = create_app()
        
        with app.app_context():
            # 确保提供商存在
            provider = ExternalKnowledgeProvider.query.filter_by(name="RagFlow真实环境").first()
            if not provider:
                provider = ExternalKnowledgeProvider(
                    name="RagFlow真实环境",
                    type="ragflow",
                    base_url=RAGFLOW_BASE_URL,
                    api_key=RAGFLOW_API_KEY,
                    config={"timeout": 30, "max_retries": 3},
                    status="active"
                )
                db.session.add(provider)
                db.session.commit()
            
            print(f"✓ 提供商就绪，ID: {provider.id}")
            
            # 确保知识库存在
            knowledge = ExternalKnowledge.query.filter_by(
                provider_id=provider.id,
                external_kb_id=RAGFLOW_DATASET_ID
            ).first()
            
            if not knowledge:
                knowledge = ExternalKnowledge(
                    name="RagFlow测试知识库",
                    description="使用真实RagFlow API的测试知识库",
                    provider_id=provider.id,
                    external_kb_id=RAGFLOW_DATASET_ID,
                    query_config={
                        "top_k": 5,
                        "similarity_threshold": 0.7,
                        "vector_similarity_weight": 0.3,
                        "keywords_similarity_weight": 0.7,
                        "rerank": True
                    },
                    status="active"
                )
                db.session.add(knowledge)
                db.session.commit()
            
            print(f"✓ 知识库就绪，ID: {knowledge.id}")
            
            # 测试后端API
            print("测试后端API...")
            
            # 测试提供商连接
            response = requests.post(
                f"http://localhost:8080/api/external-kb/providers/{provider.id}/test",
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print("✓ 提供商连接测试成功")
                    
                    # 测试知识库查询
                    query_response = requests.post(
                        f"http://localhost:8080/api/external-kb/knowledges/{knowledge.id}/query",
                        json={
                            "query": "什么是人工智能？",
                            "params": {"top_k": 3}
                        },
                        headers={'Content-Type': 'application/json'},
                        timeout=60
                    )
                    
                    if query_response.status_code == 200:
                        query_data = query_response.json()
                        if query_data.get('success'):
                            print(f"✓ 知识库查询成功，结果数量: {query_data.get('total_count', 0)}")
                            return True
                        else:
                            print(f"✗ 知识库查询失败: {query_data.get('error_message')}")
                    else:
                        print(f"✗ 知识库查询HTTP错误: {query_response.status_code}")
                else:
                    print(f"✗ 提供商连接失败: {data.get('message')}")
            else:
                print(f"✗ 提供商连接HTTP错误: {response.status_code}")
            
            return False
            
    except Exception as e:
        print(f"✗ 后端集成测试异常: {e}")
        return False

def main():
    """主测试函数"""
    print("RagFlow真实API最终测试")
    print("=" * 50)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"RagFlow地址: {RAGFLOW_BASE_URL}")
    print(f"Dataset ID: {RAGFLOW_DATASET_ID}")
    
    results = []
    
    # 1. 直接API测试
    results.append(test_ragflow_direct_api())
    
    # 2. 适配器测试
    results.append(test_ragflow_adapter())
    
    # 3. 后端集成测试
    results.append(test_backend_integration())
    
    # 总结
    print(f"\n{'=' * 50}")
    print("=== 最终测试结果 ===")
    
    test_names = ["直接API测试", "适配器测试", "后端集成测试"]
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status} {name}")
    
    passed = sum(results)
    total = len(results)
    
    print(f"\n通过测试: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 所有测试通过！RagFlow真实API集成完全成功！")
        print("\n✓ RagFlow API连接正常")
        print("✓ 适配器功能正常")
        print("✓ 后端集成正常")
        print("✓ 知识库查询正常")
        return 0
    else:
        print("\n❌ 部分测试失败，需要进一步调试")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
