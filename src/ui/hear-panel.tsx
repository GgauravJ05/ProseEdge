// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useMemo } from 'react';

import { announce } from '../analysis/transcript';

interface HearPanelProps {
  /** The styled post, exactly as it would be pasted. */
  readonly output: string;
}

/**
 * The post the way a screen reader may read it: plain runs as written, and
 * each styled character as the name Unicode gives it, which is what many
 * readers announce in place of the letter. The names come from the Unicode
 * Character Database (src/analysis/transcript.ts), not from a recording of any
 * one screen reader, so the panel says "may".
 *
 * Only shown when something is styled: an unstyled post reads exactly as
 * written, and repeating it here would just be the post twice.
 */
export function HearPanel({ output }: HearPanelProps) {
  const segments = useMemo(() => announce(output), [output]);
  return (
    // A long, heavily styled post reads out far longer than it looks, so the
    // transcript scrolls; as a focusable region it scrolls from the keyboard too.
    <div
      className="transcript"
      role="region"
      tabIndex={0}
      aria-label="What a screen reader may say"
    >
      {segments.map((segment, index) => {
        if (segment.kind === 'text') return <span key={index}>{segment.text}</span>;
        const next = segments[index + 1];
        return (
          <span key={index} className="said">
            {segment.text}
            {next?.kind === 'name' ? ', ' : ''}
          </span>
        );
      })}
    </div>
  );
}
