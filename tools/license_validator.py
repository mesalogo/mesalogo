#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
License验证工具

用于验证系统许可证的有效性
"""

import os
import sys
import json
import base64
import hashlib
import hmac
import argparse
from datetime import datetime
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class LicenseValidator:
    """许可证验证器"""
    
    def __init__(self, secret_key):
        """初始化验证器
        
        Args:
            secret_key: 用于验证签名的密钥
        """
        self.secret_key = secret_key
    
    def decrypt_license_data(self, encrypted_data, salt):
        """解密许可证数据
        
        Args:
            encrypted_data: 加密的许可证数据
            salt: 加密使用的盐值
            
        Returns:
            解密后的许可证数据
        """
        try:
            # 解码salt和加密数据
            salt = base64.urlsafe_b64decode(salt)
            encrypted_data = base64.urlsafe_b64decode(encrypted_data)
            
            # 重新生成加密密钥
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(self.secret_key.encode()))
            
            # 使用Fernet对称解密
            f = Fernet(key)
            decrypted_data = f.decrypt(encrypted_data)
            
            # 解析JSON数据
            return json.loads(decrypted_data.decode())
        except Exception as e:
            print(f"解密许可证数据失败: {e}")
            return None
    
    def validate_license_file(self, license_file):
        """验证许可证文件
        
        Args:
            license_file: 许可证文件路径
            
        Returns:
            (bool, dict): 验证结果和许可证数据
        """
        try:
            # 读取许可证文件
            with open(license_file, 'r', encoding='utf-8') as f:
                license_data = json.load(f)
            
            # 检查文件格式版本
            if license_data.get('format_version') != '1.0':
                print(f"不支持的许可证格式版本: {license_data.get('format_version')}")
                return False, None
            
            # 解密许可证数据
            encrypted_data = license_data.get('encrypted_data', {})
            salt = encrypted_data.get('salt')
            data = encrypted_data.get('data')
            
            if not salt or not data:
                print("许可证文件格式错误: 缺少加密数据")
                return False, None
            
            decrypted_data = self.decrypt_license_data(data, salt)
            if not decrypted_data:
                return False, None
            
            # 验证许可证密钥签名
            license_key = decrypted_data.get('license_key')
            signature = decrypted_data.get('signature')
            
            if not license_key or not signature:
                print("许可证数据格式错误: 缺少密钥或签名")
                return False, None
            
            # 计算签名
            expected_signature = base64.urlsafe_b64encode(
                hmac.new(
                    self.secret_key.encode(),
                    license_key.encode(),
                    hashlib.sha256
                ).digest()
            ).decode()
            
            if signature != expected_signature:
                print("许可证签名验证失败")
                return False, None
            
            # 检查过期日期
            expiry_date = decrypted_data.get('expiry_date')
            if expiry_date:
                expiry_datetime = datetime.fromisoformat(expiry_date)
                if expiry_datetime < datetime.now():
                    print(f"许可证已过期: {expiry_date}")
                    return False, decrypted_data
            
            return True, decrypted_data
        except Exception as e:
            print(f"验证许可证文件失败: {e}")
            return False, None
    
    def validate_license_key(self, license_key, customer_name=None, license_type=None):
        """验证许可证密钥
        
        Args:
            license_key: 许可证密钥
            customer_name: 客户名称（可选，用于额外验证）
            license_type: 许可证类型（可选，用于额外验证）
            
        Returns:
            bool: 验证结果
        """
        try:
            # 解码许可证密钥
            decoded = base64.urlsafe_b64decode(license_key + '=' * (4 - len(license_key) % 4))
            
            # 分离签名和数据
            signature = decoded[:32]  # SHA256哈希值为32字节
            data = decoded[32:]
            
            # 验证签名
            expected_signature = hmac.new(
                self.secret_key.encode(),
                data,
                hashlib.sha256
            ).digest()
            
            if signature != expected_signature:
                print("许可证密钥签名验证失败")
                return False
            
            # 解析数据
            try:
                key_data = json.loads(data.decode())
            except:
                print("许可证密钥数据格式错误")
                return False
            
            # 额外验证
            if customer_name and key_data.get('customer') != customer_name:
                print(f"客户名称不匹配: {key_data.get('customer')} != {customer_name}")
                return False
            
            if license_type and key_data.get('type') != license_type:
                print(f"许可证类型不匹配: {key_data.get('type')} != {license_type}")
                return False
            
            return True
        except Exception as e:
            print(f"验证许可证密钥失败: {e}")
            return False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='验证系统许可证')
    parser.add_argument('--file', help='许可证文件路径')
    parser.add_argument('--key', help='许可证密钥')
    parser.add_argument('--secret', required=True, help='用于验证的密钥')
    parser.add_argument('--customer', help='客户名称（可选，用于额外验证）')
    parser.add_argument('--type', help='许可证类型（可选，用于额外验证）')
    
    args = parser.parse_args()
    
    if not args.file and not args.key:
        parser.error("必须提供许可证文件或许可证密钥")
    
    # 创建许可证验证器
    validator = LicenseValidator(args.secret)
    
    # 验证许可证
    if args.file:
        valid, license_data = validator.validate_license_file(args.file)
        if valid:
            print("\n许可证验证成功!")
            print("\n许可证信息:")
            print(f"许可证密钥: {license_data['license_key']}")
            print(f"客户名称: {license_data['customer_name']}")
            print(f"许可证类型: {license_data['license_name']}")
            print(f"发行日期: {license_data['issued_date']}")
            print(f"过期日期: {license_data['expiry_date'] or '永久有效'}")
            print(f"最大智能体数量: {license_data['max_agents']}")
            print(f"最大行动空间数量: {license_data['max_action_spaces']}")
            print(f"最大角色数量: {license_data['max_roles']}")
            print(f"包含功能: {', '.join(license_data['features'])}")
        else:
            print("\n许可证验证失败!")
    
    if args.key:
        valid = validator.validate_license_key(args.key, args.customer, args.type)
        if valid:
            print("\n许可证密钥验证成功!")
        else:
            print("\n许可证密钥验证失败!")


if __name__ == '__main__':
    main()
