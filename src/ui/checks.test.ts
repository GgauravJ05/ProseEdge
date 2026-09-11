// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import * as arb from '../document/__fixtures__/arbitraries';
import { builder, render, sequentialIds } from '../document';
import { coverageMarks, postStats, segments } from './checks';

const b = builder(sequentialIds());

describe('postStats', () => {
  it('counts characters, styled letters, words and lines', () => {
    expect(postStats('ℋ𝒾 7!\n👍🏽')).toEqual({ characters: 7, styled: 2, words: 3, lines: 2 });
    expect(postStats('')).toEqual({ characters: 0, styled: 0, words: 0, lines: 1 });
  });
});

describe('coverageMarks', () => {
  it('locates characters a style could not reach in the output', () => {
    const doc = b.document(b.hook(b.paragraph(b.span('Hi 7!', ['script']))));
    const result = render(doc);
    expect(result.output).toBe('ℋ𝒾 7!');
    expect(coverageMarks(result)).toEqual([
      { start: 4, end: 5, text: '7', reason: 'no_glyph_in_style' },
      { start: 5, end: 6, text: '!', reason: 'not_styleable' },
    ]);
  });

  it('marks a multi-codepoint cluster once, with its full length', () => {
    const doc = b.document(b.hook(b.paragraph(b.span('ok', ['bold']), b.span('👍🏽', ['bold']))));
    expect(coverageMarks(render(doc))).toEqual([
      { start: 4, end: 8, text: '👍🏽', reason: 'not_styleable' },
    ]);
  });

  it('marks nothing in unstyled text', () => {
    expect(coverageMarks(render(b.document(b.hook(b.paragraph('Hi 7!')))))).toEqual([]);
  });

  it('marks exactly the coverage issues, each at the text it names', () => {
    fc.assert(
      fc.property(arb.document, (doc) => {
        const result = render(doc);
        const marks = coverageMarks(result);
        expect(marks).toHaveLength(result.coverage.length);
        for (const mark of marks) expect(result.output.slice(mark.start, mark.end)).toBe(mark.text);
        expect(
          segments(result.output, marks)
            .map((s) => s.text)
            .join(''),
        ).toBe(result.output);
      }),
    );
  });
});

describe('segments', () => {
  it('splits around marks and keeps an empty output as one piece', () => {
    const mark = { start: 1, end: 2, text: 'b', reason: 'not_styleable' } as const;
    expect(segments('abc', [mark])).toEqual([
      { text: 'a', mark: null },
      { text: 'b', mark },
      { text: 'c', mark: null },
    ]);
    expect(segments('', [])).toEqual([{ text: '', mark: null }]);
  });
});
