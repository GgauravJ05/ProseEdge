// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Tree → Unicode, with codepoint-level provenance (spec §4.1).
 *
 * `render` and `sourceText` share one walker. The only difference is whether
 * spans are styled, which is what makes round-trip (invariant 1) a statement
 * about styling alone: structure is emitted identically in both.
 */

import { glyph, isAsciiAlnum } from './alphabets';
import type { AlphabetId } from './alphabets';
import { marksFor } from './decorations';
import type { Document, ListMarker, NodeId, Paragraph, Span, SpanId, StyleKind } from './grammar';
import { clusters } from './graphemes';
import { resolveStyle } from './style';
import { at } from './util';

/**
 * Where one output codepoint came from. `source` is its UTF-16 offset in
 * `sourceText(doc)`; `offset` is the UTF-16 offset inside the span or link.
 * Structural characters (separators, list markers) have no span, so they carry
 * the node that produced them instead (ADR 0002).
 */
export type Provenance =
  | {
      readonly kind: 'span';
      readonly span: SpanId;
      readonly offset: number;
      readonly source: number;
    }
  | {
      readonly kind: 'link';
      readonly node: NodeId;
      readonly offset: number;
      readonly source: number;
    }
  | { readonly kind: 'structure'; readonly node: NodeId; readonly source: number };

export type CoverageReason =
  /** An ASCII letter or digit this alphabet has no glyph for, e.g. digits in script. */
  | 'no_glyph_in_style'
  /** Punctuation, symbols, emoji, combining sequences: never styled. */
  | 'not_styleable'
  /** A grapheme cluster straddling two spans. Only possible in an invalid document. */
  | 'crosses_span_boundary';

/** A character in a styled span that was emitted unstyled (invariant 5). */
export interface CoverageIssue {
  readonly span: SpanId;
  readonly offset: number;
  readonly text: string;
  readonly reason: CoverageReason;
}

export interface StyleDrop {
  readonly span: SpanId;
  readonly dropped: readonly StyleKind[];
}

export interface ParagraphLayout {
  readonly paragraph: NodeId;
  /** UTF-16 offset of the paragraph's first character in `sourceText(doc)`. */
  readonly source: number;
  readonly length: number;
}

export interface RenderResult {
  readonly output: string;
  /** One entry per output codepoint, in order. */
  readonly provenance: readonly Provenance[];
  readonly coverage: readonly CoverageIssue[];
  readonly drops: readonly StyleDrop[];
  readonly layout: readonly ParagraphLayout[];
  readonly sourceLength: number;
}

/** Blocks, sections and list items are separated by a single line feed (ADR 0002). */
export const SEPARATOR = '\n';

export function listMarker(marker: ListMarker, index: number): string {
  return marker === 'bullet' ? '• ' : `${String(index + 1)}. `;
}

const WHITESPACE = /^\s+$/u;

interface SpanBounds {
  readonly span: Span;
  readonly start: number;
  readonly end: number;
  readonly alphabet: AlphabetId | null;
  /** Combining marks appended to each ASCII letter or digit, or '' for none. */
  readonly marks: string;
}

function run(doc: Document, styled: boolean): RenderResult {
  const parts: string[] = [];
  const provenance: Provenance[] = [];
  const coverage: CoverageIssue[] = [];
  const drops: StyleDrop[] = [];
  const layout: ParagraphLayout[] = [];
  let source = 0;

  const structure = (text: string, node: NodeId): void => {
    for (const ch of text) {
      parts.push(ch);
      provenance.push({ kind: 'structure', node, source });
      source += ch.length;
    }
  };

  const paragraph = (p: Paragraph): void => {
    const bounds: SpanBounds[] = [];
    let text = '';
    for (const span of p.spans) {
      const resolved = resolveStyle(span.style);
      if (styled && resolved.dropped.length > 0) {
        drops.push({ span: span.id, dropped: resolved.dropped });
      }
      const start = text.length;
      text += span.text;
      bounds.push({
        span,
        start,
        end: text.length,
        alphabet: styled ? resolved.alphabet : null,
        marks: styled ? marksFor(resolved.decorations) : '',
      });
    }
    layout.push({ paragraph: p.id, source, length: text.length });

    // Cluster offsets only increase, so the owning span is found with a cursor.
    let cursor = 0;
    const ownerOf = (offset: number): SpanBounds => {
      let b = at(bounds, cursor);
      while (offset >= b.end && cursor < bounds.length - 1) {
        cursor += 1;
        b = at(bounds, cursor);
      }
      return b;
    };

    for (const cluster of clusters(text)) {
      const owner = ownerOf(cluster.index);
      const offset = cluster.index - owner.start;
      let mapped: string | null = null;

      if (owner.alphabet !== null) {
        const issue = (reason: CoverageReason): void => {
          coverage.push({ span: owner.span.id, offset, text: cluster.text, reason });
        };
        if (cluster.index + cluster.text.length > owner.end) {
          issue('crosses_span_boundary');
        } else if (isAsciiAlnum(cluster.text)) {
          mapped = glyph(owner.alphabet, cluster.text);
          if (mapped === null) issue('no_glyph_in_style');
        } else if (!WHITESPACE.test(cluster.text)) {
          issue('not_styleable');
        }
      }

      /*
       * Decorations follow the same coverage rule as the alphabets: only an
       * ASCII letter or digit takes one. Appending a combining mark to an emoji
       * or a ZWJ sequence would modify a cluster that invariant 4 guarantees
       * passes through unmodified, and usually renders broken (ADR 0010).
       */
      const marks = isAsciiAlnum(cluster.text) ? owner.marks : '';

      /*
       * Each mark is its own output codepoint carrying the same `source` as the
       * character it decorates. Provenance stays total and monotonic but is no
       * longer one-to-one, which is invariant 3 as refined in ADR 0010.
       */
      const decorate = (span: SpanId, spanOffset: number): void => {
        for (const mark of marks) {
          parts.push(mark);
          provenance.push({ kind: 'span', span, offset: spanOffset, source });
        }
      };

      if (mapped !== null) {
        parts.push(mapped);
        provenance.push({ kind: 'span', span: owner.span.id, offset, source });
        decorate(owner.span.id, offset);
        source += cluster.text.length;
        continue;
      }

      let at16 = cluster.index;
      for (const ch of cluster.text) {
        const b = ownerOf(at16);
        parts.push(ch);
        provenance.push({ kind: 'span', span: b.span.id, offset: at16 - b.start, source });
        at16 += ch.length;
        // A decorated cluster is a single ASCII character, so this runs once.
        if (marks !== '') decorate(b.span.id, at16 - ch.length - b.start);
        source += ch.length;
      }
    }
  };

  doc.sections.forEach((section, i) => {
    if (i > 0) structure(SEPARATOR, section.id);
    switch (section.kind) {
      case 'hook':
        section.paragraphs.forEach((p, j) => {
          if (j > 0) structure(SEPARATOR, p.id);
          paragraph(p);
        });
        break;
      case 'body':
        section.blocks.forEach((block, j) => {
          if (j > 0) structure(SEPARATOR, block.id);
          if (block.kind === 'paragraph') {
            paragraph(block);
            return;
          }
          block.items.forEach((item, k) => {
            if (k > 0) structure(SEPARATOR, item.id);
            structure(listMarker(block.marker, k), block.id);
            paragraph(item);
          });
        });
        break;
      case 'cta': {
        const content = section.content;
        if (content.kind === 'paragraph') {
          paragraph(content);
          break;
        }
        // URLs are never styled: a styled URL is a broken URL.
        let offset = 0;
        for (const ch of content.url) {
          parts.push(ch);
          provenance.push({ kind: 'link', node: content.id, offset, source });
          offset += ch.length;
          source += ch.length;
        }
        break;
      }
    }
  });

  return { output: parts.join(''), provenance, coverage, drops, layout, sourceLength: source };
}

export function render(doc: Document): RenderResult {
  return run(doc, true);
}

/** The document with every style removed: what a screen reader should hear. */
export function sourceText(doc: Document): string {
  return run(doc, false).output;
}

/**
 * Map a UTF-16 offset in `result.output` (a textarea caret, say) to the matching
 * offset in the source text. An offset inside a surrogate pair rounds forward.
 */
export function sourceOffsetAt(result: RenderResult, outputOffset: number): number {
  let out = 0;
  let i = 0;
  for (const ch of result.output) {
    if (out >= outputOffset) return at(result.provenance, i).source;
    out += ch.length;
    i += 1;
  }
  return result.sourceLength;
}

/** Map a UTF-16 offset in the source text to the matching offset in `result.output`. */
export function outputOffsetAt(result: RenderResult, sourceOffset: number): number {
  let out = 0;
  let i = 0;
  for (const ch of result.output) {
    if (at(result.provenance, i).source >= sourceOffset) return out;
    out += ch.length;
    i += 1;
  }
  return result.output.length;
}
