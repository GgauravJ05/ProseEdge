// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DECORATION_MARKS, styledCodepoints } from '../document';
import { announce, announceText, characterName, namedCount } from './transcript';

/** Character names from the UnicodeData excerpt the alphabet tests already use. */
const names = new Map<number, string>();
for (const line of readFileSync(
  new URL('../document/__fixtures__/UnicodeData.math.txt', import.meta.url),
  'utf8',
).split('\n')) {
  if (line === '' || line.startsWith('#')) continue;
  const [hex, name] = line.split(';');
  if (hex === undefined || name === undefined) throw new Error(`malformed line: ${line}`);
  names.set(Number.parseInt(hex, 16), name);
}

describe('characterName', () => {
  it('matches UnicodeData for every codepoint ProseEdge can emit', () => {
    // 13 alphabets × 52 letters, plus 5 alphabets × 10 digits.
    expect(styledCodepoints().size).toBe(726);
    const wrong = [...styledCodepoints().keys()]
      .filter((cp) => characterName(String.fromCodePoint(cp)) !== names.get(cp))
      .map((cp) => cp.toString(16));
    expect(wrong).toEqual([]);
  });

  it('names the letterlike exceptions by their older names', () => {
    expect(characterName('ℎ')).toBe('PLANCK CONSTANT');
    expect(characterName('ℬ')).toBe('SCRIPT CAPITAL B');
    expect(characterName('ℭ')).toBe('BLACK-LETTER CAPITAL C');
    expect(characterName('ℝ')).toBe('DOUBLE-STRUCK CAPITAL R');
  });

  it('names the decoration marks', () => {
    expect(characterName(DECORATION_MARKS.underline)).toBe('COMBINING LOW LINE');
    expect(characterName(DECORATION_MARKS.strikethrough)).toBe('COMBINING LONG STROKE OVERLAY');
  });

  it('leaves plain characters unnamed', () => {
    for (const ch of ['a', 'Z', '7', ' ', '’', '😀', '', 'ab']) {
      expect(characterName(ch)).toBeUndefined();
    }
  });
});

describe('announce', () => {
  it('reads a styled word letter by letter and keeps the plain text', () => {
    expect(announce('𝗪𝗲’re')).toEqual([
      { kind: 'name', text: 'mathematical sans-serif bold capital w' },
      { kind: 'name', text: 'mathematical sans-serif bold small e' },
      { kind: 'text', text: '’re' },
    ]);
  });

  it('joins adjacent names with commas', () => {
    expect(announceText('𝐇𝐢 there')).toBe(
      'mathematical bold capital h, mathematical bold small i there',
    );
  });

  it('is the text unchanged when nothing is styled', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme-ascii' }), (text) => {
        expect(announceText(text)).toBe(text);
        expect(namedCount(text)).toBe(0);
      }),
    );
  });

  it('counts every styled codepoint as one named character', () => {
    expect(namedCount('𝗪𝗲’𝗿𝗲 𝗵𝗶𝗿𝗶𝗻𝗴')).toBe(10);
    expect(namedCount('a̲b̲')).toBe(2);
  });
});
