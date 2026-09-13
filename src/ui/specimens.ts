// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The whole post in every style at once, each one ready to copy.
 *
 * The editor styles a selection: pick words, pick a style. That is the right
 * model for a post you are shaping, and the wrong one when you already know you
 * want the entire thing in one alphabet. This is the second path — no selecting,
 * one button per style.
 *
 * It renders from the plain source rather than the styled output, so switching
 * between specimens never compounds: every row is the same text, styled once.
 */

import { clusters, glyph, isAsciiAlnum, marksFor } from '../document';
import type { AlphabetId, Decoration } from '../document';

export interface Specimen {
  /** Stable key and test handle. */
  readonly id: string;
  readonly label: string;
  /** `null` renders the letters unchanged, for the decoration-only rows. */
  readonly alphabet: AlphabetId | null;
  readonly decorations: readonly Decoration[];
}

/**
 * Every style worth offering as a one-click copy, in the order the toolbar
 * presents them. Combinations a reader would never ask for by name (sans bold
 * italic underlined, say) are left to the toolbar, where they compose.
 */
export const SPECIMENS: readonly Specimen[] = [
  { id: 'bold', label: 'Bold', alphabet: 'bold', decorations: [] },
  { id: 'italic', label: 'Italic', alphabet: 'italic', decorations: [] },
  { id: 'bold_italic', label: 'Bold italic', alphabet: 'bold_italic', decorations: [] },
  { id: 'sans', label: 'Sans', alphabet: 'sans', decorations: [] },
  { id: 'sans_bold', label: 'Sans bold', alphabet: 'sans_bold', decorations: [] },
  { id: 'sans_italic', label: 'Sans italic', alphabet: 'sans_italic', decorations: [] },
  { id: 'script', label: 'Script', alphabet: 'script', decorations: [] },
  { id: 'bold_script', label: 'Bold script', alphabet: 'bold_script', decorations: [] },
  { id: 'fraktur', label: 'Fraktur', alphabet: 'fraktur', decorations: [] },
  { id: 'bold_fraktur', label: 'Bold fraktur', alphabet: 'bold_fraktur', decorations: [] },
  { id: 'doublestruck', label: 'Double-struck', alphabet: 'doublestruck', decorations: [] },
  { id: 'monospace', label: 'Monospace', alphabet: 'monospace', decorations: [] },
  { id: 'underline', label: 'Underline', alphabet: null, decorations: ['underline'] },
  { id: 'strikethrough', label: 'Strikethrough', alphabet: null, decorations: ['strikethrough'] },
];

/**
 * `text` rendered in one style.
 *
 * Follows exactly the rules the renderer follows, because a specimen that
 * disagreed with the editor would be worse than no specimen: only ASCII letters
 * and digits are substituted or decorated, and anything else — punctuation,
 * emoji, line breaks — passes through untouched.
 */
export function inStyle(text: string, specimen: Specimen): string {
  const marks = marksFor(specimen.decorations);
  let out = '';
  for (const cluster of clusters(text)) {
    if (!isAsciiAlnum(cluster.text)) {
      out += cluster.text;
      continue;
    }
    const styled = specimen.alphabet === null ? null : glyph(specimen.alphabet, cluster.text);
    out += (styled ?? cluster.text) + marks;
  }
  return out;
}
