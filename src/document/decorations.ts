// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Underline and strikethrough: styles drawn with a combining mark instead of a
 * substitute alphabet.
 *
 * Every other style in ProseEdge replaces a letter with a different codepoint.
 * These two leave the letter alone and append a mark that renders on top of it,
 * which makes them different in three ways that matter:
 *
 * - They **compose** with any family, so they are not part of the alphabet
 *   resolution at all: `a` can be sans, bold and underlined at once.
 * - They **cost twice**. A decorated letter is two codepoints, so on a platform
 *   that counts UTF-16 code units an underlined word costs double. The length
 *   meter already measures this; nothing here needs to special-case it.
 * - They are **worse for screen readers** than the math alphabets. A reader
 *   that folds mathematical alphanumerics still announces the combining mark,
 *   or announces the letter and the mark separately.
 *
 * A mark is appended only to an ASCII letter or digit, the same rule the
 * alphabets follow (ADR 0010). Appending one to an emoji or a ZWJ sequence
 * would modify a grapheme cluster that invariant 4 guarantees passes through
 * untouched, and would often render as a broken glyph.
 */

export const DECORATIONS = ['underline', 'strikethrough'] as const;
export type Decoration = (typeof DECORATIONS)[number];

/** U+0332 COMBINING LOW LINE and U+0336 COMBINING LONG STROKE OVERLAY. */
export const DECORATION_MARKS: Readonly<Record<Decoration, string>> = {
  underline: '̲',
  strikethrough: '̶',
};

const BY_MARK: ReadonlyMap<string, Decoration> = new Map(
  DECORATIONS.map((decoration) => [DECORATION_MARKS[decoration], decoration]),
);

export function decorationOfMark(ch: string): Decoration | undefined {
  return BY_MARK.get(ch);
}

export function isDecorationMark(ch: string): boolean {
  return BY_MARK.has(ch);
}

/**
 * The marks for a set of decorations, always in `DECORATIONS` order so the same
 * style produces the same bytes every time. Unstable ordering here would make
 * round-trip depend on which button was pressed first.
 */
export function marksFor(decorations: Iterable<Decoration>): string {
  const set = new Set(decorations);
  return DECORATIONS.filter((decoration) => set.has(decoration))
    .map((decoration) => DECORATION_MARKS[decoration])
    .join('');
}

/** Remove every decoration mark: the inverse of appending them. */
export function stripDecorations(text: string): string {
  let out = '';
  for (const ch of text) if (!isDecorationMark(ch)) out += ch;
  return out;
}
