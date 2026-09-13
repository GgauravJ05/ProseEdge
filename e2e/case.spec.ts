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
  await page.goto('/format');
  await expect(page.getByLabel('Post')).toBeVisible();
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

const caseGroup = (page: import('@playwright/test').Page) =>
  page.getByRole('group', { name: 'Case' });

test('recases the selection only', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('hello world');
  await select(post, 0, 'hello'.length);

  await caseGroup(page).getByRole('button', { name: 'Uppercase' }).click();
  await expect(post).toHaveValue('HELLO world');

  await select(post, 0, 'HELLO'.length);
  await caseGroup(page).getByRole('button', { name: 'Lowercase' }).click();
  await expect(post).toHaveValue('hello world');
});

test('recases the whole post when nothing is selected', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('one two');
  await select(post, 0, 0);

  await caseGroup(page).getByRole('button', { name: 'Uppercase' }).click();
  await expect(post).toHaveValue('ONE TWO');
});

test('changes the plain text too, unlike every style', async ({ page }) => {
  /*
   * Case is a transform, not a style: it rewrites the post itself, so the plain
   * pane follows it. Every other control in this toolbar leaves the plain text
   * exactly as it was.
   */
  const post = page.getByLabel('Post');
  await post.fill('quiet words');
  await select(post, 0, 0);
  await caseGroup(page).getByRole('button', { name: 'Uppercase' }).click();

  await expect(page.getByLabel('Plain text')).toHaveValue('QUIET WORDS');
});

test('leaves styled letters alone while recasing around them', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('bold plain');
  await select(post, 0, 'bold'.length);
  await page.getByRole('group', { name: 'Emphasis' }).getByRole('button', { name: 'Bold' }).click();
  const styled = await post.inputValue();

  await select(post, 0, 0);
  await caseGroup(page).getByRole('button', { name: 'Uppercase' }).click();

  // The styled word keeps its letters; only the plain word is recased.
  await expect(post).toHaveValue(styled.replace('plain', 'PLAIN'));
  await expect(page.getByLabel('Plain text')).toHaveValue('bold PLAIN');
});
