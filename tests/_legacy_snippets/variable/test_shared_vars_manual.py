#!/usr/bin/env python3
"""
手动测试共享环境变量功能
"""

import requests
import json
import sys

# 配置
BASE_URL = "http://localhost:8080/api"

def test_create_shared_variable():
    """测试创建共享环境变量"""
    print("测试创建共享环境变量...")
    
    data = {
        'name': 'test_shared_var',
        'label': '测试共享变量',
        'type': 'text',
        'default_value': 'shared_value',
        'description': '这是一个测试共享变量',
        'is_readonly': False
    }
    
    try:
        response = requests.post(f"{BASE_URL}/shared-environment-variables", json=data)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ 创建成功: {result['name']}")
            return result['id']
        else:
            print(f"❌ 创建失败")
            return None
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return None

def test_get_all_shared_variables():
    """测试获取所有共享环境变量"""
    print("\n测试获取所有共享环境变量...")
    
    try:
        response = requests.get(f"{BASE_URL}/shared-environment-variables")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 获取成功，共 {len(result)} 个变量")
            return result
        else:
            print(f"❌ 获取失败")
            return []
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return []

def test_get_shared_variable_by_id(variable_id):
    """测试根据ID获取共享环境变量"""
    print(f"\n测试获取共享环境变量 ID: {variable_id}...")
    
    try:
        response = requests.get(f"{BASE_URL}/shared-environment-variables/{variable_id}")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 获取成功: {result['name']}")
            return result
        else:
            print(f"❌ 获取失败")
            return None
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return None

def test_create_action_space():
    """测试创建行动空间"""
    print("\n测试创建行动空间...")
    
    data = {
        'name': '测试行动空间',
        'description': '用于测试共享变量绑定的行动空间'
    }
    
    try:
        response = requests.post(f"{BASE_URL}/action-spaces", json=data)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ 创建成功: {result['name']}")
            return result['id']
        else:
            print(f"❌ 创建失败")
            return None
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return None

def test_bind_shared_variable(space_id, variable_id):
    """测试绑定共享环境变量到行动空间"""
    print(f"\n测试绑定共享变量 {variable_id} 到行动空间 {space_id}...")
    
    try:
        response = requests.post(f"{BASE_URL}/action-spaces/{space_id}/shared-variables/{variable_id}")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ 绑定成功")
            return True
        else:
            print(f"❌ 绑定失败")
            return False
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return False

def test_get_action_space_shared_variables(space_id):
    """测试获取行动空间绑定的共享环境变量"""
    print(f"\n测试获取行动空间 {space_id} 的共享变量...")
    
    try:
        response = requests.get(f"{BASE_URL}/action-spaces/{space_id}/shared-variables")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 获取成功，共 {len(result)} 个绑定变量")
            return result
        else:
            print(f"❌ 获取失败")
            return []
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return []

def main():
    """主测试函数"""
    print("开始测试共享环境变量功能...")
    print("=" * 50)
    
    # 测试创建共享环境变量
    variable_id = test_create_shared_variable()
    if not variable_id:
        print("❌ 创建共享变量失败，停止测试")
        return
    
    # 测试获取所有共享环境变量
    variables = test_get_all_shared_variables()
    
    # 测试根据ID获取共享环境变量
    variable = test_get_shared_variable_by_id(variable_id)
    
    # 测试创建行动空间
    space_id = test_create_action_space()
    if not space_id:
        print("❌ 创建行动空间失败，跳过绑定测试")
        return
    
    # 测试绑定共享变量到行动空间
    bind_success = test_bind_shared_variable(space_id, variable_id)
    
    if bind_success:
        # 测试获取行动空间的共享变量
        bound_variables = test_get_action_space_shared_variables(space_id)
    
    print("\n" + "=" * 50)
    print("测试完成！")

if __name__ == "__main__":
    main()
