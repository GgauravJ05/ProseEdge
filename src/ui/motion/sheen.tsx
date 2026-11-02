// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import type { PointerEvent, ReactNode } from 'react';

import { sheenPosition } from './geometry';

/**
 * A surface with a soft light reflection that follows the pointer.
 *
 * The position is written straight to two CSS custom properties, so moving the
 * pointer never re-renders React. The highlight itself is drawn by `.sheen`
 * in globals.css and only shows on a hover-capable device.
 */
export function Sheen({
  as: Tag = 'div',
  children,
  className,
}: Readonly<{ as?: 'div' | 'article' | 'li'; children: ReactNode; className?: string }>) {
  const track = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const { x, y } = sheenPosition(event.currentTarget.getBoundingClientRect(), {
      x: event.clientX,
      y: event.clientY,
    });
    event.currentTarget.style.setProperty('--sx', `${x.toFixed(1)}%`);
    event.currentTarget.style.setProperty('--sy', `${y.toFixed(1)}%`);
  };

  return (
    <Tag className={className ? `sheen ${className}` : 'sheen'} onPointerMove={track}>
      {children}
    </Tag>
  );
}
