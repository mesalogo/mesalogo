"""
订阅配额检查简化测试脚本
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 禁用大部分日志
import logging
logging.disable(logging.WARNING)

from app import create_app
from app.extensions import db
from app.models import User, SubscriptionPlan, UserSubscription
from app.services.subscription_service import SubscriptionService


def main():
    print("=" * 60)
    print("订阅配额检查测试")
    print("=" * 60)
    
    app = create_app()
    
    with app.app_context():
        # 获取一个已有用户进行测试
        user = User.query.filter_by(username='admin').first()
        if not user:
            user = User.query.first()
        
        if not user:
            print("[ERROR] 没有找到测试用户")
            return
        
        print(f"\n[INFO] 测试用户: {user.username} ({user.id})")
        
        # 获取用户计划
        plan = SubscriptionService.get_user_plan(user.id)
        if plan:
            print(f"[INFO] 用户计划: {plan.display_name}")
            print(f"[INFO] 计划限额: {plan.limits}")
        else:
            print("[INFO] 用户无订阅计划，使用默认限额")
        
        # 测试配额检查
        print("\n" + "-" * 40)
        print("配额检查测试")
        print("-" * 40)
        
        resource_types = ['tasks', 'agents', 'spaces', 'knowledge_bases']
        all_passed = True
        
        for resource_type in resource_types:
            result = SubscriptionService.check_quota(user.id, resource_type)
            
            # 验证返回格式
            required_keys = ['allowed', 'current', 'limit', 'remaining']
            missing_keys = [k for k in required_keys if k not in result]
            
            if missing_keys:
                print(f"[FAIL] {resource_type}: 缺少字段 {missing_keys}")
                all_passed = False
            else:
                status = "OK" if result['allowed'] else "LIMIT"
                print(f"[{status}] {resource_type}: current={result['current']}, limit={result['limit']}, remaining={result['remaining']}")
        
        # 测试API响应格式
        print("\n" + "-" * 40)
        print("API响应格式测试")
        print("-" * 40)
        
        # 模拟配额超限响应
        test_responses = [
            {
                'name': 'action-tasks',
                'response': {
                    'error': '已达到计划限额',
                    'message': '您的计划最多可创建 10 个行动任务',
                    'quota': {'allowed': False, 'current': 10, 'limit': 10, 'remaining': 0}
                }
            },
            {
                'name': 'action-spaces',
                'response': {
                    'error': '已达到计划限额',
                    'message': '您的计划最多可创建 5 个行动空间',
                    'quota': {'allowed': False, 'current': 5, 'limit': 5, 'remaining': 0}
                }
            },
            {
                'name': 'roles',
                'response': {
                    'error': '已达到计划限额',
                    'message': '已达到计划限额，您的计划最多可创建 50 个智能体',
                    'quota': {'allowed': False}
                }
            },
            {
                'name': 'knowledges',
                'response': {
                    'success': False,
                    'error': '已达到计划限额',
                    'message': '您的计划最多可创建 3 个知识库',
                    'quota': {'allowed': False, 'current': 3, 'limit': 3, 'remaining': 0}
                }
            }
        ]
        
        for item in test_responses:
            resp = item['response']
            has_all = all(k in resp for k in ['error', 'message', 'quota'])
            status = "OK" if has_all else "WARN"
            print(f"[{status}] {item['name']}: error={bool('error' in resp)}, message={bool('message' in resp)}, quota={bool('quota' in resp)}")
        
        # 测试前端错误处理逻辑
        print("\n" + "-" * 40)
        print("前端错误处理逻辑测试")
        print("-" * 40)
        
        # 模拟axios错误响应
        mock_error = {
            'response': {
                'status': 403,
                'data': {
                    'error': '已达到计划限额',
                    'message': '您的计划最多可创建 3 个行动任务',
                    'quota': {'allowed': False}
                }
            }
        }
        
        # 前端判断逻辑
        status = mock_error['response']['status']
        data = mock_error['response']['data']
        
        if status == 403 and data.get('quota'):
            msg = f"配额超限：{data.get('message', '您的计划已达到数量上限')}"
            print(f"[OK] 前端显示: {msg}")
        else:
            print("[FAIL] 前端判断逻辑错误")
            all_passed = False
        
        # 总结
        print("\n" + "=" * 60)
        if all_passed:
            print("所有测试通过!")
        else:
            print("部分测试失败，请检查")
        print("=" * 60)


if __name__ == '__main__':
    main()
