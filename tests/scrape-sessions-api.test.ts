import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/scrape/sessions/route";
import * as apiAuth from "@/lib/api-auth";
import type { SupabaseClient, User } from "@supabase/supabase-js";

vi.mock("@/lib/api-auth", () => ({
  requireUser: vi.fn(),
}));

describe("GET /api/scrape/sessions (Fatia 03)", () => {
  it("retorna 401/403 se usuário não estiver autenticado", async () => {
    vi.spyOn(apiAuth, "requireUser").mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
      }),
    } as unknown as { error: Response; user: User; supabase: SupabaseClient });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retorna lista de status de sessão sem expor cookies", async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: async () => ({
          data: [
            { source: "mercadolivre", status: "ok", last_error: null, updated_at: "2026-07-30T00:00:00Z" },
            { source: "amazon", status: "ok", last_error: null, updated_at: "2026-07-30T00:00:00Z" },
          ],
        }),
      })),
    } as unknown as SupabaseClient;

    vi.spyOn(apiAuth, "requireUser").mockResolvedValue({
      error: undefined,
      user: { id: "u1" } as User,
      supabase: mockSupabase,
    } as unknown as { error?: Response; user: User; supabase: SupabaseClient });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as { sessions: Array<Record<string, unknown>> };

    expect(data.sessions).toHaveLength(3); // mercadolivre, amazon, shopee
    const sources = data.sessions.map((s) => s.source);
    expect(sources).toContain("mercadolivre");
    expect(sources).toContain("amazon");
    expect(sources).toContain("shopee");

    // Garante que cookies nunca vazam na resposta
    for (const s of data.sessions) {
      expect(s.cookies).toBeUndefined();
      expect(s.status).toBeDefined();
    }
  });
});
