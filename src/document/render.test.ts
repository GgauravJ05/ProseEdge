// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import { builder, sequentialIds } from './grammar';
import { listMarker, outputOffsetAt, render, sourceOffsetAt, sourceText } from './render';

const b = builder(sequentialIds());

describe('render', () => {
  it('uses Letterlike Symbols where the math block has a reserved hole', () => {
    // Arithmetic would give U+1D455, which is unassigned and renders as tofu.
    const doc = b.document(b.hook(b.paragraph(b.span('hi', ['italic']))));
    expect(render(doc).output).toBe('ℎ\u{1D456}');
  });

  it('reports digits the style has no glyph for, and leaves them as source', () => {
    const span = b.span('A1', ['script']);
    const result = render(b.document(b.hook(b.paragraph(span))));
    expect(result.output).toBe('\u{1D49C}1');
    expect(result.coverage).toEqual([
      { span: span.id, offset: 1, text: '1', reason: 'no_glyph_in_style' },
    ]);
  });

  it('reports style kinds no alphabet can combine', () => {
    const span = b.span('x', ['monospace', 'bold']);
    const result = render(b.document(b.hook(b.paragraph(span))));
    expect(result.output).toBe('\u{1D6A1}');
    expect(result.drops).toEqual([{ span: span.id, dropped: ['bold'] }]);
  });

  it('passes emoji sequences through whole and reports them', () => {
    const span = b.span('hi 👩\u200D💻', ['bold']);
    const result = render(b.document(b.hook(b.paragraph(span))));
    expect(result.output).toBe('\u{1D421}\u{1D422} 👩\u200D💻');
    expect(result.coverage).toEqual([
      { span: span.id, offset: 3, text: '👩\u200D💻', reason: 'not_styleable' },
    ]);
  });

  it('emits structure identically with and without styling', () => {
    const list = b.list('numbered', b.paragraph(b.span('one', ['bold'])), b.paragraph('two'));
    const link = b.link('https://example.com');
    const doc = b.document(b.hook(b.paragraph('Hook')), b.body(list), b.cta(link));

    expect(sourceText(doc)).toBe('Hook\n1. one\n2. two\nhttps://example.com');
    const result = render(doc);
    expect(result.output).toBe('Hook\n1. \u{1D428}\u{1D427}\u{1D41E}\n2. two\nhttps://example.com');
    expect(result.provenance[5]).toEqual({ kind: 'structure', node: list.id, source: 5 });
    expect(result.provenance.at(-1)).toMatchObject({ kind: 'link', node: link.id, offset: 18 });
  });

  it('marks list items', () => {
    expect(listMarker('bullet', 4)).toBe('• ');
    expect(listMarker('numbered', 4)).toBe('5. ');
  });
});

describe('offset mapping', () => {
  const result = render(b.document(b.hook(b.paragraph(b.span('ab', ['bold']), 'c'))));

  it('maps source offsets to output offsets across surrogate pairs', () => {
    expect([0, 1, 2, 3].map((o) => outputOffsetAt(result, o))).toEqual([0, 2, 4, 5]);
  });

  it('maps output offsets back to source offsets, rounding forward inside a pair', () => {
    expect([0, 1, 2, 4, 5].map((o) => sourceOffsetAt(result, o))).toEqual([0, 1, 1, 2, 3]);
  });
});
