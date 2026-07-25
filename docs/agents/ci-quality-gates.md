# Quality gates (质量门) — run these locally

> Read this before changing `pytest.ini` or repository-wide lint commands.
>
> **2026-07-25**: GitHub Actions was removed from this repo (`.github/workflows/quality.yml`
> deleted). There is **no automated CI** anymore. Every gate below is now the
> responsibility of whoever makes the change, run **before** committing.
> Nothing will catch it for you afterwards.

## The contract

These are the same five gates the workflow used to enforce. They protect new
work without dragging a repository-wide cleanup into a feature change.

```bash
# 1. Backend tests, no external services required.
cd /path/to/abm-llm-v2
python -m pytest -m "not external and not e2e"

# 2. Ruff on the lines you added (not the whole repo — see below).
python tools/ci/ruff_changed_lines.py --base <base-sha> --head HEAD
#    <base-sha> is usually the commit you branched from, e.g. origin/public.

# 3. Frontend i18n. Both are blocking.
cd frontend
pnpm run i18n:check-keys
pnpm run i18n:check-cjk

# 4. Frontend ESLint must report zero errors.
#    Pre-existing warnings are tolerated; new errors are not.
pnpm exec eslint src

# 5. The production frontend build must succeed.
CI=false pnpm build
```

### Why Ruff is diff-scoped

The repository-wide Ruff backlog is large (hundreds of pre-existing findings)
and is tracked as separate, deliberate cleanup work. `ruff check .` on the whole
tree is therefore not a usable gate: it fails regardless of your change and
loses all signal. `tools/ci/ruff_changed_lines.py` reports only findings on lines
your diff actually added, which is the real contract for new code.

That script is still maintained and still covered by
`tests/unit/tools/test_ruff_changed_lines.py`. Removing the workflow did not
remove the gate; it moved the responsibility to you.

## Dependency rule

Importing a service package for HTTP-only behavior must not eagerly import
optional local-ML runtimes such as PyTorch or sentence-transformers. Optional
dependencies are loaded at the point where the local provider is selected.
This keeps API startup and test collection deterministic.

## If automated CI comes back

Should this repo re-adopt a hosted runner, re-add the five gates above in the
same order and keep the diff-scoped Ruff behavior. Do not replace gate 2 with a
whole-tree `ruff check .` — that was considered and rejected for the reason in
"Why Ruff is diff-scoped".

The next gates worth adding are real integration scenarios for database/Redis
lifecycle and mocked-LLM end-to-end user journeys. Do not label placeholder
tests as integration or E2E merely to increase counts.
