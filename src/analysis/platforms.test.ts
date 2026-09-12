// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fromText, render, sourceText } from '../document';
import { PLATFORMS, PLATFORM_IDS, budget, measureLength } from './platforms';

/** "Bold" in sans-serif bold: four letters, four codepoints, eight UTF-16 units. */
const STYLED = '𝗕𝗼𝗹𝗱';

describe('measureLength', () => {
  it('counts the unit each platform uses', () => {
    expect(measureLength(STYLED, 'codepoint')).toBe(4);
    expect(measureLength(STYLED, 'utf16')).toBe(8);
    expect(measureLength(STYLED, 'grapheme')).toBe(4);
    // An emoji with a skin-tone modifier: one character to a reader, more underneath.
    expect(measureLength('👍🏽', 'grapheme')).toBe(1);
    expect(measureLength('👍🏽', 'codepoint')).toBe(2);
    expect(measureLength('👍🏽', 'utf16')).toBe(4);
  });
});

describe('budget', () => {
  it('charges for styling only where the platform counts code units', () => {
    const plain = 'Bold';
    expect(budget(STYLED, plain, PLATFORMS.x).styleCost).toBe(0);
    expect(budget(STYLED, plain, PLATFORMS.linkedin).styleCost).toBe(4);
    expect(budget(plain, plain, PLATFORMS.linkedin).styleCost).toBe(0);
  });

  it('reports what is left and when a post is over', () => {
    const post = 'a'.repeat(279);
    const fits = budget(post, post, PLATFORMS.x);
    expect(fits).toMatchObject({ used: 279, limit: 280, left: 1, over: false });
    expect(fits.fraction).toBeCloseTo(279 / 280, 5);

    const over = budget('a'.repeat(281), 'a'.repeat(281), PLATFORMS.x);
    expect(over).toMatchObject({ used: 281, left: -1, over: true, fraction: 1 });
  });

  it('has no limit, and never reports being over, without a target', () => {
    const none = budget(STYLED, 'Bold', PLATFORMS.none);
    expect(none).toMatchObject({ limit: null, left: null, fraction: null, over: false });
  });

  it('never claims a limit it does not have, and keeps the cost consistent', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), fc.constantFrom(...PLATFORM_IDS), (text, id) => {
        const platform = PLATFORMS[id];
        const doc = fromText(text);
        const result = budget(render(doc).output, sourceText(doc), platform);
        const limit = platform.limit;
        const consistent =
          result.used >= 0 &&
          // Styling never makes a post shorter.
          result.styleCost >= 0 &&
          (limit === null
            ? !result.over && result.fraction === null
            : result.over === result.used > limit &&
              result.fraction !== null &&
              result.fraction <= 1 &&
              result.left === limit - result.used);
        expect(consistent).toBe(true);
      }),
    );
  });
});

describe('platform table', () => {
  it('labels every claim, and only states limits it has', () => {
    const rows = PLATFORM_IDS.map((id) => {
      const { note, limit, fold } = PLATFORMS[id];
      return {
        id,
        described: note.length > 0,
        limitSane: limit === null || limit > 0,
        // A fold rule here is an estimate; it must at least describe real lines.
        foldSane: fold === null || fold.lines > 0,
      };
    });
    expect(rows.filter((row) => !row.described)).toEqual([]);
    expect(rows.filter((row) => !row.limitSane)).toEqual([]);
    expect(rows.filter((row) => !row.foldSane)).toEqual([]);
    // Only counting behaviour verified against the live product may be called
    // documented. This fails if a guess is ever quietly relabelled.
    expect(PLATFORM_IDS.filter((id) => PLATFORMS[id].confidence === 'documented')).toEqual([
      'x',
      'none',
    ]);
    // The counting difference this whole module exists for.
    expect(PLATFORMS.x.counts).toBe('codepoint');
    expect(PLATFORMS.linkedin.counts).toBe('utf16');
    expect(PLATFORMS.none.limit).toBeNull();
  });
});
