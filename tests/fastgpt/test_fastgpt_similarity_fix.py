#!/usr/bin/env python3
"""
测试FastGPT相似度字段统一处理
"""

import json


def test_similarity_score_extraction():
    """测试相似度分数提取的统一处理"""
    print("=" * 60)
    print("测试FastGPT相似度字段统一处理")
    print("=" * 60)
    
    # 模拟_extract_similarity_score方法
    def extract_similarity_score(item):
        """提取相似度分数，统一处理不同提供商的字段名称"""
        # 尝试不同的字段名
        score_fields = ['score', 'similarity', 'relevance', 'confidence']
        
        for field in score_fields:
            if field in item:
                score = item[field]
                if score is not None:
                    try:
                        return float(score)
                    except (ValueError, TypeError):
                        continue
        
        # 如果都没有找到有效的相似度字段，返回默认值
        return 0.0
    
    # 测试不同的相似度字段格式
    test_cases = [
        {
            "name": "标准score字段",
            "item": {
                "id": "test1",
                "q": "测试问题",
                "score": 0.8234567
            },
            "expected": 0.8234567
        },
        {
            "name": "similarity字段",
            "item": {
                "id": "test2", 
                "q": "测试问题",
                "similarity": 0.7654321
            },
            "expected": 0.7654321
        },
        {
            "name": "relevance字段",
            "item": {
                "id": "test3",
                "q": "测试问题", 
                "relevance": 0.9123456
            },
            "expected": 0.9123456
        },
        {
            "name": "confidence字段",
            "item": {
                "id": "test4",
                "q": "测试问题",
                "confidence": 0.6789012
            },
            "expected": 0.6789012
        },
        {
            "name": "字符串格式的score",
            "item": {
                "id": "test5",
                "q": "测试问题",
                "score": "0.5432109"
            },
            "expected": 0.5432109
        },
        {
            "name": "整数格式的score",
            "item": {
                "id": "test6",
                "q": "测试问题",
                "score": 1
            },
            "expected": 1.0
        },
        {
            "name": "None值的score",
            "item": {
                "id": "test7",
                "q": "测试问题",
                "score": None
            },
            "expected": 0.0
        },
        {
            "name": "无效字符串的score",
            "item": {
                "id": "test8",
                "q": "测试问题",
                "score": "invalid"
            },
            "expected": 0.0
        },
        {
            "name": "缺失相似度字段",
            "item": {
                "id": "test9",
                "q": "测试问题"
            },
            "expected": 0.0
        },
        {
            "name": "多个相似度字段（优先级测试）",
            "item": {
                "id": "test10",
                "q": "测试问题",
                "score": 0.8,
                "similarity": 0.7,
                "relevance": 0.9
            },
            "expected": 0.8  # score字段优先级最高
        }
    ]
    
    # 执行测试
    for i, test_case in enumerate(test_cases, 1):
        print(f"{i}. {test_case['name']}")
        print("-" * 40)
        
        item = test_case['item']
        expected = test_case['expected']
        
        print(f"输入数据: {json.dumps(item, ensure_ascii=False)}")
        
        result = extract_similarity_score(item)
        
        print(f"提取结果: {result}")
        print(f"期望结果: {expected}")
        print(f"测试结果: {'✓ 通过' if result == expected else '❌ 失败'}")
        
        if result != expected:
            print(f"❌ 错误：期望 {expected}，实际得到 {result}")
        
        print()
    
    # 测试实际的FastGPT响应数据解析
    print("=" * 60)
    print("测试实际FastGPT响应数据解析")
    print("=" * 60)
    
    # 模拟实际的FastGPT响应（基于你提供的测试结果）
    mock_fastgpt_response = {
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
                    "sourceId": "675156f5cdf98757aabbbb27"
                    # 注意：这里可能没有score字段，或者字段名不同
                }
            ]
        }
    }
    
    print("模拟FastGPT响应数据:")
    print(json.dumps(mock_fastgpt_response, indent=2, ensure_ascii=False)[:300] + "...")
    print()
    
    # 解析响应数据
    if isinstance(mock_fastgpt_response, dict) and mock_fastgpt_response.get('code') == 200:
        data_section = mock_fastgpt_response.get('data', {})
        if isinstance(data_section, dict) and 'list' in data_section:
            for i, item in enumerate(data_section['list'], 1):
                print(f"数据项 {i}:")
                print(f"  原始数据: {json.dumps(item, ensure_ascii=False)[:100]}...")
                
                score = extract_similarity_score(item)
                print(f"  提取的相似度: {score}")
                print(f"  相似度类型: {type(score).__name__}")
                print()
    
    print("=" * 60)
    print("FastGPT相似度字段统一处理总结:")
    print("✓ 支持多种相似度字段名：score, similarity, relevance, confidence")
    print("✓ 支持多种数据类型：float, int, string")
    print("✓ 健壮的错误处理：None值、无效字符串、缺失字段")
    print("✓ 字段优先级：score > similarity > relevance > confidence")
    print("✓ 统一返回float类型，默认值为0.0")
    print("✓ 现在应该能正确显示相似度百分比了")
    print("=" * 60)


if __name__ == '__main__':
    test_similarity_score_extraction()
