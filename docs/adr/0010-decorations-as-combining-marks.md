# 0010. Underline and strikethrough as combining marks, and provenance without a bijection

Status: Accepted
Date: 2026-09-13

## Context

Underline and strikethrough are the two most used styles in the LinkedIn
formatters people actually reach for, and ProseEdge had neither. Unicode has no
underlined or struck-through alphabet: the only way to draw them is to append a
combining mark — U+0332 COMBINING LOW LINE, U+0336 COMBINING LONG STROKE
OVERLAY — to the character underneath.

That makes them unlike every style already here. The existing ones substitute a
letter for a different codepoint, one in and one out. A decoration leaves the
letter alone and adds a codepoint beside it, which collides with spec §4.2
invariant 3 as written:

> **Provenance totality:** every codepoint in the output maps to exactly one
> source position.

The wording is satisfied, but the property test encoded something stronger — a
bijection, asserting `sourceChars.length === output.length`. An underlined post
is longer than its source by exactly the number of marks, so the test as written
cannot pass, and §11 makes that file the exit criterion for Phase 1.

Three options were considered: restate the invariant, ship strikethrough only
(identical problem, since U+0336 is also a combining mark), or drop the feature.

## Decision

**Restate invariant 3, from a bijection to totality plus monotonicity.** Every
output codepoint still maps to exactly one source position; several may now
share one; a decoration maps to the position of the character it decorates; and
the sequence of source positions never decreases. What the invariant exists to
guarantee — that no output character is unaccounted for — is untouched. Only the
one-to-one assumption goes.

Monotonicity is the part worth naming. `sourceOffsetAt` and `outputOffsetAt` are
written as "the first output position whose source is at least _x_", so they map
carets correctly under a many-to-one relation **provided the sources are
ordered**. Keeping that property is what lets the editor's selection handling go
unchanged.

**Decorations resolve separately from alphabets.** `ResolvedStyle` gains a
`decorations` list beside `alphabet`. Nothing is ever dropped to make room for a
decoration, because a mark composes with any family: text can be sans, bold and
underlined at once. `dropped` keeps meaning what it meant — a style Unicode has
no alphabet for.

**A mark lands only on an ASCII letter or digit**, the same coverage rule the
alphabets follow. Appending one to an emoji, a ZWJ sequence or a flag would
modify a grapheme cluster that invariant 4 guarantees passes through unmodified,
and usually renders as a broken glyph. The visible cost is that the space
between two words is not underlined, so a long underline has gaps at the spaces.
That is the honest trade: a continuous line would mean decorating clusters we
promise not to touch.

**Decoration marks are not valid source text.** `validate` rejects them in span
text exactly as it rejects a styled codepoint, and `normalize` drops them. A
mark left in the source would survive normalization and break round-trip.

**The checks panel counts them separately.** `postStats` gains `decorated`
alongside `styled`, because the two fail differently: a substituted letter is
folded back to ASCII by a reader that applies NFKC, whereas a combining mark is
announced, or splits the letter from its mark. Reporting them in one number
would hide the worse of the two behind the better.

## Consequences

- A decorated letter costs **two codepoints**, so on a platform counting UTF-16
  code units an underlined word costs twice a plain one. `budget()` already
  measures the rendered output, so the length meter and `styleCost` report this
  with no special case — and ProseEdge says so at the moment the style is
  applied, which no comparable tool does.
- Invariant 3's property test is materially weaker than it was: it no longer
  proves output and source are the same length. The monotonicity assertion and
  the explicit "a mark's source equals its base character's" check are what
  replace it, and both are new.
- Pasted decorated text round-trips: `parseStyled` strips the marks, folds the
  letter underneath, and restores both halves of the style. Runs join only when
  the alphabet _and_ the decorations agree, so bold and underlined-bold stay
  separate spans.
- The spec's §4.1 `StyleKind` listing and §4.2 invariant 3 are both now out of
  date; this record supersedes them until the spec is revised.
- A future decoration (overline, U+0305, say) is a table entry in
  `decorations.ts` and needs no further grammar change.
