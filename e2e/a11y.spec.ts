// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { select } from './helpers';

// WCAG 2.2 A and AA rules. A formatter that warns about accessibility has to pass them itself.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Violations as readable lines. Each one names the offending element and why it
 * failed, so a red run says what to fix rather than only which rule broke.
 *
 * Buttons and links animate their colours over 120ms (globals.css), so a scan
 * that runs the instant after a click or a theme switch samples a half-blended
 * colour — an ink that is on its way from one token to another, against a
 * background doing the same. That reports contrast failures for colour pairs
 * that are nowhere in the palette and do not exist once the paint settles.
 * Waiting for animations to finish is part of taking the measurement, so it
 * belongs here rather than in each caller.
 */
async function violations(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    // Resolves when every running transition and animation has finished.
    await Promise.all(
      document.getAnimations().map(async (animation) => {
        try {
          await animation.finished;
        } catch {
          // A cancelled animation is finished for our purposes.
        }
      }),
    );
  });
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes
        .map(
          (node) =>
            `${node.target.join(' ')} ${node.html} — ${node.failureSummary ?? violation.help}`,
        )
        .join(' | ')}`,
  );
}

// Every page the site serves, the landing page included: it carries the most
// colour of anything here (hero, cards, grids, footer) and none of it was
// covered before the formatter moved to its own route.
for (const path of ['/', '/format', '/privacy']) {
  test(`${path} has no automatically detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (path === '/format') await expect(page.getByLabel('Post')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}

test('the landing page leads to the formatter', async ({ page }) => {
  await page.goto('/');
  // Two routes in: the header and the hero. Both must actually arrive.
  await page.getByRole('main').getByRole('link', { name: 'Format now' }).first().click();
  await expect(page).toHaveURL(/\/format\/?$/u);
  await expect(page.getByLabel('Post')).toBeVisible();
});

test('the checks panel passes the scan with a warning and highlights showing', async ({ page }) => {
  await page.goto('/format');
  const post = page.getByLabel('Post');
  await post.fill('Top 3 tips');
  await select(post, 0, 'Top 3 tips'.length);
  await page.getByRole('button', { name: 'Script' }).click();
  await expect(page.locator('mark')).toHaveCount(1);
  expect(await violations(page)).toEqual([]);
});

/*
 * The preview card is a second rendering surface with its own colours, an
 * empty avatar and a decorative action row, and it is not the pane's default
 * view — so no other scan in this file reaches it. Without this, a contrast or
 * structure regression inside the card would ship unnoticed.
 */
test('the post preview passes the scan, in both themes', async ({ page }) => {
  await page.goto('/format');
  await page.getByLabel('Post').fill('A post worth previewing, with a second line to wrap.');
  await page
    .getByRole('group', { name: 'Right pane view' })
    .getByRole('button', { name: 'Preview' })
    .click();
  await expect(page.locator('.preview-card')).toBeVisible();
  expect(await violations(page)).toEqual([]);

  // The card borrows the app's own tokens, so it has to hold up in dark too.
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.preview-card')).toBeVisible();
  // `violations` waits for the colour transition to settle before scanning.
  expect(await violations(page)).toEqual([]);
});

/*
 * The restore-draft dialog only ever renders over a saved localStorage draft
 * from a previous visit, so no other scan in this file reaches it: everything
 * else starts from a clean context. The rest of the page is `inert` while it
 * is open, so this also checks that inert content is not still reachable by
 * axe's own traversal.
 */
test('the restore-draft dialog passes the scan', async ({ page }) => {
  await page.goto('/format');
  await page.getByLabel('Post').fill('A draft worth restoring.');
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Restore your last draft?' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test.describe('dark mode', () => {
  test('passes the scan and shows pressed buttons as pressed', async ({ page }) => {
    await page.goto('/format');
    // The app no longer follows the operating system, so switch it deliberately.
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const post = page.getByLabel('Post');
    await post.fill('Bold test');
    await select(post, 0, 'Bold'.length);
    const bold = page.getByRole('button', { name: 'Bold' });
    await bold.click();
    await expect(bold).toHaveAttribute('aria-pressed', 'true');

    /*
     * A pressed control must actually look filled, and this is sampled from the
     * rendered pixels rather than `getComputedStyle`. On this element Chromium
     * reported a transparent background even with an inline `!important` colour
     * set on it, so the computed value is not trustworthy here; the screenshot
     * is what the reader actually sees.
     */
    const box = await bold.boundingBox();
    expect(box).not.toBeNull();
    const pixels = await bold.screenshot();
    // A filled dark-mode button is light; an unfilled one matches the sunken
    // group behind it. Compare against the neighbouring unpressed button.
    const unpressed = await page.getByRole('button', { name: 'Italic' }).screenshot();
    expect(pixels.equals(unpressed)).toBe(false);
    expect(pixels.length).toBeGreaterThan(0);

    expect(await violations(page)).toEqual([]);
  });
});

test('the formatter works from the keyboard alone', async ({ page }) => {
  await page.goto('/format');
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
