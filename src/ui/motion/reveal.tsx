// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { m, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

import { groupVariants, itemVariants } from './presets';

interface RevealProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/*
 * The hidden state is part of the prerendered markup, so a page without
 * JavaScript would stay invisible; layout.tsx carries a <noscript> rule that
 * overrides [data-reveal] for that case. Under reduced motion the content is
 * shown at once instead of waiting to scroll into view.
 */

/** Fades up into place when it scrolls into view. */
export function Reveal({ children, className }: RevealProps) {
  const reduced = useReducedMotion();
  return (
    <m.div
      data-reveal
      className={className}
      variants={itemVariants}
      initial="hidden"
      {...(reduced ? { animate: 'visible' } : {})}
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    >
      {children}
    </m.div>
  );
}

/** A group whose `RevealItem` children arrive one after another. */
export function RevealGroup({ children, className }: RevealProps) {
  const reduced = useReducedMotion();
  return (
    <m.div
      data-reveal
      className={className}
      variants={groupVariants}
      initial="hidden"
      {...(reduced ? { animate: 'visible' } : {})}
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    >
      {children}
    </m.div>
  );
}

export function RevealItem({ children, className }: RevealProps) {
  return (
    <m.div className={className} variants={itemVariants}>
      {children}
    </m.div>
  );
}
