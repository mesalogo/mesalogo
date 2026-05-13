#!/usr/bin/env python3
"""
测试修改密码API功能
"""

import requests
import json
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_change_password_api():
    """测试修改密码API"""
    base_url = "http://localhost:8080/api"
    
    print("=== 测试修改密码API ===")
    
    # 1. 先登录获取token
    print("\n1. 登录获取token...")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{base_url}/auth/login", json=login_data)
        print(f"登录响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            login_result = response.json()
            token = login_result.get('token')
            print(f"登录成功，获取到token: {token[:20]}...")
        else:
            print(f"登录失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"登录请求失败: {e}")
        return False
    
    # 2. 测试修改密码
    print("\n2. 测试修改密码...")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    change_password_data = {
        "new_password": "newpassword123"
    }
    
    try:
        response = requests.post(f"{base_url}/auth/change-password", 
                               json=change_password_data, 
                               headers=headers)
        print(f"修改密码响应状态码: {response.status_code}")
        print(f"修改密码响应内容: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('status') == 'success':
                print("✅ 修改密码成功")
            else:
                print(f"❌ 修改密码失败: {result.get('message')}")
                return False
        else:
            print(f"❌ 修改密码请求失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 修改密码请求异常: {e}")
        return False
    
    # 3. 验证新密码是否生效（尝试用新密码登录）
    print("\n3. 验证新密码是否生效...")
    new_login_data = {
        "username": "admin",
        "password": "newpassword123"
    }
    
    try:
        response = requests.post(f"{base_url}/auth/login", json=new_login_data)
        print(f"新密码登录响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ 新密码登录成功，密码修改验证通过")
        else:
            print(f"❌ 新密码登录失败: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 新密码登录请求失败: {e}")
        return False
    
    # 4. 恢复原密码（为了不影响其他测试）
    print("\n4. 恢复原密码...")
    restore_password_data = {
        "new_password": "admin123"
    }
    
    # 使用新密码获取的token
    new_token = response.json().get('token')
    new_headers = {
        "Authorization": f"Bearer {new_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(f"{base_url}/auth/change-password", 
                               json=restore_password_data, 
                               headers=new_headers)
        print(f"恢复密码响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ 密码已恢复为原始密码")
        else:
            print(f"⚠️  恢复密码失败: {response.text}")
            
    except Exception as e:
        print(f"⚠️  恢复密码请求失败: {e}")
    
    print("\n=== 测试完成 ===")
    return True

def test_change_password_validation():
    """测试修改密码的验证逻辑"""
    base_url = "http://localhost:8080/api"
    
    print("\n=== 测试密码验证逻辑 ===")
    
    # 先登录获取token
    login_data = {"username": "admin", "password": "admin123"}
    response = requests.post(f"{base_url}/auth/login", json=login_data)
    
    if response.status_code != 200:
        print("❌ 无法获取登录token，跳过验证测试")
        return False
    
    token = response.json().get('token')
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 测试空密码
    print("\n1. 测试空密码...")
    response = requests.post(f"{base_url}/auth/change-password", 
                           json={"new_password": ""}, 
                           headers=headers)
    print(f"空密码响应: {response.status_code} - {response.json().get('message')}")
    
    # 测试短密码
    print("\n2. 测试短密码...")
    response = requests.post(f"{base_url}/auth/change-password", 
                           json={"new_password": "123"}, 
                           headers=headers)
    print(f"短密码响应: {response.status_code} - {response.json().get('message')}")
    
    # 测试无token
    print("\n3. 测试无token...")
    response = requests.post(f"{base_url}/auth/change-password", 
                           json={"new_password": "validpassword123"})
    print(f"无token响应: {response.status_code} - {response.json().get('message')}")
    
    print("\n=== 验证测试完成 ===")
    return True

if __name__ == "__main__":
    print("开始测试修改密码API功能...")
    
    # 测试基本功能
    success = test_change_password_api()
    
    # 测试验证逻辑
    test_change_password_validation()
    
    if success:
        print("\n🎉 所有测试通过！")
    else:
        print("\n❌ 测试失败！")
        sys.exit(1)
