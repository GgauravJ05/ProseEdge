// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { placeBubble } from './bubble';
import type { Placement, SelectionBox } from './bubble';

/*
 * Everything that changes where text wraps. The mirror has to lay the text out
 * exactly as the textarea does, or the bar points at the wrong words.
 */
const COPIED = [
  'boxSizing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'wordSpacing',
  'tabSize',
] as const;

/**
 * Measure a textarea's selection, relative to the textarea's offset parent.
 *
 * A textarea exposes offsets but no geometry, so its text is laid out again in
 * an invisible mirror with the same metrics and the selected run is measured
 * there. Returns `null` for an empty selection.
 */
function measure(el: HTMLTextAreaElement): SelectionBox | null {
  const { selectionStart: start, selectionEnd: end, value } = el;
  if (start === end) return null;

  const style = window.getComputedStyle(el);
  const mirror = document.createElement('div');
  for (const property of COPIED) mirror.style[property] = style[property];
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '-9999px',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    width: `${String(el.offsetWidth)}px`,
  });
  mirror.append(value.slice(0, start));
  const run = document.createElement('span');
  run.textContent = value.slice(start, end);
  mirror.append(run);
  document.body.append(mirror);

  const base = mirror.getBoundingClientRect();
  const lines = run.getClientRects();
  const first = lines[0];
  const last = lines[lines.length - 1];
  mirror.remove();
  if (first === undefined || last === undefined) return null;

  const offsetTop = el.offsetTop - el.scrollTop - base.top;
  return {
    top: first.top + offsetTop,
    bottom: last.bottom + offsetTop,
    center: el.offsetLeft + first.left - base.left + first.width / 2,
  };
}

interface SelectionBubbleProps {
  readonly textarea: RefObject<HTMLTextAreaElement | null>;
  /** Changes whenever the selection or the text does, so the bar re-measures. */
  readonly revision: string;
  readonly hidden: boolean;
  readonly children: ReactNode;
}

/**
 * The small bar that appears over selected words, for a mouse.
 *
 * It repeats the emphasis buttons from the toolbar where the pointer already
 * is. Because it only repeats them, it stays out of the accessibility tree and
 * the tab order: keyboard and screen-reader users have the same commands, once,
 * in the toolbar. On touch screens it never appears, because the system's own
 * selection menu would sit on top of it.
 */
export function SelectionBubble({ textarea, revision, hidden, children }: SelectionBubbleProps) {
  const bar = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const el = textarea.current;
    const own = bar.current;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const frame = el?.offsetParent;
    if (hidden || !fine || el === null || own === null || !(frame instanceof HTMLElement)) {
      setPlacement(null);
      return;
    }
    const update = () => {
      const box = document.activeElement === el ? measure(el) : null;
      setPlacement(
        box === null
          ? null
          : placeBubble(
              box,
              { width: own.offsetWidth, height: own.offsetHeight },
              { width: frame.clientWidth, height: frame.clientHeight },
            ),
      );
    };
    update();
    el.addEventListener('scroll', update);
    el.addEventListener('blur', update);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('blur', update);
      window.removeEventListener('resize', update);
    };
  }, [textarea, revision, hidden]);

  return (
    <div
      ref={bar}
      aria-hidden="true"
      className="bubble"
      data-side={placement?.side}
      data-open={placement !== null}
      style={placement === null ? undefined : { left: placement.left, top: placement.top }}
      // Keep the textarea focused, so the selection survives the click.
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}
