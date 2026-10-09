// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useRef, useState } from 'react';

import { CheckIcon, CopyIcon } from './icons';
import { SPECIMENS, inStyle } from './specimens';

/** Enough of the post to recognise the style, without rendering it fourteen times over. */
const PREVIEW_LENGTH = 64;

interface StylePanelProps {
  /** The plain source, so switching specimens never compounds styling. */
  readonly text: string;
  readonly onCopy: (text: string, what: string) => void;
}

function preview(text: string): string {
  const line = text.split('\n').find((candidate) => candidate.trim() !== '') ?? '';
  return line.length > PREVIEW_LENGTH ? `${line.slice(0, PREVIEW_LENGTH)}…` : line;
}

/**
 * The whole post in every style, each with its own copy button.
 *
 * The toolbar styles a selection, which is right when shaping a post and wrong
 * when you already know you want all of it in one alphabet. This is that second
 * path: no selecting, one button per style.
 *
 * Each row previews the first non-empty line, but the button copies the entire
 * post — a 3,000-character post rendered fourteen times would bury the panel
 * it belongs to.
 */
export function StylePanel({ text, onCopy }: StylePanelProps) {
  const sample = preview(text);
  // Which card was just copied, so its button can say so where the eye already is.
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  if (sample === '') {
    return (
      <p className="hint">Write something above and every style will appear here, ready to copy.</p>
    );
  }

  return (
    <ul className="style-list">
      {SPECIMENS.map((specimen) => (
        <li key={specimen.id} className="style-row" data-style={specimen.id}>
          <span className="style-label mono" id={`style-${specimen.id}`}>
            {specimen.label}
          </span>
          <span className="style-sample">{inStyle(sample, specimen)}</span>
          {/*
           * Deliberately not named after its style. Accessible names match by
           * substring, so "Copy in bold" made these fourteen buttons intercept
           * every `{ name: 'Bold' }` lookup in the suite, and naming them after
           * the post collided with the editor's own Post label. The card's
           * visible label already says which style this is; `aria-describedby`
           * ties the two together for a screen reader, and tests address the
           * card by `data-style`.
           */}
          <button
            type="button"
            aria-label="Copy"
            aria-describedby={`style-${specimen.id}`}
            className={copied === specimen.id ? 'is-copied' : undefined}
            onClick={() => {
              onCopy(inStyle(text, specimen), `the ${specimen.label.toLowerCase()} version`);
              setCopied(specimen.id);
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => {
                setCopied(null);
              }, 1400);
            }}
          >
            {copied === specimen.id ? <CheckIcon /> : <CopyIcon />}
            <span aria-hidden="true">{copied === specimen.id ? 'Copied' : 'Copy'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
