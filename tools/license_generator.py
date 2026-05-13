#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
License生成工具

用于生成系统许可证密钥和许可证文件
"""

import os
import json
import base64
import hashlib
import hmac
import uuid
import argparse
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# 默认密钥 - 这个密钥应该与系统中使用的密钥相同
# 注意：在实际使用中，厂商应该使用客户提供的密钥来生成license
DEFAULT_SECRET_KEY = 'cMyxzQ7GCGUIcr0TnS4SFUFE0hrUNdyX'

# 许可证类型定义
LICENSE_TYPES = {
    'standard': {
        'name': '标准版',
        'features': ['basic_agents', 'basic_roles', 'basic_action_spaces'],
        'max_agents': 10,
        'max_action_spaces': 5,
        'max_roles': 20,
    },
    'professional': {
        'name': '专业版',
        'features': ['basic_agents', 'basic_roles', 'basic_action_spaces',
                    'advanced_agents', 'advanced_roles', 'knowledge_base'],
        'max_agents': 50,
        'max_action_spaces': 20,
        'max_roles': 100,
    },
    'enterprise': {
        'name': '旗舰版',
        'features': ['basic_agents', 'basic_roles', 'basic_action_spaces',
                    'advanced_agents', 'advanced_roles', 'knowledge_base',
                    'custom_tools', 'advanced_analytics', 'unlimited_memory'],
        'max_agents': 999,
        'max_action_spaces': 999,
        'max_roles': 999,
    }
}

class LicenseGenerator:
    """许可证生成器"""

    def __init__(self, secret_key=None):
        """初始化生成器

        Args:
            secret_key: 用于签名的密钥，如果不提供则自动生成
        """
        if secret_key:
            self.secret_key = secret_key
        else:
            # 生成一个新的密钥
            self.secret_key = Fernet.generate_key().decode()
            print(f"生成的密钥: {self.secret_key}")
            print("请保存此密钥用于验证许可证")

    def generate_license_key(self, customer_name, license_type, duration_days=None):
        """生成许可证密钥

        Args:
            customer_name: 客户名称
            license_type: 许可证类型
            duration_days: 许可证有效期天数，None表示永久有效

        Returns:
            生成的许可证密钥
        """
        # 创建一个包含关键信息的字典
        key_data = {
            'customer': customer_name,
            'type': license_type,
            'uuid': str(uuid.uuid4()),
            'timestamp': datetime.now().timestamp()
        }

        # 添加过期日期信息
        if duration_days:
            key_data['duration_days'] = duration_days
            # 计算过期日期
            expiry_date = datetime.now() + timedelta(days=duration_days)
            key_data['expiry_date'] = expiry_date.isoformat()

        # 将数据转换为JSON字符串
        data_str = json.dumps(key_data)
        data_bytes = data_str.encode()

        # 使用HMAC-SHA256生成签名
        signature = hmac.new(
            self.secret_key.encode(),
            data_bytes,
            hashlib.sha256
        ).digest()

        # 将签名和数据组合并进行Base64编码
        combined = signature + data_bytes
        license_key = base64.urlsafe_b64encode(combined).decode().rstrip('=')

        return license_key

    def encrypt_license_data(self, license_data):
        """加密许可证数据

        Args:
            license_data: 许可证数据字典

        Returns:
            加密后的许可证数据
        """
        # 生成加密密钥
        salt = os.urandom(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.secret_key.encode()))

        # 使用Fernet对称加密
        f = Fernet(key)
        license_json = json.dumps(license_data).encode()
        encrypted_data = f.encrypt(license_json)

        # 返回salt和加密数据
        return {
            'salt': base64.urlsafe_b64encode(salt).decode(),
            'data': base64.urlsafe_b64encode(encrypted_data).decode()
        }

    def generate_license(self, customer_name, license_type, duration_days=None):
        """生成完整的许可证

        Args:
            customer_name: 客户名称
            license_type: 许可证类型 (standard, professional, enterprise)
            duration_days: 许可证有效期天数，None表示永久有效

        Returns:
            许可证数据字典
        """
        if license_type not in LICENSE_TYPES:
            raise ValueError(f"无效的许可证类型: {license_type}，可用类型: {', '.join(LICENSE_TYPES.keys())}")

        # 生成许可证密钥
        license_key = self.generate_license_key(customer_name, license_type, duration_days)

        # 设置过期日期
        issued_date = datetime.now()
        if duration_days:
            expiry_date = issued_date + timedelta(days=duration_days)
        else:
            expiry_date = None

        # 创建许可证数据
        license_data = {
            'license_key': license_key,  # 使用完整的许可证密钥
            'license_type': license_type,
            'license_name': LICENSE_TYPES[license_type]['name'],
            'customer_name': customer_name,
            'issued_date': issued_date.isoformat(),
            'expiry_date': expiry_date.isoformat() if expiry_date else None,
            'features': LICENSE_TYPES[license_type]['features'],
            'max_agents': LICENSE_TYPES[license_type]['max_agents'],
            'max_action_spaces': LICENSE_TYPES[license_type]['max_action_spaces'],
            'max_roles': LICENSE_TYPES[license_type]['max_roles']
        }

        return license_data

    def save_license_file(self, license_data, output_file):
        """保存许可证到文件

        Args:
            license_data: 许可证数据
            output_file: 输出文件路径
        """
        # 加密许可证数据
        encrypted_data = self.encrypt_license_data(license_data)

        # 添加元数据
        output_data = {
            'format_version': '1.0',
            'license_key': license_data['license_key'],
            'customer_name': license_data['customer_name'],
            'license_type': license_data['license_type'],
            'issued_date': license_data['issued_date'],
            'encrypted_data': encrypted_data
        }

        # 保存到文件
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"许可证文件已保存到: {output_file}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='生成系统许可证')
    parser.add_argument('--customer', required=True, help='客户名称')
    parser.add_argument('--type', choices=LICENSE_TYPES.keys(), default='standard', help='许可证类型')
    parser.add_argument('--days', type=int, help='许可证有效期天数，不指定则永久有效')
    parser.add_argument('--output', default='license.json', help='输出文件路径')
    parser.add_argument('--secret', help='用于签名的密钥，不提供则使用默认密钥')

    args = parser.parse_args()

    # 使用命令行参数中的密钥，如果没有提供则使用默认密钥
    secret_key = args.secret or DEFAULT_SECRET_KEY

    # 创建许可证生成器
    generator = LicenseGenerator(secret_key)

    # 生成许可证
    license_data = generator.generate_license(args.customer, args.type, args.days)

    # 获取完整的许可证密钥（不截断）
    full_license_key = generator.generate_license_key(args.customer, args.type, args.days)

    # 打印许可证信息
    print("\n许可证信息:")
    print(f"许可证密钥: {full_license_key}")
    print(f"客户名称: {license_data['customer_name']}")
    print(f"许可证类型: {license_data['license_name']}")
    print(f"发行日期: {license_data['issued_date']}")
    print(f"过期日期: {license_data['expiry_date'] or '永久有效'}")
    print(f"最大智能体数量: {license_data['max_agents']}")
    print(f"最大行动空间数量: {license_data['max_action_spaces']}")
    print(f"最大角色数量: {license_data['max_roles']}")
    print(f"包含功能: {', '.join(license_data['features'])}")

    # 保存许可证文件
    generator.save_license_file(license_data, args.output)

    # 打印激活说明
    print("\n激活说明:")
    print("1. 使用上面生成的完整许可证密钥激活系统")
    print("2. 可以通过系统的'关于'页面中的'激活许可证'功能进行激活")
    print("3. 也可以使用API接口激活：")
    print(f"   curl -X POST -H \"Content-Type: application/json\" -d '{{\"license_key\":\"{full_license_key}\"}}' http://localhost:8080/api/license/activate")
    print("\n注意：许可证密钥已更新为完整格式，与系统兼容。请使用完整的许可证密钥进行激活。")


if __name__ == '__main__':
    main()
