# ParallelLab v2 User Stories

> **Status:** Draft product backlog; acceptance criteria describe target behavior
> **Date:** 2026-07-23
> **Design:** [PLAN-cognitive-simulation-v2.md](./PLAN-cognitive-simulation-v2.md)
> **Priorities:** Must = release gate, Should = high-value follow-up, Could = optional after evidence

## 1. How to use this backlog

These stories define the first research-grade evolution of ParallelLab. They are
written to support product review, technical planning, test design, and future
release slicing. They do not imply that the behavior already exists.

Each implementation issue should reference one story ID and narrow its
acceptance criteria to a testable vertical slice. A story is not complete when
only an API or only a page exists; the relevant persistence, lifecycle,
authorization, evidence, and user-visible behavior must agree.

## 2. Personas

| Persona | Goal |
|---|---|
| Research Lead (研究负责人) | State a defensible question and understand what the experiment can claim |
| Scenario Modeler (场景建模者) | Connect a model and define truth-state, actions, observations, and reporters |
| Experiment Designer (实验设计者) | Define factors, replications, baselines, metrics, seeds, and budgets |
| Experiment Operator (实验操作员) | Run, monitor, pause, stop, and recover experiments safely |
| Analyst (分析员) | Compare distributions, uncertainty, effect sizes, and sensitivity |
| Reviewer/Auditor (评审/审计者) | Trace conclusions to immutable configuration and run evidence |
| White-Cell Controller (白方控制员) | Intervene in an exercise without hiding the intervention |
| Integration Engineer (集成工程师) | Add an engine through a stable, testable adapter contract |
| Platform Administrator (平台管理员) | Enforce access, retention, provider limits, and cost quotas |

## 3. Epic A — Research contract and experiment definition

### PL2-001 — State the research purpose and claim boundary

**Priority:** Must · **Persona:** Research Lead · **Milestone:** M0

As a research lead, I want every experiment to state its research question,
intended use, and claim boundary so that users do not mistake a model-conditional
result for a real-world prediction.

Acceptance criteria:

- A draft cannot be frozen without a non-empty research question, intended use,
  and limitations statement.
- Preflight warns when user text claims accreditation, real-world probability,
  or physical truth without corresponding validation evidence.
- The purpose and claim boundary appear on the design summary, analysis page,
  report, and exported evidence bundle.
- Editing the purpose after a revision is frozen creates a new revision.

### PL2-002 — Freeze an immutable experiment revision

**Priority:** Must · **Persona:** Experiment Designer · **Milestone:** M0

As an experiment designer, I want to freeze a validated definition into an
immutable revision so that every run has one unambiguous configuration.

Acceptance criteria:

- Freezing compiles the definition into a versioned manifest and calculates a
  SHA-256 digest.
- The manifest includes scenario, engine, factors, replications, actor policies,
  observation policies, metrics, baselines, analysis rules, and budgets.
- A run references exactly one frozen revision and cannot use mutable draft
  values.
- Any semantic edit creates a new revision; an existing manifest is never
  overwritten.
- The UI shows revision number, digest, creator, and freeze time.

### PL2-003 — Run preflight validation

**Priority:** Must · **Persona:** Experiment Designer · **Milestone:** M0

As an experiment designer, I want preflight validation before queueing runs so
that unsupported or internally inconsistent experiments fail early.

Acceptance criteria:

- Validation checks adapter capabilities, parameter names and types, reporter
  schemas, units, action schemas, stop conditions, budgets, and seed support.
- Errors identify a field and a corrective action; warnings require explicit
  acknowledgement before freezing.
- Unsupported snapshot, replay, or deterministic-seed requirements are errors,
  not silently emulated behavior.
- An invalid revision cannot queue runs through either UI or API.
- The validation result and validator version are stored with the revision.

### PL2-004 — Estimate workload and cost

**Priority:** Must · **Persona:** Experiment Designer · **Milestone:** M1

As an experiment designer, I want a run-count, model-call, wall-time, and cost
estimate so that I can reduce an unaffordable design before execution.

Acceptance criteria:

- The estimate reflects factor combinations, replications, policy conditions,
  and declared decision-event frequency.
- The estimate distinguishes simulation instances from simultaneous LLM calls.
- Assumptions and uncertainty ranges are visible.
- The system rejects a frozen revision that exceeds a hard tenant quota unless
  an authorized administrator changes the quota.
- Actual resource use is compared with the estimate after completion.

### PL2-005 — Treat model and policy as experimental factors

**Priority:** Should · **Persona:** Experiment Designer · **Milestone:** M1

As an experiment designer, I want model, prompt/policy version, memory policy,
and tool set to be explicit factors so that cognitive-policy comparisons are
reproducible.

Acceptance criteria:

- A factor may reference a registered model configuration or immutable policy
  artifact.
- Reports group results by the exact model identifier and policy digest, not a
  mutable display name.
- Provider decoding parameters and tool schema hashes are captured.
- A provider alias that resolves to a different model creates provenance drift
  and blocks silent reuse of the prior validation label.

## 4. Epic B — Experimental design and measurement

### PL2-101 — Define replications and independent seed domains

**Priority:** Must · **Persona:** Experiment Designer · **Milestone:** M1

As an experiment designer, I want declared replications and separate sources of
randomness so that variance can be measured and paired comparisons are valid.

Acceptance criteria:

- The designer sets a fixed replication count or an approved sequential stopping
  rule.
- The manifest records design, environment, actor, and evaluator seed domains.
- Every run displays its resolved seeds.
- Common-random-number pairing can assign the same environment seed to matching
  baseline and treatment runs.
- The report states when a model provider remains nondeterministic despite a
  supplied seed.

### PL2-102 — Define independent authoritative metrics

**Priority:** Must · **Persona:** Scenario Modeler · **Milestone:** M1

As a scenario modeler, I want metrics to come from engine reporters or an
independent evaluator so that participant agents cannot grade their own actions.

Acceptance criteria:

- Every metric declares name, type, unit, direction, evaluator source, and
  aggregation window.
- Participant messages and self-assessments cannot write authoritative scalar
  metrics directly.
- If an evaluator uses an LLM, its model/prompt/seed provenance is separate from
  participant provenance and the report labels the metric as model-evaluated.
- A missing primary metric makes the run invalid or failed according to the
  frozen rule; it is not converted to zero silently.

### PL2-103 — Declare baselines before execution

**Priority:** Must · **Persona:** Research Lead · **Milestone:** M1

As a research lead, I want one or more baselines in the frozen design so that a
treatment is never interpreted without a meaningful comparison.

Acceptance criteria:

- At least one baseline is required for a comparative claim.
- Baselines may be rule/SOP policy, current practice, ablation, no-intervention,
  or a documented upper/lower bound.
- Treatment and baseline share all non-factor settings unless the manifest
  explicitly identifies the difference.
- Analysis reports absolute outcomes and differences from each baseline.

### PL2-104 — Analyze multiple objectives without a hidden primary shortcut

**Priority:** Must · **Persona:** Analyst · **Milestone:** M1

As an analyst, I want constraints and multiple objectives analyzed explicitly so
that the system does not select a “best” run from only the first objective.

Acceptance criteria:

- Hard constraints are evaluated before optimization objectives.
- With multiple objectives, the default result is a Pareto frontier.
- A single ranking is produced only when frozen weights or a declared decision
  rule exist.
- Every objective includes uncertainty and valid-run count.
- The legacy first-objective behavior has a regression test proving it is no
  longer used by the v2 analysis path.

### PL2-105 — Use a preregistered stopping rule

**Priority:** Should · **Persona:** Research Lead · **Milestone:** M3

As a research lead, I want stopping behavior frozen before execution so that the
experiment cannot stop opportunistically when a preferred result appears.

Acceptance criteria:

- Fixed replication count is the default.
- A sequential rule declares minimum and maximum replications, monitored metric,
  confidence/error rule, and evaluation cadence.
- The system stores each stopping evaluation as an event.
- Manual early stop is labeled as an intervention and does not masquerade as the
  preregistered stopping condition.

## 5. Epic C — Run orchestration and reliability

### PL2-201 — Isolate every run and actor stream

**Priority:** Must · **Persona:** Experiment Operator · **Milestone:** M0/M1

As an experiment operator, I want every run and actor to have isolated state and
event channels so that parallel output cannot contaminate another run.

Acceptance criteria:

- A run has a unique run context, adapter instance, event channel, and artifact
  namespace.
- Two agents do not share one undifferentiated result queue.
- Every event is rejected or quarantined if its experiment, revision, run, and
  attempt identity do not match channel ownership.
- A concurrency stress test proves zero cross-run event or context leakage.
- Shared read-only assets are content-addressed; mutable sessions are not shared
  across concurrent runs.

### PL2-202 — Receive exactly one terminal outcome

**Priority:** Must · **Persona:** Experiment Operator · **Milestone:** M0

As an experiment operator, I want every started run to end in one explicit
terminal outcome so that the UI and analysis never hang or invent success.

Acceptance criteria:

- Terminal types are `succeeded`, `invalid`, `failed`, `timed_out`, `cancelled`,
  and `rejected`.
- Every started attempt persists exactly one terminal event.
- Exceptions emit a structured error event followed by terminal completion on
  the client stream.
- Repeated completion callbacks are idempotent and cannot increment counters
  twice.
- Experiment completion reconciles planned, queued, active, and terminal counts.

### PL2-203 — Cancel work across every lifecycle layer

**Priority:** Must · **Persona:** Experiment Operator · **Milestone:** M1

As an experiment operator, I want stop to propagate across all layers so that no
zombie scheduler, model request, engine process, or stream survives unnoticed.

Acceptance criteria:

- One cancellation token is visible to orchestrator, worker, actor call,
  adapter, persistence, and stream delivery.
- Stop prevents new runs from being admitted and cancels queued work.
- Active adapters receive `cancel()` and always receive idempotent `close()`.
- The UI receives cancellation acknowledgement and eventual terminal settlement.
- Integration tests cover stop during queueing, model response, engine step,
  metric evaluation, and artifact upload.

### PL2-204 — Pause and resume with declared semantics

**Priority:** Should · **Persona:** Experiment Operator · **Milestone:** M3

As an experiment operator, I want pause behavior to state whether active runs
continue, checkpoint, or stop so that resumption does not change scientific
meaning silently.

Acceptance criteria:

- “Pause admission” stops new runs while current runs continue.
- “Checkpoint pause” is available only when the adapter declares snapshot and
  restore support.
- A resumed run references the checkpoint digest and produces a resume event.
- An adapter without checkpoint support cannot present checkpoint pause in the
  UI.

### PL2-205 — Retry without overwriting evidence

**Priority:** Must · **Persona:** Experiment Operator · **Milestone:** M1

As an experiment operator, I want retries to create new attempts so that failed
history and selection effects remain visible.

Acceptance criteria:

- Retry creates a new attempt under the same planned run.
- Prior attempt events, metrics, errors, and artifacts are immutable.
- Retry policy is bounded by error class and attempt count.
- Analysis identifies which attempt supplied the accepted outcome and reports
  retry frequency by condition.
- A user cannot repeatedly retry only unfavorable successful outcomes.

## 6. Epic D — Engine, observation, and actor boundaries

### PL2-301 — Discover adapter capabilities

**Priority:** Must · **Persona:** Integration Engineer · **Milestone:** M0

As an integration engineer, I want adapters to describe their capabilities and
schemas so that experiment design is engine-aware without engine-specific logic
in the orchestrator.

Acceptance criteria:

- `describe()` returns adapter/engine versions, time mode, parameters, reporters,
  actions, units, seed semantics, and optional capabilities.
- The returned document is versioned and contract-tested.
- The UI derives compatible fields from the capability document.
- Unknown schema versions fail safely.

### PL2-302 — Give each role only its permitted observation

**Priority:** Must · **Persona:** Scenario Modeler · **Milestone:** M1

As a scenario modeler, I want role-specific observation policies so that agents
act under realistic information limits rather than omniscience.

Acceptance criteria:

- Observation policies can select, aggregate, delay, distort, and redact truth
  fields.
- The observation artifact records policy digest and source truth-state digest.
- An actor prompt/input receives the observation, not the full truth state.
- Authorization tests prove that one role cannot retrieve another role's hidden
  fields through the normal actor interface.
- Analysis can distinguish truth, observation, and actor belief.

### PL2-303 — Validate action intents before state mutation

**Priority:** Must · **Persona:** Scenario Modeler · **Milestone:** M1

As a scenario modeler, I want proposed actions checked by both platform policy
and engine legality so that an LLM cannot bypass the modeled rules.

Acceptance criteria:

- Actor output is parsed into a versioned typed action schema.
- Malformed output is rejected or returned for bounded correction without
  guessing missing action identity.
- Supervisor permission checks occur before engine application.
- The adapter returns accepted/rejected status and structured reason per intent.
- Only accepted actions can change truth state.

### PL2-304 — Trigger cognition only when required

**Priority:** Should · **Persona:** Experiment Designer · **Milestone:** M1

As an experiment designer, I want cognitive policies invoked by declared events
or schedules so that a high-frequency engine tick does not create unnecessary
cost or artificial cognition.

Acceptance criteria:

- Decision triggers are part of the frozen manifest.
- The event log records why each policy was invoked.
- Rules or cached policies can handle background behavior without an LLM call.
- Analysis reports model-call count, token use, cost, and decision events per
  simulation-time unit.

### PL2-305 — Execute a model through a headless NetLogo adapter

**Priority:** Must · **Persona:** Scenario Modeler · **Milestone:** M2

As a scenario modeler, I want to run a NetLogo model headlessly so that I can
reuse mature ABM models while adding MesaLogo cognitive policies and evidence.

Acceptance criteria:

- The adapter loads a pinned model artifact and reports the NetLogo version.
- It sets declared parameters and random seed, runs setup, advances ticks or an
  until-condition, and collects declared reporters.
- Multiple runs use isolated workspaces/processes.
- Timeout and cancellation close every process and release temporary resources.
- Unsupported extensions or commands fail preflight with an actionable error.

### PL2-306 — Prove NetLogo BehaviorSpace parity

**Priority:** Must · **Persona:** Reviewer/Auditor · **Milestone:** M2

As a reviewer, I want adapter results compared with native BehaviorSpace so that
I can trust parameter, seed, stop-condition, and reporter semantics.

Acceptance criteria:

- At least two pinned fixture models have native BehaviorSpace reference output.
- The parity suite compares run count, factor assignment, seeds, stopping tick,
  and reporter values.
- Exact or tolerance-based comparisons are declared per reporter.
- A parity failure blocks the adapter's V2 validation label.
- The machine-readable parity report is part of the evidence bundle.

### PL2-307 — Preserve current Action Task scenarios through an adapter

**Priority:** Must · **Persona:** Existing ParallelLab User · **Milestone:** M1

As an existing user, I want current Action Space/Action Task scenarios available
through the new experiment contract so that the research core delivers value
before the NetLogo integration is complete.

Acceptance criteria:

- The Action Task adapter implements the same lifecycle and event contract as
  the fake and NetLogo adapters.
- All in-repository v2 callers use the adapter contract rather than adding new
  branches to the legacy service.
- Existing source scenarios are not mutated by a run.
- Differences from deterministic engine semantics are documented in capability
  metadata and report limitations.

## 7. Epic E — Evidence, analysis, and review

### PL2-401 — Trace a metric back to a decision chain

**Priority:** Must · **Persona:** Reviewer/Auditor · **Milestone:** M1/M3

As a reviewer, I want to navigate from a reported metric to the contributing
state changes and decisions so that conclusions are auditable.

Acceptance criteria:

- Events carry run, attempt, simulation time, correlation, and causation IDs.
- The trace distinguishes truth state, role observation, policy input, decision,
  proposed intent, validation result, adjudicated outcome, and metric update.
- Large payloads are referenced by checksummed artifacts.
- Missing links are reported as evidence gaps rather than hidden.

### PL2-402 — Compare distributions and uncertainty

**Priority:** Must · **Persona:** Analyst · **Milestone:** M1

As an analyst, I want distribution summaries and uncertainty instead of a single
best run so that I can judge practical and statistical differences.

Acceptance criteria:

- Analysis shows valid-run count, mean, median, standard deviation, quantiles,
  and a declared confidence interval where appropriate.
- Baseline comparisons include absolute difference and a suitable effect size.
- Raw run points remain inspectable behind aggregated charts.
- The analysis version and input run set digest are displayed.
- A one-run condition is labeled descriptive only and cannot receive a
  statistical significance claim.

### PL2-403 — Keep failures and exclusions in the denominator

**Priority:** Must · **Persona:** Analyst · **Milestone:** M1

As an analyst, I want failure, invalidity, timeout, cancellation, and exclusion
counts by condition so that survivorship bias is visible.

Acceptance criteria:

- The report shows planned, started, succeeded, invalid, failed, timed-out,
  cancelled, rejected, retried, and excluded counts.
- An exclusion requires a frozen rule or a reviewer-recorded reason.
- Failed/invalid runs are never silently converted to zero or removed.
- Conditions with materially different failure rates receive a prominent warning.

### PL2-404 — Inspect sensitivity and robustness

**Priority:** Should · **Persona:** Analyst · **Milestone:** M3/M4

As an analyst, I want to see whether conclusions survive seeds and plausible
assumption changes so that brittle findings are not presented as robust.

Acceptance criteria:

- The report can group outcomes by seed and declared robustness factor.
- It identifies rank reversals and effect-direction changes across assumptions.
- A robustness conclusion states the tested ranges, not “all conditions.”
- Sensitivity output references the exact run set and analysis revision.

### PL2-405 — Display validation level and limitations

**Priority:** Must · **Persona:** Research Lead · **Milestone:** M0/M1

As a research lead, I want every result labeled with its supported validation
level so that downstream users understand the evidence strength.

Acceptance criteria:

- Reports show V0–V4 level, intended purpose, evidence date, model revision, and
  known limitations.
- The system cannot assign a level above the available evidence checklist.
- Material model, prompt, data, evaluator, or observation-policy changes mark
  affected validation evidence stale.
- “Accredited” is unavailable unless a named external accreditation record is
  attached for the exact model version and intended use.

### PL2-406 — Export a checksummed evidence bundle

**Priority:** Must · **Persona:** Reviewer/Auditor · **Milestone:** M1

As a reviewer, I want a portable evidence bundle so that I can inspect a study
without production database access.

Acceptance criteria:

- The bundle includes manifest, revision digest, run index, scalar metrics,
  failure accounting, analysis result, validation evidence, and artifact index.
- Every included file has a SHA-256 digest in a signed or checksummed inventory.
- Sensitive prompt, memory, and user data follow an explicit redaction profile.
- Export records creator, time, software version, and applied redactions.
- An offline verifier detects a missing or modified artifact.

### PL2-407 — Snapshot and replay when supported

**Priority:** Could · **Persona:** Reviewer/Auditor · **Milestone:** M3/M4

As a reviewer, I want to restore a checkpoint or replay a trace when the engine
supports it so that I can investigate divergence and counterfactual decisions.

Acceptance criteria:

- Snapshot/restore is exposed only for capable adapters.
- Snapshots include engine version, simulation time, state digest, and source run.
- A branch/counterfactual creates a new run lineage and never rewrites the source.
- Replay limitations and nondeterministic divergence are reported.

### PL2-408 — Compare two runs in AAR

**Priority:** Should · **Persona:** Analyst · **Milestone:** M3

As an analyst, I want two traces aligned by simulation time or domain event so
that I can explain why treatment and baseline diverged.

Acceptance criteria:

- The user can align traces by time, checkpoint, or named domain event.
- The comparison highlights differences in observations, decisions, accepted
  actions, interventions, and metric trajectories.
- The view never exposes role-restricted content to an unauthorized reviewer.
- The selected alignment and filters are saved in the report artifact.

## 8. Epic F — White cell, governance, and safety

### PL2-501 — Record a white-cell intervention

**Priority:** Must · **Persona:** White-Cell Controller · **Milestone:** M3

As a white-cell controller, I want to inject an authorized event or correction
with a reason so that an exercise can continue without hiding human influence.

Acceptance criteria:

- Only authorized roles can submit an intervention.
- The event records user, reason, simulation time, wall time, affected runs,
  command/artifact digest, and result.
- An intervention cannot be edited or deleted after acceptance; correction uses
  a linked superseding event.
- Analysis flags intervened runs and can include or separate them by frozen rule.

### PL2-502 — Protect restricted observations and artifacts

**Priority:** Must · **Persona:** Platform Administrator · **Milestone:** M1/M3

As a platform administrator, I want role-based access and redaction for
observations, prompts, memories, and exports so that experiment evidence does not
become an unintended information channel.

Acceptance criteria:

- Access checks apply at experiment, run, role, event payload, and artifact level.
- Artifact references cannot bypass authorization by guessing a URI.
- Export supports named redaction profiles and records what was removed.
- Audit tests cover cross-tenant and cross-role denial.
- The first reference scenario contains only synthetic, non-classified data.

### PL2-503 — Audit configuration and permission changes

**Priority:** Must · **Persona:** Reviewer/Auditor · **Milestone:** M1

As an auditor, I want configuration, permission, validation, and lifecycle
changes recorded so that study governance is reviewable.

Acceptance criteria:

- Audit events record actor, action, target, before/after digest, time, and result.
- Frozen revision content has no update/delete operation through normal product
  APIs.
- Permission denial and attempted policy bypass are queryable events.
- Audit retention is explicit and independent from transient application logs.

## 9. Epic G — Degraded-communications reference study

### PL2-601 — Run a synthetic organizational-resilience scenario

**Priority:** Must · **Persona:** Research Lead · **Milestone:** M3

As a research lead, I want a complete synthetic degraded-communications scenario
so that I can evaluate the method without requiring sensitive operational data.

Acceptance criteria:

- The scenario defines synthetic command, intelligence, operations, logistics,
  communications, and white-cell roles.
- The engine owns message network, task network, resources, delays, failures,
  and task completion.
- Scenario data, policies, and model artifacts are versioned.
- The documentation explicitly excludes weapon effects and real-world targeting.

### PL2-602 — Vary communications and information conditions

**Priority:** Must · **Persona:** Experiment Designer · **Milestone:** M3

As an experiment designer, I want packet loss, delay, bandwidth, observation
error, and information permissions as factors so that resilience can be tested
under controlled degradation.

Acceptance criteria:

- Factor ranges and units are validated by the scenario adapter.
- A run's truth-state network condition is recorded independently from each
  role's perceived condition.
- The baseline and treatment can share paired environment seeds.
- Invalid combinations fail preflight rather than during analysis.

### PL2-603 — Compare SOP, LLM, and hybrid decision policies

**Priority:** Must · **Persona:** Analyst · **Milestone:** M3

As an analyst, I want rule/SOP, LLM, and hybrid policies compared under matched
conditions so that any cognitive-agent value is measured against a transparent
baseline.

Acceptance criteria:

- A deterministic SOP policy is included as a required baseline.
- Policy assignment is a frozen factor and all other conditions remain matched.
- Primary outputs include detection time, coordination latency, critical-task
  completion, backlog/recovery, contradictory orders, violations, interventions,
  and cost.
- The report shows effectiveness and resource cost together.
- No policy is called “superior” when confidence, failures, or constraints do not
  support that statement.

### PL2-604 — Explain a divergence in after-action review

**Priority:** Must · **Persona:** Reviewer/Auditor · **Milestone:** M3

As a reviewer, I want to explain a baseline/treatment divergence from the event
trace so that the reference study demonstrates more than aggregate charts.

Acceptance criteria:

- At least one primary metric links to an aligned baseline/treatment trace.
- The trace shows the role observations that differed, resulting decisions,
  accepted/rejected actions, engine state changes, and interventions.
- The reviewer can mark an explanation as supported, disputed, or unresolved.
- Reviewer annotations are versioned artifacts and do not modify source events.

### PL2-605 — Publish the reference report with a bounded claim

**Priority:** Must · **Persona:** Research Lead · **Milestone:** M3

As a research lead, I want the reference report to state evidence and limits in
plain language so that it is useful without overstating predictive validity.

Acceptance criteria:

- The report includes purpose, synthetic-data statement, manifest digest,
  baselines, replications, uncertainty, failures, validation level, and limits.
- It uses “under the modeled assumptions” for outcome comparisons.
- It does not claim real-world conflict probability, operational readiness, or
  accreditation.
- A reviewer can reproduce the result set from the evidence bundle within the
  documented engine/model limits.

## 10. Release slices

| Slice | Required stories | User-visible outcome |
|---|---|---|
| M0 — Contract | PL2-001, 002, 003, 201, 202, 301, 405 | A fake/deterministic engine can produce an immutable, terminal, reviewable run |
| M1 — Research core | PL2-004, 005, 101–104, 203, 205, 302–304, 307, 401–406, 502–503 | Existing Action Task experiments gain replications, independent metrics, statistics, and evidence |
| M2 — NetLogo | PL2-305, 306 | A pinned NetLogo model runs headlessly with native BehaviorSpace parity evidence |
| M3 — Reference study | PL2-105, 204, 404, 408, 501, 601–605 | A synthetic degraded-communications study supports bounded, traceable comparison |
| M4 — Validation/federation | PL2-407 plus benchmark and external-adapter follow-ups | One named model reaches benchmark validation and one external adapter passes contract tests |

## 11. Cross-cutting non-functional acceptance criteria

These criteria apply to every story where relevant:

- **Isolation:** experiment, run, attempt, actor, and tenant identities are
  propagated and verified at boundaries.
- **Idempotency:** lifecycle commands and completion handling tolerate retries.
- **Observability:** structured logs and metrics include correlation IDs without
  leaking restricted payloads.
- **Cancellation:** no long-running loop, model request, engine process, or
  artifact operation lacks a bounded cancellation path.
- **Internationalization:** all new frontend-visible text uses the existing
  translation namespaces; no hard-coded Chinese appears in `.tsx` files.
- **Migrations:** persistent model changes use Alembic with reviewed upgrade and
  downgrade paths.
- **Testing:** bug fixes begin with a reproducing failing test; adapters have
  contract tests; lifecycle and streaming behavior have integration tests.
- **Security:** authorization is enforced server-side, including artifacts and
  exported evidence.
- **Compatibility:** internal import moves update all repository call sites and
  do not leave legacy compatibility shims.
- **Documentation:** shipped behavior updates this backlog, the design status,
  API/manifest schemas, and the feature-readiness snapshot.

## 12. Definition of Ready

A story is ready for implementation when:

- its persona, research/product value, and milestone are agreed;
- open policy decisions that affect data meaning are resolved;
- API/event/manifest schema changes are identified;
- migration and retention impact is identified;
- permissions and redaction needs are explicit;
- failure, cancellation, and retry behavior is stated;
- tests can be written from the acceptance criteria;
- the story fits one reviewable vertical slice.

## 13. Definition of Done

A story is done only when:

- relevant unit, contract, integration, and end-to-end tests pass;
- the original failure path or scientific-invalidity path is demonstrated by a
  test where applicable;
- changed backend files pass Ruff on the changed scope;
- changed frontend files pass ESLint, i18n key parity, CJK scanning, and build;
- schema changes upgrade and downgrade successfully in a representative local
  database;
- cancellation and terminal behavior are verified, not inferred from a 200
  response;
- the frontend shows the actual data flow for user-facing work;
- evidence/provenance fields are populated in a representative run;
- documentation states which acceptance criteria shipped and which remain;
- no push occurs until the user reviews `git diff` and `git status`.

## 14. Backlog exclusions

The following ideas require separate product decisions and are not hidden inside
these stories:

- a general visual modeling language;
- weapon, sensor, terrain, or damage adjudication databases;
- autonomous control of real-world systems;
- HLA/DIS/TENA federation without a concrete partner and interoperability need;
- formal external accreditation;
- automated causal claims from observational traces;
- indefinite runtime compatibility layers for legacy internal modules.
