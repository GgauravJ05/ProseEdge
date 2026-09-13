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
    await page.goto('/format');
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
  await page.goto('/format');
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
  await page.goto('/format');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.reload({ waitUntil: 'commit' });
  // Read as early as the document exists: the inline script has already run.
  const early = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(early).toBe('dark');
});

/*
 * The toggle renders an icon and a label that depend on the current theme, so
 * reading the remembered theme during the first client render made that render
 * disagree with the prerendered markup: React error #418, on every reload by
 * anyone who had chosen dark. The fix is to render the default first and adopt
 * the real theme in an effect. Nothing else in the suite would catch it coming
 * back, because the page looks and behaves correctly either way.
 */
test('reloading with a stored theme hydrates without console errors', async ({ page }) => {
  await page.goto('/format');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();

  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => {
    problems.push(error.message);
  });

  await page.reload();
  await expect(page.getByLabel('Post')).toBeVisible();
  // The button has caught up with the remembered theme, not stuck on the default.
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
  expect(problems).toEqual([]);
});
