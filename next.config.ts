// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import type { NextConfig } from 'next';

// Static export only: the app has no server (spec §3). `out/` is what Cloudflare
// Pages serves and what the Playwright smoke tests run against.
const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
};

export default config;
