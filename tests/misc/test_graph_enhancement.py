#!/usr/bin/env python3
"""
图谱增强功能测试脚本

测试图谱增强相关的API接口和功能
"""

import os
import sys
import json
import requests
import time
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# 测试配置
BASE_URL = 'http://localhost:5000'
API_BASE = f'{BASE_URL}/api'

class GraphEnhancementTester:
    """图谱增强测试类"""
    
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
    
    def log_test(self, test_name, success, message, details=None):
        """记录测试结果"""
        result = {
            'test_name': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   详情: {details}")
    
    def test_get_config(self):
        """测试获取图谱增强配置"""
        try:
            response = self.session.get(f'{API_BASE}/graph-enhancement/config')
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    config = data.get('data', {})
                    self.log_test(
                        '获取配置',
                        True,
                        '成功获取图谱增强配置',
                        f"框架: {config.get('framework')}, 启用: {config.get('enabled')}"
                    )
                    return config
                else:
                    self.log_test('获取配置', False, data.get('message', '未知错误'))
            else:
                self.log_test('获取配置', False, f'HTTP {response.status_code}')
                
        except Exception as e:
            self.log_test('获取配置', False, f'请求异常: {str(e)}')
        
        return None
    
    def test_update_config(self):
        """测试更新图谱增强配置"""
        try:
            test_config = {
                'enabled': True,
                'framework': 'lightrag',
                'name': '测试配置',
                'description': '自动化测试配置',
                'default_query_mode': 'hybrid',
                'top_k': 50,
                'chunk_top_k': 8,
                'llm_config': 'inherit',
                'embedding_config': 'inherit'
            }
            
            response = self.session.post(
                f'{API_BASE}/graph-enhancement/config',
                json=test_config,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test(
                        '更新配置',
                        True,
                        '成功更新图谱增强配置',
                        f"框架: {test_config['framework']}"
                    )
                    return True
                else:
                    self.log_test('更新配置', False, data.get('message', '未知错误'))
            else:
                self.log_test('更新配置', False, f'HTTP {response.status_code}')
                
        except Exception as e:
            self.log_test('更新配置', False, f'请求异常: {str(e)}')
        
        return False
    
    def test_get_status(self):
        """测试获取图谱增强状态"""
        try:
            response = self.session.get(f'{API_BASE}/graph-enhancement/status')
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    status = data.get('data', {})
                    self.log_test(
                        '获取状态',
                        True,
                        '成功获取图谱增强状态',
                        f"状态: {status.get('status')}, 框架: {status.get('framework')}"
                    )
                    return status
                else:
                    self.log_test('获取状态', False, data.get('message', '未知错误'))
            else:
                self.log_test('获取状态', False, f'HTTP {response.status_code}')
                
        except Exception as e:
            self.log_test('获取状态', False, f'请求异常: {str(e)}')
        
        return None
    
    def test_connection(self):
        """测试连接测试"""
        try:
            test_data = {
                'framework': 'lightrag',
                'framework_config': {
                    'working_dir': './test_lightrag_connection'
                }
            }
            
            response = self.session.post(
                f'{API_BASE}/graph-enhancement/test-connection',
                json=test_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                message = data.get('message', '未知结果')
                
                self.log_test(
                    '连接测试',
                    success,
                    message,
                    f"框架: {test_data['framework']}"
                )
                return success
            else:
                self.log_test('连接测试', False, f'HTTP {response.status_code}')
                
        except Exception as e:
            self.log_test('连接测试', False, f'请求异常: {str(e)}')
        
        return False
    
    def test_query(self):
        """测试查询功能"""
        try:
            test_query = {
                'query': '这是一个测试查询',
                'mode': 'hybrid',
                'top_k': 10,
                'chunk_top_k': 5,
                'response_type': 'Multiple Paragraphs'
            }
            
            response = self.session.post(
                f'{API_BASE}/graph-enhancement/test-query',
                json=test_query,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    result = data.get('data', {})
                    response_time = result.get('response_time', 0)
                    self.log_test(
                        '查询测试',
                        True,
                        '查询执行成功',
                        f"响应时间: {response_time:.2f}s"
                    )
                    return True
                else:
                    # 如果是因为未启用或未初始化，这是预期的
                    message = data.get('message', '未知错误')
                    if '未启用' in message or '未初始化' in message:
                        self.log_test(
                            '查询测试',
                            True,
                            '预期结果: ' + message
                        )
                        return True
                    else:
                        self.log_test('查询测试', False, message)
            else:
                self.log_test('查询测试', False, f'HTTP {response.status_code}')
                
        except Exception as e:
            self.log_test('查询测试', False, f'请求异常: {str(e)}')
        
        return False
    
    def test_data_operations(self):
        """测试数据操作功能"""
        # 测试重建索引
        try:
            response = self.session.post(f'{API_BASE}/graph-enhancement/rebuild-index')
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                message = data.get('message', '未知结果')
                
                # 如果是因为未启用，这是预期的
                if not success and '未启用' in message:
                    self.log_test('重建索引', True, '预期结果: ' + message)
                else:
                    self.log_test('重建索引', success, message)
            else:
                self.log_test('重建索引', False, f'HTTP {response.status_code}')
                
        except Exception as e:
            self.log_test('重建索引', False, f'请求异常: {str(e)}')
        
        # 测试清空数据
        try:
            response = self.session.post(f'{API_BASE}/graph-enhancement/clear-graph')
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', False)
                message = data.get('message', '未知结果')
                
                # 如果是因为未启用，这是预期的
                if not success and '未启用' in message:
                    self.log_test('清空数据', True, '预期结果: ' + message)
                else:
                    self.log_test('清空数据', success, message)
            else:
                self.log_test('清空数据', False, f'HTTP {response.status_code}')
                
        except Exception as e:
            self.log_test('清空数据', False, f'请求异常: {str(e)}')
    
    def run_all_tests(self):
        """运行所有测试"""
        print("🚀 开始图谱增强功能测试")
        print("=" * 50)
        
        # 测试基础API
        print("\n📋 测试基础API...")
        config = self.test_get_config()
        self.test_update_config()
        self.test_get_status()
        
        # 测试连接
        print("\n🔗 测试连接功能...")
        self.test_connection()
        
        # 测试查询
        print("\n🔍 测试查询功能...")
        self.test_query()
        
        # 测试数据操作
        print("\n🛠️ 测试数据操作...")
        self.test_data_operations()
        
        # 输出测试结果
        print("\n" + "=" * 50)
        print("📊 测试结果汇总")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"总测试数: {total_tests}")
        print(f"通过: {passed_tests}")
        print(f"失败: {failed_tests}")
        print(f"成功率: {passed_tests/total_tests*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ 失败的测试:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test_name']}: {result['message']}")
        
        # 保存测试结果
        report_file = f"graph_enhancement_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump({
                'summary': {
                    'total_tests': total_tests,
                    'passed_tests': passed_tests,
                    'failed_tests': failed_tests,
                    'success_rate': passed_tests/total_tests*100
                },
                'test_results': self.test_results
            }, f, ensure_ascii=False, indent=2)
        
        print(f"\n📄 详细测试报告已保存到: {report_file}")
        
        return failed_tests == 0

def main():
    """主函数"""
    print("图谱增强功能测试脚本")
    print("确保后端服务正在运行在 http://localhost:5000")
    
    # 检查服务是否可用
    try:
        response = requests.get(f'{BASE_URL}/api/health', timeout=5)
        if response.status_code != 200:
            print("❌ 后端服务不可用，请先启动后端服务")
            return False
    except requests.exceptions.RequestException:
        print("❌ 无法连接到后端服务，请检查服务是否启动")
        return False
    
    # 运行测试
    tester = GraphEnhancementTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 所有测试通过！")
        return True
    else:
        print("\n⚠️ 部分测试失败，请检查上述错误信息")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
