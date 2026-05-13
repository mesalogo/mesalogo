#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
License服务

处理系统许可证的验证和管理
"""

import os
import json
import base64
import hashlib
import hmac
import logging
from datetime import datetime
from core.config import settings
from app.models import db, SystemSetting

# 设置日志
logger = logging.getLogger(__name__)

class LicenseService:
    """许可证服务"""

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
            'max_action_spaces': 10,
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

    def __init__(self):
        """初始化服务"""
        # 从系统设置中获取密钥
        self.secret_key = self._get_license_secret_key()
        # 如果初始化时无法获取密钥，记录警告
        if not self.secret_key:
            logger.warning("初始化许可证服务时未能获取密钥，将在需要时重新尝试获取")

    def _get_license_secret_key(self):
        """从系统设置中获取许可证密钥"""
        try:
            # 尝试从系统设置中获取
            from app.models import SystemSetting
            secret_key = SystemSetting.get('license_secret_key')
            if secret_key:
                return secret_key

            # 如果没有设置，从环境变量或配置中获取
            secret_key = os.environ.get('LICENSE_SECRET_KEY') or settings.get('LICENSE_SECRET_KEY')
            if secret_key:
                # 保存到系统设置中
                SystemSetting.set(
                    key='license_secret_key',
                    value=secret_key,
                    value_type='string',
                    description='许可证验证密钥',
                    category='license',
                    is_secret=True
                )
                return secret_key

            # 如果仍然没有，尝试从license_request.txt文件中读取
            license_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'license_request.txt')
            if os.path.exists(license_file):
                try:
                    with open(license_file, 'r') as f:
                        content = f.read()
                        # 从文件中提取密钥
                        import re
                        match = re.search(r'系统许可证密钥: ([A-Za-z0-9]+)', content)
                        if match:
                            key = match.group(1)
                            logger.info("从license_request.txt文件中读取密钥")

                            # 保存到系统设置中
                            SystemSetting.set(
                                key='license_secret_key',
                                value=key,
                                value_type='string',
                                description='许可证验证密钥',
                                category='license',
                                is_secret=True
                            )
                            return key
                except Exception as e:
                    logger.error(f"从license_request.txt读取密钥失败: {e}")

            # 没有设置密钥，记录错误
            logger.error("未设置许可证密钥，许可证验证将失败")
            return None
        except Exception as e:
            logger.error(f"获取许可证密钥失败: {e}")
            return None

    def get_license_data(self, include_expired=False):
        """获取许可证数据，可选择是否包含过期的许可证

        Args:
            include_expired: 是否包含过期的许可证

        Returns:
            dict: 许可证信息，如果没有许可证则返回None
        """
        try:
            # 从系统设置中获取许可证信息
            license_data = SystemSetting.get('license_data', None)
            if not license_data:
                return None

            # 验证许可证
            if isinstance(license_data, str):
                try:
                    license_data = json.loads(license_data)
                except:
                    logger.error("许可证数据格式错误")
                    return None

            # 检查过期日期
            if not include_expired and license_data.get('expiry_date'):
                try:
                    expiry_date = datetime.fromisoformat(license_data['expiry_date'])
                    if expiry_date < datetime.now():
                        logger.warning(f"许可证已过期: {license_data['expiry_date']}")
                        # 添加过期标志
                        license_data['is_expired'] = True
                        if not include_expired:
                            return None
                    else:
                        license_data['is_expired'] = False
                except:
                    logger.error("许可证过期日期格式错误")
                    if not include_expired:
                        return None
            else:
                license_data['is_expired'] = False

            return license_data
        except Exception as e:
            logger.error(f"获取许可证信息失败: {e}")
            return None

    def get_current_license(self):
        """获取当前许可证信息

        Returns:
            dict: 许可证信息，如果没有有效许可证则返回None
        """
        return self.get_license_data(include_expired=False)

    def activate_license(self, license_key):
        """激活许可证

        Args:
            license_key: 许可证密钥

        Returns:
            dict: 激活结果
        """
        try:
            # 验证许可证密钥格式
            if not license_key:
                return {
                    'success': False,
                    'message': '许可证密钥不能为空'
                }

            # 解码许可证密钥
            try:
                decoded = base64.urlsafe_b64decode(license_key + '=' * (4 - len(license_key) % 4))

                # 分离签名和数据
                signature = decoded[:32]  # SHA256哈希值为32字节
                data = decoded[32:]

                # 验证签名
                if not self.secret_key:
                    # 如果初始化时未获取到密钥，再次尝试获取
                    self.secret_key = self._get_license_secret_key()
                    if not self.secret_key:
                        return {
                            'success': False,
                            'message': '系统未配置许可证密钥，无法验证许可证'
                        }

                expected_signature = hmac.new(
                    self.secret_key.encode(),
                    data,
                    hashlib.sha256
                ).digest()

                if signature != expected_signature:
                    return {
                        'success': False,
                        'message': '许可证密钥签名验证失败'
                    }

                # 解析数据
                try:
                    key_data = json.loads(data.decode())
                except:
                    return {
                        'success': False,
                        'message': '许可证密钥数据格式错误'
                    }

                # 获取许可证类型
                license_type = key_data.get('type')
                if license_type not in self.LICENSE_TYPES:
                    return {
                        'success': False,
                        'message': f'不支持的许可证类型: {license_type}'
                    }

                # 创建许可证数据
                customer_name = key_data.get('customer', '未知客户')

                # 计算过期日期
                issued_timestamp = key_data.get('timestamp', 0)
                issued_date = datetime.fromtimestamp(issued_timestamp)

                # 检查是否有过期日期信息
                expiry_date = None
                if 'expiry_date' in key_data:
                    try:
                        # 如果密钥中直接包含过期日期
                        expiry_date = key_data['expiry_date']
                    except:
                        logger.warning("无法解析密钥中的过期日期")
                elif 'duration_days' in key_data:
                    try:
                        # 如果密钥中包含有效期天数
                        from datetime import timedelta
                        duration_days = int(key_data['duration_days'])
                        if duration_days > 0:
                            expiry_date = (issued_date + timedelta(days=duration_days)).isoformat()
                    except:
                        logger.warning("无法计算过期日期")

                # 创建许可证数据
                license_data = {
                    'license_key': license_key,
                    'license_type': license_type,
                    'license_name': self.LICENSE_TYPES[license_type]['name'],
                    'customer_name': customer_name,
                    'issued_date': issued_date.isoformat(),
                    'expiry_date': expiry_date,  # 可能是None（永久有效）或ISO格式的日期字符串
                    'features': self.LICENSE_TYPES[license_type]['features'],
                    'max_agents': self.LICENSE_TYPES[license_type]['max_agents'],
                    'max_action_spaces': self.LICENSE_TYPES[license_type]['max_action_spaces'],
                    'max_roles': self.LICENSE_TYPES[license_type]['max_roles'],
                    'activation_date': datetime.now().isoformat()
                }

                # 保存许可证数据到系统设置
                SystemSetting.set(
                    key='license_data',
                    value=json.dumps(license_data),
                    value_type='json',
                    description='系统许可证数据',
                    category='license'
                )

                return {
                    'success': True,
                    'license': license_data
                }
            except Exception as e:
                logger.error(f"解析许可证密钥失败: {e}")
                return {
                    'success': False,
                    'message': f'解析许可证密钥失败: {str(e)}'
                }
        except Exception as e:
            logger.error(f"激活许可证失败: {e}")
            return {
                'success': False,
                'message': f'激活许可证失败: {str(e)}'
            }

    def check_feature_availability(self, feature_name):
        """检查特定功能是否可用

        Args:
            feature_name: 功能名称

        Returns:
            bool: 功能是否可用
        """
        # 获取当前许可证
        license_data = self.get_current_license()
        if not license_data:
            return False

        # 检查许可证是否包含该功能
        return feature_name in license_data.get('features', [])

    def check_resource_limit(self, resource_type, current_count):
        """检查资源限制

        Args:
            resource_type: 资源类型 (agents, action_spaces, roles)
            current_count: 当前资源数量

        Returns:
            bool: 是否允许创建更多资源
        """
        # 获取当前许可证
        license_data = self.get_current_license()
        if not license_data:
            return False

        # 检查资源限制
        limit_key = f'max_{resource_type}'
        if limit_key in license_data:
            return current_count < license_data[limit_key]

        # 默认不限制
        return True

    def load_license_from_file(self, file_path):
        """从文件加载许可证

        Args:
            file_path: 许可证文件路径

        Returns:
            dict: 加载结果
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                license_data = json.load(f)

            # 验证license文件格式
            if 'license_key' not in license_data:
                return {
                    'success': False,
                    'message': '无效的许可证文件格式'
                }

            # 激活license
            return self.activate_license(license_data['license_key'])
        except Exception as e:
            logger.error(f"从文件加载许可证失败: {e}")
            return {
                'success': False,
                'message': f'加载许可证文件失败: {str(e)}'
            }
