// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * How a post is laid out in each platform's feed.
 *
 * This is the presentation half of a target; `platforms.ts` holds the half that
 * can be counted (limits and counting units). Keeping them apart matters,
 * because they carry different kinds of truth: a character limit is published
 * and checkable, whereas a column width or a line-height is read off a screen
 * and will drift as the product is redesigned.
 *
 * So, following spec §0 and the same rule as `FoldRule`:
 *
 * - Nothing here is a measurement of the real product. These are approximations
 *   chosen to wrap text at roughly the same place, and the card says so.
 * - No platform logo, brand colour or copied chrome. The card borrows this
 *   app's own palette, which also keeps it inside the contrast budget the axe
 *   scans enforce and lets it follow the light and dark themes.
 * - `clamp` is how many lines the feed shows before collapsing the post, but
 *   drawing that cut asserts where the reader stops reading, which has not been
 *   measured. So the card ships unflagged and the cut stays behind the
 *   `foldPreview` flag with the rest of the unmeasured fold work (ADR 0009).
 */

import type { PlatformId } from '../analysis/platforms';

/** The shape of the byline above a post, which differs by platform. */
export type Byline =
  /** Name, then a professional headline on a second line: LinkedIn. */
  | 'headline'
  /** Name and an @handle on one line: X and Threads. */
  | 'handle'
  /** Name only, with the caption below the image area: Instagram. */
  | 'caption';

export interface PreviewStyle {
  /**
   * Width of the text column in CSS pixels, at the platform's own font size.
   * Text is wrapped by measuring it at this width rather than by counting
   * characters, because styled letters and emoji are not one column wide.
   */
  readonly width: number;
  /** Font stack the platform's feed appears to use, nearest available locally. */
  readonly font: string;
  readonly size: number;
  readonly lineHeight: number;
  readonly byline: Byline;
  /** Lines shown before the feed collapses the post; null where it does not. */
  readonly clamp: number | null;
  /** Shown under the card, so nobody reads the layout as authoritative. */
  readonly caveat: string;
}

const SYSTEM = '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif';

export const PREVIEW_STYLES: Readonly<Record<PlatformId, PreviewStyle | null>> = {
  linkedin: {
    width: 552,
    font: SYSTEM,
    size: 14,
    lineHeight: 1.43,
    byline: 'headline',
    clamp: 3,
    caveat: 'Approximate desktop feed layout, not a measurement.',
  },
  x: {
    width: 512,
    font: SYSTEM,
    size: 15,
    lineHeight: 1.31,
    byline: 'handle',
    // X shows a post in full in the timeline; long ones get a "Show more" that
    // depends on height rather than a line count, so no clamp is claimed here.
    clamp: null,
    caveat: 'Approximate timeline layout, not a measurement.',
  },
  instagram: {
    width: 468,
    font: SYSTEM,
    size: 14,
    lineHeight: 1.5,
    byline: 'caption',
    clamp: 2,
    caveat: 'Approximate feed caption layout, not a measurement.',
  },
  threads: {
    width: 520,
    font: SYSTEM,
    size: 15,
    lineHeight: 1.4,
    byline: 'handle',
    clamp: 4,
    caveat: 'Approximate feed layout, not a measurement.',
  },
  // Without a target there is no feed to imitate, so the preview offers nothing
  // and the component falls back to showing the post as written.
  none: null,
};

export const previewStyle = (id: PlatformId): PreviewStyle | null => PREVIEW_STYLES[id];

/** The CSS `font` shorthand for a style, which is also what canvas metrics want. */
export const fontOf = (style: PreviewStyle): string => `${String(style.size)}px ${style.font}`;
