// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import { normalize, parseStyled } from './normalize';

describe('normalize', () => {
  it('folds every emitted codepoint, including Letterlike exceptions', () => {
    expect(normalize('\u{1D5DB}\u{1D5F2} ℎ ℬ 𝟭')).toBe('He h B 1');
  });

  it('is narrower than NFKC: ligatures, fullwidth and superscripts survive', () => {
    const text = 'ﬁ Ａ ²';
    expect(text.normalize('NFKC')).not.toBe(text);
    expect(normalize(text)).toBe(text);
  });

  it('folds the alphabets it emits, and only those', () => {
    /*
     * Double-struck A survived normalize until ProseEdge could emit it; now it
     * is output rather than source, so folding it is what keeps the round-trip
     * invariant true. Bold capital alpha is Greek, which no alphabet here
     * covers, so it still passes through.
     */
    expect(normalize('\u{1D538}\u{1D552}')).toBe('Aa');
    expect(normalize('\u{1D504}\u{1D51E}')).toBe('Aa');
    expect(normalize('\u{1D56C}\u{1D586}')).toBe('Aa');
    // The Letterlike exceptions fold too: ℂ, ℌ, ℑ.
    expect(normalize('ℂℌℑ')).toBe('CHI');
    expect(normalize('\u{1D6A8}')).toBe('\u{1D6A8}');
  });
});

describe('parseStyled', () => {
  it('keeps punctuation inside a run when both neighbours agree', () => {
    expect(parseStyled('𝗛𝗲𝗹𝗹𝗼, 𝘄𝗼𝗿𝗹𝗱!')).toEqual([
      { text: 'Hello, world!', style: new Set(['sans', 'bold']) },
    ]);
  });

  it('gives neutral characters between different styles to plain text', () => {
    expect(parseStyled('plain 𝐛𝐨𝐥𝐝 𝘴𝘢𝘯𝘴')).toEqual([
      { text: 'plain ', style: new Set() },
      { text: 'bold', style: new Set(['bold']) },
      { text: ' ', style: new Set() },
      { text: 'sans', style: new Set(['sans', 'italic']) },
    ]);
  });

  it('attaches leading neutral characters to the first styled run', () => {
    expect(parseStyled('👉 𝐠𝐨')).toEqual([{ text: '👉 go', style: new Set(['bold']) }]);
  });

  it('returns no runs for empty text', () => {
    expect(parseStyled('')).toEqual([]);
  });
});
