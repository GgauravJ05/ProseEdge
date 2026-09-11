# 0003 — Private repository on a free plan

- **Status:** Accepted
- **Date:** 2026-09-11
- **Supersedes:** the _Repository_ bullet of [0001](0001-toolchain-and-delivery.md)

## Context

ADR 0001 made the repository public so that the branch ruleset would be
enforced without a paid plan. The maintainer has since chosen to keep the
repository private. On a private personal repository without GitHub Pro or
Advanced Security:

- rulesets are not enforced (the rulesets API answers 403, "Upgrade to GitHub
  Pro or make this repository public");
- `actions/dependency-review-action` refuses to run ("Dependency review is not
  supported on this repository");
- CodeQL cannot read the workflow run or upload code-scanning results.

The last two made **CI OK** fail on every pull request regardless of the change.

## Decision

- The repository stays private.
- The `Dependency review` job and the CodeQL `analyze` job run only when
  `github.event.repository.private` is false. A skipped job counts as passing
  in **CI OK**, so no required check changes.
- Branch discipline on `main` is kept by convention: changes arrive only by pull
  request, merged by squash, and only when **CI OK** and **Conventional PR
  title** are green.
- `.github/rulesets/main.json` stays committed, so enforcement can be restored
  as-is.

## Consequences

- Nothing technically prevents a direct push or a red merge to `main`.
- New dependencies are not checked for known vulnerabilities or licences at
  review time. Exact pins, pnpm's `minimumReleaseAge` and `allowBuilds`,
  Dependabot and its alerts, SHA-pinned actions and zizmor still apply.
- No CodeQL static analysis runs.
- Reverting is a settings change only: once the repository is public (or on a
  plan that supports these features), the conditions re-enable both jobs and
  the ruleset applies again without workflow edits.
