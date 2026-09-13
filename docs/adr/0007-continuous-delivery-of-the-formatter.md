# 0007 — Continuous delivery of the formatter

- **Status:** Accepted
- **Date:** 2026-09-12
- **Amends:** spec §3 ("nothing leaves the device") and §11 (build order)
- **Plan:** [roadmap](../roadmap.md)

## Context

Spec §11 builds ProseEdge in eight research-gated phases. The live editor only
arrives in phase 8, so nobody can use the project while it is being built.

The formatter itself does not depend on any research phase. Phase 1 is done:
the document model styles text reversibly and is property-tested, and `main`
already has a working editor for it. The ML features do depend on research, and
spec §0 forbids presenting them before their evaluation exists.

Spec §3 says nothing leaves the device. Knowing whether anyone uses the tool
needs at least page-view counts.

## Decision

- **Ship the formatter first.** v0.1 is a Unicode formatter with post checks,
  deployed to a `vercel.app` address. Research features follow as later
  releases (roadmap M2–M6).
- **Continuous deployment.** Every merge to `main` deploys to production through
  the Vercel GitHub integration (ADR 0004). `main` only receives pull requests
  whose CI passed, so production is gated by the merge rule rather than by the
  deploy. Every pull request gets a preview deployment. release-please tags
  milestones; tags do not gate deploys.
- **Feature flags.** Unfinished features merge behind build-time flags read in
  one module, because the app is a static export with no server. Previews and
  local development enable every flag, detected from Vercel's `VERCEL_ENV` at
  build time; production enables shipped ones. A flag is removed once its
  feature ships.
- **Research features are gated on evaluation.** The accessibility score, opening
  feedback and rewriter are enabled in production only after the evaluation the
  spec requires exists. A feature that fails stays disabled and the result is
  reported.
- **Analytics.** Vercel Web Analytics, which is cookieless and records page
  views. Typed text is never sent anywhere: an end-to-end test asserts no
  request carries it. A privacy note in the app says exactly what is collected.
  §3's claim becomes "nothing you type leaves your device".
- **Rollback.** Promote the previous production deployment in Vercel, then
  revert the PR.

## Consequences

- The project has users, and therefore feedback, months before the research
  phases finish.
- Production must stay healthy: the end-to-end suite now guards a live product
  and failures in it block merges.
- The privacy claim is narrower than the spec's original wording, and says so.
- Flags add a small amount of code and discipline: each needs a removal PR.
- Styling that hurts screen-reader users becomes easier to produce. The app
  counters this with an on-by-default screen-reader notice and one-click plain
  text, and M3 replaces the notice with a measured prediction.
