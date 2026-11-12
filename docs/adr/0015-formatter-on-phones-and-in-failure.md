# 0015 — The formatter on phones and when something fails

- **Status:** Accepted
- **Date:** 2026-11-02
- **Builds on:** ADR 0014 (one sheet) and ADR 0013 (visual design, unchanged)

## Context

A rendered audit of `/format` at 390×844 and 1440×900, in both themes, tested
each content state. Stacked on a phone, "Copy styled" started 1.93 screens down
with the example post, and its confirmation and Undo appeared beside it, far from
whatever caused them. The toolbar took 163 to 213 px above the post. When the
browser refused the clipboard or the draft, the page gave instructions or made a
claim that was no longer true. The maintainer chose to refine the existing brand
rather than change it.

## Decision

- **Copy stays in reach.** Below the 70rem layout the copy buttons, confirmation
  and Undo pin to the bottom of the viewport, unless the post is empty with
  nothing to undo. Document order is unchanged, so ADR 0014's reading order holds
  and its test now checks order rather than position.
- **Two rows of tools on a phone.** Scope is said in words ("Styling the whole
  post") with no border or fill, because it does nothing when pressed.
- **Failure leaves one step.** Blocked copy selects the text. A draft the browser
  refused is reported as unsaved rather than claimed as saved.
- **The draft prompt is a native modal,** and Escape keeps the draft: not
  answering a question must not be what throws work away.
- **The read-out opens with its cost in one number,** computed from the Unicode
  names and worded conditionally (spec §0, "no claim without a measurement"). It
  is arithmetic over names, not a recording of any reader, and it says so.
- **Motion confirms a state** and does nothing else: a check mark after copying,
  a press, the meter moving. All of it stops under reduced motion. No new
  dependency.

## Consequences

- On phones the pinned bar covers the bottom of the viewport; `scroll-padding`
  keeps focused controls clear of it.
- Its behaviour with on-screen keyboards was reasoned about, not tested on a
  device, and should be checked on the preview.
- The conditional read-out number will be replaced when M3 measures real readers.
