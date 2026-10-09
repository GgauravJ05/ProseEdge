// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { magnetOffset, sheenPosition, type Box } from './geometry';
import { groupVariants, itemVariants, MAGNET_MAX, PRESS_SCALE, RISE, SPRING } from './presets';

const box: Box = { left: 100, top: 50, width: 200, height: 40 };

const arbBox = fc.record({
  left: fc.integer({ min: -2000, max: 2000 }),
  top: fc.integer({ min: -2000, max: 2000 }),
  width: fc.integer({ min: 1, max: 2000 }),
  height: fc.integer({ min: 1, max: 2000 }),
});
const arbPoint = fc.record({
  x: fc.integer({ min: -10_000, max: 10_000 }),
  y: fc.integer({ min: -10_000, max: 10_000 }),
});

describe('magnetOffset', () => {
  it('does not move when the pointer is at the centre', () => {
    expect(magnetOffset(box, { x: 200, y: 70 }, 6)).toEqual({ x: 0, y: 0 });
  });

  it('leans toward the pointer', () => {
    const offset = magnetOffset(box, { x: 250, y: 60 }, 6);
    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBeLessThan(0);
  });

  it('reaches the cap at the edge and no further', () => {
    expect(magnetOffset(box, { x: 300, y: 70 }, 6).x).toBe(6);
    expect(magnetOffset(box, { x: 9000, y: 70 }, 6).x).toBe(6);
    expect(magnetOffset(box, { x: -9000, y: 70 }, 6).x).toBe(-6);
  });

  it('stays still for a box with no area', () => {
    expect(magnetOffset({ left: 0, top: 0, width: 0, height: 10 }, { x: 5, y: 5 }, 6)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('never exceeds the cap, wherever the pointer is', () => {
    fc.assert(
      fc.property(arbBox, arbPoint, fc.integer({ min: 0, max: 40 }), (b, p, max) => {
        const { x, y } = magnetOffset(b, p, max);
        expect(Math.abs(x)).toBeLessThanOrEqual(max);
        expect(Math.abs(y)).toBeLessThanOrEqual(max);
      }),
    );
  });
});

describe('sheenPosition', () => {
  it('reports the pointer as a percentage of the box', () => {
    expect(sheenPosition(box, { x: 200, y: 70 })).toEqual({ x: 50, y: 50 });
    expect(sheenPosition(box, { x: 100, y: 50 })).toEqual({ x: 0, y: 0 });
  });

  it('falls back to the centre for a box with no area', () => {
    expect(sheenPosition({ left: 0, top: 0, width: 10, height: 0 }, { x: 1, y: 1 })).toEqual({
      x: 50,
      y: 50,
    });
  });

  it('stays inside 0–100 however far the pointer strays', () => {
    fc.assert(
      fc.property(arbBox, arbPoint, (b, p) => {
        const { x, y } = sheenPosition(b, p);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }),
    );
  });
});

describe('presets', () => {
  it('keeps the motion small enough to read as polish', () => {
    expect(RISE).toBeLessThanOrEqual(24);
    expect(MAGNET_MAX).toBeLessThanOrEqual(8);
    expect(PRESS_SCALE).toBeGreaterThan(0.9);
    expect(PRESS_SCALE).toBeLessThan(1);
    expect(SPRING.type).toBe('spring');
  });

  it('reveals an item upward into place, and staggers a group', () => {
    expect(itemVariants.hidden.opacity).toBe(0);
    expect(itemVariants.visible).toMatchObject({ opacity: 1, y: 0 });
    expect(groupVariants.visible.transition.staggerChildren).toBeGreaterThan(0);
  });
});
