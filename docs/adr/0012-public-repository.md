# 0012 — Public repository again

- **Status:** Accepted
- **Date:** 2026-09-22
- **Supersedes:** [0003](0003-private-repository.md)

## Context

[0003](0003-private-repository.md) made the repository private on a free plan
and accepted, as a consequence, that `main`'s branch ruleset and the
`Dependency review` / CodeQL `analyze` jobs would not run: both the Rulesets
API and Advanced Security require a public repository or GitHub Pro. The
maintainer is now building in public and wants the project's own process —
ruleset, dependency review, static analysis — actually enforced rather than
kept by convention, and wants the source visible alongside the deployed app.

## Decision

- The repository is public again.
- No ruleset work was needed: the `main` ruleset created under 0001 was never
  deleted, only unenforceable — `GET /rulesets` returned 403 the whole time
  the repository was private (confirmed before flipping visibility), but
  `GET /rulesets/{id}` immediately after flipping it back to public returned
  the same ruleset, `enforcement: active`, matching
  `.github/rulesets/main.json` exactly, and `GET /rules/branches/main`
  confirmed GitHub was evaluating it. It re-enables itself the moment the
  repository becomes public again; there is nothing to re-apply.
- The `Dependency review` and CodeQL `analyze` jobs already gate on
  `!github.event.repository.private` (added by 0003), so both start running
  again on the next pull request with no workflow edit.
- The footer's source link (held back per the roadmap risk table while the
  repository was private) is added, since the code behind the deployed app is
  now something a reader can actually follow.

## Consequences

- `main` accepts pull requests only, merged by squash, gated on green CI and a
  Conventional Commits title — enforced by GitHub, not by convention.
- New dependencies are checked for known vulnerabilities and licence issues at
  review time again.
- CodeQL static analysis runs on every pull request and push to `main`.
- Anyone can read the source, including the training pipeline and the full
  ADR history — nothing in this repository was written assuming it would stay
  private (checked before making it public: no secrets, tokens or personal
  data outside author attribution, which was already public in commit
  history).
