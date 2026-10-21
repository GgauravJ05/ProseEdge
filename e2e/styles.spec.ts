// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

import { alphabet, pickFamily, select } from './helpers';

// Chromium blocks clipboard writes without these, and the app then shows its
// "copying was blocked" fallback instead of the confirmation.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/format');
  await expect(page.getByLabel('Post')).toBeVisible();
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

/*
 * The style menu replaced a grid of fourteen "copy in this style" cards. The
 * jobs those cards did — the whole post in one alphabet, without selecting,
 * copied out in full — are checked here against the menu instead.
 */

test('no control collides with the editor’s own label', async ({ page }) => {
  /*
   * `getByLabel` matches substrings, so a control labelled "Copy the post in
   * bold" made every editor spec in the suite fail with a strict-mode
   * violation.
   */
  await expect(page.getByLabel('Post')).toHaveCount(1);
});

test('styles the whole post in one alphabet without selecting anything', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('Hiring two engineers');
  await select(post, 0, 0);

  await pickFamily(page, 'Double-struck');
  await expect(post).toHaveValue('ℍ𝕚𝕣𝕚𝕟𝕘 𝕥𝕨𝕠 𝕖𝕟𝕘𝕚𝕟𝕖𝕖𝕣𝕤');
  await expect(alphabet(page, 'Double-struck')).toBeVisible();
});

test('copies the whole styled post, every line of it', async ({ page }) => {
  const long = `${'word '.repeat(30).trim()}\nsecond line`;
  const post = page.getByLabel('Post');
  await post.fill(long);
  await select(post, 0, 0);
  await page.getByRole('button', { name: 'Bold', exact: true }).click();

  await page.getByRole('button', { name: 'Copy styled' }).click();
  await expect(page.getByRole('status')).toHaveText('Copied the styled post.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.normalize('NFKC')).toBe(long);
  expect(copied).toContain('\n');
  expect(copied.length).toBeGreaterThan(long.length);
});

test('alphabets replace each other rather than compounding', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('Hi');
  await select(post, 0, 'Hi'.length);
  await pickFamily(page, 'Script');
  await expect(post).toHaveValue('ℋ𝒾');
  await pickFamily(page, 'Sans');
  await expect(post).toHaveValue('𝖧𝗂');
  await pickFamily(page, 'Serif');
  await expect(post).toHaveValue('Hi');
});

test('waits for something to style', async ({ page }) => {
  await page.getByLabel('Post').fill('');
  await expect(page.getByRole('button', { name: /^Alphabet:/u })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled();
});
