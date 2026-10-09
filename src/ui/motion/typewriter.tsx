// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Reveals its text a few characters at a time once it is in view, with a
 * caret while it types. The whole text is in the accessible name from the
 * start, so assistive technology never hears a half-typed sentence.
 */
export function Typewriter({
  text,
  render,
  speed = 18,
  replay = true,
  className,
}: Readonly<{
  text: string;
  /** Renders the visible prefix; defaults to the plain characters. */
  render?: (visible: string) => ReactNode;
  /** Milliseconds per character. */
  speed?: number;
  /** Offer a Replay button once it finishes. Off inside anything aria-hidden. */
  replay?: boolean;
  className?: string;
}>) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState(0);
  /*
   * Set only once a run has typed to the end. Rendering the Replay button from
   * the motion preference instead would differ between the prerender (which
   * cannot know it) and the first client render, and that hydration mismatch
   * makes React throw the whole page away and rebuild it.
   */
  const [played, setPlayed] = useState(false);
  // Until it is in view (and always under reduced motion) the whole text shows.
  const animating = inView && reduced !== true;

  useEffect(() => {
    if (!animating) return;
    const timer = window.setInterval(() => {
      setProgress((n) => {
        if (n >= text.length) {
          window.clearInterval(timer);
          setPlayed(true);
          return n;
        }
        return n + 1;
      });
    }, speed);
    return () => {
      window.clearInterval(timer);
    };
  }, [animating, run, speed, text]);

  const shown = animating ? Math.min(progress, text.length) : text.length;
  const visible = text.slice(0, shown);
  const typing = shown < text.length;

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">
        {render ? render(visible) : visible}
        <span className={typing ? 'caret typing' : 'caret'} />
      </span>
      <span className="visually-hidden">{text}</span>
      {replay && played && !typing && (
        <button
          type="button"
          className="replay"
          onClick={() => {
            setProgress(0);
            setRun((n) => n + 1);
          }}
        >
          Replay
        </button>
      )}
    </span>
  );
}
