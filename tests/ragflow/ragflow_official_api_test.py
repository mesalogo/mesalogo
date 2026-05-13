#!/usr/bin/env python3
"""
RagFlow官方API测试脚本

严格按照官方文档进行测试：
https://ragflow.io/docs/dev/http_api_reference#chunk-management-within-dataset

地址：http://localhost:7080
API KEY：ragflow-REPLACE_ME
Dataset ID：f9b0243836bc11f096a90242c0a81006
"""

import requests
import json
import time

# RagFlow配置
RAGFLOW_BASE_URL = "http://localhost:7080"
RAGFLOW_API_KEY = "ragflow-REPLACE_ME"
RAGFLOW_DATASET_ID = "f9b0243836bc11f096a90242c0a81006"

def test_list_datasets():
    """
    测试获取数据集列表
    GET /api/v1/datasets?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&name={dataset_name}&id={dataset_id}
    """
    print("=== 测试获取数据集列表 ===")
    
    url = f"{RAGFLOW_BASE_URL}/api/v1/datasets"
    headers = {
        'Authorization': f'Bearer {RAGFLOW_API_KEY}'
    }
    params = {
        'page': 1,
        'page_size': 10,
        'orderby': 'create_time',
        'desc': True
    }
    
    print(f"请求URL: {url}")
    print(f"请求参数: {params}")
    print(f"请求头: {headers}")
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        print(f"响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 获取数据集列表成功")
            print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"✗ 获取数据集列表失败")
            print(f"响应内容: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return None

def test_get_dataset_by_id():
    """
    测试根据ID获取特定数据集
    使用name参数过滤
    """
    print(f"\n=== 测试获取特定数据集 (ID: {RAGFLOW_DATASET_ID}) ===")
    
    url = f"{RAGFLOW_BASE_URL}/api/v1/datasets"
    headers = {
        'Authorization': f'Bearer {RAGFLOW_API_KEY}'
    }
    params = {
        'id': RAGFLOW_DATASET_ID
    }
    
    print(f"请求URL: {url}")
    print(f"请求参数: {params}")
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 获取特定数据集成功")
            print(f"数据集信息: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"✗ 获取特定数据集失败")
            print(f"响应内容: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return None

def test_list_chunks():
    """
    测试获取数据集中的chunks
    GET /api/v1/datasets/{dataset_id}/chunks?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&keywords={keywords}&id={chunk_id}
    """
    print(f"\n=== 测试获取chunks列表 ===")
    
    url = f"{RAGFLOW_BASE_URL}/api/v1/datasets/{RAGFLOW_DATASET_ID}/chunks"
    headers = {
        'Authorization': f'Bearer {RAGFLOW_API_KEY}'
    }
    params = {
        'page': 1,
        'page_size': 5,
        'orderby': 'create_time',
        'desc': True
    }
    
    print(f"请求URL: {url}")
    print(f"请求参数: {params}")
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 获取chunks列表成功")
            print(f"chunks数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"✗ 获取chunks列表失败")
            print(f"响应内容: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return None

def test_retrieve_chunks():
    """
    测试检索chunks
    POST /api/v1/datasets/{dataset_id}/chunks/retrieval
    """
    print(f"\n=== 测试检索chunks ===")
    
    url = f"{RAGFLOW_BASE_URL}/api/v1/datasets/{RAGFLOW_DATASET_ID}/chunks/retrieval"
    headers = {
        'Authorization': f'Bearer {RAGFLOW_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    # 根据官方文档的payload格式
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
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 检索chunks成功")
            print(f"检索结果: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"✗ 检索chunks失败")
            print(f"响应内容: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return None

def test_list_documents():
    """
    测试获取数据集中的文档列表
    GET /api/v1/datasets/{dataset_id}/documents?page={page}&page_size={page_size}&orderby={orderby}&desc={desc}&keywords={keywords}&id={document_id}
    """
    print(f"\n=== 测试获取文档列表 ===")
    
    url = f"{RAGFLOW_BASE_URL}/api/v1/datasets/{RAGFLOW_DATASET_ID}/documents"
    headers = {
        'Authorization': f'Bearer {RAGFLOW_API_KEY}'
    }
    params = {
        'page': 1,
        'page_size': 10,
        'orderby': 'create_time',
        'desc': True
    }
    
    print(f"请求URL: {url}")
    print(f"请求参数: {params}")
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 获取文档列表成功")
            print(f"文档数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"✗ 获取文档列表失败")
            print(f"响应内容: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return None

def test_ragflow_adapter_integration():
    """测试我们的RagFlow适配器集成"""
    print(f"\n=== 测试RagFlow适配器集成 ===")
    
    try:
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
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
        print("✓ RagFlow适配器创建成功")
        
        # 测试连接
        print("\n--- 测试适配器连接 ---")
        connection_result = adapter.test_connection()
        print(f"连接测试结果: {json.dumps(connection_result, indent=2, ensure_ascii=False)}")
        
        if connection_result['success']:
            print("✓ 适配器连接测试成功")
            
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
                print("✓ 适配器查询测试成功")
                return True
            else:
                print("✗ 适配器查询测试失败")
                return False
        else:
            print("✗ 适配器连接测试失败")
            return False
            
    except Exception as e:
        print(f"✗ RagFlow适配器测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主测试函数"""
    print("开始RagFlow官方API测试...")
    print(f"RagFlow地址: {RAGFLOW_BASE_URL}")
    print(f"API KEY: {RAGFLOW_API_KEY}")
    print(f"Dataset ID: {RAGFLOW_DATASET_ID}")
    print("=" * 60)
    
    results = []
    
    # 按照官方文档顺序测试
    results.append(test_list_datasets() is not None)
    results.append(test_get_dataset_by_id() is not None)
    results.append(test_list_documents() is not None)
    results.append(test_list_chunks() is not None)
    results.append(test_retrieve_chunks() is not None)
    results.append(test_ragflow_adapter_integration())
    
    # 总结
    print(f"\n{'=' * 60}")
    print("=== 测试总结 ===")
    passed = sum(results)
    total = len(results)
    
    test_names = [
        "获取数据集列表",
        "获取特定数据集", 
        "获取文档列表",
        "获取chunks列表",
        "检索chunks",
        "适配器集成"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} {name}")
    
    print(f"\n通过测试: {passed}/{total}")
    
    if passed == total:
        print("🎉 所有测试通过！RagFlow真实API集成成功！")
        return 0
    else:
        print("❌ 部分测试失败，需要进一步调试")
        return 1

if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)
