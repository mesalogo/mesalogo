#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
调试外部环境变量数据传输问题
"""

import os
import sys
import json
import requests
from datetime import datetime

# 添加项目根目录到Python路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# API基础URL
BASE_URL = 'http://localhost:8080/api'

def test_create_with_all_fields():
    """测试创建包含所有字段的外部变量"""
    print("=" * 50)
    print("测试创建外部变量（包含所有字段）")
    print("=" * 50)
    
    test_data = {
        'name': 'debug_test_var',
        'label': '调试测试变量',
        'description': '用于调试的测试变量，包含所有字段',
        'api_url': 'http://localhost:8080/health',
        'api_method': 'GET',
        'api_headers': '{"X-Test-Header": "test-value", "Content-Type": "application/json"}',
        'data_path': 'status',
        'data_type': 'string',
        'timeout': 15,
        'sync_interval': 60,
        'sync_enabled': True
    }
    
    print("发送的数据:")
    print(json.dumps(test_data, indent=2, ensure_ascii=False))
    
    try:
        response = requests.post(
            f'{BASE_URL}/external-variables',
            json=test_data,
            timeout=10
        )
        
        print(f"\n响应状态码: {response.status_code}")
        
        if response.status_code == 201:
            created_var = response.json()
            print("创建成功！返回的数据:")
            print(json.dumps(created_var, indent=2, ensure_ascii=False))
            
            # 验证所有字段是否正确保存
            print("\n字段验证:")
            for field, expected_value in test_data.items():
                actual_value = created_var.get(field)
                if str(actual_value) == str(expected_value):
                    print(f"✓ {field}: {actual_value}")
                else:
                    print(f"✗ {field}: 期望 {expected_value}, 实际 {actual_value}")
            
            return created_var['id']
        else:
            print("创建失败！")
            try:
                error = response.json()
                print("错误信息:", json.dumps(error, indent=2, ensure_ascii=False))
            except:
                print("响应内容:", response.text)
            return None
            
    except Exception as e:
        print(f"请求异常: {e}")
        return None

def test_get_variable(var_id):
    """测试获取变量详情"""
    print("\n" + "=" * 50)
    print("测试获取变量详情")
    print("=" * 50)
    
    try:
        response = requests.get(f'{BASE_URL}/external-variables', timeout=10)
        
        if response.status_code == 200:
            variables = response.json()
            test_var = next((v for v in variables if v['id'] == var_id), None)
            
            if test_var:
                print("获取成功！变量详情:")
                print(json.dumps(test_var, indent=2, ensure_ascii=False))
                return test_var
            else:
                print(f"未找到ID为 {var_id} 的变量")
                return None
        else:
            print(f"获取失败，状态码: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"请求异常: {e}")
        return None

def test_update_variable(var_id):
    """测试更新变量"""
    print("\n" + "=" * 50)
    print("测试更新变量")
    print("=" * 50)
    
    update_data = {
        'name': 'debug_test_var',
        'label': '更新后的调试测试变量',
        'description': '更新后的描述信息',
        'api_url': 'http://localhost:8080/health',
        'api_method': 'GET',
        'api_headers': '{"X-Updated-Header": "updated-value", "Authorization": "Bearer test-token"}',
        'data_path': 'status',
        'data_type': 'string',
        'timeout': 20,
        'sync_interval': 120,
        'sync_enabled': True
    }
    
    print("更新的数据:")
    print(json.dumps(update_data, indent=2, ensure_ascii=False))
    
    try:
        response = requests.put(
            f'{BASE_URL}/external-variables/{var_id}',
            json=update_data,
            timeout=10
        )
        
        print(f"\n响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            updated_var = response.json()
            print("更新成功！返回的数据:")
            print(json.dumps(updated_var, indent=2, ensure_ascii=False))
            
            # 验证更新的字段
            print("\n更新字段验证:")
            for field, expected_value in update_data.items():
                actual_value = updated_var.get(field)
                if str(actual_value) == str(expected_value):
                    print(f"✓ {field}: {actual_value}")
                else:
                    print(f"✗ {field}: 期望 {expected_value}, 实际 {actual_value}")
            
            return updated_var
        else:
            print("更新失败！")
            try:
                error = response.json()
                print("错误信息:", json.dumps(error, indent=2, ensure_ascii=False))
            except:
                print("响应内容:", response.text)
            return None
            
    except Exception as e:
        print(f"请求异常: {e}")
        return None

def test_sync_variable(var_id):
    """测试同步变量"""
    print("\n" + "=" * 50)
    print("测试同步变量")
    print("=" * 50)
    
    try:
        response = requests.post(f'{BASE_URL}/external-variables/{var_id}/sync', timeout=15)
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("同步成功！结果:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return True
        else:
            print("同步失败！")
            try:
                error = response.json()
                print("错误信息:", json.dumps(error, indent=2, ensure_ascii=False))
            except:
                print("响应内容:", response.text)
            return False
            
    except Exception as e:
        print(f"请求异常: {e}")
        return False

def cleanup_test_variable(var_id):
    """清理测试变量"""
    print("\n" + "=" * 50)
    print("清理测试变量")
    print("=" * 50)
    
    try:
        response = requests.delete(f'{BASE_URL}/external-variables/{var_id}', timeout=10)
        
        if response.status_code == 200:
            print("清理成功！")
            return True
        else:
            print(f"清理失败，状态码: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"清理异常: {e}")
        return False

def main():
    """主测试函数"""
    print("外部环境变量数据传输调试")
    print("时间:", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    
    # 1. 测试创建
    var_id = test_create_with_all_fields()
    if not var_id:
        print("创建测试失败，退出")
        return False
    
    # 2. 测试获取
    var_data = test_get_variable(var_id)
    if not var_data:
        print("获取测试失败")
    
    # 3. 测试更新
    updated_var = test_update_variable(var_id)
    if not updated_var:
        print("更新测试失败")
    
    # 4. 测试同步
    sync_success = test_sync_variable(var_id)
    if not sync_success:
        print("同步测试失败")
    
    # 5. 再次获取验证
    final_var = test_get_variable(var_id)
    if final_var:
        print("\n" + "=" * 50)
        print("最终状态验证")
        print("=" * 50)
        print("最终变量状态:")
        print(json.dumps(final_var, indent=2, ensure_ascii=False))
    
    # 6. 清理
    cleanup_test_variable(var_id)
    
    print("\n" + "=" * 50)
    print("调试测试完成")
    print("=" * 50)
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
