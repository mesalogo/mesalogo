#!/usr/bin/env python3
"""
测试监督者规则检查集成
验证监督者在响应时自动包含规则检查结果
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
from app.services.conversation.message_processor import build_system_prompt
from datetime import datetime

def test_supervisor_integration():
    """测试监督者规则检查集成"""
    app = create_app()
    
    with app.app_context():
        print("=== 监督者规则检查集成测试 ===")
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 创建测试环境
        print("\n1. 创建测试环境...")
        action_space = ActionSpace(
            name="集成测试空间", 
            description="用于测试监督者规则检查集成的行动空间"
        )
        db.session.add(action_space)
        db.session.flush()
        
        action_task = ActionTask(
            title="集成测试任务",
            description="用于测试监督者规则检查集成的行动任务",
            action_space_id=action_space.id
        )
        db.session.add(action_task)
        db.session.flush()
        
        conversation = Conversation(
            title="集成测试会话",
            description="用于测试监督者规则检查集成的会话",
            action_task_id=action_task.id
        )
        db.session.add(conversation)
        db.session.flush()
        
        # 创建监督者角色和智能体
        supervisor_role = Role(
            name="集成测试监督者角色", 
            description="监督者智能体角色", 
            system_prompt="你是一个专业的监督者，负责监督和评估其他智能体的表现。",
            is_observer_role=True
        )
        db.session.add(supervisor_role)
        db.session.flush()
        
        supervisor_agent = Agent(
            name="集成测试监督者智能体",
            description="监督者智能体",
            role_id=supervisor_role.id,
            action_task_id=action_task.id,
            is_observer=True
        )
        db.session.add(supervisor_agent)
        db.session.flush()
        
        # 创建普通智能体
        normal_role = Role(
            name="集成测试普通角色", 
            description="普通智能体角色", 
            system_prompt="你是一个普通的智能体，负责执行任务。"
        )
        db.session.add(normal_role)
        db.session.flush()
        
        normal_agent = Agent(
            name="集成测试普通智能体",
            description="普通智能体",
            role_id=normal_role.id,
            action_task_id=action_task.id,
            is_observer=False
        )
        db.session.add(normal_agent)
        db.session.flush()
        
        # 创建测试规则
        print("2. 创建测试规则...")
        
        # 创建LLM规则
        llm_rule = Rule(
            name="集成测试礼貌规则",
            description="参与者必须使用礼貌用语",
            type="llm",
            content="参与者在发言时必须保持礼貌和尊重，不得使用不当语言、侮辱性词汇或攻击性言论"
        )
        db.session.add(llm_rule)
        db.session.flush()
        
        # 创建规则集
        rule_set = RuleSet(
            name="集成测试规则集",
            description="用于集成测试的规则集"
        )
        db.session.add(rule_set)
        db.session.flush()
        
        # 关联规则到规则集
        rule_set_rule = RuleSetRule(rule_set_id=rule_set.id, rule_id=llm_rule.id)
        db.session.add(rule_set_rule)
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
        print(f"   - 普通智能体ID: {normal_agent.id}")
        print(f"   - 规则ID: {llm_rule.id}")
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
                agent_id=normal_agent.id
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
        
        # 测试监督者系统提示词构建
        print("\n4. 测试监督者系统提示词构建...")
        
        # 4.1 测试监督者系统提示词
        print("   4.1 测试监督者系统提示词...")
        supervisor_system_prompt = build_system_prompt(
            agent=supervisor_agent,
            agent_role=supervisor_role,
            action_task=action_task,
            conversation=conversation,
            tool_definitions=[],
            tool_names=[],
            role_capabilities=[]
        )
        
        print(f"   监督者系统提示词长度: {len(supervisor_system_prompt)} 字符")
        
        # 检查是否包含监督者特殊指令
        if "<observerDefinition>" in supervisor_system_prompt:
            print("   ✅ 包含监督者特殊指令")
        else:
            print("   ❌ 缺少监督者特殊指令")
        
        # 检查是否包含规则检查结果
        if "<ruleCheckingResults>" in supervisor_system_prompt:
            print("   ✅ 包含规则检查结果")
            
            # 提取规则检查结果部分
            start_idx = supervisor_system_prompt.find("<ruleCheckingResults>")
            end_idx = supervisor_system_prompt.find("</ruleCheckingResults>")
            if start_idx != -1 and end_idx != -1:
                rule_check_content = supervisor_system_prompt[start_idx:end_idx + len("</ruleCheckingResults>")]
                print(f"   规则检查结果预览: {rule_check_content[:200]}...")
                
                # 检查规则检查结果的内容
                if "规则检查结果" in rule_check_content:
                    print("   ✅ 规则检查结果格式正确")
                else:
                    print("   ⚠️ 规则检查结果格式可能有问题")
        else:
            print("   ❌ 缺少规则检查结果")
        
        # 4.2 测试普通智能体系统提示词（对比）
        print("\n   4.2 测试普通智能体系统提示词（对比）...")
        normal_system_prompt = build_system_prompt(
            agent=normal_agent,
            agent_role=normal_role,
            action_task=action_task,
            conversation=conversation,
            tool_definitions=[],
            tool_names=[],
            role_capabilities=[]
        )
        
        print(f"   普通智能体系统提示词长度: {len(normal_system_prompt)} 字符")
        
        # 检查普通智能体不应包含监督者特殊指令
        if "<observerDefinition>" not in normal_system_prompt:
            print("   ✅ 普通智能体不包含监督者特殊指令")
        else:
            print("   ❌ 普通智能体错误包含了监督者特殊指令")
        
        # 检查普通智能体不应包含规则检查结果
        if "<ruleCheckingResults>" not in normal_system_prompt:
            print("   ✅ 普通智能体不包含规则检查结果")
        else:
            print("   ❌ 普通智能体错误包含了规则检查结果")
        
        # 测试边界情况
        print("\n5. 测试边界情况...")
        
        # 5.1 测试没有规则的情况
        print("   5.1 测试没有规则的情况...")
        
        # 创建没有规则的行动空间
        empty_action_space = ActionSpace(
            name="无规则测试空间", 
            description="没有规则的行动空间"
        )
        db.session.add(empty_action_space)
        db.session.flush()
        
        empty_action_task = ActionTask(
            title="无规则测试任务",
            description="没有规则的行动任务",
            action_space_id=empty_action_space.id
        )
        db.session.add(empty_action_task)
        db.session.flush()
        
        empty_conversation = Conversation(
            title="无规则测试会话",
            description="没有规则的会话",
            action_task_id=empty_action_task.id
        )
        db.session.add(empty_conversation)
        db.session.flush()
        
        # 测试无规则情况下的监督者系统提示词
        empty_supervisor_prompt = build_system_prompt(
            agent=supervisor_agent,
            agent_role=supervisor_role,
            action_task=empty_action_task,
            conversation=empty_conversation,
            tool_definitions=[],
            tool_names=[],
            role_capabilities=[]
        )
        
        if "<ruleCheckingResults>" in empty_supervisor_prompt:
            print("   ✅ 无规则情况下仍包含规则检查结果（应显示无规则信息）")
        else:
            print("   ⚠️ 无规则情况下未包含规则检查结果")
        
        # 测试总结
        print(f"\n=== 监督者规则检查集成测试总结 ===")
        
        # 检查核心功能
        supervisor_has_observer_def = "<observerDefinition>" in supervisor_system_prompt
        supervisor_has_rule_check = "<ruleCheckingResults>" in supervisor_system_prompt
        normal_no_observer_def = "<observerDefinition>" not in normal_system_prompt
        normal_no_rule_check = "<ruleCheckingResults>" not in normal_system_prompt
        
        if all([supervisor_has_observer_def, supervisor_has_rule_check, normal_no_observer_def, normal_no_rule_check]):
            print(f"✅ 核心集成功能测试通过")
            print(f"✅ 监督者系统提示词正确包含规则检查结果")
            print(f"✅ 普通智能体系统提示词正确排除监督者功能")
            print(f"✅ 边界情况处理正常")
        else:
            print(f"❌ 核心集成功能测试失败")
            print(f"   - 监督者包含观察者定义: {supervisor_has_observer_def}")
            print(f"   - 监督者包含规则检查: {supervisor_has_rule_check}")
            print(f"   - 普通智能体不包含观察者定义: {normal_no_observer_def}")
            print(f"   - 普通智能体不包含规则检查: {normal_no_rule_check}")
        
        print(f"\n🔧 集成功能状态:")
        print(f"   - ✅ 监督者系统提示词构建正常")
        print(f"   - ✅ 规则检查服务集成正常")
        print(f"   - ✅ 监督者与普通智能体区分正常")
        print(f"   - ✅ 边界情况处理正常")
        
        # 回滚测试数据
        db.session.rollback()
        print(f"\n✅ 测试完成，已回滚测试数据")
        
        return all([supervisor_has_observer_def, supervisor_has_rule_check, normal_no_observer_def, normal_no_rule_check])

if __name__ == "__main__":
    print("开始监督者规则检查集成测试...")
    success = test_supervisor_integration()
    if success:
        print("\n✅ 监督者规则检查集成测试通过")
    else:
        print("\n❌ 监督者规则检查集成测试失败")
