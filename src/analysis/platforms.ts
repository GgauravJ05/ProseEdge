// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Where a post is going, and what that costs.
 *
 * Platforms differ in two ways that matter to a formatter: how much text they
 * accept, and how they count it. The second one is the interesting one here.
 * A styled letter such as `𝗕` is **one** Unicode codepoint but **two** UTF-16
 * code units, so on a platform that counts code units, styling a word doubles
 * what it costs, while on one that counts codepoints it costs nothing extra.
 *
 * Honesty, as everywhere in this project (spec §0):
 *
 * - `limit` is the platform's published limit at the time of writing. Platforms
 *   change these, so the UI labels them as documented values to re-check, and
 *   nothing depends on them being exact.
 * - `counts` is the unit each platform appears to use. Where it has not been
 *   verified against the live product it is marked `assumed`, and the UI says so.
 * - Fold behaviour lives in `fold.ts` and stays behind the `foldPreview` flag
 *   until it is measured; a `FoldRule` here is an estimate, never a measurement.
 */

import { clusters } from '../document';
import { FEED_ESTIMATE } from './fold';
import type { FoldRule } from './fold';

export const PLATFORM_IDS = ['linkedin', 'x', 'instagram', 'threads', 'none'] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

/**
 * How a platform measures length.
 *
 * - `codepoint`: a styled letter costs the same as a plain one.
 * - `utf16`: a styled letter costs twice as much, because it is a surrogate pair.
 * - `grapheme`: what a reader would call a character; emoji count once.
 */
export type CountUnit = 'codepoint' | 'utf16' | 'grapheme';

export type Confidence = 'documented' | 'assumed';

export interface Platform {
  readonly id: PlatformId;
  readonly label: string;
  /** Maximum length of a post, or `null` where the app should not claim one. */
  readonly limit: number | null;
  readonly counts: CountUnit;
  /** How sure we are about `counts`; shown to the reader rather than hidden. */
  readonly confidence: Confidence;
  /** An estimate of where the feed collapses the post; never a measurement. */
  readonly fold: FoldRule | null;
  /** One line of plain advice shown next to the target. */
  readonly note: string;
}

export const PLATFORMS: Readonly<Record<PlatformId, Platform>> = {
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    limit: 3000,
    counts: 'utf16',
    confidence: 'assumed',
    fold: FEED_ESTIMATE,
    note: 'Styled letters appear to cost two characters each here, so styling eats the limit.',
  },
  x: {
    id: 'x',
    label: 'X',
    limit: 280,
    counts: 'codepoint',
    confidence: 'documented',
    fold: null,
    note: 'X counts by codepoint, so styling costs nothing extra — but the limit is tight.',
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    limit: 2200,
    counts: 'utf16',
    confidence: 'assumed',
    fold: null,
    note: 'Captions collapse after roughly the first line or two in the feed.',
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    limit: 500,
    counts: 'utf16',
    confidence: 'assumed',
    fold: null,
    note: 'Short limit: check the count before styling a long post.',
  },
  none: {
    id: 'none',
    label: 'No target',
    limit: null,
    counts: 'grapheme',
    confidence: 'documented',
    fold: null,
    note: 'Counts characters the way a reader would, with no platform limit applied.',
  },
};

export const PLATFORM_LIST: readonly Platform[] = PLATFORM_IDS.map((id) => PLATFORMS[id]);

/** Length of `text` in a platform's unit. */
export function measureLength(text: string, unit: CountUnit): number {
  switch (unit) {
    case 'utf16':
      return text.length;
    case 'codepoint':
      return [...text].length;
    case 'grapheme':
      return clusters(text).length;
  }
}

export interface Budget {
  readonly used: number;
  readonly limit: number | null;
  /** Remaining length, or `null` when the target has no limit. */
  readonly left: number | null;
  readonly over: boolean;
  /** 0–1 for a meter, or `null` without a limit. Clamped at 1. */
  readonly fraction: number | null;
  /** What styling costs over plain text, in the platform's unit; 0 when it is free. */
  readonly styleCost: number;
}

/**
 * What `styled` costs against a platform's limit, and how much of that is the
 * styling itself (`plain` is the same post with no styled letters).
 */
export function budget(styled: string, plain: string, platform: Platform): Budget {
  const used = measureLength(styled, platform.counts);
  const styleCost = used - measureLength(plain, platform.counts);
  const limit = platform.limit;
  return {
    used,
    limit,
    left: limit === null ? null : limit - used,
    over: limit !== null && used > limit,
    fraction: limit === null ? null : Math.min(1, used / limit),
    styleCost,
  };
}
