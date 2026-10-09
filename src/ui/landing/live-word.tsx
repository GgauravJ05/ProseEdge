// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { inStyle } from '../specimens';
import { SHOWCASE } from './samples';

/**
 * A word that keeps changing alphabet: the headline demonstrating its own
 * claim. Readers of the heading get the plain word; the styled one is
 * decoration and hidden from assistive technology, which is exactly the point
 * the page is making.
 */
export function LiveWord({ word, interval = 2200 }: Readonly<{ word: string; interval?: number }>) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const timer = window.setInterval(() => {
      setIndex((n) => (n + 1) % SHOWCASE.length);
    }, interval);
    return () => {
      window.clearInterval(timer);
    };
  }, [interval, paused, reduced]);

  const spec = SHOWCASE[index] ?? SHOWCASE[0];
  const styled = spec ? inStyle(word, spec) : word;

  return (
    <span
      className="live-word"
      onPointerEnter={() => {
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
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
