// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  clearStyles,
  fromText,
  outputOffsetAt,
  rangesFromSource,
  render,
  sourceOffsetAt,
  toggleStyle,
} from '../document';
import type { Document, StyleKind } from '../document';

const SAMPLE = 'Styled letters are not rich text.\nScreen readers may spell out every one of them.';

const STYLES: readonly { readonly kind: StyleKind; readonly label: string }[] = [
  { kind: 'bold', label: 'Bold' },
  { kind: 'italic', label: 'Italic' },
  { kind: 'monospace', label: 'Monospace' },
];

interface SourceSelection {
  readonly start: number;
  readonly end: number;
}

/**
 * A textarea over the rendered output. Every edit re-imports the text with
 * `fromText`, which recovers styles from the codepoints, so the document tree
 * stays the source of truth and styling survives typing. Selections cross
 * between output and source offsets through provenance (spec §4.1).
 */
export function StylePreview() {
  const id = useId();
  const [doc, setDoc] = useState<Document>(() => fromText(SAMPLE));
  const result = useMemo(() => render(doc), [doc]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<SourceSelection | null>(null);

  // Styling changes the output length (math alphanumerics are surrogate pairs),
  // so the selection is kept in source offsets and mapped back after render.
  useLayoutEffect(() => {
    const el = textarea.current;
    const selection = pending.current;
    if (el === null || selection === null) return;
    pending.current = null;
    el.setSelectionRange(
      outputOffsetAt(result, selection.start),
      outputOffsetAt(result, selection.end),
    );
  }, [result]);

  const toggle = (kind: StyleKind) => {
    const el = textarea.current;
    if (el === null) return;
    const start = sourceOffsetAt(result, el.selectionStart);
    const end = sourceOffsetAt(result, el.selectionEnd);
    const ranges = rangesFromSource(result.layout, start, end);
    if (ranges.length === 0) return;
    pending.current = { start, end };
    setDoc(toggleStyle(doc, ranges, kind));
    el.focus();
  };

  const unstyled = result.coverage.length;

  return (
    <section>
      <label htmlFor={`${id}-post`}>Post</label>
      <div className="toolbar">
        {STYLES.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              toggle(kind);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setDoc(clearStyles(doc));
          }}
        >
          Restore accessible text
        </button>
      </div>
      <textarea
        id={`${id}-post`}
        ref={textarea}
        rows={6}
        value={result.output}
        onChange={(event) => {
          setDoc(fromText(event.target.value));
        }}
      />
      <p role="status">
        {unstyled === 0
          ? 'Every character in a styled span has a styled form.'
          : `${String(unstyled)} characters in styled spans have no styled form and stay plain.`}
      </p>
    </section>
  );
}
