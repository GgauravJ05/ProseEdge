// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The ProseEdge document grammar (spec §4.1, ordering refined in ADR 0002).
 *
 * ```
 * Document  := Hook? Body* Cta?     -- at least one section
 * Hook      := Paragraph{1,2}
 * Body      := (Paragraph | List)+
 * Cta       := Paragraph | Link
 * Paragraph := Span+
 * ```
 *
 * Span text is the canonical, unstyled source. Styling is metadata applied at
 * render time, so no transform can lose the source.
 */

import { isStyledCodepoint } from './alphabets';
import { isDecorationMark } from './decorations';
import { boundaries } from './graphemes';

export const STYLE_KINDS = [
  'bold',
  'italic',
  'bold_italic',
  'monospace',
  'script',
  'fraktur',
  'doublestruck',
  'sans',
  // Drawn with a combining mark rather than a substitute alphabet, so these
  // compose with any family above (ADR 0010).
  'underline',
  'strikethrough',
] as const;
export type StyleKind = (typeof STYLE_KINDS)[number];
export type StyleSet = ReadonlySet<StyleKind>;

export type SpanId = string;
export type NodeId = string;

export interface Span {
  readonly id: SpanId;
  /** Canonical source text. Never mutated by styling. */
  readonly text: string;
  readonly style: StyleSet;
}

export interface Paragraph {
  readonly kind: 'paragraph';
  readonly id: NodeId;
  readonly spans: readonly Span[];
}

/**
 * Bulleted, numbered, or a checklist.
 *
 * A checklist uses U+2610 BALLOT BOX, a single codepoint the formatter never
 * styles and `normalize` leaves alone — the same terms the bullet already sits
 * on, so a checklist survives a round-trip like any other list.
 */
export type ListMarker = 'bullet' | 'numbered' | 'checklist';

export interface List {
  readonly kind: 'list';
  readonly id: NodeId;
  readonly marker: ListMarker;
  readonly items: readonly Paragraph[];
}

export interface Link {
  readonly kind: 'link';
  readonly id: NodeId;
  readonly url: string;
}

export interface Hook {
  readonly kind: 'hook';
  readonly id: NodeId;
  readonly paragraphs: readonly Paragraph[];
}

export type Block = Paragraph | List;

export interface Body {
  readonly kind: 'body';
  readonly id: NodeId;
  readonly blocks: readonly Block[];
}

export interface Cta {
  readonly kind: 'cta';
  readonly id: NodeId;
  readonly content: Paragraph | Link;
}

export type Section = Hook | Body | Cta;

export interface Document {
  readonly sections: readonly Section[];
}

export type IdFactory = () => string;

export const randomIds: IdFactory = () => globalThis.crypto.randomUUID();

export function sequentialIds(prefix = 'n'): IdFactory {
  let next = 0;
  return () => `${prefix}${String(next++)}`;
}

const LINE_TERMINATOR = /[\n\v\f\r\u0085\u2028\u2029]/u;

/** Line structure lives in the tree, so span text may not contain a line terminator. */
export function hasLineTerminator(text: string): boolean {
  return LINE_TERMINATOR.test(text);
}

export function paragraphText(p: Paragraph): string {
  return p.spans.map((s) => s.text).join('');
}

/** Every paragraph in document order, including list items and a paragraph CTA. */
export function paragraphsOf(doc: Document): Paragraph[] {
  const out: Paragraph[] = [];
  for (const section of doc.sections) {
    switch (section.kind) {
      case 'hook':
        out.push(...section.paragraphs);
        break;
      case 'body':
        for (const block of section.blocks) {
          if (block.kind === 'paragraph') out.push(block);
          else out.push(...block.items);
        }
        break;
      case 'cta':
        if (section.content.kind === 'paragraph') out.push(section.content);
        break;
    }
  }
  return out;
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Check a document against the grammar and the canonical-source rules. An empty
 * result means every §4.2 invariant is guaranteed to hold for it.
 */
export function validate(doc: Document): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const report = (path: string, message: string): void => {
    issues.push({ path, message });
  };
  const claim = (id: string, path: string): void => {
    if (seen.has(id)) report(path, `duplicate id "${id}"`);
    seen.add(id);
  };

  const checkText = (text: string, path: string): void => {
    if (hasLineTerminator(text)) {
      report(path, 'contains a line terminator; line structure belongs in the tree');
    }
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      /*
       * A decoration mark is output, not source: leaving one in span text would
       * make it survive `normalize` and break round-trip, the same way a styled
       * codepoint would.
       */
      if (isDecorationMark(ch)) {
        const hex = cp.toString(16).toUpperCase();
        report(path, `contains decoration mark U+${hex}; source text must be unstyled`);
        break;
      }
      if (isStyledCodepoint(cp)) {
        const hex = cp.toString(16).toUpperCase();
        report(path, `contains styled codepoint U+${hex}; source text must be unstyled`);
        break;
      }
    }
  };

  const checkParagraph = (p: Paragraph, path: string): void => {
    claim(p.id, path);
    if (p.spans.length === 0) report(path, 'a paragraph needs at least one span');
    const bounds = boundaries(paragraphText(p));
    let offset = 0;
    p.spans.forEach((span, i) => {
      const spanPath = `${path}.spans[${String(i)}]`;
      claim(span.id, spanPath);
      checkText(span.text, spanPath);
      if (span.text.length === 0 && p.spans.length > 1) {
        report(spanPath, 'empty span alongside other spans');
      }
      if (i > 0 && !bounds.has(offset)) report(spanPath, 'span starts inside a grapheme cluster');
      offset += span.text.length;
    });
  };

  if (doc.sections.length === 0) report('sections', 'a document needs at least one section');

  doc.sections.forEach((section, i) => {
    const path = `sections[${String(i)}]`;
    claim(section.id, path);
    switch (section.kind) {
      case 'hook':
        if (i !== 0) report(path, 'the hook must be the first section');
        if (section.paragraphs.length < 1 || section.paragraphs.length > 2) {
          report(path, 'a hook has one or two paragraphs');
        }
        section.paragraphs.forEach((p, j) => {
          checkParagraph(p, `${path}.paragraphs[${String(j)}]`);
        });
        break;
      case 'body':
        if (section.blocks.length === 0) report(path, 'a body needs at least one block');
        section.blocks.forEach((block, j) => {
          const blockPath = `${path}.blocks[${String(j)}]`;
          if (block.kind === 'paragraph') {
            checkParagraph(block, blockPath);
            return;
          }
          claim(block.id, blockPath);
          if (block.items.length === 0) report(blockPath, 'a list needs at least one item');
          block.items.forEach((item, k) => {
            checkParagraph(item, `${blockPath}.items[${String(k)}]`);
          });
        });
        break;
      case 'cta': {
        if (i !== doc.sections.length - 1)
          report(path, 'the call to action must be the last section');
        const content = section.content;
        const contentPath = `${path}.content`;
        if (content.kind === 'paragraph') {
          checkParagraph(content, contentPath);
          break;
        }
        claim(content.id, contentPath);
        checkText(content.url, contentPath);
        if (content.url.length === 0 || /\s/u.test(content.url)) {
          report(contentPath, 'a link needs a non-empty URL without whitespace');
        }
        break;
      }
    }
  });

  return issues;
}

/** Terse constructors for tests, fixtures and importers. */
export function builder(ids: IdFactory = randomIds) {
  const span = (text: string, style: Iterable<StyleKind> = []): Span => ({
    id: ids(),
    text,
    style: new Set(style),
  });
  const paragraph = (...spans: (Span | string)[]): Paragraph => ({
    kind: 'paragraph',
    id: ids(),
    spans:
      spans.length === 0 ? [span('')] : spans.map((s) => (typeof s === 'string' ? span(s) : s)),
  });
  return {
    span,
    paragraph,
    list: (marker: ListMarker, ...items: Paragraph[]): List => ({
      kind: 'list',
      id: ids(),
      marker,
      items,
    }),
    link: (url: string): Link => ({ kind: 'link', id: ids(), url }),
    hook: (...paragraphs: Paragraph[]): Hook => ({ kind: 'hook', id: ids(), paragraphs }),
    body: (...blocks: Block[]): Body => ({ kind: 'body', id: ids(), blocks }),
    cta: (content: Paragraph | Link): Cta => ({ kind: 'cta', id: ids(), content }),
    document: (...sections: Section[]): Document => ({ sections }),
  };
}
