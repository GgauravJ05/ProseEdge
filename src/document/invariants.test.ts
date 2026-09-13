// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The five transform invariants of spec §4.2, property-tested over generated
 * documents. Phase 1 exits when this file passes (spec §11).
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import * as arb from './__fixtures__/arbitraries';
import { glyph, isAsciiAlnum, isStyledCodepoint } from './alphabets';
import { paragraphsOf, sequentialIds, validate } from './grammar';
import { clusters } from './graphemes';
import { normalize } from './normalize';
import { applyStyle, clearStyles, removeStyle } from './ops';
import { outputOffsetAt, render, sourceText } from './render';
import type { CoverageIssue, Provenance, RenderResult } from './render';
import { resolveStyle } from './style';
import { at } from './util';

const WHITESPACE = /^\s+$/u;

/** The rendered text for a range of source offsets. */
function emitted(result: RenderResult, from: number, to: number): string {
  return result.output.slice(outputOffsetAt(result, from), outputOffsetAt(result, to));
}

describe('document invariants (spec §4.2)', () => {
  /*
   * The generator's clusters stand in for text a person could type or paste,
   * and span text is the canonical unstyled source — so a cluster the formatter
   * can emit is not valid source, and `validate` rejects any document holding
   * one. Adding an alphabet turns codepoints that were inert into output, which
   * silently falsifies this. Checking it here names the offending character
   * instead of leaving it to surface as unrelated property failures elsewhere.
   */
  it('every generated cluster is legitimate source, never something we emit', () => {
    const styled = arb.CLUSTERS.filter((cluster) =>
      [...cluster].some((ch) => isStyledCodepoint(ch.codePointAt(0) ?? -1)),
    );
    expect(styled).toEqual([]);
  });

  it('generated documents satisfy the grammar', () => {
    fc.assert(
      fc.property(arb.document, (doc) => {
        expect(validate(doc)).toEqual([]);
      }),
    );
  });

  it('1. round-trip: normalize(render(doc)) === sourceText(doc)', () => {
    fc.assert(
      fc.property(arb.document, (doc) => {
        expect(normalize(render(doc).output)).toBe(sourceText(doc));
      }),
    );
  });

  it('2. idempotence: applying or removing a style twice equals doing it once', () => {
    fc.assert(
      fc.property(arb.documentWithRange, arb.styleKind, ({ doc, range }, kind) => {
        const ids = sequentialIds('op');
        const applied = applyStyle(doc, range, kind, ids);
        expect(arb.withoutIds(applyStyle(applied, range, kind, ids))).toEqual(
          arb.withoutIds(applied),
        );
        const removed = removeStyle(doc, range, kind, ids);
        expect(arb.withoutIds(removeStyle(removed, range, kind, ids))).toEqual(
          arb.withoutIds(removed),
        );
        const cleared = clearStyles(doc, ids);
        expect(arb.withoutIds(clearStyles(cleared, ids))).toEqual(arb.withoutIds(cleared));
      }),
    );
  });

  it('3. provenance totality: every output code point maps to exactly one source code point', () => {
    fc.assert(
      fc.property(arb.document, (doc) => {
        const result = render(doc);
        const source = sourceText(doc);
        const output = [...result.output];
        const sourceChars = [...source];
        expect(result.provenance).toHaveLength(output.length);
        expect(sourceChars).toHaveLength(output.length);
        expect(result.sourceLength).toBe(source.length);

        const spans = new Map(
          paragraphsOf(doc)
            .flatMap((p) => p.spans)
            .map((s) => [s.id, s.text]),
        );
        const links = new Map(
          doc.sections.flatMap((s) =>
            s.kind === 'cta' && s.content.kind === 'link' ? [[s.content.id, s.content.url]] : [],
          ),
        );

        /** The source character a provenance entry claims; structure is never styled. */
        const claimed = (p: Provenance, ch: string, length: number): string | undefined => {
          switch (p.kind) {
            case 'span':
              return spans.get(p.span)?.slice(p.offset, p.offset + length);
            case 'link':
              return links.get(p.node)?.slice(p.offset, p.offset + length);
            case 'structure':
              return ch;
          }
        };

        let offset = 0;
        output.forEach((ch, i) => {
          const p = at(result.provenance, i);
          const src = at(sourceChars, i);
          expect(p.source).toBe(offset);
          expect(normalize(ch)).toBe(src);
          expect(claimed(p, ch, src.length)).toBe(src);
          offset += src.length;
        });
      }),
    );
  });

  it('4. grapheme safety: clusters other than ASCII letters and digits pass through unmodified', () => {
    fc.assert(
      fc.property(arb.document, (doc) => {
        const result = render(doc);
        const source = sourceText(doc);
        expect(clusters(result.output)).toHaveLength(clusters(source).length);
        for (const c of clusters(source)) {
          if (isAsciiAlnum(c.text)) continue;
          expect(emitted(result, c.index, c.index + c.text.length)).toBe(c.text);
        }
      }),
    );
  });

  it('5. coverage honesty: every unstyled character in a styled span is reported, nothing else is', () => {
    fc.assert(
      fc.property(arb.document, (doc) => {
        const result = render(doc);
        const paragraphs = paragraphsOf(doc);
        expect(result.layout.map((l) => l.paragraph)).toEqual(paragraphs.map((p) => p.id));

        const expected: CoverageIssue[] = [];
        paragraphs.forEach((p, i) => {
          let start = at(result.layout, i).source;
          for (const span of p.spans) {
            const { alphabet } = resolveStyle(span.style);
            for (const c of clusters(span.text)) {
              const out = emitted(result, start + c.index, start + c.index + c.text.length);
              const styled = alphabet === null ? null : glyph(alphabet, c.text);
              // Either the exact glyph, or left as source: never a lookalike.
              expect(out).toBe(styled ?? c.text);
              if (styled !== null || alphabet === null || WHITESPACE.test(c.text)) continue;
              expected.push({
                span: span.id,
                offset: c.index,
                text: c.text,
                reason: isAsciiAlnum(c.text) ? 'no_glyph_in_style' : 'not_styleable',
              });
            }
            start += span.text.length;
          }
        });
        expect(result.coverage).toEqual(expected);
      }),
    );
  });
});
