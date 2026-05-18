#!/usr/bin/env python3
"""
RagFlow真实API测试脚本

使用真实的RagFlow API进行测试
地址：http://localhost:7080
API KEY：ragflow-REPLACE_ME
Dataset ID：f9b0243836bc11f096a90242c0a81006
"""

import sys
import os
import json
import requests
import time
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# RagFlow配置
RAGFLOW_BASE_URL = "http://localhost:7080"
RAGFLOW_API_KEY = "ragflow-REPLACE_ME"
RAGFLOW_DATASET_ID = "f9b0243836bc11f096a90242c0a81006"

def test_ragflow_connection():
    """测试RagFlow连接"""
    print("=== 测试RagFlow连接 ===")
    
    try:
        url = f"{RAGFLOW_BASE_URL}/api/v1/datasets"
        headers = {
            'Authorization': f'Bearer {RAGFLOW_API_KEY}',
            'Content-Type': 'application/json'
        }
        params = {
            'page': 1,
            'page_size': 1
        }
        
        print(f"请求URL: {url}")
        print(f"请求头: {headers}")
        print(f"请求参数: {params}")
        
        response = requests.get(url, headers=headers, params=params, timeout=30)
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ PASS RagFlow连接成功")
            print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return True
        else:
            print(f"✗ FAIL RagFlow连接失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ FAIL RagFlow连接异常: {e}")
        return False

def test_ragflow_dataset_info():
    """测试获取指定数据集信息"""
    print(f"\n=== 测试获取数据集信息 ===")
    
    try:
        url = f"{RAGFLOW_BASE_URL}/api/v1/datasets/{RAGFLOW_DATASET_ID}"
        headers = {
            'Authorization': f'Bearer {RAGFLOW_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        print(f"请求URL: {url}")
        
        response = requests.get(url, headers=headers, timeout=30)
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ PASS 获取数据集信息成功")
            print(f"数据集信息: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"✗ FAIL 获取数据集信息失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ FAIL 获取数据集信息异常: {e}")
        return None

def test_ragflow_chunks_retrieval():
    """测试RagFlow chunks检索"""
    print(f"\n=== 测试RagFlow chunks检索 ===")
    
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
        
        print(f"请求URL: {url}")
        print(f"请求载荷: {json.dumps(payload, indent=2, ensure_ascii=False)}")
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ PASS RagFlow chunks检索成功")
            print(f"检索结果: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"✗ FAIL RagFlow chunks检索失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ FAIL RagFlow chunks检索异常: {e}")
        return None

def test_ragflow_adapter():
    """测试我们的RagFlow适配器"""
    print(f"\n=== 测试RagFlow适配器 ===")
    
    try:
        from app.services.external_knowledge import RagFlowAdapter
        
        # 创建适配器
        config = {
            'base_url': RAGFLOW_BASE_URL,
            'api_key': RAGFLOW_API_KEY,
            'config': {
                'timeout': 30,
                'max_retries': 3
            }
        }
        
        adapter = RagFlowAdapter(config)
        print("✓ PASS RagFlow适配器创建成功")
        
        # 测试连接
        print("\n--- 测试适配器连接 ---")
        connection_result = adapter.test_connection()
        print(f"连接测试结果: {json.dumps(connection_result, indent=2, ensure_ascii=False)}")
        
        if connection_result['success']:
            print("✓ PASS 适配器连接测试成功")
            
            # 测试查询
            print("\n--- 测试适配器查询 ---")
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
            
            query_result = adapter.query_knowledge(
                knowledge_config, 
                '什么是人工智能？'
            )
            
            print(f"查询结果: {json.dumps(query_result, indent=2, ensure_ascii=False)}")
            
            if query_result['success']:
                print("✓ PASS 适配器查询测试成功")
                return True
            else:
                print("✗ FAIL 适配器查询测试失败")
                return False
        else:
            print("✗ FAIL 适配器连接测试失败")
            return False
            
    except Exception as e:
        print(f"✗ FAIL RagFlow适配器测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_backend_api():
    """测试后端API集成"""
    print(f"\n=== 测试后端API集成 ===")
    
    try:
        # 测试提供商连接
        print("--- 测试提供商连接 ---")
        url = "http://localhost:8080/api/external-kb/providers/8/test"
        response = requests.post(url, headers={'Content-Type': 'application/json'}, timeout=30)
        
        print(f"提供商连接测试状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"提供商连接测试结果: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            if data.get('success'):
                print("✓ PASS 后端API提供商连接测试成功")
                return True
            else:
                print("✗ FAIL 后端API提供商连接测试失败")
                return False
        else:
            print(f"✗ FAIL 后端API提供商连接测试HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ FAIL 后端API测试异常: {e}")
        return False

def main():
    """主测试函数"""
    print("开始RagFlow真实API测试...")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"RagFlow地址: {RAGFLOW_BASE_URL}")
    print(f"Dataset ID: {RAGFLOW_DATASET_ID}")
    
    results = []
    
    # 1. 测试基础连接
    results.append(test_ragflow_connection())
    
    # 2. 测试数据集信息
    dataset_info = test_ragflow_dataset_info()
    results.append(dataset_info is not None)
    
    # 3. 测试chunks检索
    results.append(test_ragflow_chunks_retrieval() is not None)
    
    # 4. 测试适配器
    results.append(test_ragflow_adapter())
    
    # 5. 测试后端API
    results.append(test_backend_api())
    
    # 总结
    print(f"\n=== 测试总结 ===")
    passed = sum(results)
    total = len(results)
    
    print(f"通过测试: {passed}/{total}")
    
    if passed == total:
        print("🎉 所有测试通过！RagFlow真实API集成成功！")
        return 0
    else:
        print("❌ 部分测试失败，需要进一步调试")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
