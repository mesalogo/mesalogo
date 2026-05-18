#!/usr/bin/env python3
"""
测试动态参数功能
"""

import requests
import json

def test_dynamic_params():
    """测试动态参数功能"""
    print("测试动态参数功能...")
    
    # 测试1: 使用默认参数
    print("\n=== 测试1: 使用默认参数 ===")
    test_query_with_params({
        "top_k": 3
    })
    
    # 测试2: 使用自定义参数
    print("\n=== 测试2: 使用自定义参数 ===")
    test_query_with_params({
        "top_k": 5,
        "similarity_threshold": 0.8,
        "vector_similarity_weight": 0.4,
        "keywords_similarity_weight": 0.6,
        "rerank": False
    })
    
    # 测试3: 测试参数优先级
    print("\n=== 测试3: 测试参数优先级 ===")
    test_query_with_params({
        "top_k": 1,  # 这个应该覆盖默认值
        "similarity_threshold": 0.9  # 这个应该覆盖知识库配置
    })

def test_query_with_params(params):
    """使用指定参数测试查询"""
    try:
        url = "http://localhost:8080/api/external-kb/knowledges/8/query"
        payload = {
            "query": "什么是人工智能？",
            "params": params
        }
        
        print(f"查询参数: {json.dumps(params, indent=2, ensure_ascii=False)}")
        
        response = requests.post(
            url, 
            json=payload, 
            headers={'Content-Type': 'application/json'}, 
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                print("✓ 查询成功")
                print(f"  - 结果数量: {data.get('total_count', 0)}")
                print(f"  - 查询时间: {data.get('query_time', 0):.3f}秒")
                
                results = data.get('results', [])
                if results:
                    print(f"  - 第一个结果相似度: {results[0].get('score', 0)}")
                    print(f"  - 第一个结果内容: {results[0].get('content', '')[:50]}...")
            else:
                print(f"✗ 查询失败: {data.get('error_message', '未知错误')}")
        else:
            print(f"✗ HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"✗ 请求异常: {e}")

def test_frontend_integration():
    """测试前端集成"""
    print("\n=== 测试前端集成 ===")
    print("请在浏览器中打开外部知识库管理页面，")
    print("点击RagFlow知识库的搜索图标，")
    print("在弹出的测试查询模态框中：")
    print("1. 输入查询内容：什么是人工智能？")
    print("2. 修改查询参数，例如：")
    print(json.dumps({
        "top_k": 5,
        "similarity_threshold": 0.8,
        "vector_similarity_weight": 0.4,
        "keywords_similarity_weight": 0.6,
        "rerank": False
    }, indent=2, ensure_ascii=False))
    print("3. 点击执行查询，查看结果")

def main():
    """主函数"""
    print("动态参数功能测试")
    print("=" * 50)
    
    # 测试后端API
    test_dynamic_params()
    
    # 提示前端测试
    test_frontend_integration()
    
    print(f"\n{'=' * 50}")
    print("测试完成！")
    print("\n新功能说明：")
    print("1. ✅ 查询配置改名为'额外参数'")
    print("2. ✅ 测试查询支持动态调整参数")
    print("3. ✅ 参数优先级：默认 < 知识库配置 < 动态参数")
    print("4. ✅ 前端界面更新，支持实时参数调整")

if __name__ == "__main__":
    main()
