// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { inStyle } from '../specimens';
import { SHOWCASE } from './samples';

/**
 * A word that changes alphabet: the headline demonstrating its own claim.
 * Readers of the heading get the plain word; the styled one is decoration and
 * hidden from assistive technology, which is exactly the point the page makes.
 *
 * It plays one short round and settles back on the first style, so the page
 * comes to rest: WCAG 2.2.2 asks that motion which starts on its own either
 * stop within five seconds or offer a way to pause it. Pointing at the word
 * plays the round again.
 */
export function LiveWord({
  word,
  interval = 1100,
  steps = 4,
}: Readonly<{ word: string; interval?: number; steps?: number }>) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let changes = 0;
    const timer = window.setInterval(() => {
      changes += 1;
      if (changes >= steps) {
        window.clearInterval(timer);
        setIndex(0);
      } else {
        setIndex(changes % SHOWCASE.length);
      }
    }, interval);
    return () => {
      window.clearInterval(timer);
    };
  }, [interval, reduced, round, steps]);

  const spec = SHOWCASE[index] ?? SHOWCASE[0];
  const styled = spec ? inStyle(word, spec) : word;

  return (
    <span
      className="live-word"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setRound((n) => n + 1);
      }}
    >
      <span className="visually-hidden">{word}</span>
      <span className="live-word-track" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={styled}
            className="live-word-glyphs"
            initial={{ y: '0.45em', opacity: 0, filter: 'blur(6px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: '-0.45em', opacity: 0, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {styled}
          </m.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
