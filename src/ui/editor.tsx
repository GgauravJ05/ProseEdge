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
import { HearPanel } from './hear-panel';
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
  NumberedListIcon,
  PlainTextIcon,
  RestoreIcon,
  StrikethroughIcon,
  UnderlineIcon,
  WarningIcon,
} from './icons';
import { toggleList } from './lists';
import { Segmented } from './motion/segmented';
import { PostPreview } from './post-preview';
import { SelectionBubble } from './selection-bubble';
import { inStyle, SPECIMENS } from './specimens';
import { StylePicker } from './style-picker';

function specimenOf(id: string): (typeof SPECIMENS)[number] {
  const found = SPECIMENS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no specimen ${id}`);
  return found;
}

/**
 * The post "Try an example" loads: a little styling already in place, so the
 * "Hear it" panel has something to read out on the first click.
 */
const EXAMPLE = [
  `${inStyle('We’re hiring', specimenOf('sans_bold'))} a product designer.`,
  '',
  'Remote and full time. You would own the editor, from the first sketch to the release.',
  '',
  `${inStyle('Apply by Friday', specimenOf('sans_italic'))}, or send this to someone who should.`,
].join('\n');

/** Below this, a Flesch–Kincaid grade swings too much to be worth showing. */
const READING_MIN_WORDS = 20;

const count = (n: number, one: string, many: string): string =>
  `${number(n)} ${n === 1 ? one : many}`;

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

type View = 'hear' | 'plain' | 'feed';

/**
 * One editor over one document, with what the post costs directly beneath it.
 *
 * Every edit goes through `applyEdit`, so the document tree stays the source of
 * truth; selections cross between output and source offsets through provenance
 * (spec §4.1), because styled letters are two UTF-16 units and plain ones are
 * one.
 *
 * Styling acts on the selection, or on the whole post when nothing is
 * selected, and the toolbar says which. Pointing at an alphabet previews it on
 * the post, and everything below the editor — what a screen reader says, the
 * length, the feed — follows the preview, so the cost of a style is seen
 * before it is chosen.
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
   * choice is open.
   */
  const [pendingDraft, setPendingDraft] = useState<string | null>(() => {
    const saved = browserDrafts.load();
    return saved !== null && saved !== '' ? saved : null;
  });
  /*
   * The editor opens empty. It used to open on a sample post, and a first
   * click landed the caret in the middle of it, so the first thing typed was
   * spliced into someone else's text. "Try an example" fills it on request.
   */
  const [doc, setDoc] = useState<Document>(() => fromText(''));
  /*
   * Whether anything has actually changed this session. Without this, the
   * autosave effect below would write the empty post to storage on first
   * mount and wipe a draft the prompt is still offering.
   */
  const edited = useRef(false);
  const updateDoc = (next: Document) => {
    edited.current = true;
    setDoc(next);
  };
  const [target, setTarget] = useState<PlatformId>('linkedin');
  /*
   * Below the editor: what a screen reader may say, the plain text, or the feed
   * preview. Hearing it is the default, because showing the cost beside the
   * choice is the argument this app makes (ADR 0009 keeps the preview a click
   * away).
   */
  const [view, setView] = useState<View>('hear');
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const pending = useRef<Selection | null>(null);
  const [status, setStatus] = useState('');
  const [draftKept, setDraftKept] = useState(true);
  /*
   * The two actions that throw work away can be taken back. People explore
   * more freely when a mistake costs one click, not their post.
   */
  const [undo, setUndo] = useState<Document | null>(null);

  const plain = useMemo(() => sourceText(doc), [doc]);
  const collapsed = selection.start === selection.end;
  /*
   * What the styling controls act on: the selection, or the whole post when
   * the caret is just sitting somewhere. Keyboard shortcuts keep acting only on
   * a selection; Ctrl+B with nothing selected restyling a whole post would be a
   * surprise, a click on a labelled button is not.
   */
  const scope = useMemo(
    () => (collapsed ? { start: 0, end: plain.length } : selection),
    [collapsed, plain, selection],
  );

  const result = useMemo(() => render(doc), [doc]);
  const scopeRanges = useMemo(
    () => rangesFromSource(result.layout, scope.start, scope.end),
    [result, scope],
  );
  const [preview, setPreviewFamily] = useState<Family | null>(null);
  /*
   * A preview replaces the textarea's text, and a browser collapses the
   * selection when a textarea's value changes. Queue the current selection
   * for the layout effect below to put back, or the preview would widen
   * itself to the whole post the moment it started.
   */
  const setPreview = useCallback(
    (family: Family | null) => {
      pending.current = selection;
      setPreviewFamily(family);
    },
    [selection],
  );
  const previewDoc = useMemo(
    () => (preview === null ? doc : setFamily(doc, scopeRanges, preview)),
    [doc, preview, scopeRanges],
  );
  /** What the textarea and everything below it show: the post, or the post under a preview. */
  const shown = useMemo(
    () => (previewDoc === doc ? result : render(previewDoc)),
    [doc, previewDoc, result],
  );

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
    el.setSelectionRange(outputOffsetAt(shown, restore.start), outputOffsetAt(shown, restore.end));
  }, [shown]);

  useEffect(() => {
    if (pendingDraft !== null || !edited.current) return;
    setDraftKept(browserDrafts.save(result.output));
  }, [result, pendingDraft]);

  const restoreDraft = () => {
    updateDoc(fromText(pendingDraft ?? ''));
    setPendingDraft(null);
  };

  const discardDraft = () => {
    browserDrafts.save('');
    setPendingDraft(null);
  };

  /*
   * The text the textarea shows, for mapping its offsets. A ref, updated before
   * the browser can fire `selectionchange` for a new value: a listener holding
   * the previous render's text mapped a preview's offsets through the wrong
   * layout, widened the selection, and the preview then spread to the whole
   * post.
   */
  const showing = useRef(shown);
  useLayoutEffect(() => {
    showing.current = shown;
  }, [shown]);

  const readSelection = useCallback((): Selection | null => {
    const el = textarea.current;
    if (el === null) return null;
    return {
      start: sourceOffsetAt(showing.current, el.selectionStart),
      end: sourceOffsetAt(showing.current, el.selectionEnd),
    };
  }, []);

  const syncSelection = useCallback(() => {
    const next = readSelection();
    if (next === null) return;
    setSelection((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    );
  }, [readSelection]);

  useEffect(() => {
    document.addEventListener('selectionchange', syncSelection);
    return () => {
      document.removeEventListener('selectionchange', syncSelection);
    };
  }, [syncSelection]);

  const state = useMemo(() => selectionState(doc, scopeRanges), [doc, scopeRanges]);
  const [onlyFamily] = state.families.size === 1 ? [...state.families] : [];
  const nothingToStyle = state.families.size === 0;

  const platform = PLATFORMS[target];
  const shownPlain = useMemo(() => sourceText(previewDoc), [previewDoc]);
  const length = useMemo(
    () => budget(shown.output, shownPlain, platform),
    [shown, shownPlain, platform],
  );
  const stats = useMemo(() => postStats(shown.output), [shown]);
  const structure = useMemo(() => structureOf(doc), [doc]);
  const reading = useMemo(() => readability(plain), [plain]);
  // Punctuation and emoji are never styled, which is expected; flag only
  // letters and digits a font could not reach, which make the post look mixed.
  const gaps = useMemo(
    () => coverageMarks(shown).filter((mark) => mark.reason !== 'not_styleable'),
    [shown],
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
        : fold(shown.output, platform.fold, measure),
    [measure, platform, shown],
  );

  /**
   * Run a styling command on the scope: the selection, or with `whole` and no
   * selection, the entire post. The caret or selection is put back afterwards.
   */
  const change = (
    command: (current: Document, ranges: readonly TextRange[]) => Document,
    whole: boolean,
  ) => {
    const current = readSelection();
    if (current === null) return;
    const target =
      whole && current.start === current.end ? { start: 0, end: plain.length } : current;
    const next = command(doc, rangesFromSource(result.layout, target.start, target.end));
    setPreviewFamily(null);
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

  const emphasize = (emphasis: Emphasis, whole = true) => {
    change((current, selected) => toggleEmphasis(current, selected, emphasis), whole);
  };

  const decorate = (decoration: Decoration) => {
    change((current, selected) => toggleDecoration(current, selected, decoration), true);
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
    emphasize(key === 'b' ? 'bold' : 'italic', false);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${what}.`);
    } catch {
      setStatus('Copying was blocked. Select the text and copy it yourself.');
    }
  };

  const loadExample = () => {
    updateDoc(fromText(EXAMPLE));
    setUndo(null);
    setStatus('');
    textarea.current?.focus();
  };

  const empty = result.output === '';
  const scopeLabel = collapsed ? 'Whole post' : 'Selection';

  /*
   * The emphasis buttons, shared by the toolbar and the selection bar. The
   * bar's copies are for the mouse only (see SelectionBubble), so they are
   * taken out of the tab order there.
   */
  const emphasisButtons = (inBubble: boolean) => {
    const tabIndex = inBubble ? -1 : undefined;
    return (
      <>
        <button
          type="button"
          tabIndex={tabIndex}
          title="Bold (Ctrl or ⌘ B)"
          aria-pressed={state.bold === 'on'}
          aria-keyshortcuts={inBubble ? undefined : 'Control+B Meta+B'}
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
          tabIndex={tabIndex}
          title="Italic (Ctrl or ⌘ I)"
          aria-pressed={state.italic === 'on'}
          aria-keyshortcuts={inBubble ? undefined : 'Control+I Meta+I'}
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
          tabIndex={tabIndex}
          title="Underline"
          aria-pressed={state.underline === 'on'}
          disabled={nothingToStyle}
          onClick={() => {
            decorate('underline');
          }}
        >
          <UnderlineIcon />
          <span className="visually-hidden">Underline</span>
        </button>
        <button
          type="button"
          tabIndex={tabIndex}
          title="Strikethrough"
          aria-pressed={state.strikethrough === 'on'}
          disabled={nothingToStyle}
          onClick={() => {
            decorate('strikethrough');
          }}
        >
          <StrikethroughIcon />
          <span className="visually-hidden">Strikethrough</span>
        </button>
      </>
    );
  };

  const styledCount = stats.styled + stats.decorated;

  return (
    <section className="studio" aria-label="Formatter">
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

      <div className="sheet" inert={pendingDraft !== null}>
        {/*
         * One command bar, in the order a post is shaped: the alphabet and its
         * emphasis, which act on the scope named beside them, then structure
         * and case, which act on the lines under the caret. The two actions
         * that throw work away sit apart at the far end.
         */}
        <div className="toolbar">
          <div className="toolbar-styles">
            <StylePicker
              current={onlyFamily}
              disabled={nothingToStyle}
              onPreview={setPreview}
              onPick={(family) => {
                change((current, selected) => setFamily(current, selected, family), true);
              }}
            />
            <div
              role="group"
              aria-label="Emphasis"
              aria-describedby={`${id}-scope`}
              className="group"
            >
              {emphasisButtons(false)}
            </div>
            <span id={`${id}-scope`} className="scope" data-scope={collapsed ? 'all' : 'some'}>
              {scopeLabel}
            </span>
          </div>
          <div className="toolbar-text">
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
             * Case changes the words, not their dress, so the plain text changes
             * with it. The labels show the result in the page's own letters.
             */}
            <div role="group" aria-label="Case" className="group group-case">
              <button
                type="button"
                title="Uppercase"
                onClick={() => {
                  transformCase('upper');
                }}
              >
                <span aria-hidden="true">AB</span>
                <span className="visually-hidden">Uppercase</span>
              </button>
              <button
                type="button"
                title="Lowercase"
                onClick={() => {
                  transformCase('lower');
                }}
              >
                <span aria-hidden="true">ab</span>
                <span className="visually-hidden">Lowercase</span>
              </button>
            </div>
          </div>
          <div role="group" aria-label="Reset" className="group group-reset">
            <button
              type="button"
              title="Remove all styling, keep the words"
              disabled={styledCount === 0}
              onClick={() => {
                destroy(clearStyles(doc), 'All styling removed.');
              }}
            >
              <RestoreIcon />
              <span className="visually-hidden">Remove styling</span>
            </button>
            <button
              type="button"
              className="danger"
              title="Clear post"
              disabled={empty}
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

        <div className="compose">
          <label htmlFor={`${id}-post`} className="visually-hidden">
            Post
          </label>
          <textarea
            id={`${id}-post`}
            ref={textarea}
            rows={8}
            spellCheck
            readOnly={preview !== null}
            data-previewing={preview !== null}
            placeholder="Write or paste your post. Select words to style them."
            aria-describedby={`${id}-hint`}
            value={shown.output}
            onKeyDown={onKeyDown}
            onSelect={syncSelection}
            onChange={(event) => {
              const el = event.target;
              edit(el.value, toSource(el.value, el.selectionStart, el.selectionEnd));
            }}
          />
          {empty && (
            <button type="button" className="try-example" onClick={loadExample}>
              Try an example
            </button>
          )}
          <SelectionBubble
            textarea={textarea}
            revision={`${String(selection.start)}:${String(selection.end)}:${shown.output}`}
            hidden={preview !== null || pendingDraft !== null}
          >
            {emphasisButtons(true)}
          </SelectionBubble>
        </div>

        {/*
         * The cost of the post, under the post. The budget sits on the same
         * line as the target it is counted for.
         */}
        <div className="measure">
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
          {/*
           * A group, not a live region: this count changes on every keystroke,
           * and announcing it each time would talk over what is being typed.
           * The copy confirmation below is the one thing worth announcing.
           */}
          <p className={length.over ? 'budget over' : 'budget'} role="group" aria-label="Length">
            <span className="budget-count">
              {platform.limit === null
                ? count(length.used, 'character', 'characters')
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

        <section className="listen" aria-labelledby={`${id}-checks`}>
          {/* Sticky on wide screens, so the checks stay beside the words being typed. */}
          <div className="listen-inner">
            <div className="listen-head">
              <h2 id={`${id}-checks`} className="listen-title">
                Checks
              </h2>
              <Segmented
                label="Output view"
                className="views"
                options={[
                  { id: 'hear', label: 'Hear it' },
                  { id: 'plain', label: 'Plain text' },
                  { id: 'feed', label: 'Feed preview' },
                ]}
                value={view}
                onChange={(next) => {
                  setView(next === 'plain' || next === 'feed' ? next : 'hear');
                }}
              />
            </div>

            {view === 'hear' &&
              (empty ? (
                <p className="listen-note">
                  Your post will appear here the way a screen reader may read it out.
                </p>
              ) : styledCount === 0 ? (
                <p className="listen-note ok">
                  <CheckIcon />
                  <span>
                    No styled letters, so a screen reader reads your post exactly as written.
                  </span>
                </p>
              ) : (
                <>
                  <HearPanel output={shown.output} />
                  {stats.styled > 0 && (
                    <p className="listen-note warn">
                      <WarningIcon />
                      <span>
                        {count(stats.styled, 'styled letter', 'styled letters')}. Screen readers may
                        read each one as a math symbol, as above, or skip it. Keep the words that
                        matter most plain.
                      </span>
                    </p>
                  )}
                  {/*
                   * Counted separately from substituted letters, because the two
                   * fail differently: a reader that folds mathematical
                   * alphanumerics back to ASCII still meets the combining mark
                   * (ADR 0010).
                   */}
                  {stats.decorated > 0 && (
                    <p className="listen-note warn">
                      <WarningIcon />
                      <span>
                        {count(
                          stats.decorated,
                          'underlined or struck letter',
                          'underlined or struck letters',
                        )}
                        . Each is a plain letter plus a combining mark, so it costs two characters
                        and a screen reader may announce the mark or split it from its letter.
                      </span>
                    </p>
                  )}
                </>
              ))}

            {view === 'plain' && (
              <>
                <label htmlFor={`${id}-plain`} className="visually-hidden">
                  Plain text
                </label>
                <textarea
                  id={`${id}-plain`}
                  className="plain"
                  rows={6}
                  readOnly
                  value={shownPlain}
                />
              </>
            )}

            {view === 'feed' && (
              <PostPreview text={shown.output} platform={platform} measureFor={measureFor} />
            )}

            {gaps.length > 0 && (
              <>
                <p className="listen-note">
                  <WarningIcon />
                  <span>
                    {count(gaps.length, 'character stays', 'characters stay')} plain because{' '}
                    {gaps.length === 1 ? 'its' : 'their'} font has no styled form:{' '}
                    {[...new Set(gaps.map((gap) => `“${gap.text}”`))].join(', ')}
                  </span>
                </p>
                {/* A visual aid; the sentence above already says the same thing. */}
                <pre className="gaps" aria-hidden="true">
                  {segments(shown.output, gaps).map((segment, index) =>
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
                <h3 className="fold-title">
                  <FoldIcon />
                  Before “…see more”
                </h3>
                <p className="hint">
                  An unmeasured estimate for {platform.label}. It only appears in preview builds
                  until the real fold rule is measured.
                </p>
                <pre className="gaps fold">
                  {folded.visible}
                  {folded.truncated && <span className="ellipsis">{FEED_ESTIMATE.ellipsis}</span>}
                </pre>
              </>
            )}

            {!empty && (
              <>
                <ul className="stats">
                  <li>{count(stats.characters, 'character', 'characters')}</li>
                  <li>{count(stats.words, 'word', 'words')}</li>
                  <li>{count(stats.lines, 'line', 'lines')}</li>
                </ul>
                <p className="facts">
                  Structure: {count(structure.openingLines, 'opening line', 'opening lines')}
                  {structure.lists > 0 && ` · ${count(structure.lists, 'list', 'lists')}`}
                  {structure.link && ' · ends with a link'}
                </p>
                <p className="facts">
                  {reading.grade === null || reading.words < READING_MIN_WORDS
                    ? `Reading grade: add at least ${String(READING_MIN_WORDS)} words for an estimate.`
                    : `Reading grade ${Math.max(0, reading.grade).toFixed(1)} (Flesch–Kincaid; an estimate for English text).`}
                </p>
              </>
            )}
          </div>
        </section>

        <div className="dock">
          <p id={`${id}-hint`} className="hint">
            {platform.note}
            {platform.confidence === 'assumed' && ' This count is assumed, not tested.'}
          </p>
          <div role="group" aria-label="Copy" className="actions">
            <button
              type="button"
              disabled={empty}
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
              disabled={empty}
              onClick={() => {
                void copy(result.output, 'the styled post');
              }}
            >
              <CopyIcon />
              Copy styled
            </button>
          </div>
          <div className="status-row">
            <p className="saved">
              {draftKept ? <LockIcon /> : <WarningIcon />}
              {draftKept
                ? 'Saved in this browser only. Nothing you type is sent anywhere.'
                : 'This browser is not keeping your draft, so it will be lost if you reload. Nothing you type is sent anywhere.'}
            </p>
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
      </div>
    </section>
  );
}
