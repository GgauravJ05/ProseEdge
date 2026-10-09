// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { domAnimation, LazyMotion, MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Loads the animation features once, lazily, for everything below it.
 *
 * `LazyMotion` keeps the library's weight to the small `m` components plus
 * the DOM animation feature set (no drag, no layout animation), and `strict`
 * makes a stray full `motion.*` import fail loudly instead of quietly pulling
 * the whole bundle back in. `reducedMotion="user"` drops transform animations
 * for anyone who asked their system for less movement.
 */
export function MotionRoot({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
