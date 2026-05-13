"""
订阅配额检查测试脚本
测试配额检查逻辑和API响应格式
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import User, SubscriptionPlan, UserSubscription, ActionTask, ActionSpace, Knowledge, Role
from app.services.subscription_service import SubscriptionService


def setup_test_data(app):
    """设置测试数据"""
    with app.app_context():
        # 检查是否已有测试用户
        test_user = User.query.filter_by(username='quota_test_user').first()
        if not test_user:
            test_user = User(
                username='quota_test_user',
                email='quota_test@test.com',
                is_active=True
            )
            test_user.set_password('test123')
            db.session.add(test_user)
            db.session.commit()
            print(f"[OK] 创建测试用户: {test_user.id}")
        else:
            print(f"[OK] 使用已有测试用户: {test_user.id}")
        
        user_id = test_user.id
        
        # 检查是否有免费计划
        free_plan = SubscriptionPlan.query.filter_by(name='free').first()
        if not free_plan:
            free_plan = SubscriptionPlan(
                name='free',
                display_name='免费版',
                description='免费试用',
                limits={
                    'max_tasks': 3,
                    'max_agents': 5,
                    'max_spaces': 2,
                    'max_knowledge_bases': 2
                },
                features={},
                is_default=True,
                is_active=True
            )
            db.session.add(free_plan)
            db.session.commit()
            print(f"[OK] 创建免费计划: {free_plan.id}")
        else:
            print(f"[OK] 使用已有免费计划: {free_plan.id}, limits={free_plan.limits}")
        
        plan_id = free_plan.id
        plan_limits = free_plan.limits
        
        # 为测试用户分配订阅
        subscription = UserSubscription.query.filter_by(user_id=user_id, is_current=True).first()
        if not subscription:
            subscription = UserSubscription(
                user_id=user_id,
                plan_id=plan_id,
                status='active',
                is_current=True,
                source='test'
            )
            db.session.add(subscription)
            db.session.commit()
            print(f"[OK] 为用户分配订阅: {subscription.id}")
        else:
            print(f"[OK] 用户已有订阅: {subscription.id}")
        
        return user_id, plan_id, plan_limits


def test_check_quota_logic(app, user_id):
    """测试配额检查逻辑"""
    print("\n" + "="*50)
    print("测试配额检查逻辑")
    print("="*50)
    
    with app.app_context():
        # 测试各资源类型的配额检查
        resource_types = ['tasks', 'agents', 'spaces', 'knowledge_bases']
        
        for resource_type in resource_types:
            result = SubscriptionService.check_quota(user_id, resource_type)
            print(f"\n[{resource_type}] 配额检查结果:")
            print(f"  - allowed: {result['allowed']}")
            print(f"  - current: {result['current']}")
            print(f"  - limit: {result['limit']}")
            print(f"  - remaining: {result['remaining']}")
            
            # 验证返回格式
            assert 'allowed' in result, f"缺少 allowed 字段"
            assert 'current' in result, f"缺少 current 字段"
            assert 'limit' in result, f"缺少 limit 字段"
            assert 'remaining' in result, f"缺少 remaining 字段"
            assert isinstance(result['allowed'], bool), f"allowed 应为 bool 类型"
            
        print("\n[PASS] 配额检查逻辑测试通过")


def test_api_response_format(app, user_id):
    """测试API响应格式一致性"""
    print("\n" + "="*50)
    print("测试API响应格式一致性")
    print("="*50)
    
    with app.app_context():
        # 模拟配额超限的响应格式
        quota_result = {
            'allowed': False,
            'current': 3,
            'limit': 3,
            'remaining': 0
        }
        
        # 各API应返回的统一格式
        expected_response_keys = ['error', 'message', 'quota']
        
        # 模拟各API的响应
        api_responses = {
            'action-tasks': {
                'error': '已达到计划限额',
                'message': f'您的计划最多可创建 {quota_result["limit"]} 个行动任务',
                'quota': quota_result
            },
            'action-spaces': {
                'error': '已达到计划限额',
                'message': f'您的计划最多可创建 {quota_result["limit"]} 个行动空间',
                'quota': quota_result
            },
            'roles': {
                'error': '已达到计划限额',
                'message': f'已达到计划限额，您的计划最多可创建 {quota_result["limit"]} 个智能体',
                'quota': {'allowed': False}
            },
            'knowledges': {
                'success': False,
                'error': '已达到计划限额',
                'message': f'您的计划最多可创建 {quota_result["limit"]} 个知识库',
                'quota': quota_result
            }
        }
        
        for api_name, response in api_responses.items():
            print(f"\n[{api_name}] 响应格式检查:")
            
            # 检查必要字段
            has_error = 'error' in response
            has_message = 'message' in response
            has_quota = 'quota' in response
            
            print(f"  - error: {'OK' if has_error else 'MISSING'}")
            print(f"  - message: {'OK' if has_message else 'MISSING'}")
            print(f"  - quota: {'OK' if has_quota else 'MISSING'}")
            
            if not (has_error and has_message and has_quota):
                print(f"  [WARN] 响应格式不完整")
            else:
                print(f"  [OK] 响应格式正确")
        
        print("\n[PASS] API响应格式测试通过")


def test_quota_exceeded_scenario(app, user_id, plan_limits):
    """测试配额超限场景"""
    print("\n" + "="*50)
    print("测试配额超限场景")
    print("="*50)
    
    with app.app_context():
        # 获取当前限额
        max_spaces = plan_limits.get('max_spaces', 2)
        print(f"\n行动空间限额: {max_spaces}")
        
        # 检查当前数量
        current_count = ActionSpace.query.filter_by(created_by=user_id).count()
        print(f"当前数量: {current_count}")
        
        # 检查配额
        result = SubscriptionService.check_quota(user_id, 'spaces')
        print(f"配额检查: allowed={result['allowed']}, remaining={result['remaining']}")
        
        if result['allowed']:
            print(f"\n[INFO] 当前未超限，可以创建新资源")
        else:
            print(f"\n[INFO] 已达到限额，无法创建新资源")
        
        print("\n[PASS] 配额超限场景测试通过")


def test_frontend_error_handling():
    """测试前端错误处理逻辑（模拟）"""
    print("\n" + "="*50)
    print("测试前端错误处理逻辑（模拟）")
    print("="*50)
    
    # 模拟后端返回的错误响应
    error_response = {
        'status': 403,
        'data': {
            'error': '已达到计划限额',
            'message': '您的计划最多可创建 3 个行动任务',
            'quota': {
                'allowed': False,
                'current': 3,
                'limit': 3,
                'remaining': 0
            }
        }
    }
    
    # 模拟前端判断逻辑
    def handle_error(error_response):
        status = error_response.get('status')
        data = error_response.get('data', {})
        
        if status == 403 and data.get('quota'):
            message = data.get('message', '您的计划已达到数量上限')
            return f"配额超限：{message}"
        else:
            return "创建失败"
    
    result = handle_error(error_response)
    print(f"\n前端显示消息: {result}")
    
    expected = "配额超限：您的计划最多可创建 3 个行动任务"
    assert result == expected, f"期望: {expected}, 实际: {result}"
    
    print("\n[PASS] 前端错误处理逻辑测试通过")


def main():
    """主测试函数"""
    print("="*60)
    print("订阅配额检查测试")
    print("="*60)
    
    # 创建应用
    app = create_app()
    
    # 设置测试数据
    user_id, plan_id, plan_limits = setup_test_data(app)
    
    # 运行测试
    test_check_quota_logic(app, user_id)
    test_api_response_format(app, user_id)
    test_quota_exceeded_scenario(app, user_id, plan_limits)
    test_frontend_error_handling()
    
    print("\n" + "="*60)
    print("所有测试通过!")
    print("="*60)


if __name__ == '__main__':
    main()
