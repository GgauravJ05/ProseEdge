// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The arithmetic behind the pointer effects, kept apart from React so it can
 * be tested without a browser: where a magnetic button leans, and where the
 * light reflection sits on a card.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A client-space rectangle, as `getBoundingClientRect` reports it. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/**
 * How far a magnetic element leans toward the pointer, in pixels.
 *
 * The pull is proportional to how far the pointer is from the centre, measured
 * in half-widths and capped at one, so an element never travels further than
 * `max` however wide it is or however far outside it the pointer strays.
 */
export function magnetOffset(box: Box, pointer: Point, max: number): Point {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
  const dx = (pointer.x - (box.left + box.width / 2)) / (box.width / 2);
  const dy = (pointer.y - (box.top + box.height / 2)) / (box.height / 2);
  return { x: clamp(dx, -1, 1) * max, y: clamp(dy, -1, 1) * max };
}

/** The pointer as a percentage of the box, clamped to the box, for a CSS gradient origin. */
export function sheenPosition(box: Box, pointer: Point): Point {
  if (box.width <= 0 || box.height <= 0) return { x: 50, y: 50 };
  return {
    x: clamp(((pointer.x - box.left) / box.width) * 100, 0, 100),
    y: clamp(((pointer.y - box.top) / box.height) * 100, 0, 100),
  };
}
