// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Unicode → ASCII: the inverse of rendering.
 *
 * `normalize` is deliberately narrower than NFKC. NFKC does fold mathematical
 * alphanumerics back to ASCII (which is why platform-side normalization would
 * fix the accessibility problem outright, spec §7.3), but it also rewrites
 * ligatures, fullwidth forms, superscripts and more. Source text may contain
 * those legitimately, and folding them would break round-trip.
 */

import { fold, isAsciiAlnum } from './alphabets';
import type { AlphabetId } from './alphabets';
import { DECORATIONS, decorationOfMark, isDecorationMark } from './decorations';
import type { Decoration } from './decorations';
import type { StyleKind, StyleSet } from './grammar';
import { clusters } from './graphemes';
import { styleOfAlphabet } from './style';
import { at } from './util';

/**
 * Replace every codepoint ProseEdge can emit with its ASCII source.
 *
 * Decoration marks are dropped outright rather than folded: they add no letter
 * of their own, so removing them is what makes an underlined post normalize
 * back to the text it was written from (ADR 0010).
 */
export function normalize(text: string): string {
  let out = '';
  for (const ch of text) {
    if (isDecorationMark(ch)) continue;
    const cp = ch.codePointAt(0);
    const folded = cp === undefined ? undefined : fold(cp);
    out += folded ? folded.ascii : ch;
  }
  return out;
}

export interface StyledRun {
  /** Normalized source text. */
  readonly text: string;
  readonly style: StyleSet;
}

/**
 * What a run is styled with: an alphabet (or `null` for plain letters) plus any
 * combining marks on it. Two runs join only when both halves agree, so
 * `𝗯𝗼𝗹𝗱` and `𝗯̲𝗼̲𝗹̲𝗱̲` never merge into one span.
 */
interface Tag {
  readonly alphabet: AlphabetId | null;
  readonly decorations: readonly Decoration[];
}

const PLAIN: Tag = { alphabet: null, decorations: [] };

const sameTag = (a: Tag, b: Tag): boolean =>
  a.alphabet === b.alphabet &&
  a.decorations.length === b.decorations.length &&
  a.decorations.every((decoration, i) => decoration === b.decorations[i]);

/** The decorations on a cluster, in `DECORATIONS` order, and the text without them. */
function splitDecorations(cluster: string): { base: string; decorations: readonly Decoration[] } {
  const found = new Set<Decoration>();
  let base = '';
  for (const ch of cluster) {
    const decoration = decorationOfMark(ch);
    if (decoration === undefined) base += ch;
    else found.add(decoration);
  }
  return { base, decorations: DECORATIONS.filter((decoration) => found.has(decoration)) };
}

/**
 * Recover source text and styles from already-styled text, e.g. a pasted post.
 *
 * Letters and digits carry their style. Everything else (spaces, punctuation,
 * emoji) is neutral and joins the surrounding run when both neighbours agree,
 * so `𝗛𝗲𝗹𝗹𝗼, 𝘄𝗼𝗿𝗹𝗱!` comes back as one run rather than five.
 */
export function parseStyled(text: string): StyledRun[] {
  const tags: (Tag | 'neutral')[] = [];
  const texts: string[] = [];
  for (const cluster of clusters(text)) {
    // A decorated letter is a base codepoint plus its marks, so strip the marks
    // before asking which alphabet the letter underneath came from.
    const { base, decorations } = splitDecorations(cluster.text);
    const codepoints = [...base];
    const only = codepoints.length === 1 ? codepoints[0] : undefined;
    const cp = only?.codePointAt(0);
    const folded = cp === undefined ? undefined : fold(cp);
    if (folded) {
      tags.push({ alphabet: folded.alphabet, decorations });
      texts.push(folded.ascii);
    } else if (only !== undefined && isAsciiAlnum(only)) {
      /*
       * A letter is never neutral, even undecorated. Neutral characters take
       * their style from their neighbours, so treating a plain letter as one
       * would let it be absorbed into an adjacent styled run: `𝐛𝐨b` would come
       * back as one bold run rather than a bold run and a plain letter.
       */
      tags.push({ alphabet: null, decorations });
      texts.push(only);
    } else {
      tags.push('neutral');
      texts.push(normalize(cluster.text));
    }
  }

  const previous: (Tag | undefined)[] = [];
  let last: Tag | undefined;
  for (const tag of tags) {
    previous.push(last);
    if (tag !== 'neutral') last = tag;
  }
  const next: (Tag | undefined)[] = new Array<Tag | undefined>(tags.length);
  last = undefined;
  for (let i = tags.length - 1; i >= 0; i--) {
    next[i] = last;
    const tag = at(tags, i);
    if (tag !== 'neutral') last = tag;
  }

  const runs: StyledRun[] = [];
  let buffer = '';
  let current: Tag = PLAIN;
  tags.forEach((tag, i) => {
    let resolved: Tag;
    if (tag !== 'neutral') {
      resolved = tag;
    } else {
      const p = previous[i];
      const n = next[i];
      if (p === undefined) resolved = n ?? PLAIN;
      else if (n === undefined || sameTag(p, n)) resolved = p;
      else resolved = PLAIN;
    }
    if (buffer.length > 0 && !sameTag(resolved, current)) {
      runs.push({ text: buffer, style: styleOf(current) });
      buffer = '';
    }
    current = resolved;
    buffer += at(texts, i);
  });
  if (buffer.length > 0) runs.push({ text: buffer, style: styleOf(current) });
  return runs;
}

function styleOf(tag: Tag): StyleSet {
  const style = new Set<StyleKind>(tag.alphabet === null ? [] : [...styleOfAlphabet(tag.alphabet)]);
  for (const decoration of tag.decorations) style.add(decoration);
  return style;
}
