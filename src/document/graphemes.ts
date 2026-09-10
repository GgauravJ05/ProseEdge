// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Extended grapheme clusters (UAX #29). Styling decisions are made per cluster,
 * never per code unit or code point, so emoji ZWJ sequences, keycaps, flags and
 * combining marks are never pulled apart (invariant 4, spec §4.2).
 */

import { clamp } from './util';

// Grapheme segmentation is locale-independent; the locale argument is unused.
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export interface Cluster {
  readonly text: string;
  /** UTF-16 offset of the cluster in the segmented string. */
  readonly index: number;
}

export function clusters(text: string): Cluster[] {
  return Array.from(segmenter.segment(text), (s) => ({ text: s.segment, index: s.index }));
}

/** Every UTF-16 offset that is a cluster boundary, including 0 and `text.length`. */
export function boundaries(text: string): Set<number> {
  const out = new Set<number>([text.length]);
  for (const s of segmenter.segment(text)) out.add(s.index);
  return out;
}

/** The nearest cluster boundary at or before `offset`. */
export function snapDown(text: string, offset: number): number {
  const target = clamp(offset, 0, text.length);
  let best = 0;
  for (const b of boundaries(text)) if (b <= target && b > best) best = b;
  return best;
}

/** The nearest cluster boundary at or after `offset`. */
export function snapUp(text: string, offset: number): number {
  const target = clamp(offset, 0, text.length);
  let best = text.length;
  for (const b of boundaries(text)) if (b >= target && b < best) best = b;
  return best;
}
