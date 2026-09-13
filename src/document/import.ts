// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { builder, randomIds } from './grammar';
import type { Block, Document, IdFactory, ListMarker, Paragraph, Section } from './grammar';
import { normalize, parseStyled } from './normalize';
import { listMarker } from './render';

/** Normalize every line terminator to a line feed. */
export function toLf(text: string): string {
  return text.replace(/\r\n|[\r\v\f\u0085\u2028\u2029]/gu, '\n');
}

const URL_LINE = /^https?:\/\/\S+$/u;
const isBlank = (line: string): boolean => line.trim().length === 0;

/** The list starting at `lines[start]`: consecutive lines carrying the renderer's own markers. */
function listAt(
  lines: readonly string[],
  start: number,
): { marker: ListMarker; items: string[] } | null {
  const first = lines[start] ?? '';
  const marker: ListMarker | null = first.startsWith(listMarker('bullet', 0))
    ? 'bullet'
    : first.startsWith(listMarker('checklist', 0))
      ? 'checklist'
      : first.startsWith(listMarker('numbered', 0))
        ? 'numbered'
        : null;
  if (marker === null) return null;
  const items: string[] = [];
  for (let k = 0; start + k < lines.length; k += 1) {
    const prefix = listMarker(marker, k);
    const line = lines[start + k] ?? '';
    if (!line.startsWith(prefix)) break;
    items.push(line.slice(prefix.length));
  }
  return { marker, items };
}

/**
 * Build a document from plain or already-styled text, one paragraph per line,
 * recovering the post's structure (spec §4.1):
 *
 * - **Hook:** the lines before the first blank line when there are one or two
 *   of them, otherwise the first line.
 * - **Call to action:** a final line that is nothing but a URL.
 * - **Lists:** consecutive body lines starting with exactly the markers the
 *   renderer writes (`• `, `☐ `, or `1. `, `2. `, … in order).
 * - Everything else is a body paragraph; blank lines are empty paragraphs.
 *
 * Structure only decides where text lives, never what it is, so import is
 * lossless: `sourceText(fromText(t)) === normalize(toLf(t))` for every `t`.
 */
export function fromText(text: string, ids: IdFactory = randomIds): Document {
  const b = builder(ids);
  const toParagraph = (line: string): Paragraph =>
    b.paragraph(...parseStyled(line).map((run) => b.span(run.text, run.style)));
  const lines = toLf(text).split('\n');

  const blank = lines.findIndex(isBlank);
  const hookLength = blank === 1 || blank === 2 ? blank : 1;
  const lastLine = lines.at(-1) ?? '';
  const url = lines.length > hookLength ? normalize(lastLine) : '';
  const hasCta = URL_LINE.test(url);
  const bodyLines = lines.slice(hookLength, hasCta ? -1 : undefined);

  const blocks: Block[] = [];
  for (let i = 0; i < bodyLines.length;) {
    const list = listAt(bodyLines, i);
    if (list === null) {
      blocks.push(toParagraph(bodyLines[i] ?? ''));
      i += 1;
    } else {
      blocks.push(b.list(list.marker, ...list.items.map(toParagraph)));
      i += list.items.length;
    }
  }

  const sections: Section[] = [b.hook(...lines.slice(0, hookLength).map(toParagraph))];
  if (blocks.length > 0) sections.push(b.body(...blocks));
  if (hasCta) sections.push(b.cta(b.link(url)));
  return b.document(...sections);
}
