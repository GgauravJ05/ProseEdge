// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
const BASE_URL = 'http://localhost:4173';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Tests run against the static export exactly as deployed: `pnpm build` first.
    command: 'node_modules/.bin/vite preview --outDir out --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !CI,
  },
});
