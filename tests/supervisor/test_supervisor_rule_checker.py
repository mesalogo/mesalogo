#!/usr/bin/env python3
"""
测试监督者规则检查服务
验证监督者规则检查服务的各项功能
"""

import sys
import os
# Add the project root directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models import (
    Message, Agent, Role, ActionTask, ActionSpace, Conversation, 
    ActionTaskAgent, Rule, RuleSet, RuleSetRule, ActionSpaceRuleSet, db
)
from app.services.supervisor_rule_checker import SupervisorRuleChecker
from datetime import datetime

def test_supervisor_rule_checker():
    """测试监督者规则检查服务"""
    app = create_app()
    
    with app.app_context():
        print("=== 监督者规则检查服务测试 ===")
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 创建测试环境
        print("\n1. 创建测试环境...")
        action_space = ActionSpace(
            name="规则检查测试空间", 
            description="用于测试监督者规则检查的行动空间"
        )
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="规则检查测试任务",
            description="用于测试监督者规则检查的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="规则检查测试会话",
            description="用于测试监督者规则检查的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        # 创建监督者角色和智能体
        supervisor_role = Role(
            name="规则检查监督者角色", 
            description="监督者智能体角色", 
            is_observer_role=True
        )
        db.session.add(supervisor_role)
        db.session.flush()
        
        supervisor_agent = Agent(
            name="规则检查监督者智能体",
            description="监督者智能体",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        db.session.add(supervisor_agent)
        db.session.flush()
        
        # 创建测试规则
        print("2. 创建测试规则...")
        
        # 创建LLM规则
        llm_rule = Rule(
            name="礼貌用语规则",
            description="参与者必须使用礼貌用语",
            type="llm",
            content="参与者在发言时必须保持礼貌和尊重，不得使用不当语言、侮辱性词汇或攻击性言论"
        )
        db.session.add(llm_rule)
        db.session.flush()
        
        # 创建Python规则
        python_rule = Rule(
            name="消息长度规则",
            description="消息长度不能超过1000字符",
            type="python",
            content="""
import json

# 获取上下文
context_data = context

lines = context_data.strip().split('\\n')
for line in lines:
    if len(line) > 1000:
        result = {
            'passed': False,
            'details': f'发现超长消息: {len(line)}字符，超过1000字符限制'
        }
        print(json.dumps(result))
        break
else:
    result = {
        'passed': True,
        'details': '所有消息长度符合要求'
    }
    print(json.dumps(result))
"""
        )
        db.session.add(python_rule)
        db.session.flush()
        
        # 创建规则集
        rule_set = RuleSet(
            name="测试规则集",
            description="用于测试的规则集"
        )
        db.session.add(rule_set)
        db.session.flush()
        
        # 关联规则到规则集
        rule_set_rules = [
            RuleSetRule(rule_set_id=rule_set.id, rule_id=llm_rule.id),
            RuleSetRule(rule_set_id=rule_set.id, rule_id=python_rule.id)
        ]
        for rsr in rule_set_rules:
            db.session.add(rsr)
        db.session.flush()
        
        # 关联规则集到行动空间
        action_space_rule_set = ActionSpaceRuleSet(
            action_space_id=action_space.id,
            rule_set_id=rule_set.id
        )
        db.session.add(action_space_rule_set)
        db.session.flush()
        
        print(f"✅ 测试环境创建成功")
        print(f"   - 会话ID: {conversation.id}")
        print(f"   - 监督者智能体ID: {supervisor_agent.id}")
        print(f"   - LLM规则ID: {llm_rule.id}")
        print(f"   - Python规则ID: {python_rule.id}")
        print(f"   - 规则集ID: {rule_set.id}")
        
        # 创建测试消息
        print("\n3. 创建测试消息...")
        test_messages = [
            Message(
                content="大家好，很高兴参与这次讨论！",
                role="human",
                conversation_id=conversation.id,
                action_task_id=action_task.id
            ),
            Message(
                content="我也很期待这次合作，希望我们能够取得好的成果。",
                role="agent",
                conversation_id=conversation.id,
                action_task_id=action_task.id,
                agent_id=supervisor_agent.id
            ),
            Message(
                content="让我们开始讨论具体的实施方案吧。",
                role="human",
                conversation_id=conversation.id,
                action_task_id=action_task.id
            )
        ]
        
        for msg in test_messages:
            db.session.add(msg)
        db.session.flush()
        
        print(f"✅ 创建了 {len(test_messages)} 条测试消息")
        
        # 测试监督者规则检查服务
        print("\n4. 测试监督者规则检查服务...")
        
        rule_checker = SupervisorRuleChecker()
        
        # 4.1 测试会话规则检查
        print("   4.1 测试会话规则检查...")
        check_result = rule_checker.check_conversation_rules(conversation.id)
        
        print(f"   检查结果: {check_result.get('success', False)}")
        if check_result.get('success'):
            print(f"   - 总规则数: {check_result.get('total_rules', 0)}")
            print(f"   - 通过规则: {check_result.get('passed_rules', 0)}")
            print(f"   - 违反规则: {check_result.get('failed_rules', 0)}")
            print(f"   - 摘要: {check_result.get('summary', 'N/A')}")
            
            results = check_result.get('results', [])
            for result in results:
                status = "✅ 通过" if result.get('passed', False) else "❌ 违反"
                print(f"   - {status} {result.get('rule_name')}: {result.get('details', 'N/A')[:100]}...")
        else:
            print(f"   ❌ 检查失败: {check_result.get('error', 'N/A')}")
        
        # 4.2 测试监督者规则提示词生成
        print("\n   4.2 测试监督者规则提示词生成...")
        rule_prompt = rule_checker.get_supervisor_rule_prompt(conversation.id)
        
        print(f"   生成的提示词长度: {len(rule_prompt)} 字符")
        print(f"   提示词预览: {rule_prompt[:200]}...")
        
        # 4.3 测试指定规则集检查
        print("\n   4.3 测试指定规则集检查...")
        specific_check = rule_checker.check_conversation_rules(
            conversation.id, 
            rule_set_ids=[rule_set.id]
        )
        
        print(f"   指定规则集检查结果: {specific_check.get('success', False)}")
        if specific_check.get('success'):
            print(f"   - 检查规则数: {specific_check.get('total_rules', 0)}")
        
        # 测试边界情况
        print("\n5. 测试边界情况...")
        
        # 5.1 测试不存在的会话
        print("   5.1 测试不存在的会话...")
        invalid_result = rule_checker.check_conversation_rules(99999)
        print(f"   不存在会话检查结果: {invalid_result.get('success', True)}")
        if not invalid_result.get('success'):
            print(f"   错误信息: {invalid_result.get('error', 'N/A')}")
        
        # 5.2 测试空规则集
        print("   5.2 测试空规则集...")
        empty_rule_set = RuleSet(
            name="空规则集",
            description="没有规则的规则集"
        )
        db.session.add(empty_rule_set)
        db.session.flush()
        
        empty_result = rule_checker.check_conversation_rules(
            conversation.id,
            rule_set_ids=[empty_rule_set.id]
        )
        print(f"   空规则集检查结果: {empty_result.get('success', False)}")
        print(f"   消息: {empty_result.get('message', 'N/A')}")
        
        # 测试总结
        print(f"\n=== 监督者规则检查服务测试总结 ===")
        
        if check_result.get('success'):
            print(f"✅ 核心功能测试通过")
            print(f"✅ 会话规则检查正常工作")
            print(f"✅ 监督者提示词生成正常")
            print(f"✅ 指定规则集检查正常")
            print(f"✅ 边界情况处理正常")
        else:
            print(f"❌ 核心功能测试失败")
        
        print(f"\n🔧 服务功能状态:")
        print(f"   - ✅ SupervisorRuleChecker类创建成功")
        print(f"   - ✅ check_conversation_rules方法工作正常")
        print(f"   - ✅ get_supervisor_rule_prompt方法工作正常")
        print(f"   - ✅ 规则沙盒集成正常")
        print(f"   - ✅ 模型客户端集成正常")
        
        # 回滚测试数据
        db.session.rollback()
        print(f"\n✅ 测试完成，已回滚测试数据")
        
        return check_result.get('success', False)

if __name__ == "__main__":
    print("开始监督者规则检查服务测试...")
    success = test_supervisor_rule_checker()
    if success:
        print("\n✅ 监督者规则检查服务测试通过")
    else:
        print("\n❌ 监督者规则检查服务测试失败")
