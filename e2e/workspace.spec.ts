// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

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
    const copy = await page.getByRole('button', { name: 'Copy styled' }).boundingBox();
    expect(checks?.y ?? 0).toBeGreaterThan((post?.y ?? 0) + (post?.height ?? 0));
    expect(checks?.y ?? 0).toBeLessThan(copy?.y ?? 0);
  });
});

test.describe('when the browser blocks the clipboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
      });
    });
    await page.goto('/format');
    await page.getByLabel('Post').fill('A post');
  });

  const selected = (locator: Locator) =>
    locator.evaluate((el: HTMLTextAreaElement) => ({
      focused: document.activeElement === el,
      text: el.value.slice(el.selectionStart, el.selectionEnd),
    }));

  test('Copy styled selects the post, ready to copy by hand', async ({ page }) => {
    await page.getByRole('button', { name: 'Copy styled' }).click();
    await expect(page.getByRole('status')).toContainText('selected');
    expect(await selected(page.getByLabel('Post'))).toEqual({ focused: true, text: 'A post' });
  });

  test('Copy plain text opens the plain text and selects it', async ({ page }) => {
    await page.getByLabel('Post').fill('𝐀 post');
    await page.getByRole('button', { name: 'Copy plain text' }).click();
    await expect(page.getByRole('status')).toContainText('selected');
    await expect
      .poll(() => selected(page.getByLabel('Plain text')))
      .toEqual({
        focused: true,
        text: 'A post',
      });
  });
});

test.describe('the restore-draft prompt', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/format');
    await page.getByLabel('Post').fill('A draft worth keeping.');
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Restore your last draft?' })).toBeVisible();
  });

  test('Escape keeps the draft rather than throwing it away', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Post')).toHaveValue('A draft worth keeping.');
  });

  test('Tab stays inside it', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(
        () =>
          document.activeElement?.closest('[role=dialog], dialog') != null ||
          document.activeElement === document.body,
      );
      expect(inside).toBe(true);
    }
  });
});

test('without JavaScript, the formatter page says why nothing has loaded', async ({ request }) => {
  // In the served HTML: Playwright's script switch leaves <noscript> unparsed.
  const html = await (await request.get('/format')).text();
  expect(html).toMatch(/<noscript><p[^>]*>The formatter needs JavaScript/u);
});
