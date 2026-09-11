// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The draft survives a reload by living in the browser's `localStorage`. It
 * never leaves the device. Storage can be missing or throw (private windows,
 * blocked site data, a full quota); a draft is a convenience, so every failure
 * is swallowed and the editor carries on.
 */

export const DRAFT_KEY = 'proseedge:draft:v1';

export interface DraftStore {
  /** The saved draft, `''` for a deliberately emptied post, or `null` if none was saved. */
  readonly load: () => string | null;
  readonly save: (text: string) => void;
}

export function draftStore(storage: () => Storage | undefined): DraftStore {
  return {
    load: () => {
      try {
        return storage()?.getItem(DRAFT_KEY) ?? null;
      } catch {
        return null;
      }
    },
    save: (text) => {
      try {
        storage()?.setItem(DRAFT_KEY, text);
      } catch {
        // Nothing to do: the draft simply is not kept.
      }
    },
  };
}

/** Styled text round-trips through `fromText`, so storing the rendered post keeps its styles. */
export const browserDrafts: DraftStore = draftStore(() => globalThis.localStorage);
