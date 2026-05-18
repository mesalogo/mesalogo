#!/usr/bin/env python3
"""
测试修复后的RagFlow API
"""

import sys
import os
import json
import requests

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_ragflow_correct_api():
    """测试正确的RagFlow API端点"""
    print("=== 测试正确的RagFlow API端点 ===")
    
    # 使用正确的API端点
    url = "http://localhost:7080/api/v1/retrieval"
    headers = {
        'Authorization': 'Bearer ragflow-REPLACE_ME',
        'Content-Type': 'application/json'
    }
    
    # 根据官方文档的正确格式
    payload = {
        'question': '什么是人工智能？',
        'datasets': ['f9b0243836bc11f096a90242c0a81006'],  # 数据集ID数组
        'top_k': 3,
        'similarity_threshold': 0.7,
        'vector_similarity_weight': 0.3,
        'keywords_similarity_weight': 0.7,
        'rerank': True
    }
    
    try:
        print(f"请求URL: {url}")
        print(f"请求载荷: {json.dumps(payload, indent=2, ensure_ascii=False)}")
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ RagFlow API调用成功")
            print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # 检查响应结构
            if data.get('code') == 0:
                chunks = data.get('data', {}).get('chunks', [])
                print(f"✓ 找到 {len(chunks)} 个结果")
                
                if chunks:
                    print(f"第一个结果:")
                    first_chunk = chunks[0]
                    print(f"  - 内容: {first_chunk.get('content', '')[:100]}...")
                    print(f"  - 相似度: {first_chunk.get('similarity', 0)}")
                    print(f"  - 文档名: {first_chunk.get('document_name', 'N/A')}")
                
                return True
            else:
                print(f"✗ RagFlow返回错误: {data.get('message', '未知错误')}")
                return False
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return False

def test_backend_api_after_fix():
    """测试修复后的后端API"""
    print(f"\n=== 测试修复后的后端API ===")
    
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
            print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # 检查前端期望的字段
            success = data.get('success')
            print(f"\n前端关键字段检查:")
            print(f"  - success: {success} ({type(success)})")
            
            if success:
                print(f"  - total_count: {data.get('total_count')}")
                print(f"  - query_time: {data.get('query_time')}")
                print(f"  - results数量: {len(data.get('results', []))}")
                
                results = data.get('results', [])
                if results:
                    print(f"  - 第一个结果内容: {results[0].get('content', '')[:100]}...")
                    print(f"  - 第一个结果相似度: {results[0].get('score', 0)}")
                
                print("✓ 后端API返回格式正确，前端应该能正常显示")
                return True
            else:
                error_msg = data.get('error_message', '未知错误')
                print(f"✗ 查询失败: {error_msg}")
                return False
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return False

def test_adapter_directly():
    """直接测试修复后的适配器"""
    print(f"\n=== 测试修复后的适配器 ===")
    
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
            
            success = result.get('success')
            if success:
                print(f"✓ 适配器查询成功，找到 {result.get('total_count', 0)} 个结果")
                return True
            else:
                print(f"✗ 适配器查询失败: {result.get('error_message')}")
                return False
            
    except Exception as e:
        print(f"✗ 适配器测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主函数"""
    print("RagFlow API修复验证")
    print("=" * 50)
    
    results = []
    
    # 1. 测试正确的RagFlow API
    results.append(test_ragflow_correct_api())
    
    # 2. 测试修复后的后端API
    results.append(test_backend_api_after_fix())
    
    # 3. 直接测试适配器
    results.append(test_adapter_directly())
    
    # 总结
    print(f"\n{'=' * 50}")
    print("=== 测试总结 ===")
    
    test_names = [
        "RagFlow正确API调用",
        "后端API调用",
        "适配器直接调用"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status} {name}")
    
    passed = sum(results)
    total = len(results)
    
    print(f"\n通过测试: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 所有测试通过！RagFlow API修复成功！")
        print("现在前端应该能正常显示查询结果了。")
        return 0
    else:
        print("\n❌ 部分测试失败，需要进一步调试")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
