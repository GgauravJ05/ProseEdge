# 0009. Show a platform post preview, without imitating the platform

Status: Accepted
Date: 2026-09-12

## Context

The app formats a post for LinkedIn, X, Instagram or Threads, but it shows that
post in a `textarea`. A writer cannot see what they are actually shipping: how
the styled Unicode renders at the platform's own type size, where the lines
break in a narrower column, or how much of the post is visible before a reader
has to press "see more".

Two things make this more than a cosmetic gap. Styled letters come from the
Mathematical Alphanumeric Symbols block, so they are rendered by whatever
fallback font the platform happens to pick, and they are frequently wider than
the surrounding text. And the column a feed gives a post is far narrower than
the editor, so a line that looks balanced while writing can wrap badly in place.

Three options were considered:

1. **Typography only** — correct width, font and line-height on a plain
   background. Cheap and honest, but it does not answer "what will this look
   like", which is the question being asked.
2. **Card chrome without brand assets** — each platform's layout, byline shape
   and action row, drawn in this app's own palette.
3. **A close visual replica** — logos, brand colours, near-exact chrome.

## Decision

Option 2.

**The card imitates layout, never brand.** No platform logo, wordmark or brand
colour appears. The card uses this app's existing tokens, which keeps it inside
the contrast budget the axe scans enforce, lets it follow the light and dark
themes, and avoids reproducing third-party trademarks in a deployed product.
The avatar is an empty circle, the byline is generic, and the action row is a
set of icons drawn on the same 24-unit grid as the rest of the icon set.

**Layout data lives apart from counting data.** `platforms.ts` keeps what can be
checked against a published source: character limits and counting units.
`preview.ts` keeps what was read off a screen: column width, font stack, type
size, line-height, byline shape. These carry different kinds of truth and will
rot at different rates, so they are separate tables — with a unit test asserting
that every `PlatformId` appears in both, so adding a platform cannot silently
skip its layout.

**The card ships; the fold cut does not.** Everything the card draws from its
own geometry — the column, the wrapping, the type scale — is verifiable by
looking at it. Where the feed _collapses_ a post is not: it depends on viewport,
device, font scaling and app version, and this project has not measured it.
`FEED_ESTIMATE` is already labelled a placeholder for exactly this reason. So
the "…see more" cut stays behind the `foldPreview` flag, which is off in
production, while the card itself is unflagged. A `clamp` is recorded per
platform so the cut is ready to draw the day the rule is measured, and it is
`null` for X, where the timeline does not collapse a post by line count at all.

**The preview does not replace the plain-text pane.** The plain pane is the
accessibility argument — what a screen reader announces — and that is the point
of the project. The two share the right-hand pane through a segmented control,
so both remain one click away.

## Consequences

- A writer can see the post at the target's own measurements before copying it,
  and switching target re-renders it, which makes the cost of styling visible
  rather than only counted.
- Every layout number is an approximation and is labelled as one on the card.
  They will drift as the platforms are redesigned, and correcting them is
  editing a table rather than changing behaviour.
- The preview is a second renderer of the same document, so a bug can appear in
  it alone. It is covered by its own e2e specs, which inherit the suite's
  clean-console assertion.
- Nobody gets a pixel-accurate mock. That is deliberate: option 3 would look
  more convincing while being no more correct, and would make a trademark and
  contrast problem out of a layout feature.
