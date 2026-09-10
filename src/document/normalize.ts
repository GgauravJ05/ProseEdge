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
import type { StyleSet } from './grammar';
import { clusters } from './graphemes';
import { styleOfAlphabet } from './style';
import { at } from './util';

/** Replace every codepoint ProseEdge can emit with its ASCII source. */
export function normalize(text: string): string {
  let out = '';
  for (const ch of text) {
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

/** An alphabet, or `null` for plain text. */
type Tag = AlphabetId | null;

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
    const codepoints = [...cluster.text];
    const only = codepoints.length === 1 ? codepoints[0] : undefined;
    const cp = only?.codePointAt(0);
    const folded = cp === undefined ? undefined : fold(cp);
    if (folded) {
      tags.push(folded.alphabet);
      texts.push(folded.ascii);
    } else if (only !== undefined && isAsciiAlnum(only)) {
      tags.push(null);
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
  let current: Tag = null;
  tags.forEach((tag, i) => {
    let resolved: Tag;
    if (tag !== 'neutral') {
      resolved = tag;
    } else {
      const p = previous[i];
      const n = next[i];
      if (p === undefined) resolved = n ?? null;
      else if (n === undefined || p === n) resolved = p;
      else resolved = null;
    }
    if (buffer.length > 0 && resolved !== current) {
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
  return tag === null ? new Set() : styleOfAlphabet(tag);
}
