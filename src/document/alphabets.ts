// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The Unicode alphabets ProseEdge can emit, from the Mathematical Alphanumeric
 * Symbols block (U+1D400–U+1D7FF).
 *
 * Most letters sit at a fixed offset from the alphabet's capital A. A handful
 * were encoded earlier in Letterlike Symbols (U+2100–U+214F) — italic `h` is
 * PLANCK CONSTANT, script `B` is SCRIPT CAPITAL B — and the math block keeps a
 * *reserved, unassigned* codepoint at the position arithmetic would produce.
 * Emitting that hole is the classic styler bug: it renders as tofu. Those
 * letters are listed in `exceptions`, and `alphabets.test.ts` checks every
 * glyph against the character names in UnicodeData.txt.
 */

export type AlphabetId =
  | 'bold'
  | 'italic'
  | 'bold_italic'
  | 'script'
  | 'bold_script'
  | 'fraktur'
  | 'bold_fraktur'
  | 'doublestruck'
  | 'sans'
  | 'sans_bold'
  | 'sans_italic'
  | 'sans_bold_italic'
  | 'monospace';

export interface Alphabet {
  readonly id: AlphabetId;
  /** The style words Unicode uses in character names, e.g. "SANS-SERIF BOLD". */
  readonly unicodeStyle: string;
  readonly capitalA: number;
  readonly smallA: number;
  /** `null` when Unicode has no digits in this style. */
  readonly digitZero: number | null;
  /** Letters encoded in Letterlike Symbols instead of at their arithmetic position. */
  readonly exceptions: Readonly<Partial<Record<string, number>>>;
}

export const ALPHABETS: Readonly<Record<AlphabetId, Alphabet>> = {
  bold: {
    id: 'bold',
    unicodeStyle: 'BOLD',
    capitalA: 0x1d400,
    smallA: 0x1d41a,
    digitZero: 0x1d7ce,
    exceptions: {},
  },
  italic: {
    id: 'italic',
    unicodeStyle: 'ITALIC',
    capitalA: 0x1d434,
    smallA: 0x1d44e,
    digitZero: null,
    exceptions: { h: 0x210e },
  },
  bold_italic: {
    id: 'bold_italic',
    unicodeStyle: 'BOLD ITALIC',
    capitalA: 0x1d468,
    smallA: 0x1d482,
    digitZero: null,
    exceptions: {},
  },
  script: {
    id: 'script',
    unicodeStyle: 'SCRIPT',
    capitalA: 0x1d49c,
    smallA: 0x1d4b6,
    digitZero: null,
    exceptions: {
      B: 0x212c,
      E: 0x2130,
      F: 0x2131,
      H: 0x210b,
      I: 0x2110,
      L: 0x2112,
      M: 0x2133,
      R: 0x211b,
      e: 0x212f,
      g: 0x210a,
      o: 0x2134,
    },
  },
  bold_script: {
    id: 'bold_script',
    unicodeStyle: 'BOLD SCRIPT',
    capitalA: 0x1d4d0,
    smallA: 0x1d4ea,
    digitZero: null,
    exceptions: {},
  },
  /*
   * Fraktur's five holes are filled from Letterlike Symbols, where Unicode
   * names them BLACK-LETTER rather than FRAKTUR — the same character under an
   * older name. `alphabets.test.ts` lists those aliases.
   */
  fraktur: {
    id: 'fraktur',
    unicodeStyle: 'FRAKTUR',
    capitalA: 0x1d504,
    smallA: 0x1d51e,
    digitZero: null,
    exceptions: {
      C: 0x212d,
      H: 0x210c,
      I: 0x2111,
      R: 0x211c,
      Z: 0x2128,
    },
  },
  bold_fraktur: {
    id: 'bold_fraktur',
    unicodeStyle: 'BOLD FRAKTUR',
    capitalA: 0x1d56c,
    smallA: 0x1d586,
    digitZero: null,
    exceptions: {},
  },
  doublestruck: {
    id: 'doublestruck',
    unicodeStyle: 'DOUBLE-STRUCK',
    capitalA: 0x1d538,
    smallA: 0x1d552,
    digitZero: 0x1d7d8,
    exceptions: {
      C: 0x2102,
      H: 0x210d,
      N: 0x2115,
      P: 0x2119,
      Q: 0x211a,
      R: 0x211d,
      Z: 0x2124,
    },
  },
  sans: {
    id: 'sans',
    unicodeStyle: 'SANS-SERIF',
    capitalA: 0x1d5a0,
    smallA: 0x1d5ba,
    digitZero: 0x1d7e2,
    exceptions: {},
  },
  sans_bold: {
    id: 'sans_bold',
    unicodeStyle: 'SANS-SERIF BOLD',
    capitalA: 0x1d5d4,
    smallA: 0x1d5ee,
    digitZero: 0x1d7ec,
    exceptions: {},
  },
  sans_italic: {
    id: 'sans_italic',
    unicodeStyle: 'SANS-SERIF ITALIC',
    capitalA: 0x1d608,
    smallA: 0x1d622,
    digitZero: null,
    exceptions: {},
  },
  sans_bold_italic: {
    id: 'sans_bold_italic',
    unicodeStyle: 'SANS-SERIF BOLD ITALIC',
    capitalA: 0x1d63c,
    smallA: 0x1d656,
    digitZero: null,
    exceptions: {},
  },
  monospace: {
    id: 'monospace',
    unicodeStyle: 'MONOSPACE',
    capitalA: 0x1d670,
    smallA: 0x1d68a,
    digitZero: 0x1d7f6,
    exceptions: {},
  },
};

export const ALPHABET_IDS = Object.keys(ALPHABETS) as readonly AlphabetId[];

export const ASCII_ALNUM: readonly string[] = Array.from(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
);

const CAPITAL_A = 0x41;
const CAPITAL_Z = 0x5a;
const SMALL_A = 0x61;
const SMALL_Z = 0x7a;
const DIGIT_ZERO = 0x30;
const DIGIT_NINE = 0x39;

/** True for a single ASCII letter or digit — the only characters ProseEdge styles. */
export function isAsciiAlnum(ch: string): boolean {
  if (ch.length !== 1) return false;
  const c = ch.charCodeAt(0);
  return (
    (c >= CAPITAL_A && c <= CAPITAL_Z) ||
    (c >= SMALL_A && c <= SMALL_Z) ||
    (c >= DIGIT_ZERO && c <= DIGIT_NINE)
  );
}

/** The styled form of an ASCII letter or digit, or `null` if Unicode has none. */
export function glyph(alphabet: AlphabetId, ch: string): string | null {
  if (!isAsciiAlnum(ch)) return null;
  const spec = ALPHABETS[alphabet];
  const exception = spec.exceptions[ch];
  if (exception !== undefined) return String.fromCodePoint(exception);
  const c = ch.charCodeAt(0);
  if (c <= DIGIT_NINE) {
    return spec.digitZero === null ? null : String.fromCodePoint(spec.digitZero + c - DIGIT_ZERO);
  }
  if (c <= CAPITAL_Z) return String.fromCodePoint(spec.capitalA + c - CAPITAL_A);
  return String.fromCodePoint(spec.smallA + c - SMALL_A);
}

export interface Folded {
  readonly ascii: string;
  readonly alphabet: AlphabetId;
}

const REVERSE: ReadonlyMap<number, Folded> = (() => {
  const map = new Map<number, Folded>();
  for (const alphabet of ALPHABET_IDS) {
    for (const ascii of ASCII_ALNUM) {
      const cp = glyph(alphabet, ascii)?.codePointAt(0);
      if (cp !== undefined) map.set(cp, { ascii, alphabet });
    }
  }
  return map;
})();

/** The ASCII source and alphabet of a codepoint ProseEdge can emit, if it is one. */
export function fold(codepoint: number): Folded | undefined {
  return REVERSE.get(codepoint);
}

export function isStyledCodepoint(codepoint: number): boolean {
  return REVERSE.has(codepoint);
}

/** Every codepoint ProseEdge can emit. Exposed for tests and fixtures. */
export function styledCodepoints(): ReadonlyMap<number, Folded> {
  return REVERSE;
}
