// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { NextConfig } from 'next';

// Static export only: the app has no server (spec §3). `out/` is what gets
// deployed and what the Playwright tests run against.
const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  env: {
    // Read by src/flags.ts (ADR 0007). Vercel builds set VERCEL_ENV; any other
    // build is local, where `next dev` is development and the rest production.
    NEXT_PUBLIC_DEPLOY_ENV:
      process.env.VERCEL_ENV ??
      (process.env.NODE_ENV === 'development' ? 'development' : 'production'),
  },
};

export default config;
