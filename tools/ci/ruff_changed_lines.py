#!/usr/bin/env python3
"""Fail when Ruff reports a violation on a line added by a Git diff."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

HUNK_RE = re.compile(
    r"^@@ -\d+(?:,\d+)? \+(?P<start>\d+)(?:,(?P<count>\d+))? @@"
)


def parse_added_lines(diff_text: str) -> dict[str, set[int]]:
    """Map each changed Python path to its newly added line numbers."""
    added_lines: defaultdict[str, set[int]] = defaultdict(set)
    current_file: str | None = None
    new_line: int | None = None

    for line in diff_text.splitlines():
        if line.startswith("+++ "):
            path = line[4:]
            current_file = None if path == "/dev/null" else path.removeprefix("b/")
            new_line = None
            continue

        hunk = HUNK_RE.match(line)
        if hunk:
            new_line = int(hunk.group("start"))
            continue

        if current_file is None or new_line is None or line.startswith("\\"):
            continue
        if line.startswith("+"):
            added_lines[current_file].add(new_line)
            new_line += 1
        elif line.startswith("-"):
            continue
        else:
            new_line += 1

    return dict(added_lines)


def diagnostic_touches_added_line(
    diagnostic: dict[str, Any],
    added_lines: dict[str, set[int]],
    repository_root: Path,
) -> bool:
    """Return whether a Ruff diagnostic overlaps an added line."""
    filename = Path(diagnostic["filename"])
    if filename.is_absolute():
        try:
            filename = filename.relative_to(repository_root)
        except ValueError:
            return False
    path = filename.as_posix()
    changed = added_lines.get(path, set())
    start = diagnostic["location"]["row"]
    end = diagnostic.get("end_location", diagnostic["location"])["row"]
    return any(row in changed for row in range(start, end + 1))


def _run(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=False,
        capture_output=True,
        text=True,
    )


def _write_diagnostic(diagnostic: dict[str, Any]) -> None:
    filename = diagnostic["filename"]
    row = diagnostic["location"]["row"]
    column = diagnostic["location"]["column"]
    code = diagnostic["code"]
    message = diagnostic["message"]
    if "GITHUB_ACTIONS" in __import__("os").environ:
        sys.stdout.write(
            f"::error file={filename},line={row},col={column},title=Ruff {code}::{message}\n"
        )
    else:
        sys.stdout.write(f"{filename}:{row}:{column}: {code} {message}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Base Git revision")
    parser.add_argument(
        "--head",
        help="Head Git revision; omit to include working-tree changes",
    )
    parser.add_argument(
        "--config",
        default="backend-fastapi/pyproject.toml",
        help="Ruff configuration path",
    )
    args = parser.parse_args()

    repository_root = Path(__file__).resolve().parents[2]
    revision_args = [args.base]
    if args.head:
        revision_args.append(args.head)
    diff = _run(
        [
            "git",
            "diff",
            "--unified=0",
            "--no-color",
            "--no-ext-diff",
            *revision_args,
            "--",
            "*.py",
        ],
        repository_root,
    )
    if diff.returncode != 0:
        sys.stderr.write(diff.stderr)
        return diff.returncode

    added_lines = parse_added_lines(diff.stdout)
    files = sorted(added_lines)
    if not files:
        sys.stdout.write("No added Python lines to lint.\n")
        return 0

    lint = _run(
        [
            sys.executable,
            "-m",
            "ruff",
            "check",
            "--config",
            args.config,
            "--output-format=json",
            *files,
        ],
        repository_root,
    )
    if lint.returncode not in {0, 1}:
        sys.stderr.write(lint.stderr or lint.stdout)
        return lint.returncode

    try:
        diagnostics = json.loads(lint.stdout or "[]")
    except json.JSONDecodeError:
        sys.stderr.write(lint.stderr or lint.stdout)
        return 2

    new_diagnostics = [
        diagnostic
        for diagnostic in diagnostics
        if diagnostic_touches_added_line(diagnostic, added_lines, repository_root)
    ]
    for diagnostic in new_diagnostics:
        _write_diagnostic(diagnostic)

    if new_diagnostics:
        sys.stderr.write(
            f"Ruff found {len(new_diagnostics)} violation(s) on added lines.\n"
        )
        return 1

    sys.stdout.write("Ruff found no violations on added Python lines.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
