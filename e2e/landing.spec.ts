// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

test('the heading reads as plain words, whatever alphabet it is showing', async ({ page }) => {
  await page.goto('/');
  // The styled glyphs are decoration and hidden; the accessible name is plain.
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
    'Unicode bold is not rich text.',
  );
});

test('the before/after divider moves from the keyboard', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: /Compare what readers see/u });
  await expect(slider).toHaveAttribute('aria-valuenow', '50');
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
});

test('the style chips restyle the sample and recount it', async ({ page }) => {
  await page.goto('/');
  const chips = page.getByRole('group', { name: 'Style the opening' });
  await expect(chips.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  const heard = page.locator('.ba-heard .ba-post');
  await expect(heard).toContainText('mathematical sans-serif bold capital w');

  await chips.getByRole('button', { name: 'Fraktur' }).click();
  await expect(chips.getByRole('button', { name: 'Fraktur' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(heard).toContainText('mathematical fraktur capital w');
});

test('the try-it box styles what you type, live', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Type anything');
  await input.fill('Hi 7');
  const bold = page.locator('.try-row').first();
  await expect(bold.locator('.try-sample')).toHaveText('𝗛𝗶 𝟳');
  // Two letters and a digit, each read out by name.
  await expect(bold.locator('.try-cost')).toContainText('3');
  await expect(page.getByRole('button', { name: 'Copy the Bold version' })).toBeEnabled();
  await input.fill('');
  await expect(page.getByRole('button', { name: 'Copy the Bold version' })).toBeDisabled();
});

test('the meters recount when the post goes plain', async ({ page }) => {
  await page.goto('/');
  const linkedin = page.locator('.meter-card', { hasText: 'LinkedIn' });
  await linkedin.scrollIntoViewIfNeeded();
  await expect(linkedin).toContainText('Styling adds');
  await page
    .getByRole('group', { name: 'Count the post' })
    .getByRole('button', { name: 'Plain' })
    .click();
  await expect(linkedin).toContainText('Styling is free here');
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test.describe(`with reducedMotion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    // A hydration mismatch is a page error, and React answers it by discarding
    // the prerendered page and rebuilding it — elements detach mid-test.
    test('the landing page hydrates without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });
  });
}
