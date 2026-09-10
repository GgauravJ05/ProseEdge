// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import { builder, hasLineTerminator, randomIds, sequentialIds, validate } from './grammar';
import type { Document, Paragraph } from './grammar';

const b = builder(sequentialIds());
const messages = (doc: Document): string[] => validate(doc).map((i) => i.message);

describe('validate', () => {
  it('accepts a well-formed document', () => {
    const doc = b.document(
      b.hook(b.paragraph('Opening line'), b.paragraph(b.span('second', ['bold']))),
      b.body(b.paragraph('Body'), b.list('bullet', b.paragraph('one'), b.paragraph('two'))),
      b.body(b.paragraph('Another section')),
      b.cta(b.link('https://example.com/post')),
    );
    expect(validate(doc)).toEqual([]);
  });

  it('accepts a lone empty paragraph', () => {
    expect(validate(b.document(b.hook(b.paragraph())))).toEqual([]);
  });

  it('rejects an empty document', () => {
    expect(messages(b.document())).toEqual(['a document needs at least one section']);
  });

  it('enforces section order (ADR 0002)', () => {
    expect(messages(b.document(b.body(b.paragraph('x')), b.hook(b.paragraph('y'))))).toContain(
      'the hook must be the first section',
    );
    expect(messages(b.document(b.cta(b.paragraph('x')), b.body(b.paragraph('y'))))).toContain(
      'the call to action must be the last section',
    );
  });

  it('enforces section sizes', () => {
    const three = b.hook(b.paragraph('a'), b.paragraph('b'), b.paragraph('c'));
    expect(messages(b.document(three))).toEqual(['a hook has one or two paragraphs']);
    expect(messages(b.document(b.body()))).toEqual(['a body needs at least one block']);
    expect(messages(b.document(b.body(b.list('numbered'))))).toEqual([
      'a list needs at least one item',
    ]);
  });

  it('rejects a paragraph without spans', () => {
    const empty: Paragraph = { kind: 'paragraph', id: 'p', spans: [] };
    expect(messages(b.document(b.hook(empty)))).toEqual(['a paragraph needs at least one span']);
  });

  it('reports the path of a bad span', () => {
    const doc = b.document(b.hook(b.paragraph('ok', 'line\nbreak')));
    expect(validate(doc)).toEqual([
      {
        path: 'sections[0].paragraphs[0].spans[1]',
        message: 'contains a line terminator; line structure belongs in the tree',
      },
    ]);
  });

  it('rejects styled codepoints in source text', () => {
    expect(messages(b.document(b.hook(b.paragraph('\u{1D41A}'))))).toEqual([
      'contains styled codepoint U+1D41A; source text must be unstyled',
    ]);
  });

  it('rejects empty spans next to other spans', () => {
    expect(messages(b.document(b.hook(b.paragraph('a', ''))))).toEqual([
      'empty span alongside other spans',
    ]);
  });

  it('rejects a span boundary inside a grapheme cluster', () => {
    expect(messages(b.document(b.hook(b.paragraph('e', '\u0301'))))).toEqual([
      'span starts inside a grapheme cluster',
    ]);
  });

  it('rejects duplicate ids', () => {
    const same = builder(() => 'same');
    expect(messages(same.document(same.hook(same.paragraph('x'))))).toContain(
      'duplicate id "same"',
    );
  });

  it('rejects bad link URLs', () => {
    const invalid = 'a link needs a non-empty URL without whitespace';
    expect(messages(b.document(b.cta(b.link(''))))).toEqual([invalid]);
    expect(messages(b.document(b.cta(b.link('https://a b'))))).toEqual([invalid]);
  });
});

describe('hasLineTerminator', () => {
  it.each(['\n', '\v', '\f', '\r', '\u0085', '\u2028', '\u2029'])('detects %j', (ch) => {
    expect(hasLineTerminator(`a${ch}b`)).toBe(true);
  });

  it('allows tabs and ordinary spaces', () => {
    expect(hasLineTerminator('a\tb c\u00A0d')).toBe(false);
  });
});

describe('id factories', () => {
  it('sequentialIds counts up from zero', () => {
    const next = sequentialIds('s');
    expect([next(), next(), next()]).toEqual(['s0', 's1', 's2']);
  });

  it('randomIds produces UUIDs', () => {
    expect(randomIds()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });
});
