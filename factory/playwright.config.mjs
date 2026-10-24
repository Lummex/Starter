import { defineConfig, devices } from '@playwright/test';

const port = process.env.FACTORY_PORT || '4173';

export default defineConfig({
  testDir: process.env.ACCEPTANCE_DIR,
  testMatch: /.*\.spec\.(m?js|ts)$/,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  retries: Number(process.env.PW_RETRIES ?? 1),
  // Every check opens its own fresh page, so they can all run side by side.
  // (Without fullyParallel, a single test file only ever uses ONE worker.)
  fullyParallel: true,
  workers: Number(process.env.PW_WORKERS || 4),
  reporter: [['json', { outputFile: process.env.RESULTS_JSON || 'results.json' }], ['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
});
