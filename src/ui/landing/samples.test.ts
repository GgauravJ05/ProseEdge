// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import { normalize } from '../../document';
import {
  chipLabel,
  HERO_POST,
  METER_POST,
  plainPost,
  sampleFacts,
  SHOWCASE,
  specimen,
  styledPost,
} from './samples';

describe('landing samples', () => {
  it('offers six distinct showcase styles, with a plain "Bold" chip', () => {
    expect(new Set(SHOWCASE.map((spec) => spec.id)).size).toBe(6);
    expect(SHOWCASE.map(chipLabel)).toEqual([
      'Bold',
      'Italic',
      'Script',
      'Fraktur',
      'Double-struck',
      'Monospace',
    ]);
  });

  it('refuses a specimen that does not exist', () => {
    expect(() => specimen('comic_sans')).toThrow('no specimen comic_sans');
  });

  it('styles only the lead, and normalizes back to the plain post', () => {
    for (const spec of SHOWCASE) {
      const styled = styledPost(HERO_POST, spec);
      expect(styled.endsWith(HERO_POST.body)).toBe(true);
      expect(styled).not.toBe(plainPost(HERO_POST));
      expect(normalize(styled)).toBe(plainPost(HERO_POST));
    }
  });

  it('computes what bold costs on LinkedIn and X', () => {
    const facts = sampleFacts(HERO_POST, specimen('sans_bold'));
    // "We’re hiring": ten letters become named symbols; the apostrophe and space stay.
    expect(facts.named).toBe(10);
    expect(facts.letters).toBe(12);
    // Each styled letter is two UTF-16 units but one codepoint.
    expect(facts.linkedinCost).toBe(10);
    expect(facts.xCost).toBe(0);
    expect(facts.linkedin - facts.x).toBe(10);
  });

  it('keeps the meter post under every limit, styled or not', () => {
    const facts = sampleFacts(METER_POST, specimen('sans_bold'));
    expect(facts.x).toBeLessThan(280);
    expect(facts.linkedin).toBeLessThan(500);
  });
});
