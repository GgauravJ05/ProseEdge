// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { markerOf, toggleList } from './lists';

describe('toggleList', () => {
  it('adds and removes bullets on the selected lines', () => {
    const on = toggleList('a\nb', 0, 3, 'bullet');
    expect(on).toEqual({ text: '• a\n• b', start: 0, end: 7 });
    expect(toggleList(on.text, on.start, on.end, 'bullet').text).toBe('a\nb');
  });

  it('numbers from 1 and restarts after a blank line', () => {
    expect(toggleList('a\n\nb\nc', 0, 6, 'numbered').text).toBe('1. a\n\n1. b\n2. c');
  });

  it('replaces the other kind of marker instead of stacking markers', () => {
    expect(toggleList('• a\n• b', 0, 7, 'numbered').text).toBe('1. a\n2. b');
    expect(toggleList('1. a\nb', 0, 6, 'numbered').text).toBe('1. a\n2. b');
  });

  it('adds and removes a checklist', () => {
    const on = toggleList('a\nb', 0, 3, 'checklist');
    expect(on).toEqual({ text: '☐ a\n☐ b', start: 0, end: 7 });
    expect(toggleList(on.text, on.start, on.end, 'checklist').text).toBe('a\nb');
  });

  it('swaps between all three markers without stacking them', () => {
    // Every pair, because `withoutMarker` has to strip whichever is already
    // there before writing the new one.
    expect(toggleList('• a\n• b', 0, 7, 'checklist').text).toBe('☐ a\n☐ b');
    expect(toggleList('☐ a\n☐ b', 0, 7, 'bullet').text).toBe('• a\n• b');
    expect(toggleList('☐ a\n☐ b', 0, 7, 'numbered').text).toBe('1. a\n2. b');
    expect(toggleList('1. a\n2. b', 0, 9, 'checklist').text).toBe('☐ a\n☐ b');
  });

  it("changes only the caret's line when nothing is selected", () => {
    expect(toggleList('a\nb\nc', 2, 2, 'bullet')).toEqual({ text: 'a\n• b\nc', start: 2, end: 5 });
  });

  it('does not touch the next line when the selection ends at its start', () => {
    expect(toggleList('a\nb', 0, 2, 'bullet').text).toBe('• a\nb');
  });

  it('keeps styled letters as they are', () => {
    expect(toggleList('𝐇𝐢\nthere', 0, 10, 'bullet').text).toBe('• 𝐇𝐢\n• there');
  });

  it('detects the markers it writes, and only those', () => {
    expect(markerOf('• a')).toBe('bullet');
    expect(markerOf('12. a')).toBe('numbered');
    expect(markerOf('☐ a')).toBe('checklist');
    expect(markerOf('- a')).toBeNull();
    expect(markerOf('𝟏. a')).toBeNull();
    // A ticked box is not a marker this app writes, so it stays body text.
    expect(markerOf('☑ a')).toBeNull();
  });

  it('is undone by toggling again', () => {
    const lines = fc.array(fc.stringMatching(/^[a-z][a-z ]{0,6}$/u), {
      minLength: 1,
      maxLength: 5,
    });
    fc.assert(
      fc.property(lines, fc.constantFrom('bullet', 'numbered', 'checklist'), (parts, marker) => {
        const text = parts.join('\n');
        const once = toggleList(text, 0, text.length, marker);
        expect(toggleList(once.text, once.start, once.end, marker).text).toBe(text);
      }),
    );
  });
});
