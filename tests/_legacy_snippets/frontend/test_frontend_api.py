#!/usr/bin/env python3
"""
测试前端API调用
验证外部知识库查询功能
"""

import requests
import json

def test_external_knowledge_query():
    """测试外部知识库查询API"""
    print("测试外部知识库查询API...")
    
    # 测试查询API
    url = "http://localhost:8080/api/external-kb/knowledges/8/query"
    payload = {
        "query": "什么是人工智能？",
        "params": {
            "top_k": 3
        }
    }
    
    try:
        response = requests.post(
            url, 
            json=payload, 
            headers={'Content-Type': 'application/json'}, 
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 查询成功")
            print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # 检查响应格式
            if data.get('success'):
                print(f"✓ 查询成功，找到 {data.get('total_count', 0)} 个结果")
                print(f"✓ 查询耗时: {data.get('query_time', 0):.3f}秒")
                
                results = data.get('results', [])
                if results:
                    print(f"✓ 第一个结果预览:")
                    first_result = results[0]
                    print(f"  内容: {first_result.get('content', '')[:100]}...")
                    print(f"  相似度: {first_result.get('score', 0)}")
                    print(f"  元数据: {first_result.get('metadata', {})}")
                else:
                    print("⚠ 没有找到结果")
            else:
                print(f"✗ 查询失败: {data.get('message', '未知错误')}")
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")

def test_get_providers():
    """测试获取提供商列表"""
    print("\n测试获取提供商列表...")
    
    try:
        response = requests.get("http://localhost:8080/api/external-kb/providers", timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 获取提供商列表成功")
            
            if 'data' in data:
                providers = data['data']
                print(f"✓ 找到 {len(providers)} 个提供商")
                
                for provider in providers:
                    print(f"  - {provider.get('name')} ({provider.get('type')})")
            else:
                print("⚠ 响应格式异常")
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")

def test_get_knowledges():
    """测试获取知识库列表"""
    print("\n测试获取知识库列表...")
    
    try:
        response = requests.get("http://localhost:8080/api/external-kb/knowledges", timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✓ 获取知识库列表成功")
            
            if 'data' in data:
                knowledges = data['data']
                print(f"✓ 找到 {len(knowledges)} 个知识库")
                
                for kb in knowledges:
                    print(f"  - {kb.get('name')} (ID: {kb.get('id')}, 外部ID: {kb.get('external_kb_id')})")
            else:
                print("⚠ 响应格式异常")
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")

def main():
    """主测试函数"""
    print("前端API测试")
    print("=" * 50)
    
    # 测试基础API
    test_get_providers()
    test_get_knowledges()
    
    # 测试查询功能
    test_external_knowledge_query()
    
    print("\n" + "=" * 50)
    print("测试完成！")

if __name__ == "__main__":
    main()
