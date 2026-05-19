"""Contract: embedding service lives outside vector-store packages."""

from __future__ import annotations

import importlib
import pathlib

import pytest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
BACKEND_ROOT = REPO_ROOT / "backend-fastapi"


@pytest.mark.contract
def test_embedding_service_imports_from_neutral_package():
    module = importlib.import_module("app.services.embedding")

    assert hasattr(module, "EmbeddingService")
    assert hasattr(module, "embedding_service")
    assert module.embedding_service.__class__ is module.EmbeddingService


@pytest.mark.contract
def test_embedding_service_has_no_tidb_import_path_residue():
    forbidden = (
        "app.services.vector_db_tidb.embedding_service",
        "from .embedding_service import",
    )
    allowed = {pathlib.Path(__file__).resolve()}

    offenders: list[str] = []
    for path in BACKEND_ROOT.rglob("*.py"):
        if path in allowed or "__pycache__" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        for token in forbidden:
            if token in text:
                offenders.append(f"{path.relative_to(REPO_ROOT)} contains {token!r}")

    assert not offenders
