// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import { PLATFORM_IDS, PLATFORMS } from '../analysis/platforms';
import { PREVIEW_STYLES, fontOf, previewStyle } from './preview';

describe('preview styles', () => {
  it('covers every target, so the two tables cannot drift apart', () => {
    // A new platform in platforms.ts must be given a layout here (or an
    // explicit null), rather than silently falling back to something generic.
    expect(Object.keys(PREVIEW_STYLES).sort()).toEqual([...PLATFORM_IDS].sort());
  });

  it('offers no card without a target, because there is no feed to imitate', () => {
    expect(previewStyle('none')).toBeNull();
    expect(PLATFORMS.none.limit).toBeNull();
  });

  it('gives every real target a usable column and type scale', () => {
    for (const id of PLATFORM_IDS) {
      if (id === 'none') continue;
      const style = previewStyle(id);
      expect(style).not.toBeNull();
      if (style === null) continue;
      // Wide enough that wrapping means something, narrow enough to be a feed.
      expect(style.width).toBeGreaterThan(300);
      expect(style.width).toBeLessThan(800);
      expect(style.size).toBeGreaterThanOrEqual(13);
      expect(style.lineHeight).toBeGreaterThan(1.2);
      // Nothing here is measured, and every card has to say so.
      expect(style.caveat.toLowerCase()).toContain('not a measurement');
    }
  });

  it('only claims a clamp where the platform actually collapses a post', () => {
    // X shows a post in full in the timeline, so claiming a line clamp there
    // would be inventing a cut that does not exist.
    expect(previewStyle('x')?.clamp).toBeNull();
    expect(previewStyle('linkedin')?.clamp).toBe(3);
    expect(previewStyle('instagram')?.clamp).toBe(2);
  });

  it('builds a font shorthand canvas metrics can parse', () => {
    const style = previewStyle('linkedin');
    expect(style).not.toBeNull();
    if (style === null) return;
    expect(fontOf(style)).toBe(`14px ${style.font}`);
    expect(fontOf(style).startsWith('14px ')).toBe(true);
  });
});
