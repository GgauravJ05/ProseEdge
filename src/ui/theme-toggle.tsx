// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

'use client';

import { useEffect, useState } from 'react';

import { MoonIcon, SunIcon } from './icons';
import { DEFAULT_THEME, isTheme, other, saveTheme, storedTheme } from './theme';
import type { Theme } from './theme';

const browserStorage = (): Storage | undefined => globalThis.localStorage;

/**
 * Switches between light and dark and remembers the choice.
 *
 * The first render reads the attribute the inline script already set on
 * `<html>`, rather than storage, so the button's label matches what is on
 * screen without a second pass. The editor is client-only (client-editor.tsx),
 * so there is no server render to disagree with.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    // This component renders in the root layout, which is prerendered at build
    // time where there is no `document`; in the browser the remembered choice
    // is the truth, and it is what the inline script already applied.
    if (typeof document === 'undefined') return DEFAULT_THEME;
    const applied = document.documentElement.dataset.theme;
    return isTheme(applied) ? applied : storedTheme(browserStorage);
  });

  /*
   * Re-assert the theme after hydration. The inline script sets `data-theme`
   * before paint, but the prerendered markup has no such attribute, so React
   * removes it while reconciling — `suppressHydrationWarning` silences the
   * warning without preventing that. Writing it here, after reconciliation,
   * makes it stick; the script still does the pre-paint work that stops a flash.
   */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const next = other(theme);
  return (
    <button
      type="button"
      className="theme-toggle"
      // A switch between two named states: the label says where it goes.
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        saveTheme(browserStorage, next);
        setTheme(next);
      }}
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
      <span className="theme-toggle-text">{next === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}
