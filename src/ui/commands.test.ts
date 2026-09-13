// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import * as arb from '../document/__fixtures__/arbitraries';
import {
  DECORATION_MARKS,
  builder,
  fromText,
  normalize,
  rangesFromSource,
  render,
  sequentialIds,
  sourceText,
  toLf,
  validate,
} from '../document';
import type { Document, TextRange } from '../document';
import {
  FAMILIES,
  applyEdit,
  canEmphasize,
  editBounds,
  familyOf,
  selectionState,
  setFamily,
  supports,
  toggleDecoration,
  toggleEmphasis,
} from './commands';

const b = builder(sequentialIds());

function everything(doc: Document): TextRange[] {
  const result = render(doc);
  return rangesFromSource(result.layout, 0, result.sourceLength);
}

const output = (doc: Document): string => render(doc).output;

describe('familyOf and supports', () => {
  it('follow the renderer precedence and the alphabets Unicode has', () => {
    expect(familyOf(new Set())).toBe('serif');
    expect(familyOf(new Set(['sans', 'bold']))).toBe('sans');
    expect(familyOf(new Set(['sans', 'script']))).toBe('script');
    expect(familyOf(new Set(['script', 'monospace']))).toBe('monospace');
    // Precedence, highest first: monospace, doublestruck, fraktur, script, sans.
    expect(familyOf(new Set(['script', 'fraktur']))).toBe('fraktur');
    expect(familyOf(new Set(['fraktur', 'doublestruck']))).toBe('doublestruck');
    expect(familyOf(new Set(['doublestruck', 'monospace']))).toBe('monospace');
    // In FAMILIES order. Unicode has a bold script and a bold fraktur, but no
    // italic form of either, and neither emphasis for double-struck or monospace.
    expect(FAMILIES.map((f) => [supports(f, 'bold'), supports(f, 'italic')])).toEqual([
      [true, true], // serif
      [true, true], // sans
      [true, false], // script
      [true, false], // fraktur
      [false, false], // doublestruck
      [false, false], // monospace
    ]);
  });
});

describe('selectionState', () => {
  it('reports family and emphasis of the letters in the selection', () => {
    const plain = fromText('Hi');
    expect(selectionState(plain, everything(plain))).toEqual({
      families: new Set(['serif']),
      bold: 'off',
      italic: 'off',
      underline: 'off',
      strikethrough: 'off',
    });
    const sansBold = fromText('𝗛𝗶');
    expect(selectionState(sansBold, everything(sansBold))).toEqual({
      families: new Set(['sans']),
      bold: 'on',
      italic: 'off',
      underline: 'off',
      strikethrough: 'off',
    });
  });

  it('reports decorations, which every family can carry', () => {
    const doc = b.document(b.hook(b.paragraph(b.span('ab', ['underline']))));
    const state = selectionState(doc, everything(doc));
    expect(state.underline).toBe('on');
    expect(state.strikethrough).toBe('off');
    // A decoration is not an emphasis: no family refuses it.
    expect(state.families).toEqual(new Set(['serif']));
  });

  it('is off when only part of the selection has the emphasis', () => {
    const doc = b.document(b.hook(b.paragraph(b.span('ab', ['bold']), b.span('cd'))));
    expect(selectionState(doc, everything(doc)).bold).toBe('off');
  });

  it('is empty without letters or digits, or for an unknown paragraph', () => {
    const doc = fromText('Hi, there');
    const [range] = everything(doc);
    expect(range).toBeDefined();
    const comma = { paragraph: range?.paragraph ?? '', start: 2, end: 3 };
    expect(selectionState(doc, [comma]).bold).toBe('empty');
    expect(selectionState(doc, [{ paragraph: 'missing', start: 0, end: 2 }]).families.size).toBe(0);
    expect(canEmphasize(selectionState(doc, [comma]), 'bold')).toBe(false);
  });
});

describe('toggleDecoration', () => {
  it('adds and removes a mark on every letter', () => {
    const doc = fromText('Hi');
    const all = everything(doc);
    const underlined = toggleDecoration(doc, all, 'underline');
    expect(output(underlined)).toBe('H̲i̲');
    expect(output(toggleDecoration(underlined, everything(underlined), 'underline'))).toBe('Hi');
  });

  it('survives a change of family, unlike an unsupported emphasis', () => {
    /*
     * `setFamily` strips emphasis a family cannot express, but a combining mark
     * composes with every alphabet, so switching family must keep it. Silently
     * dropping it here would be invisible until someone copied the post.
     */
    const doc = fromText('Hi');
    const underlined = toggleDecoration(doc, everything(doc), 'underline');
    const mono = setFamily(underlined, everything(underlined), 'monospace');
    // Monospace H and i (U+1D677, U+1D692), each carrying a combining low line.
    const mark = DECORATION_MARKS.underline;
    expect(output(mono)).toBe(`\u{1D677}${mark}\u{1D692}${mark}`);
    expect(normalize(output(mono))).toBe('Hi');
  });
});

describe('setFamily', () => {
  it('renders the selection in the chosen family', () => {
    const doc = fromText('Hi');
    const all = everything(doc);
    expect(output(setFamily(doc, all, 'sans'))).toBe('𝖧𝗂');
    expect(output(setFamily(doc, all, 'script'))).toBe('ℋ𝒾');
    expect(output(setFamily(doc, all, 'monospace'))).toBe('𝙷𝚒');
    expect(output(setFamily(setFamily(doc, all, 'sans'), all, 'serif'))).toBe('Hi');
  });

  it('removes emphasis the family cannot express', () => {
    const bold = fromText('𝐇𝐢');
    const mono = setFamily(bold, everything(bold), 'monospace');
    expect(output(mono)).toBe('𝙷𝚒');
    expect(selectionState(mono, everything(mono)).bold).toBe('off');
    const boldItalic = fromText('𝑯𝒊');
    const script = setFamily(boldItalic, everything(boldItalic), 'script');
    expect(output(script)).toBe('𝓗𝓲');
  });

  it('never leaves a style the renderer has to drop, and never changes the text', () => {
    fc.assert(
      fc.property(arb.document, fc.constantFrom(...FAMILIES), (doc, family) => {
        const next = setFamily(doc, everything(doc), family, sequentialIds('f'));
        expect(validate(next)).toEqual([]);
        expect(sourceText(next)).toBe(sourceText(doc));
        expect(render(next).drops).toEqual([]);
        const families = selectionState(next, everything(next)).families;
        expect(families.size === 0 || (families.size === 1 && families.has(family))).toBe(true);
      }),
    );
  });
});

describe('toggleEmphasis', () => {
  it('toggles bold and italic where the family has them', () => {
    const doc = fromText('Hi');
    const all = everything(doc);
    const bold = toggleEmphasis(doc, all, 'bold');
    expect(output(bold)).toBe('𝐇𝐢');
    expect(output(toggleEmphasis(bold, all, 'bold'))).toBe('Hi');
    expect(output(toggleEmphasis(bold, all, 'italic'))).toBe('𝑯𝒊');
    const script = setFamily(doc, all, 'script');
    expect(output(toggleEmphasis(script, all, 'bold'))).toBe('𝓗𝓲');
  });

  it('returns the same document when the family cannot express it', () => {
    const doc = fromText('Hi');
    const mono = setFamily(doc, everything(doc), 'monospace');
    expect(toggleEmphasis(mono, everything(mono), 'bold')).toBe(mono);
    const script = fromText('ℋ𝒾');
    expect(toggleEmphasis(script, everything(script), 'italic')).toBe(script);
  });
});

describe('editBounds', () => {
  it('finds insertions, deletions and replacements', () => {
    expect(editBounds('abc', 'abXc')).toEqual({ start: 2, beforeEnd: 2, afterEnd: 3 });
    expect(editBounds('abc', 'ac')).toEqual({ start: 1, beforeEnd: 2, afterEnd: 1 });
    expect(editBounds('abc', 'aXYc')).toEqual({ start: 1, beforeEnd: 2, afterEnd: 3 });
    expect(editBounds('same', 'same')).toEqual({ start: 4, beforeEnd: 4, afterEnd: 4 });
  });

  it('never splits a surrogate pair', () => {
    // Bold A and bold H share their high surrogate.
    expect(editBounds('𝐇', '𝐀𝐇')).toEqual({ start: 0, beforeEnd: 0, afterEnd: 2 });
    expect(editBounds('a𝐇', 'a𝐀𝐇')).toEqual({ start: 1, beforeEnd: 1, afterEnd: 3 });
    // Same low surrogate, different high surrogate.
    expect(editBounds('𝐀', '𝀀')).toEqual({
      start: 0,
      beforeEnd: 2,
      afterEnd: 2,
    });
  });
});

describe('applyEdit', () => {
  const edit = (doc: Document, after: string): Document => applyEdit(doc, render(doc), after);

  it('returns the same document when nothing changed', () => {
    const doc = fromText('𝐇𝐢');
    expect(edit(doc, '𝐇𝐢')).toBe(doc);
  });

  it('continues the style of the character before the typed text', () => {
    const doc = fromText('𝐇𝐢');
    expect(output(edit(doc, '𝐇𝐢x'))).toBe('𝐇𝐢𝐱');
    const spaced = edit(doc, '𝐇𝐢 ');
    expect(output(edit(spaced, '𝐇𝐢 x'))).toBe('𝐇𝐢 𝐱');
    expect(output(edit(fromText('ab'), 'axb'))).toBe('axb');
  });

  it('does not carry a style across a line break or into the start of the text', () => {
    const doc = fromText('𝐇𝐢');
    expect(output(edit(doc, '𝐇𝐢\nx'))).toBe('𝐇𝐢\nx');
    expect(output(edit(doc, 'x𝐇𝐢'))).toBe('x𝐇𝐢');
    expect(output(edit(doc, '𝐇𝐢\r\nx'))).toBe('𝐇𝐢\nx');
  });

  it('keeps the styles of pasted styled text and handles deletion', () => {
    const doc = fromText('𝐇𝐢');
    expect(output(edit(doc, '𝐇𝐢𝖠'))).toBe('𝐇𝐢𝖠');
    expect(output(edit(doc, '𝐇'))).toBe('𝐇');
  });

  it('never changes what the user typed, only how it is styled', () => {
    const insertion = arb.document.chain((doc) => {
      const text = render(doc).output;
      return fc.record({
        doc: fc.constant(doc),
        at: fc.nat({ max: text.length }),
        typed: fc.string({ unit: 'grapheme-ascii', maxLength: 4 }),
      });
    });
    fc.assert(
      fc.property(insertion, ({ doc, at, typed }) => {
        const before = render(doc).output;
        const low = before.charCodeAt(at);
        const cut = low >= 0xdc00 && low <= 0xdfff ? at - 1 : at;
        const after = before.slice(0, cut) + typed + before.slice(cut);
        const next = applyEdit(doc, render(doc), after, sequentialIds('e'));
        expect(validate(next)).toEqual([]);
        expect(sourceText(next)).toBe(normalize(toLf(after)));
      }),
    );
  });
});
