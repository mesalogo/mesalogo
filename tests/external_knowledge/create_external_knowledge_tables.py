#!/usr/bin/env python3
"""
创建外部知识库相关数据表的脚本

这个脚本用于创建外部知识库功能所需的数据表：
- external_kb_providers: 外部知识库提供商表
- external_knowledges: 外部知识库表  
- role_external_knowledges: 角色外部知识库关联表
- external_kb_query_logs: 外部知识库查询日志表
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import ExternalKnowledgeProvider, ExternalKnowledge, RoleExternalKnowledge, ExternalKnowledgeQueryLog

def create_external_knowledge_tables():
    """创建外部知识库相关表"""
    app = create_app()
    
    with app.app_context():
        try:
            # 创建表
            print("正在创建外部知识库相关表...")
            
            # 检查表是否已存在
            inspector = db.inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            tables_to_create = [
                ('external_kb_providers', ExternalKnowledgeProvider),
                ('external_knowledges', ExternalKnowledge), 
                ('role_external_knowledges', RoleExternalKnowledge),
                ('external_kb_query_logs', ExternalKnowledgeQueryLog)
            ]
            
            for table_name, model_class in tables_to_create:
                if table_name in existing_tables:
                    print(f"表 {table_name} 已存在，跳过创建")
                else:
                    print(f"创建表 {table_name}...")
                    model_class.__table__.create(db.engine)
                    print(f"表 {table_name} 创建成功")
            
            print("所有外部知识库表创建完成！")
            
            # 插入一些测试数据
            print("\n正在插入测试数据...")
            insert_test_data()
            
        except Exception as e:
            print(f"创建表时发生错误: {e}")
            return False
    
    return True

def insert_test_data():
    """插入测试数据"""
    try:
        # 检查是否已有数据
        if ExternalKnowledgeProvider.query.first():
            print("测试数据已存在，跳过插入")
            return
        
        # 创建测试提供商
        providers = [
            ExternalKnowledgeProvider(
                name="Dify测试环境",
                type="dify",
                base_url="https://api.dify.ai",
                api_key="test_dify_key_123",
                config={
                    "timeout": 30,
                    "max_retries": 3
                },
                status="active"
            ),
            ExternalKnowledgeProvider(
                name="RagFlow演示",
                type="ragflow", 
                base_url="https://demo.ragflow.ai",
                api_key="test_ragflow_key_456",
                config={
                    "timeout": 25,
                    "max_retries": 2
                },
                status="active"
            ),
            ExternalKnowledgeProvider(
                name="FastGPT本地",
                type="fastgpt",
                base_url="http://localhost:3000",
                api_key="test_fastgpt_key_789",
                config={
                    "team_id": "team_001",
                    "timeout": 20
                },
                status="active"
            )
        ]
        
        for provider in providers:
            db.session.add(provider)
        
        db.session.commit()
        print("提供商数据插入成功")
        
        # 创建测试外部知识库
        knowledges = [
            ExternalKnowledge(
                name="Dify产品文档",
                description="Dify平台的产品使用文档和API说明",
                provider_id=1,
                external_kb_id="kb_dify_001",
                query_config={
                    "top_k": 5,
                    "similarity_threshold": 0.7,
                    "max_tokens": 4000
                },
                status="active"
            ),
            ExternalKnowledge(
                name="RagFlow技术文档",
                description="RagFlow的技术架构和开发指南",
                provider_id=2,
                external_kb_id="kb_ragflow_001", 
                query_config={
                    "top_k": 8,
                    "similarity_threshold": 0.6,
                    "max_tokens": 6000
                },
                status="active"
            ),
            ExternalKnowledge(
                name="FastGPT用户手册",
                description="FastGPT的用户操作手册和常见问题",
                provider_id=3,
                external_kb_id="kb_fastgpt_001",
                query_config={
                    "top_k": 3,
                    "similarity_threshold": 0.8,
                    "max_tokens": 3000
                },
                status="active"
            )
        ]
        
        for knowledge in knowledges:
            db.session.add(knowledge)
        
        db.session.commit()
        print("外部知识库数据插入成功")
        
        print("测试数据插入完成！")
        
    except Exception as e:
        print(f"插入测试数据时发生错误: {e}")
        db.session.rollback()

def check_tables():
    """检查表是否创建成功"""
    app = create_app()
    
    with app.app_context():
        try:
            inspector = db.inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            required_tables = [
                'external_kb_providers',
                'external_knowledges', 
                'role_external_knowledges',
                'external_kb_query_logs'
            ]
            
            print("\n检查表创建状态:")
            for table in required_tables:
                if table in existing_tables:
                    print(f"✓ {table} - 已创建")
                else:
                    print(f"✗ {table} - 未创建")
            
            # 检查数据
            print(f"\n数据统计:")
            print(f"提供商数量: {ExternalKnowledgeProvider.query.count()}")
            print(f"外部知识库数量: {ExternalKnowledge.query.count()}")
            print(f"角色关联数量: {RoleExternalKnowledge.query.count()}")
            print(f"查询日志数量: {ExternalKnowledgeQueryLog.query.count()}")
            
        except Exception as e:
            print(f"检查表时发生错误: {e}")

if __name__ == "__main__":
    print("=== 外部知识库表创建脚本 ===")
    
    if create_external_knowledge_tables():
        print("\n=== 检查创建结果 ===")
        check_tables()
        print("\n=== 脚本执行完成 ===")
    else:
        print("\n=== 脚本执行失败 ===")
        sys.exit(1)
