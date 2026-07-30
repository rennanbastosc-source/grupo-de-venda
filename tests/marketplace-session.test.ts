import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSession, withSessionRetry } from "@/lib/scrapers/session/ensure";
import { loadSession, saveSession, listSessionStatuses } from "@/lib/scrapers/session/store";
import { performLogin } from "@/lib/scrapers/session/login";

describe("Marketplace Session Management (Fatia 01)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("SCRAPE_MOCK=1 retorna sessão dummy sem chamada externa", async () => {
    process.env.SCRAPE_MOCK = "1";
    const session = await ensureSession("mercadolivre");
    expect(session.source).toBe("mercadolivre");
    expect(session.status).toBe("ok");
    expect(session.cookies.mock_session).toBe("mock_mercadolivre_token");
    expect(session.cookieHeader).toContain("mock_mercadolivre_token");
  });

  it("throws erro com nome da env quando credenciais estiverem ausentes (mock off)", async () => {
    delete process.env.SCRAPE_MOCK;
    delete process.env.ML_LOGIN;
    delete process.env.ML_PASS;

    await expect(performLogin("mercadolivre")).rejects.toThrow(/ML_LOGIN/);
  });

  it("ensureSession reutiliza sessão com status ok sem forçar re-login", async () => {
    process.env.SCRAPE_MOCK = "1";
    const mockStore = new Map();
    const mockSupabase = {
      from: vi.fn().mockImplementation((table) => ({
        select: () => ({
          eq: (col: string, val: string) => ({
            maybeSingle: async () => {
              const data = mockStore.get(val);
              return { data, error: null };
            },
          }),
        }),
        upsert: async (payload: any) => {
          mockStore.set(payload.source, payload);
          return { error: null };
        },
      })),
    } as any;

    // 1ª vez: salva sessão
    await saveSession(
      {
        source: "amazon",
        cookies: { session_id: "123" },
        cookieHeader: "session_id=123",
        status: "ok",
      },
      mockSupabase,
    );

    const loaded = await loadSession("amazon", mockSupabase);
    expect(loaded?.cookies.session_id).toBe("123");

    // ensureSession deve reutilizar
    const session = await ensureSession("amazon", { customSupabase: mockSupabase });
    expect(session.cookies.session_id).toBe("123");
  });

  it("withSessionRetry executa 1 re-login se a chamada falhar com erro de autenticação", async () => {
    process.env.SCRAPE_MOCK = "1";
    let attempts = 0;

    const result = await withSessionRetry("shopee", async (session) => {
      attempts++;
      if (attempts === 1) {
        throw new Error("401 Unauthorized - sessão inválida");
      }
      return `sucesso-${session.source}`;
    });

    expect(attempts).toBe(2);
    expect(result).toBe("sucesso-shopee");
  });

  it("listSessionStatuses traz formato público sem expor cookies", async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: async () => ({
          data: [
            { source: "mercadolivre", status: "ok", last_error: null, updated_at: "2026-07-30T00:00:00Z" },
          ],
        }),
      })),
    } as any;

    const statuses = await listSessionStatuses(mockSupabase);
    expect(statuses).toHaveLength(3); // mercadolivre, amazon, shopee
    const ml = statuses.find((s) => s.source === "mercadolivre");
    expect(ml?.status).toBe("ok");
    expect((ml as any).cookies).toBeUndefined();
  });
});
