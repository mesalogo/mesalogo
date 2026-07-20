"""Tests for the diff-aware Ruff quality gate."""

from __future__ import annotations

from pathlib import Path

from tools.ci.ruff_changed_lines import (
    diagnostic_touches_added_line,
    parse_added_lines,
)


def test_parse_added_lines_tracks_only_new_side():
    diff = """\
diff --git a/example.py b/example.py
--- a/example.py
+++ b/example.py
@@ -2,2 +2,3 @@
 unchanged
-removed
+added
+also_added
"""

    assert parse_added_lines(diff) == {"example.py": {3, 4}}


def test_parse_added_lines_ignores_deleted_file():
    diff = """\
diff --git a/old.py b/old.py
--- a/old.py
+++ /dev/null
@@ -1 +0,0 @@
-deleted
"""

    assert parse_added_lines(diff) == {}


def test_diagnostic_must_overlap_added_line():
    repository_root = Path("/workspace")
    added_lines = {"backend-fastapi/app/service.py": {10, 11}}
    diagnostic = {
        "filename": "/workspace/backend-fastapi/app/service.py",
        "location": {"row": 9, "column": 1},
        "end_location": {"row": 10, "column": 4},
    }

    assert diagnostic_touches_added_line(diagnostic, added_lines, repository_root)


def test_diagnostic_on_legacy_line_is_ignored():
    repository_root = Path("/workspace")
    added_lines = {"backend-fastapi/app/service.py": {10}}
    diagnostic = {
        "filename": "/workspace/backend-fastapi/app/service.py",
        "location": {"row": 8, "column": 1},
        "end_location": {"row": 8, "column": 4},
    }

    assert not diagnostic_touches_added_line(
        diagnostic,
        added_lines,
        repository_root,
    )
