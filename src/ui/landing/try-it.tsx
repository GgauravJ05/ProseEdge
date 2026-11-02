// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { AnimatePresence, m } from 'framer-motion';
import { useId, useRef, useState } from 'react';

import { namedCount } from '../../analysis/transcript';
import { CountUp } from '../motion/count-up';
import { itemVariants, groupVariants } from '../motion/presets';
import { inStyle } from '../specimens';
import { chipLabel, specimen } from './samples';

const ROWS = [
  'sans_bold',
  'italic',
  'bold_script',
  'fraktur',
  'doublestruck',
  'monospace',
  'underline',
].map(specimen);

/**
 * Type anything and watch it in every alphabet at once, with the cost of each
 * — how many characters a screen reader may read out by name — beside it.
 */
export function TryIt() {
  const id = useId();
  const [text, setText] = useState('Write the post. Keep the words.');
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const copy = (rowId: string, value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(rowId);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setCopied(null);
      }, 1400);
    });
  };

  return (
    <div className="try">
      <label htmlFor={id} className="try-label">
        Type anything
      </label>
      <input
        id={id}
        className="try-input"
        value={text}
        maxLength={80}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <m.ul
        className="try-rows"
        variants={groupVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        data-reveal
      >
        {ROWS.map((row) => {
          const styled = inStyle(text, row);
          const label = chipLabel(row);
          return (
            <m.li key={row.id} className="try-row" variants={itemVariants}>
              <span className="try-name mono">{label}</span>
              <span className="try-sample" aria-hidden="true">
                {styled === '' ? ' ' : styled}
              </span>
              <span className="visually-hidden">{label} version of your text</span>
              <span className="try-cost">
                <CountUp value={namedCount(styled)} /> <span className="unit">read by name</span>
              </span>
              <button
                type="button"
                className="try-copy"
                aria-label={`Copy the ${label} version`}
                disabled={text === ''}
                onClick={() => {
                  copy(row.id, styled);
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.span
                    key={copied === row.id ? 'done' : 'idle'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    {copied === row.id ? 'Copied' : 'Copy'}
                  </m.span>
                </AnimatePresence>
              </button>
            </m.li>
          );
        })}
      </m.ul>
    </div>
  );
}
