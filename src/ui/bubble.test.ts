// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { BUBBLE_GAP, BUBBLE_INSET, placeBubble } from './bubble';

const bar = { width: 200, height: 40 };
const frame = { width: 800, height: 400 };

describe('placeBubble', () => {
  it('centres the bar above the selection when there is room', () => {
    expect(placeBubble({ top: 120, bottom: 150, center: 400 }, bar, frame)).toEqual({
      left: 300,
      top: 120 - BUBBLE_GAP - bar.height,
      side: 'above',
    });
  });

  it('drops below the last line when the first line is too close to the top', () => {
    expect(placeBubble({ top: 10, bottom: 60, center: 400 }, bar, frame)).toEqual({
      left: 300,
      top: 60 + BUBBLE_GAP,
      side: 'below',
    });
  });

  it('keeps the bar inside both edges', () => {
    expect(placeBubble({ top: 120, bottom: 150, center: 5 }, bar, frame).left).toBe(BUBBLE_INSET);
    expect(placeBubble({ top: 120, bottom: 150, center: 795 }, bar, frame).left).toBe(
      frame.width - bar.width - BUBBLE_INSET,
    );
  });

  it('never places the bar off the editor, whatever the selection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 900 }),
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 40, max: 600 }),
        (center, top, lineHeight, width) => {
          const at = placeBubble(
            { top, bottom: top + lineHeight, center },
            { width, height: 40 },
            frame,
          );
          expect(at.left).toBeGreaterThanOrEqual(BUBBLE_INSET);
          // Every generated bar fits the 800px frame, so it must end inside it too.
          expect(at.left + width).toBeLessThanOrEqual(frame.width - BUBBLE_INSET);
          // Above the selection it stays inside the top edge; below, it clears the text.
          expect(at.side === 'above' ? at.top >= BUBBLE_INSET : at.top > top).toBe(true);
        },
      ),
    );
  });
});
