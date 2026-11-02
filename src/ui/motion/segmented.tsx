// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { m } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';

import { SPRING } from './presets';

interface Option {
  readonly id: string;
  readonly label: string;
}

/**
 * A row of toggle buttons with a highlight that slides to the pressed one.
 *
 * Each option is a real button with `aria-pressed`, inside a labelled group,
 * so it reads as a set of toggles and works from the keyboard as it is. The
 * highlight is measured from the pressed button and is purely decorative.
 */
export function Segmented({
  label,
  options,
  value,
  onChange,
  className,
}: Readonly<{
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}>) {
  const group = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const root = group.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!active) return;
      setPill({
        x: active.offsetLeft,
        y: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, [value]);

  return (
    <div
      ref={group}
      role="group"
      aria-label={label}
      className={className ? `segmented ${className}` : 'segmented'}
    >
      {pill && (
        <m.span
          aria-hidden="true"
          className="segmented-pill"
          initial={false}
          animate={pill}
          transition={SPRING}
        />
      )}
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === value}
          onClick={() => {
            onChange(option.id);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
