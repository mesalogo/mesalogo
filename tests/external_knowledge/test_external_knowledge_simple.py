#!/usr/bin/env python3
"""
外部知识库功能简化测试脚本

测试内容：
1. 数据库模型和表结构
2. 基本数据操作
3. 模型关系验证

运行方式：
python test_scripts/test_external_knowledge_simple.py
"""

import sys
import os
import json
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    """主测试函数"""
    print("开始外部知识库功能简化测试...")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # 导入测试
        print("\n=== 测试模块导入 ===")
        from app import create_app
        print("✓ PASS app导入成功")
        
        from app.extensions import db
        print("✓ PASS db导入成功")
        
        from app.models import (
            ExternalKnowledgeProvider, ExternalKnowledge, 
            RoleExternalKnowledge, ExternalKnowledgeQueryLog, Role
        )
        print("✓ PASS 外部知识库模型导入成功")
        
        # 应用创建测试
        print("\n=== 测试应用创建 ===")
        app = create_app()
        print("✓ PASS 应用创建成功")
        
        with app.app_context():
            # 数据库表检查
            print("\n=== 测试数据库表结构 ===")
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
                    print(f"✓ PASS 表 {table} 存在")
                else:
                    print(f"✗ FAIL 表 {table} 不存在")
                    all_tables_exist = False
            
            if not all_tables_exist:
                print("\n❌ 数据库表检查失败")
                return 1
            
            # 基本数据操作测试
            print("\n=== 测试基本数据操作 ===")
            
            # 测试创建提供商
            test_provider = ExternalKnowledgeProvider(
                name="测试提供商_简化",
                type="dify",
                base_url="https://test.example.com",
                api_key="test_key_123",
                config={"timeout": 30},
                status="active"
            )
            
            db.session.add(test_provider)
            db.session.commit()
            print(f"✓ PASS 创建提供商成功，ID: {test_provider.id}")
            
            # 测试创建外部知识库
            test_knowledge = ExternalKnowledge(
                name="测试外部知识库_简化",
                description="这是一个测试用的外部知识库",
                provider_id=test_provider.id,
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
            print(f"✓ PASS 创建外部知识库成功，ID: {test_knowledge.id}")
            
            # 测试关联查询
            knowledge_with_provider = db.session.query(ExternalKnowledge, ExternalKnowledgeProvider).join(
                ExternalKnowledgeProvider,
                ExternalKnowledge.provider_id == ExternalKnowledgeProvider.id
            ).filter(ExternalKnowledge.id == test_knowledge.id).first()
            
            if knowledge_with_provider:
                knowledge, provider = knowledge_with_provider
                print(f"✓ PASS 关联查询成功: {knowledge.name} -> {provider.name}")
            else:
                print("✗ FAIL 关联查询失败")
                return 1
            
            # 测试角色绑定（如果有角色的话）
            role = Role.query.first()
            if role:
                test_binding = RoleExternalKnowledge(
                    role_id=role.id,
                    external_knowledge_id=test_knowledge.id,
                    config={"priority": 1}
                )
                
                db.session.add(test_binding)
                db.session.commit()
                print(f"✓ PASS 创建角色绑定成功，ID: {test_binding.id}")
                
                # 清理角色绑定
                db.session.delete(test_binding)
                db.session.commit()
                print("✓ PASS 清理角色绑定成功")
            else:
                print("⚠ WARN 没有可用角色，跳过角色绑定测试")
            
            # 测试查询日志
            test_log = ExternalKnowledgeQueryLog(
                external_knowledge_id=test_knowledge.id,
                role_id=role.id if role else None,
                query_text="测试查询内容",
                response_data={
                    "results": [{"content": "测试结果", "score": 0.95}],
                    "total_count": 1
                },
                query_time=1.23,
                status="success"
            )
            
            db.session.add(test_log)
            db.session.commit()
            print(f"✓ PASS 创建查询日志成功，ID: {test_log.id}")
            
            # 清理测试数据
            print("\n=== 清理测试数据 ===")
            db.session.delete(test_log)
            db.session.delete(test_knowledge)
            db.session.delete(test_provider)
            db.session.commit()
            print("✓ PASS 测试数据清理完成")
            
            # 验证现有数据
            print("\n=== 验证现有数据 ===")
            provider_count = ExternalKnowledgeProvider.query.count()
            knowledge_count = ExternalKnowledge.query.count()
            binding_count = RoleExternalKnowledge.query.count()
            log_count = ExternalKnowledgeQueryLog.query.count()
            
            print(f"✓ PASS 现有数据统计:")
            print(f"  - 提供商: {provider_count}")
            print(f"  - 外部知识库: {knowledge_count}")
            print(f"  - 角色绑定: {binding_count}")
            print(f"  - 查询日志: {log_count}")
            
        print("\n🎉 所有测试通过！外部知识库功能数据层正常。")
        return 0
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
