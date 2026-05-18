"""Contract: model_configs route response payloads must surface the new
``custom_headers`` and ``custom_body`` fields.

Why this is contract-grade and not just style: the frontend's
``ModelFormModal`` reads ``custom_headers`` / ``custom_body`` directly off
the GET response. If a refactor drops them silently from a route's
response, the frontend would still type-check (TS allows index access) but
edit-and-save would round-trip the user's freshly-entered custom values into
``{}``, which is a *very* subtle data-loss bug.

We can't boot the FastAPI app from this environment (mcp / DB deps) so we
do a source-AST scan: every literal dict that the route returns must
include both new keys. The five locations are:

  * GET  /model-configs               (list)
  * GET  /model-configs/{id}          (detail)
  * POST /model-configs               (create — returns minimal record;
                                       see below)
  * PUT  /model-configs/{id}          (update — full record)

POST returns a minimal record by design (no full echo); we deliberately
do not enforce custom_headers/custom_body there to avoid coupling this
contract to the create-response shape. GET (list / detail) and PUT are
the ones the frontend relies on.
"""

from __future__ import annotations

import ast
import pathlib

import pytest


ROUTE_FILE = (
    pathlib.Path(__file__).resolve().parents[3]
    / "backend-fastapi"
    / "app"
    / "api"
    / "routes"
    / "model_configs.py"
)


REQUIRED_KEYS = {"custom_headers", "custom_body"}


def _dict_keys_in_function(tree: ast.AST, func_name: str) -> list[set[str]]:
    """Return every literal-dict's string-key set inside the named function."""
    result: list[set[str]] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            for sub in ast.walk(node):
                if isinstance(sub, ast.Dict):
                    keys: set[str] = set()
                    for k in sub.keys:
                        if isinstance(k, ast.Constant) and isinstance(k.value, str):
                            keys.add(k.value)
                    result.append(keys)
    return result


@pytest.fixture(scope="module")
def route_ast() -> ast.AST:
    src = ROUTE_FILE.read_text(encoding="utf-8")
    return ast.parse(src)


@pytest.mark.contract
def test_route_file_exists():
    assert ROUTE_FILE.exists(), f"Route file not found: {ROUTE_FILE}"


@pytest.mark.contract
@pytest.mark.parametrize(
    "func_name",
    [
        "get_model_configs",       # GET /model-configs (list)
        "get_model_config",        # GET /model-configs/{id} (detail)
        "update_model_config",     # PUT /model-configs/{id}
    ],
)
def test_route_response_dict_includes_custom_keys(route_ast, func_name):
    """At least one literal dict inside the function must contain both
    new keys. This is satisfied as long as the response-shaping dict
    declares them; auxiliary dicts (validation maps, etc.) are not
    affected.
    """
    candidate_dicts = _dict_keys_in_function(route_ast, func_name)
    assert candidate_dicts, f"Did not locate function {func_name}"

    has_both = any(REQUIRED_KEYS <= keys for keys in candidate_dicts)
    assert has_both, (
        f"Function {func_name} does not return a response dict containing both "
        f"{sorted(REQUIRED_KEYS)} — the frontend relies on these fields being "
        f"present. See docs/agents/model-config-custom-params.md."
    )
