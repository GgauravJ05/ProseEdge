// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import {
  animate,
  m,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { useEffect, useRef } from 'react';

const format = (value: number): string => Math.round(value).toLocaleString('en-US');

/**
 * A number that counts up the first time it scrolls into view, and glides to
 * its new value whenever it changes after that.
 *
 * The prerendered markup carries the final value, so a reader without
 * JavaScript, a crawler and a test all see the true number. The text is a
 * motion value rendered by framer-motion, never React text that a DOM write
 * would desynchronise.
 */
export function CountUp({ value, className }: Readonly<{ value: number; className?: string }>) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduced = useReducedMotion();
  const current = useMotionValue(value);
  const text = useTransform(current, format);
  const started = useRef(false);

  useEffect(() => {
    // Until it has been seen, and always under reduced motion, it simply tracks the value.
    if (!inView || reduced) {
      current.set(value);
      return;
    }
    if (!started.current) {
      started.current = true;
      current.set(0);
    }
    const controls = animate(current, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1] });
    return () => {
      controls.stop();
    };
  }, [current, inView, reduced, value]);

  return (
    <m.span ref={ref} className={className}>
      {text}
    </m.span>
  );
}
