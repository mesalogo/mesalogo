"""
Unit tests: LicenseService trial-license auto-issuance (首次部署自动试用).

Layer: unit. 不依赖真实 DB / Redis / 网络:
- SystemSetting.get / SystemSetting.set 通过 monkeypatch 替换为内存字典
- 不调用 _get_license_secret_key() 实际逻辑，直接注入 secret_key

参见 AGENTS.md §4 "零兜底"：自动试用必须由显式调用方触发，由 env 开关控制。
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import pytest

from app.services.license_service import LicenseService


# ---------- helpers ----------

def _build_service(secret: str = "unit-test-secret"):
    """构造一个不读 DB 的 LicenseService（_get_license_secret_key 被短路）。"""
    svc = LicenseService.__new__(LicenseService)
    svc.secret_key = secret
    return svc


@pytest.fixture
def memory_settings(monkeypatch):
    """用内存字典替换 SystemSetting.get / set。

    返回 store 让用例可以直接读改，断言行为。
    """
    store: dict[str, object] = {}

    def fake_get(key, default=None):
        return store.get(key, default)

    def fake_set(key, value, value_type='string', description=None, category='general', is_secret=False):
        # 模拟生产逻辑：json value 序列化后再存
        if value_type == 'json' and not isinstance(value, str):
            value = json.dumps(value)
        store[key] = value
        return value

    from app.models import SystemSetting
    monkeypatch.setattr(SystemSetting, "get", classmethod(lambda cls, key, default=None: fake_get(key, default)))
    monkeypatch.setattr(
        SystemSetting,
        "set",
        classmethod(
            lambda cls, key, value, value_type='string', description=None, category='general', is_secret=False:
            fake_set(key, value, value_type, description, category, is_secret)
        ),
    )
    return store


# ---------- 1. pure key construction ----------

def test_build_trial_license_key_embeds_duration_and_expiry():
    svc = _build_service()
    now = datetime(2026, 1, 1, 12, 0, 0)
    key = svc.build_trial_license_key(duration_days=30, now=now)

    # 解码后能拿到 duration_days=30，且 expiry = now + 30d
    import base64, hmac, hashlib
    padded = key + '=' * (4 - len(key) % 4)
    decoded = base64.urlsafe_b64decode(padded)
    signature, data = decoded[:32], decoded[32:]
    payload = json.loads(data.decode())

    assert payload['duration_days'] == 30
    assert payload['type'] == LicenseService.DEFAULT_TRIAL_TYPE
    assert payload['expiry_date'] == (now + timedelta(days=30)).isoformat()
    # 签名应与 secret_key 匹配
    expected_sig = hmac.new(svc.secret_key.encode(), data, hashlib.sha256).digest()
    assert signature == expected_sig


def test_build_trial_license_key_rejects_when_secret_missing():
    svc = LicenseService.__new__(LicenseService)
    svc.secret_key = None
    with pytest.raises(RuntimeError):
        svc.build_trial_license_key(duration_days=30)


def test_build_trial_license_key_rejects_unknown_type():
    svc = _build_service()
    with pytest.raises(ValueError):
        svc.build_trial_license_key(duration_days=30, license_type="bogus")


# ---------- 2. _resolve_trial_days ----------

def test_resolve_trial_days_default_is_30(monkeypatch):
    monkeypatch.delenv("ABM_AUTO_TRIAL_DAYS", raising=False)
    svc = _build_service()
    assert svc._resolve_trial_days() == 30


def test_resolve_trial_days_reads_env(monkeypatch):
    monkeypatch.setenv("ABM_AUTO_TRIAL_DAYS", "7")
    svc = _build_service()
    assert svc._resolve_trial_days() == 7


def test_resolve_trial_days_env_zero_disables(monkeypatch):
    monkeypatch.setenv("ABM_AUTO_TRIAL_DAYS", "0")
    svc = _build_service()
    assert svc._resolve_trial_days() == 0


def test_resolve_trial_days_invalid_env_falls_back_to_default(monkeypatch, caplog_info):
    monkeypatch.setenv("ABM_AUTO_TRIAL_DAYS", "not-a-number")
    svc = _build_service()
    assert svc._resolve_trial_days() == 30
    assert any("ABM_AUTO_TRIAL_DAYS" in rec.message for rec in caplog_info.records)


def test_resolve_trial_days_explicit_override_wins(monkeypatch):
    monkeypatch.setenv("ABM_AUTO_TRIAL_DAYS", "5")
    svc = _build_service()
    assert svc._resolve_trial_days(override=14) == 14


# ---------- 3. issue_trial_license behavior ----------

def test_get_current_license_is_none_when_no_license_data(memory_settings):
    """复现：未签发任何 license 时，get_current_license() 必须为 None。

    这是中间件 LICENSE_EXPIRED 403 行为的源头，不能回归。
    """
    svc = _build_service()
    assert svc.get_current_license() is None


def test_issue_trial_license_disabled_when_env_zero(memory_settings, monkeypatch):
    monkeypatch.setenv("ABM_AUTO_TRIAL_DAYS", "0")
    svc = _build_service()
    result = svc.issue_trial_license()
    assert result['success'] is False
    assert result.get('skipped') is True
    # 不应写入任何 license_data
    assert 'license_data' not in memory_settings


def test_issue_trial_license_persists_30_day_standard_license(memory_settings, monkeypatch):
    monkeypatch.delenv("ABM_AUTO_TRIAL_DAYS", raising=False)
    svc = _build_service()
    result = svc.issue_trial_license()
    assert result['success'] is True
    lic = result['license']
    assert lic['license_type'] == LicenseService.DEFAULT_TRIAL_TYPE
    assert lic['customer_name'] == LicenseService.TRIAL_CUSTOMER_NAME

    # expiry 大约在 30 天后
    expiry = datetime.fromisoformat(lic['expiry_date'])
    delta = expiry - datetime.now()
    assert timedelta(days=29) <= delta <= timedelta(days=31)

    # 已经落库
    assert 'license_data' in memory_settings
    persisted = json.loads(memory_settings['license_data'])
    assert persisted['license_type'] == LicenseService.DEFAULT_TRIAL_TYPE


def test_issue_trial_license_skipped_when_license_already_exists(memory_settings, monkeypatch):
    monkeypatch.delenv("ABM_AUTO_TRIAL_DAYS", raising=False)
    svc = _build_service()
    # 先签一张
    first = svc.issue_trial_license()
    assert first['success'] is True
    first_expiry = first['license']['expiry_date']

    # 第二次调用应跳过，不覆盖已有 license
    second = svc.issue_trial_license()
    assert second['success'] is False
    assert second.get('skipped') is True
    assert second.get('license') is not None

    persisted = json.loads(memory_settings['license_data'])
    assert persisted['expiry_date'] == first_expiry


def test_issue_trial_license_force_overrides_existing(memory_settings, monkeypatch):
    monkeypatch.delenv("ABM_AUTO_TRIAL_DAYS", raising=False)
    svc = _build_service()
    first = svc.issue_trial_license()
    assert first['success'] is True

    second = svc.issue_trial_license(duration_days=7, force=True)
    assert second['success'] is True
    expiry = datetime.fromisoformat(second['license']['expiry_date'])
    delta = expiry - datetime.now()
    assert timedelta(days=6) <= delta <= timedelta(days=8)


def test_issue_trial_license_custom_duration(memory_settings, monkeypatch):
    monkeypatch.delenv("ABM_AUTO_TRIAL_DAYS", raising=False)
    svc = _build_service()
    result = svc.issue_trial_license(duration_days=90)
    assert result['success'] is True
    expiry = datetime.fromisoformat(result['license']['expiry_date'])
    delta = expiry - datetime.now()
    assert timedelta(days=89) <= delta <= timedelta(days=91)
