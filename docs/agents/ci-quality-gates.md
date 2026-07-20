# CI quality gates (CI 质量门)

> Read this before changing `.github/workflows/`, `pytest.ini`, or repository-wide
> lint commands.

## Current contract

CI protects new work without mixing a repository-wide cleanup into feature
changes:

1. Backend tests must collect and pass without external services:
   `pytest -m "not external and not e2e"`.
2. Python lines added by a pull request must pass Ruff. The existing
   repository-wide Ruff backlog is tracked separately and is not auto-fixed in
   unrelated changes. The diff-aware gate lives in
   `tools/ci/ruff_changed_lines.py`.
3. Frontend i18n key consistency and hard-coded CJK checks are blocking.
4. Frontend ESLint must have zero errors. Existing warnings are visible in CI
   but are not yet blocking.
5. The production frontend build must succeed.

The executable workflow is `.github/workflows/quality.yml`.

## Dependency rule

Importing a service package for HTTP-only behavior must not eagerly import
optional local-ML runtimes such as PyTorch or sentence-transformers. Optional
dependencies are loaded at the point where the local provider is selected.
This keeps API startup and test collection deterministic.

## Expansion path

The next gates to add are real integration scenarios for database/Redis
lifecycle and mocked-LLM end-to-end user journeys. Do not label placeholder
tests as integration or E2E merely to increase counts.
