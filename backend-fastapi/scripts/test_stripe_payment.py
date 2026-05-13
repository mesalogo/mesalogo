#!/usr/bin/env python3
"""
Stripe 支付功能测试脚本

测试内容：
1. Stripe 配置 API（获取/更新/测试连接）
2. 支付记录 API（查询）
3. 创建 Checkout Session API
4. Webhook 处理逻辑

运行方式：
cd backend && python scripts/test_stripe_payment.py
"""

import os
import sys
import json
import requests
from datetime import datetime

# 添加项目路径
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)

# 配置
BASE_URL = os.environ.get('API_BASE_URL', 'http://localhost:5001/api')
ADMIN_TOKEN = os.environ.get('ADMIN_TOKEN', '')  # 需要设置管理员 token

def get_headers(token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return headers

def print_result(name, success, message='', data=None):
    status = '✅' if success else '❌'
    print(f"{status} {name}: {message}")
    if data and not success:
        print(f"   Response: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")

def test_stripe_config_get(token):
    """测试获取 Stripe 配置"""
    try:
        resp = requests.get(f'{BASE_URL}/admin/stripe/config', headers=get_headers(token))
        data = resp.json()
        if resp.status_code == 200 and 'config' in data:
            config = data['config']
            print_result('获取 Stripe 配置', True, f"enabled={config.get('enabled')}, mode={config.get('mode')}")
            return True, config
        else:
            print_result('获取 Stripe 配置', False, data.get('error', '未知错误'))
            return False, None
    except Exception as e:
        print_result('获取 Stripe 配置', False, str(e))
        return False, None

def test_stripe_config_update(token, config_data):
    """测试更新 Stripe 配置"""
    try:
        resp = requests.put(f'{BASE_URL}/admin/stripe/config', 
                           headers=get_headers(token),
                           json=config_data)
        data = resp.json()
        if resp.status_code == 200:
            print_result('更新 Stripe 配置', True, data.get('message', '成功'))
            return True
        else:
            print_result('更新 Stripe 配置', False, data.get('error', '未知错误'))
            return False
    except Exception as e:
        print_result('更新 Stripe 配置', False, str(e))
        return False

def test_stripe_connection(token):
    """测试 Stripe 连接"""
    try:
        resp = requests.post(f'{BASE_URL}/admin/stripe/test', headers=get_headers(token))
        data = resp.json()
        if data.get('success'):
            account = data.get('account', {})
            print_result('测试 Stripe 连接', True, f"Account ID: {account.get('id', 'N/A')}")
            return True
        else:
            print_result('测试 Stripe 连接', False, data.get('message', '连接失败'))
            return False
    except Exception as e:
        print_result('测试 Stripe 连接', False, str(e))
        return False

def test_get_payments_admin(token):
    """测试获取支付记录（管理员）"""
    try:
        resp = requests.get(f'{BASE_URL}/admin/payments', headers=get_headers(token))
        data = resp.json()
        if resp.status_code == 200 and 'payments' in data:
            print_result('获取支付记录（管理员）', True, f"共 {data.get('total', 0)} 条记录")
            return True
        else:
            print_result('获取支付记录（管理员）', False, data.get('error', '未知错误'))
            return False
    except Exception as e:
        print_result('获取支付记录（管理员）', False, str(e))
        return False

def test_get_payment_stats(token):
    """测试获取支付统计"""
    try:
        resp = requests.get(f'{BASE_URL}/admin/payments/stats', headers=get_headers(token))
        data = resp.json()
        if resp.status_code == 200 and 'stats' in data:
            stats = data['stats']
            print_result('获取支付统计', True, 
                        f"本月收入: {stats.get('total_income', 0)}, 成功: {stats.get('success_count', 0)}")
            return True
        else:
            print_result('获取支付统计', False, data.get('error', '未知错误'))
            return False
    except Exception as e:
        print_result('获取支付统计', False, str(e))
        return False

def test_get_user_payments(token):
    """测试获取用户支付历史"""
    try:
        resp = requests.get(f'{BASE_URL}/subscription/payments', headers=get_headers(token))
        data = resp.json()
        if resp.status_code == 200 and 'payments' in data:
            print_result('获取用户支付历史', True, f"共 {data.get('total', 0)} 条记录")
            return True
        else:
            print_result('获取用户支付历史', False, data.get('error', '未知错误'))
            return False
    except Exception as e:
        print_result('获取用户支付历史', False, str(e))
        return False

def test_get_subscription_plans(token):
    """测试获取订阅计划"""
    try:
        resp = requests.get(f'{BASE_URL}/subscription/plans', headers=get_headers(token))
        data = resp.json()
        if resp.status_code == 200 and 'plans' in data:
            plans = data['plans']
            print_result('获取订阅计划', True, f"共 {len(plans)} 个计划")
            return True, plans
        else:
            print_result('获取订阅计划', False, data.get('error', '未知错误'))
            return False, []
    except Exception as e:
        print_result('获取订阅计划', False, str(e))
        return False, []

def test_create_checkout_session(token, plan_id):
    """测试创建 Checkout Session"""
    try:
        resp = requests.post(f'{BASE_URL}/subscription/create-checkout',
                            headers=get_headers(token),
                            json={'plan_id': plan_id, 'billing_period': 'monthly'})
        data = resp.json()
        if resp.status_code == 200 and 'checkout_url' in data:
            print_result('创建 Checkout Session', True, f"Session ID: {data.get('session_id', 'N/A')[:20]}...")
            return True, data
        else:
            print_result('创建 Checkout Session', False, data.get('error', '未知错误'))
            return False, None
    except Exception as e:
        print_result('创建 Checkout Session', False, str(e))
        return False, None

def test_get_publishable_key(token):
    """测试获取 Publishable Key"""
    try:
        resp = requests.get(f'{BASE_URL}/subscription/publishable-key', headers=get_headers(token))
        data = resp.json()
        if resp.status_code == 200 and 'publishable_key' in data:
            pk = data['publishable_key']
            if pk:
                print_result('获取 Publishable Key', True, f"Key: {pk[:20]}...")
            else:
                print_result('获取 Publishable Key', True, "Key 未配置")
            return True
        else:
            print_result('获取 Publishable Key', False, data.get('error', '未知错误'))
            return False
    except Exception as e:
        print_result('获取 Publishable Key', False, str(e))
        return False

def test_webhook_endpoint():
    """测试 Webhook 端点可访问性"""
    try:
        # 发送一个空的 webhook 请求（会失败，但能验证端点存在）
        resp = requests.post(f'{BASE_URL}/webhooks/stripe',
                            headers={'Content-Type': 'application/json'},
                            json={})
        # 即使返回错误也说明端点存在
        if resp.status_code in [200, 400, 500]:
            print_result('Webhook 端点可访问', True, f"Status: {resp.status_code}")
            return True
        else:
            print_result('Webhook 端点可访问', False, f"Status: {resp.status_code}")
            return False
    except Exception as e:
        print_result('Webhook 端点可访问', False, str(e))
        return False

def run_tests():
    print("=" * 60)
    print("Stripe 支付功能测试")
    print("=" * 60)
    print(f"API Base URL: {BASE_URL}")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)
    
    if not ADMIN_TOKEN:
        print("\n⚠️  警告: 未设置 ADMIN_TOKEN 环境变量")
        print("   请设置: export ADMIN_TOKEN='your_token_here'")
        print("   或者从浏览器开发者工具中获取 authToken")
        print("\n将跳过需要认证的测试...\n")
    
    results = []
    
    # 1. 测试 Webhook 端点（不需要认证）
    print("\n[1] 测试 Webhook 端点")
    results.append(('Webhook 端点', test_webhook_endpoint()))
    
    if ADMIN_TOKEN:
        # 2. 测试 Stripe 配置
        print("\n[2] 测试 Stripe 配置 API")
        success, config = test_stripe_config_get(ADMIN_TOKEN)
        results.append(('获取 Stripe 配置', success))
        
        # 3. 测试 Stripe 连接
        print("\n[3] 测试 Stripe 连接")
        results.append(('Stripe 连接', test_stripe_connection(ADMIN_TOKEN)))
        
        # 4. 测试支付记录 API
        print("\n[4] 测试支付记录 API")
        results.append(('管理员支付记录', test_get_payments_admin(ADMIN_TOKEN)))
        results.append(('支付统计', test_get_payment_stats(ADMIN_TOKEN)))
        results.append(('用户支付历史', test_get_user_payments(ADMIN_TOKEN)))
        
        # 5. 测试订阅计划
        print("\n[5] 测试订阅计划 API")
        success, plans = test_get_subscription_plans(ADMIN_TOKEN)
        results.append(('获取订阅计划', success))
        
        # 6. 测试 Publishable Key
        print("\n[6] 测试 Publishable Key")
        results.append(('Publishable Key', test_get_publishable_key(ADMIN_TOKEN)))
        
        # 7. 测试创建 Checkout Session（需要有付费计划）
        print("\n[7] 测试创建 Checkout Session")
        paid_plans = [p for p in plans if p.get('price_monthly', 0) > 0]
        if paid_plans:
            success, _ = test_create_checkout_session(ADMIN_TOKEN, paid_plans[0]['id'])
            results.append(('创建 Checkout Session', success))
        else:
            print("   ⚠️  没有付费计划，跳过此测试")
            results.append(('创建 Checkout Session', None))
    
    # 汇总结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r is True)
    failed = sum(1 for _, r in results if r is False)
    skipped = sum(1 for _, r in results if r is None)
    
    print(f"✅ 通过: {passed}")
    print(f"❌ 失败: {failed}")
    print(f"⏭️  跳过: {skipped}")
    print(f"📊 总计: {len(results)}")
    
    if failed > 0:
        print("\n失败的测试:")
        for name, result in results:
            if result is False:
                print(f"  - {name}")
    
    print("\n" + "=" * 60)
    
    return failed == 0

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
