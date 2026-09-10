// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import * as arb from './__fixtures__/arbitraries';
import { builder, paragraphsOf, sequentialIds, validate } from './grammar';
import {
  applyStyle,
  clearStyles,
  normalizeSpans,
  rangesFromSource,
  removeStyle,
  styleState,
  toggleStyle,
} from './ops';
import { render, sourceText } from './render';

const b = builder(sequentialIds());

describe('operations', () => {
  it('preserve the grammar and never change the source text', () => {
    fc.assert(
      fc.property(arb.documentWithRange, arb.styleKind, ({ doc, range }, kind) => {
        const ids = sequentialIds('op');
        const results = [
          applyStyle(doc, range, kind, ids),
          removeStyle(doc, range, kind, ids),
          toggleStyle(doc, [range], kind, ids),
          clearStyles(doc, ids),
        ];
        for (const next of results) {
          expect(validate(next)).toEqual([]);
          expect(sourceText(next)).toBe(sourceText(doc));
        }
      }),
    );
  });

  it('toggling a range that holds letters flips its state', () => {
    fc.assert(
      fc.property(arb.documentWithRange, arb.styleKind, ({ doc, range }, kind) => {
        const before = styleState(doc, range, kind);
        fc.pre(before !== 'empty');
        const after = styleState(toggleStyle(doc, [range], kind, sequentialIds('op')), range, kind);
        expect(after).toBe(before === 'on' ? 'off' : 'on');
      }),
    );
  });

  it('clearStyles restores exactly the accessible source text', () => {
    fc.assert(
      fc.property(arb.document, (doc) => {
        const result = render(clearStyles(doc, sequentialIds('op')));
        expect(result.output).toBe(sourceText(doc));
        expect(result.coverage).toEqual([]);
      }),
    );
  });

  it('splits a span around a styled range', () => {
    const p = b.paragraph('Hello world');
    const doc = applyStyle(b.document(b.hook(p)), { paragraph: p.id, start: 0, end: 5 }, 'bold');
    expect(render(doc).output).toBe('\u{1D407}\u{1D41E}\u{1D425}\u{1D425}\u{1D428} world');
    expect(paragraphsOf(doc)[0]?.spans.map((s) => s.text)).toEqual(['Hello', ' world']);
  });

  it('snaps ranges outward to grapheme cluster boundaries', () => {
    const p = b.paragraph('👩\u200D💻ab');
    const doc = b.document(b.hook(p));
    // Offsets 1..4 fall inside the five-unit ZWJ sequence.
    const inside = { paragraph: p.id, start: 1, end: 4 };
    expect(styleState(doc, inside, 'bold')).toBe('empty');
    const styled = applyStyle(doc, inside, 'bold');
    expect(paragraphsOf(styled)[0]?.spans.map((s) => s.text)).toEqual(['👩\u200D💻', 'ab']);
  });

  it('ignores ranges for paragraphs that do not exist', () => {
    const doc = b.document(b.hook(b.paragraph('text')));
    const missing = { paragraph: 'nope', start: 0, end: 4 };
    expect(styleState(doc, missing, 'bold')).toBe('empty');
    expect(applyStyle(doc, missing, 'bold')).toEqual(doc);
  });
});

describe('normalizeSpans', () => {
  it('merges equal styles, including the bold_italic shorthand, and drops empty spans', () => {
    const p = b.paragraph(
      b.span('a', ['bold_italic']),
      b.span('', ['sans']),
      b.span('b', ['italic', 'bold']),
      b.span('c'),
    );
    expect(normalizeSpans(p).spans.map((s) => [s.text, [...s.style].sort()])).toEqual([
      ['ab', ['bold', 'italic']],
      ['c', []],
    ]);
  });

  it('keeps one empty span in an empty paragraph', () => {
    const p = b.paragraph(b.span(''), b.span(''));
    expect(normalizeSpans(p).spans).toEqual([{ id: p.spans[0]?.id, text: '', style: new Set() }]);
  });
});

describe('rangesFromSource', () => {
  it('splits a selection across paragraphs and skips separators', () => {
    const first = b.paragraph('abc');
    const second = b.paragraph('de');
    const { layout } = render(b.document(b.hook(first, second)));
    // "abc\nde": select from "b" to "d".
    expect(rangesFromSource(layout, 5, 1)).toEqual([
      { paragraph: first.id, start: 1, end: 3 },
      { paragraph: second.id, start: 0, end: 1 },
    ]);
  });
});
