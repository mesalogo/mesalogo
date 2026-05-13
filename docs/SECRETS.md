# Secrets & Configuration Guide

> **Audience:** developers and operators setting up MesaLogo locally or in production.
>
> **Goal:** explain exactly which files hold sensitive values, how to create them from
> the `.example` templates, and the rules for not leaking them.

---

## 0. The golden rule

**Never commit a real secret.**

The repo is structured so that every file containing API keys, passwords, tokens, or
internal hostnames exists in two forms:

- `something.example` — the template, **tracked** by git, contains placeholders only
- `something` — your real values, **git-ignored**, never committed

If you find yourself about to `git add` a file that has a real `sk-...` key in it,
stop. Read this document first.

---

## 1. Where the secrets live

| Real file (git-ignored) | Template (tracked) | What it holds |
|---|---|---|
| `abm-docker/.env` | `abm-docker/.env.example` | Docker compose service profile, MariaDB password, optional `OPENAI_API_KEY` for the legacy Graphiti memory |
| `abm-docker/lightrag.env` | `abm-docker/lightrag.env.example` | LightRAG LLM/embedding API keys, vector DB connection |
| `abm-docker/config.conf` | `abm-docker/config.conf.example` | Docker-deployed backend's database URI |
| `abm-docker/mcp_config.json` | `abm-docker/mcp_config.json.example` | MCP server registry inside Docker |
| `backend-fastapi/config.conf` | `backend-fastapi/config.conf.example` | App `SECRET_KEY`, OAuth client IDs/secrets, DB URI |
| `backend-fastapi/mcp_config.json` | `backend-fastapi/mcp_config.json.example` | MCP server registry |
| `backend-fastapi/app/seed_data/seed_data_models.json` | `backend-fastapi/app/seed_data/seed_data_models.json.example` | LLM model API keys seeded on first boot |
| `frontend/.env` | `frontend/.env.example` | Frontend dev server settings |
| `desktop-app/config.json` | `desktop-app/config.json.example` | Desktop app backend URL + update server |
| `desktop-app/build-mac.sh` | `desktop-app/build-mac.sh.example` | Apple ID, App-Specific Password, Team ID |
| `tools/license.json` | `tools/license.json.example` | License key (only relevant if you use the licensing module) |

---

## 2. First-time setup

Run this from the repo root to bootstrap all real config files from templates.

### macOS / Linux

```bash
# Backend
cp backend-fastapi/config.conf.example                       backend-fastapi/config.conf
cp backend-fastapi/mcp_config.json.example                   backend-fastapi/mcp_config.json
cp backend-fastapi/app/seed_data/seed_data_models.json.example \
   backend-fastapi/app/seed_data/seed_data_models.json

# Docker stack
cp abm-docker/.env.example          abm-docker/.env
cp abm-docker/lightrag.env.example  abm-docker/lightrag.env
cp abm-docker/config.conf.example   abm-docker/config.conf
cp abm-docker/mcp_config.json.example abm-docker/mcp_config.json

# Frontend
cp frontend/.env.example  frontend/.env

# Desktop app (macOS only)
cp desktop-app/config.json.example  desktop-app/config.json
cp desktop-app/build-mac.sh.example desktop-app/build-mac.sh
chmod +x desktop-app/build-mac.sh
```

Then **edit each file** and replace `YOUR_*_HERE` / `CHANGE_ME_TO_*` placeholders with
your real values.

### What you actually need to fill in (minimum)

To boot a working dev environment you need at least:

1. **One LLM API key** — put it in
   `backend-fastapi/app/seed_data/seed_data_models.json`
   (multiple model entries can share the same key).
2. **A strong `SECRET_KEY`** in `backend-fastapi/config.conf`
   (`openssl rand -hex 32` to generate one).
3. **`MARIADB_ROOT_PASSWORD`** in `abm-docker/.env`
   if you use the Docker MariaDB profile.

Everything else is optional and only needed for specific features
(OAuth login, Apple notarization, LightRAG knowledge bases, etc.).

---

## 3. Generating strong values

```bash
# Strong random secret (for SECRET_KEY, LICENSE_SECRET_KEY)
openssl rand -hex 32

# Strong DB password
openssl rand -base64 24 | tr -d '/+='

# UUID (for various identifiers)
python3 -c "import uuid; print(uuid.uuid4())"
```

---

## 4. OAuth setup (optional)

OAuth is **off by default**. Only fill these in if you want users to log in via
Google / Microsoft / etc.

- **Google**: <https://console.cloud.google.com/apis/credentials> → "Create OAuth client ID"
  → Web application → set redirect URI to `http://localhost:3000/oauth/callback`.
  Put the resulting Client ID + Client Secret into `backend-fastapi/config.conf`.
- **Microsoft**: <https://entra.microsoft.com> → App registrations → New registration →
  same redirect URI. Same fields in `config.conf`.
- **Generic OIDC / OAuth2**: see the corresponding sections in `config.conf.example`.

---

## 5. Apple notarization (only for shipping macOS desktop app)

In `desktop-app/build-mac.sh`:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

- **App-Specific Password**: <https://appleid.apple.com> → Sign-In and Security → App-Specific Passwords.
- **Team ID**: <https://developer.apple.com/account> → Membership Details.

Also update `desktop-app/package.json`'s `notarize.teamId` to match.

---

## 6. CI/CD secrets (production)

For production deployments, do **not** commit `config.conf` even to a private repo.
Use one of:

- **Docker secrets** (`docker secret create`)
- **Kubernetes secrets** (`kubectl create secret`)
- **AWS Parameter Store** / **Vault** / **GCP Secret Manager**
- **Environment variables** injected at startup (recommended for simple deployments)

The backend reads `config.conf` first, then overrides individual keys from
environment variables, so injecting `SECRET_KEY=...` via env in production is
sufficient.

---

## 7. If you accidentally commit a secret

**Don't push.** Run:

```bash
git reset HEAD~1   # if it's the latest commit and not yet pushed
```

If you've already pushed:

1. **Rotate the leaked secret immediately** at the provider's console.
   Assume any pushed secret is compromised, even briefly.
2. Remove it from history with [`git filter-repo`](https://github.com/newren/git-filter-repo):
   ```bash
   git filter-repo --replace-text <(echo 'sk-LEAKED_KEY==>REDACTED_KEY')
   git push --force-with-lease
   ```
3. Notify any collaborators that history was rewritten.

---

## 8. Pre-commit safety check

A simple guard you can run before `git commit`:

```bash
# Refuse to commit if real keys leak through
git diff --cached | rg -i 'sk-[A-Za-z0-9]{32,}|GOCSPX-|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}' \
  && { echo "❌ Possible secret detected — aborting"; exit 1; } || echo "✅ No obvious secret in staged diff"
```

You can wire this into a `.git/hooks/pre-commit` if you want it automatic.

---

## 9. Reporting a security issue

If you find a real secret committed somewhere in this repo (or its history), please
**open a private security advisory** rather than a public issue.

See the project's `SECURITY.md` (if present) or contact the maintainer directly.
