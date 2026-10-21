// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/** Where a selection sits, in pixels from the editor's top-left corner. */
export interface SelectionBox {
  /** Top of the selection's first line. */
  readonly top: number;
  /** Bottom of the selection's last line. */
  readonly bottom: number;
  /** Horizontal centre of the selection's first line. */
  readonly center: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Placement {
  readonly left: number;
  readonly top: number;
  /** Which side of the selection the bar sits on. */
  readonly side: 'above' | 'below';
}

/** Space between the bar and the text it acts on. */
export const BUBBLE_GAP = 8;
/** The bar never touches the editor's edges. */
export const BUBBLE_INSET = 8;

/**
 * Place the selection bar: centred over the start of the selection, above it
 * when there is room, below its last line when there is not, and never past
 * either side of the editor.
 */
export function placeBubble(box: SelectionBox, bubble: Size, frame: Size): Placement {
  const maxLeft = Math.max(BUBBLE_INSET, frame.width - bubble.width - BUBBLE_INSET);
  const left = Math.min(maxLeft, Math.max(BUBBLE_INSET, box.center - bubble.width / 2));
  const above = box.top - BUBBLE_GAP - bubble.height;
  if (above >= BUBBLE_INSET) return { left, top: above, side: 'above' };
  return { left, top: box.bottom + BUBBLE_GAP, side: 'below' };
}
