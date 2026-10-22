import { defineConfig } from '@playwright/test'

/*
 * End-to-end tests: a real browser, the real Vite app and the real Spring backend.
 *
 *   npm run e2e
 *
 * One-time setup:  npx playwright install chromium
 *
 * Playwright starts both servers itself and stops them afterwards.
 *   - The backend is `./gradlew bootRun` in ../backend (port 8080). It runs with the `h2` profile, so its
 *     database is in memory and needs nothing installed: every run starts empty. If a backend is already running there it is reused; the tests
 *     use fresh accounts, so leftover data does not matter.
 *   - The frontend gets its own Vite on port 5174 with VITE_USE_MOCK=false, so a `npm run dev`
 *     you already have open on 5173 (in mock mode, say) can never be tested by mistake.
 *     Its /api proxy still points at 8080 (see vite.config.ts).
 *
 * The first run is slow while Gradle compiles the backend, hence the long timeout.
 */

const WINDOWS = process.platform === 'win32'
const APP = 'http://127.0.0.1:5174'

export default defineConfig({
  testDir: './e2e',
  // Named *.e2e.ts so `npm test` (Vitest) never picks them up.
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // Every test signs up its own people, so tests do not depend on each other and can run side by side.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: APP,
    // The app is built phone-first, so test it at phone size.
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: WINDOWS ? 'gradlew.bat bootRun' : './gradlew bootRun',
      cwd: '../backend',
      // In-memory H2, so the tests need no Postgres and every run starts empty.
      env: { SPRING_PROFILES_ACTIVE: 'h2' },
      // Any answer counts as "up"; a signed-out request to /me is a 401.
      url: 'http://127.0.0.1:8080/api/auth/me',
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: APP,
      env: { VITE_USE_MOCK: 'false' },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
