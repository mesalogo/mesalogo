"""
unit-layer conftest

单测原则:
- 不碰真实 DB / Redis / 网络
- 用纯内存工厂构造对象
- 毫秒级
"""
from __future__ import annotations

import pytest


# unit 层默认给所有测试加 unit marker
def pytest_collection_modifyitems(items):
    for item in items:
        # 只给本 conftest 所在子树的 item 加
        if "tests/unit/" in str(item.fspath).replace("\\", "/"):
            item.add_marker(pytest.mark.unit)
