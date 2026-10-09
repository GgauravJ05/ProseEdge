// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

import { select } from './helpers';

test('clearing the post can be undone', async ({ page }) => {
  await page.goto('/format');
  const post = page.getByLabel('Post');
  await post.fill('Keep these words');
  await page.getByRole('button', { name: 'Clear post' }).click();
  await expect(post).toHaveValue('');
  await expect(page.getByRole('status')).toHaveText('Post cleared.');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(post).toHaveValue('Keep these words');
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('removing all styling can be undone', async ({ page }) => {
  await page.goto('/format');
  const post = page.getByLabel('Post');
  await post.fill('Hi there');
  await select(post, 0, 2);
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(post).toHaveValue('𝐇𝐢 there');

  await page.getByRole('button', { name: 'Restore accessible text' }).click();
  await expect(post).toHaveValue('Hi there');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(post).toHaveValue('𝐇𝐢 there');
});

test('typing after a reset retires the undo, so it cannot overwrite newer work', async ({
  page,
}) => {
  await page.goto('/format');
  const post = page.getByLabel('Post');
  await post.fill('First');
  await page.getByRole('button', { name: 'Clear post' }).click();
  await post.fill('Second');
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('icon-only controls keep their names and explain themselves on hover', async ({ page }) => {
  await page.goto('/format');
  for (const name of [
    'Bold',
    'Italic',
    'Underline',
    'Strikethrough',
    'Bulleted list',
    'Clear post',
  ]) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('title', new RegExp(`^${name}`, 'u'));
  }
  // Font buttons are drawn in their own alphabet but named in plain words.
  await expect(page.getByRole('button', { name: 'Script', exact: true })).toContainText('𝒮𝒸𝓇𝒾𝓅𝓉');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the checks come straight after the editor, before every style', async ({ page }) => {
    await page.goto('/format');
    const checks = await page.getByRole('region', { name: 'Checks' }).boundingBox();
    const styles = await page.getByRole('region', { name: 'Every style' }).boundingBox();
    expect(checks?.y ?? 0).toBeLessThan(styles?.y ?? 0);
  });
});
