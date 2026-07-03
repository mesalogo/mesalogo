"""Repro + guard for GET /users/{user_id}/permissions 500.

Production bug (2026-07-03): the handler body referenced `User` but the model
was only imported function-locally inside assign_role_to_user, so every call
raised `NameError: name 'User' is not defined`, which the blanket
`except Exception` converted into a 500 for ALL requests, including the
"user not found" case that must be a 404.

These are unit tests: User / UserPermissionService are monkeypatched on the
route module, no DB involved.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.routes import permissions as permissions_module


def test_user_model_bound_at_module_level():
    # The NameError repro: handlers use `User` at call time, so the module
    # itself must own the binding.
    assert hasattr(permissions_module, "User")


def _patch_user_query(monkeypatch, found_user):
    class _Query:
        @staticmethod
        def get(_user_id):
            return found_user

    class _FakeUserModel:
        query = _Query()

    monkeypatch.setattr(permissions_module, "User", _FakeUserModel)
    return _FakeUserModel


def test_get_user_all_permissions_returns_payload(monkeypatch):
    sentinel_user = object()
    _patch_user_query(monkeypatch, sentinel_user)
    monkeypatch.setattr(
        permissions_module.UserPermissionService,
        "get_user_permissions",
        staticmethod(lambda user: ["perm-a"]),
    )
    monkeypatch.setattr(
        permissions_module.UserPermissionService,
        "get_menu_permissions",
        staticmethod(lambda user: ["menu-a"]),
    )

    result = permissions_module.get_user_all_permissions("uid-1")

    assert result == {
        "user_id": "uid-1",
        "permissions": ["perm-a"],
        "menu_permissions": ["menu-a"],
    }


def test_get_user_all_permissions_missing_user_is_404(monkeypatch):
    _patch_user_query(monkeypatch, None)

    with pytest.raises(HTTPException) as exc_info:
        permissions_module.get_user_all_permissions("uid-missing")

    # must surface as 404, not be swallowed into a generic 500
    assert exc_info.value.status_code == 404
