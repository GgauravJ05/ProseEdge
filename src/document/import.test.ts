// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import * as arb from './__fixtures__/arbitraries';
import { paragraphText, paragraphsOf, validate } from './grammar';
import { fromText, toLf } from './import';
import { normalize } from './normalize';
import { render, sourceText } from './render';

/** Arbitrary text mixing random graphemes, styled output and every line terminator. */
const pasted = fc
  .array(
    fc.oneof(
      fc.string({ unit: 'grapheme' }),
      arb.clusterText(),
      fc.constantFrom('\r\n', '\r', '\n', '\v', '\f', '\u0085', '\u2028', '\u2029'),
      arb.document.map((doc) => render(doc).output),
    ),
    { maxLength: 6 },
  )
  .map((parts) => parts.join(''));

describe('fromText', () => {
  it('is lossless: sourceText(fromText(t)) === normalize(toLf(t))', () => {
    fc.assert(
      fc.property(pasted, (text) => {
        expect(sourceText(fromText(text))).toBe(normalize(toLf(text)));
      }),
    );
  });

  it('always produces a valid document', () => {
    fc.assert(
      fc.property(pasted, (text) => {
        expect(validate(fromText(text))).toEqual([]);
      }),
    );
  });

  it('recovers the source of a rendered document', () => {
    fc.assert(
      fc.property(arb.document, (doc) => {
        expect(sourceText(fromText(render(doc).output))).toBe(sourceText(doc));
      }),
    );
  });

  it('puts the first line in the hook and the rest in the body', () => {
    const doc = fromText('𝐁𝐨𝐥𝐝 opening\r\n\nsecond');
    expect(doc.sections.map((s) => s.kind)).toEqual(['hook', 'body']);
    expect(paragraphsOf(doc).map(paragraphText)).toEqual(['Bold opening', '', 'second']);
    expect(paragraphsOf(doc)[0]?.spans.map((s) => [s.text, [...s.style]])).toEqual([
      ['Bold', ['bold']],
      [' opening', []],
    ]);
  });
});

describe('toLf', () => {
  it('normalizes every line terminator to a line feed', () => {
    expect(toLf('a\r\nb\rc\vd\fe\u0085f\u2028g\u2029h')).toBe('a\nb\nc\nd\ne\nf\ng\nh');
  });
});
