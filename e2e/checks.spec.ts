// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

import { select, selectAll } from './helpers';

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

test('counts the post and warns about styled letters', async ({ page }) => {
  const post = page.getByLabel('Post');
  const checks = page.getByRole('region', { name: 'Checks' });
  await post.fill('Hello world');
  await expect(checks.getByRole('listitem')).toHaveText(['11 characters', '2 words', '1 line']);
  await expect(checks).toContainText('No styled letters');

  await select(post, 0, 'Hello'.length);
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(checks).toContainText('5 styled letters');
  await expect(checks).toContainText('Screen readers may read each one as a math symbol');
});

test('shows which characters a font leaves plain', async ({ page }) => {
  const post = page.getByLabel('Post');
  const checks = page.getByRole('region', { name: 'Checks' });
  await post.fill('Top 3 tips');
  await selectAll(post);
  await page.getByRole('button', { name: 'Script' }).click();
  await expect(checks).toContainText(
    '1 character stays plain because its font has no styled form: “3”',
  );
  await expect(checks.locator('mark')).toHaveText(['3']);

  await page.getByRole('button', { name: 'Sans' }).click();
  await expect(checks.locator('mark')).toHaveCount(0);
});

test('keeps the draft across a reload, including an emptied post', async ({ page }) => {
  const post = page.getByLabel('Post');
  await select(post, 0, 'Unicode'.length);
  await page.getByRole('button', { name: 'Bold' }).click();
  const styled = await post.inputValue();

  await page.reload();
  await expect(page.getByLabel('Post')).toHaveValue(styled);

  await page.getByRole('button', { name: 'Clear post' }).click();
  await expect(page.getByLabel('Post')).toHaveValue('');
  await page.reload();
  await expect(page.getByLabel('Post')).toHaveValue('');
});

test('never sends what the user types over the network', async ({ page }) => {
  const secret = 'zqxj private draft 7731';
  const leaks: string[] = [];
  page.on('request', (request) => {
    const payload = `${request.url()} ${request.postData() ?? ''}`;
    if (payload.includes(secret) || payload.includes(encodeURIComponent(secret))) {
      leaks.push(request.url());
    }
  });
  const post = page.getByLabel('Post');
  await post.fill('');
  await post.pressSequentially(secret);
  await selectAll(post);
  await page.getByRole('button', { name: 'Bold' }).click();
  await page.getByRole('button', { name: 'Copy plain text' }).click();
  await page.reload();
  await expect(page.getByLabel('Post')).not.toHaveValue('');
  expect(leaks).toEqual([]);
});
