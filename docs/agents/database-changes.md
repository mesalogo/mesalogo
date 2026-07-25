# Database changes guide (数据库变更手册)

> Read this before changing a SQLAlchemy model, table, column, index, constraint,
> cascade, retention rule, JSON storage shape, or Alembic revision.

## 1. Canonical migration system

The active migration environment is:

```text
backend-fastapi/alembic/
├── env.py
├── script.py.mako
└── versions/
```

Read [backend-fastapi/alembic/README.md](../../backend-fastapi/alembic/README.md)
and [backend-fastapi/migration-progress.md](../../backend-fastapi/migration-progress.md)
before creating a revision. Do not create a parallel migration history under a
legacy `backend-fastapi/migrations/` directory.

Changing a field in `app/models.py` is not a schema migration. The model change,
Alembic revision, data transition, and verification belong to one reviewed
change.

## 2. Required invariants

- The database schema and SQLAlchemy metadata agree after `upgrade head`.
- There is one intended Alembic head unless a reviewed merge revision exists.
- Every persistent invariant is enforced at the narrowest practical layer:
  database constraint first, then application validation for useful errors.
- Upgrade and downgrade behavior is explicit and tested on a disposable database.
- Destructive or irreversible transformations name their backup/export and
  rollback strategy.
- Foreign-key deletion behavior is intentional at both database and ORM layers.
- Migration code contains no credentials, environment snapshots, or customer data.
- Migration logs use `logger`; do not add `print()`.

## 3. Before editing

### 3.1 Define the data contract

Write down:

- the entity and invariant being added or changed;
- ownership and tenant boundary;
- nullability and default semantics;
- uniqueness scope;
- units, timezone, and precision;
- retention and deletion behavior;
- expected row count and access/query paths;
- how existing rows become valid;
- whether old application binaries must coexist during deployment.

Do not use a JSON field as an undefined “future flexibility” bag. If a field is
filtered, joined, constrained, independently retained, or updated frequently, it
usually deserves a normalized column or table.

### 3.2 Inspect the real history

From `backend-fastapi/`, inspect at least:

```bash
alembic current
alembic heads
alembic history --verbose
```

Also inspect:

- the model and every in-repository reader/writer with `rg`;
- existing constraints and indexes in nearby revisions;
- representative existing data, including nulls and malformed legacy values;
- current branch and dirty worktree before generating files.

Never assume that a model declaration proves the production table shape.

## 4. Migration workflow

### Step 1 — Add a failing verification

For a bug fix, first add a test that demonstrates the old schema or data
behavior is wrong and observe it fail. Read [tests/AGENTS.md](../../tests/AGENTS.md)
before changing any test.

For a new schema, define upgrade/downgrade assertions and the application query
that requires the change.

### Step 2 — Change metadata and generate a revision

Make the smallest model change, then create a revision from
`backend-fastapi/`:

```bash
alembic revision --autogenerate -m "add experiment run records"
```

Autogenerate is a draft generator, not a review. Inspect every operation. It may:

- miss data migrations;
- infer an unsafe type or nullability change;
- propose deletion of an object outside the feature scope;
- omit a required index or constraint name;
- render a server default that differs across databases.

Delete unrelated generated operations rather than bundling cleanup into the
feature migration.

### Step 3 — Write the data transition

Use explicit SQLAlchemy/Alembic operations. For large existing tables, prefer an
expand/backfill/contract sequence:

1. add a nullable column or new table and supporting indexes;
2. deploy/backfill in bounded batches with observable progress;
3. migrate every in-repository reader and writer;
4. validate completeness and constraints;
5. enforce `NOT NULL`, uniqueness, or foreign keys;
6. remove obsolete storage in a later reviewed cleanup revision.

This sequence is a data-deployment technique, not permission to leave indefinite
runtime compatibility aliases or dual code paths. Internal callers must converge
on the new model deliberately.

Avoid one enormous transaction for a high-volume backfill. State whether the
migration is safe to retry and how partial progress is detected.

### Step 4 — Review constraints and indexes

- Name foreign keys, unique constraints, and indexes explicitly.
- Match composite index order to real query predicates and sort order.
- Avoid redundant indexes already covered by a unique or composite index.
- Verify string length, decimal precision, timestamp timezone semantics, and
  JSON support against the deployed database.
- Do not use an application default as a substitute for a backfill or database
  default when existing rows require a value.

### Step 5 — Test both directions

On a disposable representative database:

```bash
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

Verify schema and data after each step. A command exiting zero is not sufficient;
query the new records, constraints, and representative application route.

If downgrade would discard user data, do not pretend it is harmless. Document
the loss, require an export/backup, and make the revision fail safely when a
blind downgrade would be misleading.

### Step 6 — Verify application behavior

Minimum verification after schema work:

- `python3 -c "import main"` from `backend-fastapi/`;
- targeted unit and integration tests;
- the affected API returns expected populated JSON;
- the relevant frontend flow reads/writes the new data when applicable;
- changed backend files pass Ruff on the changed scope;
- `alembic current` reports the expected head.

## 5. Foreign keys, cascades, and deletion

Deletion is a product decision. Before adding `CASCADE`, `SET NULL`, or ORM
delete-orphan behavior, answer:

- Who owns the child record?
- Can the child be shared by another experiment, user, or tenant?
- Must evidence survive deletion of the editable parent?
- Is the relationship optional after parent deletion?
- Does ORM behavior match the database constraint?
- What does API deletion promise the user?

The [ActionTask delete cascade incident](./failures/2026-05-18-action-task-delete-cascade-default.md)
shows why an implicit database default is unsafe. Tests must exercise parent
deletion with no children, one child, shared/reference data, and retained audit
or evidence records.

For ParallelLab v2, deleting an editable experiment must not silently remove a
shared Action Space, engine model artifact, or externally retained evidence
bundle. Retention and tombstone behavior need an explicit design decision.

## 6. Status, enums, and lifecycle data

- Prefer a documented state machine over free-form status strings.
- Database enum changes can be operationally difficult; review deployed database
  behavior before selecting a native enum.
- A cached counter such as `completed_runs` is not the sole source of truth;
  reconcile it against run records.
- Store structured terminal type separately from a human-readable error summary.
- Retrying creates a new attempt record rather than overwriting terminal history.
- Use compare-and-set or a constraint to prevent two workers from finalizing the
  same attempt independently.

## 7. JSON-to-normalized migration pattern for ParallelLab v2

The proposed design introduces immutable revisions, runs, attempts, scalar
metrics, and artifact indexes while the current `ParallelExperiment` stores
cloned task IDs, pending combinations, and summaries in JSON.

Recommended sequence:

1. add new tables and constraints without deleting legacy fields;
2. build an idempotent importer for historical experiment iterations;
3. mark imported provenance as `legacy` when seeds, units, evaluator identity, or
   exact run status cannot be reconstructed;
4. migrate all v2 execution and analysis call sites to normalized records;
5. compare legacy summaries with reconstructed results on fixtures;
6. stop writing legacy JSON after all in-repository callers move;
7. retain or remove old columns only after a separate retention review and
   verified backup.

Do not fabricate missing provenance during import. “Unknown” is more scientifically
valid than an invented seed, unit, or model version.

High-volume event logs and time series should be immutable compressed artifacts
with relational indexes and checksums. Keep scalar metrics relational when they
must support filtering, aggregation, and comparison.

## 8. Online-deployment considerations

When old and new application processes may overlap:

- favor additive schema changes first;
- avoid long table locks and measure index-build behavior;
- decide whether a server default causes table rewrite on the deployed database;
- keep migration transactions bounded;
- make background backfills resumable and observable;
- deploy application readers only after the required schema exists;
- remove obsolete columns only after old processes can no longer write them.

If a safe staged deployment would require a temporary runtime data bridge,
document its exact removal milestone. Do not turn it into an open-ended internal
compatibility shim.

## 9. Security and public-branch checks

- Never put connection strings or credentials in a revision or `alembic.ini`.
- Never embed production/customer rows as fixtures.
- Redact sampled data used to validate a migration.
- Do not run a migration against a production or shared database without the
  user's explicit operational authorization.
- Before any public-branch publication, follow
  [release-flow.md](./release-flow.md) and run the required secret scan.

## 10. Review checklist

Before handoff, answer all applicable items:

- [ ] Is the migration in `backend-fastapi/alembic/versions/`?
- [ ] Did I inspect current head(s) and nearby revisions?
- [ ] Does the model change have a matching revision?
- [ ] Did I remove unrelated autogenerate operations?
- [ ] Are defaults, nullability, units, timezones, and precision intentional?
- [ ] Are constraint and index names explicit?
- [ ] Is existing data backfilled or honestly marked unknown?
- [ ] Are upgrade, downgrade, partial failure, and retry behavior documented?
- [ ] Did I test upgrade → downgrade → upgrade on a disposable database?
- [ ] Do ORM and database cascade behavior agree?
- [ ] Did I update every in-repository reader and writer without leaving a legacy
      import shim?
- [ ] Do targeted application and API tests prove populated behavior?
- [ ] Did I preserve unrelated dirty-worktree changes?
- [ ] Is `git diff` free of secrets, generated junk, and customer data?
