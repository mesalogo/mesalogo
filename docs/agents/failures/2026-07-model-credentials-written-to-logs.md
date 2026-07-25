# Model credentials were written to execution logs

## Incident

While replaying a real-model experiment failure, the backend log contained the
entire resolved model settings dictionary. That dictionary included sensitive
connection fields. The issue affected both role-specific and default-model
resolution paths.

## Root cause

Diagnostic logging serialized an operational configuration object directly.
The object mixed safe metadata with credentials and endpoints, and there was no
allowlist at the logging boundary.

## Fix

- Model diagnostic logs now use a strict field allowlist.
- Credentials, endpoints, custom headers, request bodies, tokens, and secrets
  are excluded rather than masked after serialization.
- A regression test supplies credential-like values and asserts that only safe
  model metadata is returned for logging.

## Prevention

- Never log configuration dictionaries that can contain connection material.
- Prefer a small allowlist over a growing sensitive-key denylist.
- Treat logs as externally readable data even when the current deployment keeps
  them locally.
- If affected logs were exported or broadly accessible, rotate the associated
  credentials and apply the deployment's log-retention procedure.
