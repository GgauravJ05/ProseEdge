// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Resolving a set of style kinds to one Unicode alphabet.
 *
 * Not every combination exists in Unicode: there is no bold monospace and no
 * italic script. Rather than silently picking a lookalike, resolution follows a
 * fixed precedence and returns the kinds it could not honour, which the
 * renderer reports (ADR 0002).
 */

import type { AlphabetId } from './alphabets';
import type { StyleKind, StyleSet } from './grammar';

/** Expand the `bold_italic` shorthand so equal styles compare equal. */
export function canonicalStyle(style: Iterable<StyleKind>): StyleSet {
  const out = new Set<StyleKind>();
  for (const kind of style) {
    if (kind === 'bold_italic') {
      out.add('bold');
      out.add('italic');
    } else {
      out.add(kind);
    }
  }
  return out;
}

export function styleEquals(a: StyleSet, b: StyleSet): boolean {
  const x = canonicalStyle(a);
  const y = canonicalStyle(b);
  return x.size === y.size && [...x].every((kind) => y.has(kind));
}

/** Font families, highest precedence first. Serif is the implicit default. */
const FAMILY_PRECEDENCE = ['monospace', 'doublestruck', 'fraktur', 'script', 'sans'] as const;

export interface ResolvedStyle {
  /** `null` means unstyled: the source is emitted as-is. */
  readonly alphabet: AlphabetId | null;
  /** Kinds present in the style that no Unicode alphabet can express together. */
  readonly dropped: readonly StyleKind[];
}

export function resolveStyle(style: StyleSet): ResolvedStyle {
  const s = canonicalStyle(style);
  const bold = s.has('bold');
  const italic = s.has('italic');
  const families = FAMILY_PRECEDENCE.filter((family) => s.has(family));
  const dropped: StyleKind[] = families.slice(1);
  const family = families[0];

  if (family === undefined) {
    if (bold) return { alphabet: italic ? 'bold_italic' : 'bold', dropped };
    return { alphabet: italic ? 'italic' : null, dropped };
  }

  switch (family) {
    case 'monospace':
      if (bold) dropped.push('bold');
      if (italic) dropped.push('italic');
      return { alphabet: 'monospace', dropped };
    case 'script':
      if (italic) dropped.push('italic');
      return { alphabet: bold ? 'bold_script' : 'script', dropped };
    case 'fraktur':
      // Unicode has bold fraktur but no italic one.
      if (italic) dropped.push('italic');
      return { alphabet: bold ? 'bold_fraktur' : 'fraktur', dropped };
    case 'doublestruck':
      if (bold) dropped.push('bold');
      if (italic) dropped.push('italic');
      return { alphabet: 'doublestruck', dropped };
    case 'sans':
      if (bold) return { alphabet: italic ? 'sans_bold_italic' : 'sans_bold', dropped };
      return { alphabet: italic ? 'sans_italic' : 'sans', dropped };
  }
}

const ALPHABET_STYLE: Readonly<Record<AlphabetId, readonly StyleKind[]>> = {
  bold: ['bold'],
  italic: ['italic'],
  bold_italic: ['bold', 'italic'],
  script: ['script'],
  bold_script: ['script', 'bold'],
  fraktur: ['fraktur'],
  bold_fraktur: ['fraktur', 'bold'],
  doublestruck: ['doublestruck'],
  sans: ['sans'],
  sans_bold: ['sans', 'bold'],
  sans_italic: ['sans', 'italic'],
  sans_bold_italic: ['sans', 'bold', 'italic'],
  monospace: ['monospace'],
};

/** The canonical style that resolves to `alphabet`. Inverse of {@link resolveStyle}. */
export function styleOfAlphabet(alphabet: AlphabetId): StyleSet {
  return new Set(ALPHABET_STYLE[alphabet]);
}
