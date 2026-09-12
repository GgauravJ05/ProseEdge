// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Light or dark, chosen explicitly and remembered in this browser.
 *
 * Light is the default: the app does not follow the operating system, because
 * a writing tool should look the same when you come back to it, and most
 * people composing a post are on a light page already. The choice lives in
 * `localStorage` and never leaves the device.
 *
 * The theme is applied to `<html data-theme>` by {@link THEME_SCRIPT} before
 * the first paint, so there is no flash of the wrong theme; React then keeps
 * the attribute in step.
 */

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_KEY = 'proseedge:theme:v1';
export const DEFAULT_THEME: Theme = 'light';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** The stored choice, or the default when nothing valid is stored. */
export function storedTheme(storage: () => Storage | undefined): Theme {
  try {
    const value = storage()?.getItem(THEME_KEY);
    return isTheme(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(storage: () => Storage | undefined, theme: Theme): void {
  try {
    storage()?.setItem(THEME_KEY, theme);
  } catch {
    // A remembered theme is a convenience; blocked storage is not an error.
  }
}

export const other = (theme: Theme): Theme => (theme === 'light' ? 'dark' : 'light');

/**
 * Runs in `<head>` before anything paints. Kept to one line, with no
 * dependencies, because it blocks rendering; the `catch` covers private
 * windows and blocked site data, where it simply falls back to the default.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});document.documentElement.dataset.theme=t==="dark"||t==="light"?t:${JSON.stringify(DEFAULT_THEME)}}catch(e){document.documentElement.dataset.theme=${JSON.stringify(DEFAULT_THEME)}}`;
