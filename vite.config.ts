// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

/**
 * The preview server the end-to-end tests run against serves `out/` with the
 * same headers Vercel sends in production, read from `vercel.json` itself.
 *
 * A Content-Security-Policy that breaks the app then fails the suite — every
 * spec treats a console error as a failure, and a blocked script or style logs
 * one — instead of being discovered on the live site.
 *
 * Vitest uses `vitest.config.ts`, so this file only configures the preview.
 */

import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';

interface HeaderRule {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}

const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  readonly headers?: readonly HeaderRule[];
};

/** Rules that apply to every path, which is all this project uses. */
const headers = Object.fromEntries(
  (vercel.headers ?? [])
    .filter((rule) => rule.source === '/(.*)')
    .flatMap((rule) => rule.headers.map((header) => [header.key, header.value])),
);

export default defineConfig({ preview: { headers } });
