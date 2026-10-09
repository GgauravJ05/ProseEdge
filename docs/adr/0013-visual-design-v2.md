# 0013 — Visual design v2: cool paper, one orange accent, restrained motion

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

The violet-on-ink dark theme from the Tailwind migration is competent but
generic: a purple accent on near-black is the most common default there is, the
landing page is a stack of identical cards, and nothing on the page moves. The
maintainer asked for a redesign informed by two sites that do this well:

- [archify.si](https://archify.si/): a tightly tracked grotesque headline, a
  warm radial glow behind the product, a "product window" that shows the real
  artifact rather than a screenshot, and a scroll-driven caption card.
- [impeccable.style](https://impeccable.style/): an uneven hero with a
  before/after slider, small working illustrations instead of icon tiles, and
  an explicit list of patterns to avoid (beige palettes, italic serif display
  type, side-tab borders, nested cards, identical icon tiles, numbered
  section labels).

The project's own `CLAUDE.md` adds constraints: distinct font pairings, bento
layouts, charcoal `#09090b` with noise and hairline borders in dark, and
`framer-motion` entrances.

## Decision

The redesign ships as five pull requests (tokens and motion; landing; scroll
tour; formatter; secondary pages and assets). This record covers the first and
fixes the rules the rest follow.

- **Palette.** Light stays the default and the theme stays an explicit choice
  (PR #20). Light is a cool off-white (`#f5f5f2`) with near-black ink
  (`#121417`) and one accent, a burnt orange (`#b83a0a`). Dark is charcoal
  (`#09090b`), not blue-black, with a brighter orange (`#fb923c`). The violet
  accent is retired. There is one accent in each theme and no second hue.
- **Type.** Space Grotesk for headings, with tighter tracking (-0.03em);
  Plus Jakarta Sans for body text; JetBrains Mono for labels, counts and any
  figure the reader should treat as data. All three are self-hosted through
  `next/font`, so the "no third-party request" claim on `/privacy` stays true.
  An italic serif accent word is rejected: it is the cliché Impeccable names.
- **Depth.** A radial glow on the root and a fixed SVG-turbulence grain layer
  (`body::before`, a `data:` URI, no request, `pointer-events: none`). The glow
  sits on `:root` because a negative-z-index layer paints below the body's own
  background and would otherwise be hidden.
- **Motion.** `framer-motion` under `LazyMotion` with `strict`, so only the
  small `m` components and the DOM animation features ship and a stray full
  import fails the build. `MotionConfig reducedMotion="user"` applies
  site-wide. The vocabulary lives in `src/ui/motion/presets.ts`: a 18px rise,
  an 80ms stagger, a soft spring, a 6px magnetic lean (mouse only), a 0.97
  press scale, and a pointer-following sheen written to CSS variables so moving
  the mouse never re-renders React. The arithmetic is in `geometry.ts` and is
  property-tested.
- **No JavaScript.** Revealed content is hidden in the prerendered markup, so a
  `<noscript>` rule in `<head>` overrides `[data-reveal]`. A test loads the page
  with JavaScript off and asserts the hero is visible.
- **Tests run with reduced motion.** Playwright defaults to
  `reducedMotion: 'reduce'`, which shows revealed content at once, so axe never
  scans an element halfway through its entrance. `e2e/design.spec.ts` opts back
  in to full motion for the tests that exercise it.

### Contrast, measured

Computed from the WCAG relative-luminance formula for every pair the CSS uses.
The first light accent tried (`#c2410c`) measured 4.37:1 on the sunken surface
and was darkened.

| Pair                 | Light |  Dark |
| :------------------- | ----: | ----: |
| ink on paper         | 16.89 | 19.06 |
| muted on paper       |  6.74 |  7.76 |
| muted on sunken      |  6.21 |  6.91 |
| accent on paper      |  5.27 |  8.79 |
| accent on sunken     |  4.86 |  7.83 |
| accent on soft       |  5.16 |  7.41 |
| accent-ink on accent |  5.76 |  8.51 |
| danger on sunken     |  5.55 |  9.33 |

## Consequences

- Every surface changes colour at once, with no layout change in this PR; the
  landing, tour and formatter follow in their own PRs, each gated on the axe
  scans in both themes and the overflow checks from 320 to 1920px.
- `framer-motion` is a new runtime dependency (pinned, and subject to the
  one-day release-age rule).
- The mono face makes labels read as instrumentation. Where a label is
  decoration rather than data, it should stay in the body face.
