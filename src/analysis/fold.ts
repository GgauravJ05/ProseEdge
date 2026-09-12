// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The "…see more" fold (spec §3, analysis layer): which part of a post shows
 * before a feed collapses it.
 *
 * Lines are wrapped by measured width, not by character count, because styled
 * letters, emoji and CJK are all wider or narrower than ASCII. Measurement is
 * injected: the browser passes canvas text metrics, tests pass a fixed-width
 * measure.
 */

import { clusters } from '../document';

/** The rendered width of `text`, in the same unit as `FoldRule.width`. */
export type Measure = (text: string) => number;

export interface FoldRule {
  readonly width: number;
  readonly lines: number;
  readonly font: string;
  readonly ellipsis: string;
}

/**
 * A placeholder, not a measurement. LinkedIn's desktop feed appears to collapse
 * a post after about three lines, but the column width, font and exact rule
 * have not been measured, so the preview that uses this stays behind the
 * `foldPreview` flag (roadmap M2) until they are.
 */
export const FEED_ESTIMATE: FoldRule = {
  width: 552,
  lines: 3,
  font: '14px -apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
  ellipsis: '…see more',
};

/** Break text that has no spaces at the last grapheme cluster that still fits. */
function breakWord(word: string, width: number, measure: Measure): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const { text } of clusters(word)) {
    if (current !== '' && measure(current + text) > width) {
      pieces.push(current);
      current = text;
    } else {
      current += text;
    }
  }
  pieces.push(current);
  return pieces;
}

/**
 * Greedy word wrap. Each input line becomes one or more visual lines; an empty
 * input line stays one empty visual line. Trailing spaces never cause a wrap.
 */
export function wrap(text: string, width: number, measure: Measure): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const tokens = line.match(/\s*\S+\s*|\s+/gu) ?? [''];
    let current = '';
    for (const token of tokens) {
      if (current === '' || measure((current + token).trimEnd()) <= width) {
        current += token;
      } else {
        out.push(current.trimEnd());
        current = token.trimStart();
      }
      if (measure(current.trimEnd()) > width) {
        const pieces = breakWord(current.trimEnd(), width, measure);
        out.push(...pieces.slice(0, -1));
        current = pieces.at(-1) ?? '';
      }
    }
    out.push(current.trimEnd());
  }
  return out;
}

export interface Fold {
  /** What shows before the fold, without the ellipsis. */
  readonly visible: string;
  /** Whether the feed would collapse the post. */
  readonly truncated: boolean;
}

export function fold(text: string, rule: FoldRule, measure: Measure): Fold {
  const lines = wrap(text, rule.width, measure);
  if (lines.length <= rule.lines) return { visible: text, truncated: false };
  const shown = lines.slice(0, rule.lines);
  let last = shown.pop() ?? '';
  const pieces = clusters(last).map((c) => c.text);
  while (pieces.length > 0 && measure(last + rule.ellipsis) > rule.width) {
    pieces.pop();
    last = pieces.join('').trimEnd();
  }
  return { visible: [...shown, last].join('\n'), truncated: true };
}
