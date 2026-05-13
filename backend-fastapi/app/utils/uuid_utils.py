#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
UUID工具函数
简单的UUID生成和验证工具
"""

import uuid
from typing import Optional


def generate_uuid() -> str:
    """生成UUID v4"""
    return str(uuid.uuid4())


def is_valid_uuid(uuid_string: str) -> bool:
    """验证UUID格式"""
    if not uuid_string:
        return False

    try:
        uuid.UUID(uuid_string)
        return True
    except (ValueError, TypeError):
        return False


class UUIDValidator:
    """UUID验证器类"""

    @staticmethod
    def validate_request_uuid(uuid_string: str, field_name: str = "id") -> Optional[dict]:
        """验证请求中的UUID，返回错误信息或None"""
        if not uuid_string:
            return {"error": f"{field_name} is required", "code": 400}

        if not is_valid_uuid(uuid_string):
            return {"error": f"Invalid {field_name} format", "code": 400}

        return None