// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * fast-check generators for valid documents.
 *
 * Text is assembled from whole grapheme clusters that never combine with a
 * neighbour, so span boundaries always land on cluster boundaries. The
 * "generated documents are valid" property in invariants.test.ts holds the
 * generator to that.
 */

import fc from 'fast-check';

import { STYLE_KINDS, builder, paragraphText, paragraphsOf, sequentialIds } from '../grammar';
import type { Document, ListMarker, Section, StyleKind } from '../grammar';
import type { TextRange } from '../ops';
import { at } from '../util';

/** Clusters chosen to break naive Unicode stylers. */
export const CLUSTERS: readonly string[] = [
  // ASCII letters and digits: the only characters ProseEdge styles. `h`, `B`,
  // `e`, `g` and `o` exercise the Letterlike Symbols exceptions.
  ...Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
  // Whitespace and punctuation, excluding line terminators.
  ' ',
  '\t',
  '\u00A0',
  '.',
  ',',
  '!',
  '?',
  '-',
  "'",
  '#',
  '@',
  '/',
  // Precomposed and combining accents.
  'é',
  'e\u0301',
  'n\u0303',
  // Emoji: plain, skin-tone modifier, ZWJ sequence, flag, keycap, VS16.
  '👍',
  '👍🏽',
  '👩\u200D💻',
  '🇮🇳',
  '1\uFE0F\u20E3',
  '❤\uFE0F',
  // Right-to-left and CJK.
  'ש',
  'م',
  '漢',
  // NFKC folds these, ProseEdge must not: ligature, fullwidth, superscript.
  'ﬁ',
  'Ａ',
  '²',
  // Mathematical and Letterlike codepoints ProseEdge never emits, so they are
  // legitimate source: bold capital alpha, double-struck A, degree Celsius.
  '\u{1D6A8}',
  '\u{1D538}',
  '℃',
  // A lone surrogate, as a textarea can produce mid-edit.
  '\uD800',
];

export const clusterText = (maxLength = 12): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...CLUSTERS), { minLength: 1, maxLength })
    .map((parts) => parts.join(''));

export const styleKind: fc.Arbitrary<StyleKind> = fc.constantFrom(...STYLE_KINDS);

interface SpanData {
  readonly text: string;
  readonly style: readonly StyleKind[];
}
type ParagraphData = readonly SpanData[];
type BlockData =
  | { readonly kind: 'paragraph'; readonly spans: ParagraphData }
  | {
      readonly kind: 'list';
      readonly marker: ListMarker;
      readonly items: readonly ParagraphData[];
    };
type CtaData =
  | { readonly kind: 'paragraph'; readonly spans: ParagraphData }
  | { readonly kind: 'link'; readonly url: string };
interface DocumentData {
  readonly hook: readonly ParagraphData[] | null;
  readonly bodies: readonly (readonly BlockData[])[];
  readonly cta: CtaData | null;
}

const paragraphData: fc.Arbitrary<ParagraphData> = fc.oneof(
  { weight: 1, arbitrary: fc.constant<ParagraphData>([]) },
  {
    weight: 9,
    arbitrary: fc.array(fc.record({ text: clusterText(), style: fc.subarray([...STYLE_KINDS]) }), {
      minLength: 1,
      maxLength: 4,
    }),
  },
);

const blockData: fc.Arbitrary<BlockData> = fc.oneof(
  paragraphData.map((spans) => ({ kind: 'paragraph' as const, spans })),
  fc.record({
    kind: fc.constant('list' as const),
    marker: fc.constantFrom<ListMarker>('bullet', 'numbered'),
    items: fc.array(paragraphData, { minLength: 1, maxLength: 3 }),
  }),
);

const ctaData: fc.Arbitrary<CtaData> = fc.oneof(
  paragraphData.map((spans) => ({ kind: 'paragraph' as const, spans })),
  fc.webUrl().map((url) => ({ kind: 'link' as const, url })),
);

function build(data: DocumentData): Document {
  const b = builder(sequentialIds());
  const paragraph = (spans: ParagraphData) =>
    b.paragraph(...spans.map((s) => b.span(s.text, s.style)));
  const sections: Section[] = [];
  if (data.hook !== null) sections.push(b.hook(...data.hook.map(paragraph)));
  for (const blocks of data.bodies) {
    sections.push(
      b.body(
        ...blocks.map((block) =>
          block.kind === 'paragraph'
            ? paragraph(block.spans)
            : b.list(block.marker, ...block.items.map(paragraph)),
        ),
      ),
    );
  }
  if (data.cta !== null) {
    sections.push(
      b.cta(data.cta.kind === 'paragraph' ? paragraph(data.cta.spans) : b.link(data.cta.url)),
    );
  }
  return b.document(...sections);
}

export const document: fc.Arbitrary<Document> = fc
  .record({
    hook: fc.option(fc.array(paragraphData, { minLength: 1, maxLength: 2 })),
    bodies: fc.array(fc.array(blockData, { minLength: 1, maxLength: 3 }), { maxLength: 2 }),
    cta: fc.option(ctaData),
  })
  .filter((d) => d.hook !== null || d.bodies.length > 0 || d.cta !== null)
  .map(build);

/** A document with at least one paragraph, and a range inside one of them. */
export const documentWithRange: fc.Arbitrary<{ doc: Document; range: TextRange }> = document
  .filter((doc) => paragraphsOf(doc).length > 0)
  .chain((doc) => {
    const paragraphs = paragraphsOf(doc);
    return fc.tuple(fc.nat(), fc.nat(), fc.nat()).map(([which, a, b]) => {
      const p = at(paragraphs, which % paragraphs.length);
      const length = paragraphText(p).length + 1;
      return { doc, range: { paragraph: p.id, start: a % length, end: b % length } };
    });
  });

/** A value with every `id` removed and sets sorted, for comparing documents by content. */
export function withoutIds(value: unknown): unknown {
  if (value instanceof Set) return Array.from(value, String).sort();
  if (Array.isArray(value)) return value.map(withoutIds);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id')
        .map(([key, v]) => [key, withoutIds(v)]),
    );
  }
  return value;
}
