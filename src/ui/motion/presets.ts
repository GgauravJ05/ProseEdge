// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Motion vocabulary shared by every animated surface, so the whole app moves
 * with one temperament: things rise a short way, settle on a soft spring, and
 * arrive one after another rather than all at once.
 */

/** A critically-damped-ish spring: settles quickly, overshoots barely. */
export const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 } as const;

/** A looser spring for the pointer-following lean, so it trails the cursor. */
export const MAGNET_SPRING = { stiffness: 220, damping: 18, mass: 0.6 } as const;

/** Seconds between siblings when a group reveals. */
export const STAGGER = 0.08;

/** How far a revealed element rises, in pixels. */
export const RISE = 18;

/** The most a magnetic element leans, in pixels. Small on purpose. */
export const MAGNET_MAX = 6;

/** A pressed control shrinks by this factor. */
export const PRESS_SCALE = 0.97;

export const itemVariants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: SPRING },
} as const;

export const groupVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER } },
} as const;
