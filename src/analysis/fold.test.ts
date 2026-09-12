// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { clusters } from '../document';
import { FEED_ESTIMATE, fold, wrap } from './fold';
import type { FoldRule } from './fold';

/** Every grapheme cluster is one unit wide. */
const fixed = (text: string): number => clusters(text).length;

const rule = (width: number, lines: number, ellipsis = '…more'): FoldRule => ({
  ...FEED_ESTIMATE,
  width,
  lines,
  ellipsis,
});

describe('wrap', () => {
  it('breaks at spaces, keeping each line within the width', () => {
    expect(wrap('aaa bbb ccc', 7, fixed)).toEqual(['aaa bbb', 'ccc']);
    expect(wrap('aaa bbb   ', 7, fixed)).toEqual(['aaa bbb']);
  });

  it('breaks a word longer than the width between grapheme clusters', () => {
    expect(wrap('abcdefghij', 4, fixed)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrap('go 👩‍💻👩‍💻👩‍💻', 2, fixed)).toEqual(['go', '👩‍💻👩‍💻', '👩‍💻']);
  });

  it('keeps blank lines, and measures a styled letter as one character', () => {
    expect(wrap('a\n\nb', 10, fixed)).toEqual(['a', '', 'b']);
    expect(wrap('𝐇𝐞𝐥𝐥𝐨 there', 5, fixed)).toEqual(['𝐇𝐞𝐥𝐥𝐨', 'there']);
  });

  it('never produces a line wider than the width, and loses no words', () => {
    const words = fc.array(fc.stringMatching(/^[a-z]{1,12}$/u), { maxLength: 12 });
    fc.assert(
      fc.property(words, fc.integer({ min: 1, max: 15 }), (parts, width) => {
        const lines = wrap(parts.join(' '), width, fixed);
        for (const line of lines) expect(fixed(line)).toBeLessThanOrEqual(width);
        expect(lines.join('').replaceAll(' ', '')).toBe(parts.join(''));
      }),
    );
  });
});

describe('fold', () => {
  it('shows the whole post when it fits', () => {
    expect(fold('short\npost', rule(10, 3), fixed)).toEqual({
      visible: 'short\npost',
      truncated: false,
    });
  });

  it('cuts after the line limit and makes room for the ellipsis', () => {
    expect(fold('one\ntwo\nthree\nfour', rule(10, 3), fixed)).toEqual({
      visible: 'one\ntwo\nthree',
      truncated: true,
    });
    const long = Array.from({ length: 4 }, () => 'aaaaaaaaaa').join('\n');
    expect(fold(long, rule(10, 3), fixed)).toEqual({
      visible: 'aaaaaaaaaa\naaaaaaaaaa\naaaaa',
      truncated: true,
    });
  });

  it('uses a placeholder rule that says what it is', () => {
    expect(FEED_ESTIMATE.lines).toBe(3);
    expect(FEED_ESTIMATE.ellipsis).toBe('…see more');
  });
});
