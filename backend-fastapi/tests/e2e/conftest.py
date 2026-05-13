"""
e2e-layer conftest

端到端测试原则:
- 完整 SSE / SubAgent / 多 agent 协作链路
- 只 mock LLM,其他都真实
- 分钟级,CI 才跑
"""
from __future__ import annotations

import pytest


def pytest_collection_modifyitems(items):
    for item in items:
        if "tests/e2e/" in str(item.fspath).replace("\\", "/"):
            item.add_marker(pytest.mark.e2e)
            item.add_marker(pytest.mark.slow)
