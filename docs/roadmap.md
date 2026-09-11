# Roadmap: ship the formatter now, grow it in public

- **Status:** Proposed
- **Date:** 2026-09-12
- **Decisions:** [ADR 0007](adr/0007-continuous-delivery-of-the-formatter.md)

ProseEdge goes live as a plain Unicode text formatter first, at a `vercel.app`
address, and gains the research features from the
[specification](architecture-spec.md) one release at a time. People can use it
from the first week; nothing in the research plan waits on the app, and nothing
in the app waits on research.

## Principles

1. **Always usable.** `main` is always releasable. Every merge that passes CI
   deploys to production.
2. **Unfinished work is invisible, not absent.** Features merge early behind
   build-time flags. Pull request previews turn every flag on; production turns
   on only what has shipped.
3. **No claim without a measurement.** Research features (accessibility score,
   opening feedback, rewriter) turn on in production only once their evaluation
   exists (spec §0). A feature that fails its evaluation stays off, and the
   README says why.
4. **Typed text never leaves the browser.** The only network traffic is loading
   the page and cookieless page-view analytics. An end-to-end test enforces it.
5. **Two lanes.** The web app (`app/`, `src/`) and the research pipeline
   (`training/`) ship independently. A research PR never blocks a release.

## How a change reaches users

```
branch ─► pull request ─► CI (static checks, unit + property tests,
                              build + end-to-end, training)
                      └─► Vercel preview URL (all flags on)
      ─► squash merge to main ─► production deploy (released flags only)
      ─► release-please collects the change into the next release PR
      ─► merging the release PR tags vX.Y.Z and publishes the changelog
```

Deploys are continuous; tags mark user-visible milestones.
**Rollback:** promote the previous production deployment in Vercel (Instant
Rollback), then revert the offending PR so `main` matches production again.

**Definition of done for a user-facing PR:**

- The preview deployment was opened and the change tried there.
- The user flow has an end-to-end test, and the accessibility scan of the page is clean.
- No request carries typed text (asserted in the end-to-end suite).
- The PR title is a Conventional Commit, so the changelog writes itself.

## Milestones

### M0 · Deploy pipeline live (day 1)

| Step                                                                                                                                                | Owner  |
| :-------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| Create the Vercel project, run `vercel link`, set variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and secret `VERCEL_TOKEN` ([setup](#vercel-setup)) | Gaurav |
| Rebase #7 (deploy via GitHub Actions and the Vercel CLI) onto `main`, confirm a preview URL appears                                                 | Claude |
| Merge #7; confirm the first production deploy                                                                                                       | Gaurav |

**Exit:** a merge to `main` updates the production URL with no manual step.

### M1 · v0.1 Formatter (about a week, three PRs)

The editor already on `main` (`src/ui/style-preview.tsx`) styles a selection
bold, italic or monospace and restores plain text. M1 turns it into a tool
someone would bookmark.

**PR 1 — `feat(app): formatter toolbar and copy`**

- Font family (serif, sans, script, monospace) plus bold and italic toggles.
  This mirrors how styles resolve (ADR 0002), so impossible combinations such as
  bold monospace are greyed out rather than silently dropped.
- Toggle buttons show whether the selection already carries a style
  (`aria-pressed`, from `styleState`).
- **Copy styled** and **Copy plain text**.
- Pasting already-styled text keeps its styles (`fromText` recovers them).
- Keyboard shortcuts: Ctrl/⌘+B and Ctrl/⌘+I.

**PR 2 — `feat(app): post checks`**

- Character count.
- **Screen-reader notice:** how many characters are styled, and that screen
  readers may announce them as mathematical symbols or skip them. It is a count,
  not a score; the calibrated score arrives with M3.
- Characters left unstyled because their style has no glyph (digits in script,
  punctuation), highlighted in place.
- The draft is saved in the browser (`localStorage`) and survives a reload.
- Feature flags module (`src/flags.ts`), so later work can merge early.

**PR 3 — `feat(app): launch polish`**

- Visual design, dark mode, and a layout that works at phone width.
- The app itself is accessible: keyboard-only operation, and an automated axe
  scan in the end-to-end suite.
- Title, description, favicon, social preview image, 404 page.
- Vercel Web Analytics (page views only) and a short privacy note saying
  exactly what is and is not collected.
- Security headers in `vercel.json`: Content-Security-Policy, `nosniff`,
  referrer policy, no framing.
- README: link to the live app and the current status.

**Exit:** the three PRs are merged and live, the end-to-end and accessibility
checks are green, and release-please tags `v0.1.0`.

### M2 · v0.2 Structure and fold (no model)

- Hook / body / call-to-action structure and bullet or numbered lists, from the
  document grammar (spec §4.1).
- "…see more" fold preview, estimated from measured glyph widths rather than
  character counts (spec §3). It stays behind a flag until the widths are
  measured.
- Readability (Flesch–Kincaid) on the plain source.
- Accessible export: emphasis through structure instead of styled letters
  (spec §7.4).

### M3 · v0.3 Measured accessibility (spec phase 2)

- The screen-reader study: about 200 posts, VoiceOver on macOS and NVDA on
  Windows, default and verbose settings, word error rate against the source
  (spec §7.1), written up in `docs/accessibility-study.md`.
- The M1 count becomes a predicted degradation with a confidence interval,
  fitted to that data (spec §7.2).
- Recording is offline work, so it can start alongside M1 and M2.

### M4 · v0.4 Opening feedback, experimental (spec phases 3–6)

- **Phase 3 (in progress):** full Hacker News history is being collected (#8);
  pairing, time splits and leak checks are in review (#9). Next: the data PR
  with every manifest, final split dates, then the four baselines.
- **Phase 4:** teacher model; it must beat TF-IDF on the time split.
- **Phase 5:** distillation, ONNX export with a parity check, INT8, and the
  size/accuracy/latency table.
- **Phase 6:** the ranker in a Web Worker with WebGPU, WASM fallback, or off.
  This needs a host for the weights, a Content-Security-Policy update, and
  cross-origin isolation headers for multithreaded WASM.
- **Ships only if** the model beats the baselines. The UI shows a percentile
  band with uncertainty, labelled experimental. If it does not, the feature
  stays off and the negative result goes in the README.

### M5 · v0.5 Rewriter (spec phase 7, optional)

Off by default unless its win rate clears the prompted baseline with a reliable
judge (spec §8.1).

### M6 · v1.0 (spec phase 8)

Transfer evaluation on human-labelled professional posts, `RESULTS.md`, model
card, and documentation. If time runs short, M5 and M6 are cut before M3 or M4.

## Lanes at a glance

|       | Web app                 | Research                                                            |
| :---- | :---------------------- | :------------------------------------------------------------------ |
| Now   | M0 deploy, M1 formatter | HN collection running; #8, #9 in review                             |
| Next  | M2 structure and fold   | Data PR, split dates, baselines; start the screen-reader recordings |
| Later | M3, M4 UI behind flags  | Teacher, compression, browser runtime                               |

## Risks

| Risk                                                         | Mitigation                                                                                                                   |
| :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| The formatter spreads styling that hurts screen-reader users | The notice is on by default, **Copy plain text** is one click away, and M3 replaces the notice with a measured prediction    |
| Vercel's Hobby plan is for non-commercial use only           | Fine for a portfolio project; moving to Pro is a billing change, not a code change                                           |
| The free analytics tier has monthly event limits             | Page views only; if a limit is hit, analytics stop and the app keeps working                                                 |
| A bad deploy reaches users                                   | End-to-end tests gate the merge; Instant Rollback takes seconds                                                              |
| Flags pile up                                                | Each flag is deleted in the PR after its feature ships                                                                       |
| The repository is private while the app is public            | Allowed: the author is not bound by the AGPL network clause. The footer omits a source link until the repository goes public |

## Vercel setup

One-time, by the repository owner:

1. Sign in at vercel.com with GitHub. From the repository root run
   `pnpm dlx vercel link` and create a project named `proseedge`. Its address
   becomes `proseedge.vercel.app`, or a suffixed variant if that name is taken.
   Do not connect the Git integration: `vercel.json` disables it, and deploys
   come from CI.
2. Read `orgId` and `projectId` from `.vercel/project.json` (ignored by git).
3. Create a token at vercel.com/account/tokens, then:

   ```sh
   gh variable set VERCEL_ORG_ID --body <orgId>
   gh variable set VERCEL_PROJECT_ID --body <projectId>
   gh secret set VERCEL_TOKEN
   ```

4. In the Vercel project, enable **Web Analytics**.
