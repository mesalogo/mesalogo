#!/usr/bin/env python3
"""
外部知识库功能独立测试脚本

测试内容：
1. 数据库模型和表结构
2. 数据操作（增删改查）
3. 模型关系和约束
4. 业务逻辑验证

运行方式：
python test_scripts/test_external_knowledge_standalone.py
"""

import sys
import os
import json
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import (
    ExternalKnowledgeProvider, ExternalKnowledge, 
    RoleExternalKnowledge, ExternalKnowledgeQueryLog, Role
)

# 测试结果记录
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

def test_database_models():
    """测试数据库模型定义"""
    print("\n=== 测试数据库模型定义 ===")
    
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
            
            all_tables_exist = True
            for table in required_tables:
                if table in existing_tables:
                    log_test_result(f"表 {table} 存在检查", True, "表已创建")
                else:
                    log_test_result(f"表 {table} 存在检查", False, "表不存在")
                    all_tables_exist = False
            
            return all_tables_exist
            
        except Exception as e:
            log_test_result("数据库模型检查", False, "检查失败", str(e))
            return False

def test_provider_operations():
    """测试提供商数据操作"""
    print("\n=== 测试提供商数据操作 ===")
    
    app = create_app()
    with app.app_context():
        try:
            # 测试创建提供商
            test_provider = ExternalKnowledgeProvider(
                name="测试提供商",
                type="dify",
                base_url="https://test.example.com",
                api_key="test_key_123",
                config={"timeout": 30},
                status="active"
            )
            
            db.session.add(test_provider)
            db.session.commit()
            
            log_test_result("创建提供商", True, f"提供商创建成功，ID: {test_provider.id}")
            
            # 测试查询提供商
            found_provider = ExternalKnowledgeProvider.query.filter_by(name="测试提供商").first()
            if found_provider:
                log_test_result("查询提供商", True, "提供商查询成功")
            else:
                log_test_result("查询提供商", False, "提供商查询失败")
                return False
            
            # 测试更新提供商
            found_provider.name = "更新后的测试提供商"
            db.session.commit()
            
            updated_provider = ExternalKnowledgeProvider.query.get(found_provider.id)
            if updated_provider.name == "更新后的测试提供商":
                log_test_result("更新提供商", True, "提供商更新成功")
            else:
                log_test_result("更新提供商", False, "提供商更新失败")
            
            # 测试JSON配置字段
            config_data = {"timeout": 60, "retries": 3}
            updated_provider.config = config_data
            db.session.commit()
            
            reloaded_provider = ExternalKnowledgeProvider.query.get(updated_provider.id)
            if reloaded_provider.config == config_data:
                log_test_result("JSON配置字段", True, "JSON配置保存和读取成功")
            else:
                log_test_result("JSON配置字段", False, "JSON配置保存或读取失败")
            
            return test_provider.id
            
        except Exception as e:
            db.session.rollback()
            log_test_result("提供商数据操作", False, "操作失败", str(e))
            return None

def test_knowledge_operations(provider_id):
    """测试外部知识库数据操作"""
    print("\n=== 测试外部知识库数据操作 ===")
    
    if not provider_id:
        log_test_result("外部知识库测试", False, "缺少提供商ID")
        return None
    
    app = create_app()
    with app.app_context():
        try:
            # 测试创建外部知识库
            test_knowledge = ExternalKnowledge(
                name="测试外部知识库",
                description="这是一个测试用的外部知识库",
                provider_id=provider_id,
                external_kb_id="test_kb_001",
                query_config={
                    "top_k": 5,
                    "similarity_threshold": 0.7,
                    "max_tokens": 4000
                },
                status="active"
            )
            
            db.session.add(test_knowledge)
            db.session.commit()
            
            log_test_result("创建外部知识库", True, f"外部知识库创建成功，ID: {test_knowledge.id}")
            
            # 测试关联查询
            knowledge_with_provider = db.session.query(ExternalKnowledge, ExternalKnowledgeProvider).join(
                ExternalKnowledgeProvider,
                ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
            ).filter(ExternalKnowledge.id == test_knowledge.id).first()
            
            if knowledge_with_provider:
                knowledge, provider = knowledge_with_provider
                log_test_result("关联查询", True, f"成功查询到知识库和提供商: {knowledge.name} - {provider.name}")
            else:
                log_test_result("关联查询", False, "关联查询失败")
            
            # 测试查询配置JSON字段
            query_config = test_knowledge.query_config
            if isinstance(query_config, dict) and query_config.get("top_k") == 5:
                log_test_result("查询配置JSON", True, "查询配置JSON字段正常")
            else:
                log_test_result("查询配置JSON", False, "查询配置JSON字段异常")
            
            return test_knowledge.id
            
        except Exception as e:
            db.session.rollback()
            log_test_result("外部知识库数据操作", False, "操作失败", str(e))
            return None

def test_role_binding_operations(knowledge_id):
    """测试角色绑定数据操作"""
    print("\n=== 测试角色绑定数据操作 ===")
    
    if not knowledge_id:
        log_test_result("角色绑定测试", False, "缺少知识库ID")
        return
    
    app = create_app()
    with app.app_context():
        try:
            # 获取一个角色
            role = Role.query.first()
            if not role:
                log_test_result("角色绑定测试", False, "没有可用的角色")
                return
            
            # 测试创建角色绑定
            test_binding = RoleExternalKnowledge(
                role_id=role.id,
                external_knowledge_id=knowledge_id,
                config={"priority": 1, "custom_params": {}}
            )
            
            db.session.add(test_binding)
            db.session.commit()
            
            log_test_result("创建角色绑定", True, f"角色绑定创建成功，ID: {test_binding.id}")
            
            # 测试唯一约束
            try:
                duplicate_binding = RoleExternalKnowledge(
                    role_id=role.id,
                    external_knowledge_id=knowledge_id,
                    config={}
                )
                db.session.add(duplicate_binding)
                db.session.commit()
                log_test_result("唯一约束测试", False, "唯一约束未生效")
            except Exception:
                db.session.rollback()
                log_test_result("唯一约束测试", True, "唯一约束正常工作")
            
            # 测试复杂查询
            binding_with_details = db.session.query(
                RoleExternalKnowledge, ExternalKnowledge, ExternalKnowledgeProvider, Role
            ).join(
                ExternalKnowledge,
                RoleExternalKnowledge.external_knowledge_id == ExternalKnowledge.id
            ).join(
                ExternalKnowledgeProvider,
                ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
            ).join(
                Role,
                RoleExternalKnowledge.role_id == Role.id
            ).filter(RoleExternalKnowledge.id == test_binding.id).first()
            
            if binding_with_details:
                binding, knowledge, provider, role_obj = binding_with_details
                log_test_result("复杂关联查询", True, 
                              f"成功查询: {role_obj.name} -> {knowledge.name} -> {provider.name}")
            else:
                log_test_result("复杂关联查询", False, "复杂关联查询失败")
            
        except Exception as e:
            db.session.rollback()
            log_test_result("角色绑定数据操作", False, "操作失败", str(e))

def test_query_log_operations(knowledge_id):
    """测试查询日志数据操作"""
    print("\n=== 测试查询日志数据操作 ===")
    
    if not knowledge_id:
        log_test_result("查询日志测试", False, "缺少知识库ID")
        return
    
    app = create_app()
    with app.app_context():
        try:
            # 获取一个角色
            role = Role.query.first()
            
            # 测试创建查询日志
            test_log = ExternalKnowledgeQueryLog(
                external_knowledge_id=knowledge_id,
                role_id=role.id if role else None,
                query_text="测试查询内容",
                response_data={
                    "results": [
                        {"content": "测试结果1", "score": 0.95},
                        {"content": "测试结果2", "score": 0.87}
                    ],
                    "total_count": 2
                },
                query_time=1.23,
                status="success"
            )
            
            db.session.add(test_log)
            db.session.commit()
            
            log_test_result("创建查询日志", True, f"查询日志创建成功，ID: {test_log.id}")
            
            # 测试错误日志
            error_log = ExternalKnowledgeQueryLog(
                external_knowledge_id=knowledge_id,
                role_id=role.id if role else None,
                query_text="失败的查询",
                response_data=None,
                query_time=0,
                status="error",
                error_message="连接超时"
            )
            
            db.session.add(error_log)
            db.session.commit()
            
            log_test_result("创建错误日志", True, "错误日志创建成功")
            
            # 测试日志统计查询
            success_count = ExternalKnowledgeQueryLog.query.filter_by(
                external_knowledge_id=knowledge_id,
                status="success"
            ).count()
            
            error_count = ExternalKnowledgeQueryLog.query.filter_by(
                external_knowledge_id=knowledge_id,
                status="error"
            ).count()
            
            log_test_result("日志统计查询", True, f"成功: {success_count}, 错误: {error_count}")
            
        except Exception as e:
            db.session.rollback()
            log_test_result("查询日志数据操作", False, "操作失败", str(e))

def test_data_integrity():
    """测试数据完整性和约束"""
    print("\n=== 测试数据完整性和约束 ===")
    
    app = create_app()
    with app.app_context():
        try:
            # 测试外键约束
            try:
                invalid_knowledge = ExternalKnowledge(
                    name="无效知识库",
                    provider_id=99999,  # 不存在的提供商ID
                    external_kb_id="invalid_kb",
                    status="active"
                )
                db.session.add(invalid_knowledge)
                db.session.commit()
                log_test_result("外键约束测试", False, "外键约束未生效")
            except Exception:
                db.session.rollback()
                log_test_result("外键约束测试", True, "外键约束正常工作")
            
            # 测试必填字段约束
            try:
                invalid_provider = ExternalKnowledgeProvider(
                    name="",  # 空名称
                    type="dify",
                    base_url="https://test.com",
                    api_key="key"
                )
                db.session.add(invalid_provider)
                db.session.commit()
                log_test_result("必填字段约束", False, "必填字段约束未生效")
            except Exception:
                db.session.rollback()
                log_test_result("必填字段约束", True, "必填字段约束正常工作")
            
        except Exception as e:
            db.session.rollback()
            log_test_result("数据完整性测试", False, "测试失败", str(e))

def cleanup_test_data():
    """清理测试数据"""
    print("\n=== 清理测试数据 ===")
    
    app = create_app()
    with app.app_context():
        try:
            # 删除测试数据（按依赖关系顺序）
            ExternalKnowledgeQueryLog.query.filter(
                ExternalKnowledgeQueryLog.query_text.like("测试%")
            ).delete(synchronize_session=False)
            
            ExternalKnowledgeQueryLog.query.filter(
                ExternalKnowledgeQueryLog.query_text.like("失败的查询%")
            ).delete(synchronize_session=False)
            
            RoleExternalKnowledge.query.join(ExternalKnowledge).filter(
                ExternalKnowledge.name.like("测试%")
            ).delete(synchronize_session=False)
            
            ExternalKnowledge.query.filter(
                ExternalKnowledge.name.like("测试%")
            ).delete(synchronize_session=False)
            
            ExternalKnowledgeProvider.query.filter(
                ExternalKnowledgeProvider.name.like("测试%")
            ).delete(synchronize_session=False)
            
            ExternalKnowledgeProvider.query.filter(
                ExternalKnowledgeProvider.name.like("更新后的测试%")
            ).delete(synchronize_session=False)
            
            db.session.commit()
            log_test_result("清理测试数据", True, "测试数据清理完成")
            
        except Exception as e:
            db.session.rollback()
            log_test_result("清理测试数据", False, "清理失败", str(e))

def generate_test_report():
    """生成测试报告"""
    print("\n" + "="*60)
    print("外部知识库功能独立测试报告")
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
    report_file = f"test_scripts/external_knowledge_standalone_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(TEST_RESULTS, f, ensure_ascii=False, indent=2)
    
    print(f"\n详细报告已保存到: {report_file}")
    
    return failed_tests == 0

def main():
    """主测试函数"""
    print("开始外部知识库功能独立测试...")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 执行各项测试
    if not test_database_models():
        print("\n❌ 数据库模型测试失败，停止后续测试。")
        return 1
    
    provider_id = test_provider_operations()
    knowledge_id = test_knowledge_operations(provider_id)
    test_role_binding_operations(knowledge_id)
    test_query_log_operations(knowledge_id)
    test_data_integrity()
    cleanup_test_data()
    
    # 生成测试报告
    success = generate_test_report()
    
    if success:
        print("\n🎉 所有测试通过！外部知识库功能数据层正常。")
        return 0
    else:
        print("\n❌ 部分测试失败，请检查问题后重新测试。")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
