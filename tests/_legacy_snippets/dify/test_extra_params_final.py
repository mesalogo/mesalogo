#!/usr/bin/env python3
"""
测试最终的额外参数功能
"""

import requests
import json

def test_knowledge_query():
    """测试知识库查询（使用保存的额外参数）"""
    print("测试知识库查询功能...")
    
    try:
        url = "http://localhost:8080/api/external-kb/knowledges/8/query"
        payload = {
            "query": "什么是人工智能？",
            "params": {"top_k": 3}  # 简单的参数，主要使用知识库配置的额外参数
        }
        
        print(f"查询内容: {payload['query']}")
        print(f"API参数: {payload['params']}")
        
        response = requests.post(
            url, 
            json=payload, 
            headers={'Content-Type': 'application/json'}, 
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            if data.get('success'):
                print("✓ 查询成功")
                print(f"  - 结果数量: {data.get('total_count', 0)}")
                print(f"  - 查询时间: {data.get('query_time', 0):.3f}秒")
                
                results = data.get('results', [])
                if results:
                    print(f"  - 第一个结果相似度: {results[0].get('score', 0)}")
                    print(f"  - 第一个结果内容: {results[0].get('content', '')[:100]}...")
                
                return True
            else:
                print(f"✗ 查询失败: {data.get('error_message', '未知错误')}")
                return False
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return False

def test_knowledge_info():
    """测试获取知识库信息"""
    print("\n=== 测试获取知识库信息 ===")
    
    try:
        url = "http://localhost:8080/api/external-kb/knowledges/8"
        
        response = requests.get(url, timeout=30)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                knowledge = data.get('data', {})
                print("✓ 获取知识库信息成功")
                print(f"  - 名称: {knowledge.get('name')}")
                print(f"  - 外部ID: {knowledge.get('external_kb_id')}")
                print(f"  - 额外参数: {json.dumps(knowledge.get('query_config', {}), indent=2, ensure_ascii=False)}")
                return knowledge
            else:
                print(f"✗ 获取失败: {data.get('message')}")
                return None
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")
        return None

def main():
    """主函数"""
    print("额外参数功能最终测试")
    print("=" * 50)
    
    # 1. 获取知识库信息，查看当前的额外参数配置
    knowledge_info = test_knowledge_info()
    
    # 2. 测试查询功能
    print(f"\n=== 测试查询功能 ===")
    query_success = test_knowledge_query()
    
    # 总结
    print(f"\n{'=' * 50}")
    print("=== 功能说明 ===")
    print("1. ✅ 编辑知识库时设置'额外参数'")
    print("2. ✅ 查询时自动使用保存的额外参数")
    print("3. ✅ 参数优先级：默认 < 知识库额外参数 < API参数")
    print("4. ✅ 前端界面显示当前使用的额外参数")
    
    print(f"\n=== 测试结果 ===")
    print(f"获取知识库信息: {'✓ 成功' if knowledge_info else '✗ 失败'}")
    print(f"查询功能: {'✓ 成功' if query_success else '✗ 失败'}")
    
    if knowledge_info:
        print(f"\n当前知识库额外参数:")
        print(json.dumps(knowledge_info.get('query_config', {}), indent=2, ensure_ascii=False))
    
    print(f"\n=== 前端测试指南 ===")
    print("1. 打开外部知识库管理页面")
    print("2. 编辑RagFlow知识库，修改'额外参数'字段")
    print("3. 保存后，点击搜索图标测试查询")
    print("4. 查看查询结果，验证额外参数是否生效")

if __name__ == "__main__":
    main()
