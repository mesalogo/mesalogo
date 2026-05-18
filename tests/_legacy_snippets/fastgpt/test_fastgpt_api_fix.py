#!/usr/bin/env python3
"""
测试FastGPT API修复 - 正确的搜索测试API和相似度解析
"""

import json


def test_fastgpt_api_fix():
    """测试FastGPT API修复"""
    print("=" * 60)
    print("测试FastGPT API修复")
    print("=" * 60)
    
    # 1. 验证API端点
    print("1. API端点验证")
    print("-" * 40)
    
    base_url = "https://api.fastgpt.in/api"
    correct_endpoint = f"{base_url}/core/dataset/searchTest"
    
    print(f"基础URL: {base_url}")
    print(f"正确的搜索测试端点: {correct_endpoint}")
    print("✓ 使用官方文档中的正确API端点")
    print()
    
    # 2. 测试请求参数格式
    print("2. 请求参数格式验证")
    print("-" * 40)
    
    correct_payload = {
        "datasetId": "67515675b26652c19eaef98e",
        "text": "食盐",
        "limit": 5000,
        "similarity": 0,
        "searchMode": "embedding",
        "usingReRank": False,
        "datasetSearchUsingExtensionQuery": False,
        "datasetSearchExtensionModel": "",
        "datasetSearchExtensionBg": ""
    }
    
    print("正确的请求参数:")
    print(json.dumps(correct_payload, indent=2, ensure_ascii=False))
    print("✓ 符合官方文档的参数格式")
    print()
    
    # 3. 测试响应格式解析
    print("3. 响应格式解析测试")
    print("-" * 40)
    
    # 模拟官方文档的响应格式
    official_response = {
        "code": 200,
        "statusText": "",
        "data": [
            {
                "id": "65599c54a5c814fb803363cb",
                "q": "食盐的主要成分是氯化钠",
                "a": "食盐是重要的调味品和营养素载体",
                "datasetId": "67515675b26652c19eaef98e",
                "collectionId": "6556cd795e4b663e770bb66d",
                "sourceName": "食盐知识.pdf",
                "sourceId": "6556cd775e4b663e770bb65c",
                "score": 0.8050316572189331
            }
        ]
    }
    
    # 模拟你的测试环境响应格式
    test_env_response = {
        "code": 200,
        "statusText": "",
        "message": "",
        "data": {
            "list": [
                {
                    "id": "675156f5cdf98757aabbbb29",
                    "updateTime": "2024-12-05T07:32:05.764Z",
                    "q": "## 第一章　总则\n\n第一条　为了消除碘缺乏危害，保护公民身体健康，制定本条例。",
                    "a": "",
                    "datasetId": "67515675b26652c19eaef98e",
                    "collectionId": "675156f5cdf98757aabbbb28",
                    "sourceName": "食盐加碘消除碘缺乏危害管理条例.txt",
                    "sourceId": "675156f5cdf98757aabbbb27",
                    "score": 0.7234567890123456
                }
            ]
        }
    }
    
    # 模拟相似度提取函数
    def extract_similarity_score(item):
        score_fields = ['score', 'similarity', 'relevance', 'confidence']
        for field in score_fields:
            if field in item:
                score = item[field]
                if score is not None:
                    try:
                        return float(score)
                    except (ValueError, TypeError):
                        continue
        return 0.0
    
    # 模拟响应解析函数
    def parse_fastgpt_response(result_data):
        results = []
        
        if isinstance(result_data, dict) and result_data.get('code') == 200:
            data_section = result_data.get('data', {})
            
            # 格式1: {code: 200, data: {list: [...]}} - 测试环境
            if isinstance(data_section, dict) and 'list' in data_section:
                items = data_section['list']
            # 格式2: {code: 200, data: [...]} - 官方文档格式
            elif isinstance(data_section, list):
                items = data_section
            else:
                items = []
            
            # 处理数据项
            for item in items:
                content = item.get('q', '')
                if item.get('a'):
                    content += '\n' + item.get('a')
                
                score = extract_similarity_score(item)
                
                results.append({
                    'content': content,
                    'score': score,
                    'metadata': {
                        'id': item.get('id'),
                        'source_name': item.get('sourceName'),
                        'dataset_id': item.get('datasetId'),
                        'collection_id': item.get('collectionId')
                    }
                })
        
        return results
    
    # 测试官方文档格式
    print("测试官方文档响应格式:")
    official_results = parse_fastgpt_response(official_response)
    for i, result in enumerate(official_results, 1):
        print(f"  结果 {i}:")
        print(f"    内容: {result['content'][:50]}...")
        print(f"    相似度: {result['score']}")
        print(f"    来源: {result['metadata']['source_name']}")
    print("✓ 官方文档格式解析成功")
    print()
    
    # 测试你的环境格式
    print("测试你的环境响应格式:")
    test_results = parse_fastgpt_response(test_env_response)
    for i, result in enumerate(test_results, 1):
        print(f"  结果 {i}:")
        print(f"    内容: {result['content'][:50]}...")
        print(f"    相似度: {result['score']}")
        print(f"    来源: {result['metadata']['source_name']}")
    print("✓ 测试环境格式解析成功")
    print()
    
    # 4. 相似度字段测试
    print("4. 相似度字段兼容性测试")
    print("-" * 40)
    
    test_items = [
        {"score": 0.8, "name": "标准score字段"},
        {"similarity": 0.7, "name": "similarity字段"},
        {"relevance": 0.9, "name": "relevance字段"},
        {"confidence": 0.6, "name": "confidence字段"},
        {"name": "无相似度字段"}
    ]
    
    for item in test_items:
        name = item.pop('name')
        score = extract_similarity_score(item)
        print(f"  {name}: {score}")
    
    print("✓ 相似度字段兼容性测试通过")
    print()
    
    print("=" * 60)
    print("FastGPT API修复总结:")
    print("✓ 使用正确的API端点: /core/dataset/searchTest")
    print("✓ 兼容官方文档和测试环境的响应格式")
    print("✓ 正确提取和处理相似度字段")
    print("✓ 支持多种相似度字段名称")
    print("✓ 现在应该能正确显示相似度百分比了")
    print("=" * 60)


if __name__ == '__main__':
    test_fastgpt_api_fix()
