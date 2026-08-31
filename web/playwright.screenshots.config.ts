// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /faq-screenshots\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    colorScheme: 'light',
    viewport: { width: 1440, height: 900 },
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
