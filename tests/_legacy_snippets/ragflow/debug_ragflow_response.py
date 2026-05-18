#!/usr/bin/env python3
"""
调试RagFlow API响应
"""

import sys
import os
import json
import requests

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_ragflow_direct():
    """直接测试RagFlow API"""
    print("=== 直接测试RagFlow API ===")
    
    url = "http://localhost:7080/api/v1/datasets/f9b0243836bc11f096a90242c0a81006/chunks/retrieval"
    headers = {
        'Authorization': 'Bearer ragflow-REPLACE_ME',
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
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ RagFlow API调用成功")
            print(f"RagFlow响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"✗ RagFlow API失败: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ RagFlow API异常: {e}")
        return None

def test_backend_api():
    """测试后端API"""
    print("\n=== 测试后端API ===")
    
    url = "http://localhost:8080/api/external-kb/knowledges/8/query"
    payload = {
        "query": "什么是人工智能？",
        "params": {
            "top_k": 3
        }
    }
    
    try:
        response = requests.post(
            url, 
            json=payload, 
            headers={'Content-Type': 'application/json'}, 
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 后端API调用成功")
            print(f"后端响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # 分析响应结构
            print(f"\n响应结构分析:")
            print(f"  - success: {data.get('success')} ({type(data.get('success'))})")
            print(f"  - total_count: {data.get('total_count')} ({type(data.get('total_count'))})")
            print(f"  - query_time: {data.get('query_time')} ({type(data.get('query_time'))})")
            print(f"  - results: {type(data.get('results'))} (长度: {len(data.get('results', []))})")
            print(f"  - error_message: {data.get('error_message')}")
            
            return data
        else:
            print(f"✗ 后端API失败: {response.text}")
            return None
            
    except Exception as e:
        print(f"✗ 后端API异常: {e}")
        return None

def test_adapter_directly():
    """直接测试适配器"""
    print("\n=== 直接测试适配器 ===")
    
    try:
        from app import create_app
        from app.services.external_knowledge import RagFlowAdapter
        
        app = create_app()
        
        with app.app_context():
            # 创建适配器
            config = {
                'base_url': 'http://localhost:7080',
                'api_key': 'ragflow-REPLACE_ME',
                'config': {'timeout': 30}
            }
            
            adapter = RagFlowAdapter(config)
            print("✓ 适配器创建成功")
            
            # 测试查询
            knowledge_config = {
                'external_kb_id': 'f9b0243836bc11f096a90242c0a81006',
                'query_config': {
                    'top_k': 3,
                    'similarity_threshold': 0.7,
                    'vector_similarity_weight': 0.3,
                    'keywords_similarity_weight': 0.7,
                    'rerank': True
                }
            }
            
            result = adapter.query_knowledge(knowledge_config, '什么是人工智能？')
            print("✓ 适配器查询完成")
            print(f"适配器响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
            return result
            
    except Exception as e:
        print(f"✗ 适配器测试异常: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """主函数"""
    print("RagFlow API响应调试")
    print("=" * 50)
    
    # 1. 直接测试RagFlow API
    ragflow_result = test_ragflow_direct()
    
    # 2. 测试后端API
    backend_result = test_backend_api()
    
    # 3. 直接测试适配器
    adapter_result = test_adapter_directly()
    
    # 总结
    print(f"\n{'=' * 50}")
    print("=== 测试总结 ===")
    print(f"RagFlow直接调用: {'✓ 成功' if ragflow_result else '✗ 失败'}")
    print(f"后端API调用: {'✓ 成功' if backend_result else '✗ 失败'}")
    print(f"适配器直接调用: {'✓ 成功' if adapter_result else '✗ 失败'}")
    
    if backend_result:
        success = backend_result.get('success')
        print(f"\n后端返回的success字段: {success}")
        if not success:
            print(f"失败原因: {backend_result.get('error_message', '未知')}")

if __name__ == "__main__":
    main()
