# ParallelLab reused a stale worker session and finalized failed runs as success

## Incident

A real-model ParallelLab smoke test succeeded for one experiment, then a second
multi-agent experiment immediately failed to load the conversation and agents
that had just been committed. The run was persisted as `failed`, but the next
status read finalized the experiment as `completed` and selected the failed
run's initial metric value as the best result.

This produced two misleading outcomes at once:

- valid newly created entities looked missing to the scheduler worker; and
- an experiment with zero successful runs appeared complete and actionable.

## Root cause

Two independent lifecycle bugs combined:

1. `asyncio.to_thread` reused a worker thread whose scoped SQLAlchemy session
   could still hold an earlier MariaDB `REPEATABLE READ` transaction. The
   synchronous conversation callback did not remove that session at entry or
   exit, so the worker could not see rows committed after its snapshot began.
2. `_finalize_experiment` treated "all runs are terminal" as "the experiment
   succeeded." It collected every action task into result selection without
   checking the persisted run status.

## Fix

- Every scheduler worker callback now starts and ends at an explicit database
  session boundary.
- Scheduler failures propagate back to the experiment executor.
- Result selection includes only runs with persisted status `completed`.
- An experiment with failed runs and no successful run settles as `failed`;
  mixed success/failure settles as `completed` while retaining failed counters.
- Regression tests cover session cleanup, terminal-state derivation, and failed
  run exclusion.

## Prevention

- Never let a reused worker inherit a scoped database session.
- Derive experiment terminal state from persisted run outcomes.
- "Terminal" and "successful" are different predicates.
- A best result must always prove that its source run completed successfully.
