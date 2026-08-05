# 2026-08 — customer-specific artifacts published in the public repository

## Summary

The public repository contained customer-specific proposal documents,
institution-specific presentation materials, and named enterprise scenarios.
The files did not contain credentials, but their names and contents disclosed
customer relationships that must remain private.

## Root cause

The first public release was assembled from a broad internal snapshot. The
release scrub focused on credentials, internal network details, and deprecated
code, but it did not include a customer-name denylist or a review of
customer-oriented document directories.

## Remediation

- Removed customer-specific proposal and presentation directories from every
  public branch and release tag.
- Replaced named customer scenarios with generic industry examples throughout
  reachable public history.
- Rewrote public history and republished every public branch and tag with
  force-with-lease.
- Documented the need for GitHub cache cleanup because rewriting refs does not
  immediately remove unreachable objects from every GitHub cache.

## Prevention

Before every public release:

1. Scan paths, file contents, and commit messages for the maintained customer
   denylist in both Chinese and English.
2. Review directories matching `sale`, `demo`, `proposal`, `customer`,
   `internal`, and `private` as potential publication blockers.
3. Scan every branch and tag that will remain on the public remote, not only
   the default branch tip.
4. Treat any customer-specific artifact as a release-blocking information
   disclosure even when it contains no credentials.
