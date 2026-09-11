// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { select } from './helpers';

// WCAG 2.2 A and AA rules. A formatter that warns about accessibility has to pass them itself.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const path of ['/', '/privacy']) {
  test(`${path} has no automatically detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (path === '/') await expect(page.getByLabel('Post')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test('the checks panel passes the scan with a warning and highlights showing', async ({ page }) => {
  await page.goto('/');
  const post = page.getByLabel('Post');
  await post.fill('Top 3 tips');
  await select(post, 0, 'Top 3 tips'.length);
  await page.getByRole('button', { name: 'Script' }).click();
  await expect(page.locator('mark')).toHaveCount(1);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('the formatter works from the keyboard alone', async ({ page }) => {
  await page.goto('/');
  const post = page.getByLabel('Post');
  await post.fill('Hello world');
  // Put the caret at the start (Home differs between macOS and Linux), then select with the keyboard.
  await select(post, 0, 0);
  for (const key of Array<string>('Hello'.length).fill('Shift+ArrowRight')) {
    await page.keyboard.press(key);
  }
  await page.keyboard.press('ControlOrMeta+b');
  expect((await post.inputValue()).normalize('NFKC')).toBe('Hello world');
  await expect(post).not.toHaveValue('Hello world');

  // Tab out to the copy buttons and press one with the keyboard.
  await page.getByRole('button', { name: 'Copy plain text' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).not.toHaveText('');
});

test('unknown addresses get a 404 page with a way back', async ({ page }) => {
  await page.goto('/404');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to the formatter' }).click();
  await expect(page.getByLabel('Post')).toBeVisible();
});
