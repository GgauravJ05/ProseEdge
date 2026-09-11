// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { readability, syllables } from './readability';

describe('syllables', () => {
  it('counts vowel groups, drops a silent final e, and never returns zero', () => {
    const cases: [string, number][] = [
      ['cat', 1],
      ['make', 1],
      ['table', 2],
      ['people', 2],
      ['free', 1],
      ['queue', 1],
      ['reading', 2],
      ['rhythm', 1],
      ['crazy', 2],
      ['the', 1],
      ["don't", 1],
      ['readability', 5],
    ];
    expect(cases.map(([word]) => [word, syllables(word)])).toEqual(cases);
  });
});

describe('readability', () => {
  it('applies the Flesch–Kincaid grade formula', () => {
    const simple = readability('The cat sat on the mat.');
    expect(simple).toMatchObject({ words: 6, sentences: 1, syllables: 6 });
    expect(simple.grade).toBeCloseTo(0.39 * 6 + 11.8 * 1 - 15.59, 10);

    const dense = readability('Readability matters because complicated sentences exhaust readers.');
    expect(dense).toMatchObject({ words: 7, sentences: 1, syllables: 20 });
    expect(dense.grade).toBeCloseTo(0.39 * 7 + (11.8 * 20) / 7 - 15.59, 10);
  });

  it('ends a sentence at a line break, with or without punctuation', () => {
    expect(readability('First line\nSecond line').sentences).toBe(2);
    expect(readability('One. Two! Three?\n').sentences).toBe(3);
    expect(readability('Trailing space. ').sentences).toBe(1);
  });

  it('has no grade without words', () => {
    expect(readability('')).toEqual({ words: 0, sentences: 0, syllables: 0, grade: null });
    expect(readability('123 👍 —').grade).toBeNull();
  });

  it('always has a sentence for every scored text, and a finite grade', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme-ascii' }), (text) => {
        const { words, sentences, grade } = readability(text);
        const consistent =
          words === 0 ? grade === null : sentences > 0 && grade !== null && Number.isFinite(grade);
        expect(consistent).toBe(true);
      }),
    );
  });
});
