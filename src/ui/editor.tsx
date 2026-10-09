// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { FEED_ESTIMATE, fold } from '../analysis/fold';
import type { Measure } from '../analysis/fold';
import { PLATFORM_LIST, PLATFORMS, budget } from '../analysis/platforms';
import type { PlatformId } from '../analysis/platforms';
import { readability } from '../analysis/readability';
import {
  clearStyles,
  clusters,
  fromText,
  normalize,
  outputOffsetAt,
  rangesFromSource,
  render,
  sourceOffsetAt,
  sourceText,
} from '../document';
import type { Document, ListMarker, TextRange } from '../document';
import { flags } from '../flags';
import { coverageMarks, postStats, segments, structureOf } from './checks';
import {
  FAMILIES,
  applyEdit,
  canEmphasize,
  selectionState,
  setFamily,
  toggleDecoration,
  toggleEmphasis,
} from './commands';
import type { Decoration, Emphasis, Family } from './commands';
import { recase } from './case';
import type { CaseTransform } from './case';
import { browserDrafts } from './draft';
import {
  BoldIcon,
  BulletListIcon,
  CheckIcon,
  ChecklistIcon,
  ClearIcon,
  CopyIcon,
  FoldIcon,
  ItalicIcon,
  LockIcon,
  LowercaseIcon,
  NumberedListIcon,
  PlainTextIcon,
  ReadingIcon,
  RestoreIcon,
  StrikethroughIcon,
  StructureIcon,
  UnderlineIcon,
  UppercaseIcon,
  WarningIcon,
} from './icons';
import { toggleList } from './lists';
import { Segmented } from './motion/segmented';
import { PostPreview } from './post-preview';
import { inStyle, SPECIMENS } from './specimens';
import { StylePanel } from './style-panel';

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
  fraktur: 'Fraktur',
  doublestruck: 'Double',
  monospace: 'Mono',
};

/**
 * Each font button shows its name in its own alphabet, so the choice is seen
 * rather than read. Serif has no Mathematical alphabet of its own (it is the
 * default for bold and italic), so it is shown in the page's serif face.
 */
const FAMILY_FACES: Readonly<Record<Family, string>> = {
  serif: 'Serif',
  sans: inStyle('Sans', specimenOf('sans')),
  script: inStyle('Script', specimenOf('script')),
  fraktur: inStyle('Fraktur', specimenOf('fraktur')),
  doublestruck: inStyle('Double', specimenOf('doublestruck')),
  monospace: inStyle('Mono', specimenOf('monospace')),
};

/** Below this, a Flesch–Kincaid grade swings too much to be worth showing. */
const READING_MIN_WORDS = 20;

function specimenOf(id: string): (typeof SPECIMENS)[number] {
  const found = SPECIMENS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no specimen ${id}`);
  return found;
}

const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

const number = (n: number): string => n.toLocaleString('en-US');

/** Canvas text metrics in `font`, with a rough per-character fallback if canvas is unavailable. */
function canvasMeasure(font: string): Measure {
  const context = document.createElement('canvas').getContext('2d');
  if (context === null) return (text) => clusters(text).length * 8;
  context.font = font;
  return (text) => context.measureText(text).width;
}

/** A selection in source-text offsets, which styling never changes. */
interface Selection {
  readonly start: number;
  readonly end: number;
}

/** Source offsets of a UTF-16 range in a textarea value, which only ever contains line feeds. */
const toSource = (value: string, start: number, end: number): Selection => ({
  start: normalize(value.slice(0, start)).length,
  end: normalize(value.slice(0, end)).length,
});

/**
 * Two panes over one document: the styled post you copy, and the plain text a
 * screen reader hears. Every edit goes through `applyEdit`, so the document tree
 * stays the source of truth; selections cross between output and source offsets
 * through provenance (spec §4.1), because styled letters are two UTF-16 units
 * and plain ones are one.
 */
export function Editor() {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  /*
   * A non-empty saved draft is offered, not loaded silently: a reader who
   * reloads to start over kept getting yesterday's post back with no way to
   * tell it was about to happen. The prompt holds the saved text without
   * touching `doc` until the reader picks Restore or Start fresh, so it never
   * renders and is never overwritten by the autosave effect below while the
   * choice is open. An explicitly emptied post (`''`, not `null`) is not a
   * draft worth asking about — it loads back to empty exactly as before.
   */
  const [pendingDraft, setPendingDraft] = useState<string | null>(() => {
    const saved = browserDrafts.load();
    return saved !== null && saved !== '' ? saved : null;
  });
  const [doc, setDoc] = useState<Document>(() =>
    fromText(browserDrafts.load() === '' ? '' : SAMPLE),
  );
  /*
   * Whether anything has actually changed this session. Without this, the
   * autosave effect below would write the untouched SAMPLE to storage on
   * first mount, and the very next reload would offer to "restore" a draft
   * the reader never wrote.
   */
  const edited = useRef(false);
  const updateDoc = (next: Document) => {
    edited.current = true;
    setDoc(next);
  };
  const [target, setTarget] = useState<PlatformId>('linkedin');
  /*
   * The right pane shows either the plain text or the feed preview.
   *
   * Plain text is the default, and deliberately so: showing the styled post
   * beside the text a screen reader actually hears is the argument this app
   * makes, and burying it behind a control would make that argument optional.
   * The preview answers a different question — how the post will look — and is
   * one click away (ADR 0009).
   */
  const [view, setView] = useState<'preview' | 'plain'>('plain');
  const result = useMemo(() => render(doc), [doc]);
  const plain = useMemo(() => sourceText(doc), [doc]);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const pending = useRef<Selection | null>(null);
  const [status, setStatus] = useState('');
  /*
   * The two actions that throw work away can be taken back. People explore
   * more freely when a mistake costs one click, not their post.
   */
  const [undo, setUndo] = useState<Document | null>(null);
  const destroy = (next: Document, message: string) => {
    setUndo(doc);
    updateDoc(next);
    setStatus(message);
  };
  const restoreUndo = () => {
    if (undo === null) return;
    updateDoc(undo);
    setUndo(null);
    setStatus('Restored.');
    textarea.current?.focus();
  };

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
    if (pendingDraft !== null || !edited.current) return;
    browserDrafts.save(result.output);
  }, [result, pendingDraft]);

  const restoreDraft = () => {
    updateDoc(fromText(pendingDraft ?? ''));
    setPendingDraft(null);
  };

  const discardDraft = () => {
    browserDrafts.save('');
    setPendingDraft(null);
  };

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

  const platform = PLATFORMS[target];
  const length = useMemo(() => budget(result.output, plain, platform), [result, plain, platform]);
  const stats = useMemo(() => postStats(result.output), [result]);
  const structure = useMemo(() => structureOf(doc), [doc]);
  const reading = useMemo(() => readability(plain), [plain]);
  // Punctuation and emoji are never styled, which is expected; highlight only
  // letters and digits a font could not reach, which make the post look mixed.
  const gaps = useMemo(
    () => coverageMarks(result).filter((mark) => mark.reason !== 'not_styleable'),
    [result],
  );
  /*
   * The preview card measures text in its own font, so it needs a measurer
   * whatever the flags say. Canvas contexts are cheap but not free, so they are
   * kept per font rather than rebuilt on every keystroke.
   */
  const measurers = useRef(new Map<string, Measure>());
  const measureFor = useCallback((font: string): Measure => {
    const existing = measurers.current.get(font);
    if (existing !== undefined) return existing;
    const created = canvasMeasure(font);
    measurers.current.set(font, created);
    return created;
  }, []);

  // The fold rule is not measured yet, so the "…see more" cut stays behind its flag (ADR 0009).
  const measure = useMemo(() => (flags.foldPreview ? canvasMeasure(FEED_ESTIMATE.font) : null), []);
  const folded = useMemo(
    () =>
      measure === null || platform.fold === null
        ? null
        : fold(result.output, platform.fold, measure),
    [measure, platform, result],
  );

  const change = (command: (current: Document, ranges: readonly TextRange[]) => Document) => {
    const current = readSelection();
    if (current === null) return;
    const next = command(doc, rangesFromSource(result.layout, current.start, current.end));
    textarea.current?.focus();
    if (next === doc) return;
    setUndo(null);
    pending.current = current;
    setSelection(current);
    updateDoc(next);
  };

  /** Replace the post with edited text, keeping `selected` (source offsets) selected. */
  const edit = (text: string, selected: Selection) => {
    const next = applyEdit(doc, result, text);
    if (next === doc) return;
    setUndo(null);
    pending.current = selected;
    updateDoc(next);
  };

  const emphasize = (emphasis: Emphasis) => {
    change((current, selected) => toggleEmphasis(current, selected, emphasis));
  };

  const decorate = (decoration: Decoration) => {
    change((current, selected) => toggleDecoration(current, selected, decoration));
  };

  const list = (marker: ListMarker) => {
    const el = textarea.current;
    if (el === null) return;
    const next = toggleList(el.value, el.selectionStart, el.selectionEnd, marker);
    el.focus();
    edit(next.text, toSource(next.text, next.start, next.end));
  };

  /*
   * Case is a transform, not a style: it rewrites the post rather than dressing
   * it, so it travels the text path like the list commands and not the styling
   * one. `applyEdit` re-imports the result, which is what keeps styled letters
   * in the post intact around the recased words.
   */
  const transformCase = (transform: CaseTransform) => {
    const el = textarea.current;
    if (el === null) return;
    const next = recase(el.value, el.selectionStart, el.selectionEnd, transform);
    el.focus();
    edit(next.text, toSource(next.text, next.start, next.end));
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
    <section className="editor workspace">
      {pendingDraft !== null && (
        <div className="draft-prompt-scrim">
          <div
            className="card draft-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-draft-title`}
            aria-describedby={`${id}-draft-body`}
          >
            <h2 id={`${id}-draft-title`}>Restore your last draft?</h2>
            <p id={`${id}-draft-body`}>
              A post was saved in this browser from before the page reloaded.
            </p>
            <div className="draft-prompt-actions">
              <button type="button" autoFocus onClick={restoreDraft}>
                <RestoreIcon />
                Restore draft
              </button>
              <button type="button" onClick={discardDraft}>
                <ClearIcon />
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="workspace-main" inert={pendingDraft !== null}>
        <div className="card editor-card">
          {/*
           * One command bar, in the order a post is shaped: the alphabet, then
           * emphasis, then structure, then case. Familiar controls are icons
           * with their names in the accessible name and a tooltip; the font
           * buttons show their own alphabet, so the choice is seen, not read.
           * The two actions that undo work sit apart at the far end.
           */}
          <div className="toolbar">
            <div role="group" aria-label="Font" className="group group-fonts">
              {FAMILIES.map((family) => (
                <button
                  key={family}
                  type="button"
                  title={FAMILY_LABELS[family]}
                  aria-pressed={onlyFamily === family}
                  disabled={state.families.size === 0}
                  onClick={() => {
                    change((current, selected) => setFamily(current, selected, family));
                  }}
                >
                  <span aria-hidden="true" className={`font-face font-${family}`}>
                    {FAMILY_FACES[family]}
                  </span>
                  <span className="visually-hidden">{FAMILY_LABELS[family]}</span>
                </button>
              ))}
            </div>
            <div role="group" aria-label="Emphasis" className="group">
              <button
                type="button"
                title="Bold (Ctrl or ⌘ B)"
                aria-pressed={state.bold === 'on'}
                aria-keyshortcuts="Control+B Meta+B"
                disabled={!canEmphasize(state, 'bold')}
                onClick={() => {
                  emphasize('bold');
                }}
              >
                <BoldIcon />
                <span className="visually-hidden">Bold</span>
              </button>
              <button
                type="button"
                title="Italic (Ctrl or ⌘ I)"
                aria-pressed={state.italic === 'on'}
                aria-keyshortcuts="Control+I Meta+I"
                disabled={!canEmphasize(state, 'italic')}
                onClick={() => {
                  emphasize('italic');
                }}
              >
                <ItalicIcon />
                <span className="visually-hidden">Italic</span>
              </button>
              {/*
               * Never disabled for want of an alphabet: a combining mark composes
               * with every one, unlike bold and italic.
               */}
              <button
                type="button"
                title="Underline"
                aria-pressed={state.underline === 'on'}
                disabled={state.families.size === 0}
                onClick={() => {
                  decorate('underline');
                }}
              >
                <UnderlineIcon />
                <span className="visually-hidden">Underline</span>
              </button>
              <button
                type="button"
                title="Strikethrough"
                aria-pressed={state.strikethrough === 'on'}
                disabled={state.families.size === 0}
                onClick={() => {
                  decorate('strikethrough');
                }}
              >
                <StrikethroughIcon />
                <span className="visually-hidden">Strikethrough</span>
              </button>
            </div>
            <div role="group" aria-label="Lists" className="group">
              <button
                type="button"
                title="Bulleted list"
                onClick={() => {
                  list('bullet');
                }}
              >
                <BulletListIcon />
                <span className="visually-hidden">Bulleted list</span>
              </button>
              <button
                type="button"
                title="Numbered list"
                onClick={() => {
                  list('numbered');
                }}
              >
                <NumberedListIcon />
                <span className="visually-hidden">Numbered list</span>
              </button>
              <button
                type="button"
                title="Checklist"
                onClick={() => {
                  list('checklist');
                }}
              >
                <ChecklistIcon />
                <span className="visually-hidden">Checklist</span>
              </button>
            </div>
            {/*
             * Apart from the styles: these change the words, and the plain pane
             * changes with them. Nothing else in this bar does.
             */}
            <div role="group" aria-label="Case" className="group">
              <button
                type="button"
                title="Uppercase"
                onClick={() => {
                  transformCase('upper');
                }}
              >
                <UppercaseIcon />
                <span className="visually-hidden">Uppercase</span>
              </button>
              <button
                type="button"
                title="Lowercase"
                onClick={() => {
                  transformCase('lower');
                }}
              >
                <LowercaseIcon />
                <span className="visually-hidden">Lowercase</span>
              </button>
            </div>
            <div role="group" aria-label="Reset" className="group group-reset">
              <button
                type="button"
                title="Restore accessible text (remove all styling)"
                onClick={() => {
                  destroy(clearStyles(doc), 'All styling removed.');
                }}
              >
                <RestoreIcon />
                <span className="visually-hidden">Restore accessible text</span>
              </button>
              <button
                type="button"
                className="danger"
                title="Clear post"
                onClick={() => {
                  destroy(fromText(''), 'Post cleared.');
                  textarea.current?.focus();
                }}
              >
                <ClearIcon />
                <span className="visually-hidden">Clear post</span>
              </button>
            </div>
          </div>

          <div className="panes">
            <div className="pane">
              <div className="pane-head">
                <label htmlFor={`${id}-post`}>Post</label>
                <span className="pane-hint">what readers see</span>
              </div>
              <textarea
                id={`${id}-post`}
                ref={textarea}
                rows={12}
                spellCheck
                aria-describedby={`${id}-hint`}
                value={result.output}
                onKeyDown={onKeyDown}
                onSelect={syncSelection}
                onChange={(event) => {
                  const el = event.target;
                  edit(el.value, toSource(el.value, el.selectionStart, el.selectionEnd));
                }}
              />
            </div>
            <div className="pane pane-side">
              <div className="pane-head">
                {view === 'plain' ? (
                  <label htmlFor={`${id}-plain`}>
                    Plain text <span className="pane-hint">what a screen reader hears</span>
                  </label>
                ) : (
                  <p className="pane-title">
                    Preview <span className="pane-hint">how the feed would lay it out</span>
                  </p>
                )}
                <Segmented
                  label="Right pane view"
                  className="pane-views"
                  options={[
                    { id: 'plain', label: 'Plain text' },
                    { id: 'preview', label: 'Preview' },
                  ]}
                  value={view}
                  onChange={(next) => {
                    setView(next === 'preview' ? 'preview' : 'plain');
                  }}
                />
              </div>
              {view === 'plain' ? (
                <textarea id={`${id}-plain`} rows={12} readOnly tabIndex={-1} value={plain} />
              ) : (
                <PostPreview text={result.output} platform={platform} measureFor={measureFor} />
              )}
            </div>
          </div>

          {/*
           * The status bar: where the post is going, how much of it is left,
           * and the one thing to do next. Copy styled is the primary action,
           * last and filled, as a confirming action sits on its platform.
           */}
          <div className="statusbar">
            <div className="statusbar-target">
              <span className="targets-label mono" aria-hidden="true">
                Writing for
              </span>
              <Segmented
                label="Target"
                className="targets"
                options={PLATFORM_LIST.map((option) => ({ id: option.id, label: option.label }))}
                value={target}
                onChange={(next) => {
                  const found = PLATFORM_LIST.find((option) => option.id === next);
                  if (found) setTarget(found.id);
                }}
              />
            </div>
            {/*
             * A group, not a live region: this count changes on every keystroke,
             * and announcing it each time would talk over what is being typed.
             * The copy confirmation below is the one thing worth announcing.
             */}
            <p className={length.over ? 'budget over' : 'budget'} role="group" aria-label="Length">
              <span className="budget-count">
                {platform.limit === null
                  ? `${number(length.used)} characters`
                  : `${number(length.used)} of ${number(platform.limit)}${length.over ? ' — over the limit' : ''}`}
              </span>
              {platform.limit !== null && (
                <span className="meter" aria-hidden="true">
                  <span
                    className="meter-fill"
                    style={{ transform: `scaleX(${String(Math.min(1, length.fraction ?? 0))})` }}
                  />
                </span>
              )}
              {length.styleCost > 0 && (
                <span className="budget-cost">styling adds {number(length.styleCost)}</span>
              )}
            </p>
          </div>

          <div className="editor-foot">
            <p id={`${id}-hint`} className="hint">
              {platform.note}
              {platform.confidence === 'assumed' &&
                ' Counting behaviour here is assumed, not tested.'}{' '}
              Select text to style it; Ctrl or ⌘ with B or I toggles bold and italic.
            </p>
            <p className="saved">
              <LockIcon />
              Your draft is saved in this browser and never sent anywhere.
            </p>
            <div role="group" aria-label="Copy" className="actions">
              <button
                type="button"
                onClick={() => {
                  void copy(plain, 'plain text');
                }}
              >
                <PlainTextIcon />
                Copy plain text
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  void copy(result.output, 'the styled post');
                }}
              >
                <CopyIcon />
                Copy styled
              </button>
            </div>
          </div>
          <div className="status-row">
            <p role="status" className="status">
              {status}
            </p>
            {undo !== null && (
              <button type="button" className="undo" onClick={restoreUndo}>
                Undo
              </button>
            )}
          </div>
        </div>

        {/*
         * The toolbar styles a selection; this styles the whole post. Rendered
         * from the plain source, so picking one specimen after another never
         * compounds the styling.
         */}
        <section aria-labelledby={`${id}-styles`} className="card styles-card">
          <div className="card-head">
            <h2 id={`${id}-styles`}>Every style</h2>
            <p className="hint">
              The whole post in one alphabet, without selecting anything. The plain text is
              untouched.
            </p>
          </div>
          <StylePanel
            text={plain}
            onCopy={(styled, what) => {
              void copy(styled, what);
            }}
          />
        </section>
      </div>

      <aside className="workspace-rail" inert={pendingDraft !== null}>
        <section aria-labelledby={`${id}-checks`} className="card checks">
          <h2 id={`${id}-checks`}>Checks</h2>
          <ul className="stats">
            <li>
              <strong>{number(stats.characters)}</strong>{' '}
              {stats.characters === 1 ? 'character' : 'characters'}
            </li>
            <li>
              <strong>{number(stats.words)}</strong> {stats.words === 1 ? 'word' : 'words'}
            </li>
            <li>
              <strong>{number(stats.lines)}</strong> {stats.lines === 1 ? 'line' : 'lines'}
            </li>
          </ul>
          <p className="check">
            <StructureIcon />
            <span>
              Structure: {count(structure.openingLines, 'opening line', 'opening lines')}
              {structure.lists > 0 && ` · ${count(structure.lists, 'list', 'lists')}`}
              {structure.link && ' · ends with a link'}
            </span>
          </p>
          <p className="check">
            <ReadingIcon />
            <span>
              {reading.grade === null || reading.words < READING_MIN_WORDS
                ? `Reading grade: add at least ${String(READING_MIN_WORDS)} words for an estimate.`
                : `Reading grade ${Math.max(0, reading.grade).toFixed(1)} (Flesch–Kincaid; an estimate for English text).`}
            </span>
          </p>
          {/*
           * Counted and warned about separately from substituted letters, because
           * the two fail differently: a reader that folds mathematical
           * alphanumerics back to ASCII still meets the combining mark (ADR 0010).
           */}
          {stats.decorated > 0 && (
            <p className="check notice">
              <WarningIcon />
              <span>
                {count(
                  stats.decorated,
                  'underlined or struck letter',
                  'underlined or struck letters',
                )}
                . These are a plain letter plus a combining mark, so each one costs two characters
                and a screen reader may announce the mark or split it from its letter. They are the
                riskiest styling here.
              </span>
            </p>
          )}
          {stats.styled > 0 ? (
            <p className="check notice">
              <WarningIcon />
              <span>
                {count(stats.styled, 'styled letter', 'styled letters')}. Screen readers may read
                each one as a math symbol, such as “mathematical bold capital A”, or skip it. Keep
                the words that matter most plain.
              </span>
            </p>
          ) : (
            <p className="check">
              <CheckIcon />
              <span>
                No styled letters, so nothing here depends on how a screen reader handles them.
              </span>
            </p>
          )}
          {gaps.length > 0 && (
            <>
              <p className="check">
                <WarningIcon />
                <span>
                  {count(gaps.length, 'character stays', 'characters stay')} plain because{' '}
                  {gaps.length === 1 ? 'its' : 'their'} font has no styled form:{' '}
                  {[...new Set(gaps.map((gap) => `“${gap.text}”`))].join(', ')}
                </span>
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
          {folded !== null && (
            <>
              <h3>
                <FoldIcon />
                Before “…see more”
              </h3>
              <p className="hint">
                An unmeasured estimate for {platform.label}. It only appears in preview builds until
                the real fold rule is measured.
              </p>
              <pre className="preview fold">
                {folded.visible}
                {folded.truncated && <span className="ellipsis">{FEED_ESTIMATE.ellipsis}</span>}
              </pre>
            </>
          )}
        </section>
      </aside>
    </section>
  );
}
