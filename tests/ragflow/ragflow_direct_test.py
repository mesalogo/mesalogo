#!/usr/bin/env python3

import requests
import json

print("直接测试RagFlow API...")

# RagFlow配置
base_url = 'http://localhost:7080'
api_key = 'ragflow-REPLACE_ME'
dataset_id = 'f9b0243836bc11f096a90242c0a81006'

# 测试1: 获取数据集列表
print("\n=== 测试1: 获取数据集列表 ===")
try:
    url = f'{base_url}/api/v1/datasets'
    headers = {'Authorization': f'Bearer {api_key}'}
    params = {'page': 1, 'page_size': 1}
    
    response = requests.get(url, headers=headers, params=params, timeout=30)
    print(f'状态码: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print('✓ 获取数据集列表成功')
        print(f'响应: {json.dumps(data, indent=2, ensure_ascii=False)}')
    else:
        print(f'✗ 失败: {response.text}')
        
except Exception as e:
    print(f'✗ 异常: {e}')

# 测试2: 获取指定数据集
print(f"\n=== 测试2: 获取数据集 {dataset_id} ===")
try:
    url = f'{base_url}/api/v1/datasets'
    headers = {'Authorization': f'Bearer {api_key}'}
    params = {'id': dataset_id}
    
    response = requests.get(url, headers=headers, params=params, timeout=30)
    print(f'状态码: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print('✓ 获取数据集成功')
        print(f'响应: {json.dumps(data, indent=2, ensure_ascii=False)}')
    else:
        print(f'✗ 失败: {response.text}')
        
except Exception as e:
    print(f'✗ 异常: {e}')

# 测试3: chunks检索
print(f"\n=== 测试3: chunks检索 ===")
try:
    url = f'{base_url}/api/v1/datasets/{dataset_id}/chunks/retrieval'
    headers = {
        'Authorization': f'Bearer {api_key}',
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
    print(f'状态码: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print('✓ chunks检索成功')
        print(f'响应: {json.dumps(data, indent=2, ensure_ascii=False)}')
    else:
        print(f'✗ 失败: {response.text}')
        
except Exception as e:
    print(f'✗ 异常: {e}')

print("\n测试完成！")
