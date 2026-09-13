// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

/** Select a UTF-16 range in the textarea and let the editor see the change. */
async function select(post: Locator, start: number, end: number): Promise<void> {
  await post.evaluate(
    (el: HTMLTextAreaElement, range: readonly [number, number]) => {
      el.focus();
      el.setSelectionRange(range[0], range[1]);
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    },
    [start, end] as const,
  );
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('styles a selection and restores accessible text', async ({ page }) => {
  const post = page.getByLabel('Post');
  const bold = page.getByRole('button', { name: 'Bold' });
  const plain = await post.inputValue();
  expect(plain).toMatch(/^[\n -~]+$/u);

  await select(post, 0, 'Unicode'.length);
  await bold.click();
  const styled = await post.inputValue();
  expect(styled).not.toBe(plain);
  // NFKC folds mathematical alphanumerics back to ASCII (spec §7.3).
  expect(styled.normalize('NFKC')).toBe(plain);
  await expect(bold).toHaveAttribute('aria-pressed', 'true');

  // The selection survives the re-render, so a second click toggles it off.
  await bold.click();
  await expect(post).toHaveValue(plain);

  await bold.click();
  await expect(post).toHaveValue(styled);
  await page.getByRole('button', { name: 'Restore accessible text' }).click();
  await expect(post).toHaveValue(plain);
});

test('fonts disable the emphasis Unicode does not have', async ({ page }) => {
  const post = page.getByLabel('Post');
  const plain = await post.inputValue();
  const bold = page.getByRole('button', { name: 'Bold' });
  const italic = page.getByRole('button', { name: 'Italic' });
  await select(post, 0, 'Unicode'.length);

  await page.getByRole('button', { name: 'Mono' }).click();
  await expect(page.getByRole('button', { name: 'Mono' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bold).toBeDisabled();
  await expect(italic).toBeDisabled();

  await page.getByRole('button', { name: 'Script' }).click();
  await expect(bold).toBeEnabled();
  await expect(italic).toBeDisabled();

  // Fraktur has a bold form in Unicode but no italic one, like script.
  await page.getByRole('button', { name: 'Fraktur' }).click();
  await expect(page.getByRole('button', { name: 'Fraktur' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(bold).toBeEnabled();
  await expect(italic).toBeDisabled();

  // Double-struck has neither, like monospace.
  await page.getByRole('button', { name: 'Double' }).click();
  await expect(bold).toBeDisabled();
  await expect(italic).toBeDisabled();

  await page.getByRole('button', { name: 'Sans' }).click();
  await italic.click();
  expect((await post.inputValue()).normalize('NFKC')).toBe(plain);
  await expect(italic).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Serif' }).click();
  await italic.click();
  await expect(post).toHaveValue(plain);
});

test('keyboard shortcuts toggle bold and italic', async ({ page }) => {
  const post = page.getByLabel('Post');
  const plain = await post.inputValue();
  await select(post, 0, 'Unicode'.length);
  await post.press('ControlOrMeta+b');
  await expect(post).not.toHaveValue(plain);
  await post.press('ControlOrMeta+b');
  await expect(post).toHaveValue(plain);
  await post.press('ControlOrMeta+i');
  expect((await post.inputValue()).normalize('NFKC')).toBe(plain);
});

test('typing inside styled text continues the style and keeps the caret', async ({ page }) => {
  const post = page.getByLabel('Post');
  await select(post, 0, 'Unicode'.length);
  await page.getByRole('button', { name: 'Bold' }).click();
  await post.press('ArrowRight');
  await page.keyboard.type('XY');
  const letters = [...(await post.inputValue())];
  expect(letters.slice(7, 10)).toEqual(['\u{1D417}', '\u{1D418}', ' ']);
});

test('copies the styled post and the plain text', async ({ page }) => {
  const post = page.getByLabel('Post');
  const plain = await post.inputValue();
  await select(post, 0, 'Unicode'.length);
  await page.getByRole('button', { name: 'Bold' }).click();
  const styled = await post.inputValue();

  await page.getByRole('button', { name: 'Copy styled' }).click();
  await expect(page.getByRole('status')).toHaveText('Copied the styled post.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(styled);

  await page.getByRole('button', { name: 'Copy plain text' }).click();
  await expect(page.getByRole('status')).toHaveText('Copied plain text.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(plain);
});
