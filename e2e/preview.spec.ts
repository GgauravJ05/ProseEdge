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

const views = (page: import('@playwright/test').Page) =>
  page.getByRole('group', { name: 'Right pane view' });

/** Switch the right pane to the feed preview, which is not the default view. */
async function showPreview(page: import('@playwright/test').Page): Promise<void> {
  await views(page).getByRole('button', { name: 'Preview' }).click();
}

test('the plain text pane is what the editor opens on', async ({ page }) => {
  // The styled post beside the text a screen reader hears is the argument this
  // app makes, so it is what loads; the preview is the option (ADR 0009).
  await expect(views(page).getByRole('button', { name: 'Plain text' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('Plain text')).toBeVisible();
  await expect(page.locator('.preview-card')).toHaveCount(0);
});

test('the preview shows the post as the feed would lay it out', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('Hiring two engineers');
  await showPreview(page);

  const card = page.locator('.preview-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Hiring two engineers');
  // Layout numbers are approximations and the card has to admit it.
  await expect(card).toContainText('not a measurement');
});

test('the two views switch without losing the post', async ({ page }) => {
  await page.getByLabel('Post').fill('Plain still matters');

  await showPreview(page);
  await expect(page.locator('.preview-card')).toContainText('Plain still matters');

  await views(page).getByRole('button', { name: 'Plain text' }).click();
  const plain = page.getByLabel('Plain text');
  await expect(plain).toBeVisible();
  await expect(plain).toHaveValue('Plain still matters');
  await expect(page.locator('.preview-card')).toHaveCount(0);
});

test('the preview keeps the styling, and the plain pane still strips it', async ({ page }) => {
  const post = page.getByLabel('Post');
  await post.fill('Bold claim');
  await select(post, 0, 'Bold'.length);
  await page.getByRole('button', { name: 'Bold' }).click();
  await showPreview(page);

  const styled = await post.inputValue();
  // The card shows what would actually be pasted, styled letters and all.
  await expect(page.locator('.preview-card')).toContainText(styled);

  await views(page).getByRole('button', { name: 'Plain text' }).click();
  await expect(page.getByLabel('Plain text')).toHaveValue('Bold claim');
});

test('switching target re-lays the same post', async ({ page }) => {
  await page.getByLabel('Post').fill('One draft, four feeds');
  await showPreview(page);
  const card = page.locator('.preview-card');

  await page.getByRole('button', { name: 'LinkedIn' }).click();
  await expect(card).toContainText('Your headline');

  // X and Threads use a handle byline rather than a headline.
  await page.getByRole('button', { name: 'X', exact: true }).click();
  await expect(card).toContainText('@yourhandle');
  await expect(card).not.toContainText('Your headline');

  await page.getByRole('button', { name: 'Instagram' }).click();
  await expect(card).toContainText('yourhandle');
  await expect(card).toContainText('One draft, four feeds');
});

test('without a target there is no feed to imitate', async ({ page }) => {
  await page.getByLabel('Post').fill('Nowhere in particular');
  await showPreview(page);
  // Show the card first, so its absence below means "no feed to imitate"
  // rather than "the plain pane happens to be showing".
  await expect(page.locator('.preview-card')).toBeVisible();

  await page.getByRole('button', { name: 'No target' }).click();
  await expect(page.locator('.preview-card')).toHaveCount(0);
  await expect(page.getByText('Pick a target above')).toBeVisible();
});

test('the preview never overflows its pane on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Post').fill('Supercalifragilisticexpialidocious '.repeat(6));
  await showPreview(page);
  await expect(page.locator('.preview-card')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
