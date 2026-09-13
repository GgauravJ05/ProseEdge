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

  it('takes a two-line opening when a blank line follows it', () => {
    const hookLines = (text: string): string[] => {
      const [hook] = fromText(text).sections;
      return hook?.kind === 'hook' ? hook.paragraphs.map(paragraphText) : [];
    };
    expect(hookLines('one\ntwo\n\nbody')).toEqual(['one', 'two']);
    expect(hookLines('one\n\nbody')).toEqual(['one']);
    expect(hookLines('one\ntwo\nthree\n\nbody')).toEqual(['one']);
    expect(hookLines('\nbody')).toEqual(['']);
  });

  it('reads the renderer’s list markers back as lists', () => {
    /*
     * Every marker the renderer writes has to come back as a list. A marker
     * the renderer emits but this function does not recognise round-trips into
     * plain paragraphs, silently losing the structure — which is exactly what
     * the checklist did until it was added here.
     */
    const doc = fromText(
      'Opening\n\n• 𝐅𝐚𝐬𝐭\n• small\n☐ todo\n☐ later\n1. one\n2. two\n4. four\n- dash\n☑ ticked',
    );
    const [, body] = doc.sections;
    expect(body?.kind).toBe('body');
    if (body?.kind !== 'body') return;
    expect(
      body.blocks.map((block) =>
        block.kind === 'list'
          ? [block.marker, block.items.map(paragraphText)]
          : ['paragraph', paragraphText(block)],
      ),
    ).toEqual([
      ['paragraph', ''],
      ['bullet', ['Fast', 'small']],
      ['checklist', ['todo', 'later']],
      ['numbered', ['one', 'two']],
      ['paragraph', '4. four'],
      ['paragraph', '- dash'],
      // A ticked box is not a marker this app writes, so it stays body text.
      ['paragraph', '☑ ticked'],
    ]);
  });

  it('turns a final line that is only a URL into the call to action', () => {
    const doc = fromText('Opening\nRead more:\n𝐡𝐭𝐭𝐩𝐬://example.com/post');
    expect(doc.sections.map((s) => s.kind)).toEqual(['hook', 'body', 'cta']);
    const cta = doc.sections.at(-1);
    expect(cta?.kind === 'cta' && cta.content.kind === 'link' ? cta.content.url : null).toBe(
      'https://example.com/post',
    );
    expect(fromText('https://example.com').sections.map((s) => s.kind)).toEqual(['hook']);
    expect(fromText('Opening\nsee https://example.com').sections.map((s) => s.kind)).toEqual([
      'hook',
      'body',
    ]);
  });
});

describe('toLf', () => {
  it('normalizes every line terminator to a line feed', () => {
    expect(toLf('a\r\nb\rc\vd\fe\u0085f\u2028g\u2029h')).toBe('a\nb\nc\nd\ne\nf\ng\nh');
  });
});
