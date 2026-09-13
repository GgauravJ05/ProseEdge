// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { normalize } from '../document';
import { recase } from './case';

describe('recase', () => {
  it('transforms the selected range and leaves the rest alone', () => {
    expect(recase('hello world', 0, 5, 'upper')).toEqual({
      text: 'HELLO world',
      start: 0,
      end: 5,
    });
    expect(recase('HELLO WORLD', 6, 11, 'lower')).toEqual({
      text: 'HELLO world',
      start: 6,
      end: 11,
    });
  });

  it('transforms the whole post when nothing is selected', () => {
    // What makes the buttons useful without selecting first.
    expect(recase('hi there', 3, 3, 'upper').text).toBe('HI THERE');
    expect(recase('HI THERE', 0, 0, 'lower').text).toBe('hi there');
  });

  it('leaves styled letters exactly as they are', () => {
    /*
     * Upper-casing a mathematical alphanumeric either does nothing or maps it
     * somewhere unintended, and a reader who styled a word did not ask for its
     * case to change. The plain pane would disagree with the post either way.
     */
    const styled = '𝐛𝐨𝐥𝐝 plain';
    const result = recase(styled, 0, styled.length, 'upper');
    expect(result.text).toBe('𝐛𝐨𝐥𝐝 PLAIN');
    // The source underneath is untouched, so the plain pane still says "bold".
    expect(normalize(result.text)).toBe('bold PLAIN');
  });

  it('keeps emoji and punctuation intact', () => {
    expect(recase('hi 👍 there!', 0, 11, 'upper').text).toBe('HI 👍 THERE!');
  });

  it('keeps line breaks, so a multi-line post stays multi-line', () => {
    expect(recase('a\nb', 0, 3, 'upper').text).toBe('A\nB');
  });

  it('returns a range covering exactly what it changed', () => {
    const edit = recase('one two three', 4, 7, 'upper');
    expect(edit.text.slice(edit.start, edit.end)).toBe('TWO');
  });

  it('is idempotent, and lower undoes upper for plain ASCII', () => {
    const words = fc.stringMatching(/^[a-zA-Z ]{0,20}$/u);
    fc.assert(
      fc.property(words, (text) => {
        const upper = recase(text, 0, text.length, 'upper');
        expect(recase(upper.text, 0, upper.text.length, 'upper').text).toBe(upper.text);
        const lower = recase(text, 0, text.length, 'lower');
        expect(recase(lower.text, 0, lower.text.length, 'lower').text).toBe(lower.text);
        expect(recase(upper.text, 0, upper.text.length, 'lower').text).toBe(text.toLowerCase());
      }),
    );
  });

  it('handles an empty post', () => {
    expect(recase('', 0, 0, 'upper')).toEqual({ text: '', start: 0, end: 0 });
  });
});
