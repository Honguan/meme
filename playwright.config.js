import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: '*.spec.js', fullyParallel: false, workers: 1,
  timeout: 30000, reporter: 'list',
  use: { baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:5173', channel: process.platform === 'win32' ? 'msedge' : undefined, screenshot: 'only-on-failure', viewport: { width: 1440, height: 1080 } },
  webServer: process.env.TEST_BASE_URL ? undefined : [
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'npm run db:local && npm run dev:online', url: 'http://127.0.0.1:8787', reuseExistingServer: !process.env.CI },
  ],
});
