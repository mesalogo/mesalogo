#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
外部环境变量功能测试脚本
"""

import os
import sys
import time
import json
import requests
import threading
from datetime import datetime

# 添加项目根目录到Python路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# API基础URL
BASE_URL = 'http://localhost:8080/api'

class ExternalVariablesTester:
    """外部环境变量测试器"""
    
    def __init__(self):
        self.base_url = BASE_URL
        self.test_variable_id = None
        
    def test_health_endpoint(self):
        """测试健康检查端点"""
        print("1. 测试健康检查端点...")
        try:
            response = requests.get('http://localhost:8080/health', timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"   ✓ 健康检查成功: {data}")
                return True
            else:
                print(f"   ✗ 健康检查失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ✗ 健康检查异常: {e}")
            return False
    
    def test_get_variables(self):
        """测试获取外部变量列表"""
        print("2. 测试获取外部变量列表...")
        try:
            response = requests.get(f'{self.base_url}/external-variables', timeout=10)
            if response.status_code == 200:
                variables = response.json()
                print(f"   ✓ 获取成功，共 {len(variables)} 个变量")
                for var in variables:
                    print(f"     - {var['name']}: {var['label']} ({var['status']})")
                return variables
            else:
                print(f"   ✗ 获取失败: {response.status_code}")
                return []
        except Exception as e:
            print(f"   ✗ 获取异常: {e}")
            return []
    
    def test_create_variable(self):
        """测试创建外部变量"""
        print("3. 测试创建外部变量...")
        
        test_data = {
            'name': 'test_health_check',
            'label': '测试健康检查',
            'description': '用于测试的健康检查变量',
            'api_url': 'http://localhost:8080/health',
            'api_method': 'GET',
            'api_headers': '{}',
            'data_path': 'status',
            'data_type': 'string',
            'timeout': 10,
            'sync_interval': 30,
            'sync_enabled': True
        }
        
        try:
            response = requests.post(
                f'{self.base_url}/external-variables',
                json=test_data,
                timeout=10
            )
            
            if response.status_code == 201:
                variable = response.json()
                self.test_variable_id = variable['id']
                print(f"   ✓ 创建成功: ID={variable['id']}, Name={variable['name']}")
                return variable
            else:
                print(f"   ✗ 创建失败: {response.status_code}")
                try:
                    error = response.json()
                    print(f"     错误信息: {error}")
                except:
                    print(f"     响应内容: {response.text}")
                return None
        except Exception as e:
            print(f"   ✗ 创建异常: {e}")
            return None
    
    def test_manual_sync(self):
        """测试手动同步"""
        if not self.test_variable_id:
            print("4. 跳过手动同步测试（没有测试变量ID）")
            return False
            
        print("4. 测试手动同步...")
        try:
            response = requests.post(
                f'{self.base_url}/external-variables/{self.test_variable_id}/sync',
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✓ 同步成功: {result}")
                return True
            else:
                print(f"   ✗ 同步失败: {response.status_code}")
                try:
                    error = response.json()
                    print(f"     错误信息: {error}")
                except:
                    print(f"     响应内容: {response.text}")
                return False
        except Exception as e:
            print(f"   ✗ 同步异常: {e}")
            return False
    
    def test_update_variable(self):
        """测试更新变量"""
        if not self.test_variable_id:
            print("5. 跳过更新测试（没有测试变量ID）")
            return False
            
        print("5. 测试更新变量...")
        
        update_data = {
            'name': 'test_health_check',
            'label': '更新后的测试健康检查',
            'description': '更新后的描述',
            'api_url': 'http://localhost:8080/health',
            'api_method': 'GET',
            'api_headers': '{}',
            'data_path': 'status',
            'data_type': 'string',
            'timeout': 15,
            'sync_interval': 60,
            'sync_enabled': True
        }
        
        try:
            response = requests.put(
                f'{self.base_url}/external-variables/{self.test_variable_id}',
                json=update_data,
                timeout=10
            )
            
            if response.status_code == 200:
                variable = response.json()
                print(f"   ✓ 更新成功: Label={variable['label']}")
                return True
            else:
                print(f"   ✗ 更新失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ✗ 更新异常: {e}")
            return False
    
    def test_monitor_sync(self):
        """测试监控器自动同步"""
        print("6. 测试监控器自动同步（等待90秒）...")
        
        if not self.test_variable_id:
            print("   跳过监控测试（没有测试变量ID）")
            return False
        
        # 获取初始状态
        try:
            response = requests.get(f'{self.base_url}/external-variables', timeout=10)
            if response.status_code == 200:
                variables = response.json()
                test_var = next((v for v in variables if v['id'] == self.test_variable_id), None)
                if test_var:
                    initial_sync = test_var.get('last_sync')
                    print(f"   初始同步时间: {initial_sync}")
                    
                    # 等待监控器同步
                    print("   等待监控器自动同步...")
                    for i in range(9):
                        time.sleep(10)
                        print(f"   等待中... {(i+1)*10}/90 秒")
                    
                    # 检查是否有新的同步
                    response = requests.get(f'{self.base_url}/external-variables', timeout=10)
                    if response.status_code == 200:
                        variables = response.json()
                        test_var = next((v for v in variables if v['id'] == self.test_variable_id), None)
                        if test_var:
                            final_sync = test_var.get('last_sync')
                            print(f"   最终同步时间: {final_sync}")
                            
                            if final_sync != initial_sync:
                                print("   ✓ 监控器自动同步成功")
                                return True
                            else:
                                print("   ✗ 监控器未执行自动同步")
                                return False
        except Exception as e:
            print(f"   ✗ 监控测试异常: {e}")
            return False
    
    def test_delete_variable(self):
        """测试删除变量"""
        if not self.test_variable_id:
            print("7. 跳过删除测试（没有测试变量ID）")
            return False
            
        print("7. 测试删除变量...")
        try:
            response = requests.delete(
                f'{self.base_url}/external-variables/{self.test_variable_id}',
                timeout=10
            )
            
            if response.status_code == 200:
                print("   ✓ 删除成功")
                return True
            else:
                print(f"   ✗ 删除失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ✗ 删除异常: {e}")
            return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print("=" * 50)
        print("外部环境变量功能测试")
        print("=" * 50)
        
        results = []
        
        # 测试健康检查
        results.append(self.test_health_endpoint())
        
        # 测试获取变量列表
        variables = self.test_get_variables()
        results.append(len(variables) >= 0)
        
        # 测试创建变量
        created = self.test_create_variable()
        results.append(created is not None)
        
        # 测试手动同步
        results.append(self.test_manual_sync())
        
        # 测试更新变量
        results.append(self.test_update_variable())
        
        # 测试监控器自动同步
        results.append(self.test_monitor_sync())
        
        # 测试删除变量
        results.append(self.test_delete_variable())
        
        # 总结
        print("\n" + "=" * 50)
        print("测试结果总结")
        print("=" * 50)
        
        passed = sum(results)
        total = len(results)
        
        test_names = [
            "健康检查端点",
            "获取变量列表", 
            "创建变量",
            "手动同步",
            "更新变量",
            "监控器自动同步",
            "删除变量"
        ]
        
        for i, (name, result) in enumerate(zip(test_names, results)):
            status = "✓ 通过" if result else "✗ 失败"
            print(f"{i+1}. {name}: {status}")
        
        print(f"\n总计: {passed}/{total} 个测试通过")
        
        if passed == total:
            print("🎉 所有测试通过！外部环境变量功能正常工作。")
        else:
            print("⚠️  部分测试失败，请检查相关功能。")
        
        return passed == total

if __name__ == '__main__':
    tester = ExternalVariablesTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
