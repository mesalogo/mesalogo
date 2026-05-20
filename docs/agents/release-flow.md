# Release flow — publishing to GitHub `mesalogo/mesalogo`

> Required reading whenever you push to `github/main` or `origin/public`.
> Companion to `AGENTS.md` §3.1 (secret-scan) and §5 (known failures).

---

## TL;DR — the contract

| Ref | Role |
|---|---|
| `github mesalogo/mesalogo` `main` | **Source of truth for the public release.** This is what users see. |
| `origin digiman/abm-llm-v2` `public` | **Internal staging mirror** of `github/main`. Must stay byte-identical to it. |
| Other internal branches (`250504-agentcolor`, etc.) | Day-to-day development. **Never push these directly to GitHub.** |

**Rule:** local `public` is a *publication staging area*, not a long-lived development branch. It exists only to be aligned with `github/main`, have release content layered on top, and then pushed to both remotes.

---

## Why this matters — the 2026-05-20 incident

For a long stretch, local `public` and `github/main` accumulated **completely disjoint histories** (`git merge-base` returned empty). Symptoms:

- Local `public` had only 3 commits including a brand-new README rewrite.
- `github/main` had 29 commits ahead of local `public` — internal contributors had been mirroring a different internal branch to GitHub, bypassing `public` entirely.
- A naive `git push github public:main` would have either failed (non-fast-forward) or, with `--force`, **wiped out 29 legitimate commits** (i18n work, vector-db fix, model-client refactor, …).

Root cause: nobody had written down which ref is the source of truth. We are writing it down now.

---

## The standard release flow

### Pre-flight (every time, no exceptions)

1. **`git fetch --all`** — get the latest state of every remote.
2. **Identify the diff direction:**
   ```bash
   git rev-list --left-right --count github/main...origin/public
   git merge-base github/main origin/public   # MUST NOT be empty
   ```
   If `merge-base` is empty → **stop**. The two refs are unrelated. Resolve before doing anything else (see "Repairing disjoint history" below).
3. **Secret-scan the diff** (AGENTS.md §3.1):
   ```bash
   git diff origin/public...HEAD | grep -iE "(api[_-]?key|secret|token|password|client_secret|sk-[a-z0-9])"
   ```
   Better yet: install `gitleaks` as a pre-push hook.

### Happy path — adding a commit to the release

```bash
# 1. Align local public to github/main as the working base.
git fetch github main
git checkout public
git reset --hard github/main           # discards local public divergence on purpose

# 2. Layer release content on top.
#    Either cherry-pick from a feature branch, or commit fresh.
git cherry-pick <sha>                  # or: edit + commit

# 3. Verify it is a fast-forward of github/main and only touches expected files.
git rev-list --left-right --count github/main...HEAD   # expect "0\tN"
git merge-base github/main HEAD                        # expect github/main HEAD's sha
git diff --stat github/main..HEAD                      # sanity-check scope

# 4. Push GitHub first (fast-forward, no --force needed).
git push github HEAD:main

# 5. Mirror to internal GitLab. force-with-lease, never plain --force.
git push --force-with-lease origin public
```

### Verifying alignment after push

```bash
echo "local public  : $(git rev-parse public)"
echo "origin/public : $(git rev-parse origin/public)"
echo "github/main   : $(git rev-parse github/main)"
# All three SHAs MUST match.
```

---

## Authentication notes

- **GitHub remote uses SSH, not HTTPS.** HTTPS prompts for username/PAT and Droid's non-interactive shell cannot answer. Configure once:
  ```bash
  git remote set-url github git@github.com:mesalogo/mesalogo.git
  ssh -T git@github.com   # expect: "Hi <user>! You've successfully authenticated..."
  ```
- Internal GitLab uses SSH on a non-standard port (`ssh://git@10.7.0.22:7022/digiman/abm-llm-v2`). Already configured; do not change.

---

## Force-push policy

- **Never `git push --force`.** Always `--force-with-lease`. The lease checks the remote is still at the sha you last fetched, refusing to overwrite a commit pushed by someone else in the meantime.
- Force-with-lease is acceptable on `origin/public` (it is by definition a mirror).
- Force-with-lease is **never** acceptable on `github/main`. If GitHub `main` needs to lose commits, write up a post-mortem first and get explicit user approval.

---

## Repairing disjoint history (the 2026-05-20 fix, for the record)

If you discover `git merge-base github/main public` is empty:

1. **Backup the local divergent work** as a patch:
   ```bash
   git format-patch <merge-base-or-root>..public -o /tmp/release-backup/
   ```
2. **Reset local `public` onto `github/main`:**
   ```bash
   git reset --hard github/main
   ```
3. **Re-apply your intended release content.** `git am` may fail if the base files differ; in that case, just `git checkout <old-ref> -- <files>` the relevant files and re-commit them on top of `github/main`.
4. **Push GitHub first, then mirror internal GitLab** as in the standard flow.
5. **Reflog keeps the old `public` for ~30–90 days** if you need to dig it back up: `git reflog show public`.

---

## What this flow does *not* cover

- Tag / release publication (e.g. `v0.51.x`). Tag policy lives elsewhere — for now, tag on `github/main` only, after a release push.
- Internal day-to-day dev branches. They do not interact with this flow directly; they feed into `public` via cherry-pick or merge, but only once the release content is finalized.
- Translation / website / desktop-app release. Out of scope here.

---

_first written: 2026-05-20 — after the disjoint-history near-miss_
_owner: whoever is doing the next release; please keep this file current_
