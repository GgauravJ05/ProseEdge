// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { m } from 'framer-motion';
import { useState } from 'react';

import { budget, PLATFORMS } from '../../analysis/platforms';
import { CountUp } from '../motion/count-up';
import { Segmented } from '../motion/segmented';
import { METER_PLATFORMS, METER_POST, plainPost, specimen, styledPost } from './samples';

const STYLED = styledPost(METER_POST, specimen('sans_bold'));
const PLAIN = plainPost(METER_POST);

/** The same post against each feed's limit, styled or plain, recounted live. */
export function PlatformMeters() {
  const [mode, setMode] = useState<string>('styled');
  const text = mode === 'styled' ? STYLED : PLAIN;

  return (
    <div className="meters">
      <Segmented
        label="Count the post"
        options={[
          { id: 'styled', label: 'With a bold opening' },
          { id: 'plain', label: 'Plain' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <ul className="meter-grid">
        {METER_PLATFORMS.map((id) => {
          const platform = PLATFORMS[id];
          const spent = budget(text, PLAIN, platform);
          const limit = platform.limit ?? 1;
          return (
            <li key={id} className="meter-card">
              <span className="meter-name">{platform.label}</span>
              <span className="meter-count">
                <CountUp value={spent.used} className="mono" />
                <span className="unit"> / {limit.toLocaleString('en-US')}</span>
              </span>
              <span className="meter-track" aria-hidden="true">
                <m.span
                  className="meter-bar"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.min(1, spent.used / limit) }}
                  transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                />
              </span>
              <span className="meter-note">
                {spent.styleCost > 0
                  ? `Styling adds ${String(spent.styleCost)}`
                  : 'Styling is free here'}
                {platform.confidence === 'assumed' ? ' · counting assumed, not verified' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
