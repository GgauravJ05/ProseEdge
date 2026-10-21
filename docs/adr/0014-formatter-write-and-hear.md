# 0014 — The formatter as one sheet: write, then hear what it costs

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The formatter shipped as a three-column workspace: a toolbar card, a post
pane beside a plain-text pane, a checks sidebar, and a grid of fourteen "copy
in this style" cards. Using it showed the problems:

- It opened on a sample post, so the first click put the caret in the middle of
  someone else's text and the first thing typed was spliced into it.
- Until something was styled, the plain-text pane repeated the post word for
  word, and the style grid repeated it fourteen more times.
- The screen-reader warning, the point of the app, sat in a small grey card in
  a sidebar, away from the words it was about.
- Boxes nested inside boxes, several controls were bare icons, and the style
  buttons had no visible selected state on a wide screen.

The maintainer chose, from options shown with sketches: redesign the formatter
only and keep the brand (ADR 0013); a single "write + hear" sheet; a live style
menu in place of the grid; an empty editor with a one-click example. Kept on
request: the feed preview, lists and case tools, the checks, and the
restore-draft prompt.

## Decision

- **One sheet, top to bottom:** toolbar, the post, the target and its length
  budget, then a Checks section, then the copy buttons.
- **Checks speak first.** The default view reads the post out the way a screen
  reader may, each styled character by its Unicode name
  (`src/analysis/transcript.ts`). With nothing styled it says so in one line
  instead of repeating the post. "Plain text" and "Feed preview" are the other
  two views (ADR 0009's preview stays one click away).
- **Scope is explicit.** Styling acts on the selection, or on the whole post
  when nothing is selected, and a label beside the buttons says which. This
  replaces the style grid's "whole post in one alphabet" job. Keyboard
  shortcuts still act only on a selection.
- **The alphabet menu previews.** Pointing at or focusing an alphabet shows it
  on the post, and the checks, length and preview follow; Escape leaves the
  post as it was. Each option says what emphasis Unicode gives it.
- **A selection bar for the mouse.** Bold, italic, underline and strikethrough
  float over selected words on fine pointers. It repeats toolbar buttons, so it
  is hidden from assistive technology and the tab order; touch screens never
  show it, because the system selection menu sits there.
- **Beside, on wide screens.** From 70rem the Checks section moves into a
  sticky column to the right of the post, so the read-out changes in view as
  you type instead of a scroll below. The post column sets the sheet's height
  (size containment on the column); phones keep the stacked order.
- **Empty first.** The editor opens empty with a "Try an example" button whose
  post already carries some styling.

## Consequences

- The e2e suite was rewritten against the new structure: alphabets are picked
  through the menu (`e2e/helpers.ts`), the plain text is a view, and the style
  grid's tests became menu tests.
- Fewer controls on the page; the touch-target sweep's floor of measured
  controls on `/format` drops from 40 to 25.
- `PRODUCT.md` now records the product facts this design was judged against.
