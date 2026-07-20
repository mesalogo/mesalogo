"""Regression tests for Parallel Lab HTTP status preservation."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest
from fastapi import HTTPException


@pytest.fixture
def routes(monkeypatch):
    service_module = ModuleType("app.services.parallel_experiment_service")

    class FakeParallelExperimentService:
        pass

    service_module.ParallelExperimentService = FakeParallelExperimentService

    app_module = ModuleType("app")
    app_module.db = SimpleNamespace(
        session=SimpleNamespace(rollback=lambda: None)
    )
    app_services_module = ModuleType("app.services")
    core_module = ModuleType("core")
    config_module = ModuleType("core.config")
    config_module.settings = SimpleNamespace()
    dependencies_module = ModuleType("core.dependencies")
    dependencies_module.get_current_user = lambda: None
    dependencies_module.get_admin_user = lambda: None
    invalidated_keys = []
    cache_module = ModuleType("core.cache")
    cache_module.invalidate_keys = lambda *keys: invalidated_keys.append(keys)

    monkeypatch.setitem(sys.modules, "app", app_module)
    monkeypatch.setitem(sys.modules, "app.services", app_services_module)
    monkeypatch.setitem(
        sys.modules,
        "app.services.parallel_experiment_service",
        service_module,
    )
    monkeypatch.setitem(sys.modules, "core", core_module)
    monkeypatch.setitem(sys.modules, "core.config", config_module)
    monkeypatch.setitem(sys.modules, "core.dependencies", dependencies_module)
    monkeypatch.setitem(sys.modules, "core.cache", cache_module)

    route_file = (
        Path(__file__).resolve().parents[4]
        / "backend-fastapi"
        / "app"
        / "api"
        / "routes"
        / "parallel_experiments.py"
    )
    spec = importlib.util.spec_from_file_location(
        "_parallel_experiment_routes_under_test",
        route_file,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    module.invalidated_keys = invalidated_keys
    return module


class JsonRequest:
    def __init__(self, payload):
        self.payload = payload

    async def json(self):
        return self.payload


class QueryRequest:
    def __init__(self, **params):
        self.query_params = params


@pytest.mark.parametrize(
    ("route_name", "service_method", "expected_status"),
    [
        ("pause_experiment", "pause_experiment", 400),
        ("resume_experiment", "resume_experiment", 400),
        ("delete_experiment", "delete_experiment", 404),
    ],
)
def test_state_change_routes_preserve_expected_client_error(
    monkeypatch,
    routes,
    route_name,
    service_method,
    expected_status,
):
    monkeypatch.setattr(
        routes.ParallelExperimentService,
        service_method,
        lambda _experiment_id: False,
        raising=False,
    )

    with pytest.raises(HTTPException) as exc_info:
        getattr(routes, route_name)("missing-or-invalid")

    assert exc_info.value.status_code == expected_status


async def test_create_draft_missing_required_field_returns_400(routes):
    with pytest.raises(HTTPException) as exc_info:
        await routes.create_draft_experiment(
            JsonRequest({"name": "incomplete"})
        )

    assert exc_info.value.status_code == 400


async def test_validate_config_returns_400_with_validation_errors(routes):
    with pytest.raises(HTTPException) as exc_info:
        await routes.validate_experiment_config(JsonRequest({}))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["valid"] is False


def test_successful_state_change_invalidates_detail_and_status_cache(
    monkeypatch,
    routes,
):
    monkeypatch.setattr(
        routes.ParallelExperimentService,
        "pause_experiment",
        lambda _experiment_id: True,
        raising=False,
    )

    response = routes.pause_experiment("experiment-1")

    assert response["success"] is True
    assert routes.invalidated_keys == [
        (
            "exp_detail:experiment-1",
            "exp_status:experiment-1:cur",
        )
    ]


@pytest.mark.parametrize(
    "query_request",
    [
        QueryRequest(page="0"),
        QueryRequest(limit="0"),
        QueryRequest(page="not-a-number"),
    ],
)
def test_list_rejects_invalid_pagination_with_400(routes, query_request):
    with pytest.raises(HTTPException) as exc_info:
        routes.list_experiments(query_request)

    assert exc_info.value.status_code == 400


@pytest.mark.parametrize(
    "query_request",
    [
        QueryRequest(runs_page="0"),
        QueryRequest(runs_limit="0"),
        QueryRequest(iteration="not-a-number"),
    ],
)
def test_status_rejects_invalid_pagination_with_400(routes, query_request):
    with pytest.raises(HTTPException) as exc_info:
        routes.get_experiment_status("experiment-1", query_request)

    assert exc_info.value.status_code == 400
