// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Formatter commands (roadmap M1): the toolbar and typing behaviour as pure
 * functions over the document model, so each one is tested without a browser.
 */

import {
  applyStyle,
  canonicalStyle,
  fromText,
  isAsciiAlnum,
  isStyledCodepoint,
  paragraphText,
  paragraphsOf,
  randomIds,
  rangesFromSource,
  removeStyle,
  render,
  snapDown,
  snapUp,
  sourceOffsetAt,
  toggleStyle,
} from '../document';
import type { Document, IdFactory, RenderResult, StyleSet, TextRange } from '../document';

export const FAMILIES = ['serif', 'sans', 'script', 'monospace'] as const;
export type Family = (typeof FAMILIES)[number];
export type Emphasis = 'bold' | 'italic';

const FAMILY_KINDS = ['sans', 'script', 'monospace'] as const;
const EMPHASES: readonly Emphasis[] = ['bold', 'italic'];

/** The family a style renders in, using the renderer's precedence (ADR 0002). */
export function familyOf(style: StyleSet): Family {
  const s = canonicalStyle(style);
  if (s.has('monospace')) return 'monospace';
  if (s.has('script')) return 'script';
  if (s.has('sans')) return 'sans';
  return 'serif';
}

/** Whether Unicode has an alphabet for `emphasis` in `family`. */
export function supports(family: Family, emphasis: Emphasis): boolean {
  switch (family) {
    case 'serif':
    case 'sans':
      return true;
    case 'script':
      return emphasis === 'bold';
    case 'monospace':
      return false;
  }
}

export type EmphasisState = 'on' | 'off' | 'empty';

export interface SelectionState {
  /** Families of the letters and digits in the selection; empty if it has none. */
  readonly families: ReadonlySet<Family>;
  readonly bold: EmphasisState;
  readonly italic: EmphasisState;
}

/** What the toolbar should show for a selection. Only letters and digits count. */
export function selectionState(doc: Document, ranges: readonly TextRange[]): SelectionState {
  const families = new Set<Family>();
  let bold = true;
  let italic = true;
  const paragraphs = new Map(paragraphsOf(doc).map((p) => [p.id, p]));
  for (const range of ranges) {
    const p = paragraphs.get(range.paragraph);
    if (p === undefined) continue;
    const text = paragraphText(p);
    const start = snapDown(text, Math.min(range.start, range.end));
    const end = snapUp(text, Math.max(range.start, range.end));
    let pos = 0;
    for (const span of p.spans) {
      const from = pos;
      pos += span.text.length;
      const a = Math.max(start, from);
      const b = Math.min(end, pos);
      if (a >= b || ![...span.text.slice(a - from, b - from)].some(isAsciiAlnum)) continue;
      const style = canonicalStyle(span.style);
      families.add(familyOf(style));
      bold &&= style.has('bold');
      italic &&= style.has('italic');
    }
  }
  if (families.size === 0) return { families, bold: 'empty', italic: 'empty' };
  return { families, bold: bold ? 'on' : 'off', italic: italic ? 'on' : 'off' };
}

/** Whether `emphasis` can be applied to every family in the selection. */
export function canEmphasize(state: SelectionState, emphasis: Emphasis): boolean {
  return state.families.size > 0 && [...state.families].every((f) => supports(f, emphasis));
}

/**
 * Render the ranges in `family`. Emphasis the family cannot express is removed
 * rather than left for the renderer to drop, so what the toolbar shows is what
 * the output contains.
 */
export function setFamily(
  doc: Document,
  ranges: readonly TextRange[],
  family: Family,
  ids: IdFactory = randomIds,
): Document {
  return ranges.reduce((current, range) => {
    let next = current;
    for (const kind of FAMILY_KINDS) {
      if (kind !== family) next = removeStyle(next, range, kind, ids);
    }
    for (const emphasis of EMPHASES) {
      if (!supports(family, emphasis)) next = removeStyle(next, range, emphasis, ids);
    }
    return family === 'serif' ? next : applyStyle(next, range, family, ids);
  }, doc);
}

/** Toggle bold or italic, or return `doc` unchanged if a family cannot express it. */
export function toggleEmphasis(
  doc: Document,
  ranges: readonly TextRange[],
  emphasis: Emphasis,
  ids: IdFactory = randomIds,
): Document {
  return canEmphasize(selectionState(doc, ranges), emphasis)
    ? toggleStyle(doc, ranges, emphasis, ids)
    : doc;
}

const isHighSurrogate = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff;
const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

export interface EditBounds {
  /** UTF-16 offset where the two strings start to differ. */
  readonly start: number;
  /** End of the replaced text in `before`. */
  readonly beforeEnd: number;
  /** End of the inserted text in `after`. */
  readonly afterEnd: number;
}

/** The single contiguous edit turning `before` into `after`, never splitting a surrogate pair. */
export function editBounds(before: string, after: string): EditBounds {
  const limit = Math.min(before.length, after.length);
  let start = 0;
  while (start < limit && before.charCodeAt(start) === after.charCodeAt(start)) start += 1;
  if (start > 0 && isHighSurrogate(after.charCodeAt(start - 1))) start -= 1;
  let suffix = 0;
  while (
    suffix < limit - start &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  if (suffix > 0 && isLowSurrogate(after.charCodeAt(after.length - suffix))) suffix -= 1;
  return { start, beforeEnd: before.length - suffix, afterEnd: after.length - suffix };
}

function styleBefore(doc: Document, rendered: RenderResult, outputOffset: number): StyleSet {
  let end = 0;
  let index = 0;
  for (const ch of rendered.output) {
    end += ch.length;
    if (end >= outputOffset) break;
    index += 1;
  }
  const entry = outputOffset === 0 || end !== outputOffset ? undefined : rendered.provenance[index];
  if (entry?.kind !== 'span') return new Set();
  for (const p of paragraphsOf(doc)) {
    const span = p.spans.find((s) => s.id === entry.span);
    if (span !== undefined) return span.style;
  }
  return new Set();
}

/**
 * The document after the user edits the rendered text directly.
 *
 * `after` is re-imported, which recovers styles from the codepoints. Plain text
 * the user typed then takes the style of the character just before it, as in a
 * word processor; text that arrives already styled, such as a paste, keeps its
 * own. Returns `before` itself when nothing changed.
 */
export function applyEdit(
  before: Document,
  rendered: RenderResult,
  after: string,
  ids: IdFactory = randomIds,
): Document {
  if (after === rendered.output) return before;
  const next = fromText(after, ids);
  const { start, afterEnd } = editBounds(rendered.output, after);
  const inserted = after.slice(start, afterEnd);
  if (
    inserted.length === 0 ||
    [...inserted].some((ch) => isStyledCodepoint(ch.codePointAt(0) ?? 0))
  ) {
    return next;
  }
  const style = styleBefore(before, rendered, start);
  const result = render(next);
  // Typing Enter and then a letter starts the new line unstyled, so a single
  // edit containing a line break behaves the same: only text before it inherits.
  const lineBreak = inserted.indexOf('\n');
  const inheritEnd = lineBreak === -1 ? afterEnd : start + lineBreak;
  // Offsets are only comparable when re-import reproduced the text exactly
  // (it does not for, say, a carriage return, which becomes a line feed).
  if (style.size === 0 || inheritEnd === start || result.output !== after) return next;
  const ranges = rangesFromSource(
    result.layout,
    sourceOffsetAt(result, start),
    sourceOffsetAt(result, inheritEnd),
  );
  let styled = next;
  for (const kind of style) {
    for (const range of ranges) styled = applyStyle(styled, range, kind, ids);
  }
  return styled;
}
