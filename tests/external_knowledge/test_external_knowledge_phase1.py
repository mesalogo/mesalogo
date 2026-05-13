#!/usr/bin/env python3
"""
外部知识库功能第一阶段测试脚本

测试内容：
1. 数据库表创建和数据插入
2. 后端API接口功能
3. 前端页面基础功能

运行方式：
python test_scripts/test_external_knowledge_phase1.py
"""

import sys
import os
import requests
import json
import time
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import (
    ExternalKnowledgeProvider, ExternalKnowledge, 
    RoleExternalKnowledge, ExternalKnowledgeQueryLog, Role
)

# 测试配置
BASE_URL = "http://localhost:5000/api"
TEST_RESULTS = []

def log_test_result(test_name, success, message="", details=None):
    """记录测试结果"""
    result = {
        "test_name": test_name,
        "success": success,
        "message": message,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    TEST_RESULTS.append(result)
    
    status = "✓ PASS" if success else "✗ FAIL"
    print(f"{status} {test_name}: {message}")
    if details and not success:
        print(f"    详情: {details}")

def test_database_tables():
    """测试数据库表创建"""
    print("\n=== 测试数据库表创建 ===")
    
    app = create_app()
    with app.app_context():
        try:
            # 检查表是否存在
            inspector = db.inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            required_tables = [
                'external_kb_providers',
                'external_knowledges', 
                'role_external_knowledges',
                'external_kb_query_logs'
            ]
            
            for table in required_tables:
                if table in existing_tables:
                    log_test_result(f"表 {table} 存在检查", True, "表已创建")
                else:
                    log_test_result(f"表 {table} 存在检查", False, "表不存在")
                    return False
            
            # 检查数据
            provider_count = ExternalKnowledgeProvider.query.count()
            knowledge_count = ExternalKnowledge.query.count()
            
            log_test_result("测试数据检查", 
                          provider_count > 0 and knowledge_count > 0,
                          f"提供商: {provider_count}, 知识库: {knowledge_count}")
            
            return True
            
        except Exception as e:
            log_test_result("数据库表检查", False, "检查失败", str(e))
            return False

def test_provider_apis():
    """测试提供商管理API"""
    print("\n=== 测试提供商管理API ===")
    
    # 测试获取提供商列表
    try:
        response = requests.get(f"{BASE_URL}/external-kb/providers")
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                log_test_result("获取提供商列表", True, f"获取到 {len(data.get('data', []))} 个提供商")
            else:
                log_test_result("获取提供商列表", False, data.get('message', '未知错误'))
        else:
            log_test_result("获取提供商列表", False, f"HTTP {response.status_code}")
    except Exception as e:
        log_test_result("获取提供商列表", False, "请求失败", str(e))
    
    # 测试创建提供商
    test_provider_data = {
        "name": "测试提供商",
        "type": "custom",
        "base_url": "https://test-api.example.com",
        "api_key": "test_key_123",
        "config": {"timeout": 30}
    }
    
    try:
        response = requests.post(f"{BASE_URL}/external-kb/providers", json=test_provider_data)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                provider_id = data.get('data', {}).get('id')
                log_test_result("创建提供商", True, f"创建成功，ID: {provider_id}")
                
                # 测试更新提供商
                update_data = {"name": "更新后的测试提供商"}
                update_response = requests.put(f"{BASE_URL}/external-kb/providers/{provider_id}", json=update_data)
                if update_response.status_code == 200:
                    log_test_result("更新提供商", True, "更新成功")
                else:
                    log_test_result("更新提供商", False, f"HTTP {update_response.status_code}")
                
                # 测试连接测试
                test_response = requests.post(f"{BASE_URL}/external-kb/providers/{provider_id}/test")
                if test_response.status_code == 200:
                    log_test_result("测试提供商连接", True, "连接测试完成")
                else:
                    log_test_result("测试提供商连接", False, f"HTTP {test_response.status_code}")
                
                # 清理：删除测试提供商
                delete_response = requests.delete(f"{BASE_URL}/external-kb/providers/{provider_id}")
                if delete_response.status_code == 200:
                    log_test_result("删除提供商", True, "删除成功")
                else:
                    log_test_result("删除提供商", False, f"HTTP {delete_response.status_code}")
                    
            else:
                log_test_result("创建提供商", False, data.get('message', '未知错误'))
        else:
            log_test_result("创建提供商", False, f"HTTP {response.status_code}")
    except Exception as e:
        log_test_result("创建提供商", False, "请求失败", str(e))

def test_knowledge_apis():
    """测试外部知识库管理API"""
    print("\n=== 测试外部知识库管理API ===")
    
    # 先获取一个提供商ID
    try:
        response = requests.get(f"{BASE_URL}/external-kb/providers")
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data'):
                provider_id = data['data'][0]['id']
                
                # 测试获取外部知识库列表
                kb_response = requests.get(f"{BASE_URL}/external-kb/knowledges")
                if kb_response.status_code == 200:
                    kb_data = kb_response.json()
                    if kb_data.get('success'):
                        log_test_result("获取外部知识库列表", True, f"获取到 {len(kb_data.get('data', []))} 个知识库")
                    else:
                        log_test_result("获取外部知识库列表", False, kb_data.get('message', '未知错误'))
                else:
                    log_test_result("获取外部知识库列表", False, f"HTTP {kb_response.status_code}")
                
                # 测试创建外部知识库
                test_kb_data = {
                    "name": "测试外部知识库",
                    "description": "这是一个测试用的外部知识库",
                    "provider_id": provider_id,
                    "external_kb_id": "test_kb_001",
                    "query_config": {
                        "top_k": 5,
                        "similarity_threshold": 0.7,
                        "max_tokens": 4000
                    }
                }
                
                create_response = requests.post(f"{BASE_URL}/external-kb/knowledges", json=test_kb_data)
                if create_response.status_code == 200:
                    create_data = create_response.json()
                    if create_data.get('success'):
                        kb_id = create_data.get('data', {}).get('id')
                        log_test_result("创建外部知识库", True, f"创建成功，ID: {kb_id}")
                        
                        # 测试更新外部知识库
                        update_data = {"description": "更新后的描述"}
                        update_response = requests.put(f"{BASE_URL}/external-kb/knowledges/{kb_id}", json=update_data)
                        if update_response.status_code == 200:
                            log_test_result("更新外部知识库", True, "更新成功")
                        else:
                            log_test_result("更新外部知识库", False, f"HTTP {update_response.status_code}")
                        
                        # 清理：删除测试知识库
                        delete_response = requests.delete(f"{BASE_URL}/external-kb/knowledges/{kb_id}")
                        if delete_response.status_code == 200:
                            log_test_result("删除外部知识库", True, "删除成功")
                        else:
                            log_test_result("删除外部知识库", False, f"HTTP {delete_response.status_code}")
                            
                    else:
                        log_test_result("创建外部知识库", False, create_data.get('message', '未知错误'))
                else:
                    log_test_result("创建外部知识库", False, f"HTTP {create_response.status_code}")
                    
            else:
                log_test_result("获取提供商ID", False, "没有可用的提供商")
        else:
            log_test_result("获取提供商ID", False, f"HTTP {response.status_code}")
    except Exception as e:
        log_test_result("外部知识库API测试", False, "请求失败", str(e))

def test_role_binding_apis():
    """测试角色绑定管理API"""
    print("\n=== 测试角色绑定管理API ===")
    
    app = create_app()
    with app.app_context():
        try:
            # 获取第一个角色和外部知识库
            role = Role.query.first()
            knowledge = ExternalKnowledge.query.first()
            
            if not role or not knowledge:
                log_test_result("角色绑定API测试", False, "缺少测试数据（角色或知识库）")
                return
            
            # 测试获取角色绑定
            response = requests.get(f"{BASE_URL}/roles/{role.id}/external-knowledges")
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    log_test_result("获取角色绑定", True, f"获取到 {len(data.get('data', []))} 个绑定")
                else:
                    log_test_result("获取角色绑定", False, data.get('message', '未知错误'))
            else:
                log_test_result("获取角色绑定", False, f"HTTP {response.status_code}")
            
            # 测试创建绑定
            bind_data = {"config": {"priority": 1}}
            bind_response = requests.post(f"{BASE_URL}/roles/{role.id}/external-knowledges/{knowledge.id}", json=bind_data)
            if bind_response.status_code == 200:
                bind_result = bind_response.json()
                if bind_result.get('success'):
                    log_test_result("创建角色绑定", True, "绑定创建成功")
                    
                    # 测试解除绑定
                    unbind_response = requests.delete(f"{BASE_URL}/roles/{role.id}/external-knowledges/{knowledge.id}")
                    if unbind_response.status_code == 200:
                        log_test_result("解除角色绑定", True, "绑定解除成功")
                    else:
                        log_test_result("解除角色绑定", False, f"HTTP {unbind_response.status_code}")
                else:
                    log_test_result("创建角色绑定", False, bind_result.get('message', '未知错误'))
            else:
                log_test_result("创建角色绑定", False, f"HTTP {bind_response.status_code}")
                
        except Exception as e:
            log_test_result("角色绑定API测试", False, "测试失败", str(e))

def test_frontend_accessibility():
    """测试前端页面可访问性"""
    print("\n=== 测试前端页面可访问性 ===")
    
    # 这里只能测试API的可访问性，前端页面需要手动测试
    try:
        # 测试API是否可访问
        response = requests.get(f"{BASE_URL}/external-kb/providers", timeout=5)
        if response.status_code == 200:
            log_test_result("API服务可访问性", True, "API服务正常运行")
        else:
            log_test_result("API服务可访问性", False, f"HTTP {response.status_code}")
    except Exception as e:
        log_test_result("API服务可访问性", False, "无法连接到API服务", str(e))

def generate_test_report():
    """生成测试报告"""
    print("\n" + "="*60)
    print("外部知识库功能第一阶段测试报告")
    print("="*60)
    
    total_tests = len(TEST_RESULTS)
    passed_tests = len([r for r in TEST_RESULTS if r['success']])
    failed_tests = total_tests - passed_tests
    
    print(f"总测试数: {total_tests}")
    print(f"通过: {passed_tests}")
    print(f"失败: {failed_tests}")
    print(f"成功率: {(passed_tests/total_tests*100):.1f}%")
    
    if failed_tests > 0:
        print("\n失败的测试:")
        for result in TEST_RESULTS:
            if not result['success']:
                print(f"  - {result['test_name']}: {result['message']}")
                if result['details']:
                    print(f"    详情: {result['details']}")
    
    # 保存详细报告到文件
    report_file = f"test_scripts/external_knowledge_phase1_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(TEST_RESULTS, f, ensure_ascii=False, indent=2)
    
    print(f"\n详细报告已保存到: {report_file}")
    
    return failed_tests == 0

def main():
    """主测试函数"""
    print("开始外部知识库功能第一阶段测试...")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 执行各项测试
    test_database_tables()
    test_provider_apis()
    test_knowledge_apis()
    test_role_binding_apis()
    test_frontend_accessibility()
    
    # 生成测试报告
    success = generate_test_report()
    
    if success:
        print("\n🎉 所有测试通过！第一阶段功能正常。")
        return 0
    else:
        print("\n❌ 部分测试失败，请检查问题后重新测试。")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
