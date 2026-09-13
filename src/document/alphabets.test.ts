// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Every glyph ProseEdge can emit, checked against the character names in
 * UnicodeData.txt. Regenerate the excerpt with `pnpm fixtures:unicode`.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ALPHABETS, ALPHABET_IDS, ASCII_ALNUM, fold, glyph, styledCodepoints } from './alphabets';
import type { Alphabet } from './alphabets';
import { at } from './util';

const names = new Map<number, string>();
for (const line of readFileSync(
  new URL('__fixtures__/UnicodeData.math.txt', import.meta.url),
  'utf8',
).split('\n')) {
  if (line === '' || line.startsWith('#')) continue;
  const [hex, name] = line.split(';');
  if (hex === undefined || name === undefined) throw new Error(`malformed line: ${line}`);
  names.set(Number.parseInt(hex, 16), name);
}
const assigned = new Set(names.values());

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

/**
 * Letterlike Symbols whose name does not follow the "<STYLE> CAPITAL|SMALL <L>"
 * pattern. Fraktur's five are all named BLACK-LETTER: they were encoded before
 * the math block existed, under the older name for the same script.
 */
const LETTERLIKE_ALIASES: Readonly<Partial<Record<number, string>>> = {
  0x210e: 'PLANCK CONSTANT', // italic small h
  0x212d: 'BLACK-LETTER CAPITAL C', // fraktur C
  0x210c: 'BLACK-LETTER CAPITAL H', // fraktur H
  0x2111: 'BLACK-LETTER CAPITAL I', // fraktur I
  0x211c: 'BLACK-LETTER CAPITAL R', // fraktur R
  0x2128: 'BLACK-LETTER CAPITAL Z', // fraktur Z
};

const hex = (cp: number): string => cp.toString(16).toUpperCase().padStart(4, '0');
const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';
const isUpper = (ch: string): boolean => ch >= 'A' && ch <= 'Z';

function mathName(alphabet: Alphabet, ch: string): string {
  const prefix = `MATHEMATICAL ${alphabet.unicodeStyle}`;
  if (isDigit(ch)) return `${prefix} DIGIT ${at(DIGIT_NAMES, Number(ch))}`;
  return `${prefix} ${isUpper(ch) ? 'CAPITAL' : 'SMALL'} ${ch.toUpperCase()}`;
}

/** The codepoint the offset arithmetic produces, ignoring exceptions. */
function arithmetic(alphabet: Alphabet, ch: string): number {
  const c = ch.charCodeAt(0);
  return isUpper(ch) ? alphabet.capitalA + c - 0x41 : alphabet.smallA + c - 0x61;
}

describe('alphabets', () => {
  it('reads the Unicode excerpt', () => {
    expect(names.get(0x1d400)).toBe('MATHEMATICAL BOLD CAPITAL A');
    expect(names.get(0x2102)).toBe('DOUBLE-STRUCK CAPITAL C');
  });

  it.each(ALPHABET_IDS)('%s: every glyph is the character Unicode names for it', (id) => {
    const alphabet = ALPHABETS[id];
    const wrong: string[] = [];

    for (const ch of ASCII_ALNUM) {
      const expected = mathName(alphabet, ch);
      const g = glyph(id, ch);
      if (g === null) {
        if (assigned.has(expected)) wrong.push(`${ch}: Unicode has ${expected}, glyph() has none`);
        continue;
      }
      const cp = g.codePointAt(0) ?? -1;
      const name = names.get(cp);

      if (alphabet.exceptions[ch] === undefined) {
        if (name !== expected) {
          wrong.push(`${ch}: U+${hex(cp)} is ${name ?? 'unassigned'}, expected ${expected}`);
        }
        continue;
      }

      // An exception is only justified by a reserved hole in the math block.
      const hole = arithmetic(alphabet, ch);
      if (names.has(hole)) {
        wrong.push(`${ch}: listed as exception but U+${hex(hole)} is ${names.get(hole) ?? ''}`);
      }
      const letterlike = LETTERLIKE_ALIASES[cp] ?? expected.replace('MATHEMATICAL ', '');
      if (cp < 0x2100 || cp > 0x214f || name !== letterlike) {
        wrong.push(
          `${ch}: exception U+${hex(cp)} is ${name ?? 'unassigned'}, expected ${letterlike}`,
        );
      }
    }

    expect(wrong).toEqual([]);
  });

  it('no two glyphs share a codepoint, and fold inverts glyph', () => {
    let emitted = 0;
    for (const id of ALPHABET_IDS) {
      for (const ch of ASCII_ALNUM) {
        const g = glyph(id, ch);
        if (g === null) continue;
        emitted += 1;
        expect(fold(g.codePointAt(0) ?? -1)).toEqual({ ascii: ch, alphabet: id });
      }
    }
    expect(styledCodepoints().size).toBe(emitted);
  });

  it('never styles anything but a single ASCII letter or digit', () => {
    for (const input of ['', 'ab', ' ', '.', 'é', '\u{1D400}']) {
      expect(glyph('bold', input)).toBeNull();
    }
  });
});
