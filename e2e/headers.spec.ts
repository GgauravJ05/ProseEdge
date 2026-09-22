// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The preview server sends the headers from `vercel.json` (see vite.config.ts),
 * so these tests check the policy the live site serves, and the other specs —
 * which fail on any console error — check that the app still works under it.
 */

import { expect, test } from '@playwright/test';

test('every response carries the security headers', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};

  const policy = headers['content-security-policy'] ?? '';
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("base-uri 'self'");
  // Nothing is loaded from another origin: fonts are self-hosted and the
  // analytics script, when enabled, is served from this domain.
  expect(policy).toContain("font-src 'self'");
  expect(policy).toContain("connect-src 'self'");

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
});

test('the page runs clean under the policy, with its fonts and styles applied', async ({
  page,
}) => {
  const blocked: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') blocked.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByLabel('Post')).toBeVisible();

  // A blocked stylesheet or font would leave these at the browser defaults.
  const fonts = await page.evaluate(() => ({
    heading: getComputedStyle(document.querySelector('h1') as Element).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
  }));
  expect(fonts.heading).toContain('Space Grotesk');
  expect(fonts.body).toContain('Plus Jakarta Sans');
  expect(blocked).toEqual([]);
});
