// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_THEME,
  THEME_KEY,
  THEME_SCRIPT,
  isTheme,
  other,
  saveTheme,
  storedTheme,
} from './theme';

interface FakeDocument {
  readonly documentElement: { dataset: { theme?: string } };
}

/**
 * Runs the bootstrap string the layout inlines in `<head>`, with the only two
 * globals it touches. Executing the string is the point: it ships as text, so
 * nothing else would catch a syntax error or a wrong key in it.
 */
function runBootstrap(document: FakeDocument, localStorage: Pick<Storage, 'getItem'>): void {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- the string under test is code by design
  new Function('document', 'localStorage', THEME_SCRIPT)(document, localStorage);
}

function memoryStorage(initial?: string): Storage {
  const items = new Map<string, string>();
  if (initial !== undefined) items.set(THEME_KEY, initial);
  const storage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
  return storage as Storage;
}

describe('theme preference', () => {
  it('defaults to light, which is what the app ships with', () => {
    expect(DEFAULT_THEME).toBe('light');
    expect(storedTheme(() => memoryStorage())).toBe('light');
  });

  it('remembers a valid choice and ignores anything else', () => {
    expect(storedTheme(() => memoryStorage('dark'))).toBe('dark');
    expect(storedTheme(() => memoryStorage('light'))).toBe('light');
    expect(storedTheme(() => memoryStorage('solarized'))).toBe('light');
    const storage = memoryStorage();
    saveTheme(() => storage, 'dark');
    expect(storage.getItem(THEME_KEY)).toBe('dark');
    expect(storedTheme(() => storage)).toBe('dark');
  });

  it('falls back to the default when storage is missing or throws', () => {
    expect(storedTheme(() => undefined)).toBe('light');
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    expect(storedTheme(blocked)).toBe('light');
    expect(() => {
      saveTheme(blocked, 'dark');
    }).not.toThrow();
  });

  it('toggles between the two themes', () => {
    expect(other('light')).toBe('dark');
    expect(other('dark')).toBe('light');
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe('THEME_SCRIPT', () => {
  it('applies a stored theme before paint, and the default otherwise', () => {
    const run = (stored: string | null): string => {
      const element = { dataset: {} as { theme?: string } };
      const localStorage = { getItem: () => stored };
      // The script is a string so it can be inlined in <head>; run it here with
      // the two globals it touches.
      runBootstrap({ documentElement: element }, localStorage);
      return element.dataset.theme ?? '';
    };
    expect(run('dark')).toBe('dark');
    expect(run('light')).toBe('light');
    expect(run(null)).toBe('light');
    expect(run('nonsense')).toBe('light');
  });

  it('survives storage that throws', () => {
    const element = { dataset: {} as { theme?: string } };
    runBootstrap(
      { documentElement: element },
      {
        getItem: () => {
          throw new Error('blocked');
        },
      },
    );
    expect(element.dataset.theme).toBe('light');
  });
});
