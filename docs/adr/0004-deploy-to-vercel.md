# 0004 — Deploy to Vercel from GitHub Actions

- **Status:** Accepted
- **Date:** 2026-09-11
- **Supersedes:** the _Deployment_ bullet of [0001](0001-toolchain-and-delivery.md)

## Context

ADR 0001 chose Cloudflare Pages for the static export. That workflow was never
exercised: no Cloudflare account was connected. The maintainer has chosen
Vercel instead. Vercel offers two ways to deploy a repository: its own Git
integration, which builds every push on Vercel's infrastructure, or the Vercel
CLI run from CI.

## Decision

- Deploy from `.github/workflows/deploy.yml` with the Vercel CLI:
  `vercel pull`, `vercel build`, `vercel deploy --prebuilt`. Pull requests from
  this repository get a preview deployment; pushes to `main` deploy to
  production with `--prod`.
- The CLI is an exactly pinned devDependency installed from the lockfile, as
  wrangler was. No third-party deploy action.
- `vercel.json` sets `git.deploymentEnabled: false`, so connecting the
  repository in the Vercel dashboard never adds a second deployment that CI
  did not produce.
- The job is skipped until the repository defines the variables
  `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (from `.vercel/project.json` after
  `vercel link`) and the secret `VERCEL_TOKEN`.
- The app stays a static export (`output: 'export'`); nothing depends on
  Vercel Functions.

## Consequences

- Builds use the locked dependencies and the pinned Node version, but
  `vercel build` runs `next build` again inside the deploy job rather than
  reusing CI's `out/`.
- Deployment runs alongside CI, not after it. A pull request with failing
  checks can still get a preview; production only changes when a merge reaches
  `main`, which requires green checks by convention (ADR 0003).
- Framework preset, Node version (24.x) and install command are Vercel project
  settings, fetched by `vercel pull`; they must match `.node-version` and pnpm.
- The Hobby plan permits non-commercial personal use only. That fits a research
  and portfolio project; any commercial use needs a paid plan first.
- Where model weights are hosted (R2 in ADR 0001) is not decided here; it is
  revisited with browser runtime integration in phase 6.
