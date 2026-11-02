# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People writing posts for LinkedIn, X, Threads and Instagram who want bold, italic
or other styled text in places that have no rich text. They are mid-task: a post
is drafted somewhere else or typed here, styled, then copied out to the platform.

## Product Purpose

ProseEdge styles a post with Unicode "bold" and "italic" letters and shows what
that styling costs before the post goes out: what a screen reader says instead of
the words, how many extra characters the platform counts, and which letters a
font cannot style. Success is a post copied out with the styling the writer chose
and no surprises about how it reads or counts.

## Positioning

The plain text is the source of truth. Styling is metadata over it, so every
style is reversible and the plain version is always one click away
(`normalize(render(doc)) === sourceText(doc)`, property-tested). It names exactly
what a screen reader announces for each styled character, from the Unicode
character names, rather than hiding the cost.

## Operating Context

- The formatter (`/format`) is the working surface; the landing page (`/`)
  explains the problem; `/privacy` states the data policy.
- Output leaves by clipboard: "Copy styled" for the post, "Copy plain text" for
  the accessible version.
- Drafts autosave in the browser; after a reload the writer is asked whether to
  restore the last draft.

## Capabilities and Constraints

- Styles: serif, sans, script, fraktur, double-struck and monospace alphabets,
  with bold and italic where Unicode has them; underline and strikethrough as
  combining marks; uppercase and lowercase as transforms; bulleted, numbered and
  checklist lists.
- Per-platform length budgets for LinkedIn, X, Threads and Instagram, with the
  extra cost of styled letters; some counting rules are marked as assumed, not
  tested, and must keep saying so.
- Feed preview of how the post lays out (ADR 0009).
- Checks: characters, words, lines, structure, reading grade (estimate, English).
- Nothing typed leaves the browser; the only network traffic is loading the page
  and cookieless page-view analytics. An end-to-end test enforces it.
- No claim without a measurement: research features (accessibility score,
  opening feedback, rewriter) stay off until their evaluation exists.
- Static export on Vercel (Next.js, React, TypeScript). Free software, AGPL-3.0.

## Brand Commitments

- Name: ProseEdge. Logo: `app/icon.svg` (P mark with an orange bar).
- Existing visual system: ADR 0013 (cool paper, near-black ink, one burnt-orange
  accent; Space Grotesk, Plus Jakarta Sans, JetBrains Mono). The maintainer asked
  to keep the brand colours.
- Light theme by default; dark theme is an explicit toggle, remembered in the
  browser.

## Evidence on Hand

- The live product at <https://proseedge.vercel.app>.
- Unicode character names for all 726 styled code points, tested against
  `UnicodeData.txt` (`src/analysis/transcript.ts`).
- No user counts, testimonials or accessibility measurements exist yet; none may
  be implied.

## Product Principles

1. Show the cost next to the choice: what styling does to speech and length is
   visible where the styling happens, not in a side panel.
2. The plain text always survives: every style can be removed, and the
   accessible copy is always one click away.
3. Private by construction: nothing typed is sent anywhere.
4. Say only what is measured; mark estimates as estimates.

## Accessibility & Inclusion

WCAG 2.2 AA in both themes (axe-scanned in CI), 44px touch targets on coarse
pointers, finite motion that respects reduced-motion settings, full keyboard use.
