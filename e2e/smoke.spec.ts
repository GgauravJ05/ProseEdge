// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

test('styles a selection and restores accessible text', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'ProseEdge' })).toBeVisible();

  const post = page.getByLabel('Post');
  const bold = page.getByRole('button', { name: 'Bold' });
  const plain = await post.inputValue();
  expect(plain).toMatch(/^[\n -~]+$/u);

  await post.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(0, 'Styled'.length);
  });
  await bold.click();
  const styled = await post.inputValue();
  expect(styled).not.toBe(plain);
  // NFKC folds mathematical alphanumerics back to ASCII (spec §7.3).
  expect(styled.normalize('NFKC')).toBe(plain);

  // The selection survives the re-render, so a second click toggles it off.
  await bold.click();
  await expect(post).toHaveValue(plain);

  await bold.click();
  await expect(post).toHaveValue(styled);
  await page.getByRole('button', { name: 'Restore accessible text' }).click();
  await expect(post).toHaveValue(plain);

  expect(errors).toEqual([]);
});
