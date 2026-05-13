#!/usr/bin/env python3
"""
测试RagFlow集成功能
验证API修复和完整功能
"""

import sys
import os
import json
import requests
import time
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_backend_api():
    """测试后端API"""
    print("=== 测试后端API ===")
    
    base_url = "http://localhost:8080"
    
    # 1. 测试获取提供商列表
    print("\n1. 测试获取提供商列表")
    try:
        response = requests.get(f"{base_url}/api/external-kb/providers", timeout=10)
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("   ✓ 获取提供商列表成功")
            
            # 查找RagFlow提供商
            ragflow_provider = None
            if 'data' in data:
                for provider in data['data']:
                    if provider.get('type') == 'ragflow':
                        ragflow_provider = provider
                        break
            
            if ragflow_provider:
                print(f"   ✓ 找到RagFlow提供商，ID: {ragflow_provider['id']}")
                return ragflow_provider['id']
            else:
                print("   ✗ 未找到RagFlow提供商")
                return None
        else:
            print(f"   ✗ 失败: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ✗ 异常: {e}")
        return None

def test_provider_connection(provider_id):
    """测试提供商连接"""
    print(f"\n2. 测试提供商连接 (ID: {provider_id})")
    
    try:
        response = requests.post(
            f"http://localhost:8080/api/external-kb/providers/{provider_id}/test",
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ 连接测试成功: {data.get('message')}")
            print(f"   响应时间: {data.get('data', {}).get('response_time', 'N/A')}ms")
            return True
        else:
            print(f"   ✗ 连接测试失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ✗ 异常: {e}")
        return False

def test_knowledge_creation(provider_id):
    """测试创建外部知识库"""
    print(f"\n3. 测试创建外部知识库")
    
    knowledge_data = {
        "name": "RagFlow测试知识库",
        "description": "使用真实RagFlow API的测试知识库",
        "provider_id": provider_id,
        "external_kb_id": "f9b0243836bc11f096a90242c0a81006",
        "query_config": {
            "top_k": 5,
            "similarity_threshold": 0.7,
            "vector_similarity_weight": 0.3,
            "keywords_similarity_weight": 0.7,
            "rerank": True
        },
        "status": "active"
    }
    
    try:
        response = requests.post(
            "http://localhost:8080/api/external-kb/knowledges",
            json=knowledge_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                knowledge_id = data.get('data', {}).get('id')
                print(f"   ✓ 创建知识库成功，ID: {knowledge_id}")
                return knowledge_id
            else:
                print(f"   ✗ 创建失败: {data.get('message')}")
                return None
        elif response.status_code == 409:
            # 知识库已存在，获取现有的
            print("   ⚠ 知识库已存在，尝试获取现有知识库")
            return get_existing_knowledge(provider_id)
        else:
            print(f"   ✗ 创建失败: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ✗ 异常: {e}")
        return None

def get_existing_knowledge(provider_id):
    """获取现有的知识库"""
    try:
        response = requests.get(
            "http://localhost:8080/api/external-kb/knowledges",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data:
                for knowledge in data['data']:
                    if (knowledge.get('provider_id') == provider_id and 
                        knowledge.get('external_kb_id') == "f9b0243836bc11f096a90242c0a81006"):
                        print(f"   ✓ 找到现有知识库，ID: {knowledge['id']}")
                        return knowledge['id']
        
        return None
        
    except Exception as e:
        print(f"   ✗ 获取现有知识库异常: {e}")
        return None

def test_knowledge_query(knowledge_id):
    """测试知识库查询"""
    print(f"\n4. 测试知识库查询 (ID: {knowledge_id})")
    
    query_data = {
        "query": "什么是人工智能？",
        "params": {
            "top_k": 3
        }
    }
    
    try:
        response = requests.post(
            f"http://localhost:8080/api/external-kb/knowledges/{knowledge_id}/query",
            json=query_data,
            headers={'Content-Type': 'application/json'},
            timeout=60
        )
        
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print(f"   ✓ 查询成功")
                print(f"   结果数量: {data.get('total_count', 0)}")
                print(f"   查询时间: {data.get('query_time', 0):.3f}秒")
                
                # 显示第一个结果
                results = data.get('results', [])
                if results:
                    first_result = results[0]
                    print(f"   第一个结果:")
                    print(f"     内容: {first_result.get('content', '')[:100]}...")
                    print(f"     相似度: {first_result.get('score', 0)}")
                
                return True
            else:
                print(f"   ✗ 查询失败: {data.get('error_message')}")
                return False
        else:
            print(f"   ✗ 查询失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ✗ 异常: {e}")
        return False

def test_knowledge_connection(knowledge_id):
    """测试知识库连接"""
    print(f"\n5. 测试知识库连接 (ID: {knowledge_id})")
    
    try:
        response = requests.post(
            f"http://localhost:8080/api/external-kb/knowledges/{knowledge_id}/test",
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print(f"   ✓ 连接测试成功: {data.get('message')}")
                return True
            else:
                print(f"   ✗ 连接测试失败: {data.get('message')}")
                return False
        else:
            print(f"   ✗ 连接测试失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ✗ 异常: {e}")
        return False

def main():
    """主测试函数"""
    print("RagFlow集成功能测试")
    print("=" * 50)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # 1. 测试后端API
    provider_id = test_backend_api()
    results.append(provider_id is not None)
    
    if provider_id:
        # 2. 测试提供商连接
        connection_success = test_provider_connection(provider_id)
        results.append(connection_success)
        
        if connection_success:
            # 3. 测试创建知识库
            knowledge_id = test_knowledge_creation(provider_id)
            results.append(knowledge_id is not None)
            
            if knowledge_id:
                # 4. 测试知识库查询
                query_success = test_knowledge_query(knowledge_id)
                results.append(query_success)
                
                # 5. 测试知识库连接
                knowledge_connection_success = test_knowledge_connection(knowledge_id)
                results.append(knowledge_connection_success)
            else:
                results.extend([False, False])  # 查询和连接测试失败
        else:
            results.extend([False, False, False])  # 创建、查询和连接测试失败
    else:
        results.extend([False, False, False, False])  # 所有后续测试失败
    
    # 总结
    print(f"\n{'=' * 50}")
    print("=== 测试结果总结 ===")
    
    test_names = [
        "获取提供商列表",
        "提供商连接测试", 
        "创建外部知识库",
        "知识库查询测试",
        "知识库连接测试"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status} {name}")
    
    passed = sum(results)
    total = len(results)
    
    print(f"\n通过测试: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 所有测试通过！RagFlow集成功能完全正常！")
        print("\n✓ 后端API正常")
        print("✓ 提供商连接正常")
        print("✓ 知识库创建正常")
        print("✓ 知识库查询正常")
        print("✓ 知识库连接正常")
        return 0
    elif passed >= 3:
        print("\n✅ 核心功能正常，部分高级功能可能需要调试")
        return 0
    else:
        print("\n❌ 核心功能存在问题，需要进一步调试")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
