"""Unit test: POST /rules/test must require authentication.

Repro for the security audit finding that `/rules/test` was the only route in
`app/api/routes/rules.py` missing `Depends(get_current_user)`, leaving the
logic-rule sandbox (which runs user-supplied code) reachable unauthenticated.

Layer: unit. Inspects the router's dependency graph; no DB / network.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from core.dependencies import get_current_user

# Load rules.py directly to avoid triggering app/api/routes/__init__.py,
# which eagerly imports the whole route tree (mcp, etc.).
_RULES_PATH = (
    Path(__file__).resolve().parents[4]
    / "backend-fastapi" / "app" / "api" / "routes" / "rules.py"
)


def _load_rules_module():
    spec = importlib.util.spec_from_file_location("_rules_under_test", _RULES_PATH)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:  # missing heavy deps in this env
        pytest.skip(f"rules module import dependencies unavailable: {e}")
    return module


router = _load_rules_module().router


def _find_route(path: str, method: str):
    for route in router.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route
    raise AssertionError(f"route {method} {path} not found")


def test_rules_test_requires_authentication():
    route = _find_route("/rules/test", "POST")
    dep_calls = [d.call for d in route.dependant.dependencies]
    assert get_current_user in dep_calls, (
        "/rules/test must depend on get_current_user; it executes the rule "
        "sandbox and must not be reachable unauthenticated"
    )
