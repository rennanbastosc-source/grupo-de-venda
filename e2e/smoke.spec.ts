import { test, expect } from "@playwright/test";

/**
 * Smoke da aplicação montada de verdade (middleware + rotas + páginas).
 * Independe de Supabase real: sem cookie de sessão o middleware redireciona
 * e requireUser responde 401 — o mesmo comportamento com ou sem envs.
 */

test("login renderiza o formulário", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expect(page.locator("button[type=submit]")).toBeVisible();
});

test("dashboard sem sessão redireciona para /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("API autenticada responde 401 sem sessão", async ({ request }) => {
  const res = await request.get("/api/groups");
  expect(res.status()).toBe(401);
});

test("cron sem secret responde 401", async ({ request }) => {
  const res = await request.get("/api/cron/dispatch");
  expect(res.status()).toBe(401);
});

test("cron com secret errado responde 401", async ({ request }) => {
  const res = await request.get("/api/cron/dispatch", {
    headers: { "x-cron-secret": "errado" },
  });
  expect(res.status()).toBe(401);
});

test("cron dispatch com secret responde 202 imediato (padrão after)", async ({
  request,
}) => {
  const res = await request.get("/api/cron/dispatch", {
    headers: { "x-cron-secret": "e2e-cron-secret" },
  });
  expect(res.status()).toBe(202);
  const body = (await res.json()) as { accepted: boolean };
  expect(body.accepted).toBe(true);
});
