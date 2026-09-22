# Roadmap: ship the formatter now, grow it in public

- **Status:** Accepted
- **Date:** 2026-09-12
- **Decisions:** [ADR 0007](adr/0007-continuous-delivery-of-the-formatter.md)
- **Live:** <https://proseedge.vercel.app>

ProseEdge goes live as a plain Unicode text formatter first and gains the
research features from the [specification](architecture-spec.md) one release at
a time. People can use it from the first week; nothing in the research plan
waits on the app, and nothing in the app waits on research.

## Principles

1. **Always usable.** `main` is always releasable. Every merge to `main`
   deploys to production, and `main` only receives pull requests whose CI passed.
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
                      └─► Vercel preview deployment (all flags on)
      ─► squash merge to main, only when CI is green
      ─► Vercel production deployment (released flags only)
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

### M0 · Deploy pipeline live — done

The repository owner connected the Vercel GitHub integration to the `proseedge`
project on 2026-09-11: production follows `main` at
<https://proseedge.vercel.app>, and every pull request gets a preview. The
CI-driven deploy proposed in #7 was closed as redundant.

Followed by #17 (deploy through the Git integration, ADR 0008) and #18 (security
headers in `vercel.json`, tested against the preview server so a broken
Content-Security-Policy fails CI rather than production).

### M1 · v0.1 Formatter — done

Shipped as #11 (toolbar and copy), #12 (post checks, saved drafts, feature
flags) and #13 (launch polish), then extended well past the original three:

- Six alphabets — serif, sans, script, fraktur, double-struck, monospace — with
  bold and italic where Unicode has them, and the combination disabled where it
  does not (ADR 0002). Underline and strikethrough are combining marks rather
  than alphabets, so they compose with every family (ADR 0010).
- The plain text beside the styled post, always, and copyable on its own.
- **Every style** as a one-click copy of the whole post, for when no selection
  is wanted.
- Uppercase and lowercase as transforms rather than styles: they rewrite the
  post, so the plain pane changes with them.
- Checks: character, word and line counts; characters a style could not reach;
  styled and decorated letters counted separately, because a substituted letter
  and a combining mark fail differently for a screen reader.
- Drafts saved in this browser, a landing page at `/` with the formatter at
  `/format`, light and dark themes, and an axe scan of every page in CI.

### M2 · v0.2 Structure and fold — done

- Hook / body / call-to-action structure detected from the text (spec §4.1),
  with bulleted, numbered and checklist commands.
- Readability (Flesch–Kincaid) computed on the plain source, never the symbols.
- Per-platform targets — LinkedIn, X, Instagram, Threads — each counting in its
  own unit, so the meter shows that styling is free on X and costs double where
  code units are counted.
- A preview laying the post out at the target feed's own column width and type
  size (ADR 0009). It imitates layout, never brand: no logo or brand colour.
- "…see more" fold estimated from measured glyph widths rather than character
  counts (spec §3). It stays behind the `foldPreview` flag, off in production,
  until a platform's fold rule is actually measured.

Accessible export that keeps emphasis through structure (spec §7.4) moves to
M3: which structural cues survive a screen reader is exactly what that study
measures.

### M3 · v0.3 Measured accessibility (spec phase 2)

- The screen-reader study: about 200 posts, VoiceOver on macOS and NVDA on
  Windows, default and verbose settings, word error rate against the source
  (spec §7.1), written up in `docs/accessibility-study.md`.
- The M1 count becomes a predicted degradation with a confidence interval,
  fitted to that data (spec §7.2).
- Accessible export (spec §7.4), informed by the study.
- Recording is offline work, so it can start alongside M1 and M2.

### M4 · v0.4 Opening feedback, experimental (spec phases 3–6)

- **Phase 3 (data landed):** the full Hacker News history is collected — 238
  monthly snapshots, 4,727,774 stories — with the collector (#8), stratified
  pairing with time splits and leak checks (#29, ADR 0006) and every manifest
  (#30) on `main`. Next: choose the real train / validation / test boundaries
  over that history, then the four §5.2 baselines.
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

|       | Web app                             | Research                                                   |
| :---- | :---------------------------------- | :--------------------------------------------------------- |
| Done  | M1 formatter, M2 structure and fold | Collection, pairing and manifests on `main`                |
| Now   | v0.1.0 release                      | Split boundaries over the full history, then the baselines |
| Next  | M3 accessibility study              | Start the VoiceOver and NVDA recordings; teacher model     |
| Later | M4 UI behind flags                  | Compression, browser runtime                               |

## Risks

| Risk                                                         | Mitigation                                                                                                                |
| :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| The formatter spreads styling that hurts screen-reader users | The notice is on by default, **Copy plain text** is one click away, and M3 replaces the notice with a measured prediction |
| Vercel deploys `main` whether or not CI passed               | Merges happen only on green CI; end-to-end tests cover the core flows; Instant Rollback takes seconds                     |
| Vercel's Hobby plan is for non-commercial use only           | Fine for a portfolio project; moving to Pro is a billing change, not a code change                                        |
| The free analytics tier has monthly event limits             | Page views only; if a limit is hit, analytics stop and the app keeps working                                              |
| Flags pile up                                                | Each flag is deleted in the PR after its feature ships                                                                    |

## Deployment

- **Vercel project:** `proseedge`, connected through the Vercel GitHub
  integration. No tokens or repository secrets are involved.
- **Environments:** `main` → production; any other branch or pull request →
  preview.
- **Web Analytics:** enable it in the Vercel project's Analytics tab. Until it
  is enabled, the analytics script records nothing and the app is unaffected.
