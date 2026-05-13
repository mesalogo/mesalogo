#!/usr/bin/env python3

import requests
import json

print("测试修复后的RagFlow API...")

# 1. 测试正确的RagFlow API端点
print("\n=== 测试正确的RagFlow API ===")
try:
    url = "http://localhost:7080/api/v1/retrieval"
    headers = {
        'Authorization': 'Bearer ragflow-REPLACE_ME',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'question': '什么是人工智能？',
        'datasets': ['f9b0243836bc11f096a90242c0a81006'],
        'top_k': 3,
        'similarity_threshold': 0.7,
        'vector_similarity_weight': 0.3,
        'keywords_similarity_weight': 0.7,
        'rerank': True
    }
    
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✓ RagFlow API调用成功")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
    else:
        print(f"✗ 失败: {response.text}")
        
except Exception as e:
    print(f"✗ 异常: {e}")

# 2. 测试后端API
print(f"\n=== 测试后端API ===")
try:
    url = "http://localhost:8080/api/external-kb/knowledges/8/query"
    payload = {
        "query": "什么是人工智能？",
        "params": {"top_k": 3}
    }
    
    response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'}, timeout=30)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✓ 后端API调用成功")
        print(f"success: {data.get('success')}")
        print(f"total_count: {data.get('total_count')}")
        print(f"query_time: {data.get('query_time')}")
        
        if data.get('success'):
            print("🎉 API修复成功！前端应该能正常显示结果了！")
        else:
            print(f"查询失败: {data.get('error_message')}")
    else:
        print(f"✗ 失败: {response.text}")
        
except Exception as e:
    print(f"✗ 异常: {e}")

print("\n测试完成！")
