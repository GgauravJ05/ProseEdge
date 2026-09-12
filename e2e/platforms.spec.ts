// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

import { select } from './helpers';

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByLabel('Post')).toBeVisible();
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('the plain pane mirrors the styled post without the styling', async ({ page }) => {
  const post = page.getByLabel('Post');
  const plain = page.getByLabel('Plain text');
  await post.fill('Top 3 tips');
  await expect(plain).toHaveValue('Top 3 tips');

  await select(post, 0, 'Top'.length);
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(post).not.toHaveValue('Top 3 tips');
  // The styled pane changed; the plain pane is what a screen reader hears.
  await expect(plain).toHaveValue('Top 3 tips');
});

test('the target selector changes what styling costs', async ({ page }) => {
  const post = page.getByLabel('Post');
  const budget = page.getByRole('group', { name: 'Length' });
  await post.fill('Bold');
  await page.getByRole('button', { name: 'X', exact: true }).click();
  await expect(budget).toContainText('4 of 280');

  await select(post, 0, 'Bold'.length);
  await page.getByRole('button', { name: 'Bold' }).click();
  // X counts codepoints, so styling is free there.
  await expect(budget).toContainText('4 of 280');

  // LinkedIn counts code units, so the same four letters now cost eight.
  await page.getByRole('button', { name: 'LinkedIn' }).click();
  await expect(budget).toContainText('8 of 3,000');
  await expect(budget).toContainText('styling adds 4');
});

test('going over the limit is called out', async ({ page }) => {
  const post = page.getByLabel('Post');
  await page.getByRole('button', { name: 'Threads' }).click();
  await post.fill('a'.repeat(501));
  const budget = page.getByRole('group', { name: 'Length' });
  await expect(budget).toContainText('501 of 500');
  await expect(budget).toContainText('over the limit');
});
