// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { announce } from '../../analysis/transcript';

/**
 * A post as a screen reader may announce it: plain runs as written, and each
 * styled character as its Unicode name, set apart so the cost is visible.
 */
export function Announcement({ text }: Readonly<{ text: string }>) {
  const segments = announce(text);
  return (
    <>
      {segments.map((segment, i) =>
        segment.kind === 'text' ? (
          <span key={i}>{segment.text}</span>
        ) : (
          <span key={i} className="said">
            {segment.text}
            {segments[i + 1]?.kind === 'name' ? ', ' : ''}
          </span>
        ),
      )}
    </>
  );
}
