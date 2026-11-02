// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { m, useMotionValue, useSpring } from 'framer-motion';
import type { PointerEvent, ReactNode } from 'react';

import { magnetOffset } from './geometry';
import { MAGNET_MAX, MAGNET_SPRING, PRESS_SCALE } from './presets';

/**
 * Wraps a button or link so it leans toward a mouse pointer and shrinks a
 * little when pressed.
 *
 * Only a mouse leans: touch and pen have no hover, so a lean would just be a
 * jolt under the finger. The wrapper moves, the control inside does not, so
 * its focus ring, hit area and accessible name are exactly what they were.
 */
export function Magnetic({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, MAGNET_SPRING);
  const springY = useSpring(y, MAGNET_SPRING);

  const lean = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const offset = magnetOffset(
      event.currentTarget.getBoundingClientRect(),
      { x: event.clientX, y: event.clientY },
      MAGNET_MAX,
    );
    x.set(offset.x);
    y.set(offset.y);
  };

  const settle = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <m.span
      className={className}
      style={{ display: 'inline-flex', x: springX, y: springY }}
      whileTap={{ scale: PRESS_SCALE }}
      onPointerMove={lean}
      onPointerLeave={settle}
      onPointerCancel={settle}
    >
      {children}
    </m.span>
  );
}
