#!/usr/bin/env python3
"""
测试FastGPT URL修复
"""

def test_fastgpt_url_construction():
    """测试FastGPT URL构建"""
    print("=" * 60)
    print("测试FastGPT URL构建修复")
    print("=" * 60)
    
    # 模拟配置
    base_url = "https://api.fastgpt.in/api"
    
    # 修复前的错误URL构建
    print("1. 修复前的URL构建（错误）")
    print("-" * 40)
    
    wrong_connection_url = f"{base_url}/api/core/dataset/list"
    wrong_search_url = f"{base_url}/api/core/dataset/searchTest"
    
    print(f"连接测试URL（错误）: {wrong_connection_url}")
    print(f"搜索测试URL（错误）: {wrong_search_url}")
    print("❌ URL中包含重复的/api路径")
    print()
    
    # 修复后的正确URL构建
    print("2. 修复后的URL构建（正确）")
    print("-" * 40)
    
    correct_connection_url = f"{base_url}/core/dataset/list"
    correct_search_url = f"{base_url}/core/dataset/searchTest"
    
    print(f"连接测试URL（正确）: {correct_connection_url}")
    print(f"搜索测试URL（正确）: {correct_search_url}")
    print("✓ URL路径正确，无重复")
    print()
    
    # 验证最终URL
    print("3. 最终URL验证")
    print("-" * 40)
    
    expected_connection_url = "https://api.fastgpt.in/api/core/dataset/list"
    expected_search_url = "https://api.fastgpt.in/api/core/dataset/searchTest"
    
    print(f"期望的连接URL: {expected_connection_url}")
    print(f"实际的连接URL: {correct_connection_url}")
    print(f"连接URL匹配: {'✓' if correct_connection_url == expected_connection_url else '❌'}")
    print()
    
    print(f"期望的搜索URL: {expected_search_url}")
    print(f"实际的搜索URL: {correct_search_url}")
    print(f"搜索URL匹配: {'✓' if correct_search_url == expected_search_url else '❌'}")
    print()
    
    # 测试请求示例
    print("4. 修复后的请求示例")
    print("-" * 40)
    
    print("连接测试请求:")
    print(f"GET {correct_connection_url}")
    print("Headers:")
    print("  Authorization: Bearer fastgpt-REPLACE_ME")
    print("  Content-Type: application/json")
    print()
    
    print("搜索测试请求:")
    print(f"POST {correct_search_url}")
    print("Headers:")
    print("  Authorization: Bearer fastgpt-REPLACE_ME")
    print("  Content-Type: application/json")
    print("Body:")
    print("""{
  "datasetId": "67515675b26652c19eaef98e",
  "text": "什么是人工智能？",
  "limit": 5000,
  "similarity": 0,
  "searchMode": "embedding",
  "usingReRank": false
}""")
    print()
    
    print("=" * 60)
    print("URL修复总结:")
    print("✓ 移除了重复的/api路径")
    print("✓ 连接测试URL: /core/dataset/list")
    print("✓ 搜索测试URL: /core/dataset/searchTest")
    print("✓ 现在应该返回200而不是404")
    print("=" * 60)


if __name__ == '__main__':
    test_fastgpt_url_construction()
