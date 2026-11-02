// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import {
  animate,
  m,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { CountUp } from '../motion/count-up';
import { sheenPosition } from '../motion/geometry';
import { Segmented } from '../motion/segmented';
import { Announcement } from './announcement';
import {
  chipLabel,
  HERO_POST,
  plainPost,
  sampleFacts,
  SHOWCASE,
  specimen,
  styledPost,
} from './samples';

const OPTIONS = SHOWCASE.map((spec) => ({ id: spec.id, label: chipLabel(spec) }));

/**
 * One post, two ways: as readers see it, and as a screen reader may announce
 * it. A divider wipes between them; drag it, or focus it and use the arrow
 * keys. On first sight it sweeps once on its own, so the reader knows it moves.
 */
export function BeforeAfter() {
  const [styleId, setStyleId] = useState<string>('sans_bold');
  const spec = specimen(styleId);
  const styled = styledPost(HERO_POST, spec);
  const facts = sampleFacts(HERO_POST, spec);

  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { once: true });
  const reduced = useReducedMotion();
  const position = useMotionValue(50);
  const [now, setNow] = useState(50);
  const dragging = useRef(false);
  useMotionValueEvent(position, 'change', (value) => {
    setNow(Math.round(value));
  });
  const clip = useMotionTemplate`inset(0 0 0 ${position}%)`;
  const left = useMotionTemplate`${position}%`;

  useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(position, [50, 76, 28, 50], {
      duration: 2.8,
      delay: 0.7,
      ease: 'easeInOut',
    });
    return () => {
      controls.stop();
    };
  }, [inView, position, reduced]);

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    position.stop();
    position.set(sheenPosition(box, { x: event.clientX, y: event.clientY }).x);
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 20 : 5;
    const next: Record<string, number> = {
      ArrowLeft: now - step,
      ArrowDown: now - step,
      ArrowRight: now + step,
      ArrowUp: now + step,
      Home: 0,
      End: 100,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    position.stop();
    animate(position, Math.min(100, Math.max(0, target)), {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    });
  };

  return (
    <div className="ba">
      <div
        ref={frame}
        className="ba-frame"
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveTo(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current) moveTo(event);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <div className="ba-layer ba-seen">
          <span className="ba-tag mono">What readers see</span>
          <p className="ba-post" aria-hidden="true">
            {styled}
          </p>
          <p className="visually-hidden">
            The sample post, {plainPost(HERO_POST)}, with its opening styled in {chipLabel(spec)}.
          </p>
        </div>
        <m.div className="ba-layer ba-heard" style={{ clipPath: clip }}>
          <span className="ba-tag mono">What a screen reader may hear</span>
          <p className="ba-post ba-said">
            <Announcement text={styled} />
          </p>
        </m.div>
        <m.div
          className="ba-handle"
          style={{ left }}
          role="slider"
          tabIndex={0}
          aria-label="Compare what readers see with what a screen reader may hear"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={now}
          aria-valuetext={`${String(100 - now)}% of the announcement showing`}
          onKeyDown={nudge}
        >
          <span className="ba-grip" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path
                d="M6 4 2 8l4 4M10 4l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </m.div>
      </div>
      <Segmented
        label="Style the opening"
        options={OPTIONS}
        value={styleId}
        onChange={setStyleId}
      />
      <dl className="ba-facts">
        <div>
          <dt className="mono">Read by name</dt>
          <dd>
            <CountUp value={facts.named} />{' '}
            <span className="unit">of {facts.letters} characters</span>
          </dd>
        </div>
        <div>
          <dt className="mono">LinkedIn counts</dt>
          <dd>
            <CountUp value={facts.linkedin} />{' '}
            <span className="unit">+{facts.linkedinCost} for styling</span>
          </dd>
        </div>
        <div>
          <dt className="mono">X counts</dt>
          <dd>
            <CountUp value={facts.x} /> <span className="unit">styling is free</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
