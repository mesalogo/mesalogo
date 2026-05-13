"""
用户资料API测试脚本
测试 /users/profile 和 /users/change-password 接口
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
logging.disable(logging.WARNING)

from app import create_app
from app.extensions import db
from app.models import User


def test_update_profile(app):
    """测试更新用户资料"""
    print("\n" + "=" * 50)
    print("测试更新用户资料 API")
    print("=" * 50)
    
    with app.test_client() as client:
        with app.app_context():
            # 获取测试用户
            user = User.query.filter_by(username='admin').first()
            if not user:
                print("[ERROR] 未找到 admin 用户")
                return False
            
            # 生成 token
            from app.middleware.auth_middleware import generate_token
            token = generate_token(user.id)
            headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
            
            print(f"\n[INFO] 测试用户: {user.username}")
            print(f"[INFO] 当前邮箱: {user.email}")
            
            # 测试1: 更新 display_name
            print("\n--- 测试1: 更新 display_name ---")
            response = client.put('/api/users/profile', 
                json={'display_name': 'Test Admin'},
                headers=headers
            )
            print(f"状态码: {response.status_code}")
            data = response.get_json()
            if response.status_code == 200:
                print(f"[OK] 更新成功: {data.get('message')}")
            else:
                print(f"[FAIL] 更新失败: {data}")
                return False
            
            # 测试2: 更新邮箱（无效格式）
            print("\n--- 测试2: 更新邮箱（无效格式）---")
            response = client.put('/api/users/profile',
                json={'email': 'invalid-email'},
                headers=headers
            )
            print(f"状态码: {response.status_code}")
            data = response.get_json()
            if response.status_code == 400:
                print(f"[OK] 正确拒绝无效邮箱: {data.get('error')}")
            else:
                print(f"[FAIL] 应该拒绝无效邮箱")
                return False
            
            # 测试3: 更新邮箱（有效格式）
            print("\n--- 测试3: 更新邮箱（有效格式）---")
            response = client.put('/api/users/profile',
                json={'email': 'admin@test.com'},
                headers=headers
            )
            print(f"状态码: {response.status_code}")
            data = response.get_json()
            if response.status_code == 200:
                print(f"[OK] 更新成功")
            else:
                print(f"[FAIL] 更新失败: {data}")
                return False
            
            return True


def test_change_password(app):
    """测试修改密码"""
    print("\n" + "=" * 50)
    print("测试修改密码 API")
    print("=" * 50)
    
    with app.test_client() as client:
        with app.app_context():
            # 创建测试用户
            test_user = User.query.filter_by(username='password_test_user').first()
            if not test_user:
                test_user = User(
                    username='password_test_user',
                    email='pwtest@test.com',
                    is_active=True
                )
                test_user.set_password('oldpass123')
                db.session.add(test_user)
                db.session.commit()
                print(f"[INFO] 创建测试用户: {test_user.username}")
            else:
                test_user.set_password('oldpass123')
                db.session.commit()
                print(f"[INFO] 重置测试用户密码")
            
            # 生成 token
            from app.middleware.auth_middleware import generate_token
            token = generate_token(test_user.id)
            headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
            
            # 测试1: 旧密码错误
            print("\n--- 测试1: 旧密码错误 ---")
            response = client.post('/api/users/change-password',
                json={'old_password': 'wrongpass', 'new_password': 'newpass123'},
                headers=headers
            )
            print(f"状态码: {response.status_code}")
            data = response.get_json()
            if response.status_code == 400 and '不正确' in data.get('error', ''):
                print(f"[OK] 正确拒绝错误密码: {data.get('error')}")
            else:
                print(f"[FAIL] 应该拒绝错误密码: {data}")
                return False
            
            # 测试2: 新密码太短
            print("\n--- 测试2: 新密码太短 ---")
            response = client.post('/api/users/change-password',
                json={'old_password': 'oldpass123', 'new_password': '123'},
                headers=headers
            )
            print(f"状态码: {response.status_code}")
            data = response.get_json()
            if response.status_code == 400:
                print(f"[OK] 正确拒绝短密码: {data.get('error')}")
            else:
                print(f"[FAIL] 应该拒绝短密码: {data}")
                return False
            
            # 测试3: 正确修改密码
            print("\n--- 测试3: 正确修改密码 ---")
            response = client.post('/api/users/change-password',
                json={'old_password': 'oldpass123', 'new_password': 'newpass123'},
                headers=headers
            )
            print(f"状态码: {response.status_code}")
            data = response.get_json()
            if response.status_code == 200:
                print(f"[OK] 密码修改成功: {data.get('message')}")
            else:
                print(f"[FAIL] 密码修改失败: {data}")
                return False
            
            # 测试4: 验证新密码生效
            print("\n--- 测试4: 验证新密码生效 ---")
            db.session.refresh(test_user)
            if test_user.check_password('newpass123'):
                print("[OK] 新密码验证成功")
            else:
                print("[FAIL] 新密码验证失败")
                return False
            
            return True


def main():
    print("=" * 60)
    print("用户资料 API 测试")
    print("=" * 60)
    
    app = create_app()
    
    results = []
    
    results.append(('更新资料', test_update_profile(app)))
    results.append(('修改密码', test_change_password(app)))
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("所有测试通过!")
    else:
        print("部分测试失败")
    print("=" * 60)


if __name__ == '__main__':
    main()
