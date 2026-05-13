#!/usr/bin/env python3
"""
测试FastGPT搜索功能 - 搜索"食盐"
"""

import sys
import os
import json
import requests
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from app.services.external_knowledge.fastgpt_adapter import FastGPTAdapter
except ImportError:
    print("无法导入FastGPTAdapter，将使用直接API调用测试")
    FastGPTAdapter = None


def test_fastgpt_search_salt():
    """测试FastGPT搜索"食盐"功能"""
    print("=" * 60)
    print("测试FastGPT搜索功能 - 搜索'食盐'")
    print("=" * 60)
    
    # 测试配置
    config = {
        'base_url': 'https://api.fastgpt.in/api',
        'api_key': 'fastgpt-REPLACE_ME',
        'dataset_id': '67515675b26652c19eaef98e'
    }
    
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"API URL: {config['base_url']}")
    print(f"Dataset ID: {config['dataset_id']}")
    print(f"搜索关键词: 食盐")
    print()
    
    # 方法1: 使用适配器测试（如果可用）
    if FastGPTAdapter:
        print("1. 使用FastGPT适配器测试")
        print("-" * 40)
        
        try:
            adapter = FastGPTAdapter({
                'base_url': config['base_url'],
                'api_key': config['api_key'],
                'provider_type': 'fastgpt'
            })
            
            knowledge_config = {
                'external_kb_id': config['dataset_id'],
                'query_config': {
                    'limit': 3000,
                    'similarity': 0,
                    'searchMode': 'embedding',
                    'usingReRank': False
                }
            }
            
            result = adapter.query_knowledge(knowledge_config, "食盐")
            
            print("适配器查询结果:")
            if result['success']:
                print(f"✓ 查询成功")
                print(f"  - 结果数量: {result['total_count']}")
                print(f"  - 查询耗时: {result['query_time']:.2f}秒")
                
                for i, item in enumerate(result['results'][:3]):
                    print(f"  - 结果 {i+1}:")
                    print(f"    相关度: {item['score']:.4f}")
                    print(f"    内容预览: {item['content'][:100]}...")
                    if item['metadata'].get('source_name'):
                        print(f"    来源: {item['metadata']['source_name']}")
            else:
                print(f"❌ 查询失败: {result['error_message']}")
            
            print()
            
        except Exception as e:
            print(f"❌ 适配器测试失败: {str(e)}")
            print()
    
    # 方法2: 直接API调用测试
    print("2. 直接API调用测试")
    print("-" * 40)
    
    try:
        url = f"{config['base_url']}/core/dataset/searchTest"
        headers = {
            'Authorization': f"Bearer {config['api_key']}",
            'Content-Type': 'application/json'
        }
        
        payload = {
            'datasetId': config['dataset_id'],
            'text': '食盐',
            'limit': 3000,
            'similarity': 0,
            'searchMode': 'embedding',
            'usingReRank': False
        }
        
        print(f"请求URL: {url}")
        print(f"请求payload:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        print()
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            try:
                result_data = response.json()
                print("✓ API调用成功")
                print(f"响应数据类型: {type(result_data)}")
                
                if isinstance(result_data, list):
                    print(f"返回结果数量: {len(result_data)}")
                    
                    for i, item in enumerate(result_data[:3]):
                        print(f"\n结果 {i+1}:")
                        print(f"  ID: {item.get('id', 'N/A')}")
                        print(f"  相关度: {item.get('score', 0):.4f}")
                        print(f"  问题: {item.get('q', 'N/A')[:100]}...")
                        if item.get('a'):
                            print(f"  答案: {item.get('a', 'N/A')[:100]}...")
                        print(f"  来源: {item.get('sourceName', 'N/A')}")
                        print(f"  集合ID: {item.get('collectionId', 'N/A')}")
                
                elif isinstance(result_data, dict):
                    print("响应数据结构:")
                    print(json.dumps(result_data, indent=2, ensure_ascii=False)[:500] + "...")
                
                else:
                    print(f"未知的响应数据格式: {result_data}")
                    
            except json.JSONDecodeError as e:
                print(f"❌ JSON解析失败: {str(e)}")
                print(f"原始响应: {response.text[:500]}...")
                
        else:
            print(f"❌ API调用失败")
            print(f"错误信息: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 网络请求失败: {str(e)}")
    except Exception as e:
        print(f"❌ 直接API测试失败: {str(e)}")
    
    print()
    
    # 方法3: 测试不同搜索模式
    print("3. 测试不同搜索模式")
    print("-" * 40)
    
    search_modes = ['embedding', 'fullTextRecall', 'mixedRecall']
    
    for mode in search_modes:
        try:
            url = f"{config['base_url']}/core/dataset/searchTest"
            headers = {
                'Authorization': f"Bearer {config['api_key']}",
                'Content-Type': 'application/json'
            }
            
            payload = {
                'datasetId': config['dataset_id'],
                'text': '食盐',
                'limit': 1000,
                'similarity': 0,
                'searchMode': mode,
                'usingReRank': False
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            
            if response.status_code == 200:
                result_data = response.json()
                if isinstance(result_data, list):
                    print(f"✓ {mode}: 返回 {len(result_data)} 个结果")
                else:
                    print(f"✓ {mode}: 返回数据格式 {type(result_data)}")
            else:
                print(f"❌ {mode}: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ {mode}: {str(e)}")
    
    print()
    print("=" * 60)
    print("FastGPT搜索测试完成")
    print("=" * 60)


if __name__ == '__main__':
    test_fastgpt_search_salt()
