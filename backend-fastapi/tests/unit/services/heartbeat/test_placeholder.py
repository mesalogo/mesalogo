"""
Heartbeat 单测占位文件。

实际测试随 P1 骨架一起补:
- test_clock.py          TickClock 节拍准时 + stop 真停
- test_registry.py       register/deregister 索引一致性
- test_policy_noop.py    noop 策略只更新 last_tick_at
- test_overlap_skip.py   上次未结束本次 outcome=overlap_skip

详见 docs/feature-heartbeat/PLAN.md §10 P1 验收。

本文件只确保:
1. 目录被 pytest 发现
2. heartbeat marker 已在 pytest.ini 注册
"""
from __future__ import annotations

import pytest


@pytest.mark.heartbeat
def test_heartbeat_marker_registered():
    """heartbeat marker 必须在 pytest.ini strict-markers 名单里。"""
    assert True
