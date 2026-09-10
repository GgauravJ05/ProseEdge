// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Editor operations as immutable tree rewrites. Every operation preserves
 * `validate(doc)` and leaves `sourceText(doc)` unchanged; styling is the only
 * thing they touch. Ranges snap outward to grapheme cluster boundaries.
 */

import { isAsciiAlnum } from './alphabets';
import { paragraphText, paragraphsOf, randomIds } from './grammar';
import type {
  Block,
  Document,
  IdFactory,
  NodeId,
  Paragraph,
  Section,
  Span,
  StyleKind,
  StyleSet,
} from './grammar';
import { snapDown, snapUp } from './graphemes';
import type { ParagraphLayout } from './render';
import { canonicalStyle, styleEquals } from './style';

/** A range of UTF-16 offsets within one paragraph's text. */
export interface TextRange {
  readonly paragraph: NodeId;
  readonly start: number;
  readonly end: number;
}

export function mapParagraphs(doc: Document, fn: (p: Paragraph) => Paragraph): Document {
  const block = (b: Block): Block =>
    b.kind === 'paragraph' ? fn(b) : { ...b, items: b.items.map(fn) };
  const section = (s: Section): Section => {
    switch (s.kind) {
      case 'hook':
        return { ...s, paragraphs: s.paragraphs.map(fn) };
      case 'body':
        return { ...s, blocks: s.blocks.map(block) };
      case 'cta':
        return s.content.kind === 'paragraph' ? { ...s, content: fn(s.content) } : s;
    }
  };
  return { ...doc, sections: doc.sections.map(section) };
}

/** Merge adjacent spans with equal style and drop empty spans, keeping at least one. */
export function normalizeSpans(p: Paragraph, ids: IdFactory = randomIds): Paragraph {
  const spans: Span[] = [];
  for (const span of p.spans) {
    if (span.text.length === 0) continue;
    const style = canonicalStyle(span.style);
    const last = spans.at(-1);
    if (last !== undefined && styleEquals(last.style, style)) {
      spans[spans.length - 1] = { ...last, text: last.text + span.text };
    } else {
      spans.push({ ...span, style });
    }
  }
  if (spans.length === 0) spans.push({ id: p.spans[0]?.id ?? ids(), text: '', style: new Set() });
  return { ...p, spans };
}

function snapped(p: Paragraph, range: TextRange): { start: number; end: number } {
  const text = paragraphText(p);
  return {
    start: snapDown(text, Math.min(range.start, range.end)),
    end: snapUp(text, Math.max(range.start, range.end)),
  };
}

function restyle(
  doc: Document,
  range: TextRange,
  update: (style: StyleSet) => StyleSet,
  ids: IdFactory,
): Document {
  return mapParagraphs(doc, (p) => {
    if (p.id !== range.paragraph) return p;
    const { start, end } = snapped(p, range);
    if (start >= end) return p;
    const spans: Span[] = [];
    let pos = 0;
    for (const span of p.spans) {
      const from = pos;
      const to = pos + span.text.length;
      pos = to;
      if (to <= start || from >= end) {
        spans.push(span);
        continue;
      }
      const cutStart = Math.max(start, from) - from;
      const cutEnd = Math.min(end, to) - from;
      if (cutStart > 0) spans.push({ ...span, text: span.text.slice(0, cutStart) });
      spans.push({
        id: cutStart > 0 ? ids() : span.id,
        text: span.text.slice(cutStart, cutEnd),
        style: update(span.style),
      });
      if (cutEnd < span.text.length) {
        spans.push({ id: ids(), text: span.text.slice(cutEnd), style: span.style });
      }
    }
    return normalizeSpans({ ...p, spans }, ids);
  });
}

const expand = (kind: StyleKind): StyleKind[] =>
  kind === 'bold_italic' ? ['bold', 'italic'] : [kind];

export function applyStyle(
  doc: Document,
  range: TextRange,
  kind: StyleKind,
  ids: IdFactory = randomIds,
): Document {
  return restyle(doc, range, (style) => canonicalStyle([...style, ...expand(kind)]), ids);
}

export function removeStyle(
  doc: Document,
  range: TextRange,
  kind: StyleKind,
  ids: IdFactory = randomIds,
): Document {
  const remove = new Set(expand(kind));
  return restyle(
    doc,
    range,
    (style) => new Set([...canonicalStyle(style)].filter((k) => !remove.has(k))),
    ids,
  );
}

/** Remove all styling: the one-click "restore accessible text" of spec §7.4. */
export function clearStyles(doc: Document, ids: IdFactory = randomIds): Document {
  return mapParagraphs(doc, (p) =>
    normalizeSpans({ ...p, spans: p.spans.map((s) => ({ ...s, style: new Set() })) }, ids),
  );
}

/**
 * Whether every letter and digit in the range carries `kind`. `'empty'` means
 * the range holds no letters or digits, so the question has no answer.
 */
export function styleState(
  doc: Document,
  range: TextRange,
  kind: StyleKind,
): 'on' | 'off' | 'empty' {
  const p = paragraphsOf(doc).find((x) => x.id === range.paragraph);
  if (p === undefined) return 'empty';
  const { start, end } = snapped(p, range);
  const want = expand(kind);
  let sawLetter = false;
  let pos = 0;
  for (const span of p.spans) {
    const from = pos;
    pos += span.text.length;
    const a = Math.max(start, from);
    const b = Math.min(end, pos);
    if (a >= b || ![...span.text.slice(a - from, b - from)].some(isAsciiAlnum)) continue;
    sawLetter = true;
    const style = canonicalStyle(span.style);
    if (!want.every((k) => style.has(k))) return 'off';
  }
  return sawLetter ? 'on' : 'empty';
}

/** Split a range of source-text offsets into per-paragraph ranges. */
export function rangesFromSource(
  layout: readonly ParagraphLayout[],
  start: number,
  end: number,
): TextRange[] {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return layout.flatMap((l) => {
    const a = Math.max(lo, l.source);
    const b = Math.min(hi, l.source + l.length);
    return a < b ? [{ paragraph: l.paragraph, start: a - l.source, end: b - l.source }] : [];
  });
}

/** Remove `kind` if every letter in the ranges already has it, otherwise apply it. */
export function toggleStyle(
  doc: Document,
  ranges: readonly TextRange[],
  kind: StyleKind,
  ids: IdFactory = randomIds,
): Document {
  const states = ranges.map((r) => styleState(doc, r, kind));
  const active = states.includes('on') && !states.includes('off');
  return ranges.reduce(
    (d, r) => (active ? removeStyle(d, r, kind, ids) : applyStyle(d, r, kind, ids)),
    doc,
  );
}
