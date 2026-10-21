// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { FAMILIES, supports } from './commands';
import type { Family } from './commands';
import { ChevronIcon } from './icons';
import { inStyle, SPECIMENS } from './specimens';

export const FAMILY_LABELS: Readonly<Record<Family, string>> = {
  serif: 'Serif',
  sans: 'Sans',
  script: 'Script',
  fraktur: 'Fraktur',
  doublestruck: 'Double-struck',
  monospace: 'Monospace',
};

function specimenOf(id: string): (typeof SPECIMENS)[number] {
  const found = SPECIMENS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no specimen ${id}`);
  return found;
}

/**
 * Each family's name in its own alphabet, so the choice is seen rather than
 * read. Serif is the page's own face: its Mathematical letters exist only in
 * bold and italic, and plain serif letters are just the letters.
 */
export const FAMILY_FACES: Readonly<Record<Family, string>> = {
  serif: 'Serif',
  sans: inStyle('Sans', specimenOf('sans')),
  script: inStyle('Script', specimenOf('script')),
  fraktur: inStyle('Fraktur', specimenOf('fraktur')),
  doublestruck: inStyle('Double-struck', specimenOf('doublestruck')),
  monospace: inStyle('Monospace', specimenOf('monospace')),
};

/** What else the family can carry, said plainly: most people meet these limits by surprise. */
function reach(family: Family): string {
  const bold = supports(family, 'bold');
  const italic = supports(family, 'italic');
  if (bold && italic) return 'Bold and italic';
  if (bold) return 'Bold, no italic';
  return 'No bold or italic';
}

interface StylePickerProps {
  /** The family every letter in scope shares, or `undefined` when they differ. */
  readonly current: Family | undefined;
  readonly disabled: boolean;
  /** Called with a family while it is hovered or focused, and `null` when the preview ends. */
  readonly onPreview: (family: Family | null) => void;
  readonly onPick: (family: Family) => void;
}

/**
 * The alphabet menu. It replaces the old grid of fourteen copy cards: instead
 * of rendering the post fourteen times beside the editor, pointing at a style
 * shows it on the post itself, and the "Hear it" panel reads that preview out,
 * so the cost of a style is visible before it is chosen.
 *
 * A disclosure, not an ARIA menu: the options are ordinary toggle buttons in a
 * labelled group, reachable with Tab, and Escape closes it without a change.
 */
export function StylePicker({ current, disabled, onPreview, onPick }: StylePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = (refocus: boolean) => {
    setOpen(false);
    onPreview(null);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || root.current?.contains(event.target) !== true) {
        setOpen(false);
        onPreview(null);
      }
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, onPreview]);

  return (
    <div
      ref={root}
      className="style-picker"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="style-trigger"
        aria-expanded={open}
        aria-controls={`${id}-styles`}
        disabled={disabled}
        title="Alphabet"
        onClick={() => {
          if (open) close(false);
          else setOpen(true);
        }}
      >
        <span aria-hidden="true" className={`font-face font-${current ?? 'mixed'}`}>
          {current === undefined ? 'Mixed styles' : FAMILY_FACES[current]}
        </span>
        <span className="visually-hidden">
          Alphabet: {current === undefined ? 'mixed' : FAMILY_LABELS[current]}
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div
          id={`${id}-styles`}
          role="group"
          aria-label="Font"
          className="style-menu"
          onPointerLeave={() => {
            onPreview(null);
          }}
        >
          {FAMILIES.map((family) => (
            <button
              key={family}
              type="button"
              className="style-option"
              aria-pressed={current === family}
              onPointerEnter={() => {
                onPreview(family);
              }}
              onFocus={() => {
                onPreview(family);
              }}
              onClick={() => {
                onPick(family);
                close(true);
              }}
            >
              <span aria-hidden="true" className={`style-option-face font-face font-${family}`}>
                {FAMILY_FACES[family]}
              </span>
              <span className="visually-hidden">{FAMILY_LABELS[family]}</span>
              <span aria-hidden="true" className="style-option-reach">
                {reach(family)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
