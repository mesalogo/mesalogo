#!/usr/bin/env python3
"""
测试规则检查API修复
验证修复后的规则检查API是否正常工作
"""

import sys
import os
# Add the project root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models import Rule, RuleSet, RuleSetRule, Role, db
from datetime import datetime

def test_rule_api_fix():
    """测试规则检查API修复"""
    app = create_app()
    
    with app.app_context():
        print("=== 规则检查API修复测试 ===")
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 创建测试角色
        print("\n1. 创建测试角色...")
        test_role = Role(
            name="规则测试角色",
            description="用于规则API测试的角色",
            is_observer_role=False
        )
        db.session.add(test_role)
        db.session.flush()
        
        # 创建测试规则
        print("2. 创建测试规则...")
        test_rule = Rule(
            name="API测试规则",
            description="用于测试API修复的规则",
            type="llm",
            content="参与者在发言时必须保持礼貌和尊重，不得使用不当语言"
        )
        db.session.add(test_rule)
        db.session.flush()
        
        print(f"✅ 测试环境创建成功")
        print(f"   - 角色ID: {test_role.id}")
        print(f"   - 规则ID: {test_rule.id}")
        
        # 使用Flask测试客户端测试API
        with app.test_client() as client:
            print("\n3. 测试规则检查API...")
            
            # 测试规则测试API
            test_context = "用户A说：你好大家！用户B说：很高兴见到大家。"
            rule_test_data = {
                "rules": [
                    {
                        "id": test_rule.id,
                        "name": test_rule.name,
                        "type": test_rule.type,
                        "content": test_rule.content
                    }
                ],
                "context": test_context,
                "role_id": test_role.id
            }
            
            print(f"   发送测试数据: {len(rule_test_data['rules'])}个规则")
            print(f"   测试上下文: {test_context[:50]}...")
            
            response = client.post(
                '/api/rules/test',
                json=rule_test_data,
                content_type='application/json'
            )
            
            print(f"   响应状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ 规则检查API修复成功！")
                
                results = data.get('results', [])
                print(f"   - 返回结果数量: {len(results)}")
                
                if results:
                    for result in results:
                        print(f"   - 规则: {result.get('rule_name')}")
                        print(f"   - 类型: {result.get('rule_type')}")
                        print(f"   - 结果: {'通过' if result.get('passed') else '不通过'}")
                        print(f"   - 详情: {result.get('details', 'N/A')[:100]}...")
                else:
                    print(f"   ⚠️ API返回空结果")
                    
            elif response.status_code == 500:
                print(f"❌ 规则检查API仍有错误")
                error_text = response.get_data(as_text=True)
                print(f"   错误信息: {error_text[:200]}...")
                
                # 检查是否还有ModelService相关错误
                if "ModelService" in error_text:
                    print(f"   ❌ 仍然存在ModelService导入错误")
                elif "model_service" in error_text:
                    print(f"   ❌ 仍然存在model_service相关错误")
                else:
                    print(f"   ⚠️ 其他类型的错误")
            else:
                print(f"❌ 规则检查API返回错误状态码: {response.status_code}")
                print(f"   响应: {response.get_data(as_text=True)[:200]}...")
        
        # 测试总结
        print(f"\n=== 规则检查API修复测试总结 ===")
        
        if response.status_code == 200:
            print(f"✅ 修复成功: 规则检查API正常工作")
            print(f"✅ ModelService导入问题已解决")
            print(f"✅ ModelClient集成正常")
        else:
            print(f"❌ 修复未完成: API仍有问题")
            print(f"❌ 需要进一步调试")
        
        # 回滚测试数据
        db.session.rollback()
        print(f"\n✅ 测试完成，已回滚测试数据")
        
        return response.status_code == 200

if __name__ == "__main__":
    print("开始规则检查API修复测试...")
    success = test_rule_api_fix()
    if success:
        print("\n✅ 规则检查API修复测试通过")
    else:
        print("\n❌ 规则检查API修复测试失败")
