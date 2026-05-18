# 2026-05-18 — Action task mainline broken in two places

> Summary in one line: **two separate bugs** silently coexisted on the
> `POST /api/action-tasks` + `DELETE /api/action-tasks/{id}` path.
> One was visible (500 on create), the other only triggered when
> `cascade` was not explicitly set to `true`.

## Symptoms

1. **Create**: `POST /api/action-tasks` returned 500 with
   `AttributeError: 'Depends' object has no attribute 'is_admin'`, but the
   task row had already been committed → **orphan task in DB**.
2. **Delete** (this is the latent one): `DELETE /api/action-tasks/{id}`
   without `?cascade=true` returned 500 with
   `pymysql.err.IntegrityError (1048) Column 'action_task_id' cannot be null`,
   and the task stayed in the DB.
   The frontend masks this because it defaults `cascade=true` in
   `frontend/src/services/api/actionTask.ts`, but any direct API caller hits it.

## Root causes

### Bug 1 — `Depends` leaked into a normal function call

`app/api/routes/action_tasks.py:create_action_task` builds the response by
*directly calling* the sibling route function:

```python
task_detail = get_action_task(new_task.id)   # ← bug
```

But `get_action_task`'s signature is

```python
def get_action_task(task_id, current_user=Depends(get_current_user)): ...
```

`Depends(...)` only resolves inside FastAPI's DI machinery. A plain Python
call leaves `current_user` as a literal `fastapi.params.Depends` instance,
so `current_user.is_admin` blows up in `can_access_task`.

**Fix:** pass `current_user` explicitly:

```python
task_detail = get_action_task(new_task.id, current_user=current_user)
```

**General lesson:** never call FastAPI route handlers as ordinary
functions. If you need shared response shaping, extract a plain helper
(no `Depends` in its signature) into `app/services/`.

### Bug 2 — Delete-without-cascade is a SQLAlchemy / schema mismatch

- `Conversation.action_task_id`: `nullable=False` at both ORM and MariaDB
  level (`app/models.py:726`).
- `ActionTask.conversations`: `relationship("Conversation",
  back_populates="action_task")` — **no `cascade=` declaration**.

When `cascade=false` we went straight to `db.session.delete(task)`.
SQLAlchemy's default behaviour for a parent with child rows and no
cascade rule is to **null out the child FK** before deleting the parent,
which immediately hits MariaDB error 1048.

**Minimum-blast-radius fix (current):**

1. Default `cascade=true` in the query string, matching the frontend's
   already-default behaviour.
2. If a caller explicitly says `cascade=false` and child conversations
   exist, return **409** with an explanation instead of letting ORM
   nullify into a 500.

**Proper fix (deferred — schema change, requires Alembic):** declare

```python
conversations = relationship(
    "Conversation",
    back_populates="action_task",
    cascade="all, delete-orphan",
    passive_deletes=True,
)
```

…and change `Conversation.action_task_id`'s FK to
`ondelete='CASCADE'`. This is a `models.py` field change, so it must go
through an Alembic migration (see backend `AGENTS.md §3.3`).

## Detection

The mainline e2e (curl-only) script lives at `/tmp/abm_mainline_test.sh`
for ad-hoc reuse. It covers login → list → create → get → list →
delete (cascade=true) → 404 → list. After this fix, an additional check
was added by hand:

- delete without cascade on a task that has the auto-created default
  conversation → expect **409**, never **500**.

The first run also surfaced a pre-existing orphan task created during
the original Bug-1 reproduction (`2e05c5cc-...`). It is still in the
DB and should be cleaned up manually if it bothers anyone.

## What goes back into AGENTS.md

A one-liner under `§5 Known failure modes` is enough:

> Bug pattern: directly calling a sibling FastAPI route function leaves
> its `Depends(...)` defaults unresolved. Always extract shared logic to
> a plain helper, or pass the dependency explicitly.

## Resolution (2026-05-18, later that day)

Followed up with the "real" schema-level fix instead of leaving the
409 short-circuit in place:

1. **Alembic was installed and wired up** (it was listed in
   `requirements.txt` and `AGENTS.md`, but never initialised in the
   repo). `alembic init alembic`, `env.py` rewritten to read
   `core.config.settings.DATABASE_URI` and target
   `app.extensions.db.Model.metadata`. See `backend-fastapi/alembic/README.md`.
2. **Baseline revision `fedea876a659`** captured the existing
   `create_all()`-generated schema. autogenerate produced an empty diff,
   confirming the baseline matches `models.py` byte-for-byte. The
   running DB was `alembic stamp head`'d.
3. **`app/models.py` edits** (in the same spirit as the original
   AGENTS.md red-line note — go through Alembic, not direct field edits):
   - `Conversation.action_task_id`: FK now `ondelete='CASCADE'`.
   - `ActionTask.conversations`: relationship now declares
     `cascade="all, delete-orphan", passive_deletes=True`.
4. **Revision `a51a7c66578c`** (`cascade delete action_task to
   conversations`) drops the old anonymous FK and recreates it as
   `conversations_action_task_id_fkey` with `ON DELETE CASCADE`.
   Verified via `information_schema.REFERENTIAL_CONSTRAINTS.DELETE_RULE = 'CASCADE'`.
5. **`app/api/routes/action_tasks.py`**: removed the 409 short-circuit
   (now redundant — the FK guarantees integrity at the DB level). Kept
   the `cascade=true` default for the query param because it matches
   the frontend's default and keeps the application-level cleanup of
   workspace files / autonomous tasks explicit. Original Bug 1 fix
   (pass `current_user=current_user`) remains.
6. **E2E green**: `/tmp/abm_mainline_test.sh` (8 steps) plus an extra
   step "DELETE with `cascade=false` on a task that has the
   auto-created default conversation" → HTTP 200.

