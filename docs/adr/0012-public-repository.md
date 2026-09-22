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
- `.github/rulesets/main.json` is (re-)applied to `main` once the repository
  is public, since the Rulesets API refused all requests while it was private
  (confirmed: `GET /rulesets` returns 403 "Upgrade to GitHub Pro or make this
  repository public") — this is a one-time settings action, not a workflow
  change, and unlike CI's `if` conditions it does not happen automatically.
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
