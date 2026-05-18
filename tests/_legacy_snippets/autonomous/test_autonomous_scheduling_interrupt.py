#!/usr/bin/env python3
"""
自主调度模式中断处理测试

测试场景：
1. 启动自主调度任务
2. 模拟智能体被用户中断
3. 验证系统是否正确检查nextAgent变量
4. 验证任务是否根据变量值正确结束或继续

作者：ABM-LLM系统
创建时间：2025-01-22
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch, MagicMock
import json
import queue
import threading
import time

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, 'backend')
sys.path.insert(0, backend_dir)

from app import create_app, db
from app.models import (
    ActionTask, Conversation, ConversationAgent, Agent, Role, User,
    AutonomousTask, AutonomousTaskExecution, ActionTaskEnvironmentVariable
)
from app.services.conversation.autonomous_scheduling_conversation import (
    start_autonomous_scheduling, _check_variables_and_schedule,
    _active_autonomous_scheduling_tasks, _execute_agent_response
)


class TestAutonomousSchedulingInterrupt(unittest.TestCase):
    """自主调度中断处理测试类"""

    def setUp(self):
        """测试前准备"""
        # 创建测试应用
        from config import TestConfig
        self.app = create_app(TestConfig)
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # 创建数据库表
        db.create_all()
        
        # 创建测试数据
        self._create_test_data()
        
        # 清理活动任务
        _active_autonomous_scheduling_tasks.clear()

    def tearDown(self):
        """测试后清理"""
        # 清理活动任务
        _active_autonomous_scheduling_tasks.clear()
        
        # 清理数据库
        db.session.remove()
        db.drop_all()
        
        # 清理应用上下文
        self.app_context.pop()

    def _create_test_data(self):
        """创建测试数据"""
        # 创建用户
        self.user = User(
            username='test_user',
            email='test@example.com',
            password_hash='test_hash'
        )
        db.session.add(self.user)
        
        # 创建角色
        self.role = Role(
            name='测试角色',
            description='测试用角色',
            system_prompt='你是一个测试智能体'
        )
        db.session.add(self.role)
        
        # 创建智能体
        self.agent = Agent(
            name='测试智能体',
            description='用于测试的智能体',
            role_id=None,  # 稍后设置
            user_id=None   # 稍后设置
        )
        db.session.add(self.agent)
        
        # 创建行动任务
        self.action_task = ActionTask(
            name='测试任务',
            description='用于测试自主调度的任务',
            user_id=None,  # 稍后设置
            status='active'
        )
        db.session.add(self.action_task)
        
        # 创建会话
        self.conversation = Conversation(
            action_task_id=None,  # 稍后设置
            name='测试会话',
            description='用于测试的会话'
        )
        db.session.add(self.conversation)
        
        # 提交以获取ID
        db.session.commit()
        
        # 设置外键关系
        self.agent.role_id = self.role.id
        self.agent.user_id = self.user.id
        self.action_task.user_id = self.user.id
        self.conversation.action_task_id = self.action_task.id
        
        # 创建会话智能体关联
        self.conv_agent = ConversationAgent(
            conversation_id=self.conversation.id,
            agent_id=self.agent.id
        )
        db.session.add(self.conv_agent)
        
        db.session.commit()

    def test_interrupt_with_empty_next_agent(self):
        """测试中断后nextAgent为空的情况（应该结束任务）"""
        print("\n=== 测试场景1：中断后nextAgent为空，任务应该结束 ===")
        
        # 创建结果队列
        result_queue = queue.Queue()
        
        # 启动自主调度任务
        config = {
            'topic': '测试主题',
            'max_rounds': 10,
            'timeout_minutes': 60
        }
        
        result = start_autonomous_scheduling(
            task_id=self.action_task.id,
            conversation_id=self.conversation.id,
            config=config,
            streaming=True,
            result_queue=result_queue
        )
        
        self.assertEqual(result['status'], 'success')
        print(f"✓ 自主调度任务启动成功")
        
        # 等待任务注册完成
        time.sleep(0.1)
        
        # 验证任务已注册
        task_key = f"{self.action_task.id}:{self.conversation.id}"
        self.assertIn(task_key, _active_autonomous_scheduling_tasks)
        print(f"✓ 任务已注册: {task_key}")
        
        # 设置nextAgent为空（模拟智能体没有设置下一个智能体）
        next_agent_var = ActionTaskEnvironmentVariable(
            action_task_id=self.action_task.id,
            name='nextAgent',
            value=''  # 空值表示任务应该结束
        )
        db.session.add(next_agent_var)
        db.session.commit()
        print(f"✓ 设置nextAgent为空")
        
        # 模拟智能体被中断
        task_info = _active_autonomous_scheduling_tasks[task_key]
        task_info['last_response_completed'] = False
        
        # 模拟_execute_agent_response中的中断处理
        with patch('app.services.conversation_service.ConversationService._process_single_agent_response') as mock_process:
            # 模拟返回中断失败
            mock_process.return_value = (False, "智能体响应被用户取消")
            
            # 执行智能体响应（会触发中断处理）
            _execute_agent_response(task_key, self.agent.id, "测试提示")
        
        print(f"✓ 模拟智能体中断完成")
        
        # 等待中断处理完成
        time.sleep(0.5)
        
        # 验证任务是否已结束
        # 由于任务结束时会从_active_autonomous_scheduling_tasks中移除，所以检查是否还存在
        task_still_active = task_key in _active_autonomous_scheduling_tasks
        
        if not task_still_active:
            print(f"✓ 任务已正确结束并从活动列表中移除")
        else:
            print(f"✗ 任务仍在活动列表中，可能未正确结束")
        
        # 检查结果队列中是否有完成消息
        messages = []
        try:
            while True:
                msg = result_queue.get_nowait()
                if msg is None:
                    break
                messages.append(msg)
        except queue.Empty:
            pass
        
        print(f"✓ 收到 {len(messages)} 条消息")
        
        # 查找完成消息
        completion_found = False
        for msg in messages:
            if isinstance(msg, str):
                try:
                    parsed = json.loads(msg)
                    if parsed.get('connectionStatus') == 'done':
                        completion_found = True
                        print(f"✓ 找到任务完成消息: {parsed.get('message', '无消息')}")
                        break
                except:
                    pass
        
        if not completion_found:
            print(f"✗ 未找到任务完成消息")
        
        # 断言验证
        self.assertFalse(task_still_active, "任务应该已结束并从活动列表中移除")

    def test_interrupt_with_next_agent_set(self):
        """测试中断后nextAgent有值的情况（应该调度下一个智能体）"""
        print("\n=== 测试场景2：中断后nextAgent有值，应该调度下一个智能体 ===")
        
        # 创建第二个智能体
        agent2 = Agent(
            name='第二个智能体',
            description='用于测试调度的第二个智能体',
            role_id=self.role.id,
            user_id=self.user.id
        )
        db.session.add(agent2)
        
        # 添加到会话
        conv_agent2 = ConversationAgent(
            conversation_id=self.conversation.id,
            agent_id=agent2.id
        )
        db.session.add(conv_agent2)
        db.session.commit()
        
        # 创建结果队列
        result_queue = queue.Queue()
        
        # 启动自主调度任务
        config = {
            'topic': '测试主题',
            'max_rounds': 10,
            'timeout_minutes': 60
        }
        
        result = start_autonomous_scheduling(
            task_id=self.action_task.id,
            conversation_id=self.conversation.id,
            config=config,
            streaming=True,
            result_queue=result_queue
        )
        
        self.assertEqual(result['status'], 'success')
        print(f"✓ 自主调度任务启动成功")
        
        # 等待任务注册完成
        time.sleep(0.1)
        
        # 验证任务已注册
        task_key = f"{self.action_task.id}:{self.conversation.id}"
        self.assertIn(task_key, _active_autonomous_scheduling_tasks)
        print(f"✓ 任务已注册: {task_key}")
        
        # 设置nextAgent为第二个智能体
        next_agent_var = ActionTaskEnvironmentVariable(
            action_task_id=self.action_task.id,
            name='nextAgent',
            value=agent2.name  # 指定下一个智能体
        )
        next_todo_var = ActionTaskEnvironmentVariable(
            action_task_id=self.action_task.id,
            name='nextAgentTODO',
            value='继续执行测试任务'
        )
        db.session.add(next_agent_var)
        db.session.add(next_todo_var)
        db.session.commit()
        print(f"✓ 设置nextAgent为: {agent2.name}")
        
        # 模拟智能体被中断
        task_info = _active_autonomous_scheduling_tasks[task_key]
        original_agent_id = task_info['current_agent_id']
        task_info['last_response_completed'] = False
        
        # 模拟_execute_agent_response中的中断处理
        with patch('app.services.conversation_service.ConversationService._process_single_agent_response') as mock_process:
            # 模拟返回中断失败
            mock_process.return_value = (False, "智能体响应被用户取消")
            
            # 执行智能体响应（会触发中断处理）
            _execute_agent_response(task_key, original_agent_id, "测试提示")
        
        print(f"✓ 模拟智能体中断完成")
        
        # 等待中断处理和调度完成
        time.sleep(0.5)
        
        # 验证任务是否仍然活跃（应该调度到下一个智能体）
        task_still_active = task_key in _active_autonomous_scheduling_tasks
        
        if task_still_active:
            current_agent_id = _active_autonomous_scheduling_tasks[task_key]['current_agent_id']
            if current_agent_id == agent2.id:
                print(f"✓ 任务已正确调度到下一个智能体: {agent2.name}")
            else:
                print(f"✗ 当前智能体ID不正确: 期望 {agent2.id}, 实际 {current_agent_id}")
        else:
            print(f"✗ 任务意外结束，应该调度到下一个智能体")
        
        # 断言验证
        self.assertTrue(task_still_active, "任务应该仍然活跃，调度到下一个智能体")
        if task_still_active:
            current_agent_id = _active_autonomous_scheduling_tasks[task_key]['current_agent_id']
            self.assertEqual(current_agent_id, agent2.id, "应该调度到第二个智能体")

    def test_check_variables_and_schedule_function(self):
        """测试_check_variables_and_schedule函数的直接调用"""
        print("\n=== 测试场景3：直接测试_check_variables_and_schedule函数 ===")
        
        # 手动注册一个任务
        task_key = f"{self.action_task.id}:{self.conversation.id}"
        _active_autonomous_scheduling_tasks[task_key] = {
            'task_id': self.action_task.id,
            'conversation_id': self.conversation.id,
            'config': {'max_rounds': 10, 'timeout_minutes': 60},
            'current_agent_id': self.agent.id,
            'last_response_completed': True,
            'round_count': 1,
            'start_time': time.time(),
            'app': self.app
        }
        
        # 设置nextAgent为空
        next_agent_var = ActionTaskEnvironmentVariable(
            action_task_id=self.action_task.id,
            name='nextAgent',
            value=''
        )
        db.session.add(next_agent_var)
        db.session.commit()
        
        print(f"✓ 手动注册任务并设置nextAgent为空")
        
        # 调用_check_variables_and_schedule
        _check_variables_and_schedule(task_key)
        
        print(f"✓ 调用_check_variables_and_schedule完成")
        
        # 验证任务是否已结束
        task_still_active = task_key in _active_autonomous_scheduling_tasks
        
        if not task_still_active:
            print(f"✓ 任务已正确结束")
        else:
            print(f"✗ 任务仍然活跃，应该已结束")
        
        # 断言验证
        self.assertFalse(task_still_active, "任务应该已结束")


def run_tests():
    """运行测试"""
    print("开始自主调度中断处理测试...")
    print("=" * 60)
    
    # 创建测试套件
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAutonomousSchedulingInterrupt)
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("=" * 60)
    if result.wasSuccessful():
        print("✓ 所有测试通过！")
        return True
    else:
        print("✗ 部分测试失败！")
        return False


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
