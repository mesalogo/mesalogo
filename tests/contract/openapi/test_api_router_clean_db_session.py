"""Contract: the aggregate API router must attach ``clean_db_session`` as a
router-level dependency so that every business route starts on a fresh DB
transaction.

Why this is contract-grade, not style:

FastAPI sync ``def`` routes run in the AnyIO worker thread pool, and threads
are reused. The project's ``scoped_session`` is thread-local, so a reused
thread reuses its session. Under MariaDB's default REPEATABLE READ isolation
level, a session whose previous transaction never ended keeps serving the old
snapshot — so a route that reads ``ModelConfig`` (or any table) right after a
different connection committed an update returns *stale* data until that idle
transaction is eventually rolled back or the pooled connection recycles
(``pool_recycle=1800``). Symptom: "I edited the model name but the list took a
long time to refresh."

``core.dependencies.clean_db_session`` fixes this by ``rollback()``-ing at the
start of each request, forcing the next query to open a new transaction that
sees the latest committed data. Mounting it on the aggregate ``api_router``
applies it to every included business router in one place, and prevents a
newly added router from silently regressing.

We cannot boot the FastAPI app from this environment (sqlalchemy / DB deps are
absent), so this is an AST scan of ``app/api/routes/__init__.py``.
"""

from __future__ import annotations

import ast
import pathlib

import pytest


INIT_FILE = (
    pathlib.Path(__file__).resolve().parents[3]
    / "backend-fastapi"
    / "app"
    / "api"
    / "routes"
    / "__init__.py"
)

DEP_NAME = "clean_db_session"


@pytest.fixture(scope="module")
def init_ast() -> ast.AST:
    return ast.parse(INIT_FILE.read_text(encoding="utf-8"))


def _api_router_assignment(tree: ast.AST) -> ast.Call | None:
    """Return the ``APIRouter(...)`` call assigned to ``api_router``."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if "api_router" in targets and isinstance(node.value, ast.Call):
                return node.value
    return None


def _dependency_names(call: ast.Call) -> set[str]:
    """Extract the names wrapped by ``Depends(...)`` in a ``dependencies=[...]``
    keyword of an ``APIRouter(...)`` / ``include_router(...)`` call."""
    names: set[str] = set()
    for kw in call.keywords:
        if kw.arg != "dependencies" or not isinstance(kw.value, ast.List):
            continue
        for elt in kw.value.elts:
            # Depends(clean_db_session)
            if isinstance(elt, ast.Call) and isinstance(elt.func, ast.Name) and elt.func.id == "Depends":
                for arg in elt.args:
                    if isinstance(arg, ast.Name):
                        names.add(arg.id)
                    elif isinstance(arg, ast.Attribute):
                        names.add(arg.attr)
    return names


@pytest.mark.contract
def test_init_file_exists():
    assert INIT_FILE.exists(), f"Router aggregator not found: {INIT_FILE}"


@pytest.mark.contract
def test_clean_db_session_is_imported(init_ast):
    imported = any(
        isinstance(node, ast.ImportFrom)
        and any(alias.name == DEP_NAME for alias in node.names)
        for node in ast.walk(init_ast)
    )
    assert imported, (
        f"{DEP_NAME} must be imported in the router aggregator so it can be "
        f"attached to api_router."
    )


@pytest.mark.contract
def test_api_router_has_clean_db_session_dependency(init_ast):
    call = _api_router_assignment(init_ast)
    assert call is not None, "Could not locate `api_router = APIRouter(...)`."
    deps = _dependency_names(call)
    assert DEP_NAME in deps, (
        "api_router must be constructed with "
        "`dependencies=[Depends(clean_db_session)]` so every business route "
        "starts on a fresh DB transaction. Without it, sync routes on reused "
        "worker threads serve stale REPEATABLE READ snapshots (e.g. edited "
        "model name not refreshing). See core/dependencies.py::clean_db_session."
    )
