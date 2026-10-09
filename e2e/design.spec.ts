// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';

test('the three type families are loaded and applied', async ({ page }) => {
  await page.goto('/');
  const family = (selector: string): Promise<string> =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await family('h1')).toContain('Space Grotesk');
  expect(await family('body')).toContain('Plus Jakarta Sans');
  expect(await family('.stat-label')).toContain('JetBrains Mono');
});

test('the grain layer is painted but never catches the pointer', async ({ page }) => {
  await page.goto('/');
  const grain = await page.evaluate(() => {
    const style = getComputedStyle(document.body, '::before');
    return { events: style.pointerEvents, image: style.backgroundImage, position: style.position };
  });
  expect(grain.position).toBe('fixed');
  expect(grain.events).toBe('none');
  // A data: URI, so drawing it costs no request.
  expect(grain.image).toContain('data:image/svg+xml');
});

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the hero reveals on load and content below the fold is there once scrolled to', async ({
    page,
  }) => {
    await page.goto('/');
    // The hero is in view on load, so it reveals without scrolling.
    await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1');
    const tile = page.locator('.tile').first();
    await tile.scrollIntoViewIfNeeded();
    await expect(tile).toHaveCSS('opacity', '1');
  });

  test('the primary button leans toward a mouse and returns when it leaves', async ({ page }) => {
    await page.goto('/');
    const lean = page.locator('.hero-copy .cta-primary').locator('xpath=..');
    const box = await lean.boundingBox();
    if (!box) throw new Error('no box');
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
    await expect.poll(() => lean.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
    await page.mouse.move(box.x - 200, box.y - 200);
    await expect
      .poll(() => lean.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e), {
        timeout: 3000,
      })
      .toBeCloseTo(0, 0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('nothing is left hidden for a reader who cannot run the page’s scripts', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1');
  });
});
