#!/usr/bin/env python3
"""
简单的API测试，不依赖复杂的向量化功能
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """测试基本导入"""
    print("测试基本导入...")
    
    try:
        print("1. 导入Flask...")
        from flask import Flask
        print("✅ Flask导入成功")
        
        print("2. 导入数据库...")
        from app.extensions import db
        print("✅ 数据库扩展导入成功")
        
        print("3. 导入模型...")
        from app.models import Knowledge
        print("✅ Knowledge模型导入成功")
        
        print("4. 导入知识库API...")
        from app.api.routes.knowledge import knowledge_bp
        print("✅ 知识库API导入成功")
        
        print("5. 创建应用...")
        from app import create_app
        app = create_app()
        print("✅ 应用创建成功")
        
        return True
        
    except Exception as e:
        print(f"❌ 导入失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_knowledge_api_directly():
    """直接测试知识库API函数"""
    print("\n测试知识库API函数...")
    
    try:
        from app import create_app
        from app.models import Knowledge, db
        
        app = create_app()
        
        with app.app_context():
            # 测试获取知识库列表
            knowledges = Knowledge.query.all()
            print(f"✅ 数据库查询成功，找到 {len(knowledges)} 个知识库")
            
            for kb in knowledges:
                print(f"  - ID: {kb.id}, 名称: {kb.name}, 类型: {kb.type}")
        
        return True
        
    except Exception as e:
        print(f"❌ API测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_file_operations():
    """测试文件操作"""
    print("\n测试文件操作...")
    
    try:
        import tempfile
        import os
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("测试文件内容")
            temp_file = f.name
        
        print(f"✅ 临时文件创建成功: {temp_file}")
        
        # 检查文件是否存在
        if os.path.exists(temp_file):
            print("✅ 文件存在检查成功")
            
            # 读取文件内容
            with open(temp_file, 'r') as f:
                content = f.read()
            print(f"✅ 文件读取成功，内容: {content}")
            
            # 删除临时文件
            os.unlink(temp_file)
            print("✅ 临时文件清理成功")
        
        return True
        
    except Exception as e:
        print(f"❌ 文件操作失败: {e}")
        return False

def main():
    """主测试函数"""
    print("开始简单API测试...")
    print("=" * 50)
    
    success = True
    
    # 测试导入
    if not test_imports():
        success = False
    
    # 测试API函数
    if not test_knowledge_api_directly():
        success = False
    
    # 测试文件操作
    if not test_file_operations():
        success = False
    
    print("\n" + "=" * 50)
    if success:
        print("✅ 所有测试通过")
    else:
        print("❌ 部分测试失败")
    
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
