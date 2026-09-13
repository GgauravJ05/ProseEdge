// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import { ALPHABET_IDS } from './alphabets';
import type { AlphabetId } from './alphabets';
import type { StyleKind } from './grammar';
import { canonicalStyle, resolveStyle, styleEquals, styleOfAlphabet } from './style';

describe('resolveStyle', () => {
  it.each<[StyleKind[], AlphabetId | null, StyleKind[]]>([
    [[], null, []],
    [['bold'], 'bold', []],
    [['italic'], 'italic', []],
    [['bold_italic'], 'bold_italic', []],
    [['bold', 'italic'], 'bold_italic', []],
    [['sans'], 'sans', []],
    [['sans', 'bold', 'italic'], 'sans_bold_italic', []],
    [['script', 'bold'], 'bold_script', []],
    // Unicode has no italic script and no bold or italic monospace.
    [['script', 'italic'], 'script', ['italic']],
    [['monospace', 'bold_italic'], 'monospace', ['bold', 'italic']],
    // Family precedence: monospace > script > sans.
    [['sans', 'script', 'monospace'], 'monospace', ['script', 'sans']],
    [['sans', 'script', 'bold', 'italic'], 'bold_script', ['sans', 'italic']],
  ])('%j resolves to %s, dropping %j', (style, alphabet, dropped) => {
    // No decoration in any case here: they resolve independently of the
    // alphabet, and have their own cases below.
    expect(resolveStyle(new Set(style))).toEqual({ alphabet, decorations: [], dropped });
  });

  it.each(ALPHABET_IDS)('styleOfAlphabet(%s) resolves back without drops', (id) => {
    expect(resolveStyle(styleOfAlphabet(id))).toEqual({
      alphabet: id,
      decorations: [],
      dropped: [],
    });
  });

  /*
   * Decorations compose rather than compete: they never take the alphabet slot
   * and nothing is dropped to make room for one (ADR 0010).
   */
  it.each<[StyleKind[], AlphabetId | null, StyleKind[]]>([
    [['underline'], null, ['underline']],
    [['strikethrough'], null, ['strikethrough']],
    [['underline', 'strikethrough'], null, ['underline', 'strikethrough']],
    [['bold', 'underline'], 'bold', ['underline']],
    [['sans', 'bold', 'strikethrough'], 'sans_bold', ['strikethrough']],
    // Even where emphasis is dropped, the decoration survives.
    [['monospace', 'bold', 'underline'], 'monospace', ['underline']],
  ])('%j keeps its decorations alongside %s', (style, alphabet, decorations) => {
    const resolved = resolveStyle(new Set(style));
    expect(resolved.alphabet).toBe(alphabet);
    expect(resolved.decorations).toEqual(decorations);
  });
});

describe('style sets', () => {
  it('expands the bold_italic shorthand', () => {
    expect(canonicalStyle(['bold_italic', 'sans'])).toEqual(new Set(['bold', 'italic', 'sans']));
  });

  it('compares canonically', () => {
    expect(styleEquals(new Set(['bold_italic']), new Set(['italic', 'bold']))).toBe(true);
    expect(styleEquals(new Set(['bold']), new Set(['bold', 'sans']))).toBe(false);
  });
});
