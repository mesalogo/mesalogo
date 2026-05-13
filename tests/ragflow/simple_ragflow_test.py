#!/usr/bin/env python3

import requests
import json

# RagFlow配置
base_url = 'http://localhost:7080'
api_key = 'ragflow-REPLACE_ME'
dataset_id = 'f9b0243836bc11f096a90242c0a81006'

print('测试RagFlow API连接...')

# 测试1: 获取数据集列表
try:
    url = f'{base_url}/api/v1/datasets'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    params = {'page': 1, 'page_size': 1}
    
    print(f'请求URL: {url}')
    response = requests.get(url, headers=headers, params=params, timeout=30)
    print(f'响应状态码: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print('✓ 获取数据集列表成功')
        print(f'响应: {json.dumps(data, indent=2, ensure_ascii=False)}')
    else:
        print(f'✗ 获取数据集列表失败: {response.text}')
        
except Exception as e:
    print(f'✗ 请求异常: {e}')

# 测试2: 获取指定数据集信息
try:
    url = f'{base_url}/api/v1/datasets/{dataset_id}'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    print(f'\n请求数据集信息URL: {url}')
    response = requests.get(url, headers=headers, timeout=30)
    print(f'响应状态码: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print('✓ 获取数据集信息成功')
        print(f'数据集信息: {json.dumps(data, indent=2, ensure_ascii=False)}')
    else:
        print(f'✗ 获取数据集信息失败: {response.text}')
        
except Exception as e:
    print(f'✗ 请求异常: {e}')

# 测试3: chunks检索
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
    
    print(f'\nchunks检索URL: {url}')
    print(f'请求载荷: {json.dumps(payload, indent=2, ensure_ascii=False)}')
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    print(f'响应状态码: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print('✓ chunks检索成功')
        print(f'检索结果: {json.dumps(data, indent=2, ensure_ascii=False)}')
    else:
        print(f'✗ chunks检索失败: {response.text}')
        
except Exception as e:
    print(f'✗ 请求异常: {e}')

print('\n测试完成！')
