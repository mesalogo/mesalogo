#!/usr/bin/env python3
"""
测试内部知识库API的基本功能
"""

import requests
import json

# 配置
BASE_URL = "http://localhost:5000/api"

def test_create_knowledge():
    """测试创建知识库"""
    print("测试创建知识库...")
    
    data = {
        "name": "测试知识库",
        "description": "这是一个测试知识库"
    }
    
    response = requests.post(f"{BASE_URL}/knowledges", json=data)
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            print("✅ 创建知识库成功")
            return result['data']['id']
        else:
            print(f"❌ 创建知识库失败: {result.get('message')}")
    else:
        print(f"❌ 请求失败: {response.status_code}")
    
    return None

def test_get_knowledges():
    """测试获取知识库列表"""
    print("\n测试获取知识库列表...")
    
    response = requests.get(f"{BASE_URL}/knowledges")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            print("✅ 获取知识库列表成功")
            print(f"知识库数量: {len(result['data'])}")
            for kb in result['data']:
                print(f"  - {kb['name']}: {kb['description']}")
            return result['data']
        else:
            print(f"❌ 获取知识库列表失败: {result.get('message')}")
    else:
        print(f"❌ 请求失败: {response.status_code}")
    
    return []

def test_update_knowledge(knowledge_id):
    """测试更新知识库"""
    print(f"\n测试更新知识库 {knowledge_id}...")
    
    data = {
        "name": "更新后的测试知识库",
        "description": "这是更新后的描述"
    }
    
    response = requests.put(f"{BASE_URL}/knowledges/{knowledge_id}", json=data)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            print("✅ 更新知识库成功")
        else:
            print(f"❌ 更新知识库失败: {result.get('message')}")
    else:
        print(f"❌ 请求失败: {response.status_code}")

def test_delete_knowledge(knowledge_id):
    """测试删除知识库"""
    print(f"\n测试删除知识库 {knowledge_id}...")
    
    response = requests.delete(f"{BASE_URL}/knowledges/{knowledge_id}")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            print("✅ 删除知识库成功")
        else:
            print(f"❌ 删除知识库失败: {result.get('message')}")
    else:
        print(f"❌ 请求失败: {response.status_code}")

def main():
    """主测试函数"""
    print("开始测试内部知识库API...")
    
    # 测试获取知识库列表
    test_get_knowledges()
    
    # 测试创建知识库
    knowledge_id = test_create_knowledge()
    
    if knowledge_id:
        # 测试更新知识库
        test_update_knowledge(knowledge_id)
        
        # 再次获取列表验证更新
        test_get_knowledges()
        
        # 测试删除知识库
        test_delete_knowledge(knowledge_id)
        
        # 最后再次获取列表验证删除
        test_get_knowledges()
    
    print("\n测试完成!")

if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请确保后端服务正在运行在 http://localhost:5000")
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {e}")
