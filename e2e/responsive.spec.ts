// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * Device compliance, as assertions rather than impressions: nothing may spill
 * sideways at any common width, the editor must stay usable, and controls must
 * be big enough to hit with a thumb.
 */

import { expect, test } from '@playwright/test';

/** Small phone, large phone, tablet portrait, tablet landscape, laptop, desktop. */
const WIDTHS = [320, 390, 414, 768, 1024, 1280, 1920];

/** Horizontal overflow, which is what a phone actually shows as a broken page. */
async function overflow(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const width of WIDTHS) {
  test(`the formatter does not overflow sideways at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/format');
    const post = page.getByLabel('Post');
    await expect(post).toBeVisible();
    await post.fill(
      'A long line with an unbroken URL https://example.com/a/very/long/path/that/should/wrap and ' +
        'a ridiculously long word: Donaudampfschiffahrtselektrizitaetenhauptbetriebswerkbauunterbeamtengesellschaft',
    );

    // One pixel of slack for sub-pixel rounding.
    expect(await overflow(page)).toBeLessThanOrEqual(1);

    // The editing surface must not be squeezed to nothing.
    const box = await post.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(Math.min(240, width - 60));
  });
}

/*
 * The landing page is mostly grids — hero, comparison, features, platforms,
 * footer — and each one is a chance to spill sideways at a narrow width. It
 * gets the same sweep as the editor rather than being trusted to look fine.
 */
for (const width of WIDTHS) {
  test(`the landing page does not overflow sideways at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);

    // The primary call to action has to be reachable, not pushed off-screen.
    const cta = page.getByRole('main').getByRole('link', { name: 'Format now' }).first();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width + 1);
  });
}

test.describe('touch devices', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('controls are big enough to tap', async ({ page }) => {
    await page.goto('/format');
    await expect(page.getByLabel('Post')).toBeVisible();

    const buttons = page.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(5);

    const small: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const button = buttons.nth(i);
      if (!(await button.isVisible())) continue;
      const box = await button.boundingBox();
      const name = (await button.textContent())?.trim() ?? `#${String(i)}`;
      // WCAG 2.2 target size (minimum) is 24px; 44px is the comfortable bar.
      if ((box?.height ?? 0) < 44) small.push(`${name}: ${String(Math.round(box?.height ?? 0))}px`);
    }
    expect(small).toEqual([]);
  });

  test('the panes stack instead of sitting side by side', async ({ page }) => {
    await page.goto('/format');
    const post = await page.getByLabel('Post').boundingBox();
    const plain = await page.getByLabel('Plain text').boundingBox();
    expect(post).not.toBeNull();
    expect(plain).not.toBeNull();
    // Stacked: the plain pane starts below the styled one.
    expect(plain?.y ?? 0).toBeGreaterThan((post?.y ?? 0) + (post?.height ?? 0) - 1);
  });
});

test('the panes sit side by side on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/format');
  const post = await page.getByLabel('Post').boundingBox();
  const plain = await page.getByLabel('Plain text').boundingBox();
  expect(Math.abs((post?.y ?? 0) - (plain?.y ?? 0))).toBeLessThan(4);
  expect(plain?.x ?? 0).toBeGreaterThan((post?.x ?? 0) + (post?.width ?? 0) - 1);
});
