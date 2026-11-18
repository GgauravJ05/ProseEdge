// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

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

  await page.getByRole('button', { name: 'Remove styling' }).click();
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
  // Alphabets are drawn in their own letters but named in plain words.
  await page.getByLabel('Post').fill('Some words');
  await page.getByRole('button', { name: /^Alphabet:/u }).click();
  await expect(page.getByRole('button', { name: 'Script', exact: true })).toContainText('𝒮𝒸𝓇𝒾𝓅𝓉');
});

test('the editor opens empty, and an example is one click away', async ({ page }) => {
  await page.goto('/format');
  const post = page.getByLabel('Post');
  await expect(post).toHaveValue('');
  await page.getByRole('button', { name: 'Try an example' }).click();
  // The example arrives with some styling, so the checks have something to read out.
  await expect(post).not.toHaveValue('');
  await expect(page.getByRole('region', { name: 'What a screen reader may say' })).toContainText(
    'mathematical sans-serif bold capital w',
  );
  await expect(page.getByRole('button', { name: 'Try an example' })).toHaveCount(0);
});

test('with nothing selected, styling acts on the whole post and says so', async ({ page }) => {
  await page.goto('/format');
  const post = page.getByLabel('Post');
  await post.fill('All of it');
  await select(post, 0, 0);
  await expect(page.locator('.scope')).toHaveText('Whole post');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(post).toHaveValue('𝐀𝐥𝐥 𝐨𝐟 𝐢𝐭');

  await select(post, 0, 3);
  await expect(page.locator('.scope')).toHaveText('Selection');
});

test('pointing at an alphabet previews it, and Escape leaves the post as it was', async ({
  page,
}) => {
  await page.goto('/format');
  const post = page.getByLabel('Post');
  await post.fill('Keep calm');
  await select(post, 0, 'Keep'.length);
  await page.getByRole('button', { name: /^Alphabet:/u }).click();
  await page.getByRole('button', { name: 'Fraktur', exact: true }).hover();
  // Only the selected word changes, and the checks read out the preview.
  await expect(post).toHaveValue('𝔎𝔢𝔢𝔭 calm');
  await expect(page.getByRole('region', { name: 'What a screen reader may say' })).toContainText(
    'mathematical fraktur capital k',
  );

  await page.keyboard.press('Escape');
  await expect(post).toHaveValue('Keep calm');
  await expect(page.getByRole('group', { name: 'Font' })).toHaveCount(0);

  await page.getByRole('button', { name: /^Alphabet:/u }).click();
  await page.getByRole('button', { name: 'Fraktur', exact: true }).click();
  await expect(post).toHaveValue('𝔎𝔢𝔢𝔭 calm');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the checks come straight after the editor, before the copy buttons', async ({ page }) => {
    await page.goto('/format');
    const post = await page.getByLabel('Post').boundingBox();
    const checks = await page.getByRole('region', { name: 'Checks' }).boundingBox();
    expect(checks?.y ?? 0).toBeGreaterThan((post?.y ?? 0) + (post?.height ?? 0));
    // Reading and tab order, since the copy buttons can be pinned over the page.
    const follows = await page.evaluate(() => {
      const listen = document.querySelector('.listen');
      const copy = document.querySelector('.actions .primary');
      if (listen === null || copy === null) return false;
      return Boolean(listen.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(follows).toBe(true);
  });

  const inView = (locator: Locator, page: Page) =>
    locator.evaluate((el, height) => {
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= height;
    }, page.viewportSize()?.height ?? 0);

  test('the copy buttons stay in reach while there is a post to copy', async ({ page }) => {
    await page.goto('/format');
    const copy = page.getByRole('button', { name: 'Copy styled' });
    await page.getByRole('button', { name: 'Try an example' }).click();
    expect(await inView(copy, page)).toBe(true);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await inView(copy, page)).toBe(true);
  });

  test('an empty post pins nothing, since there is nothing to copy', async ({ page }) => {
    await page.goto('/format');
    const bar = page.locator('.dock-bar');
    await expect(bar).toHaveCSS('position', 'static');
  });

  test('copy confirmation and undo show up beside the pinned buttons', async ({ page }) => {
    await page.goto('/format');
    await page.getByRole('button', { name: 'Try an example' }).click();
    await page.getByRole('button', { name: 'Clear post' }).click();
    const undo = page.getByRole('button', { name: 'Undo' });
    await expect(undo).toBeVisible();
    expect(await inView(undo, page)).toBe(true);
    await undo.click();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copy styled' }).click();
    const status = page.getByRole('status');
    await expect(status).toHaveText('Copied the styled post.');
    expect(await inView(status, page)).toBe(true);
  });
});

test('editing clears the copy confirmation, which no longer describes the post', async ({
  page,
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/format');
  const post = page.getByLabel('Post');
  await post.fill('A post');
  await page.getByRole('button', { name: 'Copy styled' }).click();
  await expect(page.getByRole('status')).toHaveText('Copied the styled post.');
  await post.fill('A longer post');
  await expect(page.locator('.status')).toBeEmpty();
});
