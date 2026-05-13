#!/usr/bin/env python3
"""
调试API响应格式
"""

import requests
import json

def test_api_response():
    """测试API响应格式"""
    print("测试外部知识库查询API响应格式...")
    
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
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("✓ JSON解析成功")
                print(f"响应数据结构:")
                print(f"  - 类型: {type(data)}")
                print(f"  - 键: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")
                print(f"完整响应数据:")
                print(json.dumps(data, indent=2, ensure_ascii=False))
                
                # 检查前端期望的字段
                print(f"\n前端期望字段检查:")
                print(f"  - success: {data.get('success')} ({type(data.get('success'))})")
                print(f"  - total_count: {data.get('total_count')} ({type(data.get('total_count'))})")
                print(f"  - query_time: {data.get('query_time')} ({type(data.get('query_time'))})")
                print(f"  - results: {type(data.get('results'))} (长度: {len(data.get('results', []))})")
                print(f"  - message: {data.get('message')}")
                print(f"  - error_message: {data.get('error_message')}")
                
                # 如果有结果，显示第一个结果的结构
                results = data.get('results', [])
                if results:
                    print(f"\n第一个结果结构:")
                    first_result = results[0]
                    print(f"  - 类型: {type(first_result)}")
                    if isinstance(first_result, dict):
                        print(f"  - 键: {list(first_result.keys())}")
                        print(f"  - content: {first_result.get('content', '')[:100]}...")
                        print(f"  - score: {first_result.get('score')}")
                        print(f"  - metadata: {first_result.get('metadata')}")
                
            except json.JSONDecodeError as e:
                print(f"✗ JSON解析失败: {e}")
                print(f"原始响应内容: {response.text}")
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_api_response()
