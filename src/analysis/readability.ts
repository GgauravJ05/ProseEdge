// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Flesch–Kincaid grade level (spec §3, analysis layer), computed on the plain
 * source so a styled letter counts as the letter it is.
 *
 * It is an English-language estimate: syllables are counted with a heuristic,
 * and on very short text the score swings widely. The UI says both.
 */

export interface Readability {
  readonly words: number;
  readonly sentences: number;
  readonly syllables: number;
  /** Flesch–Kincaid grade, or `null` when there are no words to score. */
  readonly grade: number | null;
}

const WORDS = /[A-Za-z]+(?:['’][A-Za-z]+)*/gu;
const HAS_LETTER = /[A-Za-z]/u;
/** Closing punctuation with more text after it on the same line. */
const SENTENCE_BREAK = /[.!?]+(?=\s)/gu;

/** Vowel groups, less a silent final "e", and never fewer than one. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/['’]/gu, '');
  let count = w.match(/[aeiouy]+/gu)?.length ?? 0;
  if (count > 1 && w.endsWith('e') && !w.endsWith('le') && !/[aeiouy]e$/u.test(w)) count -= 1;
  return Math.max(1, count);
}

export function readability(text: string): Readability {
  const words = text.match(WORDS) ?? [];
  const syllableCount = words.reduce((sum, word) => sum + syllables(word), 0);
  // Every line with words ends a sentence, with or without a full stop: posts
  // often skip them. Punctuation followed by more text marks the others.
  let sentences = 0;
  for (const line of text.split('\n')) {
    if (!HAS_LETTER.test(line)) continue;
    sentences += (line.trimEnd().match(SENTENCE_BREAK)?.length ?? 0) + 1;
  }
  const grade =
    words.length === 0
      ? null
      : 0.39 * (words.length / sentences) + 11.8 * (syllableCount / words.length) - 15.59;
  return { words: words.length, sentences, syllables: syllableCount, grade };
}
