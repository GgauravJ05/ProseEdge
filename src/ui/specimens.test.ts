// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { CLUSTERS } from '../document/__fixtures__/arbitraries';
import { DECORATION_MARKS, normalize } from '../document';
import { SPECIMENS, inStyle } from './specimens';

const byId = (id: string) => {
  const specimen = SPECIMENS.find((s) => s.id === id);
  if (specimen === undefined) throw new Error(`no specimen ${id}`);
  return specimen;
};

describe('specimens', () => {
  it('offers each style once, with a stable id', () => {
    const ids = SPECIMENS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('bold');
    expect(ids).toContain('underline');
  });

  it('renders text in an alphabet', () => {
    expect(inStyle('Hi', byId('bold'))).toBe('\u{1D407}\u{1D422}');
    expect(inStyle('Hi', byId('doublestruck'))).toBe('ℍ\u{1D55A}');
  });

  it('renders a decoration without changing the letters', () => {
    const mark = DECORATION_MARKS.underline;
    expect(inStyle('Hi', byId('underline'))).toBe(`H${mark}i${mark}`);
  });

  it('leaves everything that is not a letter or digit alone', () => {
    /*
     * The same rule the renderer follows. A specimen that styled punctuation or
     * decorated an emoji would disagree with what the editor produces, which is
     * worse than not offering the specimen at all.
     */
    expect(inStyle('Hi, 👍!', byId('bold'))).toBe('\u{1D407}\u{1D422}, 👍!');
    const mark = DECORATION_MARKS.strikethrough;
    expect(inStyle('a b', byId('strikethrough'))).toBe(`a${mark} b${mark}`);
  });

  it('keeps line breaks, so a multi-line post stays multi-line', () => {
    expect(inStyle('a\nb', byId('bold'))).toBe('\u{1D41A}\n\u{1D41B}');
  });

  it('normalizes back to the text it was given', () => {
    // Every specimen is reversible: that is what makes the plain pane true.
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...CLUSTERS), { maxLength: 12 }).map((p) => p.join('')),
        fc.constantFrom(...SPECIMENS),
        (text, specimen) => {
          expect(normalize(inStyle(text, specimen))).toBe(text);
        },
      ),
    );
  });

  it('returns empty text unchanged', () => {
    for (const specimen of SPECIMENS) expect(inStyle('', specimen)).toBe('');
  });
});
