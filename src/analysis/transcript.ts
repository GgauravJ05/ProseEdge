// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * What a screen reader may announce for a styled post.
 *
 * Screen readers do not agree. Some read a Mathematical Alphanumeric Symbol by
 * its Unicode character name, some skip it, and a few fold it back to the
 * letter. This module produces the first of those, because it is the one the
 * author cannot see and the one that most changes what the post says: the
 * exact Unicode name of every character ProseEdge emits, and the plain text
 * around it untouched. It never claims that a particular reader says this; the
 * interface around it says "may".
 */

import { ALPHABETS, DECORATION_MARKS, fold } from '../document';
import type { AlphabetId } from '../document';

const DIGIT_NAMES = [
  'ZERO',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
];

/*
 * The letters Unicode encoded early, in Letterlike Symbols, before the
 * mathematical block existed. Their names follow an older pattern.
 */
const LETTERLIKE_PREFIX: Partial<Record<AlphabetId, string>> = {
  script: 'SCRIPT',
  fraktur: 'BLACK-LETTER',
  doublestruck: 'DOUBLE-STRUCK',
};
const PLANCK_CONSTANT = 0x210e;

const MARK_NAMES: ReadonlyMap<string, string> = new Map([
  [DECORATION_MARKS.underline, 'COMBINING LOW LINE'],
  [DECORATION_MARKS.strikethrough, 'COMBINING LONG STROKE OVERLAY'],
]);

/**
 * The Unicode name of a character ProseEdge can emit — a styled letter or
 * digit, or a decoration mark — or `undefined` for anything else.
 */
export function characterName(ch: string): string | undefined {
  const mark = MARK_NAMES.get(ch);
  if (mark !== undefined) return mark;
  const cp = ch.codePointAt(0);
  if (cp === undefined || ch.length > 2) return undefined;
  const folded = fold(cp);
  if (folded === undefined) return undefined;
  const { ascii, alphabet } = folded;
  const digit = ascii >= '0' && ascii <= '9';
  const tail = digit
    ? `DIGIT ${DIGIT_NAMES[Number(ascii)] ?? ''}`
    : `${ascii === ascii.toUpperCase() ? 'CAPITAL' : 'SMALL'} ${ascii.toUpperCase()}`;
  if (cp < 0x10000) {
    if (cp === PLANCK_CONSTANT) return 'PLANCK CONSTANT';
    return `${LETTERLIKE_PREFIX[alphabet] ?? ''} ${tail}`;
  }
  return `MATHEMATICAL ${ALPHABETS[alphabet].unicodeStyle} ${tail}`;
}

export type Segment =
  /** Text a reader announces as written. */
  | { readonly kind: 'text'; readonly text: string }
  /** One character announced by its name, lower-cased the way speech reads it. */
  | { readonly kind: 'name'; readonly text: string };

/** `text` as a sequence of plain runs and announced character names. */
export function announce(text: string): Segment[] {
  const out: Segment[] = [];
  let run = '';
  for (const ch of text) {
    const name = characterName(ch);
    if (name === undefined) {
      run += ch;
      continue;
    }
    if (run !== '') {
      out.push({ kind: 'text', text: run });
      run = '';
    }
    out.push({ kind: 'name', text: name.toLowerCase() });
  }
  if (run !== '') out.push({ kind: 'text', text: run });
  return out;
}

/** The announcement as one string: names separated by commas, plain runs as written. */
export function announceText(text: string): string {
  return announce(text)
    .map((segment, i, all) => {
      const next = all[i + 1];
      return segment.kind === 'name' && next?.kind === 'name' ? `${segment.text}, ` : segment.text;
    })
    .join('');
}

/** How many characters of `text` would be read out by name instead of as words. */
export function namedCount(text: string): number {
  return announce(text).filter((segment) => segment.kind === 'name').length;
}
