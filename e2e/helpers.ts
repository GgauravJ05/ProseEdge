// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { Locator, Page } from '@playwright/test';

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

/** A post with a little of everything, for tests that need text to work on. */
export const SAMPLE = [
  'Unicode "bold" is not rich text.',
  '',
  'Select some words, pick a style, then copy the post into LinkedIn, X or Threads.',
  'Screen readers may read styled letters as math symbols, so keep the plain copy handy.',
].join('\n');

/** Pick an alphabet from the style menu, for the selection or, with none, the whole post. */
export async function pickFamily(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /^Alphabet:/u }).click();
  await page
    .getByRole('group', { name: 'Font' })
    .getByRole('button', { name, exact: true })
    .click();
}

/** The alphabet the style menu shows for the current scope. */
export const alphabet = (page: Page, name: string): Locator =>
  page.getByRole('button', { name: `Alphabet: ${name}`, exact: true });

/** Show the plain text under the editor and return it. */
export async function plainText(page: Page): Promise<Locator> {
  await page
    .getByRole('group', { name: 'Output view' })
    .getByRole('button', { name: 'Plain text' })
    .click();
  return page.getByLabel('Plain text');
}
