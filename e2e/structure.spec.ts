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

test('list buttons add, switch and remove markers on the selected lines', async ({ page }) => {
  const post = page.getByLabel('Post');
  const checks = page.getByRole('region', { name: 'Checks' });
  const plain = 'Opening line\n\nfirst point\nsecond point';
  await post.fill(plain);
  await select(post, plain.indexOf('first'), plain.length);

  await page.getByRole('button', { name: 'Bulleted list' }).click();
  await expect(post).toHaveValue('Opening line\n\n• first point\n• second point');
  await expect(checks).toContainText('Structure: 1 opening line · 1 list');

  await page.getByRole('button', { name: 'Numbered list' }).click();
  await expect(post).toHaveValue('Opening line\n\n1. first point\n2. second point');

  await page.getByRole('button', { name: 'Numbered list' }).click();
  await expect(post).toHaveValue(plain);
  await expect(checks).toContainText('Structure: 1 opening line');
  await expect(checks).not.toContainText('list');
});

test('styled list items keep their styles', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('Opening\n\nfirst point');
  await select(post, 'Opening\n\n'.length, 'Opening\n\nfirst'.length);
  await page.getByRole('button', { name: 'Bold' }).click();
  const styled = await post.inputValue();
  await page.getByRole('button', { name: 'Bulleted list' }).click();
  await expect(post).toHaveValue(styled.replace('\n\n', '\n\n• '));
});

test('reports the opening, a closing link and a reading grade', async ({ page }) => {
  const post = page.getByLabel('Post');
  const checks = page.getByRole('region', { name: 'Checks' });
  await post.fill('Short hook');
  await expect(checks).toContainText('Reading grade: add at least 20 words for an estimate.');

  await post.fill(
    [
      'Two line',
      'opening here',
      '',
      'Plain words make a post easy to read for almost everyone who sees it in a busy feed.',
      'https://example.com',
    ].join('\n'),
  );
  await expect(checks).toContainText('Structure: 2 opening lines · ends with a link');
  await expect(checks).toContainText(/Reading grade \d+\.\d \(Flesch–Kincaid/u);
});

test('the unmeasured fold preview stays out of production builds', async ({ page }) => {
  // CI builds as production, where the foldPreview flag is off (src/flags.ts).
  await expect(page.getByRole('region', { name: 'Checks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /see more/u })).toHaveCount(0);
});
