// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Bulleted and numbered list commands. They edit the post's text, adding or
 * removing exactly the markers the renderer writes (`• ` and `1. `), so
 * `fromText` reads consecutive marked lines in the body back as a list
 * (spec §4.1) without changing a character.
 */

import { listMarker } from '../document';
import type { ListMarker } from '../document';

/** New text, and the UTF-16 range of the lines that changed. */
export interface TextEdit {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

const BULLET = listMarker('bullet', 0);
const CHECKLIST = listMarker('checklist', 0);
const NUMBERED = /^\d+\. /u;

export function markerOf(line: string): ListMarker | null {
  if (line.startsWith(BULLET)) return 'bullet';
  if (line.startsWith(CHECKLIST)) return 'checklist';
  return NUMBERED.test(line) ? 'numbered' : null;
}

function withoutMarker(line: string): string {
  if (line.startsWith(BULLET)) return line.slice(BULLET.length);
  if (line.startsWith(CHECKLIST)) return line.slice(CHECKLIST.length);
  const match = NUMBERED.exec(line);
  return match === null ? line : line.slice(match[0].length);
}

const isBlank = (line: string): boolean => line.trim().length === 0;

/**
 * Toggle `marker` on the lines a selection touches (the caret's line when it is
 * collapsed). If every non-blank line already has that marker it is removed;
 * otherwise any other marker is replaced. Numbering restarts after a blank line.
 */
export function toggleList(text: string, start: number, end: number, marker: ListMarker): TextEdit {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const lines = text.split('\n');
  let first = -1;
  let last = -1;
  let offset = 0;
  lines.forEach((line, index) => {
    const lineEnd = offset + line.length;
    const touched = lo === hi ? offset <= lo && lo <= lineEnd : offset < hi && lineEnd + 1 > lo;
    if (touched) {
      if (first === -1) first = index;
      last = index;
    }
    offset = lineEnd + 1;
  });
  if (first === -1) return { text, start: lo, end: hi };

  const block = lines.slice(first, last + 1);
  const content = block.filter((line) => !isBlank(line));
  const remove = content.length > 0 && content.every((line) => markerOf(line) === marker);
  let number = 0;
  const replaced = block.map((line) => {
    if (isBlank(line)) {
      number = 0;
      return line;
    }
    const body = withoutMarker(line);
    if (remove) return body;
    const next = listMarker(marker, number) + body;
    number += 1;
    return next;
  });

  const head = lines.slice(0, first);
  const tail = lines.slice(last + 1);
  const prefix = head.length === 0 ? '' : `${head.join('\n')}\n`;
  const joined = replaced.join('\n');
  const suffix = tail.length === 0 ? '' : `\n${tail.join('\n')}`;
  return {
    text: prefix + joined + suffix,
    start: prefix.length,
    end: prefix.length + joined.length,
  };
}
