// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  DECORATIONS,
  DECORATION_MARKS,
  decorationOfMark,
  isDecorationMark,
  marksFor,
  stripDecorations,
} from './decorations';
import { CLUSTERS } from './__fixtures__/arbitraries';

describe('decoration marks', () => {
  it('are the combining characters Unicode defines for them', () => {
    // U+0332 COMBINING LOW LINE, U+0336 COMBINING LONG STROKE OVERLAY.
    expect(DECORATION_MARKS.underline.codePointAt(0)).toBe(0x0332);
    expect(DECORATION_MARKS.strikethrough.codePointAt(0)).toBe(0x0336);
  });

  it('round-trip through their lookup', () => {
    for (const decoration of DECORATIONS) {
      const mark = DECORATION_MARKS[decoration];
      expect(isDecorationMark(mark)).toBe(true);
      expect(decorationOfMark(mark)).toBe(decoration);
    }
    expect(isDecorationMark('a')).toBe(false);
    // A combining acute is a mark, but not one of ours: source text may use it.
    expect(isDecorationMark('́')).toBe(false);
    expect(decorationOfMark('́')).toBeUndefined();
  });

  it('order marks the same way whatever order they are given in', () => {
    // Unstable ordering would make the same style render different bytes
    // depending on which button was pressed first, and break round-trip.
    expect(marksFor(['strikethrough', 'underline'])).toBe(marksFor(['underline', 'strikethrough']));
    expect(marksFor(['underline', 'underline'])).toBe(DECORATION_MARKS.underline);
    expect(marksFor([])).toBe('');
  });

  it('strip back to exactly the text they were added to', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...CLUSTERS), { maxLength: 10 }).map((parts) => parts.join('')),
        fc.subarray([...DECORATIONS]),
        (text, decorations) => {
          const marks = marksFor(decorations);
          // Appending to each character is what the renderer does; stripping
          // must undo it exactly, which is what keeps normalize an inverse.
          const decorated = [...text].map((ch) => ch + marks).join('');
          expect(stripDecorations(decorated)).toBe(text);
        },
      ),
    );
  });

  it('leave text alone when there is nothing to strip', () => {
    expect(stripDecorations('plain')).toBe('plain');
    expect(stripDecorations('é')).toBe('é');
  });
});
