// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import {
  clearStyles,
  fromText,
  normalize,
  outputOffsetAt,
  rangesFromSource,
  render,
  sourceOffsetAt,
  sourceText,
} from '../document';
import type { Document, TextRange } from '../document';
import { coverageMarks, postStats, segments } from './checks';
import {
  FAMILIES,
  applyEdit,
  canEmphasize,
  selectionState,
  setFamily,
  toggleEmphasis,
} from './commands';
import type { Emphasis, Family } from './commands';
import { browserDrafts } from './draft';

const SAMPLE = [
  'Unicode "bold" is not rich text.',
  '',
  'Select some words, pick a style, then copy the post into LinkedIn, X or Threads.',
  'Screen readers may read styled letters as math symbols, so keep the plain copy handy.',
].join('\n');

const FAMILY_LABELS: Readonly<Record<Family, string>> = {
  serif: 'Serif',
  sans: 'Sans',
  script: 'Script',
  monospace: 'Mono',
};

const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** A selection in source-text offsets, which styling never changes. */
interface Selection {
  readonly start: number;
  readonly end: number;
}

/**
 * A textarea over the rendered post. Every edit goes through `applyEdit`, so the
 * document tree stays the source of truth; selections cross between output and
 * source offsets through provenance (spec §4.1), because styled letters are
 * two UTF-16 units and plain ones are one.
 */
export function Editor() {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [doc, setDoc] = useState<Document>(() => fromText(browserDrafts.load() ?? SAMPLE));
  const result = useMemo(() => render(doc), [doc]);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const pending = useRef<Selection | null>(null);
  const [status, setStatus] = useState('');

  // Re-rendering changes the textarea value, so restore the selection afterwards.
  useLayoutEffect(() => {
    const el = textarea.current;
    const restore = pending.current;
    if (el === null || restore === null) return;
    pending.current = null;
    el.setSelectionRange(
      outputOffsetAt(result, restore.start),
      outputOffsetAt(result, restore.end),
    );
  }, [result]);

  useEffect(() => {
    browserDrafts.save(result.output);
  }, [result]);

  const readSelection = useCallback((): Selection | null => {
    const el = textarea.current;
    if (el === null) return null;
    return {
      start: sourceOffsetAt(result, el.selectionStart),
      end: sourceOffsetAt(result, el.selectionEnd),
    };
  }, [result]);

  const syncSelection = useCallback(() => {
    const next = readSelection();
    if (next !== null) setSelection(next);
  }, [readSelection]);

  useEffect(() => {
    document.addEventListener('selectionchange', syncSelection);
    return () => {
      document.removeEventListener('selectionchange', syncSelection);
    };
  }, [syncSelection]);

  const ranges = useMemo(
    () => rangesFromSource(result.layout, selection.start, selection.end),
    [result, selection],
  );
  const state = useMemo(() => selectionState(doc, ranges), [doc, ranges]);
  const [onlyFamily] = state.families.size === 1 ? [...state.families] : [];

  const stats = useMemo(() => postStats(result.output), [result]);
  // Punctuation and emoji are never styled, which is expected; highlight only
  // letters and digits a font could not reach, which make the post look mixed.
  const gaps = useMemo(
    () => coverageMarks(result).filter((mark) => mark.reason !== 'not_styleable'),
    [result],
  );

  const change = (command: (current: Document, ranges: readonly TextRange[]) => Document) => {
    const current = readSelection();
    if (current === null) return;
    const next = command(doc, rangesFromSource(result.layout, current.start, current.end));
    textarea.current?.focus();
    if (next === doc) return;
    pending.current = current;
    setSelection(current);
    setDoc(next);
  };

  const emphasize = (emphasis: Emphasis) => {
    change((current, selected) => toggleEmphasis(current, selected, emphasis));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'b' && key !== 'i') return;
    event.preventDefault();
    emphasize(key === 'b' ? 'bold' : 'italic');
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${what}.`);
    } catch {
      setStatus('Copying was blocked. Select the text and copy it yourself.');
    }
  };

  return (
    <section className="editor">
      <div className="toolbar">
        <div role="group" aria-label="Font" className="group">
          {FAMILIES.map((family) => (
            <button
              key={family}
              type="button"
              aria-pressed={onlyFamily === family}
              disabled={state.families.size === 0}
              onClick={() => {
                change((current, selected) => setFamily(current, selected, family));
              }}
            >
              {FAMILY_LABELS[family]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Emphasis" className="group">
          <button
            type="button"
            aria-pressed={state.bold === 'on'}
            aria-keyshortcuts="Control+B Meta+B"
            disabled={!canEmphasize(state, 'bold')}
            onClick={() => {
              emphasize('bold');
            }}
          >
            Bold
          </button>
          <button
            type="button"
            aria-pressed={state.italic === 'on'}
            aria-keyshortcuts="Control+I Meta+I"
            disabled={!canEmphasize(state, 'italic')}
            onClick={() => {
              emphasize('italic');
            }}
          >
            Italic
          </button>
        </div>
        <div role="group" aria-label="Reset" className="group">
          <button
            type="button"
            onClick={() => {
              setDoc(clearStyles(doc));
              setStatus('All styling removed.');
            }}
          >
            Restore accessible text
          </button>
          <button
            type="button"
            onClick={() => {
              setDoc(fromText(''));
              setStatus('Post cleared.');
              textarea.current?.focus();
            }}
          >
            Clear post
          </button>
        </div>
      </div>

      <label htmlFor={`${id}-post`}>Post</label>
      <textarea
        id={`${id}-post`}
        ref={textarea}
        rows={10}
        spellCheck
        aria-describedby={`${id}-hint`}
        value={result.output}
        onKeyDown={onKeyDown}
        onSelect={syncSelection}
        onChange={(event) => {
          const el = event.target;
          const next = applyEdit(doc, result, el.value);
          if (next === doc) return;
          // A textarea value only contains line feeds, so folding styled letters
          // is all it takes to turn a caret offset into a source offset.
          pending.current = {
            start: normalize(el.value.slice(0, el.selectionStart)).length,
            end: normalize(el.value.slice(0, el.selectionEnd)).length,
          };
          setDoc(next);
        }}
      />
      <p id={`${id}-hint`} className="hint">
        Select text to style it. Ctrl or ⌘ with B or I toggles bold and italic. Your draft is saved
        in this browser.
      </p>

      <div role="group" aria-label="Copy" className="actions">
        <button
          type="button"
          onClick={() => {
            void copy(result.output, 'the styled post');
          }}
        >
          Copy styled
        </button>
        <button
          type="button"
          onClick={() => {
            void copy(sourceText(doc), 'plain text');
          }}
        >
          Copy plain text
        </button>
      </div>
      <p role="status" className="status">
        {status}
      </p>

      <section aria-labelledby={`${id}-checks`} className="checks">
        <h2 id={`${id}-checks`}>Checks</h2>
        <p>
          {count(stats.characters, 'character', 'characters')} ·{' '}
          {count(stats.words, 'word', 'words')} · {count(stats.lines, 'line', 'lines')}
        </p>
        {stats.styled > 0 ? (
          <p className="notice">
            {count(stats.styled, 'styled letter', 'styled letters')}. Screen readers may read each
            one as a math symbol, such as “mathematical bold capital A”, or skip it. Keep the words
            that matter most plain.
          </p>
        ) : (
          <p>No styled letters, so nothing here depends on how a screen reader handles them.</p>
        )}
        {gaps.length > 0 && (
          <>
            <p>
              {count(gaps.length, 'character stays', 'characters stay')} plain because{' '}
              {gaps.length === 1 ? 'its' : 'their'} font has no styled form:{' '}
              {[...new Set(gaps.map((gap) => `“${gap.text}”`))].join(', ')}
            </p>
            {/* A visual aid; the sentence above already says the same thing. */}
            <pre className="preview" aria-hidden="true">
              {segments(result.output, gaps).map((segment, index) =>
                segment.mark === null ? (
                  <span key={index}>{segment.text}</span>
                ) : (
                  <mark key={index}>{segment.text}</mark>
                ),
              )}
            </pre>
          </>
        )}
      </section>
    </section>
  );
}
