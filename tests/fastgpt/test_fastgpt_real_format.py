#!/usr/bin/env python3
"""
测试FastGPT真实返回格式处理
"""

import json


def test_fastgpt_real_format():
    """测试FastGPT真实返回格式处理"""
    print("=" * 60)
    print("测试FastGPT真实返回格式处理")
    print("=" * 60)
    
    # 基于你实际测试的返回数据
    real_fastgpt_response = {
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
                    "sourceId": "675156f5cdf98757aabbbb27"
                    # 注意：实际返回中没有score字段
                }
            ]
        }
    }
    
    print("1. 实际FastGPT响应数据结构")
    print("-" * 40)
    print("响应格式: {code: 200, data: {list: [...]}}")
    print("数据项字段:")
    if real_fastgpt_response['data']['list']:
        item = real_fastgpt_response['data']['list'][0]
        for key in item.keys():
            print(f"  - {key}: {type(item[key]).__name__}")
    print()
    
    # 模拟简化后的解析逻辑
    def parse_real_fastgpt_response(result_data):
        results = []
        
        # 处理实际的FastGPT响应格式: {code: 200, data: {list: [...]}}
        if isinstance(result_data, dict) and result_data.get('code') == 200:
            data_section = result_data.get('data', {})
            if isinstance(data_section, dict) and 'list' in data_section:
                for item in data_section['list']:
                    content = item.get('q', '')
                    if item.get('a'):
                        content += '\n' + item.get('a')
                    
                    # 从实际测试看，FastGPT可能没有返回score字段，使用默认值
                    score = item.get('score', 0.0)
                    if isinstance(score, (int, float)):
                        score = float(score)
                    else:
                        score = 0.0
                    
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
                            'update_time': item.get('updateTime')
                        }
                    })
        
        return results
    
    print("2. 解析实际返回数据")
    print("-" * 40)
    
    parsed_results = parse_real_fastgpt_response(real_fastgpt_response)
    
    print(f"解析结果数量: {len(parsed_results)}")
    
    for i, result in enumerate(parsed_results, 1):
        print(f"\n结果 {i}:")
        print(f"  内容长度: {len(result['content'])} 字符")
        print(f"  内容预览: {result['content'][:100]}...")
        print(f"  相似度: {result['score']} (类型: {type(result['score']).__name__})")
        print(f"  来源文件: {result['metadata']['source_name']}")
        print(f"  数据集ID: {result['metadata']['dataset_id']}")
        print(f"  更新时间: {result['metadata']['update_time']}")
    
    print()
    
    print("3. 相似度处理验证")
    print("-" * 40)
    
    # 测试不同的score情况
    test_items = [
        {"q": "测试1", "score": 0.8},  # 有score字段
        {"q": "测试2"},  # 无score字段
        {"q": "测试3", "score": "0.7"},  # 字符串score
        {"q": "测试4", "score": None},  # None score
    ]
    
    for i, item in enumerate(test_items, 1):
        score = item.get('score', 0.0)
        if isinstance(score, (int, float)):
            score = float(score)
        else:
            score = 0.0
        
        print(f"  测试项 {i}: 原始score={item.get('score')} → 处理后score={score}")
    
    print()
    
    print("=" * 60)
    print("FastGPT真实格式处理总结:")
    print("✓ 只处理实际的返回格式: {code: 200, data: {list: [...]}}")
    print("✓ 不做复杂的兼容性处理")
    print("✓ score字段缺失时使用默认值0.0")
    print("✓ 简化的相似度处理逻辑")
    print("✓ 基于真实测试数据的解析")
    print("=" * 60)


if __name__ == '__main__':
    test_fastgpt_real_format()
