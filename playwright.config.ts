import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  // Fault-injection tests must intercept requests before a production service worker.
  // Service-worker fetch/push behavior has dedicated unit coverage.
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'pnpm exec tsx scripts/e2e-server.ts',
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
