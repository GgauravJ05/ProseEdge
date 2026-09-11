// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { describe, expect, it } from 'vitest';

import { DRAFT_KEY, draftStore } from './draft';

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  const storage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
  return storage as Storage;
}

describe('draftStore', () => {
  it('saves and loads the draft, keeping an emptied post empty', () => {
    const storage = memoryStorage();
    const drafts = draftStore(() => storage);
    expect(drafts.load()).toBeNull();
    drafts.save('𝐇𝐢');
    expect(drafts.load()).toBe('𝐇𝐢');
    expect(storage.getItem(DRAFT_KEY)).toBe('𝐇𝐢');
    drafts.save('');
    expect(drafts.load()).toBe('');
  });

  it('carries on when storage is missing or throws', () => {
    const missing = draftStore(() => undefined);
    missing.save('x');
    expect(missing.load()).toBeNull();

    const blocked = draftStore(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => {
      blocked.save('x');
    }).not.toThrow();
    expect(blocked.load()).toBeNull();
  });
});
