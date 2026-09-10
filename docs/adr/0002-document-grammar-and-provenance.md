# 0002 — Document grammar ordering, separators and provenance

- **Status:** Accepted
- **Date:** 2026-09-10 (recorded after the fact; the implementation in
  `src/document/` already follows it)

## Context

Spec §4.1 gives `Document := Section+` with `Section := Hook | Body | CTA` and a
provenance entry of `{ span, offset }`. Implementing the renderer exposed three
gaps:

1. `Section+` allows a call to action before the hook, or two hooks. Neither
   means anything for a short post, and the fold estimator and ranker both need
   to find "the opening" without searching.
2. The spec never says what characters separate blocks, so `render` and
   `sourceText` could disagree about structure, and round-trip (invariant 1)
   would be testing layout rather than styling.
3. Not every output character comes from a span. List markers and line breaks
   come from structure, and a link's URL is not a span. `{ span, offset }`
   cannot describe them, so provenance totality (invariant 3) would be
   unsatisfiable.

A fourth question comes from Unicode rather than the spec: several style
combinations have no alphabet (there is no bold monospace and no italic script).

## Decision

**Ordering.** `Document := Hook? Body* Cta?` with at least one section. The hook,
when present, is first; the call to action, when present, is last. Multiple
bodies are allowed so a document can be split into topical sections later
without a grammar change.

**Separators.** Sections, blocks, hook paragraphs and list items are separated by
exactly one line feed (`SEPARATOR`). List items are prefixed `• ` (bullet) or
`N. ` (numbered). Span text may not contain any line terminator — LF, VT, FF,
CR, NEL, LS or PS — because line structure belongs in the tree.

**One walker.** `render` and `sourceText` are the same traversal with styling on
or off, so structure is emitted identically by construction and invariant 1 is
a statement about styling alone.

**Provenance** is a discriminated union, one entry per output code point:

| Kind        | Produced by                 | Carries                                |
| :---------- | :-------------------------- | :------------------------------------- |
| `span`      | Span text                   | span id, offset in span, source offset |
| `link`      | A CTA link's URL            | node id, offset in URL, source offset  |
| `structure` | Separators and list markers | node id that emitted it, source offset |

URLs are never styled: a styled URL is a broken URL.

**Style resolution.** `bold_italic` is shorthand for `{bold, italic}` and is
canonicalized before comparison. Font families take precedence
`monospace > script > sans > serif (default)`. Kinds the chosen alphabet cannot
express are returned as `dropped` and surfaced by `render` as a `StyleDrop`;
characters an alphabet has no glyph for are left as source and surfaced as a
`CoverageIssue` (invariant 5). Nothing is ever replaced with a lookalike.

## Consequences

- The grammar is stricter than the spec's text. `validate` enforces the order,
  and importers (`fromText`) produce hook-then-body documents.
- Every consumer of provenance must handle three kinds, not one. In exchange,
  caret mapping (`sourceOffsetAt`, `outputOffsetAt`) is total and needs no
  special cases.
- Invariant 1 depends on the separator choice. Changing it later is a new ADR,
  not an edit.
