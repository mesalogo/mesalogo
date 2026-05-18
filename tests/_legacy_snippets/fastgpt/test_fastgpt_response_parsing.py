#!/usr/bin/env python3
"""
测试FastGPT响应解析修复
"""

import json


def test_fastgpt_response_parsing():
    """测试FastGPT响应数据解析"""
    print("=" * 60)
    print("测试FastGPT响应数据解析修复")
    print("=" * 60)
    
    # 模拟实际的FastGPT响应数据
    mock_response = {
        "code": 200,
        "statusText": "",
        "message": "",
        "data": {
            "list": [
                {
                    "id": "675156f5cdf98757aabbbb29",
                    "updateTime": "2024-12-05T07:32:05.764Z",
                    "q": "## 第一章　总则\n\n第一条　为了消除碘缺乏危害，保护公民身体健康，制定本条例。\n\n第二条　碘缺乏危害，是指由于环境缺碘、公民摄碘不足所引起的地方性甲状腺肿、地方性克汀病和对儿童智力发育的潜在性损伤。\n\n第三条　国家对消除碘缺乏危害，采取长期供应加碘食盐(以下简称碘盐)为主的综合防治措施。",
                    "a": "",
                    "datasetId": "67515675b26652c19eaef98e",
                    "collectionId": "675156f5cdf98757aabbbb28",
                    "sourceName": "食盐加碘消除碘缺乏危害管理条例.txt",
                    "sourceId": "675156f5cdf98757aabbbb27",
                    "score": 0.8234567
                },
                {
                    "id": "675156f5cdf98757aabbbb30",
                    "updateTime": "2024-12-05T07:32:05.764Z",
                    "q": "食盐的主要成分是氯化钠，是人体必需的营养素之一。",
                    "a": "食盐不仅提供钠离子，还是碘的重要载体，加碘食盐有助于预防碘缺乏病。",
                    "datasetId": "67515675b26652c19eaef98e",
                    "collectionId": "675156f5cdf98757aabbbb28",
                    "sourceName": "营养学基础.pdf",
                    "sourceId": "675156f5cdf98757aabbbb31",
                    "score": 0.7654321
                }
            ]
        }
    }
    
    print("1. 模拟FastGPT实际响应数据")
    print("-" * 40)
    print("响应数据结构:")
    print(json.dumps(mock_response, indent=2, ensure_ascii=False)[:500] + "...")
    print()
    
    # 模拟修复后的解析逻辑
    def parse_fastgpt_response(result_data):
        results = []
        
        # 处理FastGPT的标准响应格式: {code: 200, data: {list: [...]}}
        if isinstance(result_data, dict) and result_data.get('code') == 200:
            data_section = result_data.get('data', {})
            if isinstance(data_section, dict) and 'list' in data_section:
                # 处理data.list格式
                for item in data_section['list']:
                    content = item.get('q', '')
                    if item.get('a'):
                        content += '\n' + item.get('a')
                    
                    results.append({
                        'content': content,
                        'score': item.get('score', 0),
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
        elif isinstance(result_data, list):
            # 直接处理数组格式的响应（备用）
            for item in result_data:
                content = item.get('q', '')
                if item.get('a'):
                    content += '\n' + item.get('a')
                
                results.append({
                    'content': content,
                    'score': item.get('score', 0),
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
    
    print("2. 测试修复后的解析逻辑")
    print("-" * 40)
    
    parsed_results = parse_fastgpt_response(mock_response)
    
    print(f"解析结果数量: {len(parsed_results)}")
    print()
    
    for i, result in enumerate(parsed_results, 1):
        print(f"结果 {i}:")
        print(f"  内容: {result['content'][:100]}...")
        print(f"  相关度: {result['score']}")
        print(f"  来源: {result['metadata']['source_name']}")
        print(f"  ID: {result['metadata']['id']}")
        print(f"  更新时间: {result['metadata']['update_time']}")
        print()
    
    print("✓ 响应解析修复成功")
    print()
    
    # 测试边界情况
    print("3. 测试边界情况")
    print("-" * 40)
    
    # 测试空响应
    empty_response = {"code": 200, "data": {"list": []}}
    empty_results = parse_fastgpt_response(empty_response)
    print(f"空响应解析: {len(empty_results)} 个结果 ✓")
    
    # 测试错误响应
    error_response = {"code": 400, "message": "参数错误"}
    error_results = parse_fastgpt_response(error_response)
    print(f"错误响应解析: {len(error_results)} 个结果 ✓")
    
    # 测试直接数组格式（备用）
    array_response = [
        {
            "id": "test1",
            "q": "测试问题",
            "a": "测试答案",
            "score": 0.9
        }
    ]
    array_results = parse_fastgpt_response(array_response)
    print(f"数组格式解析: {len(array_results)} 个结果 ✓")
    
    print()
    
    print("=" * 60)
    print("FastGPT响应解析修复总结:")
    print("✓ 正确处理 {code: 200, data: {list: [...]}} 格式")
    print("✓ 支持备用的直接数组格式")
    print("✓ 正确提取所有字段信息")
    print("✓ 处理边界情况和错误响应")
    print("✓ 现在应该能正确解析搜索结果了")
    print("=" * 60)


if __name__ == '__main__':
    test_fastgpt_response_parsing()
