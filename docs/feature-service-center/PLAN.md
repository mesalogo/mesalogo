# Service Center (服务中心) — Phase 1–2 Plan

> Status: Phase 1 implemented on 2026-07-21; controlled lifecycle operations
> approved on 2026-07-22.
> Scope: read-only inventory, health, and dependency visibility in Phase 1;
> allowlisted Docker start, stop, and restart operations in Phase 2.

## 1. Problem

MesaLogo is moving toward containerized deployment, but runtime information is
currently split across General Settings, Graph Enhancement, MCP Servers, the
application market, and backend logs. Operators cannot answer three basic
questions from one place:

1. Which logical services are part of this installation?
2. Which services are enabled, running, and healthy?
3. Which user-facing capabilities depend on an unhealthy service?

The UI must model a **logical service (逻辑服务)**, not a raw Docker container.
For example, Milvus and OnlyOffice each contain several containers but should
appear as one service group with expandable components.

## 2. Product boundary

The System Settings navigation gains a **Services & Integrations
(服务与集成)** page at `/settings/services`.

Phase 1 provides:

- a declarative catalog of supported logical services;
- concurrent, bounded health probes;
- separate configured, runtime, and health state;
- dependency and component metadata;
- links to existing configuration pages;
- an administrator-only read API and UI.

Phase 1 does not provide:

- arbitrary Docker discovery, shell access, image pulls, or volume deletion;
- start, stop, restart, or recreate actions;
- Docker socket access from the primary API container;
- secret values in API responses;
- metrics history or alert delivery.

## 3. Service taxonomy

| Category | Logical services |
|---|---|
| Core | Backend API, Frontend UI |
| Infrastructure | Database, Redis |
| Data | Milvus |
| Knowledge | Graphiti, LightRAG |
| Capability | OnlyOffice, Galapagos, PaddleOCR-VL, Code Server |
| Integration | MCP servers (summary/link in Phase 1) |

An application-market entry is not automatically a service. Embedded apps such
as GIS remain in the market. Apps backed by a runtime service expose a
dependency link instead of duplicating service configuration.

## 4. State model

The API keeps these dimensions independent:

- `enabled`: desired/configured state (`true`, `false`, or `null` when unknown);
- `image_status`: expected local images (`available`, `partial`, `missing`, or
  `unknown` when Docker inspection is unavailable or not applicable);
- `runtime_status`: `running`, `stopped`, or `unknown`;
- `health_status`: `healthy`, `degraded`, `unhealthy`, `disabled`, or `unknown`.

`deployment` describes the resolved adapter (`embedded`, `native`,
`docker-compose`, or `external`), not merely the catalog default.

An enabled service is not necessarily running, and a running service is not
necessarily healthy. Aggregate summary counts use `health_status` only.

## 5. API contract

`GET /api/system/services`

- Authentication: `Depends(get_admin_user)`; frontend route protection is not
  a security boundary.
- Probes execute concurrently with per-probe timeouts.
- One failed probe never fails the complete inventory response.
- Endpoints are returned only when they contain no credentials.
- Internal probe targets are never serialized. A browser-facing display
  endpoint and a container-network probe target are separate values.

Response shape:

```json
{
  "success": true,
  "data": {
    "checked_at": "2026-07-21T00:00:00Z",
    "deployment_mode": "docker|native",
    "control_available": false,
    "control_status_detail": "disabled",
    "summary": {
      "total": 11,
      "healthy": 4,
      "degraded": 0,
      "unhealthy": 1,
      "disabled": 3,
      "unknown": 3
    },
    "services": [
      {
        "id": "redis",
        "category": "infrastructure",
        "deployment": "docker-compose",
        "required": false,
        "enabled": true,
        "installed": null,
        "image_status": "unknown",
        "images": [],
        "runtime_status": "running",
        "health_status": "healthy",
        "control_status_detail": null,
        "endpoint": "redis://abm-redis:6379/0",
        "latency_ms": 2.4,
        "status_detail": null,
        "dependencies": [],
        "components": ["abm-redis"],
        "config_route": "/settings/general",
        "capabilities": {
          "configure": true,
          "view_logs": false,
          "start": false,
          "stop": false,
          "restart": false
        },
        "checked_at": "2026-07-21T00:00:00Z"
      }
    ]
  }
}
```

`GET /api/health` remains the cheap liveness endpoint. Phase 1 additionally
introduces:

- `GET /api/health/live`: process liveness only;
- `GET /api/health/ready`: database-only required dependency readiness, with
  HTTP 503 when the database is unavailable; optional Redis/frontend/services
  do not make the backend unready;
- `GET /api/health/dependencies`: administrator-only detailed dependency view.

## 6. Probe design

- HTTP services use one shared `httpx.AsyncClient` with strict timeouts.
- HTTP probe targets come only from operator-controlled
  `SERVICE_CENTER_<ID>_PROBE_URL` environment variables or fixed,
  source-controlled Docker DNS targets for the catalog. A fixed Docker target
  is used only when the display configuration is local/default; an external
  configured endpoint requires an explicit operator probe target.
  Database-configured service URLs are sanitized display metadata and are
  never fetched directly by Service Center, preventing stored blind SSRF
  through product configuration APIs.
- Blocking database and Redis clients run through `asyncio.to_thread`.
- Database readiness is single-flight: if a caller times out, the underlying
  driver call remains tracked and later checks reuse it instead of accumulating
  unbounded worker threads.
- Database-backed catalog resolution is also bounded and single-flight, so a
  refresh returns stable unknown states instead of piling up resolver workers
  while the database pool is unavailable.
- Optional services without a trustworthy enabled/configured signal report
  `unknown`, not `unhealthy`. A seeded application-market `enabled` flag is a
  product feature flag, not proof that its Docker Compose profile is running.
- Probe failures cannot prove a process is stopped without runtime-manager
  access. Connection refusal, DNS failure, and timeout therefore produce
  `runtime_status: unknown`; only a positive response proves `running`. When a
  service is explicitly enabled, a failed probe is `unhealthy`; without a
  trustworthy enabled signal, its health remains `unknown`.
- Probe errors become stable `status_detail` codes. Logs contain the sanitized
  target plus an exception class/code, never a raw credential-bearing URL or
  exception string.
- HTTP probes accept only `http` and `https`, do not follow redirects, and use
  strict connect/read timeouts.
- The catalog is an allowlist in source control. It never enumerates unrelated
  host containers.

## 7. UI

The first screen contains summary cards, deployment mode, last-check time,
manual refresh, category filters, and a service table. Each row shows logical
service name, configured state, runtime state, health, endpoint, dependencies,
and a configuration deep link. Component names are available in an expandable
detail area.

The page uses the dedicated `serviceCenter` translation namespace in both
English and Chinese. No user-visible CJK is hard-coded in TSX.

## 8. Phase 2 controlled lifecycle operations

### 8.1 Deployment decision

The operator explicitly accepted a direct Docker Engine socket integration on
2026-07-22. The backend may receive `/var/run/docker.sock` through an explicit
Compose overlay; the default Compose definition does not mount it. Docker
documents that daemon access is effectively host-root access, so enabling the
overlay is a deployment trust decision, not an ordinary application setting.

The application therefore exposes a narrow adapter rather than a generic
Docker client:

- no arbitrary container discovery from the browser;
- no user-supplied container names or Docker API paths;
- no create, remove, pull, build, tag, exec, network, volume, or Compose
  operations; image access is read-only inspection of fixed references;
- exact logical-service and component allowlists in source control;
- Docker Compose project/service labels and exact container names are verified
  before a container is treated as managed;
- Docker errors are mapped to stable application error codes and raw daemon
  payloads are never returned to the browser.

### 8.2 Controllable services

The UI may operate these optional logical services:

| Logical service | Dependency-first component order |
|---|---|
| Milvus | `milvus-etcd`, `milvus-minio`, `milvus-standalone`, `milvus-attu` |
| Graphiti | `neo4j`, `graphiti` |
| LightRAG | `lightrag` |
| OnlyOffice | `onlyoffice-postgresql`, `onlyoffice-rabbitmq`, `onlyoffice-documentserver` |
| Galapagos | `galapagos` |
| PaddleOCR-VL | `paddle-ocr-vl` |
| Code Server | `code-server` |

Backend, frontend, the primary database, and Redis are deliberately immutable
from the application UI. Stopping those services could remove the control path
itself or corrupt in-flight work.

The adapter only controls containers that Compose has already created. A
missing or partially-created group reports `not_installed`; its first creation,
image pull, configuration, and upgrade remain explicit operator actions through
Docker Compose or the Makefile.

On the same inventory refresh, the adapter also inspects every expected image
reference declared by the allowlist. This includes the protected backend,
frontend, primary database, and Redis services even though those four services
never receive lifecycle capabilities in the UI. Image requests run concurrently
with container inspection. A logical service reports `available` when every
image exists locally, `partial` when only some exist, and `missing` when none
exist. Each expected reference and its boolean presence state are returned so
an operator can identify the exact missing image. This observation never
triggers an implicit pull, build, tag, prune, container creation, or lifecycle
action.

### 8.3 Runtime and action contract

When control is enabled, inventory refreshes inspect the allowlisted containers
and expected images through the Docker Engine Unix socket. A group is `running`
only when every component is running, `stopped` when every installed component
is stopped, and `unknown` when it is missing, foreign, mixed, or cannot be
inspected. Image state and container installation state remain independent.
Action capabilities are computed from runtime state and are never trusted from
the client.

`POST /api/system/services/{service_id}/actions/{action}` accepts only `start`,
`stop`, or `restart` and requires an authenticated administrator. Start runs in
dependency order; stop runs in reverse order; restart performs both phases.
Each logical service has an asynchronous operation lock. Start and stop are
semantically idempotent, duplicate UI submissions are disabled, and every
attempt emits a structured audit log containing the actor, logical service,
action, result, and request identifier without daemon payloads or secrets.

Stop and restart require a confirmation dialog. After a successful mutation,
the frontend refreshes inventory so the displayed runtime and health states are
observations rather than optimistic guesses.

Successful action response:

```json
{
  "success": true,
  "data": {
    "service_id": "milvus",
    "action": "restart",
    "changed": true,
    "installed": true,
    "runtime_status": "running",
    "checked_at": "2026-07-22T00:00:00Z"
  }
}
```

Stable failures expose an application `code` field (the main application's
HTTP exception handler flattens the route's structured detail): unknown service
(`404`), protected service (`403`), missing/external deployment (`409`),
unavailable controller (`503`), and Docker action failure or terminal-state
mismatch (`502`). Raw daemon error payloads are never part of the HTTP response.

## 9. Verification

- Unit tests cover catalog invariants, state aggregation, timeout/failure
  isolation, and endpoint sanitization.
- Docker-adapter tests use an in-memory async HTTP transport. They cover exact
  name/Compose-label validation, missing and partial groups, dependency order,
  allowlisted image-reference inspection and aggregation, idempotent start/stop,
  post-action state verification, unavailable-daemon behavior, and same-service
  serialization without touching a real daemon.
- API tests cover admin dependency enforcement and response shape.
- API mutation tests cover authentication-before-mutation, the closed action
  enum, sanitized request identifiers, typed success responses, and stable
  public error mapping.
- Frontend tests cover summary rendering, grouping/filtering, refresh, failure
  presentation, action capability gating, destructive-action confirmation,
  per-service loading, and post-action refresh.
- Compose validation proves that the base deployment has no Socket mount and
  that the explicit control overlay adds exactly the intended Unix Socket bind
  and environment settings. Verification must not start, stop, or recreate a
  real container.
- Changed backend files pass Ruff; frontend passes ESLint, i18n key/CJK gates,
  targeted tests, and production build.
