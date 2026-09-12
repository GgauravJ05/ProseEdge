// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

/** The `<html data-theme>` attribute, which every colour token hangs off. */
const theme = (page: import('@playwright/test').Page): Promise<string | null> =>
  page.locator('html').getAttribute('data-theme');

test.describe('light by default', () => {
  // Even with the operating system set to dark, the app opens light.
  test.use({ colorScheme: 'dark' });

  test('opens in the light theme regardless of the system setting', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Post')).toBeVisible();
    expect(await theme(page)).toBe('light');
    // The paper colour is painted on :root, not on body.
    const paper = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    // Light paper is bright; the dark theme's is near-black.
    const [red] = /(\d+)/.exec(paper)?.slice(1).map(Number) ?? [0];
    expect(red).toBeGreaterThan(200);
  });
});

test('the toggle switches the theme and remembers it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Post')).toBeVisible();
  expect(await theme(page)).toBe('light');

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  expect(await theme(page)).toBe('dark');

  await page.reload();
  await expect(page.getByLabel('Post')).toBeVisible();
  // Remembered, and applied before paint: no flash of the light theme.
  expect(await theme(page)).toBe('dark');

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  expect(await theme(page)).toBe('light');
  await page.reload();
  expect(await theme(page)).toBe('light');
});

test('the theme applies before the first paint', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.reload({ waitUntil: 'commit' });
  // Read as early as the document exists: the inline script has already run.
  const early = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(early).toBe('dark');
});
