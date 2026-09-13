// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

import { select } from './helpers';

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

const panel = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Every style' });

/** One row, addressed by style rather than by any accessible name. */
const row = (page: import('@playwright/test').Page, style: string) =>
  panel(page).locator(`[data-style="${style}"]`);

test('no copy button collides with the editor’s own label', async ({ page }) => {
  /*
   * `getByLabel` matches substrings, so a button labelled "Copy the post in
   * bold" made every editor spec in the suite fail with a strict-mode
   * violation. Fourteen buttons is fourteen chances to do it again.
   */
  await expect(page.getByLabel('Post')).toHaveCount(1);
  await expect(page.getByLabel('Plain text')).toHaveCount(1);
});

test('shows the post in every style', async ({ page }) => {
  await page.getByLabel('Post').fill('Hiring two engineers');

  const rows = panel(page).locator('.style-row');
  await expect(rows).toHaveCount(14);
  // The bold row renders the post, not a placeholder.
  await expect(row(page, 'bold').locator('.style-sample')).toHaveText('𝐇𝐢𝐫𝐢𝐧𝐠 𝐭𝐰𝐨 𝐞𝐧𝐠𝐢𝐧𝐞𝐞𝐫𝐬');
  await expect(row(page, 'doublestruck').locator('.style-sample')).toHaveText(
    'ℍ𝕚𝕣𝕚𝕟𝕘 𝕥𝕨𝕠 𝕖𝕟𝕘𝕚𝕟𝕖𝕖𝕣𝕤',
  );
});

test('copies the whole post, not the shortened preview', async ({ page }) => {
  /*
   * Each row previews one line so the panel stays readable, but the button has
   * to copy everything. Getting that wrong would be silent: the row would look
   * right and the clipboard would hold a truncated post.
   */
  const long = `${'word '.repeat(30).trim()}\nsecond line`;
  await page.getByLabel('Post').fill(long);

  await row(page, 'bold').getByRole('button').click();
  await expect(page.getByRole('status')).toContainText('bold');

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.normalize('NFKC')).toBe(long);
  expect(copied).toContain('\n');
  expect(copied.length).toBeGreaterThan(long.length);
});

test('styles from the plain text, so specimens never compound', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('Hi');

  /*
   * Style the post itself, then check the panel still offers the plain letters
   * dressed once rather than the already-styled output dressed again.
   *
   * The family buttons are disabled until something is selected — styling
   * nothing would mean nothing — so the selection has to come first.
   */
  await select(post, 0, 'Hi'.length);
  await page.getByRole('group', { name: 'Font' }).getByRole('button', { name: 'Script' }).click();
  await expect(post).toHaveValue('ℋ𝒾');
  await expect(row(page, 'bold').locator('.style-sample')).toHaveText('𝐇𝐢');
});

test('waits for something to style', async ({ page }) => {
  await page.getByLabel('Post').fill('');
  await expect(panel(page).getByText('Write something above')).toBeVisible();
  await expect(panel(page).locator('.style-row')).toHaveCount(0);
});
