"""Integration coverage for LicenseMiddleware exemptions.

Repro: an expired license made LicenseMiddleware answer 403 for
/api/setup/status, which is the pre-auth connectivity probe used by both the
frontend SetupGate and the container healthcheck. The whole app then looked
unreachable instead of merely unlicensed.
"""

from __future__ import annotations

import pytest


@pytest.fixture
def expired_license(monkeypatch):
    import main

    class ExpiredLicenseService:
        def get_current_license(self):
            return None

    monkeypatch.setattr(
        "app.services.license_service.LicenseService", ExpiredLicenseService
    )
    return main


async def test_setup_status_stays_reachable_when_license_expired(
    client, expired_license
):
    response = await client.get("/api/setup/status")

    assert response.status_code == 200
    assert "setup_mode" in response.json()


async def test_business_api_still_blocked_when_license_expired(client, expired_license):
    response = await client.get("/api/agents")

    assert response.status_code == 403
    assert response.json()["code"] == "LICENSE_EXPIRED"
