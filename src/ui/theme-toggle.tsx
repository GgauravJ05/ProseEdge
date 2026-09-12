// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useSyncExternalStore } from 'react';

import { MoonIcon, SunIcon } from './icons';
import { DEFAULT_THEME, isTheme, other, saveTheme, storedTheme } from './theme';
import type { Theme } from './theme';

const browserStorage = (): Storage | undefined => globalThis.localStorage;

/*
 * The applied theme lives on `<html data-theme>`, written by the inline script
 * in the layout before the first paint. That makes the DOM the source of truth
 * rather than React state, so it is read here as an external store: the
 * subscribers below are notified whenever the toggle writes a new value.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** What the browser is actually showing. */
function appliedTheme(): Theme {
  const applied = document.documentElement.dataset.theme;
  return isTheme(applied) ? applied : storedTheme(browserStorage);
}

/*
 * What the build-time prerender rendered. It cannot know the reader's choice,
 * so it must report the default — and React uses this snapshot while hydrating,
 * which is what keeps the first client render identical to the served markup.
 */
function prerenderedTheme(): Theme {
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  saveTheme(browserStorage, theme);
  for (const onChange of listeners) onChange();
}

/**
 * Switches between light and dark and remembers the choice.
 *
 * The icon and the label both depend on the current theme, so reading the
 * remembered choice during the first client render would disagree with the
 * prerendered markup and fail hydration for everyone who had chosen dark.
 * `useSyncExternalStore` exists for exactly this: it renders the server
 * snapshot while hydrating and swaps to the live one immediately after, so
 * the markup matches and the button still ends up correct. The page itself is
 * already painted in the right colours by then — only this button catches up.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, appliedTheme, prerenderedTheme);
  const next = other(theme);

  return (
    <button
      type="button"
      className="theme-toggle"
      // A switch between two named states: the label says where it goes.
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next);
      }}
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
      <span className="theme-toggle-text">{next === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
