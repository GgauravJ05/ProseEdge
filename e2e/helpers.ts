// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { Locator } from '@playwright/test';

/** Select a UTF-16 range in the textarea and let the editor see the change. */
export async function select(post: Locator, start: number, end: number): Promise<void> {
  await post.evaluate(
    (el: HTMLTextAreaElement, range: readonly [number, number]) => {
      el.focus();
      el.setSelectionRange(range[0], range[1]);
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    },
    [start, end] as const,
  );
}

/** Select the whole post. */
export async function selectAll(post: Locator): Promise<void> {
  const length = (await post.inputValue()).length;
  await select(post, 0, length);
}
