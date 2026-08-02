import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E: sobe o dev server com envs neutralizadas — sem worker
 * (WORKER_BASE_URL vazio corta o dispatch no gate de sessão, antes de
 * qualquer toque no banco) e com CRON_SECRET determinístico.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      SCRAPE_MOCK: "1",
      CRON_SECRET: "e2e-cron-secret",
      WORKER_BASE_URL: "",
      WORKER_API_SECRET: "",
    },
  },
});
