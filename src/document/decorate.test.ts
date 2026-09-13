// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Rendering and recovering decorated text (ADR 0010). The property tests in
 * invariants.test.ts cover the general rules; these pin the specific behaviour
 * a reader would notice.
 */

import { describe, expect, it } from 'vitest';

import { DECORATION_MARKS } from './decorations';
import { builder, sequentialIds, validate } from './grammar';
import { normalize, parseStyled } from './normalize';
import { render, sourceText } from './render';
import { resolveStyle } from './style';

const b = builder(sequentialIds());
const doc = (text: string, style: string[]) =>
  b.document(b.body(b.paragraph(b.span(text, style as never))));

describe('rendering decorations', () => {
  it('appends a mark after each letter, leaving the letter itself alone', () => {
    const out = render(doc('ab', ['underline'])).output;
    expect(out).toBe(`a${DECORATION_MARKS.underline}b${DECORATION_MARKS.underline}`);
    // Two output codepoints per source character, but still one grapheme each.
    expect([...out]).toHaveLength(4);
    expect(normalize(out)).toBe('ab');
  });

  it('composes with an alphabet rather than replacing it', () => {
    const resolved = resolveStyle(new Set(['sans', 'bold', 'underline']));
    expect(resolved.alphabet).toBe('sans_bold');
    expect(resolved.decorations).toEqual(['underline']);
    // Nothing is dropped to make room for a decoration.
    expect(resolved.dropped).toEqual([]);

    const out = render(doc('a', ['sans', 'bold', 'underline'])).output;
    expect(out).toBe(`\u{1D5EE}${DECORATION_MARKS.underline}`);
    expect(normalize(out)).toBe('a');
  });

  it('marks both decorations in a fixed order', () => {
    const out = render(doc('a', ['strikethrough', 'underline'])).output;
    expect(out).toBe(`a${DECORATION_MARKS.underline}${DECORATION_MARKS.strikethrough}`);
    expect(normalize(out)).toBe('a');
  });

  it('never decorates anything but an ASCII letter or digit', () => {
    /*
     * A mark on an emoji or a ZWJ sequence would modify a cluster invariant 4
     * promises to pass through untouched, and usually renders broken. The
     * spaces and punctuation here stay bare, which is why a long underline has
     * gaps at the spaces (ADR 0010).
     */
    const out = render(doc('a b👍!', ['underline'])).output;
    expect(out).toBe(`a${DECORATION_MARKS.underline} b${DECORATION_MARKS.underline}👍!`);
    expect(normalize(out)).toBe('a b👍!');
  });

  it('keeps the plain text free of marks', () => {
    const d = doc('hello', ['underline', 'script']);
    expect(sourceText(d)).toBe('hello');
    expect(validate(d)).toEqual([]);
  });
});

describe('recovering pasted decorations', () => {
  it('reads a decorated letter back as text plus style', () => {
    expect(parseStyled(`a${DECORATION_MARKS.underline}`)).toEqual([
      { text: 'a', style: new Set(['underline']) },
    ]);
    // U+1D5EE is SANS-SERIF BOLD SMALL A, so bold comes back with it.
    expect(parseStyled(`\u{1D5EE}${DECORATION_MARKS.underline}`)).toEqual([
      { text: 'a', style: new Set(['sans', 'bold', 'underline']) },
    ]);
  });

  it('keeps decorated and undecorated runs apart', () => {
    const marked = DECORATION_MARKS.underline;
    expect(parseStyled(`a${marked}b`)).toEqual([
      { text: 'a', style: new Set(['underline']) },
      { text: 'b', style: new Set() },
    ]);
  });

  it('round-trips a rendered post', () => {
    const out = render(doc('Hi there', ['bold', 'strikethrough'])).output;
    const runs = parseStyled(out);
    expect(runs.map((run) => run.text).join('')).toBe('Hi there');
    expect(runs[0]?.style.has('strikethrough')).toBe(true);
    expect(runs[0]?.style.has('bold')).toBe(true);
  });

  it('rejects a decoration mark left in source text', () => {
    const bad = b.document(b.body(b.paragraph(b.span(`a${DECORATION_MARKS.underline}`))));
    expect(validate(bad).map((issue) => issue.message)).toEqual([
      'contains decoration mark U+332; source text must be unstyled',
    ]);
  });
});
