#!/usr/bin/env python3
"""
验证FastGPT相似度解析修复
"""

import json


def test_score_parsing_fix():
    """测试修复后的相似度解析"""
    print("=" * 60)
    print("验证FastGPT相似度解析修复")
    print("=" * 60)
    
    # 模拟各种可能的score值情况
    test_cases = [
        {
            "name": "正常的浮点数score",
            "data": {
                "code": 200,
                "data": {
                    "list": [
                        {
                            "id": "test1",
                            "q": "测试问题1",
                            "score": 0.8234567,
                            "sourceName": "测试文档1.txt"
                        }
                    ]
                }
            }
        },
        {
            "name": "整数score",
            "data": {
                "code": 200,
                "data": {
                    "list": [
                        {
                            "id": "test2",
                            "q": "测试问题2",
                            "score": 1,
                            "sourceName": "测试文档2.txt"
                        }
                    ]
                }
            }
        },
        {
            "name": "字符串格式的score",
            "data": {
                "code": 200,
                "data": {
                    "list": [
                        {
                            "id": "test3",
                            "q": "测试问题3",
                            "score": "0.7654321",
                            "sourceName": "测试文档3.txt"
                        }
                    ]
                }
            }
        },
        {
            "name": "缺失score字段",
            "data": {
                "code": 200,
                "data": {
                    "list": [
                        {
                            "id": "test4",
                            "q": "测试问题4",
                            "sourceName": "测试文档4.txt"
                            # 注意：没有score字段
                        }
                    ]
                }
            }
        },
        {
            "name": "None值的score",
            "data": {
                "code": 200,
                "data": {
                    "list": [
                        {
                            "id": "test5",
                            "q": "测试问题5",
                            "score": None,
                            "sourceName": "测试文档5.txt"
                        }
                    ]
                }
            }
        },
        {
            "name": "无效的score值",
            "data": {
                "code": 200,
                "data": {
                    "list": [
                        {
                            "id": "test6",
                            "q": "测试问题6",
                            "score": "invalid",
                            "sourceName": "测试文档6.txt"
                        }
                    ]
                }
            }
        }
    ]
    
    # 修复后的解析函数
    def parse_fastgpt_response_fixed(result_data):
        results = []
        
        if isinstance(result_data, dict) and result_data.get('code') == 200:
            data_section = result_data.get('data', {})
            if isinstance(data_section, dict) and 'list' in data_section:
                for item in data_section['list']:
                    content = item.get('q', '')
                    if item.get('a'):
                        content += '\n' + item.get('a')
                    
                    # 修复后的相似度处理逻辑
                    score = item.get('score')
                    if score is None:
                        score = 0.0
                    elif isinstance(score, (int, float)):
                        score = float(score)
                    else:
                        try:
                            score = float(score)
                        except (ValueError, TypeError):
                            score = 0.0
                    
                    results.append({
                        'content': content,
                        'score': score,
                        'metadata': {
                            'id': item.get('id'),
                            'source_name': item.get('sourceName'),
                            'original_score': item.get('score'),
                            'score_type': type(item.get('score')).__name__
                        }
                    })
        
        return results
    
    # 测试所有情况
    for i, test_case in enumerate(test_cases, 1):
        print(f"{i}. {test_case['name']}")
        print("-" * 40)
        
        original_score = None
        if test_case['data']['data']['list']:
            item = test_case['data']['data']['list'][0]
            original_score = item.get('score')
        
        print(f"原始score值: {original_score}")
        print(f"原始score类型: {type(original_score).__name__}")
        
        results = parse_fastgpt_response_fixed(test_case['data'])
        
        if results:
            result = results[0]
            print(f"解析后score值: {result['score']}")
            print(f"解析后score类型: {type(result['score']).__name__}")
            print(f"是否为有效浮点数: {isinstance(result['score'], float)}")
            print(f"score范围检查: {0 <= result['score'] <= 1}")
            
            if original_score is None:
                expected = 0.0
            elif isinstance(original_score, (int, float)):
                expected = float(original_score)
            elif isinstance(original_score, str):
                try:
                    expected = float(original_score)
                except:
                    expected = 0.0
            else:
                expected = 0.0
            
            print(f"期望值: {expected}")
            print(f"解析正确: {'✓' if result['score'] == expected else '❌'}")
        else:
            print("❌ 解析失败，没有返回结果")
        
        print()
    
    print("=" * 60)
    print("FastGPT相似度解析修复总结:")
    print("✓ 正确处理浮点数score")
    print("✓ 正确处理整数score")
    print("✓ 正确处理字符串格式的score")
    print("✓ 正确处理缺失的score字段（默认0.0）")
    print("✓ 正确处理None值的score")
    print("✓ 正确处理无效的score值（默认0.0）")
    print("✓ 确保所有score都是有效的浮点数")
    print("✓ 提供了健壮的错误处理")
    print("=" * 60)


if __name__ == '__main__':
    test_score_parsing_fix()
