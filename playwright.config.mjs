import { defineConfig } from '@playwright/test';

const projects = [
  { name: 'desktop-large', viewport: { width: 1536, height: 864 } },
  { name: 'desktop', viewport: { width: 1366, height: 768 } },
  { name: 'desktop-small', viewport: { width: 1024, height: 768 } },
  { name: 'tablet', viewport: { width: 768, height: 1024 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
  { name: 'mobile-small', viewport: { width: 360, height: 800 } },
  { name: 'mobile-min', viewport: { width: 320, height: 568 } },
];

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: projects.map(({ name, viewport }) => ({ name, use: { viewport } })),
});
