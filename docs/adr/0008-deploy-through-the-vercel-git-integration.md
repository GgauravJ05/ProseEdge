# 0008 — Deploy through the Vercel Git integration

- **Status:** Accepted
- **Date:** 2026-09-12
- **Supersedes:** [0004](0004-deploy-to-vercel.md) (deploy from GitHub Actions with the Vercel CLI)

## Context

ADR 0004 deployed from CI with the Vercel CLI and set
`git.deploymentEnabled: false` in `vercel.json`, so that connecting the
repository in the Vercel dashboard could not add a deployment CI had not
produced.

The owner had already connected the repository through Vercel's GitHub
integration, which is what serves <https://proseedge.vercel.app>. Merging 0004
therefore switched production deploys off: the integration was disabled by the
config file, and the CI job skips itself because the repository has no
`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` or `VERCEL_TOKEN`.

The result was silent. `main` collected six merged pull requests — the whole
v0.1 formatter, the structure and fold work, and the visual design — while the
live site kept serving the build from before any of it. The last production
deployment was `dca0b9a`, created six minutes before 0004 merged.

## Decision

- **The Vercel GitHub integration deploys the site.** `vercel.json` no longer
  disables it: production follows `main`, and every pull request gets a preview.
- **The CI deploy workflow is deleted.** Two deployment paths for one site is
  how this broke; one of them could never run without credentials nobody had.
- **CI still gates production, through the merge rule rather than the deploy.**
  `main` only accepts pull requests whose checks pass, so anything Vercel builds
  from `main` has already been through them.
- **A deployment claim is checked against the live site.** "It is deployed"
  means the running page was fetched and contains the change, not that a
  workflow reported success.

## Consequences

- Deploys need no tokens or repository secrets, and there is nothing to rotate.
- Vercel will build a commit whose CI is still running, if one is ever pushed to
  `main` directly. The merge rule, not the platform, is what prevents that.
- Security headers still have no home: `vercel.json` is now almost empty, and
  adding `headers` there is the next change (roadmap M0 follow-up).
- Reverting to CI-driven deploys means restoring 0004's workflow _and_
  disconnecting the integration in the dashboard, not just re-adding the config
  flag.
