#!/usr/bin/env python3
"""
测试FastGPT相似度解析
"""

import json


def test_fastgpt_score_parsing():
    """测试FastGPT相似度（score）解析"""
    print("=" * 60)
    print("测试FastGPT相似度解析")
    print("=" * 60)
    
    # 模拟实际的FastGPT响应数据（基于你提供的测试结果）
    mock_response = {
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
                    "score": 0.8234567890123456  # 高精度相似度
                },
                {
                    "id": "675156f5cdf98757aabbbb30",
                    "updateTime": "2024-12-05T07:32:05.764Z",
                    "q": "食盐的主要成分是氯化钠",
                    "a": "食盐是重要的调味品和营养素载体",
                    "datasetId": "67515675b26652c19eaef98e",
                    "collectionId": "675156f5cdf98757aabbbb28",
                    "sourceName": "营养学基础.pdf",
                    "sourceId": "675156f5cdf98757aabbbb31",
                    "score": 0.7654321098765432  # 另一个相似度值
                },
                {
                    "id": "675156f5cdf98757aabbbb31",
                    "updateTime": "2024-12-05T07:32:05.764Z",
                    "q": "无相似度的测试项",
                    "a": "",
                    "datasetId": "67515675b26652c19eaef98e",
                    "collectionId": "675156f5cdf98757aabbbb28",
                    "sourceName": "测试文档.txt",
                    "sourceId": "675156f5cdf98757aabbbb32"
                    # 注意：这个项目没有score字段
                }
            ]
        }
    }
    
    print("1. 检查原始响应数据中的score字段")
    print("-" * 50)
    
    for i, item in enumerate(mock_response['data']['list'], 1):
        print(f"项目 {i}:")
        print(f"  ID: {item.get('id')}")
        print(f"  score字段存在: {'score' in item}")
        if 'score' in item:
            print(f"  score值: {item['score']}")
            print(f"  score类型: {type(item['score'])}")
        else:
            print(f"  score值: 无")
        print()
    
    # 模拟当前的解析逻辑
    def parse_fastgpt_response_current(result_data):
        results = []
        
        if isinstance(result_data, dict) and result_data.get('code') == 200:
            data_section = result_data.get('data', {})
            if isinstance(data_section, dict) and 'list' in data_section:
                for item in data_section['list']:
                    content = item.get('q', '')
                    if item.get('a'):
                        content += '\n' + item.get('a')
                    
                    # 当前的score解析逻辑
                    score = item.get('score', 0)
                    
                    results.append({
                        'content': content,
                        'score': score,
                        'metadata': {
                            'id': item.get('id'),
                            'dataset_id': item.get('datasetId'),
                            'collection_id': item.get('collectionId'),
                            'source_name': item.get('sourceName'),
                            'source_id': item.get('sourceId'),
                            'question': item.get('q'),
                            'answer': item.get('a'),
                            'chunk_index': item.get('chunkIndex'),
                            'update_time': item.get('updateTime')
                        }
                    })
        
        return results
    
    print("2. 测试当前解析逻辑的score处理")
    print("-" * 50)
    
    parsed_results = parse_fastgpt_response_current(mock_response)
    
    for i, result in enumerate(parsed_results, 1):
        print(f"解析结果 {i}:")
        print(f"  内容: {result['content'][:50]}...")
        print(f"  相似度: {result['score']}")
        print(f"  相似度类型: {type(result['score'])}")
        print(f"  来源: {result['metadata']['source_name']}")
        print()
    
    # 改进的解析逻辑
    def parse_fastgpt_response_improved(result_data):
        results = []
        
        if isinstance(result_data, dict) and result_data.get('code') == 200:
            data_section = result_data.get('data', {})
            if isinstance(data_section, dict) and 'list' in data_section:
                for item in data_section['list']:
                    content = item.get('q', '')
                    if item.get('a'):
                        content += '\n' + item.get('a')
                    
                    # 改进的score解析逻辑
                    score = item.get('score')
                    if score is None:
                        score = 0.0  # 明确设置为浮点数
                    elif isinstance(score, (int, float)):
                        score = float(score)  # 确保是浮点数
                    else:
                        score = 0.0  # 处理异常情况
                    
                    results.append({
                        'content': content,
                        'score': score,
                        'metadata': {
                            'id': item.get('id'),
                            'dataset_id': item.get('datasetId'),
                            'collection_id': item.get('collectionId'),
                            'source_name': item.get('sourceName'),
                            'source_id': item.get('sourceId'),
                            'question': item.get('q'),
                            'answer': item.get('a'),
                            'chunk_index': item.get('chunkIndex'),
                            'update_time': item.get('updateTime'),
                            'has_score': 'score' in item,  # 添加标记
                            'original_score': item.get('score')  # 保留原始值
                        }
                    })
        
        return results
    
    print("3. 测试改进后的解析逻辑")
    print("-" * 50)
    
    improved_results = parse_fastgpt_response_improved(mock_response)
    
    for i, result in enumerate(improved_results, 1):
        print(f"改进解析结果 {i}:")
        print(f"  内容: {result['content'][:50]}...")
        print(f"  相似度: {result['score']}")
        print(f"  相似度类型: {type(result['score'])}")
        print(f"  有score字段: {result['metadata']['has_score']}")
        print(f"  原始score值: {result['metadata']['original_score']}")
        print(f"  来源: {result['metadata']['source_name']}")
        print()
    
    print("4. 检查可能的问题")
    print("-" * 50)
    
    # 检查可能的问题
    issues = []
    
    for i, item in enumerate(mock_response['data']['list'], 1):
        if 'score' not in item:
            issues.append(f"项目 {i} 缺少score字段")
        elif not isinstance(item['score'], (int, float)):
            issues.append(f"项目 {i} score字段类型错误: {type(item['score'])}")
        elif item['score'] < 0 or item['score'] > 1:
            issues.append(f"项目 {i} score值超出范围[0,1]: {item['score']}")
    
    if issues:
        print("发现的问题:")
        for issue in issues:
            print(f"  ❌ {issue}")
    else:
        print("✓ 没有发现明显问题")
    
    print()
    
    print("=" * 60)
    print("FastGPT相似度解析分析:")
    print("✓ 当前解析逻辑基本正确")
    print("✓ 使用 item.get('score', 0) 获取相似度")
    print("✓ 处理缺失score字段的情况")
    print("⚠️ 可能的问题:")
    print("  - FastGPT可能不总是返回score字段")
    print("  - score值可能为None或其他类型")
    print("  - 需要确保score是有效的浮点数")
    print("=" * 60)


if __name__ == '__main__':
    test_fastgpt_score_parsing()
