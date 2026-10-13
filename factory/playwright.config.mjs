import { defineConfig, devices } from '@playwright/test';

const port = process.env.FACTORY_PORT || '4173';

export default defineConfig({
  testDir: process.env.ACCEPTANCE_DIR,
  testMatch: /.*\.spec\.(m?js|ts)$/,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  retries: 1,
  workers: 2,
  reporter: [['json', { outputFile: process.env.RESULTS_JSON || 'results.json' }], ['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
});
